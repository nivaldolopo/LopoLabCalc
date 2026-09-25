import { describe, expect, it } from "vitest";
import {
  eventImages,
  isSafeTaskId,
  parsePrintImageFileName,
  printImagePath,
} from "./printImages";

describe("printImagePath (S5)", () => {
  it("monta o caminho que a regra do Storage libera", () => {
    expect(printImagePath("1214307195", "capa")).toBe("impressoes/1214307195/capa.png");
    expect(printImagePath("1214307195", "foto")).toBe("impressoes/1214307195/foto.jpg");
  });

  it("recusa task_id que mudaria de pasta — nunca 'limpa'", () => {
    for (const ruim of ["", "../x", "a/b", "a.b", " 12", "12 "]) {
      expect(isSafeTaskId(ruim)).toBe(false);
      expect(() => printImagePath(ruim, "capa")).toThrow();
    }
  });
});

describe("parsePrintImageFileName — o nome que o pipeline exporta", () => {
  it("lê capa e foto", () => {
    expect(parsePrintImageFileName("1214307195_capa.png")).toEqual({
      taskId: "1214307195",
      kind: "capa",
    });
    expect(parsePrintImageFileName("1214307195_foto.jpg")).toEqual({
      taskId: "1214307195",
      kind: "foto",
    });
    expect(parsePrintImageFileName("1214307195_FOTO.JPEG")).toEqual({
      taskId: "1214307195",
      kind: "foto",
    });
  });

  it("extensão trocada é arquivo errado, não 'quase certo'", () => {
    expect(parsePrintImageFileName("1_capa.jpg")).toBeNull();
    expect(parsePrintImageFileName("1_foto.png")).toBeNull();
  });

  it("qualquer outro arquivo da pasta é ignorado", () => {
    expect(parsePrintImageFileName("producao.json")).toBeNull();
    expect(parsePrintImageFileName("1_topo.png")).toBeNull();
    expect(parsePrintImageFileName("a.b_capa.png")).toBeNull();
  });
});

describe("eventImages", () => {
  it("sem mídia nenhuma é null, não {null, null}", () => {
    expect(eventImages("1", { capa: false, foto: false })).toBeNull();
  });

  it("só a capa (A1 nunca tem foto)", () => {
    expect(eventImages("1", { capa: true, foto: false })).toEqual({
      capa: "impressoes/1/capa.png",
      foto: null,
    });
  });
});
