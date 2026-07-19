import { num } from "@/lib/number";
import { calculatePricing } from "./calculatePricing";
import {
  applyFinishedConsumption,
  consumeFifo,
  reverseFinishedConsumption,
} from "./finishedGoods";
import { reverseProduction } from "./production";
import {
  buildProductionPayloads,
  planEventRows,
  scaleRow,
  subitemEventRows,
  wholeEventRows,
  type EventRow,
} from "./productionPlan";
import type {
  FinishedGood,
  FinishedGoodPayload,
  FinishedMove,
  FixedCostSettings,
  Machine,
  ProductionPayload,
  SaleItemOrigin,
  SavedProduct,
  StockFilament,
  StockMove,
  SubitemPrice,
} from "../types";

// Reconciliação da VENDA (passo 8), PURA. A venda deixou de ser o ponto de baixa
// (o reframe): ela apenas RECONCILIA cada item por um de dois caminhos, ambos
// reusando primitivas já existentes:
//  - `acabado` (peça pronta): drena o Estoque de Produtos (`consumeFifo`) SEM tocar
//    filamento — o insumo já saiu na produção. COGS = custo congelado das camadas.
//  - `encomenda` (sob demanda): cria evento(s) de produção (`outcome: encomenda`,
//    `mode: real`) que deduzem filamento FIFO + horas; a venda os referencia. COGS
//    = `frozenCost` do dia.
//
// Descreve o que gravar/estornar, não grava. Os itens são processados EM ORDEM,
// threading o estado das cores e dos acabados — dois itens na mesma cor/SKU
// deduzem em sequência do saldo já mexido (espelha a baixa encadeada da produção).

export type ReconItem = {
  key: string; // id estável para casar o resultado de volta ao item da cesta
  productId: string;
  subitemId?: string;
  productName: string;
  quantity: number;
  origem: SaleItemOrigin;
};

export type ReconItemResult = {
  key: string;
  origem: SaleItemOrigin;
  cogsUnit: number; // custo real por unidade (congelado)
  cogsTotal: number; // cogsUnit × quantidade
  // Caminho `acabado`: camadas drenadas (para estornar). Vazio na encomenda.
  finishedMoves: FinishedMove[];
  // Caminho `encomenda`: eventos de produção criados. Vazio no acabado.
  productionEventIds: string[];
  // Avisos:
  finishedShortfall: number; // unidades além do saldo do acabado (D4)
  crossesRoll: boolean; // encomenda atravessou o rolo em uso (D5 informativo)
  filamentShortfallG: number; // encomenda passou do estoque total da cor (D5 forte)
  missingProduct: boolean; // encomenda de produto fora do catálogo (nada a produzir)
};

export type ReciboReconciliation = {
  items: ReconItemResult[];
  // Eventos de encomenda a gravar na coleção `producao` (baixa de filamento junto).
  productionPayloads: { id: string; payload: ProductionPayload }[];
  // Estado FINAL das cores tocadas pelas encomendas (só o campo `rolls` é gravado).
  colorUpdates: StockFilament[];
  // Estado FINAL dos acabados tocados pelas peças prontas.
  finishedUpdates: FinishedGoodPayload[];
};

export type ReconContext = {
  goods: FinishedGood[];
  colors: StockFilament[];
  products: SavedProduct[];
  machines: Machine[];
  fixedCosts: FixedCostSettings;
  at: number; // timestamp da venda (vira o `at` do evento de produção)
  createdAt: number;
  notes?: string;
  // Gera o id de cada evento de produção ANTES de gravar (o `stockMoves.itemId`
  // precisa bater com o doc; ver `newProductionId`). Fixo no preview.
  genId: () => string;
};

const toPayload = (good: FinishedGood): FinishedGoodPayload => ({
  productId: good.productId,
  productName: good.productName,
  skus: good.skus,
  createdAt: good.createdAt,
});

// Estado mutável do estoque durante a reconciliação (cores + acabados), com o
// conjunto do que foi TOCADO — é o que permite o estorno-e-reaplicação da edição
// somar reverse (recibo antigo) e forward (recibo novo) sobre o MESMO saldo.
type ReconState = {
  goodsById: Map<string, FinishedGood>;
  colorsById: Map<string, StockFilament>;
  touchedGoods: Set<string>;
  touchedColors: Set<string>;
};

function newState(ctx: ReconContext): ReconState {
  return {
    goodsById: new Map(ctx.goods.map((g) => [g.productId, g])),
    colorsById: new Map(ctx.colors.map((c) => [c.id, c])),
    touchedGoods: new Set(),
    touchedColors: new Set(),
  };
}

