import { num } from "@/lib/number";
import { DEFAULT_PRODUCT_INPUT } from "../constants";
import { MAIN_STAGE_KEY, normalizeStages, stageKeyFor } from "./calculatePricing";
import {
  colorKeyOf,
  filamentTotalG,
  normalizeFilaments,
  NO_COLOR,
  type ColorKey,
} from "./filaments";
import {
  addFrozen,
  frozenOf,
  planProduction,
  planSupplies,
  productionCost,
  productionCostAtRate,
  type ProductionCostBreakdown,
  type ProductionPlan,
  type SupplyPlan,
  ZERO_FROZEN,
} from "./production";
import { catalogPricePerKg, filamentLabel } from "./stock";
import { resolveFleet } from "./fleet";
import type {
  DebtLot,
  FilamentUsage,
  ProductionFilament,
  FrozenCostBreakdown,
  Machine,
  MachineUsage,
  ProductionMode,
  ProductionOutcome,
  ProductionPayload,
  SavedProduct,
  StockFilament,
  SubitemPrice,
  Supply,
  SupplyUsage,
} from "../types";

// Builder puro da PRODUÇÃO a partir de um produto/subitem (FEAT-04b, extraído da
// `ProductionPage` na 8a). Duas fases:
//  1. `wholeEventRows`/`subitemEventRows` → as LINHAS-evento (uma por ETAPA) de
//     uma seleção. Editáveis na tela (a `ProductionPage` guarda em estado); a
//     encomenda do passo 8 usa direto, sem editar.
//  2. `planEventRows` → a baixa FIFO encadeada + o custo congelado de cada linha.
//     `buildProductionPayloads` fecha o payload gravável.
//
// É a MESMA conta nos dois pontos (tela de produção e encomenda da venda): se
// divergissem, a baixa da encomenda não bateria com a da produção registrada à
// mão — exatamente o furo que o reframe do passo 8 evita.

// Uma linha de filamento (default do produto/subitem ou avulsa).
export type FilRow = {
  filamentId: string | null;
  label: string; // exibição (cor do estoque) ou texto livre
  colorName: string;
  totalG: number;
  pricePerKg: number;
  // FEAT-11: a ETAPA de origem (`MAIN_STAGE_KEY` ou o id/índice da extra, as
  // MESMAS chaves do `stageDetails` da precificação). É por ela que a cor
  // escolhida aqui chega no subitem certo: `Subitem.stageKeys` liga etapa →
  // parte, e um produto corpo-azul + tampa-vermelha credita cada SKU na sua cor.
  // Vazio em linha avulsa (não pertence a etapa nenhuma).
  stageKey: string;
  // FEAT-11: a cor com que o produto foi PRECIFICADO, congelada quando a linha
  // nasce. Só serve para a tela avisar o que a troca custou (o cálculo usa
  // sempre a cor escolhida). Ausente em linha avulsa — não havia cor de origem.
  origin?: {
    filamentId: string | null;
    label: string;
    pricePerKg: number;
  };
};

// Uma linha = UM evento de produção a gravar. [FROTA] Fase 1: uma linha por
// ETAPA — produto de etapa única = 1 linha; produto de N etapas = N linhas, mesmo
// que duas caiam na mesma impressora. É o que faz o `printedCount` do ROI contar
// impressões, e não grupos.
export type EventRow = {
  key: string;
  productName: string;
  productId?: string;
  subitemId?: string;
  // Quem IMPRIMIU — escalar, um evento = uma etapa = uma máquina (Fase 1).
  // [FROTA] Fase 2: pode nascer VAZIO quando o produto é elegível a mais de uma
  // e ninguém escolheu ainda (ver `initialRowMachineId`). A `/producao` bloqueia
  // o registro nesse estado; a encomenda, que não tem quem escolher, cai na taxa
  // de frota abaixo e conta as unidades como órfãs.
  machineId: string;
  // [FROTA] Fase 2 — onde a etapa PODERIA rodar. Não decide nada quando a
  // `machineId` está preenchida; é o denominador do custo quando ela não está.
  // ⚠ Obrigatório de propósito (AUD-02): campo opcional num tipo de escrita é
  // omissão silenciosa esperando acontecer, e aqui a omissão viraria energia e
  // desgaste ZERO num evento real. Lista vazia é a forma de dizer "frota inteira".
  fleetMachineIds: string[];
  printHours: number;
  filaments: FilRow[];
  laborCost: number; // labor congelado da etapa/subitem (não editado)
  energyTariff: number; // tarifa do produto, congelada na linha
  // 7e: insumos da SUBMISSÃO, já em unidades por PLACA (qtd/peça × peças), para
  // escalarem junto das gramas. Vão só na PRIMEIRA linha: o acessório é do
  // PRODUTO, não da etapa — repetido por linha, um produto de duas etapas
  // consumiria o ímã duas vezes.
  supplies: SupplyUsage[];
};

