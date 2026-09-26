import { describe, expect, it } from "vitest";
import {
  buildImportPreview,
  consumptionFactor,
  costSubmission,
  dedupeByTaskId,
  importBatches,
  parseImportFile,
  printFilRows,
  resolveSubmissions,
  type CostedSubmission,
  type ImportContext,
  type ImportPrint,
} from "./productionImport";
import { aliasDocId, normalizeAliasChave } from "./printAliases";
import { DEFAULT_PRODUCT_INPUT } from "../constants";
import type {
  Machine,
  PrintAliasKey,
  SavedPrintAlias,
  SavedProduct,
  StockFilament,
} from "../types";

// S6 (lote 5b da 3a) — o import do arquivo de produção v1, modo `historico`.

const A1: Machine = {
  id: "a1",
  name: "A1 Combo",
  price: 3200,
  lifeHours: 5000,
  watts: 95,
  maintenancePerHour: 0.15,
  weight: 50,
};
const X2D: Machine = {
  id: "x2d",
  name: "X2D Combo",
  price: 9000,
  lifeHours: 5000,
  watts: 150,
  maintenancePerHour: 0.25,
  weight: 50,
};
const MACHINES = [A1, X2D];

const PRETO_PLA: StockFilament = {
  id: "preto-bambu",
  material: "PLA",
  brand: "Bambu",
  colorName: "Preto",
  minG: 0,
  archived: false,
  rolls: [{ id: "r1", purchaseDate: 0, initialG: 1000, remainingG: 1000, pricePerKg: 120 }],
  adjustments: [],
  createdAt: 0,
};

function alias(key: PrintAliasKey, productId: string, stageKey = "main"): SavedPrintAlias {
  const chave = normalizeAliasChave(key.fonte, key.chave)!;
  const k = { ...key, chave };
  return { ...k, id: aliasDocId(k), productId, stageKey, objetosPorUnidade: 1, createdAt: 0 };
}

const MW = (plate: number): PrintAliasKey => ({ fonte: "mw", chave: "555", variante: "9", plate });

// Chaveiro: 1 etapa, 5 peças por mesa, 30 min de mão de obra por mesa, 1 ímã por peça.
const CHAVEIRO: SavedProduct = {
  ...DEFAULT_PRODUCT_INPUT,
  id: "chaveiro",
  name: "Chaveiro",
  machineIds: ["a1"],
  piecesCount: 5,
  printHours: 1,
  laborMinutes: 30,
  laborRate: 60,
  accessories: [{ desc: "Ímã", qty: 1, unitPrice: 0.5, supplyId: null }],
  filaments: [{ filamentId: null, colorName: "Preto", material: "PLA", pricePerKg: 100, totalG: 20 }],
} as SavedProduct;

// Pote: corpo (main) + tampa (etapa extra), vendido INTEIRO.
const POTE: SavedProduct = {
  ...DEFAULT_PRODUCT_INPUT,
  id: "pote",
  name: "Pote",
  mainStageName: "Corpo",
  machineIds: ["x2d"],
  piecesCount: 1,
  printHours: 2,
  laborMinutes: 0,
  laborRate: 60,
  accessories: [],
  filaments: [{ filamentId: null, colorName: "Preto", material: "PLA", pricePerKg: 100, totalG: 50 }],
  stages: [
    {
      id: "tampa",
      name: "Tampa",
      machineIds: ["x2d"],
      printHours: 1,
      laborMinutes: 0,
      filaments: [{ filamentId: null, colorName: "Preto", material: "PLA", pricePerKg: 100, totalG: 20 }],
    },
  ],
} as SavedProduct;

function ctx(over: Partial<ImportContext> = {}): ImportContext {
  return {
    machines: MACHINES,
    products: [CHAVEIRO, POTE],
    aliases: [
      alias(MW(1), "chaveiro"),
      alias({ fonte: "arquivo", chave: "Pote corpo", variante: null, plate: 1 }, "pote", "main"),
      alias({ fonte: "arquivo", chave: "Pote corpo", variante: null, plate: 2 }, "pote", "tampa"),
    ],
    stock: [PRETO_PLA],
    supplies: [],
    energyTariff: 0.8,
    defaultPricePerKg: 110,
    subitemPrices: () => [],
    ...over,
  };
}

