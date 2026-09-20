import { num } from "@/lib/number";
import { normalizeText } from "@/lib/text";
import { colorKeyOf } from "./filaments";
import { machineNameToId } from "./productCsv";
import {
  accessoryRows,
  stageLabor,
  toEventFilament,
} from "./productionPlan";
import {
  frozenOf,
  planProduction,
  planSupplies,
  productionCost,
  type ProductionCostBreakdown,
} from "./production";
import { catalogPricePerKg } from "./stock";
import {
  addProductionLayers,
  submissionEntries,
  type FinishedEntry,
} from "./finishedGoods";
import type {
  FilamentUsage,
  FinishedGood,
  FinishedGoodPayload,
  Machine,
  ProductionOutcome,
  ProductionPayload,
  SavedProduct,
  StockFilament,
  Supply,
  SupplyUsage,
} from "../types";

// Item 3 — Importação do histórico de produção (arquivo JSON gerado por
// ferramenta externa, fora deste repo, a partir do histórico da Bambu).
//
// Tudo aqui é PURO: parse, resolução (máquina/produto/marca), custo congelado
// e o payload gravável. Quem toca o Firestore (ler produção já importada,
// gravar em lote) é o componente — mesma separação do resto do `lib/`.

// ---------------------------------------------------------------------------
// O arquivo, como a ferramenta externa o escreve.
// ---------------------------------------------------------------------------

export type BambuImportFilament = {
  colorName: string;
  material: string;
  g: number;
  hex?: string;
  filamentId?: string | null;
};

export type BambuImportEvent = {
  task_id: string;
  productName: string;
  productId?: string | null;
  maquina_sugerida: string;
  at_ms: number;
  printHours: number;
  peso_g?: number;
  filamentos: BambuImportFilament[];
  outcome_sugerido: string;
};

export type BambuImportFile = {
  aviso?: string;
  gerado_em?: string;
  eventos: BambuImportEvent[];
};

const OUTCOMES_ACEITOS: ProductionOutcome[] = ["historico", "falha", "estoque"];

// CSV-05/AUD-16 — o arquivo é escrito por uma ferramenta FORA deste repo: avisa
// o que não dá pra ler, nunca assume um valor plausível calado. `eventos` que
// não é array é o único caso fatal (não há o que importar); item da lista que
// não é objeto, ou sem `task_id`, é descartado e CONTADO — nunca vira `undefined`
// silencioso rio abaixo.
export type BambuParseResult =
  | { ok: true; file: BambuImportFile; descartados: number }
  | { ok: false; erro: string };

function readFilamento(raw: unknown): BambuImportFilament | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  return {
    colorName: typeof item.colorName === "string" ? item.colorName : "",
    material: typeof item.material === "string" ? item.material : "",
    g: num(item.g),
    ...(typeof item.hex === "string" ? { hex: item.hex } : {}),
    filamentId:
      typeof item.filamentId === "string" && item.filamentId ? item.filamentId : null,
  };
}

function readEvento(raw: unknown): BambuImportEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const taskId = typeof item.task_id === "string" ? item.task_id.trim() : "";
  if (!taskId) return null; // sem task_id não há como checar idempotência depois
  return {
    task_id: taskId,
    productName: typeof item.productName === "string" ? item.productName : "",
    productId:
      typeof item.productId === "string" && item.productId ? item.productId : null,
    maquina_sugerida:
      typeof item.maquina_sugerida === "string" ? item.maquina_sugerida : "",
    at_ms: num(item.at_ms),
    printHours: num(item.printHours),
    peso_g: num(item.peso_g),
    filamentos: Array.isArray(item.filamentos)
      ? item.filamentos.map(readFilamento).filter((f): f is BambuImportFilament => f !== null)
      : [],
    outcome_sugerido:
      typeof item.outcome_sugerido === "string" ? item.outcome_sugerido : "historico",
  };
}