let rowSeq = 0;
export function nextRowKey(): string {
  return `row_${Date.now()}_${(rowSeq += 1)}`;
}

// FilamentUsage (do produto/etapa) → FilRow, resolvendo nome/preço/material da COR
// viva do Estoque quando ligada. Sem `filamentId` = avulso (mantém texto/preço).
// `stageKey` é a etapa de onde a cor veio (FEAT-11) — vazio quando não se aplica.
export function resolveFilRow(
  f: FilamentUsage,
  stock: StockFilament[],
  stageKey = "",
): FilRow {
  const total = filamentTotalG(f);
  if (f.filamentId) {
    const color = stock.find((c) => c.id === f.filamentId);
    if (color) {
      const live = catalogPricePerKg(color);
      const pricePerKg = live > 0 ? live : num(f.pricePerKg);
      const label = filamentLabel(color);
      return {
        filamentId: color.id,
        label,
        colorName: color.colorName,
        totalG: total,
        pricePerKg,
        stageKey,
        origin: { filamentId: color.id, label, pricePerKg },
      };
    }
  }
  const label = f.colorName || "Avulso";
  return {
    filamentId: null,
    label,
    colorName: f.colorName ?? "",
    totalG: total,
    pricePerKg: num(f.pricePerKg),
    stageKey,
    // Cor avulsa do PRODUTO ainda é uma origem (o preço veio do cadastro); só a
    // linha criada à mão na tela nasce sem.
    origin: { filamentId: null, label, pricePerKg: num(f.pricePerKg) },
  };
}

// Converte uma FilRow em FilamentUsage congelável (material/brand da COR — D7).
export function filRowToUsage(f: FilRow, stock: StockFilament[]): FilamentUsage {
  const color = f.filamentId
    ? stock.find((c) => c.id === f.filamentId)
    : undefined;
  return {
    filamentId: f.filamentId ?? null,
    colorName: color ? color.colorName : f.colorName,
    pricePerKg: num(f.pricePerKg),
    totalG: num(f.totalG),
    ...(color?.material ? { material: color.material } : {}),
    ...(color?.brand ? { brand: color.brand } : {}),
  };
}

/**
 * Acessórios do produto → insumos da submissão, em unidades por PLACA (7e).
 *
 * ⚠ Escalas: `Accessory.qty` é POR PEÇA (é o que a calculadora pede), enquanto
 * tudo o mais na linha-evento é por placa. Por isso o × `pieces` aqui — daí em
 * diante o `scaleRow` multiplica por placas junto com as gramas, sem fator
 * especial.
 *
 * `subitemId` filtra a produção de UM subitem: leva só o acessório atribuído a
 * ele. Acessório sem atribuição pertence ao produto inteiro e é rateado no
 * PREÇO, mas fisicamente não sai da gaveta ao imprimir uma parte só — então
 * fica de fora da baixa do subitem.
 */
export function accessoryRows(
  product: SavedProduct,
  pieces: number,
  subitemId?: string,
): SupplyUsage[] {
  const scale = Math.max(1, num(pieces) || 1);
  return (product.accessories ?? [])
    .filter((accessory) =>
      subitemId ? accessory.subitemId === subitemId : true,
    )
    .map((accessory) => ({
      supplyId: accessory.supplyId ?? null,
      name: accessory.desc || "Acessório",
      qty: num(accessory.qty) * scale,
      catalogUnitPrice: num(accessory.unitPrice),
    }))
    .filter((usage) => usage.qty > 0);
}

// Labor congelado de uma etapa: min/60 × o valor-hora do PRODUTO (a etapa não
// tem taxa própria — ver `PrintStage`).
function stageLabor(laborMinutes: number, productRate: number): number {
  return (num(laborMinutes) / 60) * num(productRate);
}

const productEnergyTariff = (product: SavedProduct): number =>
  num(product.energyTariff ?? DEFAULT_PRODUCT_INPUT.energyTariff);

