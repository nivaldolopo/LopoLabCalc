import { describe, expect, it } from "vitest";
import {
  planReciboReconciliation,
  reconcileReciboWrite,
  reverseReciboReconciliation,
  type ReconContext,
  type ReconItem,
  type ReconItemResult,
} from "./saleReconciliation";
import { balanceG } from "./stock";
import {
  addProductionLayers,
  balanceOf,
  colorsWithBalance,
  goodValue,
  partBalance,
  reverseFinishedConsumption,
  submissionEntries,
  WHOLE_PART_KEY,
} from "./finishedGoods";
import { sumFrozen } from "./production";
import { DEFAULT_MACHINES, DEFAULT_PRODUCT_INPUT } from "../constants";
import type {
  FilamentRoll,
  FinishedGood,
  FinishedSku,
  FixedCostSettings,
  FrozenCostBreakdown,
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

// FEAT-11: toda SKU tem cor. Os testes anteriores ao recurso nao falam de cor —
// a semente poe AZUL em quem nao declarar, e os itens da cesta pedem essa mesma
// cor (`acabadoItem`). Quem testa cor declara.
const AZUL = { key: "fil_azul", label: "Azul" };
const VERMELHO = { key: "fil_verm", label: "Vermelho" };

type SkuSeed = Omit<FinishedSku, "colorKey" | "colorLabel"> &
  Partial<Pick<FinishedSku, "colorKey" | "colorLabel">>;

function makeGood(skus: SkuSeed[]): FinishedGood {
  return {
    id: "p1",
    productId: "p1",
    productName: "Boneco",
    createdAt: 0,
    skus: skus.map((sku) => ({
      ...sku,
      colorKey: sku.colorKey ?? AZUL.key,
      colorLabel: sku.colorLabel ?? AZUL.label,
    })),
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

// FEAT-11: a venda de peça pronta diz de QUE cor tirar, por parte. O default do
// helper é "tudo azul" — a cor que o `makeGood` semeia —, para os testes de FIFO
// /estorno seguirem falando do que testam. `colors` no `over` sobrescreve.
const acabadoItem = (over: Partial<ReconItem> = {}): ReconItem => ({
  key: "k1",
  productId: "p1",
  productName: "Boneco",
  quantity: 1,
  origem: "acabado",
  colors: { [WHOLE_PART_KEY]: AZUL.key, a: AZUL.key, b: AZUL.key },
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
    expect(balanceOf({ ...recon.finishedUpdates[0], id: "p1" }, undefined, AZUL.key)).toBe(2);
  });

  it("D4: vender além do saldo → shortfall e saldo negativo, sem bloquear", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 7 })], // saldo 5
      ctx({ goods: [good] }),
    );
    expect(recon.items[0].finishedShortfall).toBe(2);
    expect(balanceOf({ ...recon.finishedUpdates[0], id: "p1" }, undefined, AZUL.key)).toBe(-2);
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
    expect(balanceOf({ ...recon.finishedUpdates[0], id: "p1" }, undefined, AZUL.key)).toBe(1);
  });

  it("acabado nunca produzido: sem doc, shortfall carrega o pedido (sem write)", () => {
    const recon = planReciboReconciliation([acabadoItem({ quantity: 2 })], ctx({}));
    expect(recon.items[0].finishedShortfall).toBe(2);
    expect(recon.items[0].finishedMoves).toEqual([]);
    expect(recon.finishedUpdates).toEqual([]);
  });
});

// BUG-05: o INTEIRO de um produto que vende por partes sai do acabado das PARTES
// (não de uma SKU do inteiro, que a produção nunca cria).
describe("planReciboReconciliation — inteiro de produto com subitens (BUG-05)", () => {
  const kit = makeGood([
    { subitemId: "a", name: "Base", layers: [{ id: "e1__a", at: 0, qty: 3, unitCost: 6, sourceEventId: "e1" }] },
    { subitemId: "b", name: "Topo", layers: [{ id: "e1__b", at: 0, qty: 2, unitCost: 4, sourceEventId: "e1" }] },
  ]);
  const kitProduct = makeProduct({
    sellBySubitems: true,
    subitems: [
      { id: "a", name: "Base", stageKeys: [] },
      { id: "b", name: "Topo", stageKeys: [] },
    ],
  });

  it("vender 1 inteiro drena uma de cada parte; COGS = soma das partes", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 1 })], // subitemId undefined = o inteiro
      ctx({ goods: [kit], products: [kitProduct] }),
    );
    const item = recon.items[0];
    expect(item.finishedMoves).toHaveLength(2);
    expect(item.cogsTotal).toBe(6 + 4);
    expect(item.finishedShortfall).toBe(0);
    // As partes decrementam: a 3→2, b 2→1.
    const after = { ...recon.finishedUpdates[0], id: "p1" };
    expect(balanceOf(after, "a", AZUL.key)).toBe(2);
    expect(balanceOf(after, "b", AZUL.key)).toBe(1);
  });

  it("D4: vender além dos conjuntos montáveis fura a parte mais escassa", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 3 })], // só 2 montáveis (min = topo)
      ctx({ goods: [kit], products: [kitProduct] }),
    );
    expect(recon.items[0].finishedShortfall).toBe(1); // 3 − min(3,2)
    const after = { ...recon.finishedUpdates[0], id: "p1" };
    expect(balanceOf(after, "a", AZUL.key)).toBe(0);
    expect(balanceOf(after, "b", AZUL.key)).toBe(-1); // topo vai a negativo, não trava
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

