import { describe, expect, it } from "vitest";
import {
  IMPORT_FONTE,
  buildImportFinishedUpdates,
  buildImportNotes,
  buildImportPreview,
  bulkImportChunks,
  costImportLine,
  dedupeByTaskId,
  estoqueGroupsByProduct,
  parseBambuImportFile,
  resolveImportLine,
  type BambuImportEvent,
  type ImportContext,
  type ResolvedImportLine,
} from "./productionImport";
import { DEFAULT_PRODUCT_INPUT } from "../constants";
import type { FinishedGood, Machine, SavedProduct, StockFilament } from "../types";

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
const ENERGY_TARIFF = 0.8;

function makeContext(over: Partial<ImportContext> = {}): ImportContext {
  return {
    machines: MACHINES,
    products: [],
    stock: [],
    supplies: [],
    energyTariff: ENERGY_TARIFF,
    defaultPricePerKg: 110,
    ...over,
  };
}

function evento(over: Partial<BambuImportEvent> = {}): BambuImportEvent {
  return {
    task_id: "1265163697",
    productName: "Finca Board Game Insert",
    productId: null,
    maquina_sugerida: "A1 Combo",
    at_ms: 1789852599000,
    printHours: 1.3539,
    peso_g: 49.29,
    filamentos: [{ colorName: "azul claro", material: "PLA", g: 49.29, hex: "A4DAE6", filamentId: null }],
    outcome_sugerido: "historico",
    ...over,
  };
}

function makeProduct(over: Partial<SavedProduct> = {}): SavedProduct {
  return {
    ...DEFAULT_PRODUCT_INPUT,
    id: "prod1",
    name: "Insert",
    machineIds: ["a1"],
    piecesCount: 1,
    laborMinutes: 0,
    laborRate: 30,
    accessories: [],
    filaments: [
      { filamentId: null, colorName: "Azul claro", material: "PLA", pricePerKg: 90, totalG: 40 },
    ],
    ...over,
  } as SavedProduct;
}

function makeCor(over: Partial<StockFilament> & { id: string }): StockFilament {
  return {
    material: "PLA",
    brand: "Bambu",
    colorName: "Azul Claro",
    minG: 0,
    archived: false,
    rolls: [{ id: `${over.id}_r1`, purchaseDate: 0, initialG: 1000, remainingG: 1000, pricePerKg: 120 }],
    adjustments: [],
    createdAt: 0,
    ...over,
  } as StockFilament;
}

