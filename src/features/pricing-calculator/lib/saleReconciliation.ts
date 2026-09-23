import { num } from "@/lib/number";
import {
  calculatePricing,
  resolveAccessoryPrices,
} from "./calculatePricing";
import {
  colorKeyOf,
  NO_COLOR_KEY,
  NO_COLOR_LABEL,
  type ColorKey,
} from "./filaments";
import {
  applyFinishedConsumption,
  consumeFifo,
  consumeWholeFifo,
  findSku,
  finishedGoodToPayload,
  reverseFinishedConsumption,
  WHOLE_PART_KEY,
  withAcertoLayer,
} from "./finishedGoods";
import {
  addFrozen,
  planSupplies,
  reverseSupplies,
  scaleFrozen,
  scaleMachineUsage,
  sumFrozen,
  ZERO_FROZEN,
} from "./production";
import { conjuntoAccessoryRows, sellsByParts } from "./productionPlan";
import type {
  FinishedGood,
  FinishedGoodPayload,
  FinishedMove,
  FixedCostSettings,
  FrozenCostBreakdown,
  Machine,
  MachineUsage,
  PricingResult,
  SavedProduct,
  StockFilament,
  StockMove,
  Supply,
} from "../types";

// Reconciliação da VENDA (passo 8), PURA. A venda não é ponto de baixa de
// filamento: ela RECONCILIA cada item contra o Estoque de Produtos.
//
// ⚠ S1 (lote 2 da frente 3a) — até aqui havia DOIS caminhos, e o segundo, a
// "encomenda", criava a produção na hora da venda: baixava só a FRAÇÃO da placa
// (as outras peças sumiam), com a cor e os gramas do cadastro, na data da venda,
// sem falha nem reimpressão possíveis — e apagar a venda apagava a produção.
// Hoje toda venda drena o acabado (`consumeFifo`), e a produção sempre existe
// antes, registrada na `/producao` como `estoque`. "Encomenda" virou só o CANAL
// da venda. COGS = custo congelado das camadas drenadas.
//
// Descreve o que gravar/estornar, não grava. Os itens são processados EM ORDEM,
// threading o estado dos acabados e insumos — dois itens na mesma SKU deduzem
// em sequência do saldo já mexido.

export type ReconItem = {
  key: string; // id estável para casar o resultado de volta ao item da cesta
  productId: string;
  subitemId?: string;
  productName: string;
  quantity: number;
  // FEAT-11 — a COR escolhida para tirar cada peça da prateleira, por parte:
  // `subitemId` (produto que vende por partes) ou `WHOLE_PART_KEY`. Um mapa, e
  // não uma cor só, porque o conjunto pode ser corpo azul + tampa vermelha.
  // Parte sem entrada (ou com `NO_COLOR_KEY`) cai na cor do CADASTRO quando a
  // prateleira sem cor não tem peça — ver `resolverParte`.
  //
  // W5: com o produto excluído, as CHAVES deste mapa são a única lista de
  // partes que sobrou (a reedição o traz de volta do `finishedColors`).
  colors?: Record<string, string>;
};

export type ReconItemResult = {
  key: string;
  cogsUnit: number; // custo real por unidade (congelado)
  cogsTotal: number; // cogsUnit × quantidade
  // FEAT-06: a composição do `cogsUnit` — POR UNIDADE, a mesma escala do
  // `SaleCostBreakdown`, para os dois poderem ser exibidos lado a lado.
  // Ausente quando não há o que detalhar (consumo vazio). `cogsBreakdownPartial`
  // marca o caso meio-a-meio: parte do COGS veio de camada sem composição.
  cogsBreakdown?: FrozenCostBreakdown;
  cogsBreakdownPartial: boolean;
  // [FROTA] Fase 1 — a repartição REAL por máquina desta linha, POR UNIDADE
  // ATRIBUÍDA, das CAMADAS drenadas. Vazia = sem lastro nenhum.
  machineUsage: MachineUsage[];
  // [FROTA] Fase 1 — quantas das `quantity` unidades não têm origem conhecida
  // (camada anterior à Fase 1, overdraft D4, camada de acerto). É o que impede
  // o ROI de distribuir 100% do lucro quando parte da venda não tem dono.
  unattributedUnits: number;
  // As camadas drenadas (para estornar).
  finishedMoves: FinishedMove[];
  // FEAT-11 — a cor EFETIVA de cada parte (a escolhida, ou a do cadastro quando
  // a escolha era "sem cor" e a prateleira sem cor estava vazia). É o que se
  // congela no recibo: a reedição tem de voltar à MESMA prateleira.
  colors: Record<string, string>;
  // W4 — a baixa dos acessórios do conjunto (venda do inteiro de produto que
  // vende por partes). Vazio no resto.
  supplyMoves: StockMove[];
  // Avisos:
  finishedShortfall: number; // unidades além do saldo do acabado (D4)
  // W1 — alguma parte não tinha camada nenhuma e ganhou uma de ACERTO, com o
  // custo do CADASTRO: a venda saiu antes de a produção ser registrada.
  acerto: boolean;
  // Alguma parte não tinha camada E o produto não está mais no catálogo: não há
  // custo nenhum a usar (nem camada, nem cadastro). O COGS dela fica 0.
  missingProduct: boolean;
  supplyShortfall: number; // W4: unidades de insumo além do saldo (D4/D5)
};

