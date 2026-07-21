import { num } from "@/lib/number";
import {
  applyConsumption,
  reverseConsumption,
  simulateConsumption,
} from "./stock";
import {
  applySupplyConsumption,
  reverseSupplyConsumption,
  simulateSupplyConsumption,
} from "./supplies";
import { filamentTotalG } from "./filaments";
import type {
  FilamentUsage,
  FrozenCostBreakdown,
  Machine,
  ProductionMode,
  StockFilament,
  StockMove,
  Supply,
  SupplyUsage,
} from "../types";

// Matemática pura da baixa da PRODUÇÃO (FEAT-04a). É a primitiva de baixa: a
// mesma conta FIFO do estoque (`lib/stock.ts`), aqui orquestrada por evento —
// um evento consome N cores (multicolor). Reusa `simulateConsumption` (o custo
// misto e os avisos D5) e `applyConsumption`/`reverseConsumption` (o saldo dos
// rolos), então a baixa da produção e a baixa da venda (passo 8) nunca divergem.
//
// Puro por construção: descreve o que gravar (evento + rolos novos), sem tocar
// no Firestore. Quem persiste é o `productionRepository`, num único `writeBatch`.

// O que a produção precisa gravar para dar baixa de forma atômica e estornável.
export type ProductionPlan = {
  // `stockMoves` do evento: o que saiu de cada rolo, com `itemId` = id do evento.
  // É de onde o estorno (04c) lê. Vazio no modo historico (nada foi deduzido).
  moves: StockMove[];
  // As cores AFETADAS, já com os rolos decrementados (imutável — cores novas).
  // O repositório grava só o campo `rolls` delas. Só entra a cor que mudou.
  colorUpdates: StockFilament[];
  // Custo REAL de material da impressão (Σ FIFO das cores + fallback dos avulsos).
  // É a parcela de material do `frozenCost`; 04b soma energia/depreciação/etc.
  materialCost: number;
  // D5 informativo: alguma cor atravessou o rolo em uso para o próximo.
  crossesRoll: boolean;
  // D5 forte / negativo do D4: gramas que passaram do estoque total (Σ das cores).
  shortfallG: number;
};

// Custo de material pelo preço congelado no snapshot (sem tocar rolo). Usado no
// modo historico e para toda cor avulsa/órfã do modo real — o mesmo fallback D3
// do resto do app.
function fallbackCost(filaments: FilamentUsage[]): number {
  return filaments.reduce(
    (sum, f) => sum + (filamentTotalG(f) / 1000) * num(f.pricePerKg),
    0,
  );
}

/**
 * Planeja a baixa de UM evento de produção. PURA: devolve o que gravar, não
 * grava.
 *
 * Modo `historico` (backfill): gramas soltas, NÃO toca rolo — sem moves, sem
 * `colorUpdates`; o custo sai do `pricePerKg` congelado. É o caminho para o dono
 * lançar o histórico das máquinas sem recadastrar rolo velho.
 *
 * Modo `real`: cada cor com `filamentId` que existe no Estoque é consumida via
 * FIFO (custo misto e avisos D5 vêm de `simulateConsumption`); avulso (sem
 * `filamentId`) ou cor removida do Estoque caem no fallback do preço congelado,
 * SEM move (não há rolo para deduzir). Duas cores iguais no mesmo evento
 * consomem em sequência do saldo já decrementado.
 */
export function planProduction(
  filaments: FilamentUsage[],
  colors: StockFilament[],
  eventId: string,
  mode: ProductionMode,
): ProductionPlan {
  if (mode === "historico") {
    return {
      moves: [],
      colorUpdates: [],
      materialCost: fallbackCost(filaments),
      crossesRoll: false,
      shortfallG: 0,
    };
  }

  const byId = new Map(colors.map((color) => [color.id, color]));
  // Estado corrente das cores afetadas: começa vazio e acumula a cada consumo,
  // para que duas entradas da mesma cor deduzam uma do saldo já mexido pela outra.
  const updates = new Map<string, StockFilament>();
  const moves: StockMove[] = [];
  let materialCost = 0;
  let crossesRoll = false;
  let shortfallG = 0;

  for (const filament of filaments) {
    const grams = filamentTotalG(filament);
    if (grams <= 0) continue;

    const color = filament.filamentId
      ? updates.get(filament.filamentId) ?? byId.get(filament.filamentId)
      : undefined;

    if (!color) {
      // Avulso ou cor órfã (removida do Estoque): fallback D3, sem baixa de rolo.
      materialCost += (grams / 1000) * num(filament.pricePerKg);
      continue;
    }

    const sim = simulateConsumption(color, grams);
    materialCost += sim.cost;
    crossesRoll = crossesRoll || sim.crossesRoll;
    shortfallG += sim.shortfallG;
    for (const move of sim.moves) {
      moves.push({
        itemId: eventId,
        kind: "filament",
        stockId: move.stockId,
        rollId: move.rollId,
        qty: move.qty,
      });
    }
    updates.set(color.id, applyConsumption(color, sim.moves));
  }

  return {
    moves,
    colorUpdates: Array.from(updates.values()),
    materialCost,
    crossesRoll,
    shortfallG,
  };
}

