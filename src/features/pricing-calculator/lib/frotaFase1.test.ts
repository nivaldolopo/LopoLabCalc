import { describe, expect, it } from "vitest";
import {
  DEFAULT_FIXED_COSTS,
  DEFAULT_MACHINES,
  DEFAULT_PRODUCT_INPUT,
} from "../constants";
import { calculatePricing } from "./calculatePricing";
import { NO_COLOR } from "./filaments";
import {
  addProductionLayers,
  consumeFifo,
  submissionEntries,
} from "./finishedGoods";
import { sumFrozen } from "./production";
import {
  accessoryRows,
  buildProductionPayloads,
  nextRowKey,
  planEventRows,
  resolveFilRow,
  subitemEventRows,
  wholeEventRows,
  type EventRow,
} from "./productionPlan";
import { reconcileReciboWrite, type ReconItem } from "./saleReconciliation";
import type {
  FinishedGood,
  Machine,
  SavedProduct,
  StockFilament,
} from "../types";

// ---------------------------------------------------------------------------
// [FROTA] Fase 1 — o ROI passa a atribuir por quem IMPRIMIU, não por quem foi
// precificado. A promessa da fase é dupla, e este arquivo cobre as duas:
//
//  1. O PREÇO NÃO MUDA. Nada aqui toca `calculatePricing`, e a trava abaixo é
//     literal: se um centavo se mexer, é bug — não é "o teste ficou velho".
//  2. A repartição em N eventos (uma linha por ETAPA) não muda o DINHEIRO da
//     produção; muda só a atribuição. O que era 1 evento agrupado por máquina
//     vira N eventos que somam exatamente o mesmo custo, as mesmas gramas e a
//     mesma mão de obra.
// ---------------------------------------------------------------------------

// Um produto que exercita tudo de uma vez: 3 etapas, DUAS delas na MESMA máquina
// (o caso que o `printedCount` contava errado), uma terceira em outra, 2 peças
// por placa, acessório, taxa de falha e venda por partes.
const KIT = {
  ...DEFAULT_PRODUCT_INPUT,
  id: "kit",
  name: "Kit",
  piecesCount: 2,
  machineId: "a1",
  printHours: 3,
  laborMinutes: 10,
  laborRate: 30,
  markup: 3,
  failureRate: 5,
  energyTariff: 0.8,
  roundingMode: "exact",
  filaments: [{ colorName: "Azul", pricePerKg: 100, totalG: 60 }],
  stages: [
    {
      id: "s1",
      name: "Tampa",
      machineId: "a1", // a MESMA da principal — o caso do printedCount
      printHours: 1,
      laborMinutes: 5,
      filaments: [{ colorName: "Vermelho", pricePerKg: 120, totalG: 20 }],
    },
    {
      id: "s2",
      name: "Base",
      machineId: "x2d",
      printHours: 2,
      laborMinutes: 0,
      filaments: [{ colorName: "Preto", pricePerKg: 90, totalG: 40 }],
    },
  ],
  accessories: [{ desc: "Ima", qty: 1, unitPrice: 0.5, supplyId: null }],
  sellBySubitems: true,
  subitems: [
    { id: "corpo", name: "Corpo", stageKeys: ["main", "s1"] },
    { id: "base", name: "Base", stageKeys: ["s2"] },
  ],
} as unknown as SavedProduct;

const MACHINES: Machine[] = DEFAULT_MACHINES;

// ===========================================================================
// 1. A TRAVA DO PREÇO
// ===========================================================================

