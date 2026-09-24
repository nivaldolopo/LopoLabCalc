import { describe, expect, it } from "vitest";
import {
  planReciboReconciliation,
  reconcileReciboWrite,
  reverseReciboReconciliation,
  type ReconContext,
  type ReconItem,
} from "./saleReconciliation";
import { calculatePricing } from "./calculatePricing";
import { NO_COLOR_KEY } from "./filaments";
import { orphanFinishedContexts } from "./saleContext";
import { balanceQty } from "./supplies";
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
  Supply,
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
// S11: a chave é material + cor (a mesma que `colorKeyOf` dá ao cadastro).
const AZUL = { key: "cor:pla:azul", label: "Azul PLA" };
const VERMELHO = { key: "cor:pla:vermelho", label: "Vermelho PLA" };

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
    energyTariff: 0.8,
    at: 1000,
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
  colors: { [WHOLE_PART_KEY]: AZUL.key, a: AZUL.key, b: AZUL.key },
  ...over,
});

function makeSupply(id: string, remainingQty: number, unitPrice: number): Supply {
  return {
    id,
    name: id,
    unit: "un",
    minQty: 0,
    archived: false,
    lots: [
      { id: `${id}_l0`, purchaseDate: 0, initialQty: remainingQty, remainingQty, unitPrice },
    ],
    adjustments: [],
    createdAt: 0,
  };
}

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
    expect(item.acerto).toBe(false);
    // A venda não mexe em insumo quando não é conjunto.
    expect(item.supplyMoves).toEqual([]);
    expect(recon.supplyUpdates).toEqual([]);
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

  it("sem camada E sem cadastro (produto excluído): aviso, custo 0, sem write", () => {
    const recon = planReciboReconciliation([acabadoItem({ quantity: 2 })], ctx({}));
    expect(recon.items[0].missingProduct).toBe(true);
    expect(recon.items[0].acerto).toBe(false);
    expect(recon.items[0].cogsTotal).toBe(0);
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

// ---------------------------------------------------------------------------
// W1 (lote 2 da 3a) — venda sem peça registrada abre a camada de ACERTO.
//
// Com o S1 toda venda sai do acabado, e vender antes de registrar a produção
// virou caso comum. Antes: 0 move, custo 0, lucro = receita, saldo parado.
// ---------------------------------------------------------------------------
describe("W1 — venda sem peça registrada: camada de acerto", () => {
  const produto = makeProduct({
    name: "Boneco",
    failureRate: 10, // a reserva de falha NÃO entra no custo da camada
    filaments: [
      { filamentId: AZUL.key, colorName: "Azul", material: "PLA", totalG: 100, pricePerKg: 100 },
    ],
  });
  const precificado = calculatePricing(produto, DEFAULT_MACHINES, NO_FIXED, 0.8, [], []);
  const custoCadastro =
    precificado.materialCost +
    precificado.energyCost +
    precificado.depreciationCost +
    precificado.maintenanceCost +
    precificado.laborCost +
    precificado.accessoriesCost;
  // O modal manda "sem cor" quando a prateleira não oferece opção nenhuma.
  const semEscolha = (over: Partial<ReconItem> = {}) =>
    acabadoItem({ colors: { [WHOLE_PART_KEY]: NO_COLOR_KEY }, ...over });

  it("custo do CADASTRO (sem reserva de falha nem fixo) e saldo negativo", () => {
    const recon = planReciboReconciliation(
      [semEscolha({ quantity: 2 })],
      ctx({ products: [produto] }),
    );
    const item = recon.items[0];
    expect(item.acerto).toBe(true);
    expect(item.missingProduct).toBe(false);
    expect(item.cogsUnit).toBeCloseTo(custoCadastro, 6);
    expect(item.cogsUnit).toBeLessThan(precificado.totalCost); // sem a reserva
    expect(sumFrozen(item.cogsBreakdown!)).toBeCloseTo(item.cogsUnit, 6);
    expect(item.finishedShortfall).toBe(2);
    // Ninguém sabe quem imprimiu: tudo órfão no ROI.
    expect(item.machineUsage).toEqual([]);
    expect(item.unattributedUnits).toBe(2);
    // O doc nasce, na cor do CADASTRO — é onde a produção vai cair depois.
    const depois = { ...recon.finishedUpdates[0], id: "p1" };
    expect(item.colors[WHOLE_PART_KEY]).toBe(AZUL.key);
    expect(balanceOf(depois, undefined, AZUL.key)).toBe(-2);
    expect(depois.skus[0].layers[0].id.startsWith("acerto_")).toBe(true);
  });

  it("a produção registrada depois cobre o negativo, na MESMA SKU", () => {
    const recon = planReciboReconciliation(
      [semEscolha({ quantity: 2 })],
      ctx({ products: [produto] }),
    );
    const vendido = { ...recon.finishedUpdates[0], id: "p1" };
    const produzido = addProductionLayers(
      vendido,
      "p1",
      "Boneco",
      submissionEntries("Boneco", 50, { units: 5, color: AZUL }),
      "ev-depois",
      2000,
    );
    expect(balanceOf({ ...produzido, id: "p1" }, undefined, AZUL.key)).toBe(3);
  });

  it("estornar devolve o saldo a zero (a camada fica, zerada)", () => {
    const recon = planReciboReconciliation(
      [semEscolha({ quantity: 2 })],
      ctx({ products: [produto] }),
    );
    const vendido = { ...recon.finishedUpdates[0], id: "p1" };
    const back = reverseReciboReconciliation(recon.items[0].finishedMoves, [], [vendido], []);
    expect(balanceOf({ ...back.finishedUpdates[0], id: "p1" }, undefined, AZUL.key)).toBe(0);
  });

  it("reeditar NÃO abre uma segunda camada de acerto — o D4 cai na que já existe", () => {
    const primeira = reconcileReciboWrite(
      [semEscolha({ quantity: 2 })],
      null,
      ctx({ products: [produto] }),
    );
    const vendido = { ...primeira.finishedUpdates[0], id: "p1" };
    const reedicao = reconcileReciboWrite(
      [semEscolha({ quantity: 3 })],
      { finishedMoves: primeira.items[0].finishedMoves, supplyMoves: [] },
      ctx({ goods: [vendido], products: [produto] }),
    );
    const depois = { ...reedicao.finishedUpdates[0], id: "p1" };
    expect(depois.skus[0].layers).toHaveLength(1);
    expect(balanceOf(depois, undefined, AZUL.key)).toBe(-3);
    expect(reedicao.items[0].cogsUnit).toBeCloseTo(custoCadastro, 6);
  });

  it("SKU da cor do cadastro com camada zerada: o D4 cai nela, com o custo REAL", () => {
    const zerada = makeGood([
      { name: "Boneco", layers: [{ id: "e1__whole", at: 0, qty: 0, unitCost: 7, sourceEventId: "e1" }] },
    ]);
    const recon = planReciboReconciliation(
      [semEscolha({ quantity: 1 })],
      ctx({ goods: [zerada], products: [produto] }),
    );
    expect(recon.items[0].acerto).toBe(false);
    expect(recon.items[0].cogsUnit).toBe(7);
    expect(recon.items[0].finishedMoves.map((m) => m.layerId)).toEqual(["e1__whole"]);
  });

  it("conjunto: só a parte sem peça abre acerto; a outra sai da camada real", () => {
    const kitProduct = makeProduct({
      sellBySubitems: true,
      subitems: [
        { id: "a", name: "Base", stageKeys: [] },
        { id: "b", name: "Topo", stageKeys: [] },
      ],
    });
    const soBase = makeGood([
      { subitemId: "a", name: "Base", layers: [{ id: "e1__a", at: 0, qty: 3, unitCost: 6, sourceEventId: "e1" }] },
    ]);
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 1, colors: { a: AZUL.key, b: NO_COLOR_KEY } })],
      ctx({ goods: [soBase], products: [kitProduct] }),
    );
    const item = recon.items[0];
    expect(item.acerto).toBe(true);
    expect(item.finishedMoves).toHaveLength(2);
    // A base custa a camada real; o topo, o do cadastro da parte (> 0).
    expect(item.cogsTotal).toBeGreaterThan(6);
    const depois = { ...recon.finishedUpdates[0], id: "p1" };
    expect(balanceOf(depois, "a", AZUL.key)).toBe(2);
    expect(balanceOf(depois, "b", item.colors.b)).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// W4 (lote 2 da 3a) — o acessório do CONJUNTO sai na venda do conjunto.
// ---------------------------------------------------------------------------
describe("W4 — acessório do conjunto baixa na venda do conjunto", () => {
  const kit = makeGood([
    { subitemId: "a", name: "Base", layers: [{ id: "e1__a", at: 0, qty: 5, unitCost: 6, sourceEventId: "e1" }] },
    { subitemId: "b", name: "Topo", layers: [{ id: "e1__b", at: 0, qty: 5, unitCost: 4, sourceEventId: "e1" }] },
  ]);
  const kitProduct = makeProduct({
    sellBySubitems: true,
    subitems: [
      { id: "a", name: "Base", stageKeys: [] },
      { id: "b", name: "Topo", stageKeys: [] },
    ],
    accessories: [
      { desc: "Caixa", qty: 1, unitPrice: 2, supplyId: "caixa" }, // do conjunto
      { desc: "Ímã", qty: 2, unitPrice: 0.5, supplyId: "ima", subitemId: "a" }, // da parte
    ],
  });
  const estoque = () => [makeSupply("caixa", 10, 3), makeSupply("ima", 100, 0.5)];

  it("vender 2 conjuntos tira 2 caixas (FIFO) e o custo entra no COGS", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 2 })],
      ctx({ goods: [kit], products: [kitProduct], supplies: estoque() }),
    );
    const item = recon.items[0];
    // Partes (6 + 4) + a caixa pelo preço REAL do lote (3, não o 2 do cadastro).
    expect(item.cogsUnit).toBeCloseTo(6 + 4 + 3, 6);
    expect(item.supplyMoves).toEqual([
      { itemId: "e1", kind: "supply", stockId: "caixa", rollId: "caixa_l0", qty: 2 },
    ]);
    // O ímã é da PARTE: saiu na produção dela, não aqui.
    expect(recon.supplyUpdates.map((s) => s.id)).toEqual(["caixa"]);
    expect(balanceQty(recon.supplyUpdates[0])).toBe(8);
  });

  it("a caixa aparece como `supplies` na composição por unidade", () => {
    const semComposicao = planReciboReconciliation(
      [acabadoItem({ quantity: 2 })],
      ctx({ goods: [kit], products: [kitProduct], supplies: estoque() }),
    );
    // As camadas do teste não têm composição → parcial; o total segue certo.
    expect(semComposicao.items[0].cogsBreakdownPartial).toBe(true);
    expect(semComposicao.items[0].cogsBreakdown!.supplies).toBeCloseTo(3, 6);
  });

  it("vender uma PARTE avulsa não leva caixa", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 1, subitemId: "a" })],
      ctx({ goods: [kit], products: [kitProduct], supplies: estoque() }),
    );
    expect(recon.items[0].supplyMoves).toEqual([]);
    expect(recon.supplyUpdates).toEqual([]);
  });

  it("insumo sem saldo: a caixa fica negativa (D4) e o aviso sobe", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 3 })],
      ctx({ goods: [kit], products: [kitProduct], supplies: [makeSupply("caixa", 1, 3)] }),
    );
    expect(recon.items[0].supplyShortfall).toBe(2);
    expect(balanceQty(recon.supplyUpdates[0])).toBe(-2);
  });

  it("excluir a venda devolve as caixas", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 2 })],
      ctx({ goods: [kit], products: [kitProduct], supplies: estoque() }),
    );
    const back = reverseReciboReconciliation(
      recon.items[0].finishedMoves,
      recon.items[0].supplyMoves,
      [{ ...recon.finishedUpdates[0], id: "p1" }],
      recon.supplyUpdates,
    );
    expect(balanceQty(back.supplyUpdates[0])).toBe(10);
    expect(balanceOf({ ...back.finishedUpdates[0], id: "p1" }, "a", AZUL.key)).toBe(5);
  });

  it("reeditar 2 → 1 devolve uma caixa (estorno-e-reaplicação)", () => {
    const primeira = reconcileReciboWrite(
      [acabadoItem({ quantity: 2 })],
      null,
      ctx({ goods: [kit], products: [kitProduct], supplies: estoque() }),
    );
    const reedicao = reconcileReciboWrite(
      [acabadoItem({ quantity: 1 })],
      {
        finishedMoves: primeira.items[0].finishedMoves,
        supplyMoves: primeira.items[0].supplyMoves,
      },
      ctx({
        goods: [{ ...primeira.finishedUpdates[0], id: "p1" }],
        products: [kitProduct],
        supplies: primeira.supplyUpdates,
      }),
    );
    expect(balanceQty(reedicao.supplyUpdates[0])).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// W5 (lote 2 da 3a) — produto EXCLUÍDO não encalha o acabado.
// ---------------------------------------------------------------------------
describe("W5 — produto excluído", () => {
  const kit = makeGood([
    { subitemId: "a", name: "Base", layers: [{ id: "e1__a", at: 0, qty: 3, unitCost: 6, sourceEventId: "e1" }] },
    { subitemId: "b", name: "Topo", layers: [{ id: "e1__b", at: 0, qty: 2, unitCost: 4, sourceEventId: "e1" }] },
  ]);

  it("reeditar a venda de um CONJUNTO sem cadastro drena as partes do mapa de cores", () => {
    // Antes caía na SKU do inteiro (que um produto por partes não tem): custo 0.
    const recon = planReciboReconciliation(
      [acabadoItem({ quantity: 1, colors: { a: AZUL.key, b: AZUL.key } })],
      ctx({ goods: [kit], products: [] }),
    );
    expect(recon.items[0].missingProduct).toBe(false);
    expect(recon.items[0].cogsTotal).toBe(6 + 4);
    expect(recon.items[0].finishedShortfall).toBe(0);
  });

  it("as peças prontas dele continuam na lista vendável, uma por parte", () => {
    const itens = orphanFinishedContexts([kit], []);
    expect(itens.map((i) => i.subitemId)).toEqual(["a", "b"]);
    expect(itens[0].unitCost).toBe(6);
    // Sem cadastro não há preço sugerido: o dono digita.
    expect(itens[0].suggestedPrice).toBe(0);
  });

  it("produto vivo não entra como órfão; parte zerada também não", () => {
    expect(orphanFinishedContexts([kit], [{ id: "p1" }])).toEqual([]);
    const zerado = makeGood([
      { name: "Boneco", layers: [{ id: "x", at: 0, qty: 0, unitCost: 5, sourceEventId: "e" }] },
    ]);
    expect(orphanFinishedContexts([zerado], [])).toEqual([]);
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

  it("produto fora do catálogo, sem camada: não há o que detalhar", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ productId: "sumido" })],
      ctx({ products: [], colors: [] }),
    );
    expect(recon.items[0].cogsBreakdown).toBeUndefined();
    expect(recon.items[0].missingProduct).toBe(true);
  });
});

