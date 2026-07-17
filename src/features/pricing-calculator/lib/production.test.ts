import { describe, expect, it } from "vitest";
import { planProduction, reverseProduction } from "./production";
import { balanceG } from "./stock";
import type { FilamentRoll, FilamentUsage, StockFilament } from "../types";

const DIA = 24 * 60 * 60 * 1000;

function makeRoll(over: Partial<FilamentRoll> & { id: string }): FilamentRoll {
  return {
    purchaseDate: 0,
    initialG: 1000,
    remainingG: 1000,
    pricePerKg: 90,
    ...over,
  };
}

function makeColor(
  over: Partial<StockFilament> & { id: string; rolls: FilamentRoll[] },
): StockFilament {
  return {
    material: "PLA Basic",
    brand: "Bambu",
    colorName: "Cor",
    minG: 0,
    archived: false,
    adjustments: [],
    createdAt: 0,
    ...over,
  };
}

function usage(over: Partial<FilamentUsage>): FilamentUsage {
  return {
    filamentId: null,
    colorName: "",
    pricePerKg: 0,
    totalG: 0,
    ...over,
  };
}

describe("planProduction — modo real", () => {
  it("consome FIFO de uma cor e devolve moves + cor decrementada", () => {
    const cor = makeColor({
      id: "preto",
      rolls: [makeRoll({ id: "r1", remainingG: 1000, pricePerKg: 90 })],
    });

    const plan = planProduction(
      [usage({ filamentId: "preto", totalG: 200 })],
      [cor],
      "evt-1",
      "real",
    );

    expect(plan.moves).toEqual([
      { itemId: "evt-1", kind: "filament", stockId: "preto", rollId: "r1", qty: 200 },
    ]);
    expect(plan.materialCost).toBeCloseTo((200 / 1000) * 90);
    expect(plan.crossesRoll).toBe(false);
    expect(plan.shortfallG).toBe(0);
    expect(plan.colorUpdates).toHaveLength(1);
    expect(balanceG(plan.colorUpdates[0])).toBe(800);
    // Puro: a cor original não é mutada.
    expect(balanceG(cor)).toBe(1000);
  });

  it("custo misto ao atravessar rolos (crossesRoll)", () => {
    const cor = makeColor({
      id: "preto",
      rolls: [
        makeRoll({ id: "velho", purchaseDate: DIA, remainingG: 100, pricePerKg: 90 }),
        makeRoll({ id: "novo", purchaseDate: 2 * DIA, remainingG: 200, pricePerKg: 110 }),
      ],
    });

    const plan = planProduction(
      [usage({ filamentId: "preto", totalG: 150 })],
      [cor],
      "evt",
      "real",
    );

    expect(plan.moves.map((m) => ({ rollId: m.rollId, qty: m.qty }))).toEqual([
      { rollId: "velho", qty: 100 },
      { rollId: "novo", qty: 50 },
    ]);
    expect(plan.materialCost).toBeCloseTo((100 / 1000) * 90 + (50 / 1000) * 110);
    expect(plan.crossesRoll).toBe(true);
    expect(plan.shortfallG).toBe(0);
  });

  it("overdraft: passa do estoque total → shortfallG e saldo negativo (D4)", () => {
    const cor = makeColor({
      id: "preto",
      rolls: [makeRoll({ id: "r1", remainingG: 100, pricePerKg: 90 })],
    });

    const plan = planProduction(
      [usage({ filamentId: "preto", totalG: 250 })],
      [cor],
      "evt",
      "real",
    );

    expect(plan.shortfallG).toBe(150);
    // O excedente vira consumo no rolo mais novo (único aqui) → saldo negativo.
    expect(balanceG(plan.colorUpdates[0])).toBe(-150);
    const move = plan.moves.find((m) => m.rollId === "r1");
    expect(move?.qty).toBe(250);
  });

  it("multicolor: uma baixa por cor, cada uma no seu rolo", () => {
    const preto = makeColor({
      id: "preto",
      rolls: [makeRoll({ id: "p1", remainingG: 1000 })],
    });
    const branco = makeColor({
      id: "branco",
      rolls: [makeRoll({ id: "b1", remainingG: 1000 })],
    });

    const plan = planProduction(
      [
        usage({ filamentId: "preto", totalG: 120 }),
        usage({ filamentId: "branco", totalG: 80 }),
      ],
      [preto, branco],
      "evt",
      "real",
    );

    expect(plan.moves).toHaveLength(2);
    expect(plan.colorUpdates).toHaveLength(2);
    const saldos = Object.fromEntries(
      plan.colorUpdates.map((c) => [c.id, balanceG(c)]),
    );
    expect(saldos).toEqual({ preto: 880, branco: 920 });
  });

  it("duas entradas da mesma cor consomem em sequência do mesmo saldo", () => {
    const cor = makeColor({
      id: "preto",
      rolls: [makeRoll({ id: "r1", remainingG: 1000 })],
    });

    const plan = planProduction(
      [
        usage({ filamentId: "preto", totalG: 300 }),
        usage({ filamentId: "preto", totalG: 200 }),
      ],
      [cor],
      "evt",
      "real",
    );

    expect(plan.colorUpdates).toHaveLength(1);
    expect(balanceG(plan.colorUpdates[0])).toBe(500);
    expect(plan.moves.reduce((s, m) => s + m.qty, 0)).toBe(500);
  });

  it("avulso (sem filamentId) usa fallback e NÃO gera move nem toca rolo", () => {
    const cor = makeColor({
      id: "preto",
      rolls: [makeRoll({ id: "r1", remainingG: 1000 })],
    });

    const plan = planProduction(
      [usage({ filamentId: null, totalG: 100, pricePerKg: 120 })],
      [cor],
      "evt",
      "real",
    );

    expect(plan.moves).toEqual([]);
    expect(plan.colorUpdates).toEqual([]);
    expect(plan.materialCost).toBeCloseTo((100 / 1000) * 120);
  });

  it("cor órfã (filamentId sem cor no Estoque) cai no fallback, sem move", () => {
    const plan = planProduction(
      [usage({ filamentId: "sumida", totalG: 100, pricePerKg: 100 })],
      [],
      "evt",
      "real",
    );

    expect(plan.moves).toEqual([]);
    expect(plan.materialCost).toBeCloseTo(10);
  });
});

