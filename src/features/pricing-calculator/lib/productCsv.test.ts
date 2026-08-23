import { describe, expect, it } from "vitest";
import { exportProductsCsv, parseProductsCsv } from "./productCsv";
import type {
  FixedCostSettings,
  Machine,
  ProductPayload,
  SavedProduct,
} from "../types";

// Máquinas e custo fixo de apoio — o export precisa deles para calcular as
// colunas de resultado (que são resumo humano, não entram no round-trip).
const machines: Machine[] = [
  {
    id: "a1",
    name: "A1 Combo",
    price: 3000,
    lifeHours: 5000,
    watts: 95,
    maintenancePerHour: 0.2,
  },
  {
    id: "x2d",
    name: "X2D Combo",
    price: 9000,
    lifeHours: 8000,
    watts: 150,
    maintenancePerHour: 0.35,
  },
];

const fixedCosts: FixedCostSettings = {
  enabled: true,
  rent: 800,
  other: 200,
  machines: 2,
  hoursDay: 20,
  daysMonth: 26,
};

// Produto RICO de propósito: é o caso que exercita todo o formato de uma vez —
// multicolor com cor do estoque E cor avulsa, duas etapas extras em máquinas
// diferentes (cada uma com suas cores), acessório ligado a insumo E avulso,
// subitens com override de markup, e os 3 links. Se o round-trip preserva este,
// preserva qualquer um.
function makeProduct(overrides: Partial<SavedProduct> = {}): SavedProduct {
  return {
    id: "p1",
    name: "Vaso Espiral; Grande",
    mainStageName: "CORPO PRINCIPAL",
    machineId: "x2d",
    printHours: 3.8,
    piecesCount: 2,
    energyTariff: 0.92,
    laborMinutes: 10,
    laborRate: 30,
    markup: 2.8,
    failureRate: 7,
    includeFixed: true,
    roundingMode: "0.90",
    filaments: [
      {
        filamentId: "sc9LAy9TUcbslnZpEZLb",
        colorName: "PLA · Bege · Bambu",
        pricePerKg: 41,
        totalG: 40,
        modelG: 30,
        supportG: 3,
        purgedG: 5,
        towerG: 2,
      },
      {
        filamentId: null,
        colorName: "cor avulsa",
        pricePerKg: 110,
        totalG: 15,
      },
    ],
    stages: [
      {
        id: "stage_1784581966745_0",
        name: "ETAPA2",
        machineId: "a1",
        printHours: 0.9,
        laborMinutes: 5,
        filaments: [
          {
            filamentId: "US6B9aheebWtn9NMXhUQ",
            colorName: "PLA · Laranja · Bambu",
            pricePerKg: 85,
            totalG: 11,
          },
        ],
      },
      {
        id: "stage_1784334659661_1",
        name: "Etapa 3",
        machineId: "x2d",
        printHours: 1.5,
        laborMinutes: 3,
        filaments: [
          {
            filamentId: null,
            colorName: "cor avulsa 2",
            pricePerKg: 110,
            totalG: 15,
          },
        ],
      },
    ],
    accessories: [
      {
        desc: 'Parafuso 3x12 "inox"',
        qty: 4,
        unitPrice: 0.75,
        supplyId: "SUP_PARAF_1",
        subitemId: "sub_A",
      },
      { desc: "Pintura", qty: 1, unitPrice: 5, supplyId: null, subitemId: null },
    ],
    sellBySubitems: true,
    subitems: [
      { id: "sub_A", name: "Peça base", stageKeys: ["main"], markup: 3.2 },
      {
        id: "sub_B",
        name: "Adorno",
        stageKeys: ["stage_1784581966745_0", "stage_1784334659661_1"],
        markup: 1.9,
      },
    ],
    linkModel: "https://makerworld.com/models/1?a=1&b=2",
    linkCompetitor: "",
    linkFile: "C:/modelos/vaso.3mf",
    fixedCostPerHour: null,
    combineEnabled: null,
    stage2: null,
    createdAt: 1,
    ...overrides,
  };
}