describe("[FROTA] Fase 1 — o preço NÃO muda", () => {
  // Números medidos no código e colados aqui de propósito. Uma asserção contra
  // `calculatePricing` rodando de novo não provaria nada: ela acompanharia
  // qualquer regressão. Só o literal é trava.
  it("o produto inteiro sai pelo MESMO preço, componente a componente", () => {
    const r = calculatePricing(KIT, MACHINES, DEFAULT_FIXED_COSTS, []);
    expect(r.suggestedPrice).toBeCloseTo(36.99978947368422, 10);
    expect(r.exactPrice).toBeCloseTo(36.99978947368422, 10);
    expect(r.totalCost).toBeCloseTo(14.964842105263157, 10);
    expect(r.materialCost).toBeCloseTo(6, 10);
    expect(r.energyCost).toBeCloseTo(0.272, 10);
    expect(r.depreciationCost).toBeCloseTo(3.2796000000000003, 10);
    expect(r.maintenanceCost).toBeCloseTo(0.44, 10);
    expect(r.laborCost).toBeCloseTo(3.75, 10);
    expect(r.accessoriesCost).toBeCloseTo(0.5, 10);
    expect(r.failureReserve).toBeCloseTo(0.7232421052631579, 10);
    expect(r.margin).toBeCloseTo(59.55425066429966, 10);
    expect(r.pieces).toBe(2);
  });

  it("cada SUBITEM sai pelo MESMO preço, e a soma segue sendo o inteiro", () => {
    const r = calculatePricing(KIT, MACHINES, DEFAULT_FIXED_COSTS, []);
    const [corpo, base] = r.subitems!;
    expect(corpo.price).toBeCloseTo(23.975576453213144, 10);
    expect(base.price).toBeCloseTo(13.024213020471073, 10);
    expect(corpo.cost).toBeCloseTo(10.623437765106136, 10);
    expect(base.cost).toBeCloseTo(4.341404340157024, 10);
    // FEAT-01: rateio aditivo — Σ partes = inteiro, e continua valendo.
    expect(corpo.price + base.price).toBeCloseTo(r.suggestedPrice, 10);
    expect(corpo.cost + base.cost).toBeCloseTo(r.totalCost, 10);
  });

  it("a repartição PRECIFICADA por máquina continua igual — ela só deixou de ir para a venda", () => {
    // A Fase 1 não mexeu no `PricingResult.machineUsage`: ele segue existindo
    // para o `/catalogo` dizer em que máquinas o produto PODE rodar. O que mudou
    // é que a VENDA parou de copiá-lo — ela agora pergunta a quem imprimiu.
    const r = calculatePricing(KIT, MACHINES, DEFAULT_FIXED_COSTS, []);
    expect(r.machineUsage).toEqual([
      {
        machineId: "a1",
        machineName: "A1 Combo",
        hours: 2,
        depreciation: 1.4130666666666667,
      },
      {
        machineId: "x2d",
        machineName: "X2D Combo",
        hours: 1,
        depreciation: 1.8665333333333334,
      },
    ]);
  });
});

// ===========================================================================
// 2. UMA LINHA POR ETAPA — muda a ATRIBUIÇÃO, não o dinheiro
// ===========================================================================

// A montagem ANTIGA, reconstruída à mão: as etapas AGRUPADAS por máquina, como
// o `wholeEventRows` fazia antes da Fase 1. É contra ela que o dinheiro é
// comparado — a única prova honesta de que o split não custou nada.
function linhasAgrupadasPorMaquina(product: SavedProduct): EventRow[] {
  const porMaquina = new Map<string, EventRow>();
  const etapas = [
    {
      machineId: product.machineId,
      printHours: product.printHours,
      filaments: product.filaments ?? [],
      labor: (product.laborMinutes / 60) * product.laborRate,
    },
    ...(product.stages ?? []).map((stage) => ({
      machineId: stage.machineId,
      printHours: stage.printHours,
      filaments: stage.filaments ?? [],
      labor: ((stage.laborMinutes ?? 0) / 60) * product.laborRate,
    })),
  ];
  for (const etapa of etapas) {
    const atual = porMaquina.get(etapa.machineId);
    if (atual) {
      atual.printHours += etapa.printHours;
      atual.laborCost += etapa.labor;
      atual.filaments.push(...etapa.filaments.map((f) => resolveFilRow(f, [])));
    } else {
      porMaquina.set(etapa.machineId, {
        key: nextRowKey(),
        productName: product.name,
        productId: product.id,
        machineId: etapa.machineId,
        printHours: etapa.printHours,
        filaments: etapa.filaments.map((f) => resolveFilRow(f, [])),
        laborCost: etapa.labor,
        energyTariff: product.energyTariff,
        supplies: [],
      });
    }
  }
  const rows = [...porMaquina.values()];
  // Os acessórios iam na 1ª linha do grupo, como continuam indo na 1ª etapa.
  if (rows[0]) rows[0].supplies = accessoryRows(product, product.piecesCount);
  return rows;
}