export type ReconContext = {
  goods: FinishedGood[];
  // A cotação do cadastro (rolo mais novo) — só para o custo da camada de
  // acerto; a venda não mexe em filamento.
  colors: StockFilament[];
  supplies: Supply[];
  products: SavedProduct[];
  machines: Machine[];
  fixedCosts: FixedCostSettings;
  energyTariff: number;
  at: number; // timestamp da venda (vira o `at` da camada de acerto e do lote de dívida)
  // Gera os ids da camada de acerto e do `itemId` dos moves de insumo. Fixo no
  // preview (o custo não depende dele).
  genId: () => string;
};

// Estado mutável do estoque durante a reconciliação, com o conjunto do que foi
// TOCADO — é o que permite o estorno-e-reaplicação da edição somar reverse
// (recibo antigo) e forward (recibo novo) sobre o MESMO saldo.
type ReconState = {
  goodsById: Map<string, FinishedGood>;
  suppliesById: Map<string, Supply>;
  touchedGoods: Set<string>;
  touchedSupplies: Set<string>;
};

function newState(ctx: ReconContext): ReconState {
  return {
    goodsById: new Map(ctx.goods.map((g) => [g.productId, g])),
    suppliesById: new Map(ctx.supplies.map((s) => [s.id, s])),
    touchedGoods: new Set(),
    touchedSupplies: new Set(),
  };
}

// A precificação VIVA por produto, cacheada — só serve ao custo da camada de
// acerto. Parte de `ctx.colors`/`ctx.supplies` de ENTRADA (TD-033): o lote mais
// novo é a cotação, não o que a baixa deste recibo deixou no saldo.
function makePricingResolver(
  ctx: ReconContext,
): (product: SavedProduct) => PricingResult {
  const cache = new Map<string, PricingResult>();
  return (product) => {
    const cached = cache.get(product.id);
    if (cached) return cached;
    const priced = calculatePricing(
      product,
      ctx.machines,
      ctx.fixedCosts,
      ctx.energyTariff,
      ctx.colors,
      ctx.supplies,
    );
    cache.set(product.id, priced);
    return priced;
  };
}

// O que o CADASTRO diz de uma parte: custo de produção por unidade (a mesma
// composição da camada — sem reserva de falha nem fixo, que são provisões de
// PREÇO), a cor e o nome. `null` quando o subitem não resolve.
type CadastroDaParte = {
  breakdown: FrozenCostBreakdown;
  color: ColorKey;
  name: string;
};

function cadastroDaParte(
  product: SavedProduct,
  priced: PricingResult,
  subitemId: string | undefined,
  ctx: ReconContext,
): CadastroDaParte | null {
  if (!subitemId) {
    return {
      breakdown: {
        material: num(priced.materialCost),
        energy: num(priced.energyCost),
        depreciation: num(priced.depreciationCost),
        maintenance: num(priced.maintenanceCost),
        labor: num(priced.laborCost),
        supplies: num(priced.accessoriesCost),
      },
      color: colorKeyOf(priced.filaments ?? []),
      name: product.name || product.mainStageName || "",
    };
  }
  const sub = priced.subitems?.find((s) => s.id === subitemId);
  if (!sub) return null;
  // W4: a parte leva só o acessório ATRIBUÍDO a ela. O rateio do acessório do
  // conjunto que o PREÇO da parte embute não é gasto dela — ele sai na venda do
  // conjunto (`conjuntoAccessoryRows`); contá-lo aqui o cobraria duas vezes.
  const { accessories } = resolveAccessoryPrices(
    product.accessories ?? [],
    new Map(ctx.supplies.map((s) => [s.id, s])),
  );
  const daParte = accessories
    .filter((a) => a.subitemId === subitemId)
    .reduce((sum, a) => sum + num(a.qty) * num(a.unitPrice), 0);
  return {
    breakdown: {
      material: num(sub.costBreakdown.material),
      energy: num(sub.costBreakdown.energy),
      depreciation: num(sub.costBreakdown.depreciation),
      maintenance: num(sub.costBreakdown.maintenance),
      labor: num(sub.costBreakdown.labor),
      supplies: daParte,
    },
    color: colorKeyOf(sub.filaments ?? []),
    name: sub.name || product.name || "",
  };
}

