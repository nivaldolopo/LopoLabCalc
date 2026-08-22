import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportProductsCsv, parseProductsCsv } from "./productCsv";
import type {
  FixedCostSettings,
  Machine,
  ProductPayload,
  SavedProduct,
  StockFilament,
} from "../types";

const machines: Machine[] = [
  { id: "a1", name: "Bambu Lab A1", price: 5299, lifeHours: 7500, watts: 85, maintenancePerHour: 0.12 },
  { id: "x2d", name: "Bambu Lab X2D", price: 13999, lifeHours: 7500, watts: 160, maintenancePerHour: 0.2 },
];
const fixedCosts: FixedCostSettings = {
  enabled: true, rent: 900, other: 250, machines: 2, hoursDay: 10, daysMonth: 26,
};
const stock: StockFilament[] = [];

// COBAIA: exercita TODO campo ao mesmo tempo.
const cobaia: SavedProduct = {
  id: "prod_cobaia",
  createdAt: 1_700_000_000_000,
  name: 'Cobaia "Full"; Round-Trip',
  mainStageName: "Corpo principal",
  machineId: "x2d",
  printHours: 4.75,
  energyTariff: 1.07,          // != 0.8
  laborMinutes: 42,            // != 15
  laborRate: 55.5,             // != 30
  markup: 2.8,                 // != 3
  failureRate: 7,              // != 3
  includeFixed: true,          // != false
  roundingMode: "0.90",        // != exact
  piecesCount: 3,              // != 1
  sellBySubitems: true,
  linkModel: "https://makerworld.com/model/1",
  linkCompetitor: "https://concorrente.com/x",
  linkFile: "https://drive.google.com/file/abc",
  filaments: [
    { filamentId: "fil_azul", colorName: 'Azul "Royal"', pricePerKg: 118.9, totalG: 143.53 },
    {
      filamentId: "fil_branco", colorName: "Branco; Neve", pricePerKg: 99.5,
      totalG: 60, modelG: 40, supportG: 8, purgedG: 7, towerG: 5,
    },
  ],
  stages: [
    {
      id: "stage_extra_1", name: "Tampa (outra maquina)", machineId: "a1",
      printHours: 1.25, laborMinutes: 12,
      filaments: [{ filamentId: "fil_verde", colorName: "Verde", pricePerKg: 105, totalG: 22.4 }],
    },
    {
      id: "stage_extra_2", name: "Encaixe (mesma maquina)", machineId: "x2d",
      printHours: 0.6, laborMinutes: 5,
      filaments: [{ filamentId: null, colorName: "Preto avulso", pricePerKg: 89.9, totalG: 11 }],
    },
  ],
  accessories: [
    { desc: "Argola metalica", qty: 2, unitPrice: 0.43, supplyId: "sup_argola", subitemId: null },
    { desc: "Ima avulso", qty: 1, unitPrice: 1.25, supplyId: null, subitemId: null },
    { desc: "Cordao do topo", qty: 4, unitPrice: 0.9, supplyId: "sup_cordao", subitemId: "sub_topo" },
  ],
  subitems: [
    { id: "sub_corpo", name: "Corpo", stageKeys: ["main", "stage_extra_2"] },
    { id: "sub_topo", name: "Topo", stageKeys: ["stage_extra_1"], markup: 4.2 },
  ],
  fixedCostPerHour: null, combineEnabled: null, stage2: null,
};

function rows(csv: string): { headers: string[]; body: string[][] } {
  const lines = csv.replace(/^﻿/, "").split("\n").filter((l) => l.trim());
  const parse = (line: string) => {
    const out: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i += 1; } else q = false; } else cur += c; continue; }
      if (c === '"') q = true; else if (c === ";") { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur); return out.map((v) => v.trim());
  };
  const all = lines.map(parse);
  return { headers: all[0], body: all.slice(1) };
}

const JSON_COLS = ["Etapas JSON", "Acessorios JSON", "Filamentos JSON", "Subitens JSON"];

