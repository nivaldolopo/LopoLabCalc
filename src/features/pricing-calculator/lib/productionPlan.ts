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
  type ProductionCostBreakdown,
  type ProductionPlan,
  type SupplyPlan,
  ZERO_FROZEN,
} from "./production";
import { catalogPricePerKg, filamentLabel } from "./stock";
import type {
  FilamentUsage,
  ProductionFilament,
  FrozenCostBreakdown,
  Machine,
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
//  1. `wholeEventRows`/`subitemEventRows` → as LINHAS-evento (uma por máquina) de
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

// Uma linha = UM evento de produção a gravar. Mono-máquina = 1 linha; um produto
// inteiro que roda em máquinas diferentes semeia N linhas (uma por máquina), para
// o ROI (04c) atribuir à impressora certa.
export type EventRow = {
  key: string;
  productName: string;
  productId?: string;
  subitemId?: string;
  machineId: string;
  printHours: number;
  filaments: FilRow[];
  laborCost: number; // labor congelado da etapa/subitem (não editado)
  energyTariff: number; // tarifa do produto, congelada na linha
  // 7e: insumos da SUBMISSÃO, já em unidades por PLACA (qtd/peça × peças), para
  // escalarem junto das gramas. Vão só na PRIMEIRA linha do grupo: o acessório é
  // do produto, não da máquina — repetido por linha, um produto que roda em duas
  // impressoras consumiria o ímã duas vezes.
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

// Linhas-evento de um produto INTEIRO: agrupa etapas (principal + extras) por
// máquina; cada grupo vira uma linha (hora Σ, filamentos concat, labor Σ).
// Mono-máquina = 1 linha; multi-máquina = N linhas (decisão do dono).
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
      machineId: product.machineId,
      printHours: num(product.printHours),
      filaments: normalizeFilaments(product),
      labor: stageLabor(product.laborMinutes, product.laborRate),
    },
    ...normalizeStages(product).map((stage, index) => ({
      key: stageKeyFor(stage, index),
      machineId: stage.machineId,
      printHours: num(stage.printHours),
      filaments: normalizeFilaments(stage),
      labor: stageLabor(stage.laborMinutes, product.laborRate),
    })),
  ];

  const byMachine = new Map<
    string,
    {
      printHours: number;
      filaments: { usage: FilamentUsage; stageKey: string }[];
      labor: number;
    }
  >();
  for (const stage of stages) {
    const group = byMachine.get(stage.machineId) ?? {
      printHours: 0,
      filaments: [],
      labor: 0,
    };
    group.printHours += stage.printHours;
    group.filaments.push(
      ...stage.filaments.map((usage) => ({ usage, stageKey: stage.key })),
    );
    group.labor += stage.labor;
    byMachine.set(stage.machineId, group);
  }

  const multi = byMachine.size > 1;
  const supplies = accessoryRows(product, num(product.piecesCount));
  return Array.from(byMachine.entries()).map(([machineId, group], index) => {
    const machineName = machines.find((m) => m.id === machineId)?.name ?? "";
    return {
      key: nextRowKey(),
      productName: multi ? `${base} (${machineName})` : base,
      productId: product.id,
      machineId,
      printHours: group.printHours,
      filaments: group.filaments.map((f) =>
        resolveFilRow(f.usage, stock, f.stageKey),
      ),
      laborCost: group.labor,
      energyTariff: tariff,
      // Só a 1ª linha carrega os acessórios (ver `EventRow.supplies`).
      supplies: index === 0 ? supplies : [],
    };
  });
}

// Linha-evento de UM subitem vendável (o `SubitemPrice` já vem calculado). A
// máquina exibida sai do `machineUsage` do subitem, então não precisa da lista.
//
// ⚠ BUG-02: o evento representa 1 PLACA (crua), como `wholeEventRows`. O
// `SubitemPrice` mistura escalas — `printHours`/`filaments` são CRUS (placa
// inteira), mas o `costBreakdown` já vem dividido por `piecesCount` (por peça).
// Multiplico o labor de volta por `pieces` para a linha ficar toda em termos de
// placa; senão o `frozenCost` somaria material cru + labor por peça (subestimado).
export function subitemEventRows(
  product: SavedProduct,
  subitem: SubitemPrice,
  stock: StockFilament[],
): EventRow[] {
  const base = product.name || product.mainStageName || "(sem nome)";
  const primary = subitem.machineUsage[0];
  const pieces = Math.max(1, num(product.piecesCount) || 1);
  return [
    {
      key: nextRowKey(),
      productName: `${base} — ${subitem.name || "subitem"}`,
      productId: product.id,
      subitemId: subitem.id,
      machineId: primary?.machineId ?? product.machineId,
      printHours: subitem.printHours,
      filaments: subitem.filaments.map((f) => resolveFilRow(f, stock)),
      laborCost: subitem.costBreakdown.labor * pieces,
      energyTariff: productEnergyTariff(product),
      supplies: accessoryRows(product, pieces, subitem.id),
    },
  ];
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
    const plan = planProduction(filaments, Array.from(map.values()), id, mode);
    for (const color of plan.colorUpdates) {
      map.set(color.id, color);
      touched.add(color.id);
    }
    const supplyPlan = planSupplies(
      row.supplies,
      Array.from(supplyMap.values()),
      id,
      mode,
    );
    for (const supply of supplyPlan.supplyUpdates) {
      supplyMap.set(supply.id, supply);
      supplyTouched.add(supply.id);
    }
    const machine = machines.find((m) => m.id === row.machineId) ?? machines[0];
    const cost = machine
      ? productionCost(
          machine,
          row.printHours,
          row.energyTariff,
          plan.materialCost,
          row.laborCost,
          supplyPlan.cost,
        )
      : {
          material: plan.materialCost,
          energy: 0,
          depreciation: 0,
          maintenance: 0,
          labor: row.laborCost,
          supplies: supplyPlan.cost,
          total: plan.materialCost + row.laborCost + supplyPlan.cost,
        };
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
  return built.map((e) => {
    const payload: ProductionPayload = {
      at: meta.at,
      outcome: meta.outcome,
      mode: meta.mode,
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
