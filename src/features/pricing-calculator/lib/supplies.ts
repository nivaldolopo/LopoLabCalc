import { num } from "@/lib/number";
import { fifoSort, shiftLots, simulateFifo } from "./fifo";
import type {
  ProductionEvent,
  Supply,
  SupplyAdjustment,
  SupplyConsumptionMove,
  SupplyConsumptionResult,
  SupplyLot,
  StockMove,
} from "../types";

// Matemática pura do estoque de INSUMOS (7e). Gêmeo de `lib/stock.ts`: mesmo
// modelo item + LOTES (D2), mesmo FIFO (`lib/fifo.ts`), mesmas regras D3/D4/D6.
// O que muda é só a unidade — contagem em vez de gramas, preço por unidade em
// vez de por kg — e é por isso que o núcleo do FIFO foi extraído em vez de
// copiado: a regra do overdraft tem uma implementação só.
//
// Todas as funções são imutáveis: devolvem um insumo novo, nunca mexem no
// recebido.

// O mínimo para mexer no saldo de um lote. `StockMove` satisfaz (o campo
// `rollId` carrega o id do lote) — é o que permite estornar lendo o doc do
// evento de produção, sem depender do preço.
export type LotDelta = Pick<StockMove, "stockId" | "rollId" | "qty">;

function fifoLots(supply: Supply): SupplyLot[] {
  return fifoSort(supply.lots, (lot) => lot.purchaseDate);
}

// Saldo do insumo: soma dos lotes. Pode ser NEGATIVO (D4).
export function balanceQty(supply: Supply): number {
  return supply.lots.reduce((sum, lot) => sum + num(lot.remainingQty), 0);
}

// O lote EM USO: o mais antigo com saldo. `null` quando todos estão zerados — aí
// a próxima produção já nasce em overdraft (D4).
export function activeLot(supply: Supply): SupplyLot | null {
  return fifoLots(supply).find((lot) => num(lot.remainingQty) > 0) ?? null;
}

// O lote mais NOVO por data de compra (independe de ter saldo: mesmo vazio, ele
// é a última cotação real). Dono do overdraft (D4) e base do preço de catálogo.
export function newestLot(supply: Supply): SupplyLot | null {
  const lots = fifoLots(supply);
  return lots.length > 0 ? lots[lots.length - 1] : null;
}

// D3, lado CATÁLOGO: preço do lote mais novo = custo de REPOR. É o que o
// acessório do produto copia ao ser ligado ao insumo (Fase 2 da 7e). 0 quando o
// insumo não tem lote nenhum.
export function catalogUnitPrice(supply: Supply): number {
  return num(newestLot(supply)?.unitPrice);
}

// Alerta de estoque mínimo. `minQty` 0 = sem alerta.
export function isBelowMin(supply: Supply): boolean {
  return num(supply.minQty) > 0 && balanceQty(supply) < num(supply.minQty);
}

/**
 * Simula consumir `qty` unidades do insumo, FIFO. PURA. Mesma conta usada para
 * avisar na `/producao` e para dar baixa — divergir aqui seria pior que não
 * avisar.
 *
 * D4 (regra em `lib/fifo.ts`): o que faltar não é truncado — vira consumo no
 * lote mais novo, empurrando o saldo para negativo, e sai em `shortfall`.
 */
export function simulateSupplyConsumption(
  supply: Supply,
  qty: number,
): SupplyConsumptionResult {
  const result = simulateFifo(
    fifoLots(supply).map((lot) => ({
      id: lot.id,
      remaining: num(lot.remainingQty),
      unitPrice: num(lot.unitPrice),
    })),
    qty,
  );

  const moves: SupplyConsumptionMove[] = result.moves.map((move) => ({
    stockId: supply.id,
    lotId: move.lotId,
    qty: move.qty,
    unitPrice: move.unitPrice,
    cost: move.qty * move.unitPrice,
  }));

  return {
    moves,
    cost: moves.reduce((sum, move) => sum + move.cost, 0),
    crossesLot: result.crossesLot,
    shortfall: result.shortfall,
  };
}

function shiftSupply(
  supply: Supply,
  moves: LotDelta[],
  sign: 1 | -1,
): Supply {
  const deltaByLot = new Map<string, number>();
  for (const move of moves) {
    // Moves de outros insumos (e todos os de filamento) passam batido: uma
    // produção consome vários docs e cada um aplica só o que é seu.
    if (move.stockId !== supply.id) continue;
    const previous = deltaByLot.get(move.rollId) ?? 0;
    deltaByLot.set(move.rollId, previous + sign * num(move.qty));
  }
  if (deltaByLot.size === 0) return supply;

  return {
    ...supply,
    lots: shiftLots(
      supply.lots,
      deltaByLot,
      (lot) => lot.remainingQty,
      (lot, remainingQty) => ({ ...lot, remainingQty }),
    ),
  };
}

// Aplica a baixa descrita pelos moves (produção registrada).
export function applySupplyConsumption(
  supply: Supply,
  moves: LotDelta[],
): Supply {
  return shiftSupply(supply, moves, -1);
}

// Devolve exatamente o que os moves tiraram (produção excluída/editada), lote a
// lote — inclusive em lote já zerado. Round-trip com `applySupplyConsumption`.
export function reverseSupplyConsumption(
  supply: Supply,
  moves: LotDelta[],
): Supply {
  return shiftSupply(supply, moves, 1);
}

