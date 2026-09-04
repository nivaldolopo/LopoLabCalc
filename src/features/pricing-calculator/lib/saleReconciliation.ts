import { num } from "@/lib/number";
import { calculatePricing } from "./calculatePricing";
import { NO_COLOR_KEY } from "./filaments";
import {
  applyFinishedConsumption,
  consumeFifo,
  consumeWholeFifo,
  finishedGoodToPayload,
  reverseFinishedConsumption,
  WHOLE_PART_KEY,
} from "./finishedGoods";
import {
  reverseProduction,
  reverseSupplies,
  scaleFrozen,
  scaleMachineUsage,
} from "./production";
import {
  buildProductionPayloads,
  encomendaMachineOptions,
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
  FrozenCostBreakdown,
  Machine,
  MachineUsage,
  ProductionPayload,
  SaleItemOrigin,
  SavedProduct,
  StockFilament,
  Supply,
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
  // FEAT-11 — a COR escolhida para tirar cada peça da prateleira, por parte:
  // `subitemId` (produto que vende por partes) ou `WHOLE_PART_KEY`. Um mapa, e
  // não uma cor só, porque o conjunto pode ser corpo azul + tampa vermelha.
  //
  // Só o caminho `acabado` usa: a ENCOMENDA produz na hora, com as cores do
  // cadastro do produto (decisão do dono — trocar cor é na /producao). Parte sem
  // entrada aqui cai em `NO_COLOR_KEY` — o balde do que foi produzido antes do
  // FEAT-11 —, que é exatamente onde o saldo antigo está.
  colors?: Record<string, string>;
  // [FROTA] Fase 2 — a máquina que IMPRIMIU esta encomenda, escolhida no modal
  // de venda. Só o caminho `encomenda` usa: a peça pronta lê quem imprimiu das
  // CAMADAS do acabado, que é testemunha melhor que qualquer seleção.
  //
  // ⚠ Existe porque a encomenda cria os eventos SOZINHA, sem passar pela
  // `/producao` — sem isto, todo produto elegível a 2+ máquinas vendia sem
  // creditar impressora nenhuma ao ROI (o custo saía certo, a atribuição não).
  // Ausente/vazia é um estado válido: as unidades ficam órfãs, como sempre.
  machineId?: string;
};

export type ReconItemResult = {
  key: string;
  origem: SaleItemOrigin;
  cogsUnit: number; // custo real por unidade (congelado)
  cogsTotal: number; // cogsUnit × quantidade
  // FEAT-06: a composição do `cogsUnit` — POR UNIDADE, a mesma escala do
  // `SaleCostBreakdown`, para os dois poderem ser exibidos lado a lado.
  // Ausente quando não há o que detalhar (camada anterior ao FEAT-06, produto
  // fora do catálogo, ou consumo vazio). `cogsBreakdownPartial` marca o caso
  // meio-a-meio: parte do COGS veio de camada sem composição.
  cogsBreakdown?: FrozenCostBreakdown;
  cogsBreakdownPartial: boolean;
  // [FROTA] Fase 1 — a repartição REAL por máquina desta linha, POR UNIDADE
  // ATRIBUÍDA. É AQUI que ela nasce, e não mais no `saleContext`: quem imprimiu
  // só se sabe na reconciliação — dos EVENTOS (encomenda) ou das CAMADAS
  // drenadas (acabado). Vazia = sem lastro nenhum.
  machineUsage: MachineUsage[];
  // [FROTA] Fase 1 — quantas das `quantity` unidades não têm origem conhecida
  // (camada anterior à Fase 1, overdraft D4, produto fora do catálogo). É o que
  // impede o ROI de distribuir 100% do lucro quando parte da venda não tem dono.
  unattributedUnits: number;
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
  // 7e: idem para os insumos das encomendas (só o campo `lots` é gravado).
  supplyUpdates: Supply[];
  // Estado FINAL dos acabados tocados pelas peças prontas.
  finishedUpdates: FinishedGoodPayload[];
};