export function parseBambuImportFile(raw: unknown): BambuParseResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, erro: "O arquivo não é um JSON válido." };
  }
  const item = raw as Record<string, unknown>;
  if (!Array.isArray(item.eventos)) {
    return { ok: false, erro: 'O arquivo não tem a lista "eventos".' };
  }
  const lidos = item.eventos.map(readEvento);
  const eventos = lidos.filter((e): e is BambuImportEvent => e !== null);
  return {
    ok: true,
    file: {
      ...(typeof item.aviso === "string" ? { aviso: item.aviso } : {}),
      ...(typeof item.gerado_em === "string" ? { gerado_em: item.gerado_em } : {}),
      eventos,
    },
    descartados: lidos.length - eventos.length,
  };
}

// A idempotência (passo 6) só sabe o que JÁ ESTÁ no Firestore
// (`fetchBambuImportedTaskIds`) — um `task_id` repetido DENTRO do mesmo
// arquivo (a ferramenta externa escreveu duas vezes) passaria batido nela: as
// duas linhas ainda não existem no banco, então as duas seriam gravadas, cada
// uma virando um evento com o MESMO prefixo "bambu:<task_id>". Dedup ANTES de
// resolver — mantém a 1ª ocorrência e conta as demais, no mesmo espírito do
// "avisa, não engole" do resto da importação.
export type DedupedEvents = { unicos: BambuImportEvent[]; duplicadosNoArquivo: number };

export function dedupeByTaskId(eventos: BambuImportEvent[]): DedupedEvents {
  const vistos = new Set<string>();
  const unicos: BambuImportEvent[] = [];
  let duplicadosNoArquivo = 0;
  for (const evento of eventos) {
    if (vistos.has(evento.task_id)) {
      duplicadosNoArquivo += 1;
      continue;
    }
    vistos.add(evento.task_id);
    unicos.push(evento);
  }
  return { unicos, duplicadosNoArquivo };
}

// ---------------------------------------------------------------------------
// Resolução de uma linha — máquina, produto, marca sugerida, custo congelado.
// ---------------------------------------------------------------------------

function matchKey(colorName: string, material: string): string {
  return `${normalizeText(colorName ?? "")}|${normalizeText(material ?? "")}`;
}

// Item 1 — a "marca sugerida" de cor+material no cadastro ATUAL do produto
// (etapa principal + extras), só das linhas que já têm `filamentId`. É o
// fallback quando a Bambu não sabe a marca (a ferramenta externa não conhece
// o Estoque): o cadastro pode saber, e essa sugestão vale mais que o R$/kg
// padrão digitado na importação.
function productFilamentBrandIndex(product: SavedProduct): Map<string, string> {
  const map = new Map<string, string>();
  const todas = [
    ...(product.filaments ?? []),
    ...(product.stages ?? []).flatMap((stage) => stage.filaments ?? []),
  ];
  for (const f of todas) {
    if (!f.filamentId) continue;
    const key = matchKey(f.colorName, f.material);
    if (!map.has(key)) map.set(key, f.filamentId);
  }
  return map;
}

export type ImportContext = {
  machines: Machine[];
  products: SavedProduct[];
  stock: StockFilament[];
  supplies: Supply[];
  energyTariff: number;
  // "R$/kg padrão pros materiais sem preço nesta importação" — decisão de QUEM
  // IMPORTA, não fato da impressora (ver o pedido original). Vale para todo
  // filamento avulso do lote (sem marca resolvível, ligada ou sugerida).
  defaultPricePerKg: number;
};

export type ResolvedImportLine = {
  taskId: string;
  outcome: ProductionOutcome;
  machineId: string;
  machineName: string;
  at: number;
  productId?: string;
  productName: string;
  printHours: number;
  filaments: FilamentUsage[];
  supplies: SupplyUsage[];
  laborCost: number;
  pieces: number;
  // Para a nota (passo 6) e a prévia (passo 5): o que veio do cadastro, não da
  // Bambu, e por isso não está confirmado para ESTA impressão específica.
  inheritedAccessories: boolean;
  inheritedLabor: boolean;
  inheritedFilamentBrand: boolean;
  // `maquina_sugerida` não bateu no nome exato — casou por SUBSTRING do id
  // (mesmo critério do `machineNamesToIds` do CSV). O custo (energia/desgaste/
  // manutenção) sai da máquina que o palpite escolheu; a prévia precisa poder
  // avisar quando o palpite decidiu, não a planilha.
  machineFuzzyMatched: boolean;
};

