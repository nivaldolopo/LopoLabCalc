import { describe, expect, it } from "vitest";
import {
  addProductionLayers,
  applyFinishedConsumption,
  assemblableWholes,
  assemblyBreakdown,
  balanceOf,
  colorEntriesOf,
  colorRecordOf,
  colorsWithBalance,
  consumeFifo,
  consumeWholeFifo,
  findSku,
  goodCostComposition,
  goodValue,
  partBalance,
  removeEventLayers,
  reverseFinishedConsumption,
  skuBalance,
  skuValue,
  submissionEntries,
  WHOLE_PART_KEY,
} from "./finishedGoods";
import { NO_COLOR, NO_COLOR_KEY, NO_COLOR_LABEL } from "./filaments";
import { addFrozen, scaleFrozen, sumFrozen, ZERO_FROZEN } from "./production";
import type {
  FinishedGood,
  FinishedLayer,
  FinishedSku,
  FrozenCostBreakdown,
} from "../types";

const DIA = 24 * 60 * 60 * 1000;

// FEAT-11: toda SKU tem cor. Os testes anteriores ao FEAT-11 não falam de cor —
// a semente abaixo põe AZUL em quem não declarar, para eles seguirem lendo sobre
// o que testam (FIFO, rateio, estorno) sem ruído. Quem testa cor declara.
const AZUL = { key: "fil_azul", label: "Azul" };
const VERMELHO = { key: "fil_verm", label: "Vermelho" };

type SkuSeed = Omit<FinishedSku, "colorKey" | "colorLabel"> &
  Partial<Pick<FinishedSku, "colorKey" | "colorLabel">>;

// Partes de um conjunto, todas na mesma cor (o caso comum).
const parts = (...subitemIds: string[]) =>
  subitemIds.map((subitemId) => ({ subitemId, colorKey: AZUL.key }));

function makeGood(
  over: Omit<Partial<FinishedGood>, "skus"> & { skus: SkuSeed[] },
): FinishedGood {
  return {
    id: "prod-1",
    productId: "prod-1",
    productName: "Boneco",
    createdAt: 0,
    ...over,
    skus: over.skus.map((sku) => ({
      ...sku,
      colorKey: sku.colorKey ?? AZUL.key,
      colorLabel: sku.colorLabel ?? AZUL.label,
    })),
  };
}

describe("addProductionLayers", () => {
  it("cria o doc na 1ª produção de um produto sem subitens (SKU do inteiro)", () => {
    const payload = addProductionLayers(
      null,
      "prod-1",
      "Boneco",
      [{ name: "Boneco", qty: 2, unitCost: 5 }],
      "e1",
      DIA,
    );
    expect(payload.productId).toBe("prod-1");
    expect(payload.createdAt).toBe(DIA);
    expect(payload.skus).toHaveLength(1);
    const sku = payload.skus[0];
    expect(sku.subitemId).toBeUndefined();
    expect(skuBalance(sku)).toBe(2);
    expect(sku.layers[0]).toMatchObject({
      qty: 2,
      unitCost: 5,
      sourceEventId: "e1",
      at: DIA,
    });
  });

  it("empilha uma nova camada num doc existente (mais um evento na mesma SKU)", () => {
    const good = makeGood({
      skus: [
        {
          name: "Boneco",
          layers: [{ id: "e1__whole", at: 0, qty: 2, unitCost: 5, sourceEventId: "e1" }],
        },
      ],
    });
    const payload = addProductionLayers(
      good,
      "prod-1",
      "Boneco",
      [{ name: "Boneco", color: AZUL, qty: 3, unitCost: 7 }],
      "e2",
      DIA,
    );
    expect(payload.createdAt).toBe(0); // preserva o createdAt do doc existente
    expect(payload.skus[0].layers).toHaveLength(2);
    expect(skuBalance(payload.skus[0])).toBe(5); // 2 + 3
  });

  it("um inteiro com subitens vira +1 em cada SKU de subitem (custo rateado)", () => {
    const payload = addProductionLayers(
      null,
      "prod-1",
      "Kit",
      [
        { subitemId: "a", name: "Base", color: AZUL, qty: 1, unitCost: 6 },
        { subitemId: "b", name: "Topo", color: AZUL, qty: 1, unitCost: 4 },
      ],
      "e1",
      0,
    );
    expect(payload.skus).toHaveLength(2);
    expect(balanceOf({ ...payload, id: "prod-1" }, "a", AZUL.key)).toBe(1);
    expect(balanceOf({ ...payload, id: "prod-1" }, "b", AZUL.key)).toBe(1);
  });

  it("ignora entradas com qty ≤ 0", () => {
    const payload = addProductionLayers(
      null,
      "prod-1",
      "Boneco",
      [
        { name: "Boneco", qty: 0, unitCost: 5 },
        { subitemId: "a", name: "Base", qty: -1, unitCost: 5 },
      ],
      "e1",
      0,
    );
    expect(payload.skus).toHaveLength(0);
  });

  it("a camada nasce com id determinístico evento+SKU (estável p/ o estorno)", () => {
    const payload = addProductionLayers(
      null,
      "prod-1",
      "Kit",
      [
        { name: "Kit", color: AZUL, qty: 1, unitCost: 5 },
        { subitemId: "a", name: "Base", color: AZUL, qty: 1, unitCost: 3 },
      ],
      "e1",
      0,
    );
    const ids = payload.skus.map((sku) => sku.layers[0].id);
    expect(ids).toContain(`e1____whole__::${AZUL.key}`); // SKU do inteiro
    expect(ids).toContain(`e1__a::${AZUL.key}`); // SKU do subitem
  });
});

