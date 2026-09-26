import { num } from "@/lib/number";
import { normalizeText } from "@/lib/text";
import { normalizeStages } from "./calculatePricing";
import { normalizeFilaments } from "./filaments";
import {
  ALIAS_FONTES,
  aliasDocId,
  lookupPrintAlias,
  normalizeAliasChave,
  type AliasLookupProduct,
  type AliasSuggestion,
} from "./printAliases";
import { parseProductCode } from "./productCode";
import {
  assembleSubmission,
  consumptionFactor,
  printLineKey,
  printLineLabel,
  productStageKeys,
  resolveMachine,
  type BrandSplit,
  type DecidedPrint,
  type ImportContext,
  type ImportPrint,
  type LinePicks,
  type RejectedPrint,
  type ResolvedSubmission,
} from "./productionImport";
import { balanceG, brandCandidates, maxCandidatePrice } from "./stock";
import type {
  FilamentUsage,
  Machine,
  PrintAliasDraft,
  PrintAliasFonte,
  PrintAliasKey,
  ProductInput,
  ProductionEvent,
  SavedPrintAlias,
  SavedProduct,
  StockFilament,
} from "../types";

// S7 (lote 5c da 3a) — a REVISÃO do modo `real`: o arquivo v1 SEM `curadoria`
// (fase B, o dia a dia). O pipeline manda só fatos; aqui o dono decide, linha a
// linha, o que cada impressão foi — e a decisão vira as mesmas `DecidedPrint`
// da fase A, que passam pelo mesmo `assembleSubmission`/`costSubmissions`
// (grava pelo MESMO caminho do registro manual, agora com baixa de rolo).
//
// O que cada linha decide (brainstorm, HISTORICO.md): produto+etapa (só o
// apelido EXATO preenche sozinho; o resto é sugestão) · unidades (sempre
// editáveis) · desfecho (cancelada → falha, com o consumo estimado editável) ·
// "já registrado?" (máquina + dia + produto batendo com evento manual →
// desmarcada). Em cima, a tabela máquina × cor+material → MARCA (decisão do
// dono: não é guardada entre importações — vem com o palpite).
//
// Tudo PURO: o estado da tela é `ReviewRow[]` + `BrandTable`, e o efetivo de
// cada linha é CALCULADO (o apelido criado noutra aba preenche a linha "auto"
// sozinho, pelo snapshot).

// Avulso não vira peça pronta: só teste/brinde/falha (o personalizado que se
// vende é produto do catálogo — decisão do brainstorm).
export type ReviewOutcome = "estoque" | "falha" | "teste" | "brinde";
export const AVULSO_OUTCOMES: ReviewOutcome[] = ["teste", "brinde", "falha"];
export const PRODUCT_OUTCOMES: ReviewOutcome[] = ["estoque", "falha", "teste", "brinde"];

export type ReviewChoice =
  | { kind: "auto" } // segue o apelido exato
  | { kind: "avulso" }
  | { kind: "produto"; productId: string; stageKey: string };

export type ReviewGroup =
  | { kind: "auto" }
  | { kind: "sozinha" }
  | { kind: "com"; taskId: string };

// O estado de UMA linha — `null` = "o que o site sugere".
export type ReviewRow = {
  taskId: string;
  incluir: boolean;
  choice: ReviewChoice;
  outcome: ReviewOutcome | null;
  produzidas: number | null;
  creditadas: number | null;
  fator: number | null; // fração do plano consumida (só não-concluída)
  grupo: ReviewGroup;
  // "Dividir entre marcas" desta impressão: X g da marca escolhida aqui, o
  // resto da marca da tabela. Por linha de cor (`printLineKey`).
  dividir: Record<string, { filamentId: string; g: number }>;
};

// A tabela de marcas: por máquina × linha de cor, a marca e as TROCAS no
// tempo ("a partir desta impressão, marca B" — duas máquinas podem ter marcas
// diferentes ao mesmo tempo). `desde: null` = desde o começo.
export type BrandSegment = { desde: number | null; filamentId: string | null };
export type BrandTable = Record<string, BrandSegment[]>;

export const pairKey = (machineId: string, lineKey: string) => `${machineId}|${lineKey}`;

// ---------------------------------------------------------------------------
// Produto + etapa
// ---------------------------------------------------------------------------