type Diff = { col: string; a: string; b: string };
function diffRows(headers: string[], a: string[], b: string[]) {
  const diffs: Diff[] = [];
  let compared = 0;
  headers.forEach((h, i) => {
    compared += 1;
    const va = a[i] ?? "", vb = b[i] ?? "";
    if (JSON_COLS.includes(h)) {
      const pa = JSON.parse(va || "[]"), pb = JSON.parse(vb || "[]");
      if (JSON.stringify(pa) !== JSON.stringify(pb)) diffs.push({ col: h, a: va, b: vb });
    } else if (va !== vb) diffs.push({ col: h, a: va, b: vb });
  });
  return { diffs, compared };
}

function reimport(csv: string): ProductPayload[] {
  return parseProductsCsv(csv, machines).products;
}
function asSaved(p: ProductPayload, id: string): SavedProduct {
  return { ...p, id } as SavedProduct;
}

describe("round-trip do CSV — export -> import -> export", () => {
  const csvA = exportProductsCsv([cobaia], machines, fixedCosts, stock);
  const imported = reimport(csvA);
  const csvB = exportProductsCsv([asSaved(imported[0], "prod_copia")], machines, fixedCosts, stock);

  it("A e B: celula por celula, 34 colunas", () => {
    const A = rows(csvA), B = rows(csvB);
    const { diffs, compared } = diffRows(A.headers, A.body[0], B.body[0]);
    // Coluna nova sem cobertura aqui é um buraco silencioso: o diff só prova o
    // que ele percorre.
    expect(compared).toBe(34);
    expect(diffs).toEqual([]);
  });

  it("campo a campo no PAYLOAD importado (nao so no CSV)", () => {
    const p = imported[0];
    const falhas: string[] = [];
    const eq = (label: string, esperado: unknown, obtido: unknown) => {
      if (JSON.stringify(esperado) !== JSON.stringify(obtido)) {
        falhas.push(`${label}: esperado ${JSON.stringify(esperado)} - obtido ${JSON.stringify(obtido)}`);
      }
    };
    (["name", "mainStageName", "machineId", "printHours", "energyTariff", "laborMinutes",
      "laborRate", "markup", "failureRate", "includeFixed", "roundingMode", "piecesCount",
      "linkModel", "linkCompetitor", "linkFile", "sellBySubitems"] as const)
      .forEach((k) => eq(k, cobaia[k], p[k]));
    eq("filaments", cobaia.filaments, p.filaments);
    eq("stages", cobaia.stages, p.stages);
    eq("accessories", cobaia.accessories, p.accessories);
    eq("subitems", cobaia.subitems, p.subitems);
    const ids = new Set(["main", ...(p.stages ?? []).map((s) => s.id)]);
    (p.subitems ?? []).forEach((s) =>
      s.stageKeys.forEach((k) => { if (!ids.has(k)) falhas.push(`stageKey orfao: ${s.id} -> ${k}`); }));
    expect(falhas).toEqual([]);
  });

  it("nenhum undefined vaza para o Firestore", () => {
    const scan = (o: unknown, path: string, acc: string[]) => {
      if (Array.isArray(o)) o.forEach((v, i) => scan(v, `${path}[${i}]`, acc));
      else if (o && typeof o === "object")
        Object.entries(o).forEach(([k, v]) => {
          if (v === undefined) acc.push(`${path}.${k}`);
          else scan(v, `${path}.${k}`, acc);
        });
    };
    const acc: string[] = [];
    scan(imported[0], "produto", acc);
    expect(acc).toEqual([]);
  });
});