export type RejectedImportLine = {
  taskId: string;
  reason: "maquina-nao-reconhecida" | "estoque-sem-produto";
  detail: string;
};

export type ImportLineResult =
  | { ok: true; line: ResolvedImportLine }
  | { ok: false; line: RejectedImportLine };

export function resolveImportLine(
  event: BambuImportEvent,
  ctx: ImportContext,
): ImportLineResult {
  let machineFuzzyMatched = false;
  const machineId = machineNameToId(
    event.maquina_sugerida,
    ctx.machines,
    undefined,
    () => {
      machineFuzzyMatched = true;
    },
  );
  if (!machineId) {
    return {
      ok: false,
      line: {
        taskId: event.task_id,
        reason: "maquina-nao-reconhecida",
        detail: `Máquina "${event.maquina_sugerida || "(vazia)"}" não bate com o cadastro`,
      },
    };
  }
  const machine = ctx.machines.find((m) => m.id === machineId)!;

  const outcome = OUTCOMES_ACEITOS.includes(event.outcome_sugerido as ProductionOutcome)
    ? (event.outcome_sugerido as ProductionOutcome)
    : "historico";

  const product = event.productId
    ? ctx.products.find((p) => p.id === event.productId)
    : undefined;

  // 2) "estoque" exige produto religado — sem ele não há de onde tirar a SKU
  // do acabado (avulso não vira acabado, regra de sempre do sistema).
  if (outcome === "estoque" && !product) {
    return {
      ok: false,
      line: {
        taskId: event.task_id,
        reason: "estoque-sem-produto",
        detail: event.productId
          ? `Desfecho "estoque" com productId "${event.productId}" que não existe mais no catálogo`
          : 'Desfecho "estoque" sem productId',
      },
    };
  }

  const brandIndex = product ? productFilamentBrandIndex(product) : null;
  const stockById = new Map(ctx.stock.map((color) => [color.id, color]));
  let inheritedFilamentBrand = false;
  const filaments: FilamentUsage[] = event.filamentos.map((f) => {
    let filamentId = f.filamentId ?? null;
    if (!filamentId && brandIndex) {
      const sugerida = brandIndex.get(matchKey(f.colorName, f.material));
      if (sugerida) {
        filamentId = sugerida;
        inheritedFilamentBrand = true;
      }
    }
    const color = filamentId ? stockById.get(filamentId) : undefined;
    const live = color ? catalogPricePerKg(color) : 0;
    return {
      filamentId,
      colorName: f.colorName ?? "",
      material: f.material ?? "",
      pricePerKg: live > 0 ? live : ctx.defaultPricePerKg,
      totalG: num(f.g),
    };
  });

  // 3/4 — acessórios e mão de obra só existem quando há produto religado; a
  // Bambu não tem de onde os saber, e "sem produto" nunca inventa nenhum dos
  // dois.
  const pieces = product ? Math.max(1, num(product.piecesCount) || 1) : 1;
  const supplies = product ? accessoryRows(product, pieces) : [];
  const laborCost = product ? stageLabor(product.laborMinutes, product.laborRate) : 0;

  return {
    ok: true,
    line: {
      taskId: event.task_id,
      outcome,
      machineId,
      machineName: machine.name,
      at: num(event.at_ms),
      ...(product ? { productId: product.id } : {}),
      productName: product
        ? product.name || product.mainStageName || event.productName || "(sem nome)"
        : event.productName || "(sem nome)",
      printHours: num(event.printHours),
      filaments,
      supplies,
      laborCost,
      pieces,
      inheritedAccessories: supplies.length > 0,
      inheritedLabor: Boolean(product) && num(product?.laborMinutes) > 0,
      inheritedFilamentBrand,
      machineFuzzyMatched,
    },
  };
}

