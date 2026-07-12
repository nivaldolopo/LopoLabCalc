import { describe, expect, it } from "vitest";
import {
  feeFraction,
  feeRateForMethod,
  grossUpForFee,
  saleItemFinancials,
} from "./paymentFees";
import { DEFAULT_PAYMENT_FEES } from "../constants";

describe("feeFraction", () => {
  it("converte percentual em fração", () => {
    expect(feeFraction(4.5)).toBeCloseTo(0.045, 6);
    expect(feeFraction(2)).toBeCloseTo(0.02, 6);
  });

  it("trata zero, negativo e inválido como sem taxa", () => {
    expect(feeFraction(0)).toBe(0);
    expect(feeFraction(-3)).toBe(0);
    expect(feeFraction(Number.NaN)).toBe(0);
  });

  it("faz clamp em 95% para não explodir o gross-up", () => {
    expect(feeFraction(200)).toBe(0.95);
  });
});

describe("feeRateForMethod", () => {
  it("lê a taxa do método (percentual)", () => {
    expect(feeRateForMethod(DEFAULT_PAYMENT_FEES, "credito")).toBe(4.5);
    expect(feeRateForMethod(DEFAULT_PAYMENT_FEES, "pix")).toBe(0);
  });

  it("devolve 0 para config ausente", () => {
    expect(feeRateForMethod(null, "credito")).toBe(0);
  });
});

describe("grossUpForFee", () => {
  it("sem taxa devolve o preço base", () => {
    expect(grossUpForFee(100, 0)).toBe(100);
  });

  it("infla o preço para o líquido cobrir a taxa", () => {
    // 100 / (1 − 0,045) = 104,7120...
    expect(grossUpForFee(100, 4.5)).toBeCloseTo(104.712, 3);
  });

  it("repasse é neutro: o líquido após a taxa volta ao base", () => {
    const charged = grossUpForFee(100, 4.5);
    const net = charged * (1 - 0.045);
    expect(net).toBeCloseTo(100, 6);
  });
});

describe("saleItemFinancials", () => {
  it("Pix/dinheiro (0%): lucro é receita − custo", () => {
    const fin = saleItemFinancials({
      chargedUnitPrice: 100,
      quantity: 2,
      unitCost: 30,
      feeRatePct: 0,
    });
    expect(fin.totalRevenue).toBe(200);
    expect(fin.totalCost).toBe(60);
    expect(fin.feeAmount).toBe(0);
    expect(fin.profit).toBe(140);
  });

  it("crédito absorvido: taxa desconta da margem", () => {
    const fin = saleItemFinancials({
      chargedUnitPrice: 100,
      quantity: 1,
      unitCost: 40,
      feeRatePct: 4.5,
    });
    expect(fin.feeAmount).toBeCloseTo(4.5, 6);
    expect(fin.profit).toBeCloseTo(55.5, 6); // 100 − 40 − 4,5
    expect(fin.margin).toBeCloseTo(55.5, 6);
  });

  it("crédito repassado: você recebe o base cheio", () => {
    const base = 100;
    const charged = grossUpForFee(base, 4.5);
    const fin = saleItemFinancials({
      chargedUnitPrice: charged,
      quantity: 1,
      unitCost: 40,
      feeRatePct: 4.5,
    });
    // Receita − taxa = base; lucro = base − custo.
    expect(fin.totalRevenue - fin.feeAmount).toBeCloseTo(base, 6);
    expect(fin.profit).toBeCloseTo(60, 6); // 100 − 40
  });
});