// FEAT-06 — o COGS real deixa de ser um número solto: a reconciliação devolve a
// composição POR UNIDADE, na mesma escala do `SaleCostBreakdown` precificado,
// para os dois aparecerem lado a lado na venda.
describe("planReciboReconciliation — composição do COGS (FEAT-06)", () => {
  const bd: FrozenCostBreakdown = {
    material: 3,
    energy: 0.5,
    depreciation: 0.5,
    maintenance: 0,
    labor: 1,
    supplies: 0,
  }; // soma 5
  const goodComBd = makeGood([
    {
      name: "Boneco",
      layers: [
        { id: "e1__whole", at: 0, qty: 9, unitCost: 5, costBreakdown: bd, sourceEventId: "e1" },
      ],
    },
  ]);

  // qty = 3 é o teste que pega o ÷qty esquecido: com quantidade 1 um breakdown
  // total e um por unidade são indistinguíveis.
  it("acabado com qty 3: a composição é POR UNIDADE", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 3 })],
      ctx({ goods: [goodComBd] }),
    );
    const item = recon.items[0];
    expect(item.cogsUnit).toBeCloseTo(5, 6);
    expect(item.cogsBreakdown!.material).toBeCloseTo(3, 6); // não 9
    expect(sumFrozen(item.cogsBreakdown!)).toBeCloseTo(item.cogsUnit, 6);
    expect(item.cogsBreakdownPartial).toBe(false);
  });

  it("camada anterior ao FEAT-06 marca partial (o unitCost segue correto)", () => {
    const antigo = makeGood([
      {
        name: "Boneco",
        layers: [{ id: "velha", at: 0, qty: 5, unitCost: 5, sourceEventId: "e0" }],
      },
    ]);
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 2 })],
      ctx({ goods: [antigo] }),
    );
    expect(recon.items[0].cogsBreakdownPartial).toBe(true);
    expect(recon.items[0].cogsUnit).toBeCloseTo(5, 6);
  });

  it("encomenda com qty 3: composição por unidade, nunca parcial", () => {
    const product = makeProduct({
      filaments: [
        { filamentId: "preto", colorName: "Preto", totalG: 100, pricePerKg: 100 },
      ],
    });
    const recon = planReciboReconciliation(
      [encomendaItem({ quantity: 3 })],
      ctx({ products: [product], colors: [makeColor("preto", [{ remainingG: 1000 }])] }),
    );
    const item = recon.items[0];
    expect(sumFrozen(item.cogsBreakdown!)).toBeCloseTo(item.cogsUnit, 6);
    expect(item.cogsUnit * 3).toBeCloseTo(item.cogsTotal, 6);
    expect(item.cogsBreakdownPartial).toBe(false);
  });

  // Onde escala (÷pieces) e rateio se cruzam — o cenário do BUG-02.
  it("encomenda de mesa (piecesCount 4): composição por PEÇA", () => {
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
    const item = recon.items[0];
    expect(sumFrozen(item.cogsBreakdown!)).toBeCloseTo(item.cogsUnit, 6);
    expect(item.cogsUnit * 2).toBeCloseTo(item.cogsTotal, 6);
  });

  it("produto fora do catálogo não tem o que detalhar", () => {
    const recon = planReciboReconciliation(
      [encomendaItem({ productId: "sumido" })],
      ctx({ products: [], colors: [] }),
    );
    expect(recon.items[0].cogsBreakdown).toBeUndefined();
    expect(recon.items[0].missingProduct).toBe(true);
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
    expect(balanceOf(goodAfter, undefined, AZUL.key)).toBe(2);
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

    expect(balanceOf({ ...back.finishedUpdates[0], id: "p1" }, undefined, AZUL.key)).toBe(4);
    expect(balanceG(back.colorUpdates[0])).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// UX-42 — o preview da edição precisa ESTORNAR antes de simular.
//
// O preview chamava `planReciboReconciliation` (forward puro) enquanto a
// gravação chamava `reconcileReciboWrite(..., old, ...)`. Resultado: a simulação
// não creditava de volta o que o recibo ANTIGO já tinha consumido e acusava
// falta que a gravação não produzia.
// ---------------------------------------------------------------------------
describe("UX-42 — preview de edição bate com a gravação", () => {
  // O cenário medido na auditoria: 1 conjunto em estoque, editar 1 → 2.
  const cenario1para2 = () => {
    // Saldo ATUAL = 1 (a venda antiga de 1 já saiu de uma camada de 2).
    const good = makeGood([
      { name: "Boneco", layers: [{ id: "e1__whole", at: 0, qty: 1, unitCost: 5, sourceEventId: "e1" }] },
    ]);
    const old = {
      finishedMoves: [
        { productId: "p1", layerId: "e1__whole", qty: 1, unitCost: 5, cost: 5 },
      ],
      productionEvents: [],
    };
    return { good, old };
  };

  it("não acusa saldo negativo onde a gravação não produz nenhum", () => {
    const { good, old } = cenario1para2();
    const preview = planReciboReconciliation(
      [acabadoItem({ quantity: 2 })],
      ctx({ goods: [good] }),
      old,
    );
    // Estorna +1 (saldo 2), reaplica −2 → 0. Sem overdraft.
    expect(preview.items[0].finishedShortfall).toBe(0);
    expect(balanceOf({ ...preview.finishedUpdates[0], id: "p1" }, undefined, AZUL.key)).toBe(0);
  });

  it("SEM o estorno o preview mentia — é a regressão que este item fecha", () => {
    const { good } = cenario1para2();
    const semEstorno = planReciboReconciliation(
      [acabadoItem({ quantity: 2 })],
      ctx({ goods: [good] }),
      // `old` omitido = o comportamento antigo
    );
    expect(semEstorno.items[0].finishedShortfall).toBe(1);
  });

  it("preview e gravação devolvem os MESMOS números (acabado)", () => {
    const { good, old } = cenario1para2();
    // Contexto novo por chamada (o `genId` do helper é um contador).
    const itens = [acabadoItem({ quantity: 2 })];
    const preview = planReciboReconciliation(itens, ctx({ goods: [good] }), old);
    const write = reconcileReciboWrite(itens, old, ctx({ goods: [good] }));
    expect(preview.items).toEqual(write.items);
    expect(preview.finishedUpdates).toEqual(write.finishedUpdates);
    expect(preview.colorUpdates).toEqual(write.colorUpdates);
    expect(preview.supplyUpdates).toEqual(write.supplyUpdates);
  });

  it("preview e gravação concordam também na ENCOMENDA (crossesRoll e falta)", () => {
    // O outro lado do item: sem estorno, a encomenda editada parecia atravessar
    // rolo e faltar filamento que na verdade volta.
    const product = makeProduct({
      filaments: [{ filamentId: "preto", colorName: "Preto", totalG: 100, pricePerKg: 100 }],
    });
    const currentColor = makeColor("preto", [{ remainingG: 60 }]);
    const old = {
      finishedMoves: [],
      productionEvents: [
        {
          id: "old1",
          stockMoves: [
            { itemId: "old1", kind: "filament" as const, stockId: "preto", rollId: "preto_r0", qty: 100 },
          ],
        },
      ],
    };
    // ⚠ Um contexto NOVO para cada chamada: o `genId` do helper é um contador,
    // e reusar o mesmo objeto faria a segunda chamada continuar de onde a
    // primeira parou.
    const feitoCtx = () => ctx({ products: [product], colors: [currentColor] });
    const preview = planReciboReconciliation([encomendaItem({ quantity: 1 })], feitoCtx(), old);
    const write = reconcileReciboWrite([encomendaItem({ quantity: 1 })], old, feitoCtx());

    // Estorna +100 (saldo 160), reaplica −100 → 60. Não falta nada.
    expect(preview.items[0].filamentShortfallG).toBe(0);
    expect(preview.items[0].crossesRoll).toBe(write.items[0].crossesRoll);
    // `productionEventIds` é a ÚNICA divergência esperada, e é de propósito: o
    // preview gera com um id fixo ("preview") porque o custo não depende dele,
    // enquanto a gravação usa os ids definitivos. Todo o resto tem que bater.
    const semIds = (r: ReconItemResult) => ({ ...r, productionEventIds: [] });
    expect(semIds(preview.items[0])).toEqual(semIds(write.items[0]));
    expect(preview.colorUpdates).toEqual(write.colorUpdates);
  });

  it("venda NOVA (old ausente) segue idêntica ao que era", () => {
    const good = makeGood([
      { name: "Boneco", layers: [{ id: "e0__whole", at: 0, qty: 5, unitCost: 5, sourceEventId: "e0" }] },
    ]);
    const contexto = ctx({ goods: [good] });
    const semOld = planReciboReconciliation([acabadoItem({ quantity: 2 })], contexto);
    const comNull = planReciboReconciliation([acabadoItem({ quantity: 2 })], contexto, null);
    expect(semOld).toEqual(comNull);
    expect(semOld.items[0].finishedShortfall).toBe(0);
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
    expect(balanceOf({ ...plan.finishedUpdates[0], id: "p1" }, undefined, AZUL.key)).toBe(3);
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
    expect(balanceOf({ ...plan.finishedUpdates[0], id: "p1" }, undefined, AZUL.key)).toBe(3);
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

// ---------------------------------------------------------------------------
// FEAT-11 — a venda de peça pronta escolhe DE QUAL COR tirar
// ---------------------------------------------------------------------------

describe("planReciboReconciliation — cor na baixa do acabado (FEAT-11)", () => {
  const duasCores = makeGood([
    {
      name: "Boneco",
      colorKey: AZUL.key,
      colorLabel: AZUL.label,
      layers: [{ id: "az", at: 0, qty: 2, unitCost: 5, sourceEventId: "e1" }],
    },
    {
      name: "Boneco",
      colorKey: VERMELHO.key,
      colorLabel: VERMELHO.label,
      layers: [{ id: "vm", at: 10, qty: 3, unitCost: 9, sourceEventId: "e2" }],
    },
  ]);

  it("drena a cor ESCOLHIDA, com o custo congelado daquela cor", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 2, colors: { [WHOLE_PART_KEY]: VERMELHO.key } })],
      ctx({ goods: [duasCores] }),
    );
    expect(recon.items[0].finishedMoves.map((m) => m.layerId)).toEqual(["vm"]);
    expect(recon.items[0].cogsTotal).toBe(2 * 9); // custo do vermelho, não do azul
    const after = { ...recon.finishedUpdates[0], id: "p1" };
    expect(balanceOf(after, undefined, VERMELHO.key)).toBe(1);
    expect(balanceOf(after, undefined, AZUL.key)).toBe(2); // intacto
  });

  it("uma cor NÃO empresta da outra: falta vira shortfall (D4)", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 4, colors: { [WHOLE_PART_KEY]: AZUL.key } })], // só 2 azuis
      ctx({ goods: [duasCores] }),
    );
    expect(recon.items[0].finishedShortfall).toBe(2);
    expect(
      balanceOf({ ...recon.finishedUpdates[0], id: "p1" }, undefined, VERMELHO.key),
    ).toBe(3);
  });

  // O produto multicor DE PROJETO: corpo azul + tampa vermelha. Cada parte sai da
  // sua prateleira — exigir uma cor só no conjunto zeraria este produto.
  it("conjunto multicor drena cada parte na sua cor", () => {
    const kit = makeGood([
      {
        subitemId: "a",
        name: "Corpo",
        colorKey: AZUL.key,
        colorLabel: AZUL.label,
        layers: [{ id: "c-az", at: 0, qty: 3, unitCost: 6, sourceEventId: "e1" }],
      },
      {
        subitemId: "b",
        name: "Tampa",
        colorKey: VERMELHO.key,
        colorLabel: VERMELHO.label,
        layers: [{ id: "t-vm", at: 0, qty: 3, unitCost: 4, sourceEventId: "e1" }],
      },
    ]);
    const kitProduct = makeProduct({
      sellBySubitems: true,
      subitems: [
        { id: "a", name: "Corpo", stageKeys: [] },
        { id: "b", name: "Tampa", stageKeys: [] },
      ],
    });
    const recon = planReciboReconciliation(
      [
        acabadoItem({
          quantity: 2,
          colors: { a: AZUL.key, b: VERMELHO.key },
        }),
      ],
      ctx({ goods: [kit], products: [kitProduct] }),
    );
    expect(recon.items[0].finishedShortfall).toBe(0);
    expect(recon.items[0].cogsTotal).toBe(2 * 6 + 2 * 4);
    const after = { ...recon.finishedUpdates[0], id: "p1" };
    expect(balanceOf(after, "a", AZUL.key)).toBe(1);
    expect(balanceOf(after, "b", VERMELHO.key)).toBe(1);
  });

  it("venda sem cor declarada cai no balde 'sem cor' (dado pré-FEAT-11)", () => {
    const antigo = makeGood([
      {
        name: "Boneco",
        colorKey: "__nocolor__",
        colorLabel: "Sem cor",
        layers: [{ id: "velha", at: 0, qty: 4, unitCost: 5, sourceEventId: "e0" }],
      },
    ]);
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 1, colors: undefined })],
      ctx({ goods: [antigo] }),
    );
    expect(recon.items[0].finishedMoves.map((m) => m.layerId)).toEqual(["velha"]);
    expect(recon.items[0].finishedShortfall).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FEAT-11 — o ciclo completo, atravessando produção → acabado → venda