const planejar = (rows: EventRow[], stock: StockFilament[] = []) => {
  let n = 0;
  return planEventRows(rows, "real", stock, [], MACHINES, () => `ev${(n += 1)}`, 0);
};

describe("[FROTA] Fase 1 — uma linha por ETAPA", () => {
  it("3 etapas viram 3 eventos, mesmo com duas na mesma impressora", () => {
    const rows = wholeEventRows(KIT, MACHINES, []);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.machineId)).toEqual(["a1", "a1", "x2d"]);
    // É ISTO que conserta o `printedCount`: antes as duas primeiras eram um
    // evento só, e o ROI contava 1 impressão na A1 onde houve 2.
    expect(rows.filter((r) => r.machineId === "a1")).toHaveLength(2);
  });

  it("o nome de cada evento identifica a ETAPA (antes identificava a máquina)", () => {
    const rows = wholeEventRows(KIT, MACHINES, []);
    // O agrupamento por máquina não conseguia distinguir as duas etapas da A1 —
    // as duas cabiam no mesmo rótulo "Kit (A1 Combo)".
    expect(rows.map((r) => r.productName)).toEqual([
      "Kit — A1 Combo", // a principal não tem nome próprio: cai na máquina
      "Kit — Tampa",
      "Kit — Base",
    ]);
  });

  it("os acessórios continuam na PRIMEIRA linha só — nunca repetidos por etapa", () => {
    const rows = wholeEventRows(KIT, MACHINES, []);
    expect(rows[0].supplies.map((s) => s.name)).toEqual(["Ima"]);
    expect(rows[1].supplies).toEqual([]);
    expect(rows[2].supplies).toEqual([]);
    // 3 etapas × 1 ima/peça × 2 peças consumiria 6 em vez de 2.
    expect(rows.flatMap((r) => r.supplies).reduce((s, u) => s + u.qty, 0)).toBe(2);
  });

  it("o DINHEIRO é idêntico ao do agrupamento antigo — só a atribuição mudou", () => {
    const novo = planejar(wholeEventRows(KIT, MACHINES, []));
    const antigo = planejar(linhasAgrupadasPorMaquina(KIT));

    // Contagem de eventos: 3 contra 2. É a única diferença desejada.
    expect(novo.built).toHaveLength(3);
    expect(antigo.built).toHaveLength(2);

    // E nada mais se move: total, composição, gramas e material.
    expect(novo.summary.frozen).toBeCloseTo(antigo.summary.frozen, 10);
    expect(novo.summary.grams).toBeCloseTo(antigo.summary.grams, 10);
    expect(novo.summary.material).toBeCloseTo(antigo.summary.material, 10);
    for (const chave of [
      "material",
      "energy",
      "depreciation",
      "maintenance",
      "labor",
      "supplies",
    ] as const) {
      expect(novo.summary.frozenBreakdown[chave]).toBeCloseTo(
        antigo.summary.frozenBreakdown[chave],
        10,
      );
    }
    // E o invariante do FEAT-06 continua fechando.
    expect(sumFrozen(novo.summary.frozenBreakdown)).toBeCloseTo(
      novo.summary.frozen,
      10,
    );
  });

  it("a repartição por máquina soma as etapas que caem na mesma impressora", () => {
    const { summary } = planejar(wholeEventRows(KIT, MACHINES, []));
    const a1 = summary.machineUsage.find((u) => u.machineId === "a1")!;
    const x2d = summary.machineUsage.find((u) => u.machineId === "x2d")!;
    expect(a1.hours).toBeCloseTo(4, 10); // 3 (principal) + 1 (tampa)
    expect(x2d.hours).toBeCloseTo(2, 10);
    // A depreciação é a REAL do custo congelado, não a precificada.
    expect(a1.depreciation + x2d.depreciation).toBeCloseTo(
      summary.frozenBreakdown.depreciation,
      10,
    );
  });
});

