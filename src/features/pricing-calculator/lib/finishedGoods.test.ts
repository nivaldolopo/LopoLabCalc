import { describe, expect, it } from "vitest";
import {
  addProductionLayers,
  assemblableWholes,
  assemblyBreakdown,
  balanceOf,
  consumeFifo,
  findSku,
  goodValue,
  removeEventLayers,
  skuBalance,
  skuValue,
  submissionEntries,
} from "./finishedGoods";
import type { FinishedGood, FinishedSku } from "../types";

const DIA = 24 * 60 * 60 * 1000;

function makeGood(over: Partial<FinishedGood> & { skus: FinishedSku[] }): FinishedGood {
  return {
    id: "prod-1",
    productId: "prod-1",
    productName: "Boneco",
    createdAt: 0,
    ...over,
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
      [{ name: "Boneco", qty: 3, unitCost: 7 }],
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
        { subitemId: "a", name: "Base", qty: 1, unitCost: 6 },
        { subitemId: "b", name: "Topo", qty: 1, unitCost: 4 },
      ],
      "e1",
      0,
    );
    expect(payload.skus).toHaveLength(2);
    expect(balanceOf({ ...payload, id: "prod-1" }, "a")).toBe(1);
    expect(balanceOf({ ...payload, id: "prod-1" }, "b")).toBe(1);
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
        { name: "Kit", qty: 1, unitCost: 5 },
        { subitemId: "a", name: "Base", qty: 1, unitCost: 3 },
      ],
      "e1",
      0,
    );
    const ids = payload.skus.map((sku) => sku.layers[0].id);
    expect(ids).toContain("e1____whole__"); // SKU do inteiro
    expect(ids).toContain("e1__a"); // SKU do subitem
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
    const grown = addProductionLayers(base, "prod-1", "Boneco", [{ name: "Boneco", qty: 3, unitCost: 7 }], "e2", DIA);
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
    const res = consumeFifo(good, undefined, 1);
    expect(res.moves).toHaveLength(1);
    expect(res.moves[0].layerId).toBe("e1__whole");
    expect(res.cost).toBe(5); // 1 × custo congelado da 1ª camada
    expect(res.shortfall).toBe(0);
  });

  it("atravessa camadas com custo misto exato", () => {
    const res = consumeFifo(good, undefined, 3); // 2×5 (e1) + 1×7 (e2)
    expect(res.moves).toHaveLength(2);
    expect(res.cost).toBe(2 * 5 + 1 * 7);
    expect(res.shortfall).toBe(0);
  });

  it("D4: passar do saldo total gera shortfall na camada mais nova, sem truncar", () => {
    const res = consumeFifo(good, undefined, 7); // saldo 5; faltam 2
    expect(res.shortfall).toBe(2);
    // O excedente engrossa o move da camada mais nova (e2), não cria um segundo.
    const e2 = res.moves.filter((m) => m.layerId === "e2__whole");
    expect(e2).toHaveLength(1);
    expect(e2[0].qty).toBe(3 + 2);
  });

  it("SKU inexistente/qtd zero → sem move; shortfall carrega o pedido", () => {
    expect(consumeFifo(good, "nao-existe", 4)).toEqual({
      moves: [],
      cost: 0,
      shortfall: 4,
    });
    expect(consumeFifo(good, undefined, 0).moves).toHaveLength(0);
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

describe("submissionEntries (delta da submissão — FEAT-05b)", () => {
  it("inteiro sem subitens → 1 SKU do inteiro com o custo cheio", () => {
    const entries = submissionEntries("Boneco", 30, {});
    expect(entries).toEqual([
      { name: "Boneco", qty: 1, unitCost: 30 },
    ]);
  });

  it("subitem avulso selecionado → 1 SKU daquele subitem, custo cheio", () => {
    const entries = submissionEntries("Kit", 12, {
      subitemId: "a",
      subitemName: "Base",
    });
    expect(entries).toEqual([
      { subitemId: "a", name: "Base", qty: 1, unitCost: 12 },
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
    expect(entries[0]).toEqual({ subitemId: "a", name: "Base", qty: 1, unitCost: 18 }); // 30×6/10
    expect(entries[1]).toEqual({ subitemId: "b", name: "Topo", qty: 1, unitCost: 12 }); // 30×4/10
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

describe("findSku / balanceOf", () => {
  it("acha a SKU do inteiro e a do subitem; 0 para SKU ausente", () => {
    const good = makeGood({
      skus: [{ subitemId: "a", name: "Base", layers: [{ id: "e1__a", at: 0, qty: 2, unitCost: 6, sourceEventId: "e1" }] }],
    });
    expect(findSku(good, "a")?.name).toBe("Base");
    expect(findSku(good, "x")).toBeUndefined();
    expect(balanceOf(good, "a")).toBe(2);
    expect(balanceOf(good, "x")).toBe(0);
    expect(balanceOf(null, "a")).toBe(0);
  });
});
