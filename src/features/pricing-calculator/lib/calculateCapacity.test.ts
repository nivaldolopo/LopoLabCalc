import { describe, expect, it } from "vitest";
import { calculateCapacity } from "./calculateCapacity";
import { calculatePricing } from "./calculatePricing";
import { DEFAULT_PRODUCT_INPUT, DEFAULT_MACHINES } from "../constants";
import type {
  CapacitySettings,
  FixedCostSettings,
  ProductInput,
} from "../types";

function makeProduct(overrides: Partial<ProductInput> = {}): ProductInput {
  return { ...DEFAULT_PRODUCT_INPUT, ...overrides };
}

const NO_FIXED: FixedCostSettings = {
  enabled: false,
  rent: 0,
  other: 0,
  machines: 1,
  hoursDay: 20,
  daysMonth: 26,
};

function priceOf(product: ProductInput) {
  return calculatePricing(product, DEFAULT_MACHINES, NO_FIXED);
}

// Os casos herdados foram escritos quando o horizonte era 30 dias fixos e a
// falha não descontava volume (pré TD-010/TD-011); passar `daysMonth: 30` e
// `failureRate: 0` preserva a intenção original de cada um. Os casos novos no
// fim do arquivo cobrem as duas mudanças.
function legacySettings(
  overrides: Partial<CapacitySettings> = {},
): CapacitySettings {
  return { hoursDay: 20, machines: 1, daysMonth: 30, ...overrides };
}

function makeProductNoFail(overrides: Partial<ProductInput> = {}): ProductInput {
  return makeProduct({ failureRate: 0, ...overrides });
}