// 7e: o mesmo que o `ProductionPlan`, para os INSUMOS. Separado do plano de
// filamento porque são coleções diferentes (`estoque` × `insumos`) e o batch
// grava campos diferentes (`rolls` × `lots`) — juntar os dois num tipo só
// obrigaria a desempacotar por `kind` em toda escrita.
export type SupplyPlan = {
  moves: StockMove[]; // kind: "supply"
  supplyUpdates: Supply[]; // insumos afetados, já decrementados (imutável)
  cost: number; // custo REAL dos insumos (Σ FIFO + fallback dos avulsos)
  crossesLot: boolean;
  shortfall: number; // unidades que passaram do saldo (D4/D5)
};

export const EMPTY_SUPPLY_PLAN: SupplyPlan = {
  moves: [],
  supplyUpdates: [],
  cost: 0,
  crossesLot: false,
  shortfall: 0,
};

/**
 * Planeja a baixa de INSUMOS de UM evento (7e). PURA, gêmea de `planProduction`.
 *
 * Modo `historico`: não toca lote — o custo sai do `unitPrice` congelado.
 * Modo `real`: insumo ligado (`supplyId`) e existente é consumido via FIFO;
 * acessório AVULSO (sem `supplyId`) ou insumo removido do estoque cai no
 * fallback do preço congelado, SEM move — exatamente o caminho que a cor avulsa
 * já seguia. Dois usos do mesmo insumo no evento consomem em sequência.
 */
export function planSupplies(
  usages: SupplyUsage[],
  supplies: Supply[],
  eventId: string,
  mode: ProductionMode,
): SupplyPlan {
  if (usages.length === 0) return EMPTY_SUPPLY_PLAN;

  if (mode === "historico") {
    return {
      ...EMPTY_SUPPLY_PLAN,
      cost: usages.reduce(
        (sum, usage) => sum + num(usage.qty) * num(usage.unitPrice),
        0,
      ),
    };
  }

  const byId = new Map(supplies.map((supply) => [supply.id, supply]));
  const updates = new Map<string, Supply>();
  const moves: StockMove[] = [];
  let cost = 0;
  let crossesLot = false;
  let shortfall = 0;

  for (const usage of usages) {
    const qty = num(usage.qty);
    if (qty <= 0) continue;

    const supply = usage.supplyId
      ? updates.get(usage.supplyId) ?? byId.get(usage.supplyId)
      : undefined;

    if (!supply) {
      // Avulso ou insumo órfão (removido do Estoque): custo sim, baixa não.
      cost += qty * num(usage.unitPrice);
      continue;
    }

    const sim = simulateSupplyConsumption(supply, qty);
    cost += sim.cost;
    crossesLot = crossesLot || sim.crossesLot;
    shortfall += sim.shortfall;
    // O `lotId` da simulação vira o campo `rollId` do move — é o mesmo lugar
    // (ver `StockMove`), e é dele que o estorno lê.
    const made: StockMove[] = sim.moves.map((move) => ({
      itemId: eventId,
      kind: "supply",
      stockId: move.stockId,
      rollId: move.lotId,
      qty: move.qty,
    }));
    moves.push(...made);
    updates.set(supply.id, applySupplyConsumption(supply, made));
  }

  return {
    moves,
    supplyUpdates: Array.from(updates.values()),
    cost,
    crossesLot,
    shortfall,
  };
}

/**
 * Estorno de um evento (excluir/editar, 04c). Devolve ao estoque exatamente o que
 * os `stockMoves` do evento tiraram, rolo a rolo — round-trip de `planProduction`.
 * Devolve só as cores afetadas (com os rolos restaurados); as demais passam
 * batido. Evento em modo historico tem `stockMoves` vazio → nada a estornar.
 *
 * Filtra por `kind`: desde a 7e o mesmo array carrega moves de insumo, e um doc
 * de insumo nunca pode ser confundido com uma cor.
 */
export function reverseProduction(
  stockMoves: StockMove[],
  colors: StockFilament[],
): StockFilament[] {
  const filamentMoves = stockMoves.filter((move) => move.kind !== "supply");
  const affected = new Set(filamentMoves.map((move) => move.stockId));
  return colors
    .filter((color) => affected.has(color.id))
    .map((color) => reverseConsumption(color, filamentMoves));
}

