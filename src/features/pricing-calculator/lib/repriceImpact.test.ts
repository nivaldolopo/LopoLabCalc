import { describe, expect, it } from "vitest";
import { DEFAULT_FIXED_COSTS, DEFAULT_PRODUCT_INPUT } from "../constants";
import {
  computeRepriceImpact,
  REPRICE_TOP_LIMIT,
  type RepriceLevers,
} from "./repriceImpact";
import { calculatePricing } from "./calculatePricing";
import type {
  Machine,
  SavedProduct,
  StockFilament,
  Supply,
} from "../types";

// ---------------------------------------------------------------------------
// [FEAT-12] — o IMPACTO de uma mudança global de preço.
//
// O que este arquivo trava: que a conta que a PRÉVIA mostra, a que o AVISO
// pós-fato resume e a que o doc de `alteracoes` guarda seja UMA só, e que ela
// diga a verdade nos casos que a spec nomeou — "nada mudou" = lista vazia,
// produto órfão de máquina, e quem CRUZA a faixa do `marginTier`.
//
// A frota é a real do dono (A1 Combo 40% · X2D Combo 40% · A1 Mini 20%, medida
// em 2026-09-03).
// ---------------------------------------------------------------------------

const MINI: Machine = {
  id: "mini", name: "A1 Mini", price: 2000, lifeHours: 7500,
  watts: 60, maintenancePerHour: 0.1, weight: 20,
};
const A1: Machine = {
  id: "a1", name: "A1 Combo", price: 5299, lifeHours: 7500,
  watts: 95, maintenancePerHour: 0.12, weight: 40,
};
const X2D: Machine = {
  id: "x2d", name: "X2D Combo", price: 13999, lifeHours: 7500,
  watts: 150, maintenancePerHour: 0.2, weight: 40,
};
const FROTA = [MINI, A1, X2D];

function levers(over: Partial<RepriceLevers> = {}): RepriceLevers {
  return {
    machines: FROTA,
    fixedCosts: { ...DEFAULT_FIXED_COSTS, enabled: false },
    stock: [],
    supplies: [],
    ...over,
  };
}

function produto(
  id: string,
  over: Partial<SavedProduct> = {},
): SavedProduct {
  return {
    ...DEFAULT_PRODUCT_INPUT,
    id,
    name: id,
    machineIds: FROTA.map((m) => m.id),
    printHours: 3,
    laborMinutes: 10,
    failureRate: 0,
    filaments: [
      { filamentId: null, colorName: "Azul", pricePerKg: 110, totalG: 40 },
    ],
    ...over,
  };
}

function cor(over: Partial<StockFilament> = {}): StockFilament {
  return {
    id: "cor1",
    material: "PLA",
    brand: "Bambu",
    colorName: "Azul",
    minG: 0,
    archived: false,
    rolls: [
      {
        id: "r1", purchaseDate: 1, initialG: 1000,
        remainingG: 1000, pricePerKg: 110,
      },
    ],
    adjustments: [],
    createdAt: 1,
    ...over,
  };
}

function insumo(over: Partial<Supply> = {}): Supply {
  return {
    id: "ima",
    name: "Ímã 6×2mm",
    unit: "un",
    minQty: 0,
    archived: false,
    lots: [
      {
        id: "l1", purchaseDate: 1, initialQty: 100,
        remainingQty: 100, unitPrice: 0.5,
      },
    ],
    adjustments: [],
    createdAt: 1,
    ...over,
  };
}

// ===========================================================================
// 1. "Nada mudou" é lista VAZIA — e não um objeto vazio
// ===========================================================================

