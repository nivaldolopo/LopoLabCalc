import { describe, expect, it } from "vitest";
import {
  MARGIN_TIER_CUTS,
  marginTier,
  marginTierClass,
  marginTierTitle,
} from "./marginTier";

describe("marginTier", () => {
  it("as bordas seguem a DEC-04 ao pé da letra: <50 ruim · 50–65 ok · >65 bom", () => {
    // O corte inferior é FECHADO em 50 — 49 ainda é ruim, 50 já é ok.
    expect(marginTier(49)).toBe("bad");
    expect(marginTier(50)).toBe("ok");
    // O superior também: 65 ainda é ok, "bom" começa ACIMA de 65.
    expect(marginTier(65)).toBe("ok");
    expect(marginTier(66)).toBe("good");
  });

  it("a faixa é do número ARREDONDADO — o mesmo que a tela mostra", () => {
    // Sem isso, os dois abaixo aparecem como "65%" com cores diferentes.
    expect(marginTier(65.4)).toBe("ok");
    expect(marginTier(65.6)).toBe("good");
    // Idem no corte de baixo: 49,6 vira "50%" na tela, então é ok.
    expect(marginTier(49.4)).toBe("bad");
    expect(marginTier(49.6)).toBe("ok");
  });

  it("cobre a faixa real do catálogo (49% a 72%) nas três cores", () => {
    // O motivo dos cortes da DEC-04: distribuir o catálogo atual em 3 faixas
    // em vez de pintar tudo de uma cor só.
    expect(marginTier(49)).toBe("bad");
    expect(marginTier(58)).toBe("ok");
    expect(marginTier(72)).toBe("good");
  });

  it("prejuízo e zero caem na faixa ruim", () => {
    expect(marginTier(0)).toBe("bad");
    expect(marginTier(-30)).toBe("bad");
  });

  it("valor não-finito não tem faixa (recibo com receita 0 gera NaN)", () => {
    expect(marginTier(Number.NaN)).toBeNull();
    expect(marginTier(Number.POSITIVE_INFINITY)).toBeNull();
    expect(marginTier(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it("os cortes ficam numa constante só, não em literais espalhados", () => {
    expect(MARGIN_TIER_CUTS.ok).toBe(50);
    expect(MARGIN_TIER_CUTS.good).toBe(65);
  });
});

describe("marginTierClass", () => {
  it("devolve a classe do base.css por faixa", () => {
    expect(marginTierClass(30)).toBe("margin-bad");
    expect(marginTierClass(55)).toBe("margin-ok");
    expect(marginTierClass(80)).toBe("margin-good");
  });

  it("sem faixa devolve string vazia — o elemento herda a cor de sempre", () => {
    expect(marginTierClass(Number.NaN)).toBe("");
  });
});

describe("marginTierTitle", () => {
  it("nomeia a faixa e mostra a régua inteira (a cor não pode ser o único sinal)", () => {
    expect(marginTierTitle(80)).toContain("boa");
    expect(marginTierTitle(80)).toContain("50");
    expect(marginTierTitle(80)).toContain("65");
    expect(marginTierTitle(30)).toContain("baixa");
  });

  it("sem faixa não tem tooltip", () => {
    expect(marginTierTitle(Number.NaN)).toBe("");
  });
});