describe("[FROTA] Fase 1 — subitem também vira uma linha por etapa", () => {
  it("as etapas do subitem viram eventos próprios, com a máquina de CADA uma", () => {
    const r = calculatePricing(KIT, MACHINES, DEFAULT_FIXED_COSTS, []);
    const corpo = r.subitems!.find((s) => s.id === "corpo")!;
    const rows = subitemEventRows(KIT, corpo, [], MACHINES);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.machineId)).toEqual(["a1", "a1"]);
    // Antes era UMA linha, com TODAS as horas na `machineUsage[0]`.
    expect(rows.reduce((sum, row) => sum + row.printHours, 0)).toBeCloseTo(4, 10);
  });

  it("a mão de obra do subitem é PRESERVADA — só se reparte entre as linhas", () => {
    const r = calculatePricing(KIT, MACHINES, DEFAULT_FIXED_COSTS, []);
    const corpo = r.subitems!.find((s) => s.id === "corpo")!;
    const rows = subitemEventRows(KIT, corpo, [], MACHINES);
    // O total continua sendo `costBreakdown.labor × peças` — inclusive a fatia
    // dos PASSOS INTERNOS que o rateio aditivo embute e que não pertence a
    // nenhuma etapa. Somar só o labor das etapas barataria o evento.
    expect(rows.reduce((sum, row) => sum + row.laborCost, 0)).toBeCloseTo(
      corpo.costBreakdown.labor * 2,
      10,
    );
  });

  it("com PASSO INTERNO, a fatia rateada continua dentro do total", () => {
    // Uma 4ª etapa que não pertence a subitem nenhum = passo interno. O rateio
    // do FEAT-01 empurra parte do labor dela para cada parte, e essa fatia não
    // tem etapa onde morar.
    const comInterno = {
      ...KIT,
      stages: [
        ...KIT.stages!,
        {
          id: "s3",
          name: "Lixamento",
          machineId: "a1",
          printHours: 0.5,
          laborMinutes: 30,
          filaments: [],
        },
      ],
    } as SavedProduct;
    const r = calculatePricing(comInterno, MACHINES, DEFAULT_FIXED_COSTS, []);
    const corpo = r.subitems!.find((s) => s.id === "corpo")!;
    const rows = subitemEventRows(comInterno, corpo, [], MACHINES);
    const total = rows.reduce((sum, row) => sum + row.laborCost, 0);
    expect(total).toBeCloseTo(corpo.costBreakdown.labor * 2, 10);
    // E ele é MAIOR que o labor próprio das duas etapas (5 + 2,5): a diferença
    // é justamente a fatia do passo interno.
    expect(total).toBeGreaterThan(7.5);
  });
});

// ===========================================================================
// 3. O submissionId — o elo do LOTE
// ===========================================================================

describe("[FROTA] Fase 1 — submissionId", () => {
  it("os N eventos do lote carregam o id do PRIMEIRO, ele inclusive", () => {
    const { built } = planejar(wholeEventRows(KIT, MACHINES, []));
    const payloads = buildProductionPayloads(built, {
      at: 1000,
      outcome: "estoque",
      mode: "real",
      createdAt: 1000,
    });
    expect(payloads).toHaveLength(3);
    expect(payloads.map((p) => p.payload.submissionId)).toEqual([
      "ev1",
      "ev1",
      "ev1",
    ]);
    expect(payloads[0].id).toBe("ev1");
  });

  it("um evento só continua sendo uma submissão de um evento", () => {
    const simples = {
      ...DEFAULT_PRODUCT_INPUT,
      id: "p",
      name: "Peça",
      stages: [],
    } as unknown as SavedProduct;
    const { built } = planejar(wholeEventRows(simples, MACHINES, []));
    const [p] = buildProductionPayloads(built, {
      at: 0,
      outcome: "estoque",
      mode: "real",
      createdAt: 0,
    });
    expect(p.payload.submissionId).toBe(p.id);
  });
});