describe("round-trip do CSV — bordas", () => {
  it("sellBySubitems ligado com ZERO subitens", () => {
    const p: SavedProduct = { ...cobaia, subitems: [], sellBySubitems: true };
    const back = reimport(exportProductsCsv([p], machines, fixedCosts, stock))[0];
    expect(back.sellBySubitems).toBe(true);
    expect(back.subitems).toEqual([]);
  });

  it("sem acessorios e sem etapas extras: arrays VAZIOS, nao ausentes", () => {
    const p: SavedProduct = { ...cobaia, stages: [], accessories: [] };
    const back = reimport(exportProductsCsv([p], machines, fixedCosts, stock))[0];
    expect(back.stages).toEqual([]);
    expect(back.accessories).toEqual([]);
    expect("stages" in back).toBe(true);
    expect("accessories" in back).toBe(true);
  });

  it("maquina inexistente: avisa ou engole?", () => {
    const csv = exportProductsCsv([cobaia], machines, fixedCosts, stock)
      .replace("Bambu Lab X2D", "Impressora Fantasma");
    const r = parseProductsCsv(csv, machines);
    expect(r.warnings.length).toBe(1);
    expect(r.products[0].machineId).toBe("a1");
  });

  it("escape de ; e aspas sobrevive", () => {
    const back = reimport(exportProductsCsv([cobaia], machines, fixedCosts, stock))[0];
    expect(back.name).toBe('Cobaia "Full"; Round-Trip');
    expect(back.filaments?.[0].colorName).toBe('Azul "Royal"');
    expect(back.filaments?.[1].colorName).toBe("Branco; Neve");
  });

  it("INVERSO: energyTariff/laborRate escritos DENTRO da etapa nao viram override", () => {
    const sujo: SavedProduct = {
      ...cobaia,
      stages: [{ ...cobaia.stages[0], energyTariff: 9.99, laborRate: 999 } as never],
    };
    const csv = exportProductsCsv([sujo], machines, fixedCosts, stock);
    const back = reimport(csv)[0];
    const etapa = back.stages[0] as Record<string, unknown>;
    expect(etapa.energyTariff).toBeUndefined();
    expect(etapa.laborRate).toBeUndefined();
    expect(back.energyTariff).toBe(1.07);
    expect(back.laborRate).toBe(55.5);
  });

  it("o EXPORT nao carrega o lixo legado pra fora — etapa sai normalizada", () => {
    // Antes o export dumpava `product.stages` cru, e 47 das 51 etapas do
    // catalogo real levavam `energyTariff`/`laborRate` inertes pro CSV.
    const sujo: SavedProduct = {
      ...cobaia,
      stages: [{ ...cobaia.stages[0], energyTariff: 9.99, laborRate: 999 } as never],
    };
    const csv = exportProductsCsv([sujo], machines, fixedCosts, stock);
    expect(csv).not.toContain("energyTariff");
    expect(csv).not.toContain("laborRate");
    expect(csv).not.toContain("9.99");
  });

  it("etapa LEGADA (escalares, sem filaments) sai como array de cores", () => {
    const legado: SavedProduct = {
      ...cobaia,
      stages: [
        { id: "s_legado", name: "Antiga", machineId: "a1", printHours: 1,
          laborMinutes: 0, weightG: 30, filamentPricePerKg: 110 },
      ],
    };
    const csv = exportProductsCsv([legado], machines, fixedCosts, stock);
    const back = reimport(csv)[0];
    expect(back.stages[0].filaments).toEqual([
      { filamentId: null, colorName: "", pricePerKg: 110, totalG: 30 },
    ]);
    // E o round-trip segue estavel: reexportar da o mesmo CSV.
    const csv2 = exportProductsCsv(
      [asSaved(back, "x")], machines, fixedCosts, stock,
    );
    expect(csv2).toBe(csv);
  });
});

