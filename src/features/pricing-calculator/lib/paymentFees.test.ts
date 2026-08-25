import { describe, expect, it } from "vitest";
import {
  apportionDiscount,
  discountAmountOf,
  feeFraction,
  grossUpForFee,
  MAX_FEE_PCT,
  netMarginPct,
  resolveFeeRate,
  saleItemFinancials,
  worstPaymentFee,
} from "./paymentFees";
import { DEFAULT_PAYMENT_FEES } from "../constants";
import type { PaymentFeeSettings } from "../types";

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

// Taxas zeradas por padrão; cada teste liga só a combinação que quer medir.
function feesWith(partial: Partial<PaymentFeeSettings>): PaymentFeeSettings {
  return {
    pix: 0,
    dinheiro: 0,
    outro: 0,
    card: {
      visamaster: { debito: 0, credito: [0, 0, 0] },
      amexelo: { debito: 0, credito: [0, 0, 0] },
    },
    ...partial,
  };
}

describe("worstPaymentFee (UX-10)", () => {
  it("acha a pior combinação nas taxas padrão: crédito 3x Amex/Elo", () => {
    const worst = worstPaymentFee(DEFAULT_PAYMENT_FEES);
    expect(worst?.ratePct).toBeCloseTo(7.19, 6);
    expect(worst?.label).toBe("crédito 3× Amex / Elo");
  });

  it("rotula débito e crédito à vista quando são o pior caso", () => {
    expect(
      worstPaymentFee(
        feesWith({
          card: {
            visamaster: { debito: 2, credito: [1, 0, 0] },
            amexelo: { debito: 0, credito: [0, 0, 0] },
          },
        }),
      )?.label,
    ).toBe("débito Visa / Mastercard");
    expect(
      worstPaymentFee(
        feesWith({
          card: {
            visamaster: { debito: 1, credito: [4, 0, 0] },
            amexelo: { debito: 0, credito: [0, 0, 0] },
          },
        }),
      )?.label,
    ).toBe("crédito à vista Visa / Mastercard");
  });

  it("considera pix/dinheiro/outro quando configurados", () => {
    const worst = worstPaymentFee(
      feesWith({ pix: 9, card: DEFAULT_PAYMENT_FEES.card }),
    );
    expect(worst?.ratePct).toBeCloseTo(9, 6);
    expect(worst?.label).toBe("Pix");
  });

  it("devolve null quando tudo é isento (nada a avisar)", () => {
    expect(worstPaymentFee(feesWith({}))).toBeNull();
    expect(worstPaymentFee(null)).toBeNull();
  });
});

describe("netMarginPct (UX-10)", () => {
  it("a taxa derruba a margem em exatamente o mesmo tanto de pontos", () => {
    // Preço 100, custo 46 → 54% bruta. A 7,19% de taxa, sobram 46,81%.
    expect(netMarginPct(100, 46, 0)).toBeCloseTo(54, 6);
    expect(netMarginPct(100, 46, 7.19)).toBeCloseTo(54 - 7.19, 6);
  });

  it("bate com o `saleItemFinancials` da venda real (fonte única)", () => {
    const viaSale = saleItemFinancials({
      chargedUnitPrice: 27.14,
      quantity: 1,
      unitCost: 12.5,
      feeRatePct: 6.11,
    });
    expect(netMarginPct(27.14, 12.5, 6.11)).toBeCloseTo(viaSale.margin, 9);
  });

  it("preço zero não explode", () => {
    expect(netMarginPct(0, 10, 5)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TD-025 (AUD-12) — quantidade 0 vendia 1.
// ---------------------------------------------------------------------------
describe("TD-025 — quantidade zero não vende uma peça", () => {
  const base = { chargedUnitPrice: 100, unitCost: 30, feeRatePct: 0 };

  it("qty 0: receita, custo e lucro saem ZERO", () => {
    const r = saleItemFinancials({ ...base, quantity: 0 });
    expect(r.totalRevenue).toBe(0);
    expect(r.totalCost).toBe(0);
    expect(r.feeAmount).toBe(0);
    expect(r.profit).toBe(0);
    expect(r.margin).toBe(0);
  });

  it("qty negativa também: não se vende peça negativa", () => {
    const r = saleItemFinancials({ ...base, quantity: -2 });
    expect(r.totalRevenue).toBe(0);
    expect(r.totalCost).toBe(0);
  });

  it("campo AUSENTE continua valendo 1 — é o default de sempre", () => {
    const r = saleItemFinancials({
      ...base,
      quantity: undefined as unknown as number,
    });
    expect(r.totalRevenue).toBe(100);
    expect(r.totalCost).toBe(30);
  });

  it("quantidade normal não se move", () => {
    const r = saleItemFinancials({ ...base, quantity: 3 });
    expect(r.totalRevenue).toBe(300);
    expect(r.totalCost).toBe(90);
    expect(r.profit).toBe(210);
  });
});

// ---------------------------------------------------------------------------
// TD-032 (AUD-13, lote E) — o teto da taxa é UM número, e é o mesmo dos dois
// lados. O editor aceitava digitar 100%: o documento guardava 100, a conta usava
// 95 e o preço de repasse saía ×20 sem que a tela tivesse dito nada.
// ---------------------------------------------------------------------------

describe("TD-032 — taxa acima do teto não vira preço fantasia calado", () => {
  it("o teto do clamp É o MAX_FEE_PCT — um número, não dois", () => {
    expect(feeFraction(MAX_FEE_PCT)).toBeCloseTo(MAX_FEE_PCT / 100, 12);
    expect(feeFraction(MAX_FEE_PCT)).toBe(0.95);
  });

  it("acima do teto nada mais se move — 100%, 500% e 1e6% dão o MESMO preço", () => {
    const teto = grossUpForFee(100, MAX_FEE_PCT);
    expect(grossUpForFee(100, 100)).toBe(teto);
    expect(grossUpForFee(100, 500)).toBe(teto);
    expect(grossUpForFee(100, 1e6)).toBe(teto);
    // O ×20 medido na varredura: ele é a CONSEQUÊNCIA correta de uma taxa de
    // 95%. O defeito era chegar nele digitando 100 — por isso o editor agora
    // clampa a ENTRADA no mesmo teto (SaleModal.clampFeePct), e o que se lê no
    // campo é o que entra na conta.
    expect(teto).toBeCloseTo(2000, 6);
  });

  it("abaixo do teto o gross-up segue exato", () => {
    expect(grossUpForFee(100, 5)).toBeCloseTo(105.263157894, 8);
    expect(grossUpForFee(100, 0)).toBe(100);
    expect(grossUpForFee(100, -3)).toBe(100);
  });
});