// TD-023 — a garantia que o comentário prometia desde sempre e o código nao
// cumpria: reaplicar o MESMO evento na MESMA SKU duplicava a camada (mesmo id) e
// dobrava o saldo. Hoje inalcançável pela UI (quem chama grava com `batch.set`,
// que sobrescreve o doc inteiro), mas quem confiasse na promessa se machucaria.
describe("addProductionLayers — idempotente por evento (TD-023)", () => {
  const entries = [{ name: "Boneco", color: AZUL, qty: 4, unitCost: 3 }];

  it("aplicar o mesmo evento 2x da o mesmo doc que aplicar 1x", () => {
    const uma = addProductionLayers(null, "prod-1", "Boneco", entries, "EV1", DIA);
    const duas = addProductionLayers(
      uma as unknown as FinishedGood,
      "prod-1",
      "Boneco",
      entries,
      "EV1",
      DIA,
    );
    expect(duas.skus[0].layers).toHaveLength(1);
    expect(skuBalance(duas.skus[0])).toBe(4);
    expect(JSON.stringify(duas)).toBe(JSON.stringify(uma));
  });

  it("evento DIFERENTE na mesma SKU continua empilhando", () => {
    const uma = addProductionLayers(null, "prod-1", "Boneco", entries, "EV1", DIA);
    const dois = addProductionLayers(
      uma as unknown as FinishedGood,
      "prod-1",
      "Boneco",
      entries,
      "EV2",
      DIA,
    );
    expect(dois.skus[0].layers).toHaveLength(2);
    expect(skuBalance(dois.skus[0])).toBe(8);
  });

  it("o mesmo evento em SKU de outra COR abre camada propria", () => {
    const uma = addProductionLayers(null, "prod-1", "Boneco", entries, "EV1", DIA);
    const duas = addProductionLayers(
      uma as unknown as FinishedGood,
      "prod-1",
      "Boneco",
      [{ name: "Boneco", color: VERMELHO, qty: 4, unitCost: 3 }],
      "EV1",
      DIA,
    );
    expect(duas.skus).toHaveLength(2);
    expect(duas.skus.map((sku) => skuBalance(sku))).toEqual([4, 4]);
  });
});

// A assimetria deliberada do outro lado: `shiftLayers` é DELTA. Deduplicar por
// `layerId` ali engoliria o 2o de dois recibos que drenam a mesma camada — e
// estornar um devolveria o material do outro junto.
describe("applyFinishedConsumption/reverse — DELTA, não idempotente (TD-023)", () => {
  const good = makeGood({
    skus: [
      {
        name: "Boneco",
        layers: [{ id: "e1__whole", at: 0, qty: 10, unitCost: 5, sourceEventId: "e1" }],
      },
    ],
  });
  const move = [{ productId: "prod-1", layerId: "e1__whole", qty: 3 }];

  it("duas baixas do mesmo tamanho na mesma camada somam as duas", () => {
    const uma = applyFinishedConsumption(good, move as never);
    const duas = applyFinishedConsumption(uma, move as never);
    expect(skuBalance(duas.skus[0])).toBe(4);
  });

  it("cada estorno devolve o seu — e o round-trip fecha", () => {
    const uma = applyFinishedConsumption(good, move as never);
    const duas = applyFinishedConsumption(uma, move as never);
    const volta = reverseFinishedConsumption(
      reverseFinishedConsumption(duas, move as never),
      move as never,
    );
    expect(skuBalance(volta.skus[0])).toBe(10);
  });
});

describe("removeEventLayers (estorno)", () => {
  it("remove exatamente as camadas do evento, mantendo as dos outros", () => {
    const good = makeGood({
      skus: [
        {
          name: "Boneco",
          layers: [
            { id: "e1__whole", at: 0, qty: 2, unitCost: 5, sourceEventId: "e1" },
            { id: "e2__whole", at: DIA, qty: 3, unitCost: 7, sourceEventId: "e2" },
          ],
        },
      ],
    });
    const after = removeEventLayers(good, "e1");
    expect(after.skus[0].layers).toHaveLength(1);
    expect(after.skus[0].layers[0].sourceEventId).toBe("e2");
    expect(skuBalance(after.skus[0])).toBe(3);
  });

  it("é o round-trip de addProductionLayers (volta ao estado anterior)", () => {
    const base = makeGood({
      skus: [
        {
          name: "Boneco",
          layers: [{ id: "e1__whole", at: 0, qty: 2, unitCost: 5, sourceEventId: "e1" }],
        },
      ],
    });
    const grown = addProductionLayers(base, "prod-1", "Boneco", [{ name: "Boneco", color: AZUL, qty: 3, unitCost: 7 }], "e2", DIA);
    const reverted = removeEventLayers({ ...grown, id: "prod-1" }, "e2");
    expect(skuBalance(reverted.skus[0])).toBe(2);
  });
});

describe("consumeFifo (passo 8 — descreve)", () => {
  const good = makeGood({
    skus: [
      {
        name: "Boneco",
        layers: [
          { id: "e1__whole", at: 0, qty: 2, unitCost: 5, sourceEventId: "e1" },
          { id: "e2__whole", at: DIA, qty: 3, unitCost: 7, sourceEventId: "e2" },
        ],
      },
    ],
  });

  it("consome da camada mais antiga primeiro (FIFO), COGS pelo custo congelado", () => {
    const res = consumeFifo(good, undefined, AZUL.key, 1);
    expect(res.moves).toHaveLength(1);
    expect(res.moves[0].layerId).toBe("e1__whole");
    expect(res.cost).toBe(5); // 1 × custo congelado da 1ª camada
    expect(res.shortfall).toBe(0);
  });

  it("atravessa camadas com custo misto exato", () => {
    const res = consumeFifo(good, undefined, AZUL.key, 3); // 2×5 (e1) + 1×7 (e2)
    expect(res.moves).toHaveLength(2);
    expect(res.cost).toBe(2 * 5 + 1 * 7);
    expect(res.shortfall).toBe(0);
  });

  it("D4: passar do saldo total gera shortfall na camada mais nova, sem truncar", () => {
    const res = consumeFifo(good, undefined, AZUL.key, 7); // saldo 5; faltam 2
    expect(res.shortfall).toBe(2);
    // O excedente engrossa o move da camada mais nova (e2), não cria um segundo.
    const e2 = res.moves.filter((m) => m.layerId === "e2__whole");
    expect(e2).toHaveLength(1);
    expect(e2[0].qty).toBe(3 + 2);
  });

  it("SKU inexistente/qtd zero → sem move; shortfall carrega o pedido", () => {
    expect(consumeFifo(good, "nao-existe", AZUL.key, 4)).toEqual({
      moves: [],
      cost: 0,
      shortfall: 4,
      breakdown: ZERO_FROZEN,
      costUnknown: 0,
    });
    expect(consumeFifo(good, undefined, AZUL.key, 0).moves).toHaveLength(0);
  });
});

