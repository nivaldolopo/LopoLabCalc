import { describe, expect, it } from "vitest";
import {
  activeLot,
  adjustLot,
  applySupplyConsumption,
  balanceQty,
  catalogUnitPrice,
  isBelowMin,
  lotNumbers,
  newestLot,
  reverseSupplyConsumption,
  simulateSupplyConsumption,
  supplyReferences,
  supplyStatement,
} from "./supplies";
import type { ProductionEvent, StockMove, Supply, SupplyLot } from "../types";

const DIA = 24 * 60 * 60 * 1000;
const HORA = 60 * 60 * 1000;

function makeLot(over: Partial<SupplyLot> & { id: string }): SupplyLot {
  return {
    purchaseDate: 0,
    initialQty: 100,
    remainingQty: 100,
    unitPrice: 0.5,
    ...over,
  };
}

function makeSupply(lots: SupplyLot[], minQty = 0): Supply {
  return {
    id: "ima-6x2",
    name: "Ímã 6×2mm",
    unit: "un",
    minQty,
    archived: false,
    lots,
    adjustments: [],
    createdAt: 0,
  };
}

function prod(
  over: Partial<ProductionEvent> & { stockMoves: StockMove[] },
): ProductionEvent {
  return {
    id: "e1",
    at: 0,
    outcome: "estoque",
    mode: "real",
    productName: "Chaveiro",
    machineId: "a1",
    machineName: "A1",
    printHours: 2,
    filaments: [],
    frozenCost: 0,
    createdAt: 0,
    ...over,
  };
}

// Cenário base do D3: um lote velho quase no fim (R$0,50) e um novo (R$0,80).
function doisLotes(): Supply {
  return makeSupply([
    makeLot({ id: "velho", purchaseDate: DIA, remainingQty: 10, unitPrice: 0.5 }),
    makeLot({ id: "novo", purchaseDate: 2 * DIA, remainingQty: 20, unitPrice: 0.8 }),
  ]);
}

describe("saldo e lotes", () => {
  it("balanceQty soma os lotes (e aceita negativo — D4)", () => {
    expect(balanceQty(doisLotes())).toBe(30);
    expect(balanceQty(makeSupply([makeLot({ id: "a", remainingQty: -5 })]))).toBe(-5);
  });

  it("activeLot é o mais antigo COM saldo; null quando todos zerados", () => {
    expect(activeLot(doisLotes())?.id).toBe("velho");
    const zerado = makeSupply([makeLot({ id: "a", remainingQty: 0 })]);
    expect(activeLot(zerado)).toBeNull();
  });

  it("newestLot é o mais novo por data, mesmo sem saldo", () => {
    const supply = makeSupply([
      makeLot({ id: "velho", purchaseDate: DIA, remainingQty: 10 }),
      makeLot({ id: "novo", purchaseDate: 2 * DIA, remainingQty: 0 }),
    ]);
    expect(newestLot(supply)?.id).toBe("novo");
  });

  it("catalogUnitPrice é o preço do lote mais novo (custo de repor)", () => {
    expect(catalogUnitPrice(doisLotes())).toBe(0.8);
    expect(catalogUnitPrice(makeSupply([]))).toBe(0);
  });

  it("isBelowMin só alerta com mínimo configurado", () => {
    expect(isBelowMin(makeSupply([makeLot({ id: "a", remainingQty: 5 })], 10))).toBe(true);
    expect(isBelowMin(makeSupply([makeLot({ id: "a", remainingQty: 50 })], 10))).toBe(false);
    expect(isBelowMin(makeSupply([makeLot({ id: "a", remainingQty: 5 })], 0))).toBe(false);
  });

  it("lotNumbers numera em ordem FIFO", () => {
    const numbers = lotNumbers(doisLotes());
    expect(numbers.get("velho")).toBe(1);
    expect(numbers.get("novo")).toBe(2);
  });
});

describe("simulateSupplyConsumption", () => {
  it("consome do lote mais antigo e cobra o preço DELE", () => {
    const result = simulateSupplyConsumption(doisLotes(), 4);
    expect(result.moves).toEqual([
      { stockId: "ima-6x2", lotId: "velho", qty: 4, unitPrice: 0.5, cost: 2 },
    ]);
    expect(result.cost).toBe(2);
    expect(result.crossesLot).toBe(false);
    expect(result.shortfall).toBe(0);
  });

  it("atravessando lotes, o custo é MISTO e exato", () => {
    // 10 × 0,50 + 5 × 0,80 = 9,00
    const result = simulateSupplyConsumption(doisLotes(), 15);
    expect(result.cost).toBeCloseTo(9, 10);
    expect(result.crossesLot).toBe(true);
    expect(result.moves.map((move) => move.lotId)).toEqual(["velho", "novo"]);
  });

  it("D4: o excedente empurra o lote mais novo a negativo e reporta shortfall", () => {
    const result = simulateSupplyConsumption(doisLotes(), 50);
    expect(result.shortfall).toBe(20);
    // 10 do velho + 40 do novo (20 de saldo + 20 de overdraft), tudo ao preço do novo.
    expect(result.moves[1]).toEqual({
      stockId: "ima-6x2",
      lotId: "novo",
      qty: 40,
      unitPrice: 0.8,
      cost: 32,
    });
  });

  it("insumo sem lote nenhum: nenhum move, só o shortfall", () => {
    const result = simulateSupplyConsumption(makeSupply([]), 10);
    expect(result.moves).toEqual([]);
    expect(result.cost).toBe(0);
    expect(result.shortfall).toBe(10);
  });

  it("é pura: não mexe no insumo recebido", () => {
    const supply = doisLotes();
    simulateSupplyConsumption(supply, 15);
    expect(supply.lots.map((lot) => lot.remainingQty)).toEqual([10, 20]);
  });
});

