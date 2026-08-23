import { describe, expect, it } from "vitest";
import { colorIdTable, supplyIdTable } from "./idTable";
import type { StockFilament, Supply } from "../types";

const cor = (over: Partial<StockFilament>): StockFilament =>
  ({
    id: "cor_1",
    colorName: "Laranja",
    material: "PLA",
    brand: "Bambu",
    minG: 0,
    archived: false,
    rolls: [],
    adjustments: [],
    ...over,
  }) as unknown as StockFilament;

const insumo = (over: Partial<Supply>): Supply =>
  ({
    id: "sup_1",
    name: "Argola",
    unit: "un",
    minQty: 0,
    archived: false,
    lots: [],
    adjustments: [],
    ...over,
  }) as unknown as Supply;

describe("idTable — o de-para que a carga em massa precisa", () => {
  it("cores: cabeçalho + uma linha por cor, separado por TAB", () => {
    const linhas = colorIdTable([
      cor({ id: "4MKTY5K6OGldKp0zDZNB" }),
      cor({ id: "nTpe34KAcIQf4rxhmYjL", colorName: "Preto", material: "PETG", brand: "Voolt" }),
    ]).split("\n");

    expect(linhas[0]).toBe("Cor\tMaterial\tMarca\tArquivada\tid");
    expect(linhas[1]).toBe("Laranja\tPLA\tBambu\tnao\t4MKTY5K6OGldKp0zDZNB");
    expect(linhas[2]).toBe("Preto\tPETG\tVoolt\tnao\tnTpe34KAcIQf4rxhmYjL");
  });

  it("material e marca vão junto: é o que desempata cor de nome repetido", () => {
    const t = colorIdTable([
      cor({ id: "a", material: "PLA", brand: "Bambu" }),
      cor({ id: "b", material: "PETG", brand: "Voolt" }),
    ]);
    // Mesmo `colorName` nas duas — sem as colunas do meio, a tabela seria cega.
    expect(t).toContain("Laranja\tPLA\tBambu\tnao\ta");
    expect(t).toContain("Laranja\tPETG\tVoolt\tnao\tb");
  });

  it("arquivada entra MARCADA, não sumida", () => {
    expect(colorIdTable([cor({ archived: true })])).toContain("\tsim\tcor_1");
  });

  it("campo vazio vira célula vazia, sem desalinhar a coluna", () => {
    const linha = colorIdTable([cor({ material: undefined, brand: undefined })]).split("\n")[1];
    expect(linha).toBe("Laranja\t\t\tnao\tcor_1");
    expect(linha.split("\t")).toHaveLength(5);
  });

  it("TAB ou quebra de linha no nome não quebram a colagem em colunas", () => {
    const linha = colorIdTable([cor({ colorName: "Azul\tBebê\nclaro" })]).split("\n")[1];
    expect(linha.split("\t")).toHaveLength(5);
    expect(linha).toContain("Azul Bebê claro");
  });

  it("lista vazia devolve só o cabeçalho", () => {
    expect(colorIdTable([])).toBe("Cor\tMaterial\tMarca\tArquivada\tid");
  });

  it("insumos: mesma forma, com unidade no lugar de material/marca", () => {
    const linhas = supplyIdTable([
      insumo({ id: "sup_ima", name: "Ímã 8mm", unit: "un" }),
      insumo({ id: "sup_caixa", name: "Caixa", unit: "cx", archived: true }),
    ]).split("\n");

    expect(linhas[0]).toBe("Insumo\tUnidade\tArquivado\tid");
    expect(linhas[1]).toBe("Ímã 8mm\tun\tnao\tsup_ima");
    expect(linhas[2]).toBe("Caixa\tcx\tsim\tsup_caixa");
  });
});
