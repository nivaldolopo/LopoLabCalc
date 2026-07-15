import { describe, expect, it } from "vitest";
import {
  activeRoll,
  adjustRoll,
  applyConsumption,
  balanceG,
  catalogPricePerKg,
  isBelowMin,
  newestRoll,
  reverseConsumption,
  saleCost,
  simulateConsumption,
} from "./stock";
import type { FilamentRoll, StockFilament } from "../types";

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

function makeColor(rolls: FilamentRoll[], minG = 0): StockFilament {
  return {
    id: "cor-preto",
    material: "PLA Basic",
    brand: "Bambu",
    colorName: "Preto",
    minG,
    archived: false,
    rolls,
    adjustments: [],
    createdAt: 0,
  };
}

// Cenário base do D3: um rolo velho quase no fim (R$90) e um novo (R$110).
function doisRolos(): StockFilament {
  return makeColor([
    makeRoll({ id: "velho", purchaseDate: DIA, remainingG: 100, pricePerKg: 90 }),
    makeRoll({ id: "novo", purchaseDate: 2 * DIA, remainingG: 50, pricePerKg: 110 }),
  ]);
}

describe("balanceG / activeRoll / newestRoll", () => {
  it("saldo é a soma dos rolos", () => {
    expect(balanceG(doisRolos())).toBe(150);
  });

  it("rolo em uso é o mais antigo COM saldo; o mais novo é por data", () => {
    const color = doisRolos();
    expect(activeRoll(color)?.id).toBe("velho");
    expect(newestRoll(color)?.id).toBe("novo");
  });

  it("rolo zerado não é o rolo em uso", () => {
    const color = makeColor([
      makeRoll({ id: "velho", purchaseDate: DIA, remainingG: 0 }),
      makeRoll({ id: "novo", purchaseDate: 2 * DIA, remainingG: 300 }),
    ]);
    expect(activeRoll(color)?.id).toBe("novo");
  });

  it("cor sem rolo com saldo não tem rolo em uso", () => {
    expect(activeRoll(makeColor([makeRoll({ id: "a", remainingG: 0 })]))).toBe(
      null,
    );
    expect(activeRoll(makeColor([]))).toBe(null);
  });
});

describe("catalogPricePerKg", () => {
  it("D3: usa o preço do rolo MAIS NOVO (custo de repor)", () => {
    expect(catalogPricePerKg(doisRolos())).toBe(110);
  });

  it("rolo mais novo vazio ainda define o preço (é a última cotação real)", () => {
    const color = makeColor([
      makeRoll({ id: "velho", purchaseDate: DIA, remainingG: 800, pricePerKg: 90 }),
      makeRoll({ id: "novo", purchaseDate: 2 * DIA, remainingG: 0, pricePerKg: 110 }),
    ]);
    expect(catalogPricePerKg(color)).toBe(110);
  });

  it("cor sem rolos devolve 0 (chamador cai no fallback)", () => {
    expect(catalogPricePerKg(makeColor([]))).toBe(0);
  });
});

describe("isBelowMin", () => {
  it("alerta quando o saldo fica abaixo do mínimo", () => {
    expect(isBelowMin(makeColor([makeRoll({ id: "a", remainingG: 150 })], 200))).toBe(
      true,
    );
    expect(isBelowMin(makeColor([makeRoll({ id: "a", remainingG: 250 })], 200))).toBe(
      false,
    );
  });

  it("mínimo 0 = sem alerta, mesmo zerado", () => {
    expect(isBelowMin(makeColor([makeRoll({ id: "a", remainingG: 0 })], 0))).toBe(
      false,
    );
  });
});

describe("simulateConsumption", () => {
  it("consome só do rolo em uso quando cabe", () => {
    const result = simulateConsumption(doisRolos(), 60);
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0]).toMatchObject({ rollId: "velho", qty: 60 });
    expect(result.cost).toBeCloseTo(5.4, 6); // 60 g × R$90/kg
    expect(result.crossesRoll).toBe(false);
    expect(result.shortfallG).toBe(0);
  });

  it("D3/D5: atravessa rolos com custo MISTO e exato", () => {
    // 100 g × R$90 + 50 g × R$110 = 9,00 + 5,50
    const result = simulateConsumption(doisRolos(), 150);
    expect(result.moves).toEqual([
      { stockId: "cor-preto", rollId: "velho", qty: 100, pricePerKg: 90, cost: 9 },
      { stockId: "cor-preto", rollId: "novo", qty: 50, pricePerKg: 110, cost: 5.5 },
    ]);
    expect(result.cost).toBeCloseTo(14.5, 6);
    expect(result.crossesRoll).toBe(true);
    expect(result.shortfallG).toBe(0);
  });

  it("FIFO segue a data de compra, não a ordem do array", () => {
    const color = makeColor([
      makeRoll({ id: "novo", purchaseDate: 2 * DIA, remainingG: 50 }),
      makeRoll({ id: "velho", purchaseDate: DIA, remainingG: 100 }),
    ]);
    expect(simulateConsumption(color, 30).moves[0].rollId).toBe("velho");
  });

  it("pula rolo zerado sem gastar consumo nele", () => {
    const color = makeColor([
      makeRoll({ id: "acabado", purchaseDate: DIA, remainingG: 0 }),
      makeRoll({ id: "novo", purchaseDate: 2 * DIA, remainingG: 300 }),
    ]);
    const result = simulateConsumption(color, 80);
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0].rollId).toBe("novo");
  });

  it("D4: excedente vira negativo no rolo mais novo — não trunca em zero", () => {
    const result = simulateConsumption(doisRolos(), 200);
    expect(result.shortfallG).toBe(50);
    // O move do rolo novo engrossa (50 g reais + 50 g de overdraft), em vez de
    // virar um segundo move para o mesmo rolo.
    expect(result.moves).toHaveLength(2);
    expect(result.moves[1]).toMatchObject({ rollId: "novo", qty: 100 });
    expect(result.cost).toBeCloseTo(20, 6); // 9,00 + (100 g × R$110)
    expect(balanceG(applyConsumption(doisRolos(), result.moves))).toBe(-50);
  });

  it("D4: cor sem rolo nenhum reporta o furo inteiro, sem move", () => {
    const result = simulateConsumption(makeColor([]), 120);
    expect(result.moves).toEqual([]);
    expect(result.shortfallG).toBe(120);
    expect(result.cost).toBe(0);
  });

  it("é PURA: não altera a cor recebida", () => {
    const color = doisRolos();
    simulateConsumption(color, 150);
    expect(color.rolls.map((roll) => roll.remainingG)).toEqual([100, 50]);
  });

  it("consumo zero ou negativo não gera move", () => {
    expect(simulateConsumption(doisRolos(), 0).moves).toEqual([]);
    expect(simulateConsumption(doisRolos(), -10).moves).toEqual([]);
  });
});