// Uma impressão no formato do ARQUIVO (snake_case, como o pipeline escreve).
function rawPrint(over: Record<string, unknown> = {}, curadoria: Record<string, unknown> | null = {}) {
  return {
    task_id: "1000",
    maquina: "A1 Combo",
    serial: "SN1",
    inicio: "2026-07-01T12:00:00Z",
    fim: "2026-07-01T13:00:00Z",
    duracao_s: 3600,
    duracao_relogio_s: 3700,
    status: "concluida",
    status_cru: 2,
    peso_total_g: 25,
    filamentos: [
      {
        cor_carregada: "161616",
        cor_planejada: "0A2989",
        material: "PLA",
        g: 25,
        ams: 0,
        slot: 1,
        filament_id_bambu: "GFA00",
        cor_site: { cor: "Preto", material: "PLA" },
      },
    ],
    objetos: [{ nome: "Assembly", qtd: 5 }],
    apelido: { fonte: "mw", chave: "555", variante: "9", plate: 1 },
    design_id: "555",
    titulo: "Chaveiro",
    personalizado: false,
    imagens: { capa: "1000_capa.png", foto: null },
    curadoria:
      curadoria === null
        ? null
        : {
            destino: "historico",
            apelido_produto: { fonte: "mw", chave: "555", variante: "9", plate: 1 },
            unidades_produzidas: 5,
            unidades_creditadas: 0,
            submissao: null,
            ...curadoria,
          },
    ...over,
  };
}

function arquivo(impressoes: unknown[]) {
  return { schema_version: 1, fonte: "bambu", gerado_em: "2026-09-25", impressoes };
}

function prints(...raws: unknown[]): ImportPrint[] {
  const r = parseImportFile(arquivo(raws));
  if (!r.ok) throw new Error(r.erro);
  expect(r.descartadas).toEqual([]);
  return r.file.impressoes;
}

let seq = 0;
const genId = () => `ev${++seq}`;

function custo(ps: ImportPrint[], c = ctx(), already = new Set<string>()) {
  const { submissions, rejected } = resolveSubmissions(ps, c, already);
  const costed = submissions.map((s) => costSubmission(s, c, "bambu", genId, 99, () => null));
  return { submissions, rejected, costed };
}

// ---------------------------------------------------------------------------

