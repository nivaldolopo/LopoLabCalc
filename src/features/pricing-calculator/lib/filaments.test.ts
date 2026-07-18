import { describe, expect, it } from "vitest";
import {
  filamentTotalG,
  filamentsMaterialCost,
  filamentsTotalG,
  freezeFilaments,
  makeFilament,
  materialsLabel,
  mergeFilaments,
  normalizeFilaments,
  stripFilamentIds,
} from "./filaments";
import type { StockFilament } from "../types";

describe("filaments — makeFilament / totalG", () => {
  it("sem detalhamento, o Total é o informado", () => {
    const f = makeFilament({ totalG: 40, pricePerKg: 110 });
    expect(f.totalG).toBe(40);
    expect(f.modelG).toBeUndefined();
    expect(filamentTotalG(f)).toBe(40);
  });

  it("com detalhamento, o Total trava na soma model+suporte+purga+torre", () => {
    const f = makeFilament({
      modelG: 88,
      supportG: 24,
      purgedG: 68,
      towerG: 10,
      totalG: 5,
    });
    // O totalG informado (5) é ignorado: soma = 190.
    expect(f.totalG).toBe(190);
    expect(filamentTotalG(f)).toBe(190);
  });

  it("detalhar sem campo de suporte é como suporte 0", () => {
    const f = makeFilament({ modelG: 88, purgedG: 68, towerG: 10, totalG: 5 });
    expect(f.totalG).toBe(166);
    expect(f.supportG).toBeUndefined();
  });

  it("filamentTotalG cai na soma do detalhe quando totalG não veio", () => {
    const f: ReturnType<typeof makeFilament> = {
      filamentId: null,
      colorName: "",
      pricePerKg: 100,
      totalG: 0,
      modelG: 10,
      supportG: 3,
      purgedG: 5,
      towerG: 0,
    };
    expect(filamentTotalG(f)).toBe(18);
  });
});

describe("filaments — normalizeFilaments (migração legado)", () => {
  it("usa o array quando presente", () => {
    const out = normalizeFilaments({
      filaments: [
        makeFilament({ totalG: 30, pricePerKg: 90, colorName: "Preto" }),
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].totalG).toBe(30);
  });

  it("migra os escalares legados para uma cor única", () => {
    const out = normalizeFilaments({ weightG: 40, filamentPricePerKg: 110 });
    expect(out).toHaveLength(1);
    expect(out[0].totalG).toBe(40);
    expect(out[0].pricePerKg).toBe(110);
    // O peso legado já era o TOTAL (com torre/purga) → sem detalhamento fingido.
    expect(out[0].modelG).toBeUndefined();
  });
});

describe("filaments — custo e agregação", () => {
  it("custo de material soma cada cor (peso × preço)", () => {
    const filaments = [
      makeFilament({ totalG: 40, pricePerKg: 110 }),
      makeFilament({ totalG: 20, pricePerKg: 200 }),
    ];
    expect(filamentsTotalG(filaments)).toBe(60);
    // 40/1000*110 + 20/1000*200 = 4,4 + 4 = 8,4
    expect(filamentsMaterialCost(filaments)).toBeCloseTo(8.4, 6);
  });

  it("mergeFilaments junta a mesma cor/preço somando pesos", () => {
    const merged = mergeFilaments([
      makeFilament({ colorName: "Preto", totalG: 40, pricePerKg: 110 }),
      makeFilament({ colorName: "preto", totalG: 20, pricePerKg: 110 }),
      makeFilament({ colorName: "Vermelho", totalG: 10, pricePerKg: 110 }),
    ]);
    expect(merged).toHaveLength(2);
    const preto = merged.find((f) => f.colorName.toLowerCase() === "preto");
    expect(preto?.totalG).toBe(60);
  });
});

describe("filaments — stripFilamentIds (persistência)", () => {
  it("remove id e OMITE campos de detalhe ausentes (Firestore)", () => {
    const [clean] = stripFilamentIds([
      makeFilament({ id: "fil_1", totalG: 40, pricePerKg: 110 }),
    ]);
    expect(clean.id).toBeUndefined();
    expect("modelG" in clean).toBe(false);
    expect("purgedG" in clean).toBe(false);
    expect("towerG" in clean).toBe(false);
    expect(clean.totalG).toBe(40);
  });

  it("mantém o detalhe quando presente (inclui suporte)", () => {
    const [clean] = stripFilamentIds([
      makeFilament({
        modelG: 10,
        supportG: 4,
        purgedG: 5,
        towerG: 0,
        pricePerKg: 100,
      }),
    ]);
    expect(clean.modelG).toBe(10);
    expect(clean.supportG).toBe(4);
    expect(clean.totalG).toBe(19);
  });
});

describe("freezeFilaments (D7 — congela material/marca da cor)", () => {
  const stock = [
    {
      id: "preto",
      material: "PLA Basic",
      brand: "Bambu",
      colorName: "Preto",
    } as StockFilament,
  ];

  it("resolve material/marca/nome da cor viva pelo filamentId", () => {
    const [f] = freezeFilaments(
      [{ filamentId: "preto", colorName: "antigo", pricePerKg: 100, totalG: 50 }],
      stock,
    );
    expect(f.material).toBe("PLA Basic");
    expect(f.brand).toBe("Bambu");
    expect(f.colorName).toBe("Preto"); // nome atualizado da cor
    expect(f.totalG).toBe(50);
  });

  it("avulso (sem filamentId) fica sem material", () => {
    const [f] = freezeFilaments(
      [{ filamentId: null, colorName: "Verde", pricePerKg: 90, totalG: 30 }],
      stock,
    );
    expect(f.material).toBeUndefined();
    expect(f.brand).toBeUndefined();
    expect(f.colorName).toBe("Verde");
  });

  it("cor removida do Estoque cai no fallback (sem material), sem quebrar", () => {
    const [f] = freezeFilaments(
      [{ filamentId: "sumida", colorName: "X", pricePerKg: 100, totalG: 10 }],
      stock,
    );
    expect(f.material).toBeUndefined();
    expect(f.colorName).toBe("X");
  });
});

describe("materialsLabel (D8 — material derivado)", () => {
  it("junta materiais distintos por ' · '", () => {
    expect(
      materialsLabel([
        { filamentId: null, colorName: "", pricePerKg: 0, totalG: 1, material: "PLA" },
        { filamentId: null, colorName: "", pricePerKg: 0, totalG: 1, material: "PETG" },
      ]),
    ).toBe("PLA · PETG");
  });

  it("deduplica case-insensitive, preservando a 1ª grafia", () => {
    expect(
      materialsLabel([
        { filamentId: null, colorName: "", pricePerKg: 0, totalG: 1, material: "PLA" },
        { filamentId: null, colorName: "", pricePerKg: 0, totalG: 1, material: "pla" },
      ]),
    ).toBe("PLA");
  });

  it("vazio quando nenhuma cor tem material (avulso)", () => {
    expect(
      materialsLabel([{ filamentId: null, colorName: "", pricePerKg: 0, totalG: 1 }]),
    ).toBe("");
  });
});
