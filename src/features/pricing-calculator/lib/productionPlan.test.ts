import { describe, expect, it } from "vitest";
import { DEFAULT_MACHINES, DEFAULT_PRODUCT_INPUT } from "../constants";
import {
  accessoryRows,
  planEventRows,
  scaleRow,
  wholeEventRows,
} from "./productionPlan";
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
