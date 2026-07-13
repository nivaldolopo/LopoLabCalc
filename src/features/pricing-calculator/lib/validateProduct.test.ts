import { describe, expect, it } from "vitest";
import { validateProduct } from "./validateProduct";
import { DEFAULT_PRODUCT_INPUT } from "../constants";
import type { ProductInput } from "../types";

function makeProduct(overrides: Partial<ProductInput> = {}): ProductInput {
  return { ...DEFAULT_PRODUCT_INPUT, ...overrides };
}

describe("validateProduct", () => {
  it("produto padrão é válido (sem erro)", () => {
    expect(validateProduct(makeProduct())).toBeNull();
  });

  it("rejeita campos numéricos negativos", () => {
    expect(validateProduct(makeProduct({ weightG: -1 }))).toContain("Peso");
    expect(validateProduct(makeProduct({ printHours: -1 }))).toContain(
      "Tempo de impressão",
    );
    expect(validateProduct(makeProduct({ laborRate: -1 }))).toContain(
      "Valor-hora",
    );
  });

  it("exige pelo menos peso ou tempo de impressão", () => {
    const erro = validateProduct(makeProduct({ weightG: 0, printHours: 0 }));
    expect(erro).toContain("pelo menos");
  });

  it("aceita só peso ou só tempo", () => {
    expect(validateProduct(makeProduct({ weightG: 40, printHours: 0 }))).toBeNull();
    expect(validateProduct(makeProduct({ weightG: 0, printHours: 3 }))).toBeNull();
  });

  it("markup deve ser no mínimo 1x", () => {
    expect(validateProduct(makeProduct({ markup: 0.9 }))).toContain("markup");
    expect(validateProduct(makeProduct({ markup: 1 }))).toBeNull();
  });

  it("pega valores negativos em etapas extras (incluindo campos opcionais)", () => {
    const erro = validateProduct(
      makeProduct({
        stages: [
          {
            machineId: "a1",
            weightG: 10,
            printHours: 1,
            filamentPricePerKg: 100,
            laborMinutes: 0,
            energyTariff: -0.5,
          },
        ],
      }),
    );
    // Etapa índice 0 é rotulada "etapa 2" para o usuário.
    expect(erro).toContain("etapa 2");
  });

  it("pega acessório com quantidade ou preço negativo", () => {
    const erro = validateProduct(
      makeProduct({
        accessories: [{ desc: "Ímã", qty: -1, unitPrice: 0.5 }],
      }),
    );
    expect(erro).toContain("Ímã");
  });
});
