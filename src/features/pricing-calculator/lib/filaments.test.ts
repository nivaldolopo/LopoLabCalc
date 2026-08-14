import { describe, expect, it } from "vitest";
import {
  colorKeyOf,
  filamentTotalG,
  filamentsMaterialCost,
  filamentsTotalG,
  freezeFilaments,
  makeFilament,
  materialsLabel,
  mergeFilaments,
  NO_COLOR_KEY,
  NO_COLOR_LABEL,
  normalizeFilaments,
  stripFilamentIds,
} from "./filaments";
import type { FilamentUsage, StockFilament } from "../types";

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

describe("colorKeyOf (FEAT-11 — identidade de cor da peça)", () => {
  const cor = (
    filamentId: string | null,
    colorName: string,
    totalG = 10,
  ): FilamentUsage => ({ filamentId, colorName, pricePerKg: 110, totalG });

  it("uma cor do estoque: a chave é o filamentId, o rótulo é o nome", () => {
    expect(colorKeyOf([cor("fil_azul", "Azul")])).toEqual({
      key: "fil_azul",
      label: "Azul",
    });
  });

  it("a chave segue o id, não o nome — renomear a cor não parte o saldo", () => {
    expect(colorKeyOf([cor("fil_azul", "Azul Bebê")]).key).toBe(
      colorKeyOf([cor("fil_azul", "Azul Claro")]).key,
    );
  });

  it("peça bicolor vira chave COMPOSTA (decisão do dono), não a cor dominante", () => {
    const composta = colorKeyOf([cor("fil_azul", "Azul", 90), cor("fil_branco", "Branco", 5)]);
    expect(composta.key).toBe("fil_azul+fil_branco");
    expect(composta.label).toBe("Azul + Branco");
    expect(composta.key).not.toBe(colorKeyOf([cor("fil_azul", "Azul")]).key);
  });

  it("ordem canônica: a ordem das etapas no cadastro não gera duas SKUs", () => {
    expect(colorKeyOf([cor("fil_branco", "Branco"), cor("fil_azul", "Azul")])).toEqual(
      colorKeyOf([cor("fil_azul", "Azul"), cor("fil_branco", "Branco")]),
    );
  });

  it("duas etapas na MESMA cor colapsam (não vira 'Azul + Azul')", () => {
    expect(colorKeyOf([cor("fil_azul", "Azul"), cor("fil_azul", "Azul")])).toEqual({
      key: "fil_azul",
      label: "Azul",
    });
  });

  it("linha zerada não pinta a peça (0 g fica de fora da chave)", () => {
    expect(colorKeyOf([cor("fil_azul", "Azul"), cor("fil_branco", "Branco", 0)]).key).toBe(
      "fil_azul",
    );
  });

  it("avulso entra pelo nome normalizado, com prefixo que não colide com id", () => {
    const key = colorKeyOf([cor(null, "Azul Bebê")]).key;
    expect(key).toBe("livre:azul-bebe");
    expect(colorKeyOf([cor(null, "  azul bebe ")]).key).toBe(key);
  });

  it("nome avulso com '+' não forja uma chave composta", () => {
    const forjada = colorKeyOf([cor(null, "Azul+Branco")]);
    expect(forjada.key).toBe("livre:azul-branco");
    expect(forjada.key.split("+")).toHaveLength(1);
  });

  it("mistura estoque + avulso na mesma peça", () => {
    const mista = colorKeyOf([cor("fil_azul", "Azul"), cor(null, "Dourado")]);
    expect(mista.key).toBe("fil_azul+livre:dourado");
    expect(mista.label).toBe("Azul + Dourado");
  });

  it("sem cor identificável cai na sentinela (avulso sem nome, lista vazia)", () => {
    const nada = { key: NO_COLOR_KEY, label: NO_COLOR_LABEL };
    expect(colorKeyOf([])).toEqual(nada);
    expect(colorKeyOf([cor(null, "")])).toEqual(nada);
    expect(colorKeyOf([cor("fil_azul", "Azul", 0)])).toEqual(nada);
  });
});