// ---------------------------------------------------------------------------
// Os testes acima cobrem cada peça isolada. Este monta o caminho inteiro com as
// funções REAIS (só o Firestore fica de fora): é o que responde "produzir em
// duas cores e vender uma delas funciona de ponta a ponta?".

describe("FEAT-11 — ciclo produzir 2 cores → vender 1 (integração)", () => {
  // 2 peças azuis (placa de R$ 30) + 3 vermelhas (placa de R$ 45).
  const azuis = addProductionLayers(
    null,
    "p1",
    "Boneco",
    submissionEntries("Boneco", 30, { units: 2, color: AZUL }),
    "ev-azul",
    0,
  );
  const good: FinishedGood = {
    ...addProductionLayers(
      { ...azuis, id: "p1" },
      "p1",
      "Boneco",
      submissionEntries("Boneco", 45, { units: 3, color: VERMELHO }),
      "ev-verm",
      10,
    ),
    id: "p1",
  };

  it("a produção abre uma SKU por cor, com o custo de cada tiragem", () => {
    expect(good.skus).toHaveLength(2);
    expect(balanceOf(good, undefined, AZUL.key)).toBe(2);
    expect(balanceOf(good, undefined, VERMELHO.key)).toBe(3);
    expect(partBalance(good, undefined)).toBe(5); // a prateleira toda
    // R$ 15/un no azul (30÷2) e R$ 15/un no vermelho (45÷3) — mesmo custo, cores
    // diferentes: o que distingue as SKUs é a cor, não o preço.
    expect(goodValue(good)).toBeCloseTo(30 + 45, 6);
  });

  it("o seletor da venda oferece as duas, maior saldo primeiro", () => {
    expect(colorsWithBalance(good)).toEqual([
      { colorKey: VERMELHO.key, colorLabel: "Vermelho", balance: 3 },
      { colorKey: AZUL.key, colorLabel: "Azul", balance: 2 },
    ]);
  });

  it("vender 2 vermelhas drena só o vermelho, com o COGS congelado daquela tiragem", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 2, colors: { [WHOLE_PART_KEY]: VERMELHO.key } })],
      ctx({ goods: [good], products: [makeProduct()] }),
    );
    const item = recon.items[0];
    expect(item.cogsUnit).toBeCloseTo(15, 6);
    expect(item.cogsTotal).toBeCloseTo(30, 6);
    expect(item.finishedShortfall).toBe(0);

    const depois = { ...recon.finishedUpdates[0], id: "p1" };
    expect(balanceOf(depois, undefined, VERMELHO.key)).toBe(1);
    expect(balanceOf(depois, undefined, AZUL.key)).toBe(2); // intacto
    expect(partBalance(depois, undefined)).toBe(3);
  });

  it("estornar a venda devolve à MESMA cor de onde saiu", () => {
    const plan = planReciboReconciliation(
      [acabadoItem({ quantity: 2, colors: { [WHOLE_PART_KEY]: VERMELHO.key } })],
      ctx({ goods: [good], products: [makeProduct()] }),
    );
    const vendido = { ...plan.finishedUpdates[0], id: "p1" };
    const devolvido = reverseFinishedConsumption(
      vendido,
      plan.items[0].finishedMoves,
    );
    expect(balanceOf(devolvido, undefined, VERMELHO.key)).toBe(3);
    expect(balanceOf(devolvido, undefined, AZUL.key)).toBe(2);
  });
});