// A chave de apelido VÁLIDA dos fatos crus (o fato é cru: fonte desconhecida
// não vira apelido).
export function factAliasKey(print: ImportPrint): PrintAliasKey | null {
  const a = print.facts.apelido;
  if (!a || !ALIAS_FONTES.includes(a.fonte as PrintAliasFonte)) return null;
  return { fonte: a.fonte as PrintAliasFonte, chave: a.chave, variante: a.variante, plate: a.plate };
}

export type RowLookup = {
  exata: SavedPrintAlias | null;
  sugestoes: AliasSuggestion[];
};

// O apelido dos fatos e, de carona, o CÓDIGO no título ("LL-0042 Quatto face"
// — o dono põe no nome do projeto): o código é o apelido mais forte.
// A lista de busca do catálogo — uma vez por snapshot de produtos, não por
// linha a cada tecla.
const lookupCache = new WeakMap<SavedProduct[], AliasLookupProduct[]>();
function lookupProductsOf(products: SavedProduct[]): AliasLookupProduct[] {
  let lista = lookupCache.get(products);
  if (!lista) {
    lista = products.map((p) => ({
      id: p.id,
      name: p.name,
      codigo: p.codigo ?? null,
      linkModel: p.linkModel,
      stages: normalizeStages(p),
    }));
    lookupCache.set(products, lista);
  }
  return lista;
}

export function lookupRow(
  print: ImportPrint,
  aliases: SavedPrintAlias[],
  products: SavedProduct[],
): RowLookup {
  const lookupProducts = lookupProductsOf(products);
  const key = factAliasKey(print);
  const porApelido = key
    ? lookupPrintAlias(key, aliases, lookupProducts)
    : { exata: null, sugestoes: [] };
  const codigo = parseProductCode(print.facts.titulo);
  const porCodigo =
    codigo && key?.fonte !== "codigo"
      ? lookupPrintAlias(
          { fonte: "codigo", chave: codigo, variante: null, plate: key?.plate ?? null },
          aliases,
          lookupProducts,
        )
      : { exata: null, sugestoes: [] };
  const exata = porApelido.exata ?? porCodigo.exata;
  const vistos = new Set(exata ? [exata.productId] : []);
  const sugestoes = [...porCodigo.sugestoes, ...porApelido.sugestoes].filter((s) => {
    if (vistos.has(s.productId)) return false;
    vistos.add(s.productId);
    return true;
  });
  return { exata, sugestoes };
}

// ---------------------------------------------------------------------------
// O efetivo de uma linha
// ---------------------------------------------------------------------------

export type EffectiveRow = {
  row: ReviewRow;
  print: ImportPrint;
  machine: Machine | null;
  machineFuzzy: boolean;
  lookup: RowLookup;
  // `undefined` = ninguém decidiu ainda (auto sem apelido exato).
  product: SavedProduct | null | undefined;
  stageKey: string | null;
  outcome: ReviewOutcome;
  produzidas: number;
  creditadas: number;
  fator: number;
  objetos: number;
  // O motivo de a linha não poder entrar (a tela mostra; o botão espera).
  erro: string | null;
};

const objetosDe = (print: ImportPrint) =>
  print.facts.objetos.reduce((s, o) => s + num(o.qtd), 0);

// Unidades sugeridas: os objetos da mesa ÷ objetos por unidade (do apelido
// exato; 1 puxador + 2 cursores = 1 zipper). Sem objetos, as peças por mesa
// do cadastro.
export function suggestUnits(
  print: ImportPrint,
  exata: SavedPrintAlias | null,
  product: SavedProduct | null | undefined,
): number {
  const objetos = objetosDe(print);
  if (objetos > 0) return Math.max(1, Math.floor(objetos / Math.max(1, exata?.objetosPorUnidade ?? 1)));
  return Math.max(1, num(product?.piecesCount) || 1);
}

export function defaultOutcome(print: ImportPrint, temProduto: boolean): ReviewOutcome {
  if (print.status !== "concluida") return "falha";
  return temProduto ? "estoque" : "teste";
}