// Espelho do `reverseProduction` para os insumos (7e).
export function reverseSupplies(
  stockMoves: StockMove[],
  supplies: Supply[],
): Supply[] {
  const supplyMoves = stockMoves.filter((move) => move.kind === "supply");
  const affected = new Set(supplyMoves.map((move) => move.stockId));
  return supplies
    .filter((supply) => affected.has(supply.id))
    .map((supply) => reverseSupplyConsumption(supply, supplyMoves));
}

// Custo de produção CONGELADO de um evento (04b). Spec: material (FIFO) +
// energia + depreciação + manutenção + labor + INSUMOS — NÃO inclui reserva de
// falha nem custo fixo (essas seguem sendo provisões de pricing, não custo
// físico). A aritmética espelha `calculateStageCost` (energia/depreciação/
// manutenção saem da máquina × horas); `material`, `labor` e `supplies` chegam
// prontos (material/supplies = FIFO real ou fallback congelado, vindos de
// `planProduction`/`planSupplies`; labor = o congelado da etapa).
//
// 7e — os acessórios ENTRARAM aqui. Até então ficavam de fora com o mesmo
// argumento das provisões, mas o ímã não é provisão: ele sai da gaveta e é
// cobrado do cliente (`calculatePricing`). Fora do custo congelado, o lucro por
// peça do histórico saía superestimado — este era o buraco de COGS do 7e.
//
// FEAT-06 — a decomposição deixou de ser descartada no save. O tipo agora deriva
// de `FrozenCostBreakdown` (types.ts) para que os 6 componentes tenham UMA
// definição só: o que roda aqui é o mesmo objeto que é congelado no evento e na
// camada do acabado, com o `total` a mais.
export type ProductionCostBreakdown = FrozenCostBreakdown & { total: number };

export function productionCost(
  machine: Machine,
  printHours: number,
  energyTariff: number,
  materialCost: number,
  laborCost: number,
  suppliesCost = 0,
): ProductionCostBreakdown {
  const hours = Math.max(0, num(printHours));
  const material = Math.max(0, num(materialCost));
  const labor = Math.max(0, num(laborCost));
  const supplies = Math.max(0, num(suppliesCost));
  const energy = hours * (num(machine.watts) / 1000) * num(energyTariff);
  const depreciation =
    machine.lifeHours > 0
      ? (num(machine.price) / machine.lifeHours) * hours
      : 0;
  const maintenance = hours * num(machine.maintenancePerHour);
  return {
    material,
    energy,
    depreciation,
    maintenance,
    labor,
    supplies,
    total: material + energy + depreciation + maintenance + labor + supplies,
  };
}

// --- Álgebra do custo congelado (FEAT-06) -----------------------------------
//
// O breakdown viaja por três escalas diferentes — evento (placa), camada de
// acabado (unidade) e venda (unidade × quantidade) — e em cada travessia alguém
// precisa somar ou escalar os 6 componentes. Centralizar aqui evita cópias do
// mesmo spread espalhadas por `productionPlan`, `finishedGoods` e
// `saleReconciliation`, e mantém UMA regra: escalar é sempre um fator escalar
// único aplicado a todos os campos, para que `sumFrozen` continue batendo com o
// total que foi escalado pelo MESMO fator.

export const ZERO_FROZEN: FrozenCostBreakdown = {
  material: 0,
  energy: 0,
  depreciation: 0,
  maintenance: 0,
  labor: 0,
  supplies: 0,
};

// Descarta o `total` — a persistência guarda só os componentes.
export function frozenOf(cost: ProductionCostBreakdown): FrozenCostBreakdown {
  return {
    material: cost.material,
    energy: cost.energy,
    depreciation: cost.depreciation,
    maintenance: cost.maintenance,
    labor: cost.labor,
    supplies: cost.supplies,
  };
}

export function sumFrozen(breakdown: FrozenCostBreakdown): number {
  return (
    breakdown.material +
    breakdown.energy +
    breakdown.depreciation +
    breakdown.maintenance +
    breakdown.labor +
    breakdown.supplies
  );
}

export function addFrozen(
  a: FrozenCostBreakdown,
  b: FrozenCostBreakdown,
): FrozenCostBreakdown {
  return {
    material: a.material + b.material,
    energy: a.energy + b.energy,
    depreciation: a.depreciation + b.depreciation,
    maintenance: a.maintenance + b.maintenance,
    labor: a.labor + b.labor,
    supplies: a.supplies + b.supplies,
  };
}

// `factor` pode ser negativo (estorno) — não clampar: um saldo negativo de
// acabados (overdraft D4) precisa refletir o buraco, igual `skuValue` já faz.
export function scaleFrozen(
  breakdown: FrozenCostBreakdown,
  factor: number,
): FrozenCostBreakdown {
  const f = num(factor);
  return {
    material: breakdown.material * f,
    energy: breakdown.energy * f,
    depreciation: breakdown.depreciation * f,
    maintenance: breakdown.maintenance * f,
    labor: breakdown.labor * f,
    supplies: breakdown.supplies * f,
  };
}
