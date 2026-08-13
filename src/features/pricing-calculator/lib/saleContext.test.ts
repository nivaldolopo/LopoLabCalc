import { describe, expect, it } from "vitest";
import { chargedWithFee } from "./saleContext";
import { grossUpForFee } from "./paymentFees";
import { ROUNDING_OPTIONS } from "./roundPrice";
import type { SaleModalContext } from "./saleContext";
import type { RoundingMode } from "../types";

// `chargedWithFee` lê só estes dois campos do contexto — o resto da foto
// congelada não participa da conta.
function ctx(suggestedPrice: number, roundingMode: RoundingMode) {
  return { suggestedPrice, roundingMode } as SaleModalContext;
}

const ALL_MODES = ROUNDING_OPTIONS.map((option) => option.value);

describe("chargedWithFee", () => {
  it("sem taxa devolve o preço sugerido (modo exato)", () => {
    expect(chargedWithFee(ctx(37.45, "exact"), 0)).toBe(37.45);
  });

  it("sem taxa é idempotente em preço já no formato do modo", () => {
    // O preço sugerido já vem arredondado pelo mesmo modo — reaplicar não move.
    expect(chargedWithFee(ctx(100.9, "0.90"), 0)).toBeCloseTo(100.9, 6);
    expect(chargedWithFee(ctx(105, "5"), 0)).toBe(105);
    expect(chargedWithFee(ctx(110, "10"), 0)).toBe(110);
  });

  it("taxa nula/negativa/inválida não infla nada", () => {
    expect(chargedWithFee(ctx(100, "exact"), -5)).toBe(100);
    expect(chargedWithFee(ctx(100, "exact"), Number.NaN)).toBe(100);
  });

  it("modo exato: infla o preço em centavos", () => {
    // 100 / (1 − 0,045) = 104,7120... → 104,71 em centavos.
    expect(chargedWithFee(ctx(100, "exact"), 4.5)).toBe(104.71);
  });

  it("reaplica o arredondamento do produto sobre o preço inflado", () => {
    // Base 104,712... em cada modo.
    expect(chargedWithFee(ctx(100, "0.90"), 4.5)).toBeCloseTo(104.9, 6);
    expect(chargedWithFee(ctx(100, "0.5"), 4.5)).toBe(105);
    expect(chargedWithFee(ctx(100, "1"), 4.5)).toBe(105);
    expect(chargedWithFee(ctx(100, "5"), 4.5)).toBe(105);
    expect(chargedWithFee(ctx(100, "10"), 4.5)).toBe(110);
  });

  it("arredonda sempre PRA CIMA do exato: nunca come margem", () => {
    const base = 37.45;
    for (const pct of [0, 1.99, 3.14, 4.5, 6.11]) {
      const exact = grossUpForFee(base, pct);
      for (const mode of ALL_MODES) {
        const charged = chargedWithFee(ctx(base, mode), pct);
        // Único desconto tolerado: o meio centavo do round2 final (ver abaixo).
        expect(charged).toBeGreaterThanOrEqual(exact - 0.005);
        expect(charged).toBeGreaterThanOrEqual(base);
      }
    }
  });

  it("repasse é neutro a menos do meio centavo do round2 final", () => {
    // O `roundPrice` sempre sobe, mas o `round2` que fecha a conta arredonda ao
    // centavo mais próximo — pode cortar até R$ 0,005 do exato. Aqui 104,71 em
    // vez de 104,7120 deixa o líquido R$ 0,002 abaixo dos R$ 100 do base.
    const charged = chargedWithFee(ctx(100, "exact"), 4.5);
    const net = charged * (1 - 0.045);
    expect(net).toBeLessThan(100);
    expect(net).toBeGreaterThan(100 - 0.005);
  });

  it("preço zero, negativo ou inválido devolve 0 em qualquer modo", () => {
    for (const mode of ALL_MODES) {
      expect(chargedWithFee(ctx(0, mode), 4.5)).toBe(0);
      expect(chargedWithFee(ctx(-10, mode), 4.5)).toBe(0);
      expect(chargedWithFee(ctx(Number.NaN, mode), 4.5)).toBe(0);
    }
  });

  it("taxa absurda é clampada em 95% (não explode o gross-up)", () => {
    // O clamp mora no `feeFraction`: 100 / (1 − 0,95) = 2000, e não infinito.
    expect(chargedWithFee(ctx(100, "exact"), 95)).toBe(2000);
    expect(chargedWithFee(ctx(100, "exact"), 200)).toBe(2000);
  });

  it("mais taxa nunca cobra menos do cliente (monotônico)", () => {
    const anterior = ALL_MODES.map(() => 0);
    for (const pct of [0, 1, 2.5, 4.5, 6.11, 12]) {
      ALL_MODES.forEach((mode, i) => {
        const charged = chargedWithFee(ctx(37.45, mode), pct);
        expect(charged).toBeGreaterThanOrEqual(anterior[i]);
        anterior[i] = charged;
      });
    }
  });
});
