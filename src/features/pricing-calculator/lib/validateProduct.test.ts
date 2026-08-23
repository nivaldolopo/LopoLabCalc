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

  // CSV-31 — peça é CONTAGEM. A planilha da carga é escrita fora do app, e
  // "1.234" na coluna `Pecas` já acendia o milhar ambíguo; o que faltava era
  // recusar o valor. Arredondar trocaria um número absurdo por um plausível.
  it("peças fracionárias são recusadas", () => {
    expect(validateProduct(makeProduct({ piecesCount: 1.234 }))).toContain(
      "inteiro",
    );
    expect(validateProduct(makeProduct({ piecesCount: 2.5 }))).toContain(
      "inteiro",
    );
  });

  it("peças inteiras passam — inclusive 0 e o default", () => {
    expect(validateProduct(makeProduct({ piecesCount: 1 }))).toBeNull();
    expect(validateProduct(makeProduct({ piecesCount: 12 }))).toBeNull();
    // 0 e ausente caem no `num()` e não inventam erro: quem trata o default
    // é o chamador (o CSV escreve `Math.max(1, …)`).
    expect(validateProduct(makeProduct({ piecesCount: 0 }))).toBeNull();
  });

  it("markup deve ser no mínimo 1x", () => {
    expect(validateProduct(makeProduct({ markup: 0.9 }))).toContain("markup");
    expect(validateProduct(makeProduct({ markup: 1 }))).toBeNull();
  });

  it("pega valores negativos em etapas extras", () => {
    const erro = validateProduct(
      makeProduct({
        stages: [
          {
            machineId: "a1",
            weightG: 10,
            printHours: 1,
            filamentPricePerKg: 100,
            laborMinutes: -5,
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

  it("subitens: exige nome e ao menos uma etapa; aceita válido (FEAT-01)", () => {
    // Sem subitem com o modo ligado.
    expect(
      validateProduct(makeProduct({ sellBySubitems: true, subitems: [] })),
    ).toContain("ao menos um subitem");
    // Subitem sem nome.
    expect(
      validateProduct(
        makeProduct({
          sellBySubitems: true,
          subitems: [{ id: "A", name: "", stageKeys: ["main"] }],
        }),
      ),
    ).toContain("nome");
    // Subitem sem etapa.
    expect(
      validateProduct(
        makeProduct({
          sellBySubitems: true,
          subitems: [{ id: "A", name: "Base", stageKeys: [] }],
        }),
      ),
    ).toContain("etapa");
    // Markup override abaixo de 1.
    expect(
      validateProduct(
        makeProduct({
          sellBySubitems: true,
          subitems: [{ id: "A", name: "Base", stageKeys: ["main"], markup: 0.5 }],
        }),
      ),
    ).toContain("markup");
    // Válido.
    expect(
      validateProduct(
        makeProduct({
          sellBySubitems: true,
          subitems: [{ id: "A", name: "Base", stageKeys: ["main"] }],
        }),
      ),
    ).toBeNull();
    // Modo desligado ignora subitens malformados.
    expect(
      validateProduct(
        makeProduct({
          sellBySubitems: false,
          subitems: [{ id: "A", name: "", stageKeys: [] }],
        }),
      ),
    ).toBeNull();
  });
});