// ---------------------------------------------------------------------------
// Passo 6 — a nota. SEMPRE começa com o prefixo exato "bambu:<task_id>" (é
// dele que a idempotência depende); o aviso de herança, quando há, vem depois
// de " | ".
// ---------------------------------------------------------------------------

const BAMBU_NOTE_PREFIX = "bambu:";

export function bambuNotePrefix(taskId: string): string {
  return `${BAMBU_NOTE_PREFIX}${taskId}`;
}

// A leitura inversa: de uma nota gravada, qual task_id ela marca — ou `null`
// quando a nota não é de importação nenhuma (evento normal da tela). Espelha
// `bambuNotePrefix` de propósito: a mesma função que monta é a que desfaz,
// para as duas nunca divergirem sobre o que é o prefixo.
export function bambuTaskIdOf(notes: string | undefined): string | null {
  if (!notes?.startsWith(BAMBU_NOTE_PREFIX)) return null;
  const resto = notes.slice(BAMBU_NOTE_PREFIX.length);
  const fim = resto.indexOf(" | ");
  const taskId = (fim >= 0 ? resto.slice(0, fim) : resto).trim();
  return taskId || null;
}

function inheritanceNote(line: ResolvedImportLine): string | null {
  const partes: string[] = [];
  if (line.inheritedAccessories) partes.push("acessórios");
  if (line.inheritedLabor) partes.push("mão de obra");
  if (line.inheritedFilamentBrand) partes.push("filamentos");
  if (partes.length === 0) return null;
  const lista =
    partes.length === 1
      ? partes[0]
      : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
  const plural = partes.length > 1;
  return (
    `${lista} herdado${plural ? "s" : "o"} do cadastro atual do produto, ` +
    `não confirmado${plural ? "s" : "o"} para esta impressão específica`
  );
}

export function buildImportNotes(line: ResolvedImportLine): string {
  const aviso = inheritanceNote(line);
  const prefixo = bambuNotePrefix(line.taskId);
  return aviso ? `${prefixo} | ${aviso}` : prefixo;
}

// ---------------------------------------------------------------------------
// Custo congelado (os SEIS componentes) + o payload gravável.
// ---------------------------------------------------------------------------

export type CostedImportLine = {
  line: ResolvedImportLine;
  eventId: string;
  machine: Machine;
  cost: ProductionCostBreakdown;
  payload: ProductionPayload;
  finishedEntries: FinishedEntry[] | null; // só quando outcome === "estoque"
};

// `at` (do doc) já vem em `line.at` — este `now` é só o `createdAt` do
// registro (quando a importação de fato rodou), igual a qualquer evento novo.
export function costImportLine(
  line: ResolvedImportLine,
  ctx: ImportContext,
  eventId: string,
  now: number,
): CostedImportLine {
  const machine = ctx.machines.find((m) => m.id === line.machineId)!;

  // Modo `historico`: `planProduction`/`planSupplies` NÃO tocam rolo/lote — o
  // custo de material já está resolvido em `line.filaments[].pricePerKg`
  // (linha acima, em `resolveImportLine`); `planSupplies` ainda resolve o
  // insumo vivo (TD-033), por isso recebe a lista real.
  const plan = planProduction(line.filaments, ctx.stock, eventId, "historico", line.at);
  const supplyPlan = planSupplies(line.supplies, ctx.supplies, eventId, "historico", line.at);
  const cost = productionCost(
    machine,
    line.printHours,
    ctx.energyTariff,
    plan.materialCost,
    line.laborCost,
    supplyPlan.cost,
  );

  const payload: ProductionPayload = {
    at: line.at,
    outcome: line.outcome,
    mode: "historico",
    ...(line.productId ? { productId: line.productId } : {}),
    productName: line.productName,
    submissionId: eventId, // um evento = uma submissão (a Bambu não agrupa etapas)
    machineId: line.machineId,
    machineName: line.machineName,
    printHours: num(line.printHours),
    filaments: line.filaments.map(toEventFilament),
    ...(line.supplies.length > 0 ? { supplies: line.supplies } : {}),
    frozenCost: cost.total,
    frozenBreakdown: frozenOf(cost),
    // 6 — sempre vazio: historico nunca deduz rolo/lote real, nem no estoque.
    stockMoves: [],
    notes: buildImportNotes(line),
    createdAt: now,
  };

  const finishedEntries =
    line.outcome === "estoque" && line.productId
      ? submissionEntries(line.productName, cost.total, {
          color: colorKeyOf(line.filaments),
          units: line.pieces,
          breakdown: frozenOf(cost),
        })
      : null;

  return { line, eventId, machine, cost, payload, finishedEntries };
}