describe("calculateCapacity", () => {
  it("conta ciclos sobre o horizonte mensal (20h/dia, job de 3h)", () => {
    const product = makeProductNoFail();
    const cap = calculateCapacity(priceOf(product), product, legacySettings());
    // floor((20*30)/3)*1 = floor(200) = 200 ciclos/mês
    expect(cap?.cyclesMonth).toBe(200);
    expect(cap?.piecesMonth).toBe(200);
    expect(cap?.cyclesDay).toBeCloseTo(200 / 30, 6);
  });

  it("mais máquinas multiplicam a capacidade", () => {
    const product = makeProductNoFail();
    const cap = calculateCapacity(
      priceOf(product),
      product,
      legacySettings({ machines: 3 }),
    );
    expect(cap?.cyclesMonth).toBe(600);
  });

  it("etapa extra soma no tempo total de impressão e reduz os ciclos", () => {
    const product = makeProductNoFail({
      stages: [
        {
          machineId: "a1",
          weightG: 10,
          printHours: 1,
          filamentPricePerKg: 110,
          laborMinutes: 0,
        },
      ],
    });
    const cap = calculateCapacity(priceOf(product), product, legacySettings());
    // total = 3 + 1 = 4h -> floor(600/4) = 150
    expect(cap?.cyclesMonth).toBe(150);
  });

  it("gargalo: máquinas diferentes rodam em paralelo (limita a mais lenta)", () => {
    const product = makeProductNoFail({
      printHours: 3, // etapa principal na A1
      stages: [
        {
          machineId: "x2d",
          weightG: 10,
          printHours: 2,
          filamentPricePerKg: 110,
          laborMinutes: 0,
        },
      ],
    });
    const cap = calculateCapacity(priceOf(product), product, legacySettings());
    // Somar daria 5h -> floor(600/5)=120; o gargalo é a A1 (3h) -> floor(600/3)=200.
    expect(cap?.cyclesMonth).toBe(200);
    expect(cap?.piecesMonth).toBe(200);
    const a1 = cap?.machineBreakdown.find((m) => m.machineId === "a1");
    const x2d = cap?.machineBreakdown.find((m) => m.machineId === "x2d");
    expect(a1?.isBottleneck).toBe(true);
    expect(x2d?.isBottleneck).toBe(false);
    expect(x2d?.piecesMonth).toBe(300); // folga: floor(600/2)=300
  });

  it("o multiplicador de máquinas escala o gargalo", () => {
    const product = makeProductNoFail({
      printHours: 3,
      stages: [
        {
          machineId: "x2d",
          weightG: 10,
          printHours: 2,
          filamentPricePerKg: 110,
          laborMinutes: 0,
        },
      ],
    });
    const cap = calculateCapacity(
      priceOf(product),
      product,
      legacySettings({ machines: 2 }),
    );
    expect(cap?.cyclesMonth).toBe(400); // gargalo 3h -> 200, ×2 máquinas
  });

  it("piecesCount multiplica as peças por ciclo", () => {
    const product = makeProductNoFail({ piecesCount: 2 });
    const cap = calculateCapacity(priceOf(product), product, legacySettings());
    expect(cap?.cyclesMonth).toBe(200);
    expect(cap?.piecesMonth).toBe(400); // 200 ciclos × 2 peças
  });

  it("devolve null sem horas de impressão, sem horas/dia ou sem dias/mês", () => {
    const semHoras = makeProduct({ printHours: 0, stages: [] });
    expect(
      calculateCapacity(priceOf(semHoras), semHoras, legacySettings()),
    ).toBeNull();

    const product = makeProduct();
    expect(
      calculateCapacity(priceOf(product), product, legacySettings({ hoursDay: 0 })),
    ).toBeNull();
    expect(
      calculateCapacity(
        priceOf(product),
        product,
        legacySettings({ daysMonth: 0 }),
      ),
    ).toBeNull();
  });

  it("fixedIncluded reflete se o custo fixo entrou no preço", () => {
    const product = makeProduct();
    const cap = calculateCapacity(priceOf(product), product, legacySettings());
    expect(cap?.fixedIncluded).toBe(false);
  });

  // TD-010 — o horizonte usa o MESMO mês que rateia o custo fixo (daysMonth).
  describe("TD-010 — horizonte por daysMonth", () => {
    it("26 dias rendem menos ciclos no mês que 30", () => {
      const product = makeProductNoFail();
      const cap = calculateCapacity(
        priceOf(product),
        product,
        legacySettings({ daysMonth: 26 }),
      );
      // floor((20*26)/3) = floor(173,33) = 173 ciclos (contra 200 com 30 dias)
      expect(cap?.cyclesMonth).toBe(173);
      expect(cap?.piecesMonth).toBe(173);
    });

    it("a média DIÁRIA não muda com o número de dias do mês", () => {
      const product = makeProductNoFail();
      const trinta = calculateCapacity(
        priceOf(product),
        product,
        legacySettings({ daysMonth: 30 }),
      );
      const vinteSeis = calculateCapacity(
        priceOf(product),
        product,
        legacySettings({ daysMonth: 26 }),
      );
      // 200/30 = 6,67 e 173/26 = 6,65 — numerador e denominador escalam juntos.
      expect(vinteSeis!.cyclesDay).toBeCloseTo(trinta!.cyclesDay, 1);
      expect(vinteSeis!.piecesDay).toBeCloseTo(trinta!.piecesDay, 1);
    });
  });

  // TD-011 — peças/mês são peças BOAS; ciclos incluem a impressão que falhou.
  describe("TD-011 — a taxa de falha desconta o volume", () => {
    it("3% de falha corta as peças, não os ciclos", () => {
      const product = makeProduct({ failureRate: 3 });
      const result = priceOf(product);
      const cap = calculateCapacity(result, product, legacySettings());
      expect(cap?.cyclesMonth).toBe(200); // a máquina roda a peça que falha
      expect(cap?.piecesMonth).toBe(194); // floor(200 × 0,97)
      expect(cap?.failureRatePct).toBeCloseTo(3, 6);
      expect(cap?.grossMonth).toBeCloseTo(194 * result.suggestedPrice, 6);
    });

    it("sem falha configurada, nada é descontado", () => {
      const product = makeProductNoFail();
      const cap = calculateCapacity(priceOf(product), product, legacySettings());
      expect(cap?.piecesMonth).toBe(cap!.cyclesMonth);
      expect(cap?.failureRatePct).toBe(0);
    });

    it("a máquina com folga também rende peças boas, não ciclos", () => {
      const product = makeProduct({
        failureRate: 3,
        printHours: 3,
        stages: [
          {
            machineId: "x2d",
            weightG: 10,
            printHours: 2,
            filamentPricePerKg: 110,
            laborMinutes: 0,
          },
        ],
      });
      const cap = calculateCapacity(priceOf(product), product, legacySettings());
      const x2d = cap?.machineBreakdown.find((m) => m.machineId === "x2d");
      expect(x2d?.piecesMonth).toBe(291); // floor(300 × 0,97)
    });
  });
});