// ===========================================================================
// 4. A repartição desce até a VENDA
// ===========================================================================

// Um produto simples (sem partes), para o caminho produção → camada → venda
// caber num teste legível.
const PECA = {
  ...DEFAULT_PRODUCT_INPUT,
  id: "peca",
  name: "Peça",
  piecesCount: 1,
  machineId: "a1",
  printHours: 3,
  filaments: [{ colorName: "Azul", pricePerKg: 100, totalG: 60 }],
  stages: [
    {
      id: "s2",
      name: "Base",
      machineId: "x2d",
      printHours: 2,
      laborMinutes: 0,
      filaments: [{ colorName: "Preto", pricePerKg: 90, totalG: 40 }],
    },
  ],
} as unknown as SavedProduct;

// Produz `units` unidades da PECA e devolve o doc de acabado resultante — o
// mesmo caminho que a `/producao` percorre.
function produzir(units = 4): {
  good: FinishedGood;
  horasA1: number;
  horasX2d: number;
} {
  const { built, summary } = planejar(wholeEventRows(PECA, MACHINES, []));
  const entries = submissionEntries("Peça", summary.frozen, {
    color: NO_COLOR,
    units,
    breakdown: summary.frozenBreakdown,
    machineUsage: summary.machineUsage,
  });
  const payload = addProductionLayers(null, "peca", "Peça", entries, built[0].id, 0);
  return {
    good: { id: "peca", ...payload },
    horasA1: summary.machineUsage.find((u) => u.machineId === "a1")!.hours,
    horasX2d: summary.machineUsage.find((u) => u.machineId === "x2d")!.hours,
  };
}

describe("[FROTA] Fase 1 — a camada do acabado carrega quem imprimiu", () => {
  it("a repartição desce POR UNIDADE e reconstrói o total ao multiplicar pelo saldo", () => {
    const { good, horasA1, horasX2d } = produzir(4);
    const [layer] = good.skus[0].layers;
    const a1 = layer.machineUsage!.find((u) => u.machineId === "a1")!;
    const x2d = layer.machineUsage!.find((u) => u.machineId === "x2d")!;
    expect(a1.hours * layer.qty).toBeCloseTo(horasA1, 10);
    expect(x2d.hours * layer.qty).toBeCloseTo(horasX2d, 10);
    // Ela mora ao lado do custo, e na MESMA escala dele.
    expect(sumFrozen(layer.costBreakdown!)).toBeCloseTo(layer.unitCost, 10);
  });

  it("o FIFO devolve a repartição do que saiu, e nada fica sem dono", () => {
    const { good } = produzir(4);
    const res = consumeFifo(good, undefined, NO_COLOR.key, 3);
    expect(res.unattributedUnits).toBe(0);
    const [layer] = good.skus[0].layers;
    for (const u of layer.machineUsage!) {
      const saiu = res.machineUsage.find((m) => m.machineId === u.machineId)!;
      expect(saiu.hours).toBeCloseTo(u.hours * 3, 10);
    }
  });

  it("camada SEM repartição (anterior à Fase 1) conta como órfã, não como zero", () => {
    const { good } = produzir(4);
    const antiga: FinishedGood = {
      ...good,
      skus: [
        {
          ...good.skus[0],
          layers: good.skus[0].layers.map(({ machineUsage: _drop, ...rest }) => {
            void _drop;
            return rest;
          }),
        },
      ],
    };
    const res = consumeFifo(antiga, undefined, NO_COLOR.key, 3);
    expect(res.machineUsage).toEqual([]);
    // O custo continua saindo certinho — o que falta é só a ORIGEM.
    expect(res.cost).toBeGreaterThan(0);
    expect(res.unattributedUnits).toBe(3);
  });

  it("SKU inexistente: não há a que creditar, e as unidades ficam órfãs", () => {
    const { good } = produzir(2);
    expect(consumeFifo(good, undefined, "cor-que-nao-existe", 5)).toMatchObject({
      machineUsage: [],
      unattributedUnits: 5,
    });
  });
});

