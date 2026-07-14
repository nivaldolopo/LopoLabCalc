import { describe, expect, it } from "vitest";
import {
  calculateFixedCostPerHour,
  calculatePricing,
} from "./calculatePricing";
import { DEFAULT_PRODUCT_INPUT, DEFAULT_MACHINES } from "../constants";
import type { FixedCostSettings, ProductInput } from "../types";

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

describe("calculatePricing — componentes de custo", () => {
  it("calcula cada categoria da etapa principal (a1, 40g/3h)", () => {
    const r = calculatePricing(makeProduct(), DEFAULT_MACHINES, NO_FIXED);
    expect(r.materialCost).toBeCloseTo(4.4, 6); // (40/1000)*110
    expect(r.energyCost).toBeCloseTo(0.228, 6); // 3*(95/1000)*0.8
    expect(r.depreciationCost).toBeCloseTo(1.5897, 4); // (5299/10000)*3
    expect(r.maintenanceCost).toBeCloseTo(0.36, 6); // 3*0.12
    expect(r.laborCost).toBeCloseTo(5, 6); // (10/60)*30
    expect(r.machine.id).toBe("a1");
  });

  it("reserva de falha infla o custo variável e some com taxa 0", () => {
    const comFalha = calculatePricing(
      makeProduct({ failureRate: 3 }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    const semFalha = calculatePricing(
      makeProduct({ failureRate: 0 }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(comFalha.failureReserve).toBeGreaterThan(0);
    expect(semFalha.failureReserve).toBe(0);
    expect(comFalha.variableCost).toBeGreaterThan(semFalha.variableCost);
  });

  it("preço = custo variável × markup quando não há custo fixo", () => {
    const r = calculatePricing(
      makeProduct({ markup: 3, failureRate: 0, roundingMode: "exact" }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(r.fixedCost).toBe(0);
    expect(r.suggestedPrice).toBeCloseTo(r.variableCost * 3, 6);
    // markup 3x, sem fixo -> margem = (3-1)/3 = 66,67%
    expect(r.margin).toBeCloseTo(66.6667, 3);
  });

  it("acessórios entram no custo mas ficam fora da reserva de falha", () => {
    const semAcess = calculatePricing(
      makeProduct({ failureRate: 10 }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    const comAcess = calculatePricing(
      makeProduct({
        failureRate: 10,
        accessories: [{ desc: "Ímã", qty: 2, unitPrice: 1.5 }],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(comAcess.accessoriesCost).toBeCloseTo(3, 6);
    // A reserva de falha (peça perdida) não deve crescer com acessórios —
    // ímãs são montados depois e não se perdem numa falha de impressão.
    expect(comAcess.failureReserve).toBeCloseTo(semAcess.failureReserve, 6);
    expect(comAcess.variableCost).toBeCloseTo(semAcess.variableCost + 3, 6);
  });

  it("custo fixo entra quando habilitado (repassado, sem markup no fixo)", () => {
    const fixed: FixedCostSettings = {
      enabled: true,
      rent: 1500,
      other: 150,
      machines: 2,
      hoursDay: 20,
      daysMonth: 26,
    };
    const r = calculatePricing(
      makeProduct({ includeFixed: true }),
      DEFAULT_MACHINES,
      fixed,
    );
    const perHour = calculateFixedCostPerHour(fixed);
    expect(r.fixedCost).toBeCloseTo(perHour * 3, 6); // 3h de impressão
    expect(r.fixedCost).toBeGreaterThan(0);
  });

  it("divide os custos por peça quando piecesCount > 1", () => {
    const um = calculatePricing(makeProduct(), DEFAULT_MACHINES, NO_FIXED);
    const dois = calculatePricing(
      makeProduct({ piecesCount: 2 }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(dois.pieces).toBe(2);
    expect(dois.materialCost).toBeCloseTo(um.materialCost / 2, 6);
    expect(dois.variableCost).toBeCloseTo(um.variableCost / 2, 6);
  });
});

describe("calculatePricing — múltiplas etapas / máquinas", () => {
  it("soma etapa extra nas mesmas categorias e reparte uso por máquina", () => {
    const r = calculatePricing(
      makeProduct({
        stages: [
          {
            machineId: "x2d",
            weightG: 20,
            printHours: 1,
            filamentPricePerKg: 110,
            laborMinutes: 0,
          },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(r.stagesCount).toBe(1);
    expect(r.materialCost).toBeCloseTo(6.6, 6); // 4,4 (a1) + 2,2 (x2d)
    // Uma entrada de uso por máquina participante.
    expect(r.machineUsage).toHaveLength(2);
    const ids = r.machineUsage.map((u) => u.machineId).sort();
    expect(ids).toEqual(["a1", "x2d"]);
  });
});

describe("calculatePricing — máquina órfã (TD-009)", () => {
  it("não sinaliza quando o machineId existe", () => {
    const r = calculatePricing(makeProduct(), DEFAULT_MACHINES, NO_FIXED);
    expect(r.machineMissing).toBe(false);
  });

  it("sinaliza e cai no fallback (1ª máquina) quando o machineId não existe", () => {
    const r = calculatePricing(
      makeProduct({ machineId: "inexistente" }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(r.machineMissing).toBe(true);
    // Fallback: usa a 1ª máquina para não quebrar o preço.
    expect(r.machine.id).toBe(DEFAULT_MACHINES[0].id);
  });

  it("sinaliza quando a máquina órfã está numa etapa extra", () => {
    const r = calculatePricing(
      makeProduct({
        stages: [
          {
            machineId: "inexistente",
            weightG: 20,
            printHours: 1,
            filamentPricePerKg: 110,
            laborMinutes: 0,
          },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(r.machineMissing).toBe(true);
  });
});