// [FROTA] Fase 1 — o RÓTULO de uma etapa dentro do nome do evento. Antes o
// desambiguador era a MÁQUINA (as etapas vinham agrupadas por ela); agora que
// cada etapa é um evento, quem desambigua é o nome da etapa — e a máquina só
// entra quando a etapa não tem nome.
function stageLabel(
  name: string | undefined,
  machineName: string,
  index: number,
): string {
  return name?.trim() || machineName || `etapa ${index + 1}`;
}

/**
 * [FROTA] Fase 2 — a máquina com que uma linha de produção NASCE.
 *
 * A etapa passou a declarar um CONJUNTO ("onde cabe"), e o evento continua
 * exigindo um escalar ("quem imprimiu") — é o alicerce do ROI que a Fase 1
 * montou, e não se desfaz. Falta a ponte, e a decisão do dono (2026-09-01) é:
 * **vazia só quando há dúvida**.
 *
 * · Conjunto com UMA elegível → não há escolha a fazer, a linha já nasce nela.
 * · Conjunto com DUAS OU MAIS → nasce VAZIA, e o dono escolhe antes de
 *   registrar (a `/producao` bloqueia o botão enquanto houver linha sem
 *   máquina).
 *
 * O que isso recusa: chutar a de maior peso. O peso diz com que frequência a
 * frota roda, não quem rodou ESTA placa — e um palpite que ninguém confere vira
 * atribuição errada no ROI, calada. O atrito só aparece onde a ambiguidade é
 * real.
 *
 * ⚠ Conjunto VAZIO (todo produto anterior à fase) também é dúvida: elegível a
 * tudo é o oposto de "só cabe numa".
 */
export function initialRowMachineId(
  machineIds: string[] | undefined,
  machines: Machine[],
): string {
  const eligible = (machineIds ?? []).filter((id) =>
    machines.some((machine) => machine.id === id),
  );
  return eligible.length === 1 ? eligible[0] : "";
}

/**
 * [FROTA] Fase 2 — as máquinas que o modal de VENDA pode oferecer para um lote
 * de linhas de encomenda.
 *
 * É a **INTERSEÇÃO** dos conjuntos elegíveis das linhas que nasceram ambíguas —
 * não a união. A pergunta que o seletor faz é "em qual máquina esta encomenda
 * rodou?", uma resposta só para o item inteiro; oferecer a união deixaria o dono
 * escolher uma impressora que metade das etapas não aceita, e o
 * `reconcileReciboWrite` descartaria a escolha em silêncio naquelas etapas.
 *
 * Linha que já tem máquina fica FORA da conta: ela tinha uma elegível só, não há
 * escolha a fazer, e incluí-la na interseção reduziria as opções do que ainda
 * está em aberto a essa única — o oposto do que se quer.
 *
 * Interseção vazia (`[]`) = as partes ambíguas não têm nenhuma impressora em
 * comum (etapas que exigem máquinas diferentes). Não há uma resposta só; o modal
 * diz isso e manda usar a `/producao`, que pergunta por etapa.
 *
 * ⚠ AUD-17 [E3]: `null` = NADA ambíguo, o caso BOM — toda etapa já tem a sua
 * máquina, e o ROI credita cada uma. Devolver `[]` aqui também fazia o modal
 * exibir, no melhor caso possível (e no mais comum depois do recadastro: uma
 * etapa, uma elegível), o aviso do PIOR — "não têm uma impressora em comum … o
 * ROI não credita ninguém" — mandando o dono refazer na `/producao` um trabalho
 * que já estava certo. São dois estados opostos; o tipo agora os separa, e quem
 * consome tem de escolher qual está testando.
 */
export function encomendaMachineOptions(
  rows: EventRow[],
  machines: Machine[],
): Machine[] | null {
  const ambiguas = rows.filter((row) => !row.machineId);
  if (ambiguas.length === 0) return null;
  return machines.filter((machine) =>
    ambiguas.every((row) => {
      const declarado = (row.fleetMachineIds ?? []).filter((id) =>
        machines.some((m) => m.id === id),
      );
      // Vazio = frota inteira (todo produto anterior à fase chega assim).
      return declarado.length === 0 || declarado.includes(machine.id);
    }),
  );
}