// Uma parte a drenar: o subitem (ou a peça única) e a chave dela no mapa de cores.
type Parte = { subitemId?: string; key: string };

// As partes que um item drena, e se ele é um CONJUNTO (drena uma de cada).
function partesDoItem(
  item: ReconItem,
  product: SavedProduct | undefined,
): { partes: Parte[]; conjunto: boolean } {
  if (item.subitemId) {
    return { partes: [{ subitemId: item.subitemId, key: item.subitemId }], conjunto: false };
  }
  if (product) {
    return sellsByParts(product)
      ? {
          partes: product.subitems.map((s) => ({ subitemId: s.id, key: s.id })),
          conjunto: true,
        }
      : { partes: [{ key: WHOLE_PART_KEY }], conjunto: false };
  }
  // W5 — produto EXCLUÍDO. Sem cadastro, a lista de partes que sobrou é a do
  // mapa de cores congelado no recibo (a reedição o traz). Antes isto caía na
  // SKU do inteiro, que um produto por partes não tem: shortfall, custo 0. A
  // peça única grava a sentinela do inteiro; o conjunto grava só as partes.
  const salvas = Object.keys(item.colors ?? {});
  return salvas.length > 0 && !salvas.includes(WHOLE_PART_KEY)
    ? { partes: salvas.map((k) => ({ subitemId: k, key: k })), conjunto: true }
    : { partes: [{ key: WHOLE_PART_KEY }], conjunto: false };
}

/**
 * De QUAL SKU sai uma parte — e, se nenhuma tem peça registrada, a camada de
 * acerto que a venda abre (W1).
 *
 * 1. A cor escolhida tem camada → sai dela (o caso normal).
 * 2. A escolha era "sem cor" (o default quando a prateleira não oferece opção) e
 *    a SKU da cor do CADASTRO tem camada → sai dela. É onde a produção registrada
 *    na `/producao` teria creditado a peça, e o D4 cai numa camada de custo real.
 * 3. Nada tem camada → abre a de ACERTO (custo do cadastro) na cor do cadastro,
 *    para a produção registrada depois cair na MESMA SKU e cobrir o negativo.
 * 4. Sem camada e sem cadastro (produto excluído, W5) → não há custo a usar.
 */
function resolverParte(
  good: FinishedGood | null,
  parte: Parte,
  item: ReconItem,
  cadastro: CadastroDaParte | null,
  qty: number,
  ctx: ReconContext,
): { good: FinishedGood | null; colorKey: string; acerto: boolean; semCusto: boolean } {
  const escolhida = item.colors?.[parte.key] || NO_COLOR_KEY;
  const temCamada = (key: string) =>
    (findSku(good, parte.subitemId, key)?.layers.length ?? 0) > 0;

  if (temCamada(escolhida)) {
    return { good, colorKey: escolhida, acerto: false, semCusto: false };
  }
  const alvo =
    escolhida === NO_COLOR_KEY && cadastro ? cadastro.color.key : escolhida;
  if (temCamada(alvo)) {
    return { good, colorKey: alvo, acerto: false, semCusto: false };
  }
  if (!cadastro || qty <= 0) {
    return { good, colorKey: alvo, acerto: false, semCusto: qty > 0 };
  }
  const label =
    alvo === cadastro.color.key
      ? cadastro.color.label
      : alvo === NO_COLOR_KEY
        ? NO_COLOR_LABEL
        : alvo;
  const comAcerto = withAcertoLayer(good, {
    productId: item.productId,
    productName: good?.productName || item.productName,
    ...(parte.subitemId ? { subitemId: parte.subitemId } : {}),
    colorKey: alvo,
    colorLabel: label,
    skuName: cadastro.name || item.productName,
    // A SKU entra no id: no preview o `genId` é fixo, e duas camadas de acerto
    // com o mesmo id em SKUs diferentes seriam a mesma camada para o
    // `shiftLayers` (que casa por id em todas as SKUs do doc).
    layerId: `acerto_${ctx.genId()}__${parte.key}::${alvo}`,
    at: ctx.at,
    unitCost: sumFrozen(cadastro.breakdown),
    costBreakdown: cadastro.breakdown,
  });
  return { good: comAcerto, colorKey: alvo, acerto: true, semCusto: false };
}

