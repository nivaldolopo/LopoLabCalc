import { describe, expect, it } from "vitest";
import {
  apportionDiscount,
  discountAmountOf,
  feeFraction,
  grossUpForFee,
  resolveFeeRate,
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

describe("resolveFeeRate", () => {
  it("débito lê a taxa da bandeira", () => {
    expect(resolveFeeRate(DEFAULT_PAYMENT_FEES, "debito", "visamaster")).toBeCloseTo(1.36, 6);
    expect(resolveFeeRate(DEFAULT_PAYMENT_FEES, "debito", "amexelo")).toBeCloseTo(2.57, 6);
  });

  it("crédito lê a taxa por parcela (à vista / 2x / 3x)", () => {
    expect(resolveFeeRate(DEFAULT_PAYMENT_FEES, "credito", "visamaster", 1)).toBeCloseTo(3.14, 6);
    expect(resolveFeeRate(DEFAULT_PAYMENT_FEES, "credito", "visamaster", 3)).toBeCloseTo(6.11, 6);
    expect(resolveFeeRate(DEFAULT_PAYMENT_FEES, "credito", "amexelo", 2)).toBeCloseTo(6.46, 6);
  });

  it("clamp da parcela fora da faixa (acima → última; abaixo → à vista)", () => {
    expect(resolveFeeRate(DEFAULT_PAYMENT_FEES, "credito", "visamaster", 9)).toBeCloseTo(6.11, 6);
    expect(resolveFeeRate(DEFAULT_PAYMENT_FEES, "credito", "visamaster", 0)).toBeCloseTo(3.14, 6);
  });

  it("pix/dinheiro e config ausente devolvem 0", () => {
    expect(resolveFeeRate(DEFAULT_PAYMENT_FEES, "pix", "visamaster")).toBe(0);
    expect(resolveFeeRate(null, "credito", "visamaster", 1)).toBe(0);
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

  it("FEAT-09: desconto abate a receita e o lucro cai o mesmo tanto", () => {
    // 2 × R$100 = 200; −R$30 → receita 170; Pix (0%): lucro 170 − 60.
    const fin = saleItemFinancials({
      chargedUnitPrice: 100,
      quantity: 2,
      unitCost: 30,
      feeRatePct: 0,
      discountAmount: 30,
    });
    expect(fin.totalRevenue).toBe(170);
    expect(fin.totalCost).toBe(60);
    expect(fin.profit).toBe(110);
  });

  it("FEAT-09: a taxa incide sobre o valor JÁ com desconto", () => {
    // R$100 −10% = 90; taxa 4,5% sobre 90 = 4,05.
    const fin = saleItemFinancials({
      chargedUnitPrice: 100,
      quantity: 1,
      unitCost: 40,
      feeRatePct: 4.5,
      discountAmount: 10,
    });
    expect(fin.totalRevenue).toBe(90);
    expect(fin.feeAmount).toBeCloseTo(4.05, 6);
    expect(fin.profit).toBeCloseTo(45.95, 6); // 90 − 40 − 4,05
  });

  it("FEAT-09: desconto sem/zero é neutro (comportamento antigo)", () => {
    const semDesc = saleItemFinancials({
      chargedUnitPrice: 100,
      quantity: 1,
      unitCost: 40,
      feeRatePct: 4.5,
    });
    const zero = saleItemFinancials({
      chargedUnitPrice: 100,
      quantity: 1,
      unitCost: 40,
      feeRatePct: 4.5,
      discountAmount: 0,
    });
    expect(zero).toEqual(semDesc);
  });
});

describe("discountAmountOf", () => {
  it("percentual: aplica sobre a base", () => {
    expect(discountAmountOf(200, { mode: "pct", value: 10 })).toBe(20);
  });

  it("absoluto: devolve o R$ digitado, limitado à base", () => {
    expect(discountAmountOf(200, { mode: "abs", value: 30 })).toBe(30);
    expect(discountAmountOf(50, { mode: "abs", value: 80 })).toBe(50); // clamp
  });

  it("percentual acima de 100% e valores inválidos", () => {
    expect(discountAmountOf(200, { mode: "pct", value: 150 })).toBe(200);
    expect(discountAmountOf(200, { mode: "pct", value: -5 })).toBe(0);
    expect(discountAmountOf(0, { mode: "abs", value: 10 })).toBe(0);
    expect(discountAmountOf(100, null)).toBe(0);
  });
});

describe("apportionDiscount", () => {
  it("rateia proporcional à receita de cada linha", () => {
    // 30 sobre linhas 100 e 200 → 10 e 20.
    expect(apportionDiscount([100, 200], 30)).toEqual([10, 20]);
  });

  it("a soma das fatias bate com o desconto (resíduo na última linha)", () => {
    // 10 sobre 3 linhas iguais → 3,33 / 3,33 / 3,34 (soma 10).
    const shares = apportionDiscount([100, 100, 100], 10);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(10, 6);
    expect(shares[2]).toBeCloseTo(3.34, 6);
  });

  it("limita o desconto ao bruto total e ignora linhas sem receita", () => {
    expect(apportionDiscount([100, 0], 999)).toEqual([100, 0]);
  });
});