describe("parseImportFile — o arquivo v1", () => {
  it("lê os FATOS crus como vieram (inicio em ms, status_cru número → texto)", () => {
    const [p] = prints(rawPrint());
    expect(p.taskId).toBe("1000");
    expect(p.at).toBe(Date.parse("2026-07-01T12:00:00Z"));
    expect(p.facts).toMatchObject({
      maquina: "A1 Combo",
      serial: "SN1",
      duracaoPlanoS: 3600,
      duracaoRelogioS: 3700,
      status: "concluida",
      statusCru: "2",
      objetos: [{ nome: "Assembly", qtd: 5 }],
      apelido: { fonte: "mw", chave: "555", variante: "9", plate: 1 },
      personalizado: false,
    });
    expect(p.facts.filamentos[0]).toEqual({
      corCarregada: "161616",
      corPlanejada: "0A2989",
      material: "PLA",
      g: 25,
      ams: 0,
      slot: 1,
      idNaFonte: "GFA00",
    });
    expect(p.coresSite).toEqual([{ cor: "Preto", material: "PLA" }]);
    expect(p.curadoria?.destino).toBe("historico");
  });

  it("fatal: formato antigo (sem schema_version), versão futura, sem fonte, sem lista", () => {
    expect(parseImportFile({ eventos: [] })).toMatchObject({ ok: false, erro: expect.stringContaining("formato antigo") });
    expect(parseImportFile({ ...arquivo([]), schema_version: 2 })).toMatchObject({ ok: false });
    expect(parseImportFile({ ...arquivo([]), fonte: "" })).toMatchObject({ ok: false });
    expect(parseImportFile({ schema_version: 1, fonte: "bambu" })).toMatchObject({ ok: false });
  });

  it("DESCARTA com motivo o que não dá pra ler — e o resto do arquivo entra", () => {
    const r = parseImportFile(
      arquivo([
        rawPrint({ task_id: "ok" }),
        rawPrint({ task_id: "s1", status: "pausada" }),
        rawPrint({ task_id: "s2", filamentos: [{ material: "PLA", g: "25" }] }),
        rawPrint({ task_id: "s3" }, { unidades_produzidas: 5, unidades_creditadas: 6, destino: "estoque" }),
        rawPrint({ task_id: "s4" }, { unidades_creditadas: 2 }), // credita sem ser estoque
        rawPrint({ task_id: "../x" }),
        rawPrint({ task_id: "s6", objetos: [{ nome: "a", qtd: 0 }] }),
        rawPrint({ task_id: "s7", inicio: "ontem" }),
        rawPrint({ task_id: "s8" }, { apelido_produto: { fonte: "codigo_errado", chave: "x" } }),
        "não é objeto",
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.impressoes.map((p) => p.taskId)).toEqual(["ok"]);
    expect(r.descartadas).toHaveLength(9);
    expect(r.descartadas[0]).toMatchObject({ taskId: "s1", motivo: expect.stringContaining("status desconhecido") });
    expect(r.descartadas.find((d) => d.taskId === "s2")!.motivo).toContain('"g"');
    expect(r.descartadas[r.descartadas.length - 1].taskId).toBeNull();
  });

  it("dedupe dentro do arquivo: vale a 1ª ocorrência", () => {
    const ps = prints(rawPrint(), rawPrint({ titulo: "segunda" }));
    const { unicas, duplicadasNoArquivo } = dedupeByTaskId(ps);
    expect(unicas).toHaveLength(1);
    expect(unicas[0].facts.titulo).toBe("Chaveiro");
    expect(duplicadasNoArquivo).toBe(1);
  });
});

describe("os números — a regra do site", () => {
  it("concluída: tempo do fatiador, NUNCA o relógio", () => {
    const [p] = prints(rawPrint({ duracao_relogio_s: 99999 }));
    expect(consumptionFactor(p)).toBe(1);
    const { costed } = custo([p]);
    expect(costed[0].events[0].payload.printHours).toBeCloseTo(1, 9);
    expect(costed[0].events[0].payload.fonteDosNumeros).toBe("impressora");
  });

  it("cancelada: plano × min(1, relógio ÷ plano) — 1358 s de 5824 s ≈ 23%", () => {
    const [p] = prints(
      rawPrint({ status: "cancelada", duracao_s: 5824, duracao_relogio_s: 1358, filamentos: [{ material: "PLA", g: 31, cor_site: { cor: "Preto", material: "PLA" } }] }),
    );
    const fator = 1358 / 5824;
    expect(consumptionFactor(p)).toBeCloseTo(fator, 9);
    const { costed } = custo([p]);
    const ev = costed[0].events[0].payload;
    expect(ev.filaments[0].totalG).toBeCloseTo(31 * fator, 6);
    expect(ev.printHours).toBeCloseTo(1358 / 3600, 9);
    expect(ev.fonteDosNumeros).toBe("estimativa");
  });

  it("falha da IMPRESSORA também não terminou: estimada como a cancelada", () => {
    const [p] = prints(rawPrint({ status: "falha", duracao_s: 1000, duracao_relogio_s: 200 }));
    expect(consumptionFactor(p)).toBeCloseTo(0.2, 9);
    const { costed } = custo([p]);
    expect(costed[0].events[0].payload.fonteDosNumeros).toBe("estimativa");
  });

  it("data sem fuso é descartada (seria lida como hora local do navegador)", () => {
    const r = parseImportFile(arquivo([rawPrint({ inicio: "2026-07-01T22:30:00" })]));
    expect(r.ok && r.descartadas[0].motivo).toContain("fuso");
    const ok = parseImportFile(arquivo([rawPrint({ inicio: "2026-07-01T22:30:00-03:00" })]));
    expect(ok.ok && ok.file.impressoes[0].at).toBe(Date.parse("2026-07-02T01:30:00Z"));
  });

  it("cancelada sem relógio: fica o plano, ainda como estimativa", () => {
    const [p] = prints(rawPrint({ status: "cancelada", duracao_relogio_s: null }));
    expect(consumptionFactor(p)).toBe(1);
  });

  it("soma por cor do SITE: 3 slots que viraram o mesmo verde são 1 linha", () => {
    const verde = { material: "PLA", cor_site: { cor: "Verde", material: "PLA" } };
    const [p] = prints(rawPrint({ filamentos: [{ ...verde, g: 1 }, { ...verde, g: 2 }, { ...verde, g: 3 }] }));
    const { rows } = printFilRows(p, [], 110, "main");
    expect(rows).toHaveLength(1);
    expect(rows[0].totalG).toBe(6);
  });

  it("preço: o do grupo cor+material no Estoque; fora dele, o padrão — e conta", () => {
    const [p] = prints(
      rawPrint({
        filamentos: [
          { material: "PLA", g: 10, cor_site: { cor: "Preto", material: "PLA" } },
          { material: "PLA", g: 10, cor_site: { cor: "Roxo", material: "PLA" } },
          { material: "PETG", g: 10, cor_carregada: "FF00FF" },
        ],
      }),
    );
    const r = printFilRows(p, [PRETO_PLA], 110, "main");
    expect(r.rows.map((f) => [f.colorName, f.pricePerKg])).toEqual([
      ["Preto", 120],
      ["Roxo", 110],
      ["#FF00FF", 110],
    ]);
    expect(r.precoPadrao).toBe(2);
    expect(r.semTraducao).toBe(1);
  });
});

describe("resolveSubmissions — produto, etapa e submissão", () => {
  it("sem curadoria (fase B) fica pro 5c, com o motivo", () => {
    const { rejected, submissions } = custo(prints(rawPrint({}, null)));
    expect(submissions).toEqual([]);
    expect(rejected[0].reason).toBe("sem-curadoria");
  });

  it("máquina desconhecida e apelido fora do catálogo rejeitam, com o motivo", () => {
    const { rejected } = custo(
      prints(
        rawPrint({ task_id: "m", maquina: "Ender 3" }),
        rawPrint({ task_id: "a" }, { apelido_produto: { fonte: "mw", chave: "777", plate: 1 } }),
      ),
    );
    expect(rejected.map((r) => [r.taskId, r.reason])).toEqual([
      ["m", "maquina-nao-reconhecida"],
      ["a", "apelido-desconhecido"],
    ]);
  });

  it("apelido EXATO liga produto + etapa; sem apelido é avulso", () => {
    const { submissions } = custo(
      prints(rawPrint({ task_id: "p" }), rawPrint({ task_id: "v" }, { apelido_produto: null })),
    );
    expect(submissions.map((s) => [s.product?.id ?? null, s.selection.kind])).toEqual([
      ["chaveiro", "whole"],
      [null, "avulso"],
    ]);
  });

  it('"estoque" avulso é recusado (avulso não vira peça pronta)', () => {
    const { rejected } = custo(
      prints(rawPrint({}, { destino: "estoque", apelido_produto: null, unidades_creditadas: 1 })),
    );
    expect(rejected[0].reason).toBe("estoque-sem-produto");
  });

  it('"estoque" com cor sem tradução é recusado (a prateleira é material + cor)', () => {
    const { rejected } = custo(
      prints(
        rawPrint({ filamentos: [{ material: "PLA", g: 5, cor_carregada: "161616" }] }, { destino: "estoque", unidades_creditadas: 5 }),
      ),
    );
    expect(rejected[0].reason).toBe("cor-sem-traducao");
  });

  const corpo = (over: Record<string, unknown> = {}, cur: Record<string, unknown> = {}) =>
    rawPrint(
      { task_id: "corpo", maquina: "X2D Combo", apelido: null, ...over },
      {
        apelido_produto: { fonte: "arquivo", chave: "Pote corpo", plate: 1 },
        unidades_produzidas: 1,
        ...cur,
      },
    );
  const tampa = (over: Record<string, unknown> = {}, cur: Record<string, unknown> = {}) =>
    rawPrint(
      { task_id: "tampa", maquina: "X2D Combo", inicio: "2026-07-02T12:00:00Z", apelido: null, ...over },
      {
        apelido_produto: { fonte: "arquivo", chave: "pote_corpo.3mf", plate: 2 },
        unidades_produzidas: 1,
        ...cur,
      },
    );

  it("🔴 decisão 1: etapa SOZINHA de produto vendido inteiro não credita", () => {
    const { rejected } = custo(prints(corpo({}, { destino: "estoque", unidades_creditadas: 1 })));
    expect(rejected[0].reason).toBe("estoque-nao-forma-produto");
    // Como histórico entra — custo + hora, sem crédito.
    const { submissions } = custo(prints(corpo()));
    expect(submissions[0].selection.kind).toBe("partial");
  });

  it("🔴 decisão 1: corpo + tampa JUNTOS numa submissão formam o produto e creditam", () => {
    const cur = { destino: "estoque", unidades_creditadas: 1, submissao: "pote-a" };
    const { submissions, rejected, costed } = custo(prints(corpo({}, cur), tampa({}, cur)));
    expect(rejected).toEqual([]);
    expect(submissions).toHaveLength(1);
    expect(submissions[0].selection.kind).toBe("whole");
    // A submissão fica pronta na ÚLTIMA impressão.
    expect(submissions[0].at).toBe(Date.parse("2026-07-02T12:00:00Z"));
    const evs = costed[0].events;
    expect(evs).toHaveLength(2);
    expect(new Set(evs.map((e) => e.payload.submissionId)).size).toBe(1);
    expect(evs[0].payload.submissionId).toBe(evs[0].id);
    // Cada evento guarda a hora DELA.
    expect(evs.map((e) => e.payload.at)).toEqual([
      Date.parse("2026-07-01T12:00:00Z"),
      Date.parse("2026-07-02T12:00:00Z"),
    ]);
    expect(costed[0].finishedEntries?.[0].qty).toBe(1);
  });

  it("submissão com unidades diferentes entre as mesas é recusada INTEIRA", () => {
    const { rejected, submissions } = custo(
      prints(
        corpo({}, { submissao: "x", unidades_produzidas: 1 }),
        tampa({}, { submissao: "x", unidades_produzidas: 2 }),
      ),
    );
    expect(submissions).toEqual([]);
    expect(rejected.map((r) => r.reason)).toEqual(["submissao-incoerente", "submissao-incoerente"]);
  });

  it("submissão com parte já importada não entra de novo pela metade", () => {
    const { rejected, submissions } = custo(
      prints(corpo({}, { submissao: "x" }), tampa({}, { submissao: "x" })),
      ctx(),
      new Set(["corpo"]),
    );
    expect(submissions).toEqual([]);
    expect(rejected).toEqual([
      expect.objectContaining({ taskId: "tampa", reason: "submissao-parcial" }),
    ]);
  });

  it("uma impressão ruim derruba a submissão inteira", () => {
    const { rejected, submissions } = custo(
      prints(corpo({ maquina: "Ender" }, { submissao: "x" }), tampa({}, { submissao: "x" })),
    );
    expect(submissions).toEqual([]);
    expect(rejected.map((r) => [r.taskId, r.reason])).toEqual([
      ["corpo", "maquina-nao-reconhecida"],
      ["tampa", "submissao-incoerente"],
    ]);
  });

  it("a mesma etapa duas vezes na submissão é recusada", () => {
    const { rejected } = custo(
      prints(corpo({}, { submissao: "x" }), corpo({ task_id: "corpo2" }, { submissao: "x" })),
    );
    expect(rejected[0].reason).toBe("etapa-repetida");
  });
});

describe("costSubmission — o evento que vai pro Firestore", () => {
  it("S4: origem, fonte dos números, fatos crus e unidades vão em cada evento", () => {
    const [p] = prints(rawPrint());
    const { costed } = custo([p]);
    const ev = costed[0].events[0].payload;
    expect(ev.origemExterna).toEqual({ fonte: "bambu", id: "1000" });
    expect(ev.impressao).toEqual(p.facts);
    expect(ev.mode).toBe("historico");
    expect(ev.stockMoves).toEqual([]); // histórico nunca mexe em rolo
    expect(ev.unidadesProduzidas).toBe(5);
    expect(ev.unidadesCreditadas).toBe(0);
    expect(ev.machineId).toBe("a1");
  });

  it("produzidas ≠ creditadas: 10 na mesa, 7 na prateleira → custo ÷ 10, credita 7", () => {
    const [p] = prints(
      rawPrint({}, { destino: "estoque", unidades_produzidas: 10, unidades_creditadas: 7 }),
    );
    const { costed } = custo([p]);
    const [entry] = costed[0].finishedEntries!;
    expect(entry.qty).toBe(7);
    expect(entry.unitCost).toBeCloseTo(costed[0].planned.summary.frozen / 10, 9);
    expect(entry.color?.label).toBe("Preto PLA");
    // A repartição por máquina desce até a camada (é dela que a venda sabe quem imprimiu).
    expect(entry.unitMachineUsage?.[0].machineId).toBe("a1");
    expect(costed[0].events[0].payload.unidadesCreditadas).toBe(7);
  });

  it("mão de obra e ímã escalam pelas PRODUZIDAS ÷ peças por mesa do cadastro", () => {
    // Cadastro: mesa de 5 → 30 min × R$60/h = R$30; 5 ímãs. A impressão fez 10.
    const [p] = prints(rawPrint({}, { unidades_produzidas: 10 }));
    const { costed } = custo([p]);
    expect(costed[0].planned.built[0].row.laborCost).toBeCloseTo(60, 9);
    expect(costed[0].events[0].payload.supplies?.[0].qty).toBe(10);
    expect(costed[0].events[0].payload.notes).toContain("herdados do cadastro");
  });

  it("etapa solta (partial) não leva o acessório do produto montado", () => {
    const comIma = { ...POTE, accessories: [{ desc: "Ímã", qty: 1, unitPrice: 1, supplyId: null }] } as SavedProduct;
    const c = ctx({ products: [CHAVEIRO, comIma] });
    const [p] = prints(
      rawPrint(
        { task_id: "corpo", maquina: "X2D Combo" },
        { apelido_produto: { fonte: "arquivo", chave: "Pote corpo", plate: 1 }, unidades_produzidas: 1 },
      ),
    );
    const { costed } = custo([p], c);
    expect(costed[0].sub.selection.kind).toBe("partial");
    expect(costed[0].events[0].payload.supplies).toBeUndefined();
  });

  it("avulso: título como nome, sem mão de obra nem acessório", () => {
    const [p] = prints(rawPrint({}, { apelido_produto: null }));
    const { costed } = custo([p]);
    const ev = costed[0].events[0].payload;
    expect(ev.productName).toBe("Chaveiro");
    expect(ev.productId).toBeUndefined();
    expect(costed[0].planned.built[0].row.laborCost).toBe(0);
    expect(ev.notes).toBeUndefined();
  });
});

describe("importBatches — as transações", () => {
  it("crédito vai por PRODUTO com o acabado (camadas em ordem de data); o resto em lotes", () => {
    const est = (id: string, dia: string) =>
      rawPrint({ task_id: id, inicio: `2026-07-${dia}T12:00:00Z` }, { destino: "estoque", unidades_creditadas: 5 });
    const ps = prints(est("b", "05"), est("a", "01"), rawPrint({ task_id: "h1" }), rawPrint({ task_id: "h2" }));
    const { costed } = custo(ps);
    const batches = importBatches(costed, [], 1);
    const comAcabado = batches.filter((b) => b.finished);
    expect(comAcabado).toHaveLength(1);
    expect(comAcabado[0].events).toHaveLength(2);
    const layers = comAcabado[0].finished!.payload.skus[0].layers;
    expect(layers.map((l) => l.qty)).toEqual([5, 5]);
    expect(layers[0].at).toBeLessThan(layers[1].at);
    // max = 1 → um lote por submissão sem crédito.
    expect(batches.filter((b) => !b.finished).map((b) => b.events.length)).toEqual([1, 1]);
  });

  it("submissão de várias mesas nunca se parte entre transações", () => {
    const cur = { submissao: "x" };
    const ps = prints(
      rawPrint({ task_id: "c", maquina: "X2D Combo" }, { ...cur, apelido_produto: { fonte: "arquivo", chave: "Pote corpo", plate: 1 }, unidades_produzidas: 1 }),
      rawPrint({ task_id: "t", maquina: "X2D Combo" }, { ...cur, apelido_produto: { fonte: "arquivo", chave: "Pote corpo", plate: 2 }, unidades_produzidas: 1 }),
      rawPrint({ task_id: "h" }),
    );
    const { costed } = custo(ps);
    const batches = importBatches(costed, [], 1);
    expect(batches.map((b) => b.events.length).sort()).toEqual([1, 2]);
  });
});

describe("buildImportPreview", () => {
  it("conta destino, máquina, estimadas, creditadas e imagens escolhidas", () => {
    const ps = prints(
      rawPrint({ task_id: "e" }, { destino: "estoque", unidades_creditadas: 4 }),
      rawPrint({ task_id: "c", status: "cancelada", maquina: "X2D Combo" }, { destino: "falha" }),
    );
    const { costed, rejected } = custo(ps);
    const preview = buildImportPreview({
      totalArquivo: 3,
      descartadas: [{ taskId: "z", motivo: "x" }],
      jaImportadas: 0,
      duplicadasNoArquivo: 0,
      rejeitadas: rejected,
      costed: costed as CostedSubmission[],
      imagensEscolhidas: new Set(["e:capa"]),
    });
    expect(preview.aImportar).toBe(2);
    expect(preview.porDestino).toEqual({ historico: 0, estoque: 1, falha: 1, teste: 0 });
    expect(preview.estimadas).toBe(1);
    expect(preview.unidadesCreditadas).toBe(4);
    expect(preview.imagens).toEqual({ citadas: 2, escolhidas: 1 });
    expect(preview.porMaquina.map((m) => m.machineId).sort()).toEqual(["a1", "x2d"]);
  });
});