describe("[FROTA] Fase 1 — a venda congela a máquina REAL", () => {
  const ctx = (goods: FinishedGood[]) => {
    let n = 0;
    return {
      goods,
      colors: [] as StockFilament[],
      supplies: [],
      products: [PECA],
      machines: MACHINES,
      fixedCosts: DEFAULT_FIXED_COSTS,
      at: 1000,
      createdAt: 1000,
      genId: () => `venda-ev${(n += 1)}`,
    };
  };
  const item = (over: Partial<ReconItem> = {}): ReconItem => ({
    key: "k1",
    productId: "peca",
    productName: "Peça",
    quantity: 2,
    origem: "acabado",
    ...over,
  });

  it("peça pronta: a repartição vem das CAMADAS, por unidade", () => {
    const { good, horasA1, horasX2d } = produzir(4);
    const plan = reconcileReciboWrite([item({ quantity: 2 })], null, ctx([good]));
    const [r] = plan.items;
    expect(r.unattributedUnits).toBe(0);
    const a1 = r.machineUsage.find((u) => u.machineId === "a1")!;
    const x2d = r.machineUsage.find((u) => u.machineId === "x2d")!;
    // Por unidade = o total da submissão ÷ as 4 unidades que ela gerou.
    expect(a1.hours).toBeCloseTo(horasA1 / 4, 10);
    expect(x2d.hours).toBeCloseTo(horasX2d / 4, 10);
  });

  it("encomenda: a repartição vem dos EVENTOS criados na hora", () => {
    const plan = reconcileReciboWrite(
      [item({ origem: "encomenda", quantity: 2 })],
      null,
      ctx([]),
    );
    const [r] = plan.items;
    expect(r.unattributedUnits).toBe(0);
    // Um evento por etapa, e a repartição cobre as duas máquinas.
    expect(r.productionEventIds).toHaveLength(2);
    expect([...r.machineUsage.map((u) => u.machineId)].sort()).toEqual([
      "a1",
      "x2d",
    ]);
    // Por unidade: 2 peças × 3 h na A1 ÷ 2 = 3 h/un.
    expect(r.machineUsage.find((u) => u.machineId === "a1")!.hours).toBeCloseTo(
      3,
      10,
    );
    // E a depreciação é a REAL do custo congelado dos eventos.
    const dep = r.machineUsage.reduce((s, u) => s + u.depreciation, 0);
    expect(dep).toBeCloseTo(r.cogsBreakdown!.depreciation, 10);
  });

  it("produto fora do catálogo: nada atribuído, tudo órfão", () => {
    const plan = reconcileReciboWrite(
      [item({ productId: "sumiu", origem: "encomenda", quantity: 3 })],
      null,
      ctx([]),
    );
    const [r] = plan.items;
    expect(r.missingProduct).toBe(true);
    expect(r.machineUsage).toEqual([]);
    expect(r.unattributedUnits).toBe(3);
  });

  it("vender de estoque que não existe: sem camada, sem dono", () => {
    // Nunca se produziu nada, e mesmo assim a venda de peça pronta acontece
    // (D4). Não há camada de onde tirar a origem: as 5 são órfãs.
    const plan = reconcileReciboWrite([item({ quantity: 5 })], null, ctx([]));
    const [r] = plan.items;
    expect(r.finishedShortfall).toBe(5);
    expect(r.machineUsage).toEqual([]);
    expect(r.unattributedUnits).toBe(5);
  });
});
