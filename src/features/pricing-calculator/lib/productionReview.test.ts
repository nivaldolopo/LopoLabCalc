import { describe, expect, it } from "vitest";
import {
  costSubmissions,
  parseImportFile,
  printFilRows,
  stackFinished,
  type ImportContext,
  type ImportPrint,
} from "./productionImport";
import {
  aliasesToLearn,
  brandPairs,
  effectiveRow,
  guessBrand,
  fillBrandTable,
  initialRows,
  linePicks,
  lookupRow,
  manualTwin,
  pairKey,
  pickFor,
  productDraftFromPrint,
  resolveGroups,
  reviewSubmissions,
  suggestUnits,
  type BrandTable,
  type ReviewRow,
} from "./productionReview";
import { aliasDocId, normalizeAliasChave } from "./printAliases";
import { DEFAULT_PRODUCT_INPUT } from "../constants";
import type {
  Machine,
  PrintAliasKey,
  ProductionEvent,
  SavedPrintAlias,
  SavedProduct,
  StockFilament,
} from "../types";

// S7 (lote 5c da 3a) — a revisão do modo `real` (arquivo SEM curadoria).

const A1: Machine = {
  id: "a1",
  name: "A1 Combo",
  price: 3200,
  lifeHours: 5000,
  watts: 95,
  maintenancePerHour: 0.15,
  weight: 50,
};
const X2D: Machine = { ...A1, id: "x2d", name: "X2D Combo", price: 9000, watts: 150 };
const MACHINES = [A1, X2D];

const roll = (id: string, remainingG: number, pricePerKg: number, purchaseDate = 0) => ({
  id,
  purchaseDate,
  initialG: 1000,
  remainingG,
  pricePerKg,
});
const PRETO_BAMBU: StockFilament = {
  id: "preto-bambu",
  material: "PLA",
  brand: "Bambu",
  colorName: "Preto",
  minG: 0,
  archived: false,
  rolls: [roll("r1", 100, 120)],
  adjustments: [],
  createdAt: 0,
};
const PRETO_SUNLU: StockFilament = {
  ...PRETO_BAMBU,
  id: "preto-sunlu",
  brand: "Sunlu",
  rolls: [roll("s1", 800, 90)],
};
const BRANCO_BAMBU: StockFilament = {
  ...PRETO_BAMBU,
  id: "branco-bambu",
  colorName: "Branco",
  rolls: [roll("b1", 500, 100)],
};

function alias(key: PrintAliasKey, productId: string, stageKey = "main", objetosPorUnidade = 1): SavedPrintAlias {
  const chave = normalizeAliasChave(key.fonte, key.chave)!;
  const k = { ...key, chave };
  return { ...k, id: aliasDocId(k), productId, stageKey, objetosPorUnidade, createdAt: 0 };
}

// Chaveiro: 1 etapa, 5 por mesa, 1 ímã por peça.
const CHAVEIRO = {
  ...DEFAULT_PRODUCT_INPUT,
  id: "chaveiro",
  name: "Chaveiro",
  codigo: "LL-0007",
  machineIds: ["a1"],
  piecesCount: 5,
  printHours: 1,
  laborMinutes: 30,
  laborRate: 60,
  accessories: [{ desc: "Ímã", qty: 1, unitPrice: 0.5, supplyId: null }],
  filaments: [{ filamentId: null, colorName: "Preto", material: "PLA", pricePerKg: 100, totalG: 20 }],
} as SavedProduct;

