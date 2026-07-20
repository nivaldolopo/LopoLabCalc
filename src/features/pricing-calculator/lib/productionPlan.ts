import { num } from "@/lib/number";
import { DEFAULT_PRODUCT_INPUT } from "../constants";
import { normalizeStages } from "./calculatePricing";
import { filamentTotalG, normalizeFilaments } from "./filaments";
import {
  planProduction,
  planSupplies,
  productionCost,
  type ProductionCostBreakdown,
  type ProductionPlan,
  type SupplyPlan,
} from "./production";
import { catalogPricePerKg, filamentLabel } from "./stock";
import type {
  FilamentUsage,
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
export function resolveFilRow(f: FilamentUsage, stock: StockFilament[]): FilRow {
  const total = filamentTotalG(f);
  if (f.filamentId) {
    const color = stock.find((c) => c.id === f.filamentId);
    if (color) {
      const live = catalogPricePerKg(color);
      return {
        filamentId: color.id,
        label: filamentLabel(color),
        colorName: color.colorName,
        totalG: total,
        pricePerKg: live > 0 ? live : num(f.pricePerKg),
      };
    }
  }
  return {
    filamentId: null,
    label: f.colorName || "Avulso",
    colorName: f.colorName ?? "",
    totalG: total,
    pricePerKg: num(f.pricePerKg),
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
      unitPrice: num(accessory.unitPrice),
    }))
    .filter((usage) => usage.qty > 0);
}

// Labor congelado de uma etapa: min/60 × taxa (a da etapa, ou a do produto).
function stageLabor(
  laborMinutes: number,
  laborRate: number | undefined,
  productRate: number,
): number {
  return (num(laborMinutes) / 60) * num(laborRate ?? productRate);
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
  const stages = [
    {
      machineId: product.machineId,
      printHours: num(product.printHours),
      filaments: normalizeFilaments(product),
      labor: stageLabor(product.laborMinutes, undefined, product.laborRate),
    },
    ...normalizeStages(product).map((stage) => ({
      machineId: stage.machineId,
      printHours: num(stage.printHours),
      filaments: normalizeFilaments(stage),
      labor: stageLabor(stage.laborMinutes, stage.laborRate, product.laborRate),
    })),
  ];

  const byMachine = new Map<
    string,
    { printHours: number; filaments: FilamentUsage[]; labor: number }
  >();
  for (const stage of stages) {
    const group = byMachine.get(stage.machineId) ?? {
      printHours: 0,
      filaments: [],
      labor: 0,
    };
    group.printHours += stage.printHours;
    group.filaments.push(...stage.filaments);
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
      filaments: group.filaments.map((f) => resolveFilRow(f, stock)),
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
      filaments: e.filaments,
      // 7e: snapshot do que foi consumido (nome + qtd + preço congelado), no
      // mesmo espírito de `filaments` — a leitura de "o que essa impressão
      // levou". O custo REAL (FIFO) não mora aqui: mora no `frozenCost`.
      ...(e.row.supplies.length > 0 ? { supplies: e.row.supplies } : {}),
      frozenCost: e.cost.total,
      stockMoves: [...e.plan.moves, ...e.supplyPlan.moves],
      ...(meta.notes && meta.notes.trim() ? { notes: meta.notes.trim() } : {}),
      createdAt: meta.createdAt,
    };
    return { id: e.id, payload };
  });
}