export function effectiveRow(
  row: ReviewRow,
  print: ImportPrint,
  ctx: Pick<ImportContext, "machines" | "products" | "aliases">,
): EffectiveRow {
  const maquina = resolveMachine(print.facts.maquina, ctx.machines);
  const lookup = lookupRow(print, ctx.aliases, ctx.products);
  let product: SavedProduct | null | undefined;
  let stageKey: string | null = null;
  let erro: string | null = null;
  if (row.choice.kind === "avulso") {
    product = null;
  } else if (row.choice.kind === "produto") {
    const { productId, stageKey: sk } = row.choice;
    product = ctx.products.find((p) => p.id === productId);
    stageKey = sk;
    if (!product) erro = "O produto escolhido foi excluído — escolha outro";
    else if (!productStageKeys(product).includes(sk)) {
      erro = "A etapa escolhida não existe mais no produto — escolha outra";
    }
  } else if (lookup.exata) {
    product = ctx.products.find((p) => p.id === lookup.exata!.productId);
    stageKey = lookup.exata.stageKey;
  } else {
    product = undefined;
  }
  if (!maquina) erro = `Máquina "${print.facts.maquina}" não bate com o cadastro`;
  else if (product === undefined && !erro) erro = "Escolha o produto e a etapa (ou avulso)";

  const temProduto = Boolean(product);
  const permitidos = temProduto ? PRODUCT_OUTCOMES : AVULSO_OUTCOMES;
  const outcome =
    row.outcome && permitidos.includes(row.outcome) ? row.outcome : defaultOutcome(print, temProduto);
  const produzidas = Math.max(
    1,
    Math.floor(num(row.produzidas ?? suggestUnits(print, lookup.exata, product))),
  );
  const creditadas =
    outcome === "estoque"
      ? Math.min(produzidas, Math.max(0, Math.floor(num(row.creditadas ?? produzidas))))
      : 0;
  const fator =
    print.status === "concluida"
      ? 1
      : Math.min(1, Math.max(0, row.fator ?? consumptionFactor(print)));
  return {
    row,
    print,
    machine: maquina?.machine ?? null,
    machineFuzzy: maquina?.fuzzy ?? false,
    lookup,
    product,
    stageKey,
    outcome,
    produzidas,
    creditadas,
    fator,
    objetos: objetosDe(print),
    erro,
  };
}

// ---------------------------------------------------------------------------
// "Já registrado?"
// ---------------------------------------------------------------------------

const mesmoDia = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

