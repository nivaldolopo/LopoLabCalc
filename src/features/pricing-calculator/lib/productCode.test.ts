import { describe, expect, it } from "vitest";
import { formatProductCode, parseProductCode } from "./productCode";

describe("S2 — código do produto", () => {
  it("formata com 4 dígitos e passa de 9999 sem quebrar", () => {
    expect(formatProductCode(1)).toBe("LL-0001");
    expect(formatProductCode(42)).toBe("LL-0042");
    expect(formatProductCode(10000)).toBe("LL-10000");
  });

  it("lê de forma tolerante", () => {
    for (const texto of ["LL-0042", "LL0042", "ll-42", "LL_42", "LL 42", "  ll-0042  "]) {
      expect(parseProductCode(texto)).toBe("LL-0042");
    }
  });

  it("acha o código no meio do nome do projeto", () => {
    expect(parseProductCode("LL-0042 Quatto face")).toBe("LL-0042");
    expect(parseProductCode("Quatto face (LL-42).3mf")).toBe("LL-0042");
    expect(parseProductCode("Quatto_LL0042_v2")).toBe("LL-0042");
  });

  it("não inventa código", () => {
    expect(parseProductCode("ALL-42")).toBeNull();
    expect(parseProductCode("LL-42abc")).toBeNull();
    // Número que continua é versão, não código.
    expect(parseProductCode("LL-3.2 bracket")).toBeNull();
    expect(parseProductCode("LL-0042-7")).toBeNull();
    // …mas pontuação de frase depois do código não atrapalha.
    expect(parseProductCode("Quatto (LL-42).")).toBe("LL-0042");
    expect(parseProductCode("LL-0000")).toBeNull();
    expect(parseProductCode("Quatto face")).toBeNull();
    expect(parseProductCode("")).toBeNull();
    expect(parseProductCode(null)).toBeNull();
  });
});