// Devolve ao estado o que o recibo ANTIGO consumiu (edição/exclusão), sobre os
// mesmos mapas do forward: acabado pelos `finishedMoves`, insumo pelos
// `supplyMoves` (W4).
function applyReverse(
  state: ReconState,
  finishedMoves: FinishedMove[],
  supplyMoves: StockMove[],
): void {
  for (const productId of new Set(finishedMoves.map((m) => m.productId))) {
    const good = state.goodsById.get(productId);
    if (!good) continue;
    state.goodsById.set(productId, reverseFinishedConsumption(good, finishedMoves));
    state.touchedGoods.add(productId);
  }
  const revertedSupplies = reverseSupplies(
    supplyMoves,
    Array.from(state.suppliesById.values()),
  );
  for (const supply of revertedSupplies) {
    state.suppliesById.set(supply.id, supply);
    state.touchedSupplies.add(supply.id);
  }
}

// Reconcilia cada item do recibo NOVO, mutando o estado.
function applyForward(
  state: ReconState,
  items: ReconItem[],
  ctx: ReconContext,
): ReconItemResult[] {
  const productsById = new Map(ctx.products.map((p) => [p.id, p]));
  const pricingOf = makePricingResolver(ctx);

  return items.map((item): ReconItemResult => {
    const qty = Math.max(0, num(item.quantity));
    const product = productsById.get(item.productId);
    const priced = product ? pricingOf(product) : null;
    const { partes, conjunto } = partesDoItem(item, product);

    // FEAT-11 + W1: cada parte escolhe a SUA prateleira — e, sem peça
    // registrada em nenhuma, ganha a camada de acerto — ANTES do consumo, para o
    // `consumeFifo` seguir sem caso especial.
    let good = state.goodsById.get(item.productId) ?? null;
    const colors: Record<string, string> = {};
    let acerto = false;
    let semCusto = false;
    for (const parte of partes) {
      const cadastro =
        product && priced
          ? cadastroDaParte(product, priced, parte.subitemId, ctx)
          : null;
      const r = resolverParte(good, parte, item, cadastro, qty, ctx);
      good = r.good;
      colors[parte.key] = r.colorKey;
      acerto = acerto || r.acerto;
      semCusto = semCusto || r.semCusto;
    }

    // BUG-05: vender o CONJUNTO drena uma de cada parte.
    const res = conjunto
      ? consumeWholeFifo(
          good,
          partes.map((p) => ({ subitemId: p.subitemId, colorKey: colors[p.key] })),
          qty,
        )
      : consumeFifo(good, partes[0].subitemId, colors[partes[0].key], qty);
    // O doc só muda (e só leva a camada de acerto junto) quando algo saiu dele.
    if (good && res.moves.length > 0) {
      state.goodsById.set(item.productId, applyFinishedConsumption(good, res.moves));
      state.touchedGoods.add(item.productId);
    }

    // W4 — os acessórios do conjunto saem na venda do conjunto montado.
    const usages = conjunto && product ? conjuntoAccessoryRows(product, qty) : [];
    const insumos =
      usages.length > 0
        ? planSupplies(
            usages,
            Array.from(state.suppliesById.values()),
            ctx.genId(),
            "real",
            ctx.at,
          )
        : null;
    for (const supply of insumos?.supplyUpdates ?? []) {
      state.suppliesById.set(supply.id, supply);
      state.touchedSupplies.add(supply.id);
    }
    const custoInsumos = insumos?.cost ?? 0;

    // [FROTA] Fase 1 — a repartição sai das CAMADAS drenadas, a única testemunha
    // de quem imprimiu. `res.machineUsage` é o TOTAL do consumo; a escala
    // guardada é POR UNIDADE ATRIBUÍDA (não por unidade vendida), de modo que o
    // ROI possa extrapolá-la para as `quantity` e descobrir sozinho que sobra
    // uma parte sem dono.
    const atribuidas = Math.max(0, qty - res.unattributedUnits);
    const cogsTotal = res.cost + custoInsumos;
    return {
      key: item.key,
      machineUsage:
        atribuidas > 0 ? scaleMachineUsage(res.machineUsage, 1 / atribuidas) : [],
      unattributedUnits: res.unattributedUnits,
      cogsTotal,
      cogsUnit: qty > 0 ? cogsTotal / qty : 0,
      // FEAT-06: `res.breakdown` é o TOTAL do consumo — ÷ qty para virar a
      // escala por unidade. Esquecer essa divisão passaria despercebido em
      // quantidade 1 e inflaria a composição em qualquer outra.
      ...(qty > 0 && (res.moves.length > 0 || custoInsumos > 0)
        ? {
            cogsBreakdown: scaleFrozen(
              addFrozen(res.breakdown, { ...ZERO_FROZEN, supplies: custoInsumos }),
              1 / qty,
            ),
          }
        : {}),
      cogsBreakdownPartial: res.costUnknown > 0,
      finishedMoves: res.moves,
      colors,
      supplyMoves: insumos?.moves ?? [],
      finishedShortfall: res.shortfall,
      acerto,
      missingProduct: semCusto,
      supplyShortfall: insumos?.shortfall ?? 0,
    };
  });
}

