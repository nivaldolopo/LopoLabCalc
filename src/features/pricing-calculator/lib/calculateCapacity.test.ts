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

describe("calculateCapacity", () => {
  it("conta ciclos sobre o horizonte mensal (20h/dia, job de 3h)", () => {
    const product = makeProduct();
    const settings: CapacitySettings = { hoursDay: 20, machines: 1 };
    const cap = calculateCapacity(priceOf(product), product, settings);
    // floor((20*30)/3)*1 = floor(200) = 200 ciclos/mês
    expect(cap?.cyclesMonth).toBe(200);
    expect(cap?.piecesMonth).toBe(200);
    expect(cap?.cyclesDay).toBeCloseTo(200 / 30, 6);
  });

  it("mais máquinas multiplicam a capacidade", () => {
    const product = makeProduct();
    const cap = calculateCapacity(priceOf(product), product, {
      hoursDay: 20,
      machines: 3,
    });
    expect(cap?.cyclesMonth).toBe(600);
  });

  it("etapa extra soma no tempo total de impressão e reduz os ciclos", () => {
    const product = makeProduct({
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
    const cap = calculateCapacity(priceOf(product), product, {
      hoursDay: 20,
      machines: 1,
    });
    // total = 3 + 1 = 4h -> floor(600/4) = 150
    expect(cap?.cyclesMonth).toBe(150);
  });

  it("piecesCount multiplica as peças por ciclo", () => {
    const product = makeProduct({ piecesCount: 2 });
    const cap = calculateCapacity(priceOf(product), product, {
      hoursDay: 20,
      machines: 1,
    });
    expect(cap?.cyclesMonth).toBe(200);
    expect(cap?.piecesMonth).toBe(400); // 200 ciclos × 2 peças
  });

  it("devolve null sem horas de impressão ou sem horas/dia", () => {
    const semHoras = makeProduct({ printHours: 0, stages: [] });
    expect(
      calculateCapacity(priceOf(semHoras), semHoras, {
        hoursDay: 20,
        machines: 1,
      }),
    ).toBeNull();

    const product = makeProduct();
    expect(
      calculateCapacity(priceOf(product), product, {
        hoursDay: 0,
        machines: 1,
      }),
    ).toBeNull();
  });

  it("fixedIncluded reflete se o custo fixo entrou no preço", () => {
    const product = makeProduct();
    const cap = calculateCapacity(priceOf(product), product, {
      hoursDay: 20,
      machines: 1,
    });
    expect(cap?.fixedIncluded).toBe(false);
  });
});