describe("saleCost", () => {
  it("D3: custo real da venda é o FIFO, não o preço de catálogo", () => {
    const color = doisRolos();
    expect(saleCost(color, 150)).toBeCloseTo(14.5, 6);
    // A margem da venda diverge do catálogo de propósito: pelo preço de repor
    // (rolo novo) as mesmas 150 g custariam R$16,50.
    expect((150 / 1000) * catalogPricePerKg(color)).toBeCloseTo(16.5, 6);
  });
});

describe("applyConsumption / reverseConsumption", () => {
  it("baixa deduz por rolo", () => {
    const { moves } = simulateConsumption(doisRolos(), 150);
    const after = applyConsumption(doisRolos(), moves);
    expect(after.rolls.map((roll) => roll.remainingG)).toEqual([0, 0]);
  });

  it("round-trip: estornar devolve exatamente o que a baixa tirou", () => {
    const color = doisRolos();
    const { moves } = simulateConsumption(color, 130);
    const back = reverseConsumption(applyConsumption(color, moves), moves);
    expect(back.rolls).toEqual(color.rolls);
  });

  it("estorna em rolo já zerado pela venda", () => {
    const color = doisRolos();
    const { moves } = simulateConsumption(color, 150);
    const back = reverseConsumption(applyConsumption(color, moves), moves);
    expect(back.rolls.map((roll) => roll.remainingG)).toEqual([100, 50]);
  });

  it("estorno parcial (recibo de 3 → 2 unidades) devolve só a diferença", () => {
    const color = makeColor([makeRoll({ id: "a", remainingG: 1000 })]);
    const tres = simulateConsumption(color, 300);
    const vendido = applyConsumption(color, tres.moves);
    const umaUnidade = simulateConsumption(color, 100);
    const corrigido = reverseConsumption(vendido, umaUnidade.moves);
    expect(balanceG(corrigido)).toBe(800);
  });

  it("ignora moves de outra cor (um recibo consome várias)", () => {
    const color = doisRolos();
    const alheio = [{ stockId: "cor-branco", rollId: "velho", qty: 50 }];
    expect(applyConsumption(color, alheio)).toEqual(color);
  });

  it("é imutável: não altera a cor recebida", () => {
    const color = doisRolos();
    const { moves } = simulateConsumption(color, 150);
    applyConsumption(color, moves);
    expect(color.rolls.map((roll) => roll.remainingG)).toEqual([100, 50]);
  });
});

describe("adjustRoll", () => {
  it("D6: corrige o saldo e grava beforeG/afterG", () => {
    const color = adjustRoll(doisRolos(), "velho", 70, "contagem", 5 * DIA);
    expect(color.rolls[0].remainingG).toBe(70);
    expect(color.adjustments).toHaveLength(1);
    expect(color.adjustments[0]).toMatchObject({
      rollId: "velho",
      beforeG: 100,
      afterG: 70,
      reason: "contagem",
      at: 5 * DIA,
    });
    expect(color.adjustments[0].id).toBeTruthy();
  });

  it("D6 + D4: contagem sobre saldo negativo grava o furo como prova", () => {
    const overdraft = applyConsumption(
      doisRolos(),
      simulateConsumption(doisRolos(), 200).moves,
    );
    const color = adjustRoll(overdraft, "novo", 0, "contagem", 6 * DIA);
    expect(color.adjustments[0]).toMatchObject({ beforeG: -50, afterG: 0 });
    expect(balanceG(color)).toBe(0);
  });

  it("ajusta rolo zerado (achou o spool na gaveta com sobra)", () => {
    const color = makeColor([makeRoll({ id: "acabado", remainingG: 0 })]);
    const ajustado = adjustRoll(color, "acabado", 40, "sobrou no bico", DIA);
    expect(ajustado.rolls[0].remainingG).toBe(40);
  });

  it("acumula ajustes sem apagar o anterior", () => {
    const um = adjustRoll(doisRolos(), "velho", 70, "contagem", DIA);
    const dois = adjustRoll(um, "novo", 45, "recontagem", 2 * DIA);
    expect(dois.adjustments.map((a) => a.rollId)).toEqual(["velho", "novo"]);
  });

  it("rolo inexistente é erro, não no-op silencioso", () => {
    expect(() => adjustRoll(doisRolos(), "fantasma", 10, "x", DIA)).toThrow();
  });

  it("é imutável: não altera a cor recebida", () => {
    const color = doisRolos();
    adjustRoll(color, "velho", 70, "contagem", DIA);
    expect(color.rolls[0].remainingG).toBe(100);
    expect(color.adjustments).toEqual([]);
  });
});