function roundTrip(product: SavedProduct): ProductPayload {
  const csv = exportProductsCsv([product], machines, fixedCosts, []);
  const { products } = parseProductsCsv(csv, machines);
  return products[0];
}

// Campos que NÃO se espera de volta, com o motivo. Tudo o mais tem de voltar
// idêntico — é disso que a carga em massa por CSV depende.
function omitVolatile(payload: ProductPayload | SavedProduct) {
  const copy: Partial<SavedProduct> = { ...payload };
  delete copy.id; // o Firestore dá um novo
  delete copy.createdAt; // carimbo novo a cada import
  delete copy.weightG; // escalar legado, derivado das cores
  delete copy.filamentPricePerKg; // idem
  return copy;
}

describe("productCsv — round-trip", () => {
  it("preserva o produto inteiro, campo a campo", () => {
    const original = makeProduct();
    const copy = roundTrip(original);

    expect(omitVolatile(copy)).toEqual(omitVolatile(original));
  });

  it("mantém o filamentId de cada cor — a ligação com o Estoque", () => {
    const copy = roundTrip(makeProduct());

    expect(copy.filaments?.map((f) => f.filamentId)).toEqual([
      "sc9LAy9TUcbslnZpEZLb",
      null,
    ]);
    // Cor de etapa EXTRA também: é o caminho que mais fácil se perde.
    expect(copy.stages[0].filaments?.[0].filamentId).toBe(
      "US6B9aheebWtn9NMXhUQ",
    );
  });

  it("mantém o detalhamento de refugo (model/suporte/purga/torre)", () => {
    const copy = roundTrip(makeProduct());
    expect(copy.filaments?.[0]).toMatchObject({
      totalG: 40,
      modelG: 30,
      supportG: 3,
      purgedG: 5,
      towerG: 2,
    });
  });

  it("mantém o supplyId do acessório — a baixa de insumo na produção", () => {
    const copy = roundTrip(makeProduct());
    expect(copy.accessories.map((a) => a.supplyId)).toEqual([
      "SUP_PARAF_1",
      null,
    ]);
  });

  it("mantém os subitens, com o override de markup", () => {
    const copy = roundTrip(makeProduct());

    expect(copy.sellBySubitems).toBe(true);
    expect(copy.subitems).toEqual([
      { id: "sub_A", name: "Peça base", stageKeys: ["main"], markup: 3.2 },
      {
        id: "sub_B",
        name: "Adorno",
        stageKeys: ["stage_1784581966745_0", "stage_1784334659661_1"],
        markup: 1.9,
      },
    ]);
  });

  it("mantém os stageKeys apontando para etapas que existem", () => {
    const copy = roundTrip(makeProduct());
    const ids = new Set(["main", ...copy.stages.map((s) => s.id)]);

    for (const subitem of copy.subitems) {
      for (const key of subitem.stageKeys) expect(ids.has(key)).toBe(true);
    }
  });

  it("mantém o subitemId do acessório — o rateio por parte", () => {
    const copy = roundTrip(makeProduct());
    expect(copy.accessories.map((a) => a.subitemId)).toEqual(["sub_A", null]);
  });

  it("sobrevive a ; e aspas no texto", () => {
    const copy = roundTrip(makeProduct());
    expect(copy.name).toBe("Vaso Espiral; Grande");
    expect(copy.accessories[0].desc).toBe('Parafuso 3x12 "inox"');
    expect(copy.linkModel).toBe("https://makerworld.com/models/1?a=1&b=2");
  });

  it("nunca produz `undefined` — o Firestore rejeita a gravação", () => {
    const copy = roundTrip(makeProduct());
    const encontrados: string[] = [];

    (function scan(value: unknown, path: string) {
      if (!value || typeof value !== "object") return;
      for (const [key, item] of Object.entries(value)) {
        if (item === undefined) encontrados.push(`${path}.${key}`);
        else scan(item, `${path}.${key}`);
      }
    })(copy, "payload");

    expect(encontrados).toEqual([]);
  });
});

