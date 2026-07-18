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

// Escala uma linha-evento para `qty` unidades: horas, labor e gramas por cor. O
// FIFO consome `qty ×` as gramas (custo misto exato), e energia/deprec./manutenção
// acompanham as horas — um evento representa a encomenda inteira, não 1 unidade.
function scaleRow(row: EventRow, qty: number): EventRow {
  return {
    ...row,
    printHours: row.printHours * qty,
    laborCost: row.laborCost * qty,
    filaments: row.filaments.map((f) => ({ ...f, totalG: f.totalG * qty })),
  };
}

export function planReciboReconciliation(
  items: ReconItem[],
  ctx: ReconContext,
): ReciboReconciliation {
  const goodsById = new Map(ctx.goods.map((g) => [g.productId, g]));
  const colorsById = new Map(ctx.colors.map((c) => [c.id, c]));
  const productsById = new Map(ctx.products.map((p) => [p.id, p]));
  const touchedGoods = new Set<string>();
  const touchedColors = new Set<string>();
  const productionPayloads: { id: string; payload: ProductionPayload }[] = [];

  // Subitens do produto (preço/rateio vivo) — cacheado por produto. O preço de
  // catálogo (rolo mais novo) não muda com a baixa, então o cache é seguro.
  const subitemsCache = new Map<string, SubitemPrice[]>();
  const subitemsOf = (productId: string): SubitemPrice[] => {
    const cached = subitemsCache.get(productId);
    if (cached) return cached;
    const product = productsById.get(productId);
    const subs = product
      ? calculatePricing(
          product,
          ctx.machines,
          ctx.fixedCosts,
          Array.from(colorsById.values()),
        ).subitems ?? []
      : [];
    subitemsCache.set(productId, subs);
    return subs;
  };

  const results: ReconItemResult[] = items.map((item) => {
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
      const good = goodsById.get(item.productId) ?? null;
      const res = consumeFifo(good, item.subitemId, qty);
      if (good && res.moves.length > 0) {
        goodsById.set(item.productId, applyFinishedConsumption(good, res.moves));
        touchedGoods.add(item.productId);
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

    const colorsNow = Array.from(colorsById.values());
    let rows: EventRow[];
    if (item.subitemId) {
      const sub = subitemsOf(item.productId).find((s) => s.id === item.subitemId);
      rows = sub ? subitemEventRows(product, sub, colorsNow) : [];
    } else {
      rows = wholeEventRows(product, ctx.machines, colorsNow);
    }

    const scaled = rows.map((row) => scaleRow(row, qty));
    const planned = planEventRows(
      scaled,
      "real",
      colorsNow,
      ctx.machines,
      ctx.genId,
    );
    for (const color of planned.colorUpdates) {
      colorsById.set(color.id, color);
      touchedColors.add(color.id);
    }
    const payloads = buildProductionPayloads(planned.built, {
      at: ctx.at,
      outcome: "encomenda",
      mode: "real",
      notes: ctx.notes,
      createdAt: ctx.createdAt,
    });
    productionPayloads.push(...payloads);

    return {
      ...base,
      cogsTotal: planned.summary.frozen,
      cogsUnit: qty > 0 ? planned.summary.frozen / qty : 0,
      productionEventIds: payloads.map((p) => p.id),
      crossesRoll: planned.summary.crossesRoll,
      filamentShortfallG: planned.summary.shortfallG,
    };
  });

  return {
    items: results,
    productionPayloads,
    colorUpdates: Array.from(touchedColors).map((id) => colorsById.get(id)!),
    finishedUpdates: Array.from(touchedGoods).map((id) =>
      toPayload(goodsById.get(id)!),
    ),
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
