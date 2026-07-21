import { describe, expect, it } from "vitest";
import { DEFAULT_MACHINES, DEFAULT_PRODUCT_INPUT } from "../constants";
import {
  accessoryRows,
  buildProductionPayloads,
  planEventRows,
  scaleRow,
  wholeEventRows,
} from "./productionPlan";
import { sumFrozen } from "./production";
import type { SavedProduct, Supply } from "../types";

// Foco: a escala dos INSUMOS (7e), que é o ponto onde as unidades se cruzam —
// `Accessory.qty` é POR PEÇA, a linha-evento é POR PLACA, e a submissão são N
// placas. Errar aqui dá baixa a menos (ou a mais) sem nenhum sintoma na tela.

function makeProduct(over: Partial<SavedProduct> = {}): SavedProduct {
  return { ...DEFAULT_PRODUCT_INPUT, id: "p1", name: "Chaveiro", ...over } as SavedProduct;
}

function makeSupply(over: Partial<Supply> & { id: string }): Supply {
  return {
    name: "Ímã",
    unit: "un",
    minQty: 0,
    archived: false,
    lots: [
      {
        id: "l1",
        purchaseDate: 0,
        initialQty: 1000,
        remainingQty: 1000,
        unitPrice: 0.5,
      },
    ],
    adjustments: [],
    createdAt: 0,
    ...over,
  };
}

describe("accessoryRows", () => {
  const product = makeProduct({
    piecesCount: 4,
    accessories: [
      { desc: "Ímã", qty: 2, unitPrice: 0.5, supplyId: "ima" },
      { desc: "Argola", qty: 1, unitPrice: 0.3, supplyId: null },
    ],
  });

  it("converte qtd POR PEÇA em qtd por PLACA (× peças)", () => {
    const rows = accessoryRows(product, 4);
    expect(rows).toEqual([
      { supplyId: "ima", name: "Ímã", qty: 8, unitPrice: 0.5 },
      { supplyId: null, name: "Argola", qty: 4, unitPrice: 0.3 },
    ]);
  });

  it("produção de SUBITEM leva só o acessório atribuído a ele", () => {
    const comSubitem = makeProduct({
      piecesCount: 2,
      accessories: [
        { desc: "Ímã", qty: 1, unitPrice: 0.5, supplyId: "ima", subitemId: "s1" },
        { desc: "Argola", qty: 1, unitPrice: 0.3, supplyId: "arg", subitemId: "s2" },
        { desc: "Caixa", qty: 1, unitPrice: 2, supplyId: "cx" }, // do produto inteiro
      ],
    });
    const rows = accessoryRows(comSubitem, 2, "s1");
    expect(rows.map((row) => row.name)).toEqual(["Ímã"]);
    expect(rows[0].qty).toBe(2);
  });

  it("acessório com qtd zero fica de fora", () => {
    const zerado = makeProduct({
      accessories: [{ desc: "Nada", qty: 0, unitPrice: 5, supplyId: "x" }],
    });
    expect(accessoryRows(zerado, 3)).toEqual([]);
  });
});

describe("wholeEventRows — ancoragem dos insumos", () => {
  const accessories = [{ desc: "Ímã", qty: 1, unitPrice: 0.5, supplyId: "ima" }];

  it("mono-máquina: os insumos vão na única linha", () => {
    const rows = wholeEventRows(
      makeProduct({ piecesCount: 3, accessories }),
      DEFAULT_MACHINES,
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].supplies[0].qty).toBe(3);
  });

  it("multi-máquina: só a PRIMEIRA linha carrega o insumo (senão conta duas vezes)", () => {
    const rows = wholeEventRows(
      makeProduct({
        piecesCount: 1,
        machineId: "a1",
        accessories,
        stages: [
          {
            id: "s1",
            name: "Base",
            machineId: "x2d",
            printHours: 1,
            laborMinutes: 0,
            filaments: [],
          },
        ],
      }),
      DEFAULT_MACHINES,
      [],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].supplies).toHaveLength(1);
    expect(rows[1].supplies).toEqual([]);
  });
});