describe("productCsv — CSV escrito à mão (números em pt-BR)", () => {
  const header = [
    "Produto",
    "Maquina",
    "Peso (g)",
    "Tempo (h)",
    "Pecas",
    "Arredondamento",
    "Markup",
    "Taxa Falha (%)",
    "Filamento (R$/kg)",
    "Tarifa Energia",
    "Mao de obra (min)",
    "Valor-hora (R$)",
    "Inclui Fixo",
    "Etapas JSON",
  ].join(";");

  function linha(overrides: Partial<Record<string, string>> = {}): string {
    const base: Record<string, string> = {
      produto: "Teste",
      maquina: "A1 Combo",
      peso: "143,53",
      tempo: "4,5",
      pecas: "3",
      arredondamento: "0.90",
      markup: "2,8",
      falha: "7",
      filamento: "118",
      energia: "0,92",
      mao: "25",
      hora: "35",
      fixo: "sim",
      etapas: "[]",
      ...overrides,
    };
    const cell = (v: string) =>
      /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    return Object.values(base).map(cell).join(";");
  }

  function importar(row: string) {
    return parseProductsCsv(`${header}\n${row}`, machines).products[0];
  }

  it("lê markup com vírgula decimal (2,8 → 2.8, não 2)", () => {
    expect(importar(linha()).markup).toBe(2.8);
  });

  it("lê markup com ponto decimal e com o sufixo x", () => {
    expect(importar(linha({ markup: "2.8x" })).markup).toBe(2.8);
  });

  it("lê o arredondamento com vírgula decimal (0,90 → 0.90)", () => {
    expect(importar(linha({ arredondamento: "0,90" })).roundingMode).toBe(
      "0.90",
    );
  });

  it("mantém o arredondamento já escrito com ponto", () => {
    expect(importar(linha({ arredondamento: "0.90" })).roundingMode).toBe(
      "0.90",
    );
  });

  it("cai em `exact` quando o arredondamento não é um modo conhecido", () => {
    expect(importar(linha({ arredondamento: "psicologico" })).roundingMode).toBe(
      "exact",
    );
  });

  it("importa etapa sem energyTariff/laborRate, sem gravar undefined", () => {
    const etapas = JSON.stringify([
      { name: "Tampa", machineId: "x2d", printHours: 1.25, laborMinutes: 10 },
    ]);
    const stage = importar(linha({ etapas })).stages[0];

    expect(stage.machineId).toBe("x2d");
    expect("energyTariff" in stage).toBe(false);
    expect("laborRate" in stage).toBe(false);
  });

  // Tarifa e valor-hora são do PRODUTO, não da etapa: não há campo para
  // informá-los por etapa no formulário, e produção e preço só concordam se a
  // fonte for uma só. Um CSV que os traga é ignorado — não vira override.
  it("ignora energyTariff/laborRate escritos na etapa", () => {
    const etapas = JSON.stringify([
      {
        name: "Tampa",
        machineId: "x2d",
        printHours: 1.25,
        laborMinutes: 10,
        energyTariff: 2,
        laborRate: 90,
      },
    ]);
    const stage = importar(linha({ etapas })).stages[0];

    expect("energyTariff" in stage).toBe(false);
    expect("laborRate" in stage).toBe(false);
  });

  it("importa CSV sem as colunas de subitem como produto só-inteiro", () => {
    const product = importar(linha());
    expect(product.sellBySubitems).toBe(false);
    expect(product.subitems).toEqual([]);
  });
});

