import { num } from "@/lib/number";
import {
  applyConsumption,
  reverseConsumption,
  simulateConsumption,
} from "./stock";
import { filamentTotalG } from "./filaments";
import type {
  FilamentUsage,
  ProductionMode,
  StockFilament,
  StockMove,
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

/**
 * Estorno de um evento (excluir/editar, 04c). Devolve ao estoque exatamente o que
 * os `stockMoves` do evento tiraram, rolo a rolo — round-trip de `planProduction`.
 * Devolve só as cores afetadas (com os rolos restaurados); as demais passam
 * batido. Evento em modo historico tem `stockMoves` vazio → nada a estornar.
 */
export function reverseProduction(
  stockMoves: StockMove[],
  colors: StockFilament[],
): StockFilament[] {
  const affected = new Set(stockMoves.map((move) => move.stockId));
  return colors
    .filter((color) => affected.has(color.id))
    .map((color) => reverseConsumption(color, stockMoves));
}