describe("[FEAT-12] nada mudou", () => {
  it("pacotes idênticos não produzem movimento nenhum", () => {
    const produtos = [produto("a"), produto("b"), produto("c")];
    const impacto = computeRepriceImpact(produtos, levers(), levers());

    expect(impacto.items).toEqual([]);
    expect(impacto.affected).toBe(0);
    expect(impacto.up).toBe(0);
    expect(impacto.down).toBe(0);
    expect(impacto.avgPct).toBe(0);
    expect(impacto.top).toEqual([]);
    expect(impacto.crossings).toEqual([]);
    // ⚠ O que separa "não mexeu em nada" de "não havia catálogo": a tela precisa
    // dizer coisas diferentes nos dois casos, e só o `evaluated` distingue.
    expect(impacto.evaluated).toBe(3);
  });

  it("catálogo VAZIO também é lista vazia, mas com `evaluated` 0", () => {
    const impacto = computeRepriceImpact([], levers(), levers());
    expect(impacto.affected).toBe(0);
    expect(impacto.evaluated).toBe(0);
  });

  it("mudança que o ARREDONDAMENTO come não vira movimento", () => {
    // O preço da etiqueta é o `suggestedPrice`, já arredondado pelo
    // `roundingMode` do produto. Um centavo de watt não move um preço que
    // arredonda para R$0,90 — e uma prévia que promete "estes vão mudar" não
    // pode listar o catálogo inteiro por ruído de ponto flutuante.
    const produtos = [produto("a", { roundingMode: "0.90" })];
    const quaseIgual = FROTA.map((m) => ({ ...m, watts: m.watts + 0.001 }));
    const impacto = computeRepriceImpact(
      produtos,
      levers(),
      levers({ machines: quaseIgual }),
    );
    expect(impacto.affected).toBe(0);
  });
});

// ===========================================================================
// 2. As alavancas — cada uma move o preço, e a lib mede a mesma coisa que o
//    catálogo mostra
// ===========================================================================

describe("[FEAT-12] as alavancas que reprecificam", () => {
  it("vida útil 7500 → 750 multiplica a depreciação por 10", () => {
    // O exemplo que a spec nomeia: `lifeHours` 7500 → 750, calado, em todo
    // produto da máquina.
    const produtos = [produto("chaveiro")];
    const antes = levers();
    const depois = levers({
      machines: FROTA.map((m) => ({ ...m, lifeHours: 750 })),
    });
    const impacto = computeRepriceImpact(produtos, antes, depois);

    expect(impacto.affected).toBe(1);
    expect(impacto.up).toBe(1);
    expect(impacto.down).toBe(0);

    // O "antes" e o "depois" da lib são os MESMOS números que o
    // `calculatePricing` devolve — é isso que faz a prévia ser a vitrine, e não
    // uma segunda conta que precisa concordar com ela.
    const direto = (l: RepriceLevers) =>
      calculatePricing(produtos[0], l.machines, l.fixedCosts, l.stock, l.supplies)
        .suggestedPrice;
    expect(impacto.items[0].before).toBe(direto(antes));
    expect(impacto.items[0].after).toBe(direto(depois));
    expect(impacto.items[0].delta).toBeGreaterThan(0);
  });

  it("custo fixo move o preço de quem tem `includeFixed`, e só dele", () => {
    const comFixo = produto("com-fixo", { includeFixed: true });
    const semFixo = produto("sem-fixo", { includeFixed: false });
    const impacto = computeRepriceImpact(
      [comFixo, semFixo],
      levers({ fixedCosts: { ...DEFAULT_FIXED_COSTS, enabled: true } }),
      levers({
        fixedCosts: { ...DEFAULT_FIXED_COSTS, enabled: true, rent: 3000 },
      }),
    );
    expect(impacto.items.map((i) => i.id)).toEqual(["com-fixo"]);
    expect(impacto.items[0].delta).toBeGreaterThan(0);
  });

  it("rolo novo mais caro sobe o produto ligado à COR (7c)", () => {
    const produtos = [
      produto("ligado", {
        filaments: [
          { filamentId: "cor1", colorName: "Azul", pricePerKg: 110, totalG: 40 },
        ],
      }),
    ];
    const rolado = cor({
      rolls: [
        ...cor().rolls,
        {
          id: "r2", purchaseDate: 2, initialG: 1000,
          remainingG: 1000, pricePerKg: 160,
        },
      ],
    });
    const impacto = computeRepriceImpact(
      produtos,
      levers({ stock: [cor()] }),
      levers({ stock: [rolado] }),
    );
    expect(impacto.affected).toBe(1);
    expect(impacto.up).toBe(1);
  });

  it("lote novo mais caro sobe o produto ligado ao INSUMO (TD-033)", () => {
    const produtos = [
      produto("com-ima", {
        accessories: [
          { id: "a1", desc: "Ímã", qty: 4, unitPrice: 0.5, supplyId: "ima" },
        ],
      }),
    ];
    const relotado = insumo({
      lots: [
        ...insumo().lots,
        {
          id: "l2", purchaseDate: 2, initialQty: 100,
          remainingQty: 100, unitPrice: 2,
        },
      ],
    });
    const impacto = computeRepriceImpact(
      produtos,
      levers({ supplies: [insumo()] }),
      levers({ supplies: [relotado] }),
    );
    expect(impacto.affected).toBe(1);
    expect(impacto.up).toBe(1);
    expect(impacto.items[0].delta).toBeGreaterThan(0);
  });

  it("cor ARQUIVADA segue viva: arquivar não é remover, e o preço não se mexe", () => {
    // ⚠ A lista vai INTEIRA, com arquivados. Filtrar antes de chamar faria
    // arquivado passar por REMOVIDO, e a prévia inventaria um movimento (a queda
    // para o preço salvo de fallback) que não vai acontecer.
    const produtos = [
      produto("ligado", {
        filaments: [
          { filamentId: "cor1", colorName: "Azul", pricePerKg: 999, totalG: 40 },
        ],
      }),
    ];
    const impacto = computeRepriceImpact(
      produtos,
      levers({ stock: [cor()] }),
      levers({ stock: [cor({ archived: true })] }),
    );
    expect(impacto.affected).toBe(0);
  });
});