function collectSupplyUpdates(state: ReconState): Supply[] {
  return Array.from(state.touchedSupplies).map(
    (id) => state.suppliesById.get(id)!,
  );
}

function collectFinishedUpdates(state: ReconState): FinishedGoodPayload[] {
  return Array.from(state.touchedGoods).map((id) =>
    finishedGoodToPayload(state.goodsById.get(id)!),
  );
}

// O que o recibo ANTIGO consumiu, para estornar antes de reaplicar (edição).
export type OldReciboState = {
  finishedMoves: FinishedMove[];
  supplyMoves: StockMove[];
};

// Plano completo de escrita de um recibo — o que o `reconcileRecibo` grava numa
// única transação.
export type ReciboWritePlan = {
  items: ReconItemResult[];
  supplyUpdates: Supply[];
  finishedUpdates: FinishedGoodPayload[];
};

/**
 * Reconciliação de PREVIEW da `SaleModal` — custo real por item e avisos. PURA.
 *
 * `old` é o recibo que está sendo EDITADO (null numa venda nova). Ele existe
 * aqui por causa do UX-42: esta função fazia só o forward enquanto a gravação
 * fazia estorno-e-reaplicação, então o preview não creditava de volta o que o
 * recibo antigo já tinha consumido e acusava falta que não existia.
 *
 * Por isso ela delega ao `reconcileReciboWrite` em vez de repetir o cálculo: as
 * duas PRECISAM concordar, e duas implementações que precisam concordar são
 * duas implementações que um dia divergem.
 */
export function planReciboReconciliation(
  items: ReconItem[],
  ctx: ReconContext,
  old: OldReciboState | null = null,
): ReciboWritePlan {
  return reconcileReciboWrite(items, old, ctx);
}

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
  if (old) applyReverse(state, old.finishedMoves, old.supplyMoves);
  const results = applyForward(state, items, ctx);
  return {
    items: results,
    supplyUpdates: collectSupplyUpdates(state),
    finishedUpdates: collectFinishedUpdates(state),
  };
}

/**
 * Estorno de um recibo (exclusão): devolve ao estoque exatamente o que o recibo
 * consumiu — as camadas do acabado (`finishedMoves`) e os insumos do conjunto
 * (`supplyMoves`, W4). Round-trip de `planReciboReconciliation`.
 */
export function reverseReciboReconciliation(
  finishedMoves: FinishedMove[],
  supplyMoves: StockMove[],
  goods: FinishedGood[],
  supplies: Supply[],
): {
  supplyUpdates: Supply[];
  finishedUpdates: FinishedGoodPayload[];
} {
  const affectedGoods = new Set(finishedMoves.map((move) => move.productId));
  const finishedUpdates = goods
    .filter((good) => affectedGoods.has(good.productId))
    .map((good) =>
      finishedGoodToPayload(reverseFinishedConsumption(good, finishedMoves)),
    );

  return {
    supplyUpdates: reverseSupplies(supplyMoves, supplies),
    finishedUpdates,
  };
}