// Linhas-evento de um produto INTEIRO: UMA LINHA POR ETAPA (principal + extras).
//
// ⚠ [FROTA] Fase 1 — antes isto AGRUPAVA por máquina, e o agrupamento mentia no
// ROI: duas etapas na mesma impressora viravam um evento só, então o
// `printedCount` contava 1 impressão onde houve 2. O agrupamento também não
// economizava nada — a baixa é encadeada e o custo é somado componente a
// componente, então N eventos de uma placa custam exatamente o que o grupo
// custava. Uma etapa = uma impressão = um evento.
export function wholeEventRows(
  product: SavedProduct,
  machines: Machine[],
  stock: StockFilament[],
): EventRow[] {
  const base = product.name || product.mainStageName || "(sem nome)";
  const tariff = productEnergyTariff(product);
  // FEAT-11: cada etapa entra com a MESMA chave estável que o rateio por subitem
  // usa (`stageDetails` em `calculatePricing`) — é o fio que leva a cor da linha
  // até a parte certa quando o inteiro é produzido de uma vez.
  const stages = [
    {
      key: MAIN_STAGE_KEY,
      name: product.mainStageName,
      machineId: initialRowMachineId(product.machineIds, machines),
      fleetMachineIds: product.machineIds ?? [],
      printHours: num(product.printHours),
      filaments: normalizeFilaments(product),
      labor: stageLabor(product.laborMinutes, product.laborRate),
    },
    ...normalizeStages(product).map((stage, index) => ({
      key: stageKeyFor(stage, index),
      name: stage.name,
      machineId: initialRowMachineId(stage.machineIds, machines),
      fleetMachineIds: stage.machineIds ?? [],
      printHours: num(stage.printHours),
      filaments: normalizeFilaments(stage),
      labor: stageLabor(stage.laborMinutes, product.laborRate),
    })),
  ];

  const multi = stages.length > 1;
  const supplies = accessoryRows(product, num(product.piecesCount));
  return stages.map((stage, index) => {
    const machineName =
      machines.find((m) => m.id === stage.machineId)?.name ?? "";
    return {
      key: nextRowKey(),
      productName: multi
        ? `${base} — ${stageLabel(stage.name, machineName, index)}`
        : base,
      productId: product.id,
      machineId: stage.machineId,
      fleetMachineIds: stage.fleetMachineIds,
      printHours: stage.printHours,
      filaments: stage.filaments.map((usage) =>
        resolveFilRow(usage, stock, stage.key),
      ),
      laborCost: stage.labor,
      energyTariff: tariff,
      // Só a 1ª linha carrega os acessórios (ver `EventRow.supplies`).
      supplies: index === 0 ? supplies : [],
    };
  });
}