// ===========================================================================
// 3. Máquina EXCLUÍDA — o produto órfão cai na frota inteira
// ===========================================================================

describe("[FEAT-12] produto órfão de máquina", () => {
  it("excluir a única elegível reprecifica o produto pela FROTA INTEIRA", () => {
    // O id salvo vira fantasma e o `resolveFleet` cai na frota toda + badge. É
    // uma reprecificação como qualquer outra, e a prévia tem de mostrá-la ANTES
    // de a máquina sumir — depois não há mais "antes" a que comparar.
    const so_na_x2d = produto("caro", { machineIds: ["x2d"] });
    const impacto = computeRepriceImpact(
      [so_na_x2d],
      levers(),
      levers({ machines: [MINI, A1] }),
    );

    expect(impacto.affected).toBe(1);
    // A X2D é a mais cara da frota: perdê-la BARATEIA o produto que só rodava
    // nela (ele passa a ser precificado pela média Mini+A1).
    expect(impacto.down).toBe(1);
    expect(impacto.items[0].delta).toBeLessThan(0);
  });

  it("produto JÁ órfão (conjunto vazio) acompanha a frota que sobra", () => {
    // Todo produto anterior à [FROTA] entra sem conjunto — frota inteira. Ele
    // não é imune: mudar a frota muda a média dele também, e a prévia conta.
    const semConjunto = produto("antigo", { machineIds: [] });
    const impacto = computeRepriceImpact(
      [semConjunto],
      levers(),
      levers({ machines: [MINI, A1] }),
    );
    expect(impacto.affected).toBe(1);
  });

  it("frota inteira excluída não explode: preço cai para a frota de zeros", () => {
    // TD-024 — o preço não pode depender de a função não explodir. Aqui a lib
    // só precisa NÃO produzir NaN: um `delta` NaN passaria pelo piso de centavo
    // e entraria na lista como movimento.
    const impacto = computeRepriceImpact(
      [produto("a")],
      levers(),
      levers({ machines: [] }),
    );
    for (const item of impacto.items) {
      expect(Number.isFinite(item.after)).toBe(true);
      expect(Number.isFinite(item.delta)).toBe(true);
    }
  });
});

// ===========================================================================
// 4. Quem CRUZA a faixa — "preço mais quem cruza" (dono)
// ===========================================================================