/**
 * D6 para insumo — ajuste de inventário COM RASTRO. Contou os ímãs na gaveta e o
 * saldo diverge? É por aqui, nunca editando `remainingQty` na mão.
 *
 * Lote inexistente é ERRO, não no-op: engolir uma contagem em silêncio é
 * exatamente o furo que o D6 quer evitar.
 */
export function adjustLot(
  supply: Supply,
  lotId: string,
  counted: number,
  reason: string,
  at: number,
): Supply {
  const lot = supply.lots.find((item) => item.id === lotId);
  if (!lot) {
    throw new Error(
      `Ajuste de inventário: lote ${lotId} não existe no insumo ${supply.id}.`,
    );
  }

  const before = num(lot.remainingQty);
  const after = num(counted);
  const adjustment: SupplyAdjustment = {
    id: crypto.randomUUID(),
    at: num(at),
    lotId,
    before,
    after,
    reason,
  };

  return {
    ...supply,
    lots: supply.lots.map((item) =>
      item.id === lotId ? { ...item, remainingQty: after } : item,
    ),
    adjustments: [...supply.adjustments, adjustment],
  };
}

// Posição FIFO de cada lote (1 = o mais antigo, o primeiro a ser consumido).
export function lotNumbers(supply: Supply): Map<string, number> {
  const numbers = new Map<string, number>();
  fifoLots(supply).forEach((lot, index) => numbers.set(lot.id, index + 1));
  return numbers;
}

// Uma linha do extrato do insumo. `delta` é sempre o efeito no saldo, com sinal.
export type SupplyStatementEntry =
  | {
      kind: "purchase";
      id: string;
      at: number;
      lotId: string;
      delta: number;
      unitPrice: number;
      note?: string;
    }
  | {
      kind: "adjustment";
      id: string;
      at: number;
      lotId: string;
      delta: number;
      before: number;
      after: number;
      reason: string;
    }
  | {
      kind: "consumption";
      id: string;
      at: number;
      lotId: string;
      delta: number;
      eventId: string;
      productName: string;
      outcome: ProductionEvent["outcome"];
    };

/**
 * Extrato do insumo, em ordem cronológica — mesmo D6.1 do filamento: as 3 fontes
 * já existem e o extrato se MONTA aqui, sem duplicar nada dentro do doc. O
 * consumo mora no `stockMoves` do evento de produção, filtrado por
 * `kind === "supply"` (o mesmo array carrega os moves de filamento).
 */
export function supplyStatement(
  supply: Supply,
  production: ProductionEvent[] = [],
): SupplyStatementEntry[] {
  // BUG-03: `at` guarda só o DIA → o desempate é o `createdAt` cheio do evento.
  const seq = new Map<string, number>();
  const consumption: SupplyStatementEntry[] = [];
  for (const event of production) {
    for (const move of event.stockMoves) {
      if (move.kind !== "supply" || move.stockId !== supply.id) continue;
      const id = `move_${event.id}_${move.rollId}`;
      seq.set(id, num(event.createdAt) || num(event.at));
      consumption.push({
        kind: "consumption",
        id,
        at: num(event.at),
        lotId: move.rollId,
        delta: -num(move.qty),
        eventId: event.id,
        productName: event.productName ?? "",
        outcome: event.outcome,
      });
    }
  }

  const entries: SupplyStatementEntry[] = [
    ...supply.lots.map(
      (lot): SupplyStatementEntry => ({
        kind: "purchase",
        id: `lot_${lot.id}`,
        at: num(lot.purchaseDate),
        lotId: lot.id,
        delta: num(lot.initialQty),
        unitPrice: num(lot.unitPrice),
        ...(lot.note ? { note: lot.note } : {}),
      }),
    ),
    ...supply.adjustments.map(
      (adjustment): SupplyStatementEntry => ({
        kind: "adjustment",
        id: `adj_${adjustment.id}`,
        at: num(adjustment.at),
        lotId: adjustment.lotId,
        delta: num(adjustment.after) - num(adjustment.before),
        before: num(adjustment.before),
        after: num(adjustment.after),
        reason: adjustment.reason,
      }),
    ),
    ...consumption,
  ];
  const seqOf = (entry: SupplyStatementEntry) => seq.get(entry.id) ?? entry.at;
  return entries.sort((a, b) => a.at - b.at || seqOf(a) - seqOf(b));
}

// Fontes que podem apontar para um insumo. Estrutural de propósito: o que
// importa é ter `accessories`, não ser um `SavedProduct`.
type AccessoryHolder = {
  name?: string;
  accessories?: { supplyId?: string | null }[] | null;
};

/**
 * Quem ainda aponta para este insumo. É o guarda do EXCLUIR, igual ao do
 * filamento: arquivar é a ação normal; excluir só é liberado quando nenhum
 * produto referencia mais (apagar deixaria o `supplyId` órfão, e o acessório
 * cairia silenciosamente no modo avulso).
 */
export function supplyReferences(
  supplyId: string,
  products: AccessoryHolder[],
): { productNames: string[] } {
  return {
    productNames: products
      .filter((product) =>
        (product.accessories ?? []).some(
          (accessory) => accessory.supplyId === supplyId,
        ),
      )
      .map((product) => (product.name ?? "").trim() || "(sem nome)"),
  };
}