// ---------------------------------------------------------------------------
// A prévia (passo 5 — obrigatória, é lote e não peça a peça).
// ---------------------------------------------------------------------------

export type ImportPreviewMachine = {
  machineId: string;
  machineName: string;
  eventos: number;
  horas: number;
};

export type ImportPreview = {
  totalArquivo: number;
  // Já filtrados por idempotência (não conta o que já foi importado antes).
  aImportar: number;
  jaImportados: number;
  // `task_id` repetido DENTRO do arquivo (ver `dedupeByTaskId`) — só a 1ª
  // ocorrência chega a ser resolvida.
  duplicadosNoArquivo: number;
  semMaquina: number;
  // Casou por SUBSTRING do id, não pelo nome exato (`machineFuzzyMatched`) —
  // vale conferir se o palpite acertou a máquina certa antes de confirmar.
  maquinaAproximada: number;
  estoqueSemProduto: number;
  comProduto: number;
  semProduto: number;
  porOutcome: Record<ProductionOutcome, number>;
  porMaquina: ImportPreviewMachine[];
  periodo: { inicio: number; fim: number } | null;
  rejeitadas: RejectedImportLine[];
};

export function buildImportPreview(
  todasAsLinhas: ImportLineResult[],
  jaImportadosCount: number,
  duplicadosNoArquivo = 0,
): ImportPreview {
  const aceitas = todasAsLinhas
    .filter((r): r is { ok: true; line: ResolvedImportLine } => r.ok)
    .map((r) => r.line);
  const rejeitadas = todasAsLinhas
    .filter((r): r is { ok: false; line: RejectedImportLine } => !r.ok)
    .map((r) => r.line);

  const porMaquinaMap = new Map<string, ImportPreviewMachine>();
  const porOutcome: Record<ProductionOutcome, number> = {
    estoque: 0,
    encomenda: 0,
    teste: 0,
    falha: 0,
    brinde: 0,
    historico: 0,
  };
  let inicio: number | null = null;
  let fim: number | null = null;

  for (const line of aceitas) {
    porOutcome[line.outcome] += 1;
    const atual = porMaquinaMap.get(line.machineId);
    if (atual) {
      atual.eventos += 1;
      atual.horas += num(line.printHours);
    } else {
      porMaquinaMap.set(line.machineId, {
        machineId: line.machineId,
        machineName: line.machineName,
        eventos: 1,
        horas: num(line.printHours),
      });
    }
    if (inicio === null || line.at < inicio) inicio = line.at;
    if (fim === null || line.at > fim) fim = line.at;
  }

  return {
    // `todasAsLinhas` já passou pelos dois filtros ANTES de resolver (já
    // importado, depois duplicata no arquivo) — soma os dois de volta pro
    // total bater com o que o arquivo de fato trazia.
    totalArquivo: todasAsLinhas.length + jaImportadosCount + duplicadosNoArquivo,
    aImportar: aceitas.length,
    jaImportados: jaImportadosCount,
    duplicadosNoArquivo,
    semMaquina: rejeitadas.filter((r) => r.reason === "maquina-nao-reconhecida").length,
    maquinaAproximada: aceitas.filter((l) => l.machineFuzzyMatched).length,
    estoqueSemProduto: rejeitadas.filter((r) => r.reason === "estoque-sem-produto").length,
    comProduto: aceitas.filter((l) => l.productId).length,
    semProduto: aceitas.filter((l) => !l.productId).length,
    porOutcome,
    porMaquina: [...porMaquinaMap.values()].sort((a, b) => b.horas - a.horas),
    periodo: inicio !== null && fim !== null ? { inicio, fim } : null,
    rejeitadas,
  };
}