describe("parseBambuImportFile", () => {
  it("le o arquivo valido e conta o que a ferramenta externa escreveu", () => {
    const r = parseBambuImportFile({ eventos: [evento()] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.eventos).toHaveLength(1);
    expect(r.descartados).toBe(0);
  });

  it("erro fatal quando nao ha lista de eventos", () => {
    expect(parseBambuImportFile({}).ok).toBe(false);
    expect(parseBambuImportFile(null).ok).toBe(false);
    expect(parseBambuImportFile("texto").ok).toBe(false);
  });

  it("descarta e CONTA item sem task_id (nao vira undefined calado)", () => {
    const r = parseBambuImportFile({
      eventos: [evento(), { productName: "sem id" }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.eventos).toHaveLength(1);
    expect(r.descartados).toBe(1);
  });
});

describe("dedupeByTaskId — task_id repetido DENTRO do mesmo arquivo", () => {
  it("mantem a 1a ocorrencia e conta as demais", () => {
    const r = dedupeByTaskId([
      evento({ task_id: "1" }),
      evento({ task_id: "2" }),
      evento({ task_id: "1" }),
    ]);
    expect(r.unicos.map((e) => e.task_id)).toEqual(["1", "2"]);
    expect(r.duplicadosNoArquivo).toBe(1);
  });

  it("sem repeticao, nao descarta nada", () => {
    const r = dedupeByTaskId([evento({ task_id: "1" }), evento({ task_id: "2" })]);
    expect(r.unicos).toHaveLength(2);
    expect(r.duplicadosNoArquivo).toBe(0);
  });
});

describe("resolveImportLine — maquina", () => {
  it("maquina nao reconhecida rejeita a linha, sem travar o restante (fora daqui)", () => {
    const r = resolveImportLine(evento({ maquina_sugerida: "Impressora Fantasma" }), makeContext());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.line.reason).toBe("maquina-nao-reconhecida");
  });

  it("casa por nome exato (tolerante a espaco duplo, ver machineNameToId)", () => {
    const r = resolveImportLine(evento({ maquina_sugerida: "A1  Combo" }), makeContext());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.line.machineId).toBe("a1");
    expect(r.line.machineFuzzyMatched).toBe(false);
  });

  // Regressão do code review (--high): sem os callbacks de `machineNameToId`,
  // um casamento por SUBSTRING do id (o mesmo critério do `machineNamesToIds`
  // do CSV) passava calado — o custo saindo da máquina que o palpite escolheu,
  // sem nada avisando que foi um palpite.
  it("casamento por SUBSTRING do id marca machineFuzzyMatched", () => {
    const r = resolveImportLine(
      evento({ maquina_sugerida: "Impressora com A1 no meio do nome" }),
      makeContext(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.line.machineId).toBe("a1");
    expect(r.line.machineFuzzyMatched).toBe(true);
  });
});

describe("resolveImportLine — estoque exige produto", () => {
  it('"estoque" sem productId rejeita a linha', () => {
    const r = resolveImportLine(evento({ outcome_sugerido: "estoque", productId: null }), makeContext());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.line.reason).toBe("estoque-sem-produto");
  });

  it('"estoque" com productId que sumiu do catalogo tambem rejeita', () => {
    const r = resolveImportLine(
      evento({ outcome_sugerido: "estoque", productId: "fantasma" }),
      makeContext({ products: [] }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.line.reason).toBe("estoque-sem-produto");
  });

  it('"estoque" com produto religado passa', () => {
    const r = resolveImportLine(
      evento({ outcome_sugerido: "estoque", productId: "prod1" }),
      makeContext({ products: [makeProduct()] }),
    );
    expect(r.ok).toBe(true);
  });

  it("outcome_sugerido desconhecido cai em historico (nunca inventa estoque)", () => {
    const r = resolveImportLine(evento({ outcome_sugerido: "impressao-de-teste" }), makeContext());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.line.outcome).toBe("historico");
  });
});

describe("resolveImportLine — preco do filamento", () => {
  it("sem filamentId e sem correspondencia, usa o R$/kg padrao do lote", () => {
    const r = resolveImportLine(evento(), makeContext({ defaultPricePerKg: 99 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.line.filaments[0].pricePerKg).toBe(99);
    expect(r.line.filaments[0].filamentId).toBeNull();
  });

  it("com filamentId ligado ao Estoque, usa o preco VIVO do rolo mais novo", () => {
    const cor = makeCor({ id: "cor1" });
    const r = resolveImportLine(
      evento({ filamentos: [{ colorName: "Azul Claro", material: "PLA", g: 40, filamentId: "cor1" }] }),
      makeContext({ stock: [cor], defaultPricePerKg: 50 }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.line.filaments[0].pricePerKg).toBe(120); // do rolo, nao o padrao
  });

  it("sem filamentId no arquivo, herda a marca sugerida do CADASTRO do produto religado", () => {
    const cor = makeCor({ id: "cor1" });
    const produto = makeProduct({
      filaments: [
        { filamentId: "cor1", colorName: "Azul Claro", material: "PLA", pricePerKg: 1, totalG: 1 },
      ],
    });
    const r = resolveImportLine(
      evento({ productId: "prod1", filamentos: [{ colorName: "Azul Claro", material: "PLA", g: 40, filamentId: null }] }),
      makeContext({ stock: [cor], products: [produto], defaultPricePerKg: 50 }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.line.filaments[0].filamentId).toBe("cor1");
    expect(r.line.filaments[0].pricePerKg).toBe(120);
    expect(r.line.inheritedFilamentBrand).toBe(true);
  });

  it("sem produto religado, NUNCA inventa acessorio nem mao de obra", () => {
    const r = resolveImportLine(evento(), makeContext());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.line.supplies).toEqual([]);
    expect(r.line.laborCost).toBe(0);
    expect(r.line.inheritedAccessories).toBe(false);
    expect(r.line.inheritedLabor).toBe(false);
  });

  it("com produto religado, herda acessorios e mao de obra do cadastro ATUAL", () => {
    const produto = makeProduct({
      laborMinutes: 30,
      laborRate: 40,
      accessories: [{ desc: "Ima", qty: 2, unitPrice: 0.5 }],
    });
    const r = resolveImportLine(
      evento({ productId: "prod1" }),
      makeContext({ products: [produto] }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.line.laborCost).toBeCloseTo(20, 6); // 30/60 * 40
    expect(r.line.supplies).toHaveLength(1);
    expect(r.line.supplies[0].qty).toBe(2);
    expect(r.line.inheritedAccessories).toBe(true);
    expect(r.line.inheritedLabor).toBe(true);
  });
});

describe("buildImportNotes + origemExterna — a identidade saiu da nota (S4)", () => {
  it("sem heranca nao ha nota; a identidade vai no origemExterna", () => {
    const linha: ResolvedImportLine = {
      taskId: "999",
      outcome: "historico",
      machineId: "a1",
      machineName: "A1 Combo",
      at: 0,
      productName: "X",
      printHours: 1,
      filaments: [],
      supplies: [],
      laborCost: 0,
      pieces: 1,
      inheritedAccessories: false,
      inheritedLabor: false,
      inheritedFilamentBrand: false,
      machineFuzzyMatched: false,
    };
    expect(buildImportNotes(linha)).toBeNull();
    const { payload } = costImportLine(linha, makeContext(), "ev1", 5);
    expect(payload.notes).toBeUndefined();
    expect(payload.origemExterna).toEqual({ fonte: IMPORT_FONTE, id: "999" });
    expect(payload.fonteDosNumeros).toBe("impressora");
    expect(payload.unidadesProduzidas).toBe(1);
    expect(payload.unidadesCreditadas).toBe(0); // historico nao credita
  });

  it("com heranca a nota e SO o aviso", () => {
    const linha: ResolvedImportLine = {
      taskId: "999",
      outcome: "estoque",
      machineId: "a1",
      machineName: "A1 Combo",
      at: 0,
      productId: "prod1",
      productName: "X",
      printHours: 1,
      filaments: [],
      supplies: [{ supplyId: null, name: "Ima", qty: 1, catalogUnitPrice: 1 }],
      laborCost: 5,
      pieces: 1,
      inheritedAccessories: true,
      inheritedLabor: true,
      inheritedFilamentBrand: true,
      machineFuzzyMatched: false,
    };
    const notas = buildImportNotes(linha);
    expect(notas).toBe(
      "acessórios, mão de obra e filamentos herdados do cadastro atual do produto, não confirmados para esta impressão específica",
    );
  });
});

describe("costImportLine — os SEIS componentes, pela maquina REAL (nao a frota)", () => {
  it("soma material + energia + desgaste + manutencao + labor + insumos", () => {
    const ctx = makeContext({ defaultPricePerKg: 100 });
    const result = resolveImportLine(
      evento({ printHours: 2, filamentos: [{ colorName: "Azul", material: "PLA", g: 40, filamentId: null }] }),
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const costed = costImportLine(result.line, ctx, "evt1", 12345);
    // material: 40/1000*100 = 4
    expect(costed.cost.material).toBeCloseTo(4, 6);
    // energia: 2h * (95/1000) * 0.8
    expect(costed.cost.energy).toBeCloseTo(2 * 0.095 * 0.8, 6);
    // depreciacao: 2h * (3200/5000)
    expect(costed.cost.depreciation).toBeCloseTo(2 * (3200 / 5000), 6);
    // manutencao: 2h * 0.15
    expect(costed.cost.maintenance).toBeCloseTo(2 * 0.15, 6);
    expect(costed.cost.labor).toBe(0); // sem produto religado
    expect(costed.cost.supplies).toBe(0);
    const total =
      costed.cost.material +
      costed.cost.energy +
      costed.cost.depreciation +
      costed.cost.maintenance +
      costed.cost.labor +
      costed.cost.supplies;
    expect(costed.cost.total).toBeCloseTo(total, 6);
    expect(costed.payload.frozenCost).toBeCloseTo(total, 6);
    expect(costed.payload.mode).toBe("historico");
    expect(costed.payload.stockMoves).toEqual([]); // 6 — nunca toca rolo/lote real
  });

  it('outcome "estoque" com produto gera finishedEntries; historico/falha nao', () => {
    const produto = makeProduct();
    const ctx = makeContext({ products: [produto] });
    const comEstoque = resolveImportLine(evento({ outcome_sugerido: "estoque", productId: "prod1" }), ctx);
    const semEstoque = resolveImportLine(evento({ outcome_sugerido: "historico", productId: "prod1" }), ctx);
    expect(comEstoque.ok && semEstoque.ok).toBe(true);
    if (!comEstoque.ok || !semEstoque.ok) return;
    const c1 = costImportLine(comEstoque.line, ctx, "evt1", 0);
    const c2 = costImportLine(semEstoque.line, ctx, "evt2", 0);
    expect(c1.finishedEntries).not.toBeNull();
    expect(c2.finishedEntries).toBeNull();
  });
});

describe("buildImportPreview", () => {
  it("agrupa por maquina, conta desfecho, produto sim/nao e o periodo coberto", () => {
    const ctx = makeContext({ products: [makeProduct()] });
    const results = [
      resolveImportLine(evento({ task_id: "1", at_ms: 1000, printHours: 1, maquina_sugerida: "A1 Combo" }), ctx),
      resolveImportLine(
        evento({ task_id: "2", at_ms: 2000, printHours: 2, maquina_sugerida: "A1 Combo", productId: "prod1" }),
        ctx,
      ),
      resolveImportLine(
        evento({ task_id: "3", at_ms: 3000, printHours: 3, maquina_sugerida: "X2D Combo", outcome_sugerido: "falha" }),
        ctx,
      ),
      resolveImportLine(evento({ task_id: "4", maquina_sugerida: "Fantasma" }), ctx),
    ];
    const preview = buildImportPreview(results, 5, 2);
    // 4 resolvidas/rejeitadas nesta chamada + 5 já importadas + 2 duplicatas
    // no arquivo (filtradas ANTES de chegar em `results`) = o total real do
    // arquivo.
    expect(preview.totalArquivo).toBe(11);
    expect(preview.aImportar).toBe(3);
    expect(preview.jaImportados).toBe(5);
    expect(preview.duplicadosNoArquivo).toBe(2);
    expect(preview.semMaquina).toBe(1);
    expect(preview.comProduto).toBe(1);
    expect(preview.semProduto).toBe(2);
    expect(preview.porOutcome.historico).toBe(2);
    expect(preview.porOutcome.falha).toBe(1);
    const a1 = preview.porMaquina.find((m) => m.machineId === "a1")!;
    expect(a1.eventos).toBe(2);
    expect(a1.horas).toBeCloseTo(3, 6);
    expect(preview.periodo).toEqual({ inicio: 1000, fim: 3000 });
  });
});

describe("buildImportFinishedUpdates — acumula VARIAS linhas do MESMO produto", () => {
  it("duas linhas estoque do mesmo produto viram UM FinishedUpdate com as duas camadas", () => {
    const produto = makeProduct({ piecesCount: 1 });
    const ctx = makeContext({ products: [produto] });
    const l1 = resolveImportLine(evento({ task_id: "1", outcome_sugerido: "estoque", productId: "prod1" }), ctx);
    const l2 = resolveImportLine(evento({ task_id: "2", outcome_sugerido: "estoque", productId: "prod1" }), ctx);
    expect(l1.ok && l2.ok).toBe(true);
    if (!l1.ok || !l2.ok) return;
    const c1 = costImportLine(l1.line, ctx, "evt1", 0);
    const c2 = costImportLine(l2.line, ctx, "evt2", 0);
    const updates = buildImportFinishedUpdates([c1, c2], []);
    expect(updates).toHaveLength(1);
    expect(updates[0].productId).toBe("prod1");
    const sku = updates[0].payload.skus[0];
    expect(sku.layers).toHaveLength(2); // uma camada por evento
  });

  it("acumula sobre o acabado JA EXISTENTE (goods), nao substitui", () => {
    const produto = makeProduct();
    const ctx = makeContext({ products: [produto] });
    const existente: FinishedGood = {
      id: "prod1",
      productId: "prod1",
      productName: "Insert",
      createdAt: 0,
      skus: [
        {
          // Mesma chave que `colorKeyOf` daria pro filamento "azul claro"
          // PLA do `evento()` (S11, ver filaments.ts) — é o que faz a camada
          // nova cair na MESMA sku, não abrir uma segunda.
          colorKey: "cor:pla:azul-claro",
          colorLabel: "azul claro PLA",
          name: "Insert",
          layers: [{ id: "velho", at: 0, qty: 3, unitCost: 10, sourceEventId: "velho-evt" }],
        },
      ],
    };
    const l1 = resolveImportLine(evento({ task_id: "1", outcome_sugerido: "estoque", productId: "prod1" }), ctx);
    expect(l1.ok).toBe(true);
    if (!l1.ok) return;
    const c1 = costImportLine(l1.line, ctx, "evt1", 0);
    const updates = buildImportFinishedUpdates([c1], [existente]);
    expect(updates[0].payload.skus[0].layers).toHaveLength(2); // a velha + a nova
  });

  it("linhas historico/falha nao entram nos FinishedUpdate", () => {
    const ctx = makeContext();
    const l1 = resolveImportLine(evento({ task_id: "1", outcome_sugerido: "historico" }), ctx);
    expect(l1.ok).toBe(true);
    if (!l1.ok) return;
    const c1 = costImportLine(l1.line, ctx, "evt1", 0);
    expect(buildImportFinishedUpdates([c1], [])).toEqual([]);
  });
});

describe("bulkImportChunks / estoqueGroupsByProduct — a gravacao em lote", () => {
  it("estoque vai por produto; o resto vai em chunks (nao um por um)", () => {
    const produto = makeProduct();
    const ctx = makeContext({ products: [produto] });
    const estoque = resolveImportLine(evento({ task_id: "1", outcome_sugerido: "estoque", productId: "prod1" }), ctx);
    const hist1 = resolveImportLine(evento({ task_id: "2", outcome_sugerido: "historico" }), ctx);
    const hist2 = resolveImportLine(evento({ task_id: "3", outcome_sugerido: "falha" }), ctx);
    expect(estoque.ok && hist1.ok && hist2.ok).toBe(true);
    if (!estoque.ok || !hist1.ok || !hist2.ok) return;
    const costed = [
      costImportLine(estoque.line, ctx, "evt1", 0),
      costImportLine(hist1.line, ctx, "evt2", 0),
      costImportLine(hist2.line, ctx, "evt3", 0),
    ];
    const grupos = estoqueGroupsByProduct(costed);
    expect(grupos.get("prod1")).toHaveLength(1);
    const chunks = bulkImportChunks(costed, 1);
    expect(chunks).toHaveLength(2); // 2 linhas nao-estoque, chunk de 1
    expect(chunks.flat()).toHaveLength(2);
  });
});