// Linhas-evento de UM subitem vendável — também UMA POR ETAPA do subitem
// (`Subitem.stageKeys`), pelo mesmo motivo do inteiro.
//
// ⚠ [FROTA] Fase 1 — antes era UMA linha só, com TODAS as horas do subitem
// carimbadas na `machineUsage[0]`. Um subitem cujo corpo sai na A1 e o acabamento
// na X2D creditava as duas coisas na A1: o ROI errava a máquina, não só a
// contagem.
//
// ⚠ BUG-02 (inalterado): o evento representa 1 PLACA (crua). O `SubitemPrice`
// mistura escalas — `printHours`/`filaments` são CRUS, mas o `costBreakdown` já
// vem dividido por `piecesCount`. Por isso a mão de obra volta a ser multiplicada
// por `pieces`.
//
// ⚠ A mão de obra do subitem NÃO é a soma das etapas dele: o rateio aditivo
// (FEAT-01) embute a fatia dos PASSOS INTERNOS que cabe a esta parte. Distribuir
// só o labor de cada etapa perderia essa fatia e baratearia o evento. Então o
// total continua sendo `costBreakdown.labor × pieces` — o MESMO de antes — e o
// que muda é só como ele se reparte entre as linhas: na proporção do labor
// próprio de cada etapa (em partes iguais quando nenhuma tem labor próprio).
export function subitemEventRows(
  product: SavedProduct,
  subitem: SubitemPrice,
  stock: StockFilament[],
  machines: Machine[] = [],
): EventRow[] {
  const base = product.name || product.mainStageName || "(sem nome)";
  const pieces = Math.max(1, num(product.piecesCount) || 1);
  const tariff = productEnergyTariff(product);
  const totalLabor = subitem.costBreakdown.labor * pieces;

  // As etapas DESTE subitem, nas mesmas chaves estáveis do rateio.
  const config = (product.subitems ?? []).find((s) => s.id === subitem.id);
  const byKey = new Map<
    string,
    {
      key: string;
      name?: string;
      machineId: string;
      fleetMachineIds: string[];
      printHours: number;
      filaments: FilamentUsage[];
      labor: number;
    }
  >();
  byKey.set(MAIN_STAGE_KEY, {
    key: MAIN_STAGE_KEY,
    name: product.mainStageName,
    machineId: initialRowMachineId(product.machineIds, machines),
    fleetMachineIds: product.machineIds ?? [],
    printHours: num(product.printHours),
    filaments: normalizeFilaments(product),
    labor: stageLabor(product.laborMinutes, product.laborRate),
  });
  normalizeStages(product).forEach((stage, index) => {
    const key = stageKeyFor(stage, index);
    byKey.set(key, {
      key,
      name: stage.name,
      machineId: initialRowMachineId(stage.machineIds, machines),
      fleetMachineIds: stage.machineIds ?? [],
      printHours: num(stage.printHours),
      filaments: normalizeFilaments(stage),
      labor: stageLabor(stage.laborMinutes, product.laborRate),
    });
  });
  const stages = (config?.stageKeys ?? [])
    .map((key) => byKey.get(key))
    .filter((stage): stage is NonNullable<typeof stage> => Boolean(stage));

  // Subitem sem etapa resolvível (config sumiu, chaves órfãs) cai no
  // comportamento antigo: uma linha só, com o que o `SubitemPrice` traz. É o
  // único jeito de ainda produzir alguma coisa, e o total continua certo.
  //
  // ⚠ [FROTA] Fase 2 — a máquina desta linha vinha de `subitem.machineUsage[0]`,
  // e o `machineUsage` saiu do resultado da precificação (ele dizia com que
  // impressora a PARTE foi precificada, que a Fase 1 já provou não ser quem
  // imprimiu). A resposta nova é a mesma das outras linhas: o conjunto do
  // PRODUTO, e vazio quando há mais de uma elegível. Aqui isso é ainda mais
  // certo — se nem a etapa se resolveu, não há de onde deduzir a máquina.
  if (stages.length === 0) {
    return [
      {
        key: nextRowKey(),
        productName: `${base} — ${subitem.name || "subitem"}`,
        productId: product.id,
        subitemId: subitem.id,
        machineId: initialRowMachineId(product.machineIds, machines),
        fleetMachineIds: product.machineIds ?? [],
        printHours: subitem.printHours,
        filaments: subitem.filaments.map((f) => resolveFilRow(f, stock)),
        laborCost: totalLabor,
        energyTariff: tariff,
        supplies: accessoryRows(product, pieces, subitem.id),
      },
    ];
  }

  const ownLabor = stages.reduce((sum, stage) => sum + stage.labor, 0);
  const supplies = accessoryRows(product, pieces, subitem.id);
  const multi = stages.length > 1;
  return stages.map((stage, index) => {
    const machineName =
      machines.find((m) => m.id === stage.machineId)?.name ?? "";
    const share =
      ownLabor > 0 ? stage.labor / ownLabor : 1 / stages.length;
    return {
      key: nextRowKey(),
      productName: multi
        ? `${base} — ${subitem.name || "subitem"} · ${stageLabel(stage.name, machineName, index)}`
        : `${base} — ${subitem.name || "subitem"}`,
      productId: product.id,
      subitemId: subitem.id,
      machineId: stage.machineId,
      fleetMachineIds: stage.fleetMachineIds,
      printHours: stage.printHours,
      filaments: stage.filaments.map((usage) =>
        resolveFilRow(usage, stock, stage.key),
      ),
      laborCost: totalLabor * share,
      energyTariff: tariff,
      supplies: index === 0 ? supplies : [],
    };
  });
}

/**
 * FEAT-11 — a cor de cada peça CREDITADA, a partir das linhas como estão na tela
 * (já com as trocas do dono). PURA.
 *
 * `whole` é a cor da submissão inteira (produto sem partes, ou subitem avulso
 * selecionado: aí a lista de linhas já é só a daquela parte).
 *
 * `bySubitem` é o recorte que faz o inteiro-com-partes ficar correto: as linhas
 * de filamento carregam a etapa de origem (`stageKey`) e o subitem declara as
 * suas etapas (`stageKeys`), então cada parte recebe SÓ as cores que passaram
 * por ela. É isto que credita corpo=Azul e tampa=Vermelho num evento só, em vez
 * de carimbar "Azul + Vermelho" nas duas.
 *
 * Parte sem nenhuma linha de filamento (etapa só de montagem, ou etapa que o
 * dono zerou) cai em `NO_COLOR` — não há cor que a descreva.
 */
