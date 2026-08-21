import { describe, expect, it } from "vitest";
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

describe("DIAG — Ciclo A: exportProductsCsv -> parseProductsCsv -> exportProductsCsv", () => {
  const csvA = exportProductsCsv([cobaia], machines, fixedCosts, stock);
  const imported = reimport(csvA);
  const csvB = exportProductsCsv([asSaved(imported[0], "prod_copia")], machines, fixedCosts, stock);

  it("A e B: celula por celula, 34 colunas", () => {
    const A = rows(csvA), B = rows(csvB);
    const { diffs, compared } = diffRows(A.headers, A.body[0], B.body[0]);
    console.log(`\n[CICLO A] colunas comparadas: ${compared} - divergentes: ${diffs.length}`);
    diffs.forEach((d) => console.log(`  X ${d.col}\n      A: ${d.a}\n      B: ${d.b}`));
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
    console.log(`\n[CICLO A - payload] falhas: ${falhas.length}`);
    falhas.forEach((f) => console.log(`  X ${f}`));
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
    console.log(`\n[CICLO A - undefined] ${acc.length} ${JSON.stringify(acc)}`);
    expect(acc).toEqual([]);
  });
});

describe("DIAG — bordas", () => {
  it("sellBySubitems ligado com ZERO subitens", () => {
    const p: SavedProduct = { ...cobaia, subitems: [], sellBySubitems: true };
    const back = reimport(exportProductsCsv([p], machines, fixedCosts, stock))[0];
    console.log(`\n[BORDA vazio] sellBySubitems=${back.sellBySubitems} - subitems=${JSON.stringify(back.subitems)}`);
    expect(back.sellBySubitems).toBe(true);
    expect(back.subitems).toEqual([]);
  });

  it("sem acessorios e sem etapas extras: arrays VAZIOS, nao ausentes", () => {
    const p: SavedProduct = { ...cobaia, stages: [], accessories: [] };
    const back = reimport(exportProductsCsv([p], machines, fixedCosts, stock))[0];
    console.log(`[BORDA vazio2] stages=${JSON.stringify(back.stages)} accessories=${JSON.stringify(back.accessories)}`);
    expect(back.stages).toEqual([]);
    expect(back.accessories).toEqual([]);
    expect("stages" in back).toBe(true);
    expect("accessories" in back).toBe(true);
  });

  it("maquina inexistente: avisa ou engole?", () => {
    const csv = exportProductsCsv([cobaia], machines, fixedCosts, stock)
      .replace("Bambu Lab X2D", "Impressora Fantasma");
    const r = parseProductsCsv(csv, machines);
    console.log(`[BORDA maquina] machineId=${r.products[0].machineId} - avisos=${JSON.stringify(r.warnings)}`);
    expect(r.warnings.length).toBe(1);
    expect(r.products[0].machineId).toBe("a1");
  });

  it("escape de ; e aspas sobrevive", () => {
    const back = reimport(exportProductsCsv([cobaia], machines, fixedCosts, stock))[0];
    console.log(`[BORDA escape] name=${JSON.stringify(back.name)} cores=${JSON.stringify(back.filaments?.map((f) => f.colorName))}`);
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
    console.log(`[BORDA legado] CSV exportou as chaves? ${csv.includes("9.99")} - etapa importada: ${JSON.stringify(etapa)}`);
    expect(etapa.energyTariff).toBeUndefined();
    expect(etapa.laborRate).toBeUndefined();
    expect(back.energyTariff).toBe(1.07);
    expect(back.laborRate).toBe(55.5);
  });
});
