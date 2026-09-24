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
      material: "",
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

  // Refinamento do Item 1 (2026-09-20) — `brand` virou texto livre do
  // CADASTRO (não só do snapshot da venda).
  it("persiste a marca digitada, mesmo sem link (rótulo só)", () => {
    const [clean] = stripFilamentIds([
      makeFilament({ colorName: "Preto", material: "PLA", brand: "Bambu", totalG: 40 }),
    ]);
    expect(clean.brand).toBe("Bambu");
  });

  it("marca vazia/em branco não entra no documento", () => {
    const [semMarca] = stripFilamentIds([
      makeFilament({ colorName: "Preto", material: "PLA", brand: "", totalG: 40 }),
    ]);
    expect("brand" in semMarca).toBe(false);
    const [comEspaco] = stripFilamentIds([
      makeFilament({ colorName: "Preto", material: "PLA", brand: "   ", totalG: 40 }),
    ]);
    expect("brand" in comEspaco).toBe(false);
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
      [
        {
          filamentId: "preto",
          colorName: "antigo",
          material: "ignorado",
          pricePerKg: 100,
          totalG: 50,
        },
      ],
      stock,
    );
    expect(f.material).toBe("PLA Basic");
    expect(f.brand).toBe("Bambu");
    expect(f.colorName).toBe("Preto"); // nome atualizado da cor
    expect(f.totalG).toBe(50);
  });

  // Item 1 — avulso (sem marca fixada) MANTÉM o material que já veio no
  // cadastro (obrigatório desde o Item 1); só não ganha `brand` (não há marca
  // ligada de onde tirar uma).
  it("avulso (sem filamentId) mantém o material do cadastro, sem marca", () => {
    const [f] = freezeFilaments(
      [
        {
          filamentId: null,
          colorName: "Verde",
          material: "PETG",
          pricePerKg: 90,
          totalG: 30,
        },
      ],
      stock,
    );
    expect(f.material).toBe("PETG");
    expect(f.brand).toBeUndefined();
    expect(f.colorName).toBe("Verde");
  });

  it("marca removida do Estoque mantém o material do cadastro, sem quebrar", () => {
    const [f] = freezeFilaments(
      [
        {
          filamentId: "sumida",
          colorName: "X",
          material: "ABS",
          pricePerKg: 100,
          totalG: 10,
        },
      ],
      stock,
    );
    expect(f.material).toBe("ABS");
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
      materialsLabel([
        { filamentId: null, colorName: "", material: "", pricePerKg: 0, totalG: 1 },
      ]),
    ).toBe("");
  });
});

describe("colorKeyOf (FEAT-11 + S11 — identidade de cor da peça)", () => {
  const cor = (
    filamentId: string | null,
    colorName: string,
    totalG = 10,
    material = "PLA",
  ): FilamentUsage => ({
    filamentId,
    colorName,
    material,
    pricePerKg: 110,
    totalG,
  });

  it("uma cor: a chave é material + cor, o rótulo é 'Cor Material'", () => {
    expect(colorKeyOf([cor("fil_azul", "Azul")])).toEqual({
      key: "cor:pla:azul",
      label: "Azul PLA",
    });
  });

  it("S11: a MARCA não parte a prateleira — duas marcas de Preto PLA são um saldo só", () => {
    expect(colorKeyOf([cor("fil_preto_bambu", "Preto")]).key).toBe(
      colorKeyOf([cor("fil_preto_sunlu", "Preto")]).key,
    );
  });

  it("S11: ligada ao Estoque ou avulsa, a mesma cor+material é a mesma prateleira", () => {
    expect(colorKeyOf([cor("fil_azul", "Azul")])).toEqual(colorKeyOf([cor(null, "Azul")]));
  });

  it("S11: o MATERIAL separa — PLA preto e PETG preto são duas prateleiras (também no avulso)", () => {
    expect(colorKeyOf([cor(null, "Preto", 10, "PLA")]).key).not.toBe(
      colorKeyOf([cor(null, "Preto", 10, "PETG")]).key,
    );
    expect(colorKeyOf([cor("fil_a", "Preto", 10, "PLA")]).key).not.toBe(
      colorKeyOf([cor("fil_b", "Preto", 10, "PETG")]).key,
    );
  });

  it("tolerante a acento, caixa e espaço (a mesma régua do agrupamento do Estoque)", () => {
    const key = colorKeyOf([cor(null, "Azul Bebê", 10, "PLA")]).key;
    expect(key).toBe("cor:pla:azul-bebe");
    expect(colorKeyOf([cor("fil_x", "  azul bebe ", 10, "pla")]).key).toBe(key);
  });

  it("sem material: a chave fica com o material vazio e o rótulo é só a cor", () => {
    expect(colorKeyOf([cor(null, "Dourado", 10, "")])).toEqual({
      key: "cor::dourado",
      label: "Dourado",
    });
  });

  it("peça bicolor vira chave COMPOSTA (decisão do dono), não a cor dominante", () => {
    const composta = colorKeyOf([cor("fil_azul", "Azul", 90), cor("fil_branco", "Branco", 5)]);
    expect(composta.key).toBe("cor:pla:azul+cor:pla:branco");
    expect(composta.label).toBe("Azul PLA + Branco PLA");
    expect(composta.key).not.toBe(colorKeyOf([cor("fil_azul", "Azul")]).key);
  });

  it("ordem canônica: a ordem das etapas no cadastro não gera duas SKUs", () => {
    expect(colorKeyOf([cor("fil_branco", "Branco"), cor("fil_azul", "Azul")])).toEqual(
      colorKeyOf([cor("fil_azul", "Azul"), cor("fil_branco", "Branco")]),
    );
  });

  it("duas etapas na MESMA cor colapsam (não vira 'Azul + Azul'), mesmo em marcas diferentes", () => {
    expect(colorKeyOf([cor("fil_azul", "Azul"), cor("fil_azul_2", "Azul")])).toEqual({
      key: "cor:pla:azul",
      label: "Azul PLA",
    });
  });

  it("linha zerada não pinta a peça (0 g fica de fora da chave)", () => {
    expect(colorKeyOf([cor("fil_azul", "Azul"), cor("fil_branco", "Branco", 0)]).key).toBe(
      "cor:pla:azul",
    );
  });

  it("nome com '+' ou ':' não forja uma chave composta", () => {
    const forjada = colorKeyOf([cor(null, "Azul+Branco:X")]);
    expect(forjada.key).toBe("cor:pla:azul-branco-x");
    expect(forjada.key.split("+")).toHaveLength(1);
  });

  it("ligada ao Estoque sem nome: a cor do Estoque é a identidade, não 'Sem cor'", () => {
    expect(colorKeyOf([cor("fil_azul", "", 10)])).toEqual({
      key: "estoque:fil_azul",
      label: "Cor do estoque",
    });
  });

  it("sem cor identificável cai na sentinela (sem nome, lista vazia, 0 g)", () => {
    const nada = { key: NO_COLOR_KEY, label: NO_COLOR_LABEL };
    expect(colorKeyOf([])).toEqual(nada);
    expect(colorKeyOf([cor(null, "")])).toEqual(nada);
    expect(colorKeyOf([cor("fil_azul", "Azul", 0)])).toEqual(nada);
  });
});