describe("planProduction — modo historico", () => {
  it("gramas soltas: custo pelo preço congelado, sem move e sem tocar rolo", () => {
    const cor = makeColor({
      id: "preto",
      rolls: [makeRoll({ id: "r1", remainingG: 1000, pricePerKg: 90 })],
    });

    const plan = planProduction(
      [usage({ filamentId: "preto", totalG: 200, pricePerKg: 80 })],
      [cor],
      "evt",
      "historico",
    );

    expect(plan.moves).toEqual([]);
    expect(plan.colorUpdates).toEqual([]);
    // Usa o pricePerKg do snapshot (80), NÃO o do rolo (90).
    expect(plan.materialCost).toBeCloseTo((200 / 1000) * 80);
    expect(balanceG(cor)).toBe(1000);
  });
});

describe("reverseProduction", () => {
  it("round-trip: estornar devolve exatamente o que a baixa tirou", () => {
    const cor = makeColor({
      id: "preto",
      rolls: [
        makeRoll({ id: "velho", purchaseDate: DIA, remainingG: 100, pricePerKg: 90 }),
        makeRoll({ id: "novo", purchaseDate: 2 * DIA, remainingG: 200, pricePerKg: 110 }),
      ],
    });

    const plan = planProduction(
      [usage({ filamentId: "preto", totalG: 150 })],
      [cor],
      "evt",
      "real",
    );
    const depois = plan.colorUpdates[0];
    expect(balanceG(depois)).toBe(150);

    const [restaurada] = reverseProduction(plan.moves, [depois]);
    expect(balanceG(restaurada)).toBe(300);
    expect(restaurada.rolls.map((r) => r.remainingG)).toEqual([100, 200]);
  });

  it("só devolve as cores afetadas; as demais passam batido", () => {
    const preto = makeColor({
      id: "preto",
      rolls: [makeRoll({ id: "p1", remainingG: 900 })],
    });
    const branco = makeColor({
      id: "branco",
      rolls: [makeRoll({ id: "b1", remainingG: 1000 })],
    });

    const moves = [
      { itemId: "evt", kind: "filament" as const, stockId: "preto", rollId: "p1", qty: 100 },
    ];
    const result = reverseProduction(moves, [preto, branco]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("preto");
    expect(balanceG(result[0])).toBe(1000);
  });

  it("stockMoves vazio (historico) não estorna nada", () => {
    const cor = makeColor({
      id: "preto",
      rolls: [makeRoll({ id: "r1", remainingG: 500 })],
    });
    expect(reverseProduction([], [cor])).toEqual([]);
  });
});
