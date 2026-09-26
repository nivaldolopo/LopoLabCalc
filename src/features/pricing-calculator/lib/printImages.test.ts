import { describe, expect, it } from "vitest";
import {
  eventImages,
  isSafeTaskId,
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
