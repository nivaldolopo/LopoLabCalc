import { describe, expect, it } from "vitest";
import {
  planReciboReconciliation,
  reconcileReciboWrite,
  reverseReciboReconciliation,
  type ReconContext,
  type ReconItem,
} from "./saleReconciliation";
import { balanceG } from "./stock";
import { balanceOf } from "./finishedGoods";
import { DEFAULT_MACHINES, DEFAULT_PRODUCT_INPUT } from "../constants";
import type {
  FilamentRoll,
  FinishedGood,
  FinishedSku,
  FixedCostSettings,
  SavedProduct,
  StockFilament,
} from "../types";

const NO_FIXED: FixedCostSettings = {
  enabled: false,
  rent: 0,
  other: 0,
  machines: 1,
  hoursDay: 20,
  daysMonth: 26,
};

function makeProduct(over: Partial<SavedProduct> = {}): SavedProduct {
  return { ...DEFAULT_PRODUCT_INPUT, id: "p1", ...over } as SavedProduct;
}

function makeColor(
  id: string,
  rolls: Array<Partial<FilamentRoll>>,
): StockFilament {
  return {
    id,
    material: "PLA",
    brand: "Bambu",
    colorName: "Preto",
    minG: 0,
    archived: false,
    rolls: rolls.map((roll, index) => ({
      id: `${id}_r${index}`,
      purchaseDate: index,
      initialG: 1000,
      remainingG: 1000,
      pricePerKg: 100,
      ...roll,
    })),
    adjustments: [],
    createdAt: 0,
  };
}

function makeGood(skus: FinishedSku[]): FinishedGood {
  return {
    id: "p1",
    productId: "p1",
    productName: "Boneco",
    createdAt: 0,
    skus,
  };
}

// Contexto base; cada teste passa goods/colors/products próprios via spread.
function ctx(over: Partial<ReconContext>): ReconContext {
  let n = 0;
  return {
    goods: [],
    colors: [],
    supplies: [],
    products: [],
    machines: DEFAULT_MACHINES,
    fixedCosts: NO_FIXED,
    at: 1000,
    createdAt: 2000,
    genId: () => `e${(n += 1)}`,
    ...over,
  };
}

const acabadoItem = (over: Partial<ReconItem> = {}): ReconItem => ({
  key: "k1",
  productId: "p1",
  productName: "Boneco",
  quantity: 1,
  origem: "acabado",
  ...over,
});

const encomendaItem = (over: Partial<ReconItem> = {}): ReconItem => ({
  key: "k1",
  productId: "p1",
  productName: "Boneco",
  quantity: 1,
  origem: "encomenda",
  ...over,
});

describe("planReciboReconciliation — peça pronta (acabado)", () => {
  const good = makeGood([
    {
      name: "Boneco",
      layers: [
        { id: "e1__whole", at: 0, qty: 2, unitCost: 5, sourceEventId: "e1" },
        { id: "e2__whole", at: 10, qty: 3, unitCost: 7, sourceEventId: "e2" },
      ],
    },
  ]);

  it("drena o acabado FIFO, COGS pelo custo congelado, sem tocar filamento", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 3 })],
      ctx({ goods: [good], colors: [makeColor("preto", [{}])] }),
    );
    const item = recon.items[0];
    expect(item.cogsTotal).toBe(2 * 5 + 1 * 7); // 17
    expect(item.cogsUnit).toBeCloseTo(17 / 3);
    expect(item.finishedMoves).toHaveLength(2);
    expect(item.productionEventIds).toEqual([]);
    // Nenhuma encomenda → nada de produção, nada de baixa de filamento.
    expect(recon.productionPayloads).toEqual([]);
    expect(recon.colorUpdates).toEqual([]);
    // O acabado decrementa: 5 − 3 = 2.
    expect(recon.finishedUpdates).toHaveLength(1);
    expect(balanceOf({ ...recon.finishedUpdates[0], id: "p1" }, undefined)).toBe(2);
  });

  it("D4: vender além do saldo → shortfall e saldo negativo, sem bloquear", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 7 })], // saldo 5
      ctx({ goods: [good] }),
    );
    expect(recon.items[0].finishedShortfall).toBe(2);
    expect(balanceOf({ ...recon.finishedUpdates[0], id: "p1" }, undefined)).toBe(-2);
  });

  it("dois itens da mesma SKU drenam em sequência do saldo já mexido", () => {
    const recon = planReciboReconciliation(
      [
        acabadoItem({ key: "k1", quantity: 2 }),
        acabadoItem({ key: "k2", quantity: 2 }),
      ],
      ctx({ goods: [good] }),
    );
    // 4 no total, saldo 5 → sobra 1; nenhum shortfall.
    expect(recon.items[0].finishedShortfall).toBe(0);
    expect(recon.items[1].finishedShortfall).toBe(0);
    expect(balanceOf({ ...recon.finishedUpdates[0], id: "p1" }, undefined)).toBe(1);
  });

  it("acabado nunca produzido: sem doc, shortfall carrega o pedido (sem write)", () => {
    const recon = planReciboReconciliation([acabadoItem({ quantity: 2 })], ctx({}));
    expect(recon.items[0].finishedShortfall).toBe(2);
    expect(recon.items[0].finishedMoves).toEqual([]);
    expect(recon.finishedUpdates).toEqual([]);
  });
});

