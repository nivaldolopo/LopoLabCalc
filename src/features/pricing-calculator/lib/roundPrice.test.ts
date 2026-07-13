import { describe, expect, it } from "vitest";
import { roundPrice } from "./roundPrice";

describe("roundPrice", () => {
  it("modo exato devolve o valor sem tocar", () => {
    expect(roundPrice(35.807, "exact")).toBe(35.807);
  });

  it("nunca arredonda para baixo (sempre teto)", () => {
    // 35,8 -> múltiplo de 5 acima é 40, nunca 35.
    expect(roundPrice(35.8, "5")).toBe(40);
    expect(roundPrice(35.8, "10")).toBe(40);
    expect(roundPrice(35.8, "1")).toBe(36);
    expect(roundPrice(35.2, "0.5")).toBe(35.5);
  });

  it("valor já no passo não sobe por ruído de ponto flutuante", () => {
    // Sem o EPSILON, 40 viraria 45.
    expect(roundPrice(40, "5")).toBe(40);
    expect(roundPrice(35, "1")).toBe(35);
  });

  it("final ,90: abaixo do ,90 do inteiro cai no próprio ,90", () => {
    expect(roundPrice(35.8, "0.90")).toBeCloseTo(35.9, 6);
    expect(roundPrice(35, "0.90")).toBeCloseTo(35.9, 6);
  });

  it("final ,90: acima do ,90 pula para o próximo ,90", () => {
    expect(roundPrice(35.95, "0.90")).toBeCloseTo(36.9, 6);
  });

  it("valores não positivos ou inválidos passam direto", () => {
    expect(roundPrice(0, "5")).toBe(0);
    expect(roundPrice(-5, "5")).toBe(-5);
    expect(roundPrice(Number.NaN, "5")).toBeNaN();
    expect(roundPrice(Number.POSITIVE_INFINITY, "5")).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});