export function submissionColors(
  rows: EventRow[],
  subitems: { id: string; stageKeys?: string[] }[] = [],
): { whole: ColorKey; bySubitem: Map<string, ColorKey> } {
  const all = rows.flatMap((row) => row.filaments);
  const usageOf = (fils: FilRow[]): FilamentUsage[] =>
    fils.map((f) => ({
      filamentId: f.filamentId,
      colorName: f.colorName,
      pricePerKg: f.pricePerKg,
      totalG: f.totalG,
    }));

  const bySubitem = new Map<string, ColorKey>();
  for (const sub of subitems) {
    const keys = new Set(sub.stageKeys ?? []);
    const mine = all.filter((f) => keys.has(f.stageKey));
    bySubitem.set(sub.id, mine.length > 0 ? colorKeyOf(usageOf(mine)) : NO_COLOR);
  }

  return { whole: colorKeyOf(usageOf(all)), bySubitem };
}

// Escala uma linha-evento por um fator (placa inteira → P placas na /producao, ou
// qty/pieces por peça na encomenda): horas, labor e gramas por cor acompanham. O
// FIFO consome `fator ×` as gramas (custo misto exato) e energia/deprec./manut.
// seguem as horas. Um evento representa a tiragem inteira, não 1 unidade.
export function scaleRow(row: EventRow, factor: number): EventRow {
  const f = num(factor);
  return {
    ...row,
    printHours: row.printHours * f,
    laborCost: row.laborCost * f,
    filaments: row.filaments.map((fil) => ({ ...fil, totalG: fil.totalG * f })),
    // Os insumos já estão por placa (`accessoryRows` multiplicou por peças), então
    // escalam pelo MESMO fator das gramas.
    supplies: row.supplies.map((s) => ({ ...s, qty: s.qty * f })),
  };
}

// Uma linha planejada: a linha + a baixa que geraria + o custo congelado.
export type PlannedEvent = {
  id: string;
  row: EventRow;
  plan: ProductionPlan;
  supplyPlan: SupplyPlan;
  cost: ProductionCostBreakdown;
  machine?: Machine;
  filaments: FilamentUsage[];
};

export type PlannedRows = {
  built: PlannedEvent[];
  colorUpdates: StockFilament[];
  supplyUpdates: Supply[];
  summary: {
    material: number;
    frozen: number;
    // FEAT-06: a composição do `frozen`, somada componente a componente pelos
    // eventos. Invariante: `sumFrozen(frozenBreakdown) === frozen`.
    frozenBreakdown: FrozenCostBreakdown;
    grams: number;
    crossesRoll: boolean;
    shortfallG: number;
    // 7e: custo dos insumos (já dentro de `frozen`) e o que faltou no estoque.
    supplies: number;
    supplyShortfall: number;
    // [FROTA] Fase 1 — a REPARTIÇÃO da submissão por máquina, na escala das
    // linhas (placa/tiragem inteira). Uma entrada por impressora distinta, com
    // as HORAS de todas as etapas que caíram nela e a DEPRECIAÇÃO REAL congelada
    // dos eventos correspondentes.
    //
    // É esta lista que desce até a camada do acabado (por unidade) e até a
    // reconciliação da venda — ela existe porque o `sourceEventId` da camada
    // aponta só para o 1º evento e nunca poderia responder "quem imprimiu".
    machineUsage: MachineUsage[];
    // [FROTA] Fase 2 — as HORAS dos eventos SEM máquina declarada (o produto é
    // elegível a mais de uma e ninguém escolheu). Ficam FORA do `machineUsage`
    // de propósito: um id vazio na lista faria a soma `horas ÷ total` do ROI
    // fechar em 1 sobre as máquinas conhecidas, rateando para elas o lucro das
    // horas órfãs. Quem lê isto é a reconciliação, que converte a proporção em
    // `unattributedUnits`.
    unattributedHours: number;
    // AUD-16 [E7]: cores e insumos que não tinham lote e ganharam um de acerto
    // (a dívida ficou representada e custeada). É o que a tela avisa ANTES de
    // confirmar — e o que ela avisa é exatamente o que vai ser gravado.
    debtLots: DebtLot[];
  };
};

/**
 * Planeja TODAS as linhas com a baixa ENCADEADA (duas linhas na mesma cor deduzem
 * do saldo já mexido). PURA em relação aos inputs — não grava. `genId` gera o id
 * de cada evento (real ao salvar; placeholder no preview). O `itemId` dos moves =
 * o id do próprio evento.
 */