describe("planReciboReconciliation — encomenda (dispara produção)", () => {
  const product = makeProduct({
    filaments: [
      { filamentId: "preto", colorName: "Preto", totalG: 100, pricePerKg: 100 },
    ],
  });

  it("cria evento de produção, deduz filamento FIFO e referencia o eventId", () => {
    const recon = planReciboReconciliation(
      [encomendaItem()],
      ctx({ products: [product], colors: [makeColor("preto", [{ remainingG: 1000 }])] }),
    );
    const item = recon.items[0];
    expect(item.productionEventIds).toEqual(["e1"]);
    expect(item.finishedMoves).toEqual([]);
    expect(recon.finishedUpdates).toEqual([]);
    // Um evento de produção, desfecho encomenda, modo real, deduzindo 100 g.
    expect(recon.productionPayloads).toHaveLength(1);
    const payload = recon.productionPayloads[0].payload;
    expect(payload.outcome).toBe("encomenda");
    expect(payload.mode).toBe("real");
    expect(payload.at).toBe(1000);
    expect(payload.stockMoves).toEqual([
      { itemId: "e1", kind: "filament", stockId: "preto", rollId: "preto_r0", qty: 100 },
    ]);
    // A cor decrementa 100 g e o COGS inclui o material real (≥ 10).
    expect(recon.colorUpdates).toHaveLength(1);
    expect(balanceG(recon.colorUpdates[0])).toBe(900);
    expect(item.cogsTotal).toBeGreaterThanOrEqual(10);
    expect(item.cogsUnit).toBeCloseTo(item.cogsTotal);
  });

  it("quantidade > 1 escala a baixa (gramas e horas) por unidade", () => {
    const recon = planReciboReconciliation(
      [encomendaItem({ quantity: 3 })],
      ctx({ products: [product], colors: [makeColor("preto", [{ remainingG: 1000 }])] }),
    );
    // 3 × 100 g = 300 g deduzidos; saldo 700.
    expect(balanceG(recon.colorUpdates[0])).toBe(700);
    const payload = recon.productionPayloads[0].payload;
    expect(payload.printHours).toBeCloseTo(3 * DEFAULT_PRODUCT_INPUT.printHours);
    expect(payload.stockMoves.reduce((s, m) => s + m.qty, 0)).toBe(300);
    expect(recon.items[0].cogsUnit).toBeCloseTo(recon.items[0].cogsTotal / 3);
  });

  it("BUG-02: piecesCount=N divide a placa por peça (baixa e COGS por peça)", () => {
    // Mesa de 4 peças; o produto guarda a PLACA (100 g). Vender 2 peças = 2/4 de
    // placa → 50 g deduzidos, horas 2/4 da placa, COGS/peça = placa÷4.
    const mesa = makeProduct({
      piecesCount: 4,
      filaments: [
        { filamentId: "preto", colorName: "Preto", totalG: 100, pricePerKg: 100 },
      ],
    });
    const recon = planReciboReconciliation(
      [encomendaItem({ quantity: 2 })],
      ctx({ products: [mesa], colors: [makeColor("preto", [{ remainingG: 1000 }])] }),
    );
    expect(balanceG(recon.colorUpdates[0])).toBe(950); // 1000 − 50
    const payload = recon.productionPayloads[0].payload;
    expect(payload.stockMoves.reduce((s, m) => s + m.qty, 0)).toBeCloseTo(50);
    expect(payload.printHours).toBeCloseTo(
      (2 / 4) * DEFAULT_PRODUCT_INPUT.printHours,
    );
    expect(recon.items[0].cogsUnit).toBeCloseTo(recon.items[0].cogsTotal / 2);
  });

  it("D5: encomenda que atravessa rolo / estoura o estoque sinaliza avisos", () => {
    const recon = planReciboReconciliation(
      [encomendaItem()], // precisa de 100 g
      ctx({
        products: [product],
        colors: [makeColor("preto", [{ remainingG: 40 }])], // só 40 g
      }),
    );
    expect(recon.items[0].filamentShortfallG).toBe(60);
    expect(balanceG(recon.colorUpdates[0])).toBe(-60);
  });

  it("produto fora do catálogo: aviso, sem produção nem baixa", () => {
    const recon = planReciboReconciliation(
      [encomendaItem({ productId: "sumido" })],
      ctx({ products: [product], colors: [makeColor("preto", [{}])] }),
    );
    expect(recon.items[0].missingProduct).toBe(true);
    expect(recon.productionPayloads).toEqual([]);
    expect(recon.colorUpdates).toEqual([]);
  });

  it("duas encomendas na mesma cor encadeiam a baixa (ids únicos)", () => {
    const recon = planReciboReconciliation(
      [
        encomendaItem({ key: "k1" }),
        encomendaItem({ key: "k2" }),
      ],
      ctx({ products: [product], colors: [makeColor("preto", [{ remainingG: 1000 }])] }),
    );
    // 2 × 100 g do mesmo rolo → saldo 800; dois eventos distintos.
    expect(recon.productionPayloads.map((p) => p.id)).toEqual(["e1", "e2"]);
    expect(balanceG(recon.colorUpdates[0])).toBe(800);
  });
});