// FEAT-06 — a composição do COGS acompanha o FIFO. O invariante é
// `sumFrozen(breakdown) + costUnknown === cost` em TODOS os casos, inclusive os
// dois que quebram implementações ingênuas: overdraft e camada antiga.
describe("consumeFifo — composição do COGS (FEAT-06)", () => {
  const bdA: FrozenCostBreakdown = { ...ZERO_FROZEN, material: 3, labor: 2 }; // 5
  const bdB: FrozenCostBreakdown = { ...ZERO_FROZEN, material: 4, supplies: 3 }; // 7
  const good = makeGood({
    skus: [
      {
        name: "Boneco",
        layers: [
          { id: "e1__whole", at: 0, qty: 2, unitCost: 5, costBreakdown: bdA, sourceEventId: "e1" },
          { id: "e2__whole", at: DIA, qty: 3, unitCost: 7, costBreakdown: bdB, sourceEventId: "e2" },
        ],
      },
    ],
  });

  it("consumo numa camada só devolve a composição dela", () => {
    const res = consumeFifo(good, undefined, AZUL.key, 2);
    expect(res.breakdown.material).toBeCloseTo(6, 6);
    expect(res.breakdown.labor).toBeCloseTo(4, 6);
    expect(sumFrozen(res.breakdown)).toBeCloseTo(res.cost, 6);
  });

  it("atravessando camadas, soma ponderada das duas composições", () => {
    const res = consumeFifo(good, undefined, AZUL.key, 3); // 2 de A + 1 de B
    expect(res.breakdown.material).toBeCloseTo(3 * 2 + 4, 6);
    expect(res.breakdown.supplies).toBeCloseTo(3, 6);
    expect(res.costUnknown).toBe(0);
    expect(sumFrozen(res.breakdown)).toBeCloseTo(res.cost, 6);
  });

  // O teste que pega o bug de acumular a composição DENTRO do laço FIFO: o
  // overdraft engrossa o move da camada mais nova depois dele, e a fatia
  // excedente ficaria de fora dos componentes.
  it("D4: o excedente entra na composição da camada mais nova", () => {
    const res = consumeFifo(good, undefined, AZUL.key, 7); // saldo 5, faltam 2
    expect(res.shortfall).toBe(2);
    expect(sumFrozen(res.breakdown)).toBeCloseTo(res.cost, 6);
    // 2 de A + (3+2) de B
    expect(res.breakdown.supplies).toBeCloseTo(3 * 5, 6);
  });

  it("camada anterior ao FEAT-06 vira costUnknown, sem furar a soma", () => {
    const misto = makeGood({
      skus: [
        {
          name: "Boneco",
          layers: [
            { id: "velha", at: 0, qty: 2, unitCost: 5, sourceEventId: "e0" },
            { id: "nova", at: DIA, qty: 2, unitCost: 7, costBreakdown: bdB, sourceEventId: "e2" },
          ],
        },
      ],
    });
    const res = consumeFifo(misto, undefined, AZUL.key, 3); // 2 velhas + 1 nova
    expect(res.costUnknown).toBeCloseTo(10, 6);
    expect(sumFrozen(res.breakdown)).toBeCloseTo(7, 6);
    expect(sumFrozen(res.breakdown) + res.costUnknown).toBeCloseTo(res.cost, 6);
  });
});

describe("assemblableWholes (min das partes)", () => {
  const kit = makeGood({
    skus: [
      { subitemId: "a", name: "Base", layers: [{ id: "e1__a", at: 0, qty: 3, unitCost: 6, sourceEventId: "e1" }] },
      { subitemId: "b", name: "Topo", layers: [{ id: "e1__b", at: 0, qty: 1, unitCost: 4, sourceEventId: "e1" }] },
    ],
  });

  it("inteiro montável = menor saldo entre os subitens (a lacuna aparece)", () => {
    expect(assemblableWholes(kit, ["a", "b"])).toBe(1); // 3 bases, 1 topo → 1 conjunto
  });

  it("subitem nunca produzido conta como 0 (não infla o inteiro)", () => {
    expect(assemblableWholes(kit, ["a", "b", "c"])).toBe(0);
  });

  it("produto sem subitens → saldo do inteiro", () => {
    const whole = makeGood({
      skus: [{ name: "Boneco", layers: [{ id: "e1__whole", at: 0, qty: 4, unitCost: 5, sourceEventId: "e1" }] }],
    });
    expect(assemblableWholes(whole, [])).toBe(4);
  });
});

// BUG-05: vender o INTEIRO de um produto que vende por partes drena uma de cada
// parte (o acabado guarda SKUs de subitem, não uma do inteiro).
describe("consumeWholeFifo (venda do conjunto — BUG-05)", () => {
  const kit = makeGood({
    skus: [
      { subitemId: "a", name: "Base", layers: [{ id: "e1__a", at: 0, qty: 3, unitCost: 6, sourceEventId: "e1" }] },
      { subitemId: "b", name: "Topo", layers: [{ id: "e1__b", at: 0, qty: 1, unitCost: 4, sourceEventId: "e1" }] },
    ],
  });

  it("um conjunto consome uma de cada parte; custo = soma das partes", () => {
    const res = consumeWholeFifo(kit, parts("a", "b"), 1);
    expect(res.moves).toHaveLength(2);
    expect(res.moves.map((m) => m.layerId).sort()).toEqual(["e1__a", "e1__b"]);
    expect(res.cost).toBe(6 + 4);
    expect(res.shortfall).toBe(0);
  });

  it("D4: além do conjunto montável, a parte mais escassa fura (shortfall = qty − min)", () => {
    const res = consumeWholeFifo(kit, parts("a", "b"), 2); // só 1 montável (topo)
    expect(res.shortfall).toBe(1); // 2 − min(3,1)
    expect(res.cost).toBe(2 * 6 + 2 * 4); // topo vai a negativo, não trunca
    // O excedente engrossa o move da camada do topo, sem criar um segundo.
    expect(res.moves.filter((m) => m.layerId === "e1__b")).toHaveLength(1);
    expect(res.moves.find((m) => m.layerId === "e1__b")?.qty).toBe(2);
  });

  it("parte nunca produzida conta no shortfall (sem move)", () => {
    const res = consumeWholeFifo(kit, parts("a", "b", "c"), 1);
    expect(res.shortfall).toBe(1); // 'c' não existe → 1 conjunto incompleto
    expect(res.cost).toBe(6 + 4); // a e b saem; c não tem de onde tirar
  });

  it("sem subitens cai no consumo do inteiro (SKU __whole__)", () => {
    const whole = makeGood({
      skus: [{ name: "Boneco", layers: [{ id: "e1__whole", at: 0, qty: 4, unitCost: 5, sourceEventId: "e1" }] }],
    });
    const res = consumeWholeFifo(whole, [{ colorKey: AZUL.key }], 2);
    expect(res.moves).toHaveLength(1);
    expect(res.moves[0].layerId).toBe("e1__whole");
    expect(res.cost).toBe(2 * 5);
  });
});