// ---------------------------------------------------------------------------
// CSV-03 — as 12 colunas calculadas são ignoradas na importação. Recalcular é o
// certo; o defeito era o SILÊNCIO. Estes testes travam o aviso.
// ---------------------------------------------------------------------------
describe("CSV-03 — o que a importação IGNORA, ela conta", () => {
  const opcoes = { fixedCosts, stock };

  it("reimportação sem nada ter mudado: nenhum aviso", () => {
    const csv = exportProductsCsv([cobaia], machines, fixedCosts, stock);
    expect(parseProductsCsv(csv, machines, opcoes).recalc).toBeUndefined();
  });

  it("preço editado na planilha: avisa, com o valor do arquivo e o recalculado", () => {
    const csv = exportProductsCsv([cobaia], machines, fixedCosts, stock);
    const linhas = csv.split("\n");
    const celulas = linhas[1].split(";");
    // "Preco Sugerido (R$)" é a 17ª coluna (índice 16); o nome está entre
    // aspas e não contém `;` fora delas até aqui.
    const H = linhas[0].replace(/^﻿/, "").split(";");
    const i = H.indexOf("Preco Sugerido (R$)");
    const original = celulas[i];
    celulas[i] = "999,99";
    const editado = [linhas[0], celulas.join(";")].join("\n");

    const r = parseProductsCsv(editado, machines, opcoes);
    expect(r.recalc).toBeDefined();
    expect(r.recalc?.divergentes).toBe(1);
    expect(r.recalc?.comparadas).toBe(1);
    expect(r.recalc?.exemplos[0]).toContain("999,99");
    expect(r.recalc?.exemplos[0]).toContain(original);
    expect(r.recalc?.exemplos[0]).toContain("Cobaia");
    // E o produto entra com o preço RECALCULADO, não com o editado.
    expect(r.products).toHaveLength(1);
  });

  it("sem as opções (taxa de fixo/estoque) a checagem não roda", () => {
    const csv = exportProductsCsv([cobaia], machines, fixedCosts, stock)
      .replace("81,80", "999,99");
    expect(parseProductsCsv(csv, machines).recalc).toBeUndefined();
  });

  it("CSV enxuto, sem as colunas calculadas: nada a comparar, nada a avisar", () => {
    const csv = [
      "Produto;Maquina;Peso (g);Tempo (h);Markup",
      "Chaveiro;Bambu Lab A1;40;3;3",
    ].join("\n");
    const r = parseProductsCsv(csv, machines, opcoes);
    expect(r.recalc).toBeUndefined();
    expect(r.products).toHaveLength(1);
  });

  it("célula VAZIA não conta como divergência", () => {
    const csv = [
      "Produto;Maquina;Peso (g);Tempo (h);Markup;Preco Sugerido (R$)",
      "Chaveiro;Bambu Lab A1;40;3;3;",
    ].join("\n");
    expect(parseProductsCsv(csv, machines, opcoes).recalc).toBeUndefined();
  });

  it("no máximo 3 exemplos, mas o total conta todas", () => {
    const varios = Array.from({ length: 6 }, (_, i) => ({
      ...cobaia, id: `p${i}`, name: `Produto ${i}`,
    }));
    const csv = exportProductsCsv(varios, machines, fixedCosts, stock);
    const linhas = csv.split("\n");
    const H = linhas[0].replace(/^﻿/, "").split(";");
    const i = H.indexOf("Custo Total (R$)");
    const editadas = linhas.slice(1).map((l) => {
      const c = l.split(";"); c[i] = "777,77"; return c.join(";");
    });
    const r = parseProductsCsv([linhas[0], ...editadas].join("\n"), machines, opcoes);
    expect(r.recalc?.divergentes).toBe(6);
    expect(r.recalc?.comparadas).toBe(6);
    expect(r.recalc?.exemplos).toHaveLength(3);
  });
});

// O produto da carga em massa tem de nascer com a MESMA forma que o formulário
// grava: `filaments` manda, e os escalares legados não entram junto. Sem isto,
// todo produto importado nascia com `weightG`/`filamentPricePerKg` no
// documento — inertes no custo, e por isso mesmo capazes de sobreviver
// despercebidos até alguém abrir e salvar o produto.
describe("importação — a forma do documento importado", () => {
  it("com as cores na linha, os escalares legados NÃO vão para o documento", () => {
    const csv = exportProductsCsv([cobaia], machines, fixedCosts, stock);
    const produto = parseProductsCsv(csv, machines).products[0];

    expect("weightG" in produto).toBe(false);
    expect("filamentPricePerKg" in produto).toBe(false);
    expect(produto.filaments).toEqual(cobaia.filaments);
  });

  it("sem as cores, os escalares seguem entrando — são o peso/preço de verdade", () => {
    const csv = [
      "Produto;Maquina;Peso (g);Tempo (h);Filamento (R$/kg);Markup",
      "Chaveiro;Bambu Lab A1;40;3;120;3",
    ].join("\n");
    const produto = parseProductsCsv(csv, machines).products[0];

    expect(produto.weightG).toBe(40);
    expect(produto.filamentPricePerKg).toBe(120);
    expect(produto.filaments).toBeUndefined();
  });

  it("o peso continua chegando ao custo pelos dois caminhos", () => {
    const comCores = parseProductsCsv(
      exportProductsCsv([cobaia], machines, fixedCosts, stock),
      machines,
      { fixedCosts, stock },
    );
    // Reimportar o próprio arquivo não acende aviso: o custo é o mesmo com a
    // linha inteira vindo das cores.
    expect(comCores.recalc).toBeUndefined();
  });
});