describe("recibo misto + estorno (round-trip)", () => {
  const good = makeGood([
    {
      name: "Boneco",
      layers: [{ id: "e0__whole", at: 0, qty: 4, unitCost: 6, sourceEventId: "e0" }],
    },
  ]);
  const product = makeProduct({
    id: "p2",
    filaments: [
      { filamentId: "preto", colorName: "Preto", totalG: 100, pricePerKg: 100 },
    ],
  });

  it("acabado + encomenda no mesmo recibo, cada um no seu caminho", () => {
    const recon = planReciboReconciliation(
      [
        acabadoItem({ key: "a", productId: "p1", quantity: 1 }),
        encomendaItem({ key: "b", productId: "p2", quantity: 1 }),
      ],
      ctx({
        goods: [good],
        products: [makeProduct({ id: "p1" }), product],
        colors: [makeColor("preto", [{ remainingG: 1000 }])],
      }),
    );
    expect(recon.items[0].finishedMoves).toHaveLength(1); // acabado
    expect(recon.items[1].productionEventIds).toEqual(["e1"]); // encomenda
    expect(recon.finishedUpdates).toHaveLength(1);
    expect(recon.colorUpdates).toHaveLength(1);
    expect(balanceG(recon.colorUpdates[0])).toBe(900);
  });

  it("reverseReciboReconciliation devolve acabado e filamento ao estado anterior", () => {
    const recon = planReciboReconciliation(
      [
        acabadoItem({ key: "a", productId: "p1", quantity: 2 }),
        encomendaItem({ key: "b", productId: "p2", quantity: 1 }),
      ],
      ctx({
        goods: [good],
        products: [makeProduct({ id: "p1" }), product],
        colors: [makeColor("preto", [{ remainingG: 1000 }])],
      }),
    );

    // Estado pós-venda: acabado 4−2=2; cor 1000−100=900.
    const goodAfter: FinishedGood = { ...recon.finishedUpdates[0], id: "p1" };
    const colorAfter = recon.colorUpdates[0];
    expect(balanceOf(goodAfter, undefined)).toBe(2);
    expect(balanceG(colorAfter)).toBe(900);

    // Estorno lê os moves gravados (acabado) + os stockMoves dos eventos (encomenda).
    const finishedMoves = recon.items.flatMap((i) => i.finishedMoves);
    const productionStockMoves = recon.productionPayloads.flatMap(
      (p) => p.payload.stockMoves,
    );
    const back = reverseReciboReconciliation(
      finishedMoves,
      productionStockMoves,
      [goodAfter],
      [colorAfter],
    );

    expect(balanceOf({ ...back.finishedUpdates[0], id: "p1" }, undefined)).toBe(4);
    expect(balanceG(back.colorUpdates[0])).toBe(1000);
  });
});