describe("[FEAT-12] cruzamento de faixa do marginTier", () => {
  it("o cruzamento é da margem PRECIFICADA BRUTA, a mesma régua do catálogo", () => {
    // Markup 1,6 põe a margem em ~37,5% (faixa "bad"); markup 3 a põe em ~66,7%
    // ("good"). O que muda o markup aqui é o produto, não a alavanca — mas o que
    // interessa é que a lib LEIA a margem do `calculatePricing`, e não invente
    // uma régua própria.
    // ⚠ `laborMinutes: 0` de propósito: a mão de obra é PASS-THROUGH (não leva
    // markup, DEC-01), então ela dilui a margem e tiraria o "caro" da faixa boa
    // por um motivo que nada tem a ver com o que este teste mede.
    const barato = produto("barato", { markup: 1.6, laborMinutes: 0 });
    const caro = produto("caro", { markup: 3, laborMinutes: 0 });
    const impacto = computeRepriceImpact(
      [barato, caro],
      levers(),
      levers({ machines: FROTA.map((m) => ({ ...m, lifeHours: 750 })) }),
    );

    const porId = new Map(impacto.items.map((i) => [i.id, i]));
    expect(porId.get("barato")?.tierBefore).toBe("bad");
    expect(porId.get("caro")?.tierBefore).toBe("good");
    // Encarecer o custo com markup fixo NÃO muda a margem percentual (preço e
    // custo sobem juntos) — logo ninguém cruza, mesmo com o preço mudando.
    for (const item of impacto.items) {
      expect(item.marginAfter).toBeCloseTo(item.marginBefore, 6);
      expect(item.crossedTier).toBe(false);
    }
    expect(impacto.crossings).toEqual([]);
  });

  it("custo fixo cruza a faixa: ele entra no custo TOTAL sem entrar no markup", () => {
    // DEC-01 — o fixo não recebe markup. Então ele come margem de verdade: é a
    // alavanca que faz um produto atravessar a régua sem o dono ter tocado no
    // markup dele. É exatamente o que a prévia precisa denunciar.
    const p = produto("na-borda", {
      markup: 3,
      includeFixed: true,
      laborMinutes: 0, // pass-through: ver a nota do teste acima
    });
    const impacto = computeRepriceImpact(
      [p],
      levers({ fixedCosts: { ...DEFAULT_FIXED_COSTS, enabled: true, rent: 0, other: 0 } }),
      levers({
        fixedCosts: { ...DEFAULT_FIXED_COSTS, enabled: true, rent: 30000, other: 0 },
      }),
    );

    expect(impacto.affected).toBe(1);
    const item = impacto.items[0];
    expect(item.marginAfter).toBeLessThan(item.marginBefore);
    expect(item.tierBefore).toBe("good");
    expect(item.crossedTier).toBe(true);
    expect(impacto.crossings.map((i) => i.id)).toEqual(["na-borda"]);
  });
});

// ===========================================================================
// 5. Os agregados — o que o cartão da prévia e o doc do registro mostram
// ===========================================================================