describe("productCsv — máquina que não casa", () => {
  it("casa por nome exato e por id contido no nome", () => {
    const { products, warnings } = parseProductsCsv(
      `Produto;Maquina\nUm;X2D Combo\nDois;Bambu Lab A1`,
      machines,
    );

    expect(products.map((p) => p.machineId)).toEqual(["x2d", "a1"]);
    expect(warnings).toEqual([]);
  });

  it("avisa quando cai na primeira máquina em vez de decidir calado", () => {
    const { products, warnings } = parseProductsCsv(
      `Produto;Maquina\nUm;Creality K2\n`,
      machines,
    );

    expect(products[0].machineId).toBe("a1");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Creality K2");
    expect(warnings[0]).toContain("A1 Combo");
  });

  it("não avisa quando a coluna de máquina está ausente", () => {
    const { warnings } = parseProductsCsv(`Produto\nUm`, machines);
    expect(warnings).toEqual([]);
  });
});

// CSV-16 — o tempo é a única coluna cuja unidade o cabeçalho anuncia e o parser
// ignorava. Uma planilha gerada por fora (fatiador, impressora) reporta MINUTOS,
// e `Tempo (min)` era capturada pelo needle "tempo" da coluna de horas: 120
// minutos viravam 120 horas, 60x errado e sem um aviso. As duas colunas passam a
// existir e a SOMAR, como os dois campos do `PrintTimeField` no formulário.
describe("CSV-16 — horas e minutos", () => {
  const horas = (csv: string) =>
    parseProductsCsv(csv, machines).products[0].printHours;

  it("as duas colunas somam: 2 h + 30 min = 2,5 h", () => {
    expect(horas(`Produto;Tempo (h);Tempo (min)\nUm;2;30\n`)).toBeCloseTo(2.5, 6);
  });

  it("só minutos: 150 vira 2,5 h — antes entrava como 150 HORAS", () => {
    expect(horas(`Produto;Tempo (min)\nUm;150\n`)).toBeCloseTo(2.5, 6);
  });

  it("hora decimal continua valendo (é o que o export escreve)", () => {
    expect(horas(`Produto;Tempo (h)\nUm;2,5\n`)).toBeCloseTo(2.5, 6);
    expect(horas(`Produto;Tempo (h)\nUm;11,85\n`)).toBeCloseTo(11.85, 6);
  });

  it("o cabeçalho que o needle não pega ainda é lido pela unidade", () => {
    expect(horas(`Produto;Tempo de impressao (min)\nUm;90\n`)).toBeCloseTo(1.5, 6);
    expect(horas(`Produto;Tempo em minutos\nUm;90\n`)).toBeCloseTo(1.5, 6);
  });

  it("variantes do cabeçalho de minutos", () => {
    expect(horas(`Produto;Tempo (min.)\nUm;90\n`)).toBeCloseTo(1.5, 6);
    expect(horas(`Produto;Tempo (minutos)\nUm;90\n`)).toBeCloseTo(1.5, 6);
    expect(horas(`Produto;TEMPO (MIN)\nUm;90\n`)).toBeCloseTo(1.5, 6);
  });

  it('"Tempo mínimo" NÃO é coluna de minutos — "min" dentro de palavra não conta', () => {
    expect(horas(`Produto;Tempo minimo\nUm;2\n`)).toBeCloseTo(2, 6);
  });

  it("a coluna de minutos não rouba a de mão de obra, nem o contrário", () => {
    const { products } = parseProductsCsv(
      `Produto;Tempo (min);Mao de obra (min)\nUm;120;45\n`,
      machines,
    );
    expect(products[0].printHours).toBeCloseTo(2, 6);
    expect(products[0].laborMinutes).toBe(45);
  });

  it("nenhuma das duas colunas: segue no default 0, calado", () => {
    const { products, warnings } = parseProductsCsv(`Produto\nUm\n`, machines);
    expect(products[0].printHours).toBe(0);
    expect(warnings).toEqual([]);
  });

  it("a coluna de minutos é RECONHECIDA — não entra em 'coluna ignorada'", () => {
    const { warnings } = parseProductsCsv(
      `Produto;Tempo (h);Tempo (min)\nUm;1;30\n`,
      machines,
    );
    expect(warnings).toEqual([]);
  });
});