// Decisão do dono (2026-09-25): mesma máquina + mesmo dia + mesmo produto
// quando os DOIS lados têm produto. Só evento lançado à mão conta (o importado
// é reconhecido pela `origemExterna`, sem palpite).
export function manualTwin(
  print: ImportPrint,
  machineId: string | null,
  productId: string | null,
  manual: ProductionEvent[],
): ProductionEvent | null {
  if (!machineId) return null;
  return (
    manual.find(
      (e) =>
        !e.origemExterna &&
        e.machineId === machineId &&
        mesmoDia(e.at, print.at) &&
        (!productId || !e.productId || e.productId === productId),
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// O estado inicial
// ---------------------------------------------------------------------------

export function initialRows(
  prints: ImportPrint[],
  ctx: Pick<ImportContext, "machines" | "products" | "aliases">,
  manual: ProductionEvent[],
): ReviewRow[] {
  return prints.map((print) => {
    const row: ReviewRow = {
      taskId: print.taskId,
      incluir: true,
      choice: { kind: "auto" },
      outcome: null,
      produzidas: null,
      creditadas: null,
      fator: null,
      grupo: { kind: "auto" },
      dividir: {},
    };
    const eff = effectiveRow(row, print, ctx);
    const twin = manualTwin(print, eff.machine?.id ?? null, eff.product?.id ?? null, manual);
    return { ...row, incluir: !twin };
  });
}

// ---------------------------------------------------------------------------
// Submissões: as mesas de um produto vendido inteiro se JUNTAM (decisão 1).
// ---------------------------------------------------------------------------

// O grupo de cada linha incluída. `auto`: em ordem de data, as mesas de etapas
// DIFERENTES do mesmo produto (com crédito) se juntam até formar o conjunto do
// produto; a etapa que repete abre outro. `sozinha`: a própria. `com X`: o
// grupo de X (se X não entra, a própria).
export function resolveGroups(effs: EffectiveRow[]): Map<string, string> {
  const incluidas = effs
    .filter((e) => e.row.incluir && !e.erro)
    .sort((a, b) => a.print.at - b.print.at);
  const grupo = new Map<string, string>();
  const abertos = new Map<string, { id: string; etapas: Set<string>; total: number }>();
  for (const e of incluidas) {
    if (e.row.grupo.kind !== "auto" || !e.product || e.outcome !== "estoque" || !e.stageKey) {
      grupo.set(e.print.taskId, e.print.taskId);
      continue;
    }
    const total = productStageKeys(e.product).length;
    const aberto = abertos.get(e.product.id);
    if (total > 1 && aberto && !aberto.etapas.has(e.stageKey) && aberto.etapas.size < aberto.total) {
      aberto.etapas.add(e.stageKey);
      grupo.set(e.print.taskId, aberto.id);
    } else {
      const novo = { id: e.print.taskId, etapas: new Set([e.stageKey]), total };
      abertos.set(e.product.id, novo);
      grupo.set(e.print.taskId, novo.id);
    }
  }
  // "com X" segue a CORRENTE (X pode estar "com Y"), em qualquer ordem de
  // data; ciclo ou alvo fora da revisão = a própria.
  const porTask = new Map(incluidas.map((e) => [e.print.taskId, e]));
  const destino = (taskId: string, vistos: Set<string>): string => {
    const e = porTask.get(taskId)!;
    if (e.row.grupo.kind !== "com" || vistos.has(taskId)) return grupo.get(taskId) ?? taskId;
    vistos.add(taskId);
    const alvo = e.row.grupo.taskId;
    return porTask.has(alvo) ? destino(alvo, vistos) : taskId;
  };
  const finais = new Map<string, string>();
  for (const e of incluidas) finais.set(e.print.taskId, destino(e.print.taskId, new Set()));
  return finais;
}

// ---------------------------------------------------------------------------
// A tabela de marcas
// ---------------------------------------------------------------------------

export type BrandPair = {
  key: string;
  machineId: string;
  machineName: string;
  lineKey: string;
  label: string;
  traduzida: boolean;
  candidates: StockFilament[];
  // As impressões que usam o par, em ordem de data (o "a partir desta").
  prints: { taskId: string; at: number; titulo: string }[];
};

// Sem cor do site, a candidata é qualquer cor ativa do MESMO material — e
// escolher uma marca é o que traduz a linha.
function candidatesFor(
  f: ImportPrint["facts"]["filamentos"][number],
  site: ImportPrint["coresSite"][number],
  stock: StockFilament[],
): StockFilament[] {
  if (site) return brandCandidates(stock, site.cor, site.material);
  const mat = normalizeText(f.material);
  return stock.filter((c) => !c.archived && (!mat || normalizeText(c.material ?? "") === mat));
}

export function brandPairs(effs: EffectiveRow[], stock: StockFilament[]): BrandPair[] {
  const pares = new Map<string, BrandPair>();
  const incluidas = effs
    .filter((e) => e.row.incluir && e.machine)
    .sort((a, b) => a.print.at - b.print.at);
  for (const e of incluidas) {
    e.print.facts.filamentos.forEach((f, i) => {
      if (num(f.g) * e.fator <= 0) return;
      const site = e.print.coresSite[i];
      const lineKey = printLineKey(f, site);
      const key = pairKey(e.machine!.id, lineKey);
      let par = pares.get(key);
      if (!par) {
        par = {
          key,
          machineId: e.machine!.id,
          machineName: e.machine!.name,
          lineKey,
          label: printLineLabel(f, site),
          traduzida: Boolean(site),
          candidates: candidatesFor(f, site, stock),
          prints: [],
        };
        pares.set(key, par);
      }
      if (!par.prints.some((p) => p.taskId === e.print.taskId)) {
        par.prints.push({ taskId: e.print.taskId, at: e.print.at, titulo: e.print.facts.titulo ?? "" });
      }
    });
  }
  return [...pares.values()].sort(
    (a, b) => a.machineName.localeCompare(b.machineName, "pt-BR") || a.label.localeCompare(b.label, "pt-BR"),
  );
}

// O palpite (decisão 3 do dono): a marca do CADASTRO do produto, ou a com saldo.
export function guessBrand(
  par: BrandPair,
  effs: EffectiveRow[],
): string | null {
  const ids = new Set(par.candidates.map((c) => c.id));
  for (const t of par.prints) {
    const product = effs.find((e) => e.print.taskId === t.taskId)?.product;
    if (!product) continue;
    const usos: FilamentUsage[] = [
      ...normalizeFilaments(product),
      ...normalizeStages(product).flatMap((s) => normalizeFilaments(s)),
    ];
    const doCadastro = usos.find((u) => u.filamentId && ids.has(u.filamentId));
    if (doCadastro?.filamentId) return doCadastro.filamentId;
  }
  // Traduzida: só as candidatas de cor+material; sem tradução, qualquer uma do
  // material seria CHUTE de cor — fica vazia até o dono escolher.
  if (!par.traduzida) return null;
  const comSaldo = [...par.candidates].sort((a, b) => balanceG(b) - balanceG(a));
  return comSaldo[0]?.id ?? null;
}

// A tabela VIVA: o que o dono mexeu (`mexidas`) + o palpite pro resto. Par
// novo (linha marcada depois) nasce com palpite; par que sumiu sai.
export function fillBrandTable(
  pairs: BrandPair[],
  mexidas: BrandTable,
  effs: EffectiveRow[],
): BrandTable {
  const table: BrandTable = {};
  for (const par of pairs) {
    table[par.key] = mexidas[par.key] ?? [{ desde: null, filamentId: guessBrand(par, effs) }];
  }
  return table;
}

// A marca vigente num instante: a última troca com `desde` ≤ `at`.
export function pickFor(table: BrandTable, key: string, at: number): string | null {
  const segs = [...(table[key] ?? [])].sort((a, b) => (a.desde ?? -Infinity) - (b.desde ?? -Infinity));
  let atual: string | null = null;
  for (const s of segs) if ((s.desde ?? -Infinity) <= at) atual = s.filamentId;
  return atual;
}

export function linePicks(e: EffectiveRow, table: BrandTable): LinePicks | null {
  if (!e.machine) return null;
  const picks: LinePicks = new Map();
  e.print.facts.filamentos.forEach((f, i) => {
    const lineKey = printLineKey(f, e.print.coresSite[i]);
    if (picks.has(lineKey)) return;
    const base = pickFor(table, pairKey(e.machine!.id, lineKey), e.print.at);
    const div = e.row.dividir[lineKey];
    const splits: BrandSplit[] = [];
    // Dividir é "X g desta, o RESTO da marca da tabela": sem marca na tabela
    // não há resto, e o X viraria a linha inteira calado.
    if (base && div && div.filamentId && div.filamentId !== base && num(div.g) > 0) {
      splits.push({ filamentId: div.filamentId, g: num(div.g) });
    }
    if (base) splits.push({ filamentId: base, g: null });
    if (splits.length > 0) picks.set(lineKey, splits);
  });
  return picks;
}

// ---------------------------------------------------------------------------
// A revisão → as submissões (o mesmo caminho da fase A)
// ---------------------------------------------------------------------------

export function reviewSubmissions(
  effs: EffectiveRow[],
  table: BrandTable,
  ctx: Pick<ImportContext, "subitemPrices">,
): { submissions: ResolvedSubmission[]; rejected: RejectedPrint[] } {
  const grupos = resolveGroups(effs);
  const porGrupo = new Map<string, DecidedPrint[]>();
  for (const e of effs) {
    const g = grupos.get(e.print.taskId);
    if (!g || !e.machine || e.product === undefined) continue;
    const d: DecidedPrint = {
      print: e.print,
      machine: e.machine,
      machineFuzzyMatched: e.machineFuzzy,
      product: e.product,
      stageKey: e.product ? e.stageKey : null,
      fator: e.fator,
      marcas: linePicks(e, table),
      outcome: e.outcome,
      mode: "real",
      unidadesProduzidas: e.produzidas,
      unidadesCreditadas: e.creditadas,
      grupo: g,
    };
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), d]);
  }
  const submissions: ResolvedSubmission[] = [];
  const rejected: RejectedPrint[] = [];
  for (const decididas of porGrupo.values()) {
    const res = assembleSubmission(decididas, ctx);
    if (res.ok) submissions.push(res.sub);
    else {
      for (const d of decididas) {
        rejected.push({ taskId: d.print.taskId, reason: res.reason, detail: res.detail });
      }
    }
  }
  submissions.sort((a, b) => a.at - b.at);
  return { submissions, rejected };
}