describe("reconcileReciboWrite — estornar-e-reaplicar (edição)", () => {
  it("old=null é igual ao forward, sem eventos a apagar", () => {
    const good = makeGood([
      { name: "Boneco", layers: [{ id: "e0__whole", at: 0, qty: 5, unitCost: 5, sourceEventId: "e0" }] },
    ]);
    const plan = reconcileReciboWrite(
      [acabadoItem({ quantity: 2 })],
      null,
      ctx({ goods: [good] }),
    );
    expect(plan.productionDeleteIds).toEqual([]);
    expect(balanceOf({ ...plan.finishedUpdates[0], id: "p1" }, undefined)).toBe(3);
  });

  it("editar acabado 3 → 2 devolve exatamente 1 ao estoque", () => {
    // Estado ATUAL (pós-venda antiga de 3): e1 zerada, e2 com 2 (saldo 2).
    const currentGood = makeGood([
      {
        name: "Boneco",
        layers: [
          { id: "e1__whole", at: 0, qty: 0, unitCost: 5, sourceEventId: "e1" },
          { id: "e2__whole", at: 10, qty: 2, unitCost: 7, sourceEventId: "e2" },
        ],
      },
    ]);
    const oldMoves = [
      { productId: "p1", layerId: "e1__whole", qty: 2, unitCost: 5, cost: 10 },
      { productId: "p1", layerId: "e2__whole", qty: 1, unitCost: 7, cost: 7 },
    ];
    const plan = reconcileReciboWrite(
      [acabadoItem({ quantity: 2 })],
      { finishedMoves: oldMoves, productionEvents: [] },
      ctx({ goods: [currentGood] }),
    );
    // Reverte +3 (saldo 5), reaplica −2 → saldo 3 (era 2, devolveu 1 líquido).
    expect(balanceOf({ ...plan.finishedUpdates[0], id: "p1" }, undefined)).toBe(3);
  });

  it("editar encomenda estorna o evento antigo (delete + filamento de volta) e cria o novo", () => {
    const product = makeProduct({
      filaments: [{ filamentId: "preto", colorName: "Preto", totalG: 100, pricePerKg: 100 }],
    });
    // Cor ATUAL já decrementada pela encomenda antiga (900); o evento antigo tirou 100.
    const currentColor = makeColor("preto", [{ remainingG: 900 }]);
    const oldEvent = {
      id: "old1",
      stockMoves: [
        { itemId: "old1", kind: "filament" as const, stockId: "preto", rollId: "preto_r0", qty: 100 },
      ],
    };
    const plan = reconcileReciboWrite(
      [encomendaItem({ quantity: 1 })],
      { finishedMoves: [], productionEvents: [oldEvent] },
      ctx({ products: [product], colors: [currentColor] }),
    );
    expect(plan.productionDeleteIds).toEqual(["old1"]);
    expect(plan.productionCreates).toHaveLength(1);
    // Reverte +100 (volta a 1000), reaplica −100 → 900 (o novo evento).
    expect(balanceG(plan.colorUpdates[0])).toBe(900);
  });
});