// Resolve os subitens (preço/rateio vivo) por produto, cacheado. O preço de
// catálogo (rolo mais novo) não muda com a baixa, então parte de `ctx.colors`.
function makeSubitemsResolver(ctx: ReconContext): (id: string) => SubitemPrice[] {
  const productsById = new Map(ctx.products.map((p) => [p.id, p]));
  const cache = new Map<string, SubitemPrice[]>();
  return (productId: string) => {
    const cached = cache.get(productId);
    if (cached) return cached;
    const product = productsById.get(productId);
    const subs = product
      ? calculatePricing(product, ctx.machines, ctx.fixedCosts, ctx.colors)
          .subitems ?? []
      : [];
    cache.set(productId, subs);
    return subs;
  };
}

// Devolve ao estado o que o recibo ANTIGO consumiu (edição/exclusão), sobre os
// mesmos mapas do forward. Filamento vem dos `stockMoves` dos eventos de produção
// antigos; acabado, dos `finishedMoves` das vendas antigas.
function applyReverse(
  state: ReconState,
  finishedMoves: FinishedMove[],
  productionStockMoves: StockMove[],
): void {
  for (const productId of new Set(finishedMoves.map((m) => m.productId))) {
    const good = state.goodsById.get(productId);
    if (!good) continue;
    state.goodsById.set(productId, reverseFinishedConsumption(good, finishedMoves));
    state.touchedGoods.add(productId);
  }
  const reverted = reverseProduction(
    productionStockMoves,
    Array.from(state.colorsById.values()),
  );
  for (const color of reverted) {
    state.colorsById.set(color.id, color);
    state.touchedColors.add(color.id);
  }
}

// Reconcilia cada item do recibo NOVO, mutando o estado. Devolve o resultado por
// item + os eventos de produção das encomendas.
function applyForward(
  state: ReconState,
  items: ReconItem[],
  ctx: ReconContext,
  subitemsOf: (id: string) => SubitemPrice[],
): {
  results: ReconItemResult[];
  productionCreates: { id: string; payload: ProductionPayload }[];
} {
  const productsById = new Map(ctx.products.map((p) => [p.id, p]));
  const productionCreates: { id: string; payload: ProductionPayload }[] = [];

  const results = items.map((item): ReconItemResult => {
    const qty = Math.max(0, num(item.quantity));
    const base: ReconItemResult = {
      key: item.key,
      origem: item.origem,
      cogsUnit: 0,
      cogsTotal: 0,
      finishedMoves: [],
      productionEventIds: [],
      finishedShortfall: 0,
      crossesRoll: false,
      filamentShortfallG: 0,
      missingProduct: false,
    };

    if (item.origem === "acabado") {
      const good = state.goodsById.get(item.productId) ?? null;
      const res = consumeFifo(good, item.subitemId, qty);
      if (good && res.moves.length > 0) {
        state.goodsById.set(
          item.productId,
          applyFinishedConsumption(good, res.moves),
        );
        state.touchedGoods.add(item.productId);
      }
      return {
        ...base,
        cogsTotal: res.cost,
        cogsUnit: qty > 0 ? res.cost / qty : 0,
        finishedMoves: res.moves,
        finishedShortfall: res.shortfall,
      };
    }

    // encomenda: cria produção sob demanda a partir do produto VIVO (é feita
    // agora), reusando o builder da /producao. Produto fora do catálogo não tem
    // o que produzir → registra só o aviso (a venda ainda guarda a origem).
    const product = productsById.get(item.productId);
    if (!product) return { ...base, missingProduct: true };

    const colorsNow = Array.from(state.colorsById.values());
    let rows: EventRow[];
    if (item.subitemId) {
      const sub = subitemsOf(item.productId).find((s) => s.id === item.subitemId);
      rows = sub ? subitemEventRows(product, sub, colorsNow) : [];
    } else {
      rows = wholeEventRows(product, ctx.machines, colorsNow);
    }

    // BUG-02: os builders devolvem 1 PLACA (crua) de N = `piecesCount` peças. A
    // encomenda vende `qty` PEÇAS, então imprime `qty/pieces` placas → filamento e
    // COGS por peça = placa÷N, batendo com o preço de venda por peça. (Encomenda
    // não estoca as peças sobrando de uma placa parcial — o make-to-order não cria
    // acabado; decisão do dono.)
    const pieces = Math.max(1, num(product.piecesCount) || 1);
    const scaled = rows.map((row) => scaleRow(row, qty / pieces));
    const planned = planEventRows(scaled, "real", colorsNow, ctx.machines, ctx.genId);
    for (const color of planned.colorUpdates) {
      state.colorsById.set(color.id, color);
      state.touchedColors.add(color.id);
    }
    const payloads = buildProductionPayloads(planned.built, {
      at: ctx.at,
      outcome: "encomenda",
      mode: "real",
      notes: ctx.notes,
      createdAt: ctx.createdAt,
    });
    productionCreates.push(...payloads);

    return {
      ...base,
      cogsTotal: planned.summary.frozen,
      cogsUnit: qty > 0 ? planned.summary.frozen / qty : 0,
      productionEventIds: payloads.map((p) => p.id),
      crossesRoll: planned.summary.crossesRoll,
      filamentShortfallG: planned.summary.shortfallG,
    };
  });

  return { results, productionCreates };
}