// CSV-02 / CSV-04 — o arquivo escrito FORA do app: ordem de coluna é de quem
// escreve, e célula pode ter quebra de linha. Os dois casos partiam a leitura
// em silêncio.
describe("importação — arquivo escrito à mão", () => {
  // O `parseProductsCsv` carimba `createdAt: Date.now()` em cada linha. Dois
  // parses do MESMO arquivo em milissegundos diferentes geravam documentos
  // diferentes, e o diff campo a campo abaixo falhava sozinho (medido: 6 de 10
  // execuções). Congelar o relógio mantém a comparação INTEIRA — tirar
  // `createdAt` do diff esconderia justamente o tipo de campo que o RT-01
  // existe para vigiar.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // Divide preservando as aspas cruas (para remontar o arquivo sem reescapar).
  function splitRaw(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (const c of line) {
      if (c === '"') { q = !q; cur += c; continue; }
      if (c === ";" && !q) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  }

  it("CSV-02: cabeçalho em ordem INVERTIDA importa igual", () => {
    const csv = exportProductsCsv([cobaia], machines, fixedCosts, stock)
      .replace(/^\uFEFF/, "");
    const [cabecalho, linha] = csv.split("\n");
    const invertido = [
      splitRaw(cabecalho).reverse().join(";"),
      splitRaw(linha).reverse().join(";"),
    ].join("\n");

    const normal = parseProductsCsv(csv, machines).products[0];
    const trocado = parseProductsCsv(invertido, machines).products[0];

    // "Filamentos JSON" passa a vir ANTES de "Filamento (R$/kg)" — era aí que a
    // busca por substring pegava a coluna errada.
    expect(splitRaw(cabecalho).reverse().indexOf("Filamentos JSON")).toBeLessThan(
      splitRaw(cabecalho).reverse().indexOf("Filamento (R$/kg)"),
    );
    expect(JSON.stringify(trocado)).toBe(JSON.stringify(normal));
  });

  it("CSV-02: cabeçalho com acento e caixa diferente é reconhecido", () => {
    const csv = [
      "PRODUTO;Máquina;PESO (G);Tempo (h);Arredondamento;Preço Sugerido (R$)",
      "Chaveiro;Bambu Lab A1;40;3;0,90;99,90",
    ].join("\n");
    const r = parseProductsCsv(csv, machines);
    expect(r.products[0].name).toBe("Chaveiro");
    expect(r.products[0].machineId).toBe("a1");
    expect(r.products[0].weightG).toBe(40);
    expect(r.products[0].roundingMode).toBe("0.90");
    // Coluna reconhecida = nenhum aviso de "coluna ignorada".
    expect(r.warnings).toEqual([]);
  });

  it("CSV-04: quebra de linha dentro da célula não parte a linha", () => {
    const comQuebra: SavedProduct = {
      ...cobaia,
      id: "p_quebra",
      name: "Linha 1\nLinha 2",
      linkModel: "https://exemplo/a\nb",
    };
    const csv = exportProductsCsv([comQuebra], machines, fixedCosts, stock);
    const produtos = parseProductsCsv(csv, machines).products;

    expect(produtos).toHaveLength(1);
    expect(produtos[0].name).toBe("Linha 1\nLinha 2");
    expect(produtos[0].linkModel).toBe("https://exemplo/a\nb");
    expect(produtos[0].stages).toEqual(cobaia.stages);
  });

  it("CSV-04: CRLF continua funcionando", () => {
    const csv = [
      "Produto;Maquina;Peso (g);Tempo (h);Markup",
      "Chaveiro;Bambu Lab A1;40;3;3",
      "Caneca;Bambu Lab X2D;80;5;2",
    ].join("\r\n");
    const produtos = parseProductsCsv(csv, machines).products;
    expect(produtos.map((p) => p.name)).toEqual(["Chaveiro", "Caneca"]);
  });
});