describe("estorno (round-trip)", () => {
  const good = makeGood([
    {
      name: "Boneco",
      layers: [{ id: "e0__whole", at: 0, qty: 4, unitCost: 6, sourceEventId: "e0" }],
    },
  ]);

  it("reverseReciboReconciliation devolve o acabado ao estado anterior", () => {
    const recon = planReciboReconciliation(
      [acabadoItem({ key: "a", productId: "p1", quantity: 2 })],
      ctx({ goods: [good], products: [makeProduct({ id: "p1" })] }),
    );
    const goodAfter: FinishedGood = { ...recon.finishedUpdates[0], id: "p1" };
    expect(balanceOf(goodAfter, undefined, AZUL.key)).toBe(2);

    const back = reverseReciboReconciliation(
      recon.items.flatMap((i) => i.finishedMoves),
      [],
      [goodAfter],
      [],
    );
    expect(balanceOf({ ...back.finishedUpdates[0], id: "p1" }, undefined, AZUL.key)).toBe(4);
    expect(back.supplyUpdates).toEqual([]);
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
      supplyMoves: [],
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
    expect(preview.supplyUpdates).toEqual(write.supplyUpdates);
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
  it("old=null é igual ao forward", () => {
    const good = makeGood([
      { name: "Boneco", layers: [{ id: "e0__whole", at: 0, qty: 5, unitCost: 5, sourceEventId: "e0" }] },
    ]);
    const plan = reconcileReciboWrite(
      [acabadoItem({ quantity: 2 })],
      null,
      ctx({ goods: [good] }),
    );
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
      { finishedMoves: oldMoves, supplyMoves: [] },
      ctx({ goods: [currentGood] }),
    );
    // Reverte +3 (saldo 5), reaplica −2 → saldo 3 (era 2, devolveu 1 líquido).
    expect(balanceOf({ ...plan.finishedUpdates[0], id: "p1" }, undefined, AZUL.key)).toBe(3);
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
      { colorKey: VERMELHO.key, colorLabel: VERMELHO.label, balance: 3 },
      { colorKey: AZUL.key, colorLabel: AZUL.label, balance: 2 },
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