export function planEventRows(
  rows: EventRow[],
  mode: ProductionMode,
  stock: StockFilament[],
  supplies: Supply[],
  machines: Machine[],
  genId: () => string,
  // AUD-16 [E7]: a data que o lote de acerto recebe, quando precisar existir.
  at: number = Date.now(),
): PlannedRows {
  const map = new Map(stock.map((c) => [c.id, c]));
  const touched = new Set<string>();
  // 7e: mesmo encadeamento das cores, para os insumos — duas linhas que usam o
  // mesmo ímã deduzem do saldo já mexido pela anterior.
  const supplyMap = new Map(supplies.map((s) => [s.id, s]));
  const supplyTouched = new Set<string>();
  const built: PlannedEvent[] = rows.map((row) => {
    const filaments = row.filaments
      .filter((f) => num(f.totalG) > 0)
      .map((f) => filRowToUsage(f, stock));
    const id = genId();
    const plan = planProduction(
      filaments,
      Array.from(map.values()),
      id,
      mode,
      at,
    );
    for (const color of plan.colorUpdates) {
      map.set(color.id, color);
      touched.add(color.id);
    }
    const supplyPlan = planSupplies(
      row.supplies,
      Array.from(supplyMap.values()),
      id,
      mode,
      at,
    );
    for (const supply of supplyPlan.supplyUpdates) {
      supplyMap.set(supply.id, supply);
      supplyTouched.add(supply.id);
    }
    // ⚠ [FROTA] Fase 2 — aqui morava `?? machines[0]`: linha sem máquina
    // resolvível caía na PRIMEIRA do cadastro, e a energia, o desgaste e a
    // manutenção do evento saíam dela, creditados a ela. Com escalar isso era
    // quase inalcançável (o id vinha do produto); com conjunto passou a ser o
    // caminho normal da encomenda. O fallback mudo vira EXPLÍCITO: sem máquina
    // declarada, o custo é a taxa da FROTA ELEGÍVEL — a mesma que o preço usou —
    // e o evento fica SEM DONO para o ROI.
    const machine = machines.find((m) => m.id === row.machineId);
    const cost = machine
      ? productionCost(
          machine,
          row.printHours,
          row.energyTariff,
          plan.materialCost,
          row.laborCost,
          supplyPlan.cost,
        )
      : productionCostAtRate(
          resolveFleet(machines, row.fleetMachineIds),
          row.printHours,
          row.energyTariff,
          plan.materialCost,
          row.laborCost,
          supplyPlan.cost,
        );
    return { id, row, plan, supplyPlan, cost, machine, filaments };
  });

  const colorUpdates = Array.from(touched).map((id) => map.get(id)!);
  const supplyUpdates = Array.from(supplyTouched).map((id) => supplyMap.get(id)!);
  const summary = built.reduce(
    (acc, e) => {
      acc.material += e.plan.materialCost;
      acc.frozen += e.cost.total;
      // FEAT-06: no MESMO reduce do `frozen` — um segundo laço abriria a porta
      // para os dois divergirem (multi-máquina soma N eventos numa placa só).
      acc.frozenBreakdown = addFrozen(acc.frozenBreakdown, frozenOf(e.cost));
      acc.grams += e.filaments.reduce((s, f) => s + num(f.totalG), 0);
      acc.crossesRoll = acc.crossesRoll || e.plan.crossesRoll;
      acc.shortfallG += e.plan.shortfallG;
      acc.supplies += e.supplyPlan.cost;
      acc.supplyShortfall += e.supplyPlan.shortfall;
      // [FROTA] Fase 1 — agrega por máquina no MESMO laço do custo, pelo mesmo
      // motivo do `frozenBreakdown`: dois laços sobre os mesmos eventos são dois
      // números que um dia divergem. A depreciação aqui é a REAL (a do custo
      // congelado do evento), não a precificada.
      // ⚠ [FROTA] Fase 2 — evento SEM máquina não entra aqui, e as horas dele
      // vão para `unattributedHours`. Empurrá-lo com `machineId: ""` (o que o
      // antigo `?? e.row.machineId` fazia) era o pior dos dois mundos: ninguém
      // no ROI casa com id vazio, mas a soma `horas ÷ total` da venda passaria a
      // fechar em 1 sobre as máquinas conhecidas — rateando para elas o lucro
      // das horas órfãs. É o 🔴 da Fase 1, escrito às avessas.
      if (e.machine) {
        const machineId = e.machine.id;
        const prev = acc.machineUsage.find((u) => u.machineId === machineId);
        if (prev) {
          prev.hours += num(e.row.printHours);
          prev.depreciation += e.cost.depreciation;
        } else {
          acc.machineUsage.push({
            machineId,
            machineName: e.machine.name,
            hours: num(e.row.printHours),
            depreciation: e.cost.depreciation,
          });
        }
      } else {
        acc.unattributedHours += num(e.row.printHours);
      }
      acc.debtLots = [
        ...acc.debtLots,
        ...e.plan.debtLots,
        ...e.supplyPlan.debtLots,
      ];
      return acc;
    },
    {
      material: 0,
      frozen: 0,
      frozenBreakdown: ZERO_FROZEN,
      grams: 0,
      crossesRoll: false,
      shortfallG: 0,
      supplies: 0,
      supplyShortfall: 0,
      machineUsage: [] as MachineUsage[],
      // [FROTA] Fase 2 — horas de eventos sem máquina declarada. É o que impede
      // a venda de dizer "tudo atribuído" quando parte não está.
      unattributedHours: 0,
      debtLots: [] as DebtLot[],
    },
  );
  return { built, colorUpdates, supplyUpdates, summary };
}