describe("submissionEntries (delta da submissão — FEAT-05b)", () => {
  it("inteiro sem subitens → 1 SKU do inteiro com o custo cheio", () => {
    const entries = submissionEntries("Boneco", 30, {});
    expect(entries).toEqual([
      { name: "Boneco", color: NO_COLOR, qty: 1, unitCost: 30 },
    ]);
  });

  it("subitem avulso selecionado → 1 SKU daquele subitem, custo cheio", () => {
    const entries = submissionEntries("Kit", 12, {
      subitemId: "a",
      subitemName: "Base",
    });
    expect(entries).toEqual([
      { subitemId: "a", name: "Base", color: NO_COLOR, qty: 1, unitCost: 12 },
    ]);
  });

  it("inteiro com subitens → 1 SKU por subitem, rateio pelo cost (soma = total)", () => {
    const entries = submissionEntries("Kit", 30, {
      subitems: [
        { id: "a", name: "Base", cost: 6 },
        { id: "b", name: "Topo", cost: 4 },
      ],
    });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ subitemId: "a", name: "Base", color: NO_COLOR, qty: 1, unitCost: 18 }); // 30×6/10
    expect(entries[1]).toEqual({ subitemId: "b", name: "Topo", color: NO_COLOR, qty: 1, unitCost: 12 }); // 30×4/10
    const soma = entries.reduce((s, e) => s + e.unitCost, 0);
    expect(soma).toBeCloseTo(30); // o inteiro = Σ partes (aditivo)
  });

  it("Σcost = 0 (degenerado) → divide o custo igual entre os subitens", () => {
    const entries = submissionEntries("Kit", 10, {
      subitems: [
        { id: "a", name: "Base", cost: 0 },
        { id: "b", name: "Topo", cost: 0 },
      ],
    });
    expect(entries[0].unitCost).toBe(5);
    expect(entries[1].unitCost).toBe(5);
  });

  it("BUG-02: units = piecesCount × placas → N acabados a custo ÷ units (inteiro)", () => {
    // Mesa de 4 peças, placa custou 40 → 4 acabados a 10 cada (valor conservado).
    const entries = submissionEntries("Boneco", 40, { units: 4 });
    expect(entries).toEqual([{ name: "Boneco", color: NO_COLOR, qty: 4, unitCost: 10 }]);
    expect(entries[0].qty * entries[0].unitCost).toBeCloseTo(40);
  });

  it("BUG-02: units + rateio de subitens → cada SKU N unidades a (parte ÷ N)", () => {
    const entries = submissionEntries("Kit", 30, {
      units: 4, // mesa de 4
      subitems: [
        { id: "a", name: "Base", cost: 6 },
        { id: "b", name: "Topo", cost: 4 },
      ],
    });
    expect(entries[0]).toEqual({ subitemId: "a", name: "Base", color: NO_COLOR, qty: 4, unitCost: 4.5 }); // 18/4
    expect(entries[1]).toEqual({ subitemId: "b", name: "Topo", color: NO_COLOR, qty: 4, unitCost: 3 }); // 12/4
    // valor total (qty × unitCost) = 30 (aditivo, conservado)
    const val = entries.reduce((s, e) => s + e.qty * e.unitCost, 0);
    expect(val).toBeCloseTo(30);
  });

  it("BUG-02: units no subitem avulso selecionado", () => {
    const entries = submissionEntries("Kit", 12, {
      subitemId: "a",
      subitemName: "Base",
      units: 4,
    });
    expect(entries).toEqual([
      { subitemId: "a", name: "Base", color: NO_COLOR, qty: 4, unitCost: 3 },
    ]);
  });

  it("empilhada por addProductionLayers, o inteiro montável = 1 (min das partes)", () => {
    // Uma submissão do inteiro com 2 subitens vira +1 em cada → 1 conjunto.
    const entries = submissionEntries("Kit", 30, {
      subitems: [
        { id: "a", name: "Base", cost: 6 },
        { id: "b", name: "Topo", cost: 4 },
      ],
    });
    const payload = addProductionLayers(null, "prod-1", "Kit", entries, "e1", 0);
    const good: FinishedGood = { ...payload, id: "prod-1" };
    expect(assemblableWholes(good, ["a", "b"])).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// FEAT-06 — a composição congelada desce da submissão até a camada
// ---------------------------------------------------------------------------

// Um breakdown de R$ 30 (o total das submissões abaixo), para o invariante
// `sumFrozen(unitBreakdown) === unitCost` ser verificável em cada forma.
const BD30: FrozenCostBreakdown = {
  material: 12,
  energy: 3,
  depreciation: 6,
  maintenance: 1,
  labor: 5,
  supplies: 3,
};

describe("submissionEntries com breakdown (FEAT-06)", () => {
  // Não-regressão: quem não passa o breakdown continua recebendo a entrada
  // exatamente como antes — nada de campo com zeros sintéticos.
  it("sem breakdown, a entrada não ganha unitBreakdown", () => {
    const [entry] = submissionEntries("Boneco", 30, { units: 3 });
    expect(entry.unitBreakdown).toBeUndefined();
    expect(entry).toEqual({ name: "Boneco", color: NO_COLOR, qty: 3, unitCost: 10 });
  });

  it("inteiro sem subitens: cada componente é dividido por units", () => {
    const [entry] = submissionEntries("Boneco", 30, { units: 6, breakdown: BD30 });
    expect(entry.unitCost).toBeCloseTo(5, 6);
    expect(entry.unitBreakdown!.material).toBeCloseTo(2, 6); // 12/6
    expect(entry.unitBreakdown!.labor).toBeCloseTo(5 / 6, 6);
    expect(sumFrozen(entry.unitBreakdown!)).toBeCloseTo(entry.unitCost, 6);
  });

  // O ponto onde rateio e escala se cruzam: cada componente tem que ser rateado
  // 60/40 E dividido por units, pelo mesmo fator que produziu o unitCost.
  it("inteiro com subitens 6:4 rateia componente a componente", () => {
    const entries = submissionEntries("Kit", 30, {
      units: 2,
      breakdown: BD30,
      subitems: [
        { id: "a", name: "Base", cost: 6 },
        { id: "b", name: "Topo", cost: 4 },
      ],
    });
    expect(entries[0].unitBreakdown!.material).toBeCloseTo(12 * 0.6 / 2, 6);
    expect(entries[1].unitBreakdown!.material).toBeCloseTo(12 * 0.4 / 2, 6);
    for (const entry of entries) {
      expect(sumFrozen(entry.unitBreakdown!)).toBeCloseTo(entry.unitCost, 6);
    }
    // Nada se perde nem se cria no rateio: Σ (qty × componente) = o original.
    const total = entries.reduce(
      (acc, e) => addFrozen(acc, scaleFrozen(e.unitBreakdown!, e.qty)),
      ZERO_FROZEN,
    );
    expect(total.material).toBeCloseTo(BD30.material, 6);
    expect(sumFrozen(total)).toBeCloseTo(30, 6);
  });

  it("Σcost = 0 (degenerado): divide igual, sem NaN", () => {
    const entries = submissionEntries("Kit", 30, {
      breakdown: BD30,
      subitems: [
        { id: "a", name: "Base", cost: 0 },
        { id: "b", name: "Topo", cost: 0 },
      ],
    });
    expect(entries[0].unitBreakdown!.material).toBeCloseTo(6, 6);
    expect(Number.isNaN(entries[0].unitBreakdown!.material)).toBe(false);
    expect(sumFrozen(entries[0].unitBreakdown!)).toBeCloseTo(15, 6);
  });

  it("subitem avulso selecionado leva o breakdown cheio ÷ units", () => {
    const [entry] = submissionEntries("Kit", 30, {
      subitemId: "a",
      subitemName: "Base",
      units: 3,
      breakdown: BD30,
    });
    expect(sumFrozen(entry.unitBreakdown!)).toBeCloseTo(entry.unitCost, 6);
    expect(entry.unitBreakdown!.supplies).toBeCloseTo(1, 6); // 3/3
  });
});

describe("addProductionLayers com breakdown (FEAT-06)", () => {
  it("a camada nasce com o costBreakdown da entrada", () => {
    const entries = submissionEntries("Boneco", 30, { units: 2, breakdown: BD30 });
    const payload = addProductionLayers(null, "prod-1", "Boneco", entries, "e1", 0);
    const [layer] = payload.skus[0].layers;
    expect(sumFrozen(layer.costBreakdown!)).toBeCloseTo(layer.unitCost, 6);
  });

  it("entrada sem breakdown gera camada SEM o campo", () => {
    const entries = submissionEntries("Boneco", 30, { units: 2 });
    const payload = addProductionLayers(null, "prod-1", "Boneco", entries, "e1", 0);
    expect(payload.skus[0].layers[0].costBreakdown).toBeUndefined();
  });

  it("round-trip: removeEventLayers tira a camada com breakdown", () => {
    const entries = submissionEntries("Boneco", 30, { units: 2, breakdown: BD30 });
    const payload = addProductionLayers(null, "prod-1", "Boneco", entries, "e1", 0);
    const good: FinishedGood = { ...payload, id: "prod-1" };
    expect(removeEventLayers(good, "e1").skus[0].layers).toEqual([]);
  });
});

describe("goodCostComposition (FEAT-06)", () => {
  function layer(over: Partial<FinishedLayer> & { id: string }): FinishedLayer {
    return { at: 0, qty: 1, unitCost: 10, sourceEventId: "e1", ...over };
  }

  it("decompõe o valor parado e bate com o goodValue", () => {
    const bd: FrozenCostBreakdown = { ...ZERO_FROZEN, material: 6, labor: 4 };
    const good = makeGood({
      skus: [
        { name: "Boneco", layers: [layer({ id: "l1", qty: 3, costBreakdown: bd })] },
      ],
    });
    const comp = goodCostComposition(good);
    expect(comp.breakdown.material).toBeCloseTo(18, 6);
    expect(comp.breakdown.labor).toBeCloseTo(12, 6);
    expect(comp.unknown).toBe(0);
    expect(comp.total).toBeCloseTo(goodValue(good), 6);
  });

  // Camada anterior ao FEAT-06: o valor dela não pode sumir dos totais nem
  // aparecer como componente — vira `unknown` ("não detalhado" na tela).
  it("camada sem breakdown vira unknown, e a soma ainda fecha", () => {
    const bd: FrozenCostBreakdown = { ...ZERO_FROZEN, material: 10 };
    const good = makeGood({
      skus: [
        {
          name: "Boneco",
          layers: [
            layer({ id: "l1", qty: 2, unitCost: 10, costBreakdown: bd }),
            layer({ id: "l2", qty: 1, unitCost: 7 }), // antiga
          ],
        },
      ],
    });
    const comp = goodCostComposition(good);
    expect(comp.unknown).toBeCloseTo(7, 6);
    expect(sumFrozen(comp.breakdown) + comp.unknown).toBeCloseTo(comp.total, 6);
    expect(comp.total).toBeCloseTo(goodValue(good), 6);
  });

  // D4: saldo negativo é um buraco real — os componentes acompanham, não clampam.
  it("saldo negativo dá componentes negativos, com a soma batendo", () => {
    const bd: FrozenCostBreakdown = { ...ZERO_FROZEN, material: 6, labor: 4 };
    const good = makeGood({
      skus: [{ name: "Boneco", layers: [layer({ id: "l1", qty: -2, costBreakdown: bd })] }],
    });
    const comp = goodCostComposition(good);
    expect(comp.breakdown.material).toBeCloseTo(-12, 6);
    expect(comp.total).toBeCloseTo(goodValue(good), 6);
  });

  it("sem doc, devolve zero", () => {
    expect(goodCostComposition(null)).toEqual({
      breakdown: ZERO_FROZEN,
      total: 0,
      unknown: 0,
    });
  });
});

describe("goodValue / skuValue (valor congelado parado)", () => {
  it("soma qty × custo congelado das camadas, por SKU e no produto todo", () => {
    const kit = makeGood({
      skus: [
        {
          subitemId: "a",
          name: "Base",
          layers: [
            { id: "e1__a", at: 0, qty: 2, unitCost: 6, sourceEventId: "e1" },
            { id: "e2__a", at: DIA, qty: 1, unitCost: 8, sourceEventId: "e2" },
          ],
        },
        {
          subitemId: "b",
          name: "Topo",
          layers: [{ id: "e1__b", at: 0, qty: 1, unitCost: 4, sourceEventId: "e1" }],
        },
      ],
    });
    expect(skuValue(kit.skus[0])).toBe(2 * 6 + 1 * 8); // 20
    expect(goodValue(kit)).toBe(20 + 4); // 24
    expect(goodValue(null)).toBe(0);
  });

  it("saldo negativo (D4) puxa o valor para baixo, não zera", () => {
    const good = makeGood({
      skus: [
        {
          name: "Boneco",
          layers: [{ id: "e1__whole", at: 0, qty: -2, unitCost: 5, sourceEventId: "e1" }],
        },
      ],
    });
    expect(goodValue(good)).toBe(-10);
  });
});

describe("assemblyBreakdown (conjunto + lacuna — 05c)", () => {
  const kit = makeGood({
    skus: [
      { subitemId: "a", name: "Base", layers: [{ id: "e1__a", at: 0, qty: 3, unitCost: 6, sourceEventId: "e1" }] },
      { subitemId: "b", name: "Topo", layers: [{ id: "e1__b", at: 0, qty: 1, unitCost: 4, sourceEventId: "e1" }] },
    ],
  });

  it("wholes = min das partes; a sobra vira leftover (a lacuna)", () => {
    const bd = assemblyBreakdown(kit, [
      { id: "a", name: "Base" },
      { id: "b", name: "Topo" },
    ]);
    expect(bd.wholes).toBe(1); // 3 bases, 1 topo → 1 conjunto
    expect(bd.hasGap).toBe(true); // sobram 2 bases avulsas
    const base = bd.parts.find((p) => p.subitemId === "a")!;
    const topo = bd.parts.find((p) => p.subitemId === "b")!;
    expect(base).toMatchObject({ balance: 3, leftover: 2 });
    expect(topo).toMatchObject({ balance: 1, leftover: 0 });
  });

  it("partes iguais → sem lacuna (hasGap false)", () => {
    const par = makeGood({
      skus: [
        { subitemId: "a", name: "Base", layers: [{ id: "e1__a", at: 0, qty: 2, unitCost: 6, sourceEventId: "e1" }] },
        { subitemId: "b", name: "Topo", layers: [{ id: "e1__b", at: 0, qty: 2, unitCost: 4, sourceEventId: "e1" }] },
      ],
    });
    const bd = assemblyBreakdown(par, [
      { id: "a", name: "Base" },
      { id: "b", name: "Topo" },
    ]);
    expect(bd.wholes).toBe(2);
    expect(bd.hasGap).toBe(false);
  });

  it("parte nunca produzida conta 0 → nenhum conjunto montável, resto é lacuna", () => {
    const bd = assemblyBreakdown(kit, [
      { id: "a", name: "Base" },
      { id: "b", name: "Topo" },
      { id: "c", name: "Enfeite" },
    ]);
    expect(bd.wholes).toBe(0);
    expect(bd.hasGap).toBe(true);
    expect(bd.parts.find((p) => p.subitemId === "c")).toMatchObject({
      balance: 0,
      leftover: 0,
    });
  });
});

describe("applyFinishedConsumption / reverseFinishedConsumption (passo 8)", () => {
  const good = makeGood({
    skus: [
      {
        name: "Boneco",
        layers: [
          { id: "e1__whole", at: 0, qty: 2, unitCost: 5, sourceEventId: "e1" },
          { id: "e2__whole", at: DIA, qty: 3, unitCost: 7, sourceEventId: "e2" },
        ],
      },
    ],
  });

  it("aplica a baixa que o consumeFifo descreveu (drena as camadas)", () => {
    const res = consumeFifo(good, undefined, AZUL.key, 3); // 2 de e1 + 1 de e2
    const after = applyFinishedConsumption(good, res.moves);
    expect(skuBalance(after.skus[0])).toBe(5 - 3);
    expect(after.skus[0].layers[0].qty).toBe(0); // e1 zerada
    expect(after.skus[0].layers[1].qty).toBe(2); // e2: 3 − 1
    // Puro: o doc original não muda.
    expect(skuBalance(good.skus[0])).toBe(5);
  });

  it("round-trip: reverter devolve exatamente o que a venda drenou", () => {
    const res = consumeFifo(good, undefined, AZUL.key, 4);
    const after = applyFinishedConsumption(good, res.moves);
    const back = reverseFinishedConsumption(after, res.moves);
    expect(skuBalance(back.skus[0])).toBe(5);
    expect(back.skus[0].layers.map((l) => l.qty)).toEqual([2, 3]);
  });

  it("D4: vender além do saldo deixa a camada mais nova negativa (não trunca)", () => {
    const res = consumeFifo(good, undefined, AZUL.key, 7); // saldo 5, faltam 2
    const after = applyFinishedConsumption(good, res.moves);
    expect(skuBalance(after.skus[0])).toBe(-2);
    // e reverter cura o buraco de volta ao saldo original.
    expect(skuBalance(reverseFinishedConsumption(after, res.moves).skus[0])).toBe(5);
  });

  it("moves de outro produto passam batido (cada doc aplica só o seu)", () => {
    const res = consumeFifo(good, undefined, AZUL.key, 1);
    const alheio = res.moves.map((m) => ({ ...m, productId: "outro" }));
    expect(applyFinishedConsumption(good, alheio)).toBe(good); // sem delta → mesmo obj
  });
});

describe("findSku / balanceOf", () => {
  it("acha a SKU do inteiro e a do subitem; 0 para SKU ausente", () => {
    const good = makeGood({
      skus: [{ subitemId: "a", name: "Base", layers: [{ id: "e1__a", at: 0, qty: 2, unitCost: 6, sourceEventId: "e1" }] }],
    });
    expect(findSku(good, "a", AZUL.key)?.name).toBe("Base");
    expect(findSku(good, "x", AZUL.key)).toBeUndefined();
    expect(balanceOf(good, "a", AZUL.key)).toBe(2);
    expect(balanceOf(good, "x", AZUL.key)).toBe(0);
    expect(balanceOf(null, "a", AZUL.key)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FEAT-11 — a cor como 2ª dimensão da SKU
// ---------------------------------------------------------------------------

const camada = (id: string, qty: number, unitCost = 5) => ({
  id,
  at: 0,
  qty,
  unitCost,
  sourceEventId: id,
});

describe("cor na SKU (FEAT-11) — a mesma peça em duas cores são dois saldos", () => {
  it("produzir em outra cor abre SKU nova, não engorda a existente", () => {
    const azul = addProductionLayers(
      null,
      "prod-1",
      "Boneco",
      [{ name: "Boneco", color: AZUL, qty: 2, unitCost: 5 }],
      "e1",
      0,
    );
    const ambas = addProductionLayers(
      { ...azul, id: "prod-1" },
      "prod-1",
      "Boneco",
      [{ name: "Boneco", color: VERMELHO, qty: 3, unitCost: 6 }],
      "e2",
      DIA,
    );
    const good: FinishedGood = { ...ambas, id: "prod-1" };
    expect(good.skus).toHaveLength(2);
    expect(balanceOf(good, undefined, AZUL.key)).toBe(2);
    expect(balanceOf(good, undefined, VERMELHO.key)).toBe(3);
    // ...e a prateleira inteira continua sendo 5 peças.
    expect(partBalance(good, undefined)).toBe(5);
  });

  it("a mesma cor soma na mesma SKU (dois eventos, um saldo)", () => {
    const um = addProductionLayers(null, "prod-1", "Boneco", [{ name: "Boneco", color: AZUL, qty: 2, unitCost: 5 }], "e1", 0);
    const dois = addProductionLayers({ ...um, id: "prod-1" }, "prod-1", "Boneco", [{ name: "Boneco", color: AZUL, qty: 3, unitCost: 6 }], "e2", DIA);
    expect(dois.skus).toHaveLength(1);
    expect(skuBalance(dois.skus[0])).toBe(5);
  });

  it("o id da camada carrega a cor (duas cores no mesmo evento não colidem)", () => {
    const payload = addProductionLayers(
      null,
      "prod-1",
      "Kit",
      [
        { subitemId: "a", name: "Corpo", color: AZUL, qty: 1, unitCost: 6 },
        { subitemId: "b", name: "Tampa", color: VERMELHO, qty: 1, unitCost: 4 },
      ],
      "e1",
      0,
    );
    const ids = payload.skus.map((sku) => sku.layers[0].id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain(`e1__a::${AZUL.key}`);
    expect(ids).toContain(`e1__b::${VERMELHO.key}`);
  });

  it("o rótulo acompanha a cor viva, sem partir o saldo (a chave é o id)", () => {
    const antes = addProductionLayers(null, "prod-1", "Boneco", [{ name: "Boneco", color: AZUL, qty: 1, unitCost: 5 }], "e1", 0);
    const depois = addProductionLayers(
      { ...antes, id: "prod-1" },
      "prod-1",
      "Boneco",
      [{ name: "Boneco", color: { key: AZUL.key, label: "Azul Bebê" }, qty: 1, unitCost: 5 }],
      "e2",
      DIA,
    );
    expect(depois.skus).toHaveLength(1);
    expect(depois.skus[0].colorLabel).toBe("Azul Bebê");
  });

  it("entrada sem cor cai na sentinela (avulso / dado anterior ao FEAT-11)", () => {
    const payload = addProductionLayers(null, "prod-1", "Boneco", [{ name: "Boneco", qty: 1, unitCost: 5 }], "e1", 0);
    expect(payload.skus[0].colorKey).toBe(NO_COLOR_KEY);
    expect(payload.skus[0].colorLabel).toBe(NO_COLOR_LABEL);
  });
});

describe("consumeFifo por cor (FEAT-11)", () => {
  const good = makeGood({
    skus: [
      { name: "Boneco", colorKey: AZUL.key, colorLabel: AZUL.label, layers: [camada("az", 3, 5)] },
      { name: "Boneco", colorKey: VERMELHO.key, colorLabel: VERMELHO.label, layers: [camada("vm", 2, 7)] },
    ],
  });

  it("drena SÓ a cor pedida, ao custo congelado daquela cor", () => {
    const res = consumeFifo(good, undefined, VERMELHO.key, 2);
    expect(res.moves.map((m) => m.layerId)).toEqual(["vm"]);
    expect(res.cost).toBe(2 * 7);
    expect(res.shortfall).toBe(0);
  });

  it("cor sem saldo não empresta da outra: vira shortfall (D4)", () => {
    const res = consumeFifo(good, undefined, VERMELHO.key, 5); // só 2 vermelhas
    expect(res.shortfall).toBe(3);
    expect(res.moves.every((m) => m.layerId === "vm")).toBe(true);
    expect(balanceOf(applyFinishedConsumption(good, res.moves), undefined, AZUL.key)).toBe(3);
  });

  it("cor nunca produzida → nenhum move, o pedido inteiro vira shortfall", () => {
    expect(consumeFifo(good, undefined, "fil_preto", 2).shortfall).toBe(2);
  });
});

describe("colorsWithBalance (FEAT-11)", () => {
  const good = makeGood({
    skus: [
      { name: "Boneco", colorKey: AZUL.key, colorLabel: AZUL.label, layers: [camada("az", 2)] },
      { name: "Boneco", colorKey: VERMELHO.key, colorLabel: VERMELHO.label, layers: [camada("vm", 5)] },
      { name: "Boneco", colorKey: "fil_preto", colorLabel: "Preto", layers: [camada("pt", 0)] },
      { name: "Boneco", colorKey: "fil_verde", colorLabel: "Verde", layers: [camada("vd", -1)] },
    ],
  });

  it("do maior saldo para o menor (o 1º é o default do seletor da venda)", () => {
    expect(colorsWithBalance(good).map((c) => c.colorLabel)).toEqual([
      "Vermelho",
      "Azul",
      "Verde",
    ]);
    expect(colorsWithBalance(good)[0].balance).toBe(5);
  });

  it("cor zerada some da lista; saldo NEGATIVO continua visível (D4)", () => {
    const labels = colorsWithBalance(good).map((c) => c.colorLabel);
    expect(labels).not.toContain("Preto");
    expect(colorsWithBalance(good).find((c) => c.colorLabel === "Verde")?.balance).toBe(-1);
  });

  it("sem doc, lista vazia", () => {
    expect(colorsWithBalance(null)).toEqual([]);
  });
});

// O caso que motivou a regra: um produto pode ser corpo azul + tampa vermelha DE
// PROJETO. Exigir a mesma cor nas duas partes zeraria justamente esse produto.
describe("conjunto multicor (FEAT-11) — a montagem ignora a cor", () => {
  const kit = makeGood({
    skus: [
      { subitemId: "corpo", name: "Corpo", colorKey: AZUL.key, colorLabel: AZUL.label, layers: [camada("c-az", 3, 6)] },
      { subitemId: "tampa", name: "Tampa", colorKey: VERMELHO.key, colorLabel: VERMELHO.label, layers: [camada("t-vm", 3, 4)] },
    ],
  });

  it("3 corpos azuis + 3 tampas vermelhas = 3 conjuntos (não 0)", () => {
    expect(assemblableWholes(kit, ["corpo", "tampa"])).toBe(3);
  });

  it("o saldo da parte soma as cores (2 azuis + 1 preto = 3 corpos)", () => {
    const misto = makeGood({
      skus: [
        { subitemId: "corpo", name: "Corpo", colorKey: AZUL.key, colorLabel: AZUL.label, layers: [camada("c-az", 2, 6)] },
        { subitemId: "corpo", name: "Corpo", colorKey: "fil_preto", colorLabel: "Preto", layers: [camada("c-pt", 1, 6)] },
        { subitemId: "tampa", name: "Tampa", colorKey: VERMELHO.key, colorLabel: VERMELHO.label, layers: [camada("t-vm", 1, 4)] },
      ],
    });
    expect(partBalance(misto, "corpo")).toBe(3);
    expect(assemblableWholes(misto, ["corpo", "tampa"])).toBe(1); // a tampa é o gargalo
  });

  it("vender o conjunto drena cada parte NA SUA cor", () => {
    const res = consumeWholeFifo(
      kit,
      [
        { subitemId: "corpo", colorKey: AZUL.key },
        { subitemId: "tampa", colorKey: VERMELHO.key },
      ],
      2,
    );
    expect(res.moves.map((m) => m.layerId).sort()).toEqual(["c-az", "t-vm"]);
    expect(res.cost).toBe(2 * 6 + 2 * 4);
    expect(res.shortfall).toBe(0);
  });

  it("pedir uma parte numa cor que não existe fura só aquela parte", () => {
    const res = consumeWholeFifo(
      kit,
      [
        { subitemId: "corpo", colorKey: "fil_preto" }, // nunca produzido em preto
        { subitemId: "tampa", colorKey: VERMELHO.key },
      ],
      1,
    );
    expect(res.shortfall).toBe(1);
    expect(res.cost).toBe(4); // só a tampa saiu
  });

  it("produto sem partes: uma entrada sem subitemId drena a SKU do inteiro", () => {
    const whole = makeGood({
      skus: [{ name: "Boneco", colorKey: AZUL.key, colorLabel: AZUL.label, layers: [camada("w", 4, 5)] }],
    });
    const res = consumeWholeFifo(whole, [{ colorKey: AZUL.key }], 2);
    expect(res.moves[0].layerId).toBe("w");
    expect(res.cost).toBe(10);
  });

  it("assemblyBreakdown decompõe cada parte por cor", () => {
    const bd = assemblyBreakdown(kit, [
      { id: "corpo", name: "Corpo" },
      { id: "tampa", name: "Tampa" },
    ]);
    expect(bd.wholes).toBe(3);
    expect(bd.parts.find((p) => p.subitemId === "corpo")?.colors).toEqual([
      { colorKey: AZUL.key, colorLabel: "Azul", balance: 3 },
    ]);
  });
});

describe("submissionEntries com cor (FEAT-11)", () => {
  it("cada subitem leva a SUA cor (corpo azul, tampa vermelha no mesmo evento)", () => {
    const entries = submissionEntries("Kit", 30, {
      subitems: [
        { id: "corpo", name: "Corpo", cost: 6, color: AZUL },
        { id: "tampa", name: "Tampa", cost: 4, color: VERMELHO },
      ],
    });
    expect(entries.map((e) => e.color)).toEqual([AZUL, VERMELHO]);
  });

  it("inteiro sem subitens e subitem avulso levam a cor informada", () => {
    expect(submissionEntries("Boneco", 10, { color: VERMELHO })[0].color).toEqual(VERMELHO);
    expect(
      submissionEntries("Kit", 10, { subitemId: "a", subitemName: "Base", color: AZUL })[0].color,
    ).toEqual(AZUL);
  });

  it("sem cor informada, a entrada nasce sem cor (o crédito cai na sentinela)", () => {
    expect(submissionEntries("Boneco", 10, {})[0].color).toEqual(NO_COLOR);
  });
});

// Regressão do bug pego em teste manual: o Firestore recusa NOME DE CAMPO que
// começa e termina com "__", e a sentinela do inteiro tem exatamente esse
// formato. Como mapa `parte → cor`, a parte virava campo e a venda estourava
// ("WriteBatch.set() called with invalid data"); como lista, a sentinela é um
// VALOR e o problema deixa de existir — inclusive para id de subitem esquisito.
describe("colorEntriesOf / colorRecordOf (FEAT-11 — formato persistido)", () => {
  const reservado = (name: string) => name.startsWith("__") && name.endsWith("__");

  it("a sentinela do inteiro é um VALOR na lista, nunca um nome de campo", () => {
    const entries = colorEntriesOf({ [WHOLE_PART_KEY]: "fil_azul" });
    expect(entries).toEqual([{ part: WHOLE_PART_KEY, colorKey: "fil_azul" }]);
    // Os únicos nomes de campo que chegam ao doc são estes dois, ambos seguros.
    for (const entry of entries) {
      for (const campo of Object.keys(entry)) expect(reservado(campo)).toBe(false);
    }
    // E a sentinela, que era o problema, é dado — não estrutura.
    expect(reservado(WHOLE_PART_KEY)).toBe(true);
  });

  it("round-trip: gravar e reler devolve o mesmo mapa", () => {
    const original = { [WHOLE_PART_KEY]: "fil_azul", corpo: "fil_verm" };
    expect(colorRecordOf(colorEntriesOf(original))).toEqual(original);
  });

  it("tolera ausência e lixo (venda pré-FEAT-11, entrada sem parte)", () => {
    expect(colorEntriesOf(undefined)).toEqual([]);
    expect(colorRecordOf(undefined)).toEqual({});
    expect(colorRecordOf([{ part: "", colorKey: "x" }])).toEqual({});
  });
});
