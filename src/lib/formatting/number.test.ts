import { describe, expect, it } from "vitest";
import { isMilharAmbiguo, parseDecimalPtBr } from "./number";

describe("parseDecimalPtBr", () => {
  it("lê o pt-BR do dia a dia", () => {
    expect(parseDecimalPtBr("1,5")).toBe(1.5);
    expect(parseDecimalPtBr("143,53")).toBe(143.53);
    expect(parseDecimalPtBr("200,00")).toBe(200);
    expect(parseDecimalPtBr("-12,50")).toBe(-12.5);
  });

  it("lê o ponto decimal — é o que o próprio export escreve", () => {
    expect(parseDecimalPtBr("2.375")).toBe(2.375);
    expect(parseDecimalPtBr("27.14")).toBe(27.14);
    expect(parseDecimalPtBr("0.8")).toBe(0.8);
  });

  it("descarta moeda, espaço comum e os espaços do Excel", () => {
    expect(parseDecimalPtBr("R$ 118,90")).toBe(118.9);
    expect(parseDecimalPtBr("1 234,56")).toBe(1234.56);
    expect(parseDecimalPtBr("1 234,56")).toBe(1234.56);
    expect(parseDecimalPtBr("1 234,56")).toBe(1234.56);
  });

  it("CSV-08: com os DOIS separadores, o ÚLTIMO é o decimal", () => {
    // pt-BR
    expect(parseDecimalPtBr("1.234,56")).toBe(1234.56);
    // en-US — o Google Sheets em locale americano. Antes virava 1.23456.
    expect(parseDecimalPtBr("1,234.56")).toBe(1234.56);
    expect(parseDecimalPtBr("1,234,567.89")).toBe(1234567.89);
    expect(parseDecimalPtBr("1.234.567,89")).toBe(1234567.89);
  });

  it("CSV-08: separador REPETIDO só pode ser milhar", () => {
    // Antes o parseFloat truncava em 1.234.
    expect(parseDecimalPtBr("1.234.567")).toBe(1234567);
    expect(parseDecimalPtBr("1,234,567")).toBe(1234567);
  });

  it("devolve null — não 0 — para o que não é número", () => {
    expect(parseDecimalPtBr("")).toBeNull();
    expect(parseDecimalPtBr("   ")).toBeNull();
    expect(parseDecimalPtBr(null)).toBeNull();
    expect(parseDecimalPtBr(undefined)).toBeNull();
    expect(parseDecimalPtBr("abc")).toBeNull();
    expect(parseDecimalPtBr("R$")).toBeNull();
    expect(parseDecimalPtBr(NaN)).toBeNull();
    expect(parseDecimalPtBr(Infinity)).toBeNull();
  });

  it("zero é zero, e não se confunde com ilegível", () => {
    expect(parseDecimalPtBr("0")).toBe(0);
    expect(parseDecimalPtBr("0,00")).toBe(0);
    expect(parseDecimalPtBr(0)).toBe(0);
  });

  it("número já numérico passa direto", () => {
    expect(parseDecimalPtBr(143.53)).toBe(143.53);
    expect(parseDecimalPtBr(-2)).toBe(-2);
  });
});

describe("isMilharAmbiguo", () => {
  it("CSV-07: acende no que é estruturalmente ambíguo", () => {
    expect(isMilharAmbiguo("1.234")).toBe(true);
    expect(isMilharAmbiguo("999.000")).toBe(true);
    // "2.375" é ambíguo do MESMO jeito — ler a estrutura não distingue os dois,
    // e é por isso que quem decide se vale avisar é a COLUNA (ver productCsv).
    expect(isMilharAmbiguo("2.375")).toBe(true);
  });

  it("CSV-07: acende MESMO com prefixo de moeda — o cru quebrava a âncora `^`", () => {
    expect(isMilharAmbiguo("R$ 1.234")).toBe(true);
    expect(isMilharAmbiguo(" 1.234 ")).toBe(true);
    expect(isMilharAmbiguo("R$ 1.234,00")).toBe(false);
  });

  it("não acende no que não tem a forma", () => {
    expect(isMilharAmbiguo("27.14")).toBe(false);
    expect(isMilharAmbiguo("1.5")).toBe(false);
    expect(isMilharAmbiguo("1.234,56")).toBe(false);
    expect(isMilharAmbiguo("143,53")).toBe(false);
    expect(isMilharAmbiguo("1.2345")).toBe(false);
  });
});