export type ReconContext = {
  goods: FinishedGood[];
  colors: StockFilament[];
  supplies: Supply[];
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

// Estado mutável do estoque durante a reconciliação (cores + acabados), com o
// conjunto do que foi TOCADO — é o que permite o estorno-e-reaplicação da edição
// somar reverse (recibo antigo) e forward (recibo novo) sobre o MESMO saldo.
type ReconState = {
  goodsById: Map<string, FinishedGood>;
  colorsById: Map<string, StockFilament>;
  suppliesById: Map<string, Supply>;
  touchedGoods: Set<string>;
  touchedColors: Set<string>;
  touchedSupplies: Set<string>;
};

function newState(ctx: ReconContext): ReconState {
  return {
    goodsById: new Map(ctx.goods.map((g) => [g.productId, g])),
    colorsById: new Map(ctx.colors.map((c) => [c.id, c])),
    suppliesById: new Map(ctx.supplies.map((s) => [s.id, s])),
    touchedGoods: new Set(),
    touchedColors: new Set(),
    touchedSupplies: new Set(),
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
  // 7e: os mesmos `stockMoves` carregam os insumos (filtrados por `kind`).
  const revertedSupplies = reverseSupplies(
    productionStockMoves,
    Array.from(state.suppliesById.values()),
  );
  for (const supply of revertedSupplies) {
    state.suppliesById.set(supply.id, supply);
    state.touchedSupplies.add(supply.id);
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
      cogsBreakdownPartial: false,
      machineUsage: [],
      // Nada é atribuído até que se prove o contrário: o item que cai fora dos
      // dois caminhos (produto sumido do catálogo) fica inteiro sem lastro.
      unattributedUnits: qty,
      finishedMoves: [],
      productionEventIds: [],
      finishedShortfall: 0,
      crossesRoll: false,
      filamentShortfallG: 0,
      missingProduct: false,
    };

    if (item.origem === "acabado") {
      const good = state.goodsById.get(item.productId) ?? null;
      // BUG-05: o acabado de um produto que vende por partes guarda uma SKU por
      // subitem (não uma do inteiro). Vender o CONJUNTO drena uma de cada parte.
      const product = productsById.get(item.productId);
      // FEAT-11: cada parte sai da SUA cor (o mapa vem da venda). Sem escolha
      // registrada, cai no balde sem cor — onde mora o saldo pré-FEAT-11.
      const colorOf = (partKey: string) =>
        item.colors?.[partKey] ?? NO_COLOR_KEY;
      const wholeParts =
        !item.subitemId && product?.sellBySubitems && product.subitems.length > 0
          ? product.subitems.map((s) => ({
              subitemId: s.id,
              colorKey: colorOf(s.id),
            }))
          : null;
      const res = wholeParts
        ? consumeWholeFifo(good, wholeParts, qty)
        : consumeFifo(
            good,
            item.subitemId,
            colorOf(item.subitemId ?? WHOLE_PART_KEY),
            qty,
          );
      if (good && res.moves.length > 0) {
        state.goodsById.set(
          item.productId,
          applyFinishedConsumption(good, res.moves),
        );
        state.touchedGoods.add(item.productId);
      }
      // [FROTA] Fase 1 — a repartição sai das CAMADAS drenadas, que é a única
      // testemunha de quem imprimiu a peça pronta. `res.machineUsage` é o TOTAL
      // do consumo; a escala guardada é POR UNIDADE ATRIBUÍDA (não por unidade
      // vendida), de modo que o ROI possa extrapolá-la para as `quantity` e
      // descobrir sozinho que sobra uma parte sem dono.
      const atribuidas = Math.max(0, qty - res.unattributedUnits);
      return {
        ...base,
        machineUsage:
          atribuidas > 0
            ? scaleMachineUsage(res.machineUsage, 1 / atribuidas)
            : [],
        unattributedUnits: res.unattributedUnits,
        cogsTotal: res.cost,
        cogsUnit: qty > 0 ? res.cost / qty : 0,
        // FEAT-06: `res.breakdown` é o TOTAL do consumo — ÷ qty para virar a
        // escala por unidade. Esquecer essa divisão passaria despercebido em
        // quantidade 1 e inflaria a composição em qualquer outra.
        ...(qty > 0 && res.moves.length > 0
          ? { cogsBreakdown: scaleFrozen(res.breakdown, 1 / qty) }
          : {}),
        cogsBreakdownPartial: res.costUnknown > 0,
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
      rows = sub
        ? subitemEventRows(product, sub, colorsNow, ctx.machines)
        : [];
    } else {
      rows = wholeEventRows(product, ctx.machines, colorsNow);
    }

    // [FROTA] Fase 2 — a máquina escolhida no modal preenche as linhas que
    // nasceram AMBÍGUAS (`initialRowMachineId` devolve "" quando a etapa é
    // elegível a mais de uma). Duas guardas, e as duas importam:
    //
    // · Linha que JÁ tem máquina não é tocada — ela tinha uma elegível só, logo
    //   não havia escolha a fazer, e sobrescrevê-la trocaria um fato por um
    //   palpite de nível de item.
    // · A escolha só vale onde a etapa a aceita. Um produto cuja etapa principal
    //   cabe em tudo e cuja etapa de acabamento só cabe na X2D não pode ter a
    //   segunda carimbada com "A1" só porque o item foi marcado assim. O modal
    //   já oferece apenas a INTERSEÇÃO, mas a regra mora aqui: quem grava é quem
    //   garante.
    //
    // ⚠ AUD-17 [E2]: a escolha pode faltar e AINDA ASSIM haver uma resposta
    // única — quando a interseção das linhas ambíguas tem exatamente UMA
    // máquina. `unicaCandidata` a usa, e não é palpite: é a única impressora que
    // TODAS as etapas em aberto aceitam.
    const escolhida = item.machineId || unicaCandidata(rows, ctx.machines);
    if (escolhida) {
      rows = rows.map((row) =>
        row.machineId || !rowAceita(row, escolhida, ctx.machines)
          ? row
          : { ...row, machineId: escolhida },
      );
    }

    // BUG-02: os builders devolvem 1 PLACA (crua) de N = `piecesCount` peças. A
    // encomenda vende `qty` PEÇAS, então imprime `qty/pieces` placas → filamento e
    // COGS por peça = placa÷N, batendo com o preço de venda por peça. (Encomenda
    // não estoca as peças sobrando de uma placa parcial — o make-to-order não cria
    // acabado; decisão do dono.)
    const pieces = Math.max(1, num(product.piecesCount) || 1);
    const scaled = rows.map((row) => scaleRow(row, qty / pieces));
    const planned = planEventRows(
      scaled,
      "real",
      colorsNow,
      Array.from(state.suppliesById.values()),
      ctx.machines,
      ctx.genId,
      // AUD-16 [E7]: a data da venda é a do evento de produção que ela cria —
      // e, se alguma cor não tiver rolo, a do lote de acerto.
      ctx.at,
    );
    for (const color of planned.colorUpdates) {
      state.colorsById.set(color.id, color);
      state.touchedColors.add(color.id);
    }
    for (const supply of planned.supplyUpdates) {
      state.suppliesById.set(supply.id, supply);
      state.touchedSupplies.add(supply.id);
    }
    const payloads = buildProductionPayloads(planned.built, {
      at: ctx.at,
      outcome: "encomenda",
      mode: "real",
      notes: ctx.notes,
      createdAt: ctx.createdAt,
    });
    productionCreates.push(...payloads);

    // [FROTA] Fase 1/2 — a escala do `machineUsage` é POR UNIDADE ATRIBUÍDA, a
    // mesma do caminho `acabado` (linha ~290) e a que o ROI cobra: o
    // `machineRoi.ts` multiplica `share.depreciation` por `qty × cobertura`.
    //
    // ⚠ AUD-17 [E1]: aqui era `1 / qty` — por unidade VENDIDA. Com órfãs > 0 a
    // cobertura entrava DUAS vezes e a depreciação recuperada saía multiplicada
    // por ela a mais. Medido no cartão da A1 Mini: R$ 0,53 recuperados de R$ 1,60
    // reais. Lucro e receita não notavam — a fatia deles é uma RAZÃO entre as
    // máquinas, e uma escala comum se cancela; `depreciation` é o único campo
    // ABSOLUTO do `MachineUsage`, e por isso o único que errava. Com
    // `unattributedUnits === 0` os dois divisores são o mesmo número, que é
    // exatamente por que os testes da Fase 1 não pegaram.
    const fracaoOrfa = orfas(planned.summary);
    const atribuidas = qty * (1 - fracaoOrfa);

    return {
      ...base,
      // [FROTA] Fase 1 — na encomenda a testemunha são os EVENTOS que acabaram
      // de ser planejados: cada um é uma etapa numa máquina, com a depreciação
      // REAL do custo congelado. As linhas já foram escaladas para `qty` peças,
      // então a repartição cobre o lote inteiro — menos as horas que ficaram sem
      // máquina, que saem pelo `unattributedUnits` logo abaixo.
      ...(qty > 0 && atribuidas > 0 && planned.summary.machineUsage.length > 0
        ? {
            machineUsage: scaleMachineUsage(
              planned.summary.machineUsage,
              1 / atribuidas,
            ),
            // ⚠ [FROTA] Fase 2 — antes era `unattributedUnits: 0` fixo, porque
            // toda etapa tinha uma máquina. Agora ela pode não ter: o produto é
            // elegível a mais de uma e a encomenda não tem quem escolha (a
            // `/producao` pergunta; a venda, não). Essas horas não somem — elas
            // saem da cobertura, na PROPORÇÃO delas.
            //
            // 🔴 Sem isto, o `horas ÷ total` do ROI voltaria a fechar em 1 sobre
            // as máquinas conhecidas e rataria para elas o lucro das horas
            // órfãs: exatamente o defeito que o `unattributedUnits` existe para
            // impedir, só que entrando pela porta nova.
            unattributedUnits: qty * fracaoOrfa,
          }
        : // Encomenda que não produziu nada (subitem cujo preço não resolveu, ou
          // qty 0), ou nenhuma etapa com máquina declarada: sem máquina não há
          // origem, e as unidades ficam órfãs em vez de "atribuídas a ninguém" —
          // que é o que soma 1 e some do radar.
          { machineUsage: [], unattributedUnits: qty }),
      cogsTotal: planned.summary.frozen,
      cogsUnit: qty > 0 ? planned.summary.frozen / qty : 0,
      // Encomenda: o evento acabou de ser planejado, então a composição está
      // sempre completa (nunca parcial). Mesma divisão por `qty` do acabado.
      ...(qty > 0
        ? { cogsBreakdown: scaleFrozen(planned.summary.frozenBreakdown, 1 / qty) }
        : {}),
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

/**
 * Reconciliação de PREVIEW da `SaleModal` — custo real por item e avisos. PURA.
 *
 * `old` é o recibo que está sendo EDITADO (null numa venda nova). Ele existe
 * aqui por causa do UX-42: esta função fazia só o forward enquanto a gravação
 * fazia estorno-e-reaplicação, então o preview não creditava de volta o que o
 * recibo antigo já tinha consumido e acusava falta que não existia. Medido: com
 * 1 conjunto em estoque, editar 1 → 2 avisava "o saldo fica negativo" e o
 * resultado real era 0, sem overdraft. Além do aviso, isso atingia o
 * `crossesRoll`, o `filamentShortfallG` e o CUSTO exibido durante a edição, que
 * podia divergir do gravado quando o FIFO atravessa rolo.
 *
 * Por isso ela delega ao `reconcileReciboWrite` em vez de repetir o cálculo: as
 * duas PRECISAM concordar, e duas implementações que precisam concordar são
 * duas implementações que um dia divergem. Aqui só se descarta o que é de
 * escrita (os ids a apagar).
 */
export function planReciboReconciliation(
  items: ReconItem[],
  ctx: ReconContext,
  old: OldReciboState | null = null,
): ReciboReconciliation {
  const plan = reconcileReciboWrite(items, old, ctx);
  return {
    items: plan.items,
    productionPayloads: plan.productionCreates,
    colorUpdates: plan.colorUpdates,
    supplyUpdates: plan.supplyUpdates,
    finishedUpdates: plan.finishedUpdates,
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
// única transação. `productionDeleteIds` são os eventos das encomendas do
// recibo antigo, apagados junto (idempotente se algum já sumiu).
export type ReciboWritePlan = {
  items: ReconItemResult[];
  productionCreates: { id: string; payload: ProductionPayload }[];
  productionDeleteIds: string[];
  colorUpdates: StockFilament[];
  supplyUpdates: Supply[];
  finishedUpdates: FinishedGoodPayload[];
};

/**
 * Plano de escrita de um recibo com ESTORNO-E-REAPLICAÇÃO: reverte o recibo antigo
 * (`old`) e reaplica o novo (`items`) sobre o MESMO saldo, numa passada só. PURA.
 * `old` null = venda nova (nada a estornar). É como editar 3 → 2 unidades devolve
 * exatamente 1 ao estoque sem corromper nada.
 */
/**
 * [FROTA] Fase 2 — a fração das horas do lote que ficou SEM máquina declarada.
 *
 * É por horas, e não por evento, porque é assim que o ROI reparte lucro e
 * receita (`share.hours ÷ Σ hours`): uma etapa de 6h sem dono ao lado de uma de
 * 1h com dono não é "metade atribuída".
 */
function orfas(summary: {
  machineUsage: { hours: number }[];
  unattributedHours: number;
}): number {
  const orfa = Math.max(0, summary.unattributedHours);
  const total =
    summary.machineUsage.reduce((sum, u) => sum + Math.max(0, u.hours), 0) + orfa;
  if (total <= 0) return 0;
  return Math.min(1, orfa / total);
}

/**
 * [FROTA] Fase 2 — a etapa desta linha aceita a máquina escolhida?
 *
 * Conjunto VAZIO significa "frota inteira" (é como chega todo produto anterior à
 * fase), então qualquer máquina viva serve. Conjunto declarado só aceita quem
 * está nele.
 */
/**
 * [FROTA] Fase 2 — AUD-17 [E2]: a máquina que a INTERSEÇÃO decide sozinha.
 *
 * O seletor da venda só aparece com DÚVIDA (2+ candidatas), pela regra do dono
 * ("vazia só quando há dúvida"). O comentário do modal assumia que, com uma
 * candidata só, "o builder já preencheu" — e não preenche: o
 * `initialRowMachineId` olha o conjunto DA LINHA, então duas etapas de duas
 * elegíveis cada nascem as duas vazias mesmo quando a única impressora em comum
 * é evidente. A venda gravava `machineUsage: []`, `unattributedUnits = qty` e
 * dois eventos com `machineId: ""` — dado perdido onde existia UMA resposta.
 *
 * Resolver aqui, e não na tela, é de propósito: quem grava é quem garante, e a
 * mesma dedução vale para o preview, para a edição do recibo e para qualquer
 * chamador futuro que não passe por este modal.
 *
 * ⚠ Duas candidatas continuam ÓRFÃS. Escolher a de maior peso seria o palpite
 * que a Fase 2 recusa (DEC): o peso diz com que frequência a frota roda, não
 * quem rodou ESTA peça.
 */
function unicaCandidata(rows: EventRow[], machines: Machine[]): string {
  const options = encomendaMachineOptions(rows, machines);
  return options && options.length === 1 ? options[0].id : "";
}

function rowAceita(
  row: { fleetMachineIds: string[] },
  machineId: string,
  machines: Machine[],
): boolean {
  const declarado = (row.fleetMachineIds ?? []).filter((id) =>
    machines.some((m) => m.id === id),
  );
  if (declarado.length === 0) return machines.some((m) => m.id === machineId);
  return declarado.includes(machineId);
}

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
    supplyUpdates: collectSupplyUpdates(state),
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
  supplies: Supply[] = [],
): {
  colorUpdates: StockFilament[];
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
    colorUpdates: reverseProduction(productionStockMoves, colors),
    supplyUpdates: reverseSupplies(productionStockMoves, supplies),
    finishedUpdates,
  };
}