describe("applySupplyConsumption / reverseSupplyConsumption", () => {
  const moves = (qty: number, lotId: string): StockMove[] => [
    { itemId: "e1", kind: "supply", stockId: "ima-6x2", rollId: lotId, qty },
  ];

  it("aplica a baixa nos lotes citados", () => {
    const after = applySupplyConsumption(doisLotes(), moves(4, "velho"));
    expect(after.lots[0].remainingQty).toBe(6);
    expect(after.lots[1].remainingQty).toBe(20);
  });

  it("round-trip: baixa + estorno volta ao saldo original", () => {
    const original = doisLotes();
    const sim = simulateSupplyConsumption(original, 15);
    const applied = applySupplyConsumption(
      original,
      sim.moves.map((move) => ({
        itemId: "e1",
        kind: "supply" as const,
        stockId: move.stockId,
        rollId: move.lotId,
        qty: move.qty,
      })),
    );
    const reversed = reverseSupplyConsumption(
      applied,
      sim.moves.map((move) => ({
        itemId: "e1",
        kind: "supply" as const,
        stockId: move.stockId,
        rollId: move.lotId,
        qty: move.qty,
      })),
    );
    expect(reversed.lots.map((lot) => lot.remainingQty)).toEqual([10, 20]);
  });

  it("ignora moves de outro insumo (ou de filamento)", () => {
    const supply = doisLotes();
    const alheios: StockMove[] = [
      { itemId: "e1", kind: "supply", stockId: "outro-insumo", rollId: "velho", qty: 5 },
      { itemId: "e1", kind: "filament", stockId: "cor-preto", rollId: "velho", qty: 50 },
    ];
    expect(applySupplyConsumption(supply, alheios)).toBe(supply);
  });
});

describe("adjustLot", () => {
  it("grava o rastro e corrige o saldo", () => {
    const after = adjustLot(doisLotes(), "velho", 7, "contagem", 5 * DIA);
    expect(after.lots[0].remainingQty).toBe(7);
    expect(after.adjustments).toHaveLength(1);
    expect(after.adjustments[0]).toMatchObject({
      lotId: "velho",
      before: 10,
      after: 7,
      reason: "contagem",
      at: 5 * DIA,
    });
  });

  it("é o remédio do D4: corrige saldo negativo guardando o furo", () => {
    const furado = makeSupply([makeLot({ id: "a", remainingQty: -12 })]);
    const after = adjustLot(furado, "a", 30, "comprei e não lancei", DIA);
    expect(after.lots[0].remainingQty).toBe(30);
    expect(after.adjustments[0].before).toBe(-12);
  });

  it("lote inexistente é ERRO, não no-op", () => {
    expect(() => adjustLot(doisLotes(), "fantasma", 5, "x", 0)).toThrow(/fantasma/);
  });
});

describe("supplyStatement", () => {
  it("junta compra, ajuste e consumo em ordem cronológica", () => {
    const supply = adjustLot(doisLotes(), "velho", 8, "contagem", 3 * DIA);
    const events = [
      prod({
        id: "ev",
        at: 4 * DIA,
        createdAt: 4 * DIA + HORA,
        stockMoves: [
          { itemId: "ev", kind: "supply", stockId: "ima-6x2", rollId: "velho", qty: 2 },
        ],
      }),
    ];

    const entries = supplyStatement(supply, events);
    expect(entries.map((entry) => entry.kind)).toEqual([
      "purchase",
      "purchase",
      "adjustment",
      "consumption",
    ]);
    expect(entries[2].delta).toBe(-2); // ajuste: 10 → 8
    expect(entries[3].delta).toBe(-2); // consumo
  });

  it("ignora os moves de filamento do mesmo evento", () => {
    const events = [
      prod({
        stockMoves: [
          { itemId: "e1", kind: "filament", stockId: "cor-preto", rollId: "r1", qty: 50 },
          { itemId: "e1", kind: "supply", stockId: "outro", rollId: "l1", qty: 3 },
        ],
      }),
    ];
    const entries = supplyStatement(doisLotes(), events);
    expect(entries.every((entry) => entry.kind === "purchase")).toBe(true);
  });

  it("sem produção, mostra só compra e ajuste", () => {
    expect(supplyStatement(doisLotes())).toHaveLength(2);
  });
});

describe("supplyReferences", () => {
  it("lista os produtos que apontam para o insumo (guarda do excluir)", () => {
    const products = [
      { name: "Chaveiro", accessories: [{ supplyId: "ima-6x2" }] },
      { name: "Vaso", accessories: [{ supplyId: "outro" }] },
      { name: "Sem acessório", accessories: [] },
      { name: "Avulso", accessories: [{ supplyId: null }] },
    ];
    expect(supplyReferences("ima-6x2", products).productNames).toEqual(["Chaveiro"]);
  });
});