// ---------------------------------------------------------------------------
// Passo 6 (gravação) — agrupamento.
// ---------------------------------------------------------------------------

// O par que `saveProduction` grava: os eventos de UMA transação + no máximo UM
// acabado (é a API que já existe — ver `productionRepository.ts`). Mesmo shape
// de `FinishedUpdate` do repositório, sem importar daquele módulo (esta lib é
// pura; o Firestore fica do lado do componente).
export type ImportFinishedUpdate = { productId: string; payload: FinishedGoodPayload };

/**
 * Um `FinishedUpdate` por PRODUTO com linha `estoque` neste lote — dobra as
 * camadas das suas linhas em sequência (a "produção" acumulada do lote inteiro
 * para aquele produto), partindo do acabado VIVO (`goods`). Reusa
 * `addProductionLayers`, a MESMA função que a tela manual usa: nenhuma segunda
 * regra de como uma camada se empilha.
 */
export function buildImportFinishedUpdates(
  costed: CostedImportLine[],
  goods: FinishedGood[],
): ImportFinishedUpdate[] {
  const byProduct = new Map<string, CostedImportLine[]>();
  for (const c of costed) {
    if (c.line.outcome !== "estoque" || !c.line.productId || !c.finishedEntries) {
      continue;
    }
    const lista = byProduct.get(c.line.productId) ?? [];
    lista.push(c);
    byProduct.set(c.line.productId, lista);
  }

  const updates: ImportFinishedUpdate[] = [];
  for (const [productId, linhas] of byProduct) {
    let good: FinishedGood | null = goods.find((g) => g.id === productId) ?? null;
    let payload: FinishedGoodPayload | null = null;
    for (const c of linhas) {
      payload = addProductionLayers(
        good,
        productId,
        c.line.productName,
        c.finishedEntries!,
        c.eventId,
        c.line.at,
      );
      good = { ...payload, id: productId };
    }
    if (payload) updates.push({ productId, payload });
  }
  return updates;
}

// As linhas SEM `estoque` (ou `estoque` sem produto — não existe mais aqui: já
// foi rejeitada em `resolveImportLine`) não competem pelo doc do acabado — só
// pelo tamanho da transação. `chunkSize` evita centenas de escritas síncronas
// numa transação só (Firestore aceita até ~500 mutações por transação).
export function bulkImportChunks(
  costed: CostedImportLine[],
  chunkSize = 300,
): CostedImportLine[][] {
  const bulk = costed.filter((c) => c.line.outcome !== "estoque");
  const chunks: CostedImportLine[][] = [];
  for (let i = 0; i < bulk.length; i += chunkSize) {
    chunks.push(bulk.slice(i, i + chunkSize));
  }
  return chunks;
}

// As linhas `estoque` também precisam ser gravadas (o `ImportFinishedUpdate`
// só cuida do doc do acabado) — uma transação por PRODUTO, junto do respectivo
// `ImportFinishedUpdate` (é o limite de 1 acabado por transação do
// `saveProduction`).
export function estoqueGroupsByProduct(
  costed: CostedImportLine[],
): Map<string, CostedImportLine[]> {
  const byProduct = new Map<string, CostedImportLine[]>();
  for (const c of costed) {
    if (c.line.outcome !== "estoque" || !c.line.productId) continue;
    const lista = byProduct.get(c.line.productId) ?? [];
    lista.push(c);
    byProduct.set(c.line.productId, lista);
  }
  return byProduct;
}