// Pote: corpo + tampa, vendido inteiro. O cadastro fixa a marca Sunlu no corpo.
const POTE = {
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
  filaments: [{ filamentId: "preto-sunlu", colorName: "Preto", material: "PLA", pricePerKg: 90, totalG: 50 }],
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

const MW = (plate: number): PrintAliasKey => ({ fonte: "mw", chave: "555", variante: "9", plate });
const POTE_KEY = (plate: number): PrintAliasKey => ({ fonte: "arquivo", chave: "Pote", variante: null, plate });

function ctx(over: Partial<ImportContext> = {}): ImportContext {
  return {
    machines: MACHINES,
    products: [CHAVEIRO, POTE],
    aliases: [alias(MW(1), "chaveiro"), alias(POTE_KEY(1), "pote", "main"), alias(POTE_KEY(2), "pote", "tampa")],
    stock: [PRETO_BAMBU, PRETO_SUNLU, BRANCO_BAMBU],
    supplies: [],
    energyTariff: 0.8,
    defaultPricePerKg: 110,
    subitemPrices: () => [],
    ...over,
  };
}

// Impressão do dia a dia: SEM curadoria.
function raw(over: Record<string, unknown> = {}) {
  return {
    task_id: "t1",
    maquina: "A1 Combo",
    inicio: "2026-10-01T12:00:00Z",
    fim: "2026-10-01T13:00:00Z",
    duracao_s: 3600,
    duracao_relogio_s: 3600,
    status: "concluida",
    peso_total_g: 25,
    filamentos: [{ cor_carregada: "161616", material: "PLA", g: 25, cor_site: { cor: "Preto", material: "PLA" } }],
    objetos: [{ nome: "Assembly", qtd: 5 }],
    apelido: { fonte: "mw", chave: "555", variante: "9", plate: 1 },
    titulo: "Chaveiro",
    ...over,
  };
}

function prints(...raws: unknown[]): ImportPrint[] {
  const r = parseImportFile({ schema_version: 1, fonte: "bambu", impressoes: raws });
  if (!r.ok) throw new Error(r.erro);
  expect(r.descartadas).toEqual([]);
  return r.file.impressoes;
}

const row = (taskId: string, over: Partial<ReviewRow> = {}): ReviewRow => ({
  taskId,
  incluir: true,
  choice: { kind: "auto" },
  outcome: null,
  produzidas: null,
  creditadas: null,
  fator: null,
  grupo: { kind: "auto" },
  dividir: {},
  ...over,
});

function revisa(ps: ImportPrint[], rows: ReviewRow[], c = ctx(), table?: BrandTable) {
  const effs = rows.map((r) => effectiveRow(r, ps.find((p) => p.taskId === r.taskId)!, c));
  const pairs = brandPairs(effs, c.stock);
  const t = table ?? fillBrandTable(pairs, {}, effs);
  const { submissions, rejected } = reviewSubmissions(effs, t, c);
  let n = 0;
  const custo = costSubmissions(submissions, c, "bambu", () => `ev${++n}`, 1, () => null);
  return { effs, pairs, table: t, submissions, rejected, ...custo };
}

// ---------------------------------------------------------------------------

describe("effectiveRow — o que a linha é", () => {
  it("apelido EXATO preenche produto + etapa; concluída → peça pronta; unidades pelos objetos", () => {
    const [p] = prints(raw());
    const e = effectiveRow(row("t1"), p, ctx());
    expect(e.product?.id).toBe("chaveiro");
    expect(e.stageKey).toBe("main");
    expect(e.outcome).toBe("estoque");
    expect(e.produzidas).toBe(5);
    expect(e.creditadas).toBe(5);
    expect(e.erro).toBeNull();
  });

  it("sem apelido exato: NÃO chuta — pede a escolha (e sugere pelo código do título)", () => {
    const [p] = prints(raw({ apelido: null, titulo: "LL-0007 Chaveiro novo" }));
    const e = effectiveRow(row("t1"), p, ctx());
    expect(e.product).toBeUndefined();
    expect(e.erro).toMatch(/Escolha o produto/);
    expect(lookupRow(p, ctx().aliases, ctx().products).sugestoes).toEqual([
      { productId: "chaveiro", stageKey: null, motivo: "codigo" },
    ]);
  });

  it("cancelada → falha, com o consumo estimado (relógio ÷ plano) e editável", () => {
    const [p] = prints(raw({ status: "cancelada", duracao_relogio_s: 900 }));
    expect(effectiveRow(row("t1"), p, ctx()).fator).toBeCloseTo(0.25, 9);
    expect(effectiveRow(row("t1"), p, ctx()).outcome).toBe("falha");
    expect(effectiveRow(row("t1", { fator: 0.4 }), p, ctx()).fator).toBe(0.4);
  });

  it("avulso: só teste/brinde/falha (nunca peça pronta)", () => {
    const [p] = prints(raw());
    const e = effectiveRow(row("t1", { choice: { kind: "avulso" }, outcome: "estoque" }), p, ctx());
    expect(e.product).toBeNull();
    expect(e.outcome).toBe("teste");
    expect(e.creditadas).toBe(0);
  });

  it("objetos por unidade do apelido dividem os objetos (1 puxador + 2 cursores = 1 zipper)", () => {
    const [p] = prints(raw({ objetos: [{ nome: "puxador", qtd: 2 }, { nome: "cursor", qtd: 4 }] }));
    expect(suggestUnits(p, alias(MW(1), "chaveiro", "main", 3), CHAVEIRO)).toBe(2);
  });

  it("creditadas nunca passam das produzidas", () => {
    const [p] = prints(raw());
    expect(effectiveRow(row("t1", { produzidas: 4, creditadas: 9 }), p, ctx()).creditadas).toBe(4);
  });
});

describe("já registrado? (decisão 2 do dono)", () => {
  const manual = (over: Partial<ProductionEvent>) =>
    ({
      id: "m1",
      at: Date.parse("2026-10-01T18:00:00Z"),
      machineId: "a1",
      productId: "chaveiro",
      productName: "Chaveiro",
      origemExterna: null,
      ...over,
    }) as ProductionEvent;

  it("mesma máquina + mesmo dia + mesmo produto → vem DESMARCADA", () => {
    const ps = prints(raw());
    expect(initialRows(ps, ctx(), [manual({})])[0].incluir).toBe(false);
  });

  it("outro produto, outra máquina, outro dia ou evento IMPORTADO → marcada", () => {
    const [p] = prints(raw());
    expect(manualTwin(p, "a1", "chaveiro", [manual({ productId: "pote" })])).toBeNull();
    expect(manualTwin(p, "a1", "chaveiro", [manual({ machineId: "x2d" })])).toBeNull();
    expect(manualTwin(p, "a1", "chaveiro", [manual({ at: Date.parse("2026-10-03T12:00:00Z") })])).toBeNull();
    expect(
      manualTwin(p, "a1", "chaveiro", [manual({ origemExterna: { fonte: "bambu", id: "x" } })]),
    ).toBeNull();
    // Produto só de um lado: máquina + dia bastam.
    expect(manualTwin(p, "a1", null, [manual({})])?.id).toBe("m1");
  });
});

describe("submissões — decisão 1: as mesas do produto vendido inteiro se juntam", () => {
  const corpo = (id: string, dia = "01") =>
    raw({ task_id: id, maquina: "X2D Combo", inicio: `2026-10-${dia}T10:00:00Z`, apelido: { fonte: "arquivo", chave: "Pote", plate: 1 }, objetos: [{ nome: "c", qtd: 1 }], titulo: "Pote corpo" });
  const tampa = (id: string, dia = "01") =>
    raw({ task_id: id, maquina: "X2D Combo", inicio: `2026-10-${dia}T14:00:00Z`, apelido: { fonte: "arquivo", chave: "Pote", plate: 2 }, objetos: [{ nome: "t", qtd: 1 }], titulo: "Pote tampa" });

  it("corpo + tampa em automático formam UMA submissão que credita", () => {
    const ps = prints(corpo("c1"), tampa("t1"));
    const r = revisa(ps, [row("c1"), row("t1")]);
    expect(r.rejected).toEqual([]);
    expect(r.submissions).toHaveLength(1);
    expect(r.submissions[0].selection.kind).toBe("whole");
    expect(r.costed[0].finishedEntries?.[0].qty).toBe(1);
  });

  it("a etapa que repete abre OUTRA submissão (dois potes)", () => {
    const ps = prints(corpo("c1"), tampa("t1"), corpo("c2", "02"), tampa("t2", "02"));
    const effs = ps.map((p) => effectiveRow(row(p.taskId), p, ctx()));
    const g = resolveGroups(effs);
    expect(g.get("t1")).toBe("c1");
    expect(g.get("t2")).toBe("c2");
  });

  it("'com X' segue a corrente em qualquer ordem de data", () => {
    const ps = prints(corpo("c1"), tampa("t1", "02"), corpo("c2", "03"));
    const effs = [
      effectiveRow(row("c1", { grupo: { kind: "com", taskId: "t1" } }), ps[0], ctx()),
      effectiveRow(row("t1", { grupo: { kind: "com", taskId: "c2" } }), ps[1], ctx()),
      effectiveRow(row("c2", { grupo: { kind: "sozinha" } }), ps[2], ctx()),
    ];
    const g = resolveGroups(effs);
    expect(new Set([g.get("c1"), g.get("t1"), g.get("c2")])).toEqual(new Set(["c2"]));
  });

  it("'sozinha': etapa só não forma o produto e a peça pronta é RECUSADA com o motivo", () => {
    const ps = prints(corpo("c1"), tampa("t1"));
    const r = revisa(ps, [row("c1", { grupo: { kind: "sozinha" } }), row("t1", { grupo: { kind: "sozinha" } })]);
    expect(r.rejected.map((x) => x.reason)).toEqual(["estoque-nao-forma-produto", "estoque-nao-forma-produto"]);
  });
});

describe("a tabela de marcas", () => {
  it("palpite: a marca do CADASTRO do produto; sem ela, a com mais saldo", () => {
    const ps = prints(
      raw({ task_id: "p1", maquina: "X2D Combo", apelido: { fonte: "arquivo", chave: "Pote", plate: 1 } }),
      raw({ task_id: "k1" }),
    );
    const effs = ps.map((p) => effectiveRow(row(p.taskId), p, ctx()));
    const pairs = brandPairs(effs, ctx().stock);
    const x2d = pairs.find((p) => p.machineId === "x2d")!;
    const a1 = pairs.find((p) => p.machineId === "a1")!;
    expect(guessBrand(x2d, effs)).toBe("preto-sunlu"); // do cadastro do Pote
    expect(guessBrand(a1, effs)).toBe("preto-sunlu"); // 800 g > 100 g
  });

  it("sem tradução de cor: sem palpite (escolher a marca é o que traduz)", () => {
    const ps = prints(raw({ filamentos: [{ cor_carregada: "FFFFFF", material: "PLA", g: 10, cor_site: null }] }));
    const effs = ps.map((p) => effectiveRow(row(p.taskId), p, ctx()));
    const [par] = brandPairs(effs, ctx().stock);
    expect(par.traduzida).toBe(false);
    expect(par.candidates.map((c) => c.id)).toContain("branco-bambu");
    expect(guessBrand(par, effs)).toBeNull();
  });

  it("'a partir desta impressão, marca B' vale dali em diante, só naquela máquina", () => {
    const key = pairKey("a1", "pla::preto");
    const t: BrandTable = {
      [key]: [
        { desde: null, filamentId: "preto-bambu" },
        { desde: Date.parse("2026-10-05T00:00:00Z"), filamentId: "preto-sunlu" },
      ],
    };
    expect(pickFor(t, key, Date.parse("2026-10-04T12:00:00Z"))).toBe("preto-bambu");
    expect(pickFor(t, key, Date.parse("2026-10-05T00:00:00Z"))).toBe("preto-sunlu");
    expect(pickFor(t, pairKey("x2d", "pla::preto"), Date.parse("2026-10-06T00:00:00Z"))).toBeNull();
  });

  it("'dividir': X g de uma marca, o resto da marca da tabela", () => {
    const [p] = prints(raw());
    const key = "pla::preto";
    const e = effectiveRow(row("t1", { dividir: { [key]: { filamentId: "preto-bambu", g: 10 } } }), p, ctx());
    const picks = linePicks(e, { [pairKey("a1", key)]: [{ desde: null, filamentId: "preto-sunlu" }] });
    const { rows } = printFilRows(p, ctx().stock, 110, "main", 1, picks);
    expect(rows.map((r) => [r.filamentId, r.totalG])).toEqual([
      ["preto-bambu", 10],
      ["preto-sunlu", 15],
    ]);
  });
});

describe("dividir sem marca na tabela", () => {
  it("não vira a linha inteira da outra marca: sem base, não divide", () => {
    const [p] = prints(raw());
    const key = "pla::preto";
    const e = effectiveRow(row("t1", { dividir: { [key]: { filamentId: "preto-bambu", g: 10 } } }), p, ctx());
    expect(linePicks(e, { [pairKey("a1", key)]: [{ desde: null, filamentId: null }] })?.size).toBe(0);
  });
});

describe("gravação no modo real — o mesmo caminho do manual, com baixa", () => {
  it("dá baixa do rolo da marca escolhida e credita a prateleira", () => {
    const ps = prints(raw());
    const r = revisa(ps, [row("t1")]);
    const ev = r.costed[0].events[0].payload;
    expect(ev.mode).toBe("real");
    expect(ev.outcome).toBe("estoque");
    expect(ev.stockMoves.map((m) => [m.stockId, m.qty])).toEqual([["preto-sunlu", 25]]);
    expect(r.colorUpdates.find((c) => c.id === "preto-sunlu")?.rolls[0].remainingG).toBe(775);
    expect(ev.fonteDosNumeros).toBe("impressora");
    expect(ev.origemExterna).toEqual({ fonte: "bambu", id: "t1" });
    const [fin] = stackFinished(r.costed, []);
    expect(fin.payload.skus[0].layers[0].qty).toBe(5);
  });

  it("🔴 a baixa é ENCADEADA entre impressões: a 2ª parte do rolo já mexido pela 1ª", () => {
    const ps = prints(
      raw({ task_id: "a", filamentos: [{ material: "PLA", g: 80, cor_site: { cor: "Preto", material: "PLA" } }] }),
      raw({ task_id: "b", inicio: "2026-10-02T12:00:00Z", filamentos: [{ material: "PLA", g: 80, cor_site: { cor: "Preto", material: "PLA" } }] }),
    );
    const key = pairKey("a1", "pla::preto");
    const r = revisa(ps, [row("a"), row("b")], ctx(), { [key]: [{ desde: null, filamentId: "preto-bambu" }] });
    // 100 g no rolo: 80 + 80 = 60 de dívida, UM estado final gravado.
    const final = r.colorUpdates.filter((c) => c.id === "preto-bambu");
    expect(final).toHaveLength(1);
    const saldo = final[0].rolls.reduce((s, x) => s + x.remainingG, 0);
    expect(saldo).toBe(-60);
  });

  it("cancelada: gramas e horas pela estimativa, sem o acessório (não chegou à montagem)", () => {
    const ps = prints(raw({ status: "cancelada", duracao_relogio_s: 900 }));
    const r = revisa(ps, [row("t1", { choice: { kind: "produto", productId: "chaveiro", stageKey: "main" } })]);
    const ev = r.costed[0].events[0].payload;
    expect(ev.outcome).toBe("falha");
    expect(ev.fonteDosNumeros).toBe("estimativa");
    expect(ev.printHours).toBeCloseTo(0.25, 9);
    expect(ev.filaments[0].totalG).toBeCloseTo(6.25, 9);
    expect(ev.supplies).toBeUndefined();
    expect(r.costed[0].finishedEntries).toBeNull();
  });

  it("linha sem marca entra só no custo, sem baixa", () => {
    const ps = prints(raw());
    const key = pairKey("a1", "pla::preto");
    const r = revisa(ps, [row("t1", { outcome: "teste" })], ctx(), { [key]: [{ desde: null, filamentId: null }] });
    expect(r.costed[0].events[0].payload.stockMoves).toEqual([]);
    expect(r.colorUpdates).toEqual([]);
  });
});

describe("aliasesToLearn — a revisão ensina o apelido", () => {
  it("produto escolhido à mão + apelido novo nos fatos → aprende (objetos ÷ unidades)", () => {
    const [p] = prints(raw({ apelido: { fonte: "arquivo", chave: "Zipper_v2.3mf", plate: 1 }, objetos: [{ nome: "x", qtd: 6 }] }));
    const e = effectiveRow(
      row("t1", { choice: { kind: "produto", productId: "chaveiro", stageKey: "main" }, produzidas: 2 }),
      p,
      ctx(),
    );
    expect(aliasesToLearn([e], ctx().aliases)).toEqual([
      {
        productId: "chaveiro",
        alias: { fonte: "arquivo", chave: "zipper v2", variante: null, plate: 1, stageKey: "main", objetosPorUnidade: 3 },
      },
    ]);
  });

  it("apelido que já existe, linha automática ou desmarcada → não aprende", () => {
    const [p] = prints(raw());
    const escolhida = row("t1", { choice: { kind: "produto", productId: "chaveiro", stageKey: "main" } });
    expect(aliasesToLearn([effectiveRow(escolhida, p, ctx())], ctx().aliases)).toEqual([]);
    const [q] = prints(raw({ apelido: { fonte: "arquivo", chave: "novo", plate: 1 } }));
    expect(aliasesToLearn([effectiveRow(row("t1"), q, ctx())], [])).toEqual([]);
    expect(
      aliasesToLearn([effectiveRow({ ...escolhida, incluir: false }, q, ctx())], []),
    ).toEqual([]);
  });
});

describe("productDraftFromPrint — criar produto a partir da impressão", () => {
  it("formulário preenchido com os fatos; nome sem o código; apelido junto", () => {
    const [p] = prints(
      raw({
        titulo: "LL-0042 Quatto face",
        duracao_s: 5400,
        filamentos: [
          { material: "PLA", g: 20, cor_site: { cor: "Preto", material: "PLA" } },
          { material: "PLA", g: 5, cor_site: { cor: "Preto", material: "PLA" } },
          { material: "PLA", g: 3, cor_site: { cor: "Branco", material: "PLA" } },
        ],
        objetos: [{ nome: "a", qtd: 4 }],
        design_id: "555",
      }),
    );
    const d = productDraftFromPrint(p, "a1", ctx().stock, 110);
    expect(d.product.name).toBe("Quatto face");
    expect(d.product.printHours).toBe(1.5);
    expect(d.product.piecesCount).toBe(4);
    expect(d.product.machineIds).toEqual(["a1"]);
    expect(d.product.linkModel).toBe("https://makerworld.com/models/555");
    expect(d.product.filaments?.map((f) => [f.colorName, f.totalG, f.pricePerKg])).toEqual([
      ["Preto", 25, 120],
      ["Branco", 3, 100],
    ]);
    expect(d.aliases).toEqual([
      { fonte: "mw", chave: "555", variante: "9", plate: 1, stageKey: "main", objetosPorUnidade: 1 },
    ]);
  });
});