describe("[FEAT-12] agregados", () => {
  it("conta afetados, subiram, desceram e a média percentual", () => {
    // Só a X2D encarece; quem não roda nela não se mexe. É o caso que separa
    // "afetados" de "catálogo inteiro" — e o que a spec chama de rastro.
    const naX2d = produto("na-x2d", { machineIds: ["x2d"] });
    const naMini = produto("na-mini", { machineIds: ["mini"] });
    const impacto = computeRepriceImpact(
      [naX2d, naMini],
      levers(),
      levers({
        machines: FROTA.map((m) =>
          m.id === "x2d" ? { ...m, price: m.price * 4 } : m,
        ),
      }),
    );

    expect(impacto.evaluated).toBe(2);
    expect(impacto.affected).toBe(1);
    expect(impacto.up).toBe(1);
    expect(impacto.down).toBe(0);
    expect(impacto.avgPct).toBeCloseTo(impacto.items[0].deltaPct ?? 0, 10);
    expect(impacto.avgPct).toBeGreaterThan(0);
  });

  it("ordena pelo maior movimento em REAIS, não em percentual", () => {
    // 20% de R$2 não abre uma lista que R$50 num produto caro deveria abrir.
    const pequeno = produto("pequeno", { weightG: 5, printHours: 0.2 });
    const grande = produto("grande", { weightG: 400, printHours: 40 });
    const impacto = computeRepriceImpact(
      [pequeno, grande],
      levers(),
      levers({ machines: FROTA.map((m) => ({ ...m, lifeHours: 750 })) }),
    );

    expect(impacto.items.map((i) => i.id)).toEqual(["grande", "pequeno"]);
    expect(Math.abs(impacto.items[0].delta)).toBeGreaterThan(
      Math.abs(impacto.items[1].delta),
    );
  });

  it("o `top` corta em 10 por padrão — o registro guarda RESUMO, nunca o catálogo", () => {
    const produtos = Array.from({ length: 25 }, (_, i) =>
      produto(`p${String(i).padStart(2, "0")}`, { printHours: 1 + i }),
    );
    const impacto = computeRepriceImpact(
      produtos,
      levers(),
      levers({ machines: FROTA.map((m) => ({ ...m, lifeHours: 750 })) }),
    );

    expect(impacto.affected).toBe(25);
    expect(impacto.top).toHaveLength(REPRICE_TOP_LIMIT);
    // O `top` é o PREFIXO da lista ordenada, não uma segunda ordenação.
    expect(impacto.top).toEqual(impacto.items.slice(0, REPRICE_TOP_LIMIT));
  });

  it("produto com preço ANTES zerado entra na contagem e fica fora da média", () => {
    // Markup 0 dá preço 0: dividir por ele daria Infinity, e uma média
    // contaminada por Infinity é pior que uma média sobre menos itens.
    const zerado = produto("zerado", { markup: 0 });
    const normal = produto("normal");
    const impacto = computeRepriceImpact(
      [zerado, normal],
      levers(),
      levers({ machines: FROTA.map((m) => ({ ...m, lifeHours: 750 })) }),
    );

    const zeroItem = impacto.items.find((i) => i.id === "zerado");
    // Preço 0 nas duas pontas não é movimento — ele nem entra na lista.
    expect(zeroItem).toBeUndefined();
    expect(Number.isFinite(impacto.avgPct)).toBe(true);
  });

  it("`deltaPct` é null quando o `before` era 0, e a média ignora esse item", () => {
    // O caso real: um insumo SEM lote cota 0 e o acessório cai no preço salvo,
    // que também é 0 — o produto inteiro custa 0 e vale 0. O primeiro lote lhe
    // dá preço. Não há percentual possível sobre um "antes" de R$0,00, e a
    // prévia tem de mostrar o R$ em vez de um Infinity.
    const p = produto("so-o-ima", {
      weightG: 0,
      printHours: 0,
      laborMinutes: 0,
      filaments: [],
      accessories: [
        { id: "ac1", desc: "Ímã", qty: 1, unitPrice: 0, supplyId: "ima" },
      ],
    });
    const semLote = insumo({ lots: [] });
    const comLote = insumo();

    const impacto = computeRepriceImpact(
      [p, produto("normal")],
      levers({ supplies: [semLote] }),
      levers({ supplies: [comLote] }),
    );

    const item = impacto.items.find((i) => i.id === "so-o-ima");
    expect(item?.before).toBe(0);
    expect(item?.after).toBeGreaterThan(0);
    expect(item?.deltaPct).toBeNull();
    // A média sobrevive: ela é feita só sobre os que TÊM percentual. Um único
    // Infinity a contaminaria inteira, e o cartão da prévia mostraria "∞%".
    expect(Number.isFinite(impacto.avgPct)).toBe(true);
    expect(impacto.avgPct).toBe(0);
    // Mas o item CONTA como afetado — ele mudou de preço.
    expect(impacto.affected).toBe(1);
    expect(impacto.up).toBe(1);
  });
});