function collectColorUpdates(state: ReconState): StockFilament[] {
  return Array.from(state.touchedColors).map((id) => state.colorsById.get(id)!);
}

function collectFinishedUpdates(state: ReconState): FinishedGoodPayload[] {
  return Array.from(state.touchedGoods).map((id) =>
    toPayload(state.goodsById.get(id)!),
  );
}

/**
 * Reconciliação FORWARD de um recibo NOVO (sem estorno). PURA. É o preview vivo
 * da `SaleModal` (custo real por item, avisos) e a base do registro de venda nova.
 */
export function planReciboReconciliation(
  items: ReconItem[],
  ctx: ReconContext,
): ReciboReconciliation {
  const state = newState(ctx);
  const { results, productionCreates } = applyForward(
    state,
    items,
    ctx,
    makeSubitemsResolver(ctx),
  );
  return {
    items: results,
    productionPayloads: productionCreates,
    colorUpdates: collectColorUpdates(state),
    finishedUpdates: collectFinishedUpdates(state),
  };
}

// O que o recibo ANTIGO consumiu, para estornar antes de reaplicar (edição). Os
// `stockMoves` das encomendas vêm dos eventos de produção lidos da coleção (o doc
// da venda só guarda os `productionEventIds`); os `finishedMoves`, das vendas.
export type OldReciboState = {
  finishedMoves: FinishedMove[];
  productionEvents: { id: string; stockMoves: StockMove[] }[];
};

// Plano completo de escrita de um recibo — o que o `reconcileRecibo` grava num
// único `writeBatch`. `productionDeleteIds` são os eventos das encomendas do
// recibo antigo, apagados junto (idempotente se algum já sumiu).
export type ReciboWritePlan = {
  items: ReconItemResult[];
  productionCreates: { id: string; payload: ProductionPayload }[];
  productionDeleteIds: string[];
  colorUpdates: StockFilament[];
  finishedUpdates: FinishedGoodPayload[];
};

/**
 * Plano de escrita de um recibo com ESTORNO-E-REAPLICAÇÃO: reverte o recibo antigo
 * (`old`) e reaplica o novo (`items`) sobre o MESMO saldo, numa passada só. PURA.
 * `old` null = venda nova (nada a estornar). É como editar 3 → 2 unidades devolve
 * exatamente 1 ao estoque sem corromper nada.
 */
export function reconcileReciboWrite(
  items: ReconItem[],
  old: OldReciboState | null,
  ctx: ReconContext,
): ReciboWritePlan {
  const state = newState(ctx);
  const productionDeleteIds = old ? old.productionEvents.map((e) => e.id) : [];
  if (old) {
    applyReverse(
      state,
      old.finishedMoves,
      old.productionEvents.flatMap((e) => e.stockMoves),
    );
  }
  const { results, productionCreates } = applyForward(
    state,
    items,
    ctx,
    makeSubitemsResolver(ctx),
  );
  return {
    items: results,
    productionCreates,
    productionDeleteIds,
    colorUpdates: collectColorUpdates(state),
    finishedUpdates: collectFinishedUpdates(state),
  };
}

/**
 * Estorno de um recibo (edição/exclusão): devolve ao estoque exatamente o que o
 * recibo antigo consumiu. `finishedMoves` = todos os moves de acabado do recibo
 * antigo (peças prontas); `productionStockMoves` = os `stockMoves` dos eventos de
 * produção que ele criou (encomendas), lidos da coleção. Round-trip de
 * `planReciboReconciliation`; os eventos em si são apagados pelo repositório.
 */
export function reverseReciboReconciliation(
  finishedMoves: FinishedMove[],
  productionStockMoves: StockMove[],
  goods: FinishedGood[],
  colors: StockFilament[],
): { colorUpdates: StockFilament[]; finishedUpdates: FinishedGoodPayload[] } {
  const affectedGoods = new Set(finishedMoves.map((move) => move.productId));
  const finishedUpdates = goods
    .filter((good) => affectedGoods.has(good.productId))
    .map((good) => toPayload(reverseFinishedConsumption(good, finishedMoves)));

  return {
    colorUpdates: reverseProduction(productionStockMoves, colors),
    finishedUpdates,
  };
}