// ---------------------------------------------------------------------------
// Aprender apelidos (S3: "na B se aprende na revisão")
// ---------------------------------------------------------------------------

// A impressão cujo produto o DONO escolheu, com apelido nos fatos que ainda
// não existe, ensina o apelido — a próxima impressão igual já vem preenchida.
// Objetos por unidade saem da própria mesa (objetos ÷ produzidas). Apelido já
// gravado não é reescrito aqui (mudar a ligação é no formulário do produto).
export function aliasesToLearn(
  effs: EffectiveRow[],
  aliases: SavedPrintAlias[],
): { productId: string; alias: PrintAliasDraft }[] {
  const existentes = new Set(aliases.map((a) => a.id));
  const vistos = new Set<string>();
  const out: { productId: string; alias: PrintAliasDraft }[] = [];
  for (const e of effs) {
    if (!e.row.incluir || e.erro || e.row.choice.kind !== "produto" || !e.product || !e.stageKey) continue;
    const key = factAliasKey(e.print);
    if (!key) continue;
    const chave = normalizeAliasChave(key.fonte, key.chave);
    if (!chave) continue;
    const normal: PrintAliasKey = {
      fonte: key.fonte,
      chave,
      variante: key.variante?.trim() ? key.variante.trim() : null,
      plate: key.plate,
    };
    const id = aliasDocId(normal);
    if (existentes.has(id) || vistos.has(id)) continue;
    vistos.add(id);
    out.push({
      productId: e.product.id,
      alias: {
        ...normal,
        stageKey: e.stageKey,
        objetosPorUnidade: Math.max(1, Math.round(e.objetos / Math.max(1, e.produzidas)) || 1),
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// "Criar produto a partir desta impressão"
// ---------------------------------------------------------------------------

export type ProductDraftFromPrint = {
  taskId: string;
  product: Partial<ProductInput>;
  // O apelido que nasce com o produto (na mesma transação que gera o código).
  aliases: PrintAliasDraft[];
};

const LINK_MAKERWORLD = (designId: string) => `https://makerworld.com/models/${designId}`;

// O formulário NORMAL, preenchido com os fatos (peso, tempo, cores, máquina,
// objetos): o dono completa mão de obra, markup e acessórios vendo o preço.
// O nome sai do título sem o código (o código do produto novo é outro).
export function productDraftFromPrint(
  print: ImportPrint,
  machineId: string | null,
  stock: StockFilament[],
  defaultPricePerKg: number,
): ProductDraftFromPrint {
  const porLinha = new Map<string, FilamentUsage>();
  print.facts.filamentos.forEach((f, i) => {
    const g = num(f.g);
    if (g <= 0) return;
    const site = print.coresSite[i];
    const key = printLineKey(f, site);
    const atual = porLinha.get(key);
    if (atual) {
      atual.totalG += g;
      return;
    }
    const colorName = site ? site.cor : f.corCarregada ? `#${f.corCarregada}` : "";
    const material = site ? site.material : f.material;
    const candidata = maxCandidatePrice(brandCandidates(stock, colorName, material));
    porLinha.set(key, {
      filamentId: null,
      colorName,
      material,
      pricePerKg: candidata > 0 ? candidata : num(defaultPricePerKg),
      totalG: g,
    });
  });
  const titulo = (print.facts.titulo ?? "").trim();
  const nome = titulo.replace(/^\s*ll[-_ ]?\d{1,7}\s*[-–—:]?\s*/i, "").trim() || titulo;
  const key = factAliasKey(print);
  const aliases: PrintAliasDraft[] = [];
  // Código de OUTRO produto no título não vira apelido do novo.
  if (key && key.fonte !== "codigo") {
    const chave = normalizeAliasChave(key.fonte, key.chave);
    if (chave) {
      aliases.push({
        fonte: key.fonte,
        chave,
        variante: key.variante?.trim() ? key.variante.trim() : null,
        plate: key.plate,
        stageKey: "main",
        objetosPorUnidade: 1,
      });
    }
  }
  const designId = print.facts.designId ?? (key?.fonte === "mw" ? key.chave : null);
  return {
    taskId: print.taskId,
    product: {
      name: nome,
      printHours: num(print.facts.duracaoPlanoS) / 3600,
      filaments: [...porLinha.values()],
      piecesCount: Math.max(1, objetosDe(print)),
      ...(machineId ? { machineIds: [machineId] } : {}),
      ...(designId ? { linkModel: LINK_MAKERWORLD(designId) } : {}),
      kind: print.facts.personalizado ? "personalizado" : "geral",
    },
    aliases,
  };
}

// O rascunho viaja pra calculadora (outra aba) pelo `localStorage` — é
// conveniência do aparelho, e a revisão continua aberta; sem ele o botão não
// faz nada de mal (a calculadora abre vazia).
// Uma chave por impressão: dois "criar" seguidos não se sobrescrevem.
export const productDraftStorageKey = (taskId: string) => `lopolab:produtoDaImpressao:${taskId}`;

export function parseProductDraft(raw: string | null, taskId: string): ProductDraftFromPrint | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProductDraftFromPrint;
    if (!parsed || parsed.taskId !== taskId || typeof parsed.product !== "object") return null;
    return { ...parsed, aliases: Array.isArray(parsed.aliases) ? parsed.aliases : [] };
  } catch {
    return null;
  }
}