describe("scaleRow + planEventRows", () => {
  const product = makeProduct({
    piecesCount: 2,
    printHours: 1,
    accessories: [{ desc: "Ímã", qty: 1, unitPrice: 0.5, supplyId: "ima" }],
  });

  it("escala os insumos pelo mesmo fator das gramas (placas)", () => {
    const [row] = wholeEventRows(product, DEFAULT_MACHINES, []);
    expect(row.supplies[0].qty).toBe(2); // 1/peça × 2 peças = 1 placa
    expect(scaleRow(row, 3).supplies[0].qty).toBe(6); // × 3 placas
  });

  it("a baixa chega ao estoque e ao custo congelado", () => {
    const [row] = wholeEventRows(product, DEFAULT_MACHINES, []);
    const supply = makeSupply({ id: "ima" });
    const planned = planEventRows(
      [scaleRow(row, 3)],
      "real",
      [],
      [supply],
      DEFAULT_MACHINES,
      () => "e1",
    );
    // 6 ímãs a R$0,50 = R$3,00, dentro do frozenCost.
    expect(planned.summary.supplies).toBeCloseTo(3);
    expect(planned.built[0].cost.supplies).toBeCloseTo(3);
    expect(planned.supplyUpdates[0].lots[0].remainingQty).toBe(994);
    expect(planned.built[0].supplyPlan.moves[0]).toMatchObject({
      kind: "supply",
      stockId: "ima",
      qty: 6,
    });
  });

  it("duas linhas do mesmo insumo deduzem em sequência (encadeado)", () => {
    const [row] = wholeEventRows(product, DEFAULT_MACHINES, []);
    const planned = planEventRows(
      [row, { ...row, key: "outra" }],
      "real",
      [],
      [makeSupply({ id: "ima" })],
      DEFAULT_MACHINES,
      () => "e1",
    );
    expect(planned.supplyUpdates[0].lots[0].remainingQty).toBe(996); // 1000 − 2 − 2
  });
});

// FEAT-06 — a composição acompanha o total em cada travessia. O invariante é
// sempre o mesmo (`sumFrozen(breakdown) === total`), mas os caminhos que podem
// quebrá-lo são distintos: somar N eventos, escalar por placas, cair no ramo sem
// máquina e fechar o payload gravável.
describe("FEAT-06 — frozenBreakdown no plano", () => {
  const product = makeProduct({
    piecesCount: 2,
    printHours: 1,
    accessories: [{ desc: "Ímã", qty: 1, unitPrice: 0.5, supplyId: "ima" }],
  });

  function plan(rows: ReturnType<typeof wholeEventRows>, machines = DEFAULT_MACHINES) {
    let n = 0;
    return planEventRows(rows, "real", [], [makeSupply({ id: "ima" })], machines, () => `e${++n}`);
  }

  it("a soma do breakdown é o frozen do summary", () => {
    const planned = plan(wholeEventRows(product, DEFAULT_MACHINES, []));
    expect(sumFrozen(planned.summary.frozenBreakdown)).toBeCloseTo(
      planned.summary.frozen,
      6,
    );
  });

  // Multi-máquina: N eventos numa placa só. Se o breakdown fosse somado num
  // segundo laço, ele e o `frozen` poderiam divergir sem sintoma.
  it("com 2 eventos, a soma dos componentes acompanha o total", () => {
    const [row] = wholeEventRows(product, DEFAULT_MACHINES, []);
    const outra = { ...row, key: "outra", machineId: DEFAULT_MACHINES[1]?.id ?? row.machineId };
    const planned = plan([row, outra]);
    expect(planned.built).toHaveLength(2);
    expect(sumFrozen(planned.summary.frozenBreakdown)).toBeCloseTo(
      planned.built[0].cost.total + planned.built[1].cost.total,
      6,
    );
  });

  it("escalar por placas escala cada componente junto", () => {
    const [row] = wholeEventRows(product, DEFAULT_MACHINES, []);
    const um = plan([row]).summary.frozenBreakdown;
    const tres = plan([scaleRow(row, 3)]).summary.frozenBreakdown;
    // Material/insumos/horas triplicam — o labor congelado da etapa não escala
    // com placas, então comparo componente a componente o que de fato escala.
    expect(tres.material).toBeCloseTo(um.material * 3, 6);
    expect(tres.supplies).toBeCloseTo(um.supplies * 3, 6);
    expect(tres.energy).toBeCloseTo(um.energy * 3, 6);
    expect(tres.depreciation).toBeCloseTo(um.depreciation * 3, 6);
  });

  // Ramo sem máquina (`planEventRows` cai no objeto montado à mão): o breakdown
  // tem que existir e ainda somar o total, senão o payload grava um objeto
  // incoerente com o `frozenCost`.
  it("sem máquina, o breakdown ainda bate com o total", () => {
    const planned = plan(wholeEventRows(product, DEFAULT_MACHINES, []), []);
    expect(sumFrozen(planned.summary.frozenBreakdown)).toBeCloseTo(
      planned.summary.frozen,
      6,
    );
  });

  it("buildProductionPayloads grava o breakdown, somando o frozenCost", () => {
    const planned = plan(wholeEventRows(product, DEFAULT_MACHINES, []));
    const [{ payload }] = buildProductionPayloads(planned.built, {
      at: 0,
      outcome: "estoque",
      mode: "real",
      createdAt: 0,
    });
    expect(payload.frozenBreakdown).toBeDefined();
    expect(sumFrozen(payload.frozenBreakdown!)).toBeCloseTo(payload.frozenCost, 6);
  });
});