// Fecha o payload gravável de cada evento planejado (comum à tela de produção e à
// encomenda da venda). `at`/`outcome`/`mode`/`notes` vêm de fora do plano.
// AUD-14 [D9] — a `FilamentUsage` do formulário vira a linha CONGELADA do evento:
// o `id` de estado sai (mesma disciplina do `stripFilamentIds`) e o preço muda de
// nome, porque no documento ele é o preço de CADASTRO da cor, não o que a
// impressão pagou. O custo pago é o FIFO, e vai no `frozenBreakdown.material`.
function toEventFilament(f: FilamentUsage): ProductionFilament {
  const { id: _id, pricePerKg, ...rest } = f;
  void _id;
  return { ...rest, catalogPricePerKg: num(pricePerKg) };
}

export function buildProductionPayloads(
  built: PlannedEvent[],
  meta: {
    at: number;
    outcome: ProductionOutcome;
    mode: ProductionMode;
    notes?: string;
    createdAt: number;
  },
): { id: string; payload: ProductionPayload }[] {
  // [FROTA] Fase 1 — o elo do LOTE. É o id do PRIMEIRO evento, carimbado em
  // todos (nele inclusive). Aqui é o único lugar onde ele se decide, e os DOIS
  // caminhos que gravam produção passam por esta função (a `/producao` e a
  // encomenda da venda) — é por isso que ela é o lugar certo.
  const submissionId = built[0]?.id ?? "";
  return built.map((e) => {
    const payload: ProductionPayload = {
      at: meta.at,
      outcome: meta.outcome,
      mode: meta.mode,
      submissionId,
      ...(e.row.productId ? { productId: e.row.productId } : {}),
      ...(e.row.subitemId ? { subitemId: e.row.subitemId } : {}),
      productName: e.row.productName.trim(),
      machineId: e.machine?.id ?? e.row.machineId,
      machineName: e.machine?.name ?? "",
      printHours: num(e.row.printHours),
      // AUD-14 [D9] — `toEventFilament` renomeia o preço para `catalogPricePerKg`
      // ao congelar: o que vai no documento é o preço de CADASTRO da cor, e o
      // custo real (FIFO) fica no `frozenBreakdown.material`, logo abaixo.
      filaments: e.filaments.map(toEventFilament),
      // 7e: snapshot do que foi consumido (nome + qtd + preço congelado), no
      // mesmo espírito de `filaments` — a leitura de "o que essa impressão
      // levou". O custo REAL (FIFO) não mora aqui: mora no `frozenCost`.
      ...(e.row.supplies.length > 0 ? { supplies: e.row.supplies } : {}),
      frozenCost: e.cost.total,
      // FEAT-06: a composição do `frozenCost`, congelada junto. Sem ela, só
      // material e insumos seriam reconstituíveis depois (dos arrays acima);
      // energia/desgaste/manutenção teriam que sair da máquina VIVA e a mão de
      // obra não estaria gravada em lugar nenhum. Evento novo sempre tem.
      frozenBreakdown: frozenOf(e.cost),
      stockMoves: [...e.plan.moves, ...e.supplyPlan.moves],
      ...(meta.notes && meta.notes.trim() ? { notes: meta.notes.trim() } : {}),
      createdAt: meta.createdAt,
    };
    return { id: e.id, payload };
  });
}
