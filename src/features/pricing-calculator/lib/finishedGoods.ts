import { num } from "@/lib/number";
import { NO_COLOR, type ColorKey } from "./filaments";
import { addFrozen, scaleFrozen, sumFrozen, ZERO_FROZEN } from "./production";
import type {
  FinishedColorEntry,
  FinishedConsumptionResult,
  FinishedGood,
  FinishedGoodPayload,
  FinishedLayer,
  FinishedMove,
  FinishedSku,
  FrozenCostBreakdown,
} from "../types";

// Matemática pura do Estoque de Produtos / acabados (FEAT-05a). Espelha o FIFO do
// filamento (`lib/stock.ts`), INVERTIDO: a produção EMPILHA camadas (como a compra
// de rolo) e a venda CONSOME (passo 8). Puro por construção: descreve o doc novo,
// sem tocar no Firestore — quem persiste é o `finishedGoodsRepository`, e a baixa
// da produção (05b) grava no mesmo `writeBatch` do evento.
//
// Todas as funções são imutáveis: devolvem um doc/SKU novo, nunca mexem no
// recebido.

// Uma SKU a incrementar por uma produção `estoque`. Uma por unidade vendável do
// que foi impresso: o inteiro (produto sem subitens) OU cada subitem (produto que
// vende por partes). `unitCost` é o custo de produção congelado, por unidade.
export type FinishedEntry = {
  subitemId?: string;
  // FEAT-11: a cor DESTA peça — por subitem, não por submissão. Produzir o
  // inteiro de um produto corpo-azul + tampa-vermelha credita duas SKUs de cores
  // diferentes no mesmo evento. Ausente = `NO_COLOR` (o `submissionEntries`, único
  // construtor em produção, sempre preenche).
  color?: ColorKey;
  name: string;
  qty: number;
  unitCost: number;
  // FEAT-06: a composição do `unitCost`, escalada pelo MESMO fator que ele.
  // Ausente quando quem chamou não passou o breakdown da submissão.
  unitBreakdown?: FrozenCostBreakdown;
};

/**
 * Delta do acabado de UMA submissão da /producao (FEAT-05b). PURA. Só chamada
 * quando `outcome === "estoque"` e há produto (avulso não vira acabado). O
 * `totalFrozenCost` é a soma do `frozenCost` de TODOS os eventos da submissão (o
 * custo real da tiragem inteira — dedup multi-máquina: N eventos, mas uma placa).
 *
 * ⚠ BUG-02: uma submissão = `units` unidades físicas, NÃO 1. `units =
 * piecesCount × placas` — uma placa de N peças gera N acabados, e P placas geram
 * N×P. Cada entrada leva `qty: units` e `unitCost = custo_da_parte ÷ units`, de
 * modo que o valor total (qty × unitCost) some exatamente o `totalFrozenCost` (a
 * mesma matemática ÷N da precificação; espelha o preço/peça correto).
 *
 * Três formas:
 *  - subitem avulso selecionado (`subitemId` dado) → 1 SKU daquele subitem;
 *  - inteiro COM subitens (`subitems` não vazio) → 1 SKU por subitem, rateando o
 *    `totalFrozenCost` pelas proporções do `SubitemPrice.cost` (aditivo/FEAT-01;
 *    se Σcost = 0, divide igual — degenerado);
 *  - inteiro SEM subitens → 1 SKU do inteiro.
 *
 * FEAT-06: `opts.breakdown` é a composição do `totalFrozenCost` (mesma escala).
 * Cada entrada recebe `unitBreakdown` derivado por UM fator escalar — o mesmo que
 * produz o `unitCost` —, então `sumFrozen(unitBreakdown) === unitCost` sai de
 * graça, em vez de depender de duas contas que precisam concordar.
 *
 * FEAT-11: a COR entra por entrada, não pela submissão. No inteiro-com-subitens
 * cada parte traz a sua (as cores das etapas daquele subitem), porque um produto
 * pode ser corpo azul + tampa vermelha de projeto. Sem cor informada = `NO_COLOR`.
 */
export function submissionEntries(
  productName: string,
  totalFrozenCost: number,
  opts: {
    subitemId?: string;
    subitemName?: string;
    color?: ColorKey;
    subitems?: { id: string; name: string; cost: number; color?: ColorKey }[];
    units?: number;
    breakdown?: FrozenCostBreakdown;
  } = {},
): FinishedEntry[] {
  const total = num(totalFrozenCost);
  const units = Math.max(1, Math.round(num(opts.units ?? 1)));
  const breakdown = opts.breakdown;

  // `share` = a fatia da submissão que cabe a esta SKU (1 = tudo). O fator final
  // divide pelas unidades físicas — total e componentes passam pelo MESMO.
  const entry = (
    base: Omit<FinishedEntry, "qty" | "unitCost" | "unitBreakdown">,
    share: number,
  ): FinishedEntry => {
    const factor = share / units;
    return {
      ...base,
      qty: units,
      unitCost: total * factor,
      ...(breakdown ? { unitBreakdown: scaleFrozen(breakdown, factor) } : {}),
    };
  };

  if (opts.subitemId) {
    return [
      entry(
        {
          subitemId: opts.subitemId,
          color: opts.color ?? NO_COLOR,
          name: opts.subitemName || productName,
        },
        1,
      ),
    ];
  }

  const subs = opts.subitems ?? [];
  if (subs.length > 0) {
    const sumCost = subs.reduce((sum, s) => sum + num(s.cost), 0);
    return subs.map((s) =>
      entry(
        { subitemId: s.id, color: s.color ?? NO_COLOR, name: s.name },
        sumCost > 0 ? num(s.cost) / sumCost : 1 / subs.length,
      ),
    );
  }

  return [entry({ color: opts.color ?? NO_COLOR, name: productName }, 1)];
}

// A sentinela da peça sem subitem. Exportada (FEAT-11) para quem precisa chavear
// a peça sem ter subitem: a venda guarda a cor escolhida por parte, e o produto
// sem partes entra por esta chave.
export const WHOLE_PART_KEY = "__whole__";
const WHOLE_KEY = WHOLE_PART_KEY;

// Chave estável da SKU: o subitem (ou a sentinela do inteiro) MAIS a cor
// (FEAT-11). Duas entradas da mesma SKU somam no mesmo saldo; a mesma peça em
// outra cor abre saldo próprio.
function skuKey(subitemId: string | undefined, colorKey: string): string {
  return `${subitemId ?? WHOLE_KEY}::${colorKey || NO_COLOR.key}`;
}

// FEAT-11 — as duas pontes entre o `Record` de memória (prático para consultar
// por parte) e a LISTA que o Firestore aceita. O porquê da lista está no
// `FinishedColorEntry`, em `types.ts`.
export function colorEntriesOf(
  colors: Record<string, string> | undefined,
): FinishedColorEntry[] {
  return Object.entries(colors ?? {}).map(([part, colorKey]) => ({
    part,
    colorKey,
  }));
}

export function colorRecordOf(
  entries: FinishedColorEntry[] | undefined,
): Record<string, string> {
  const record: Record<string, string> = {};
  for (const entry of entries ?? []) {
    if (entry?.part) record[entry.part] = entry.colorKey;
  }
  return record;
}

// A chave de uma SKU já materializada.
function keyOfSku(sku: FinishedSku): string {
  return skuKey(sku.subitemId, sku.colorKey);
}

// Id determinístico da camada: um evento cria no máximo UMA camada por SKU, então
// evento+SKU identifica sem ambiguidade (e o teste não depende de UUID).
function layerId(eventId: string, subitemId: string | undefined, colorKey: string): string {
  return `${eventId}__${skuKey(subitemId, colorKey)}`;
}

// Camadas em ordem FIFO: produção mais antiga primeiro (empate resolvido pela
// ordem de inserção, para o consumo ser determinístico entre simulação e baixa —
// mesma disciplina do `fifoRolls` do filamento).
function fifoLayers(sku: FinishedSku): FinishedLayer[] {
  return sku.layers
    .map((layer, index) => ({ layer, index }))
    .sort((a, b) => num(a.layer.at) - num(b.layer.at) || a.index - b.index)
    .map((entry) => entry.layer);
}

// Saldo de uma SKU: soma das camadas. Pode ser NEGATIVO (D4) — o sintoma de
// vender mais do que se produziu, que se quer enxergar (só a partir do passo 8).
export function skuBalance(sku: FinishedSku): number {
  return sku.layers.reduce((sum, layer) => sum + num(layer.qty), 0);
}

export function findSku(
  good: FinishedGood | null | undefined,
  subitemId: string | undefined,
  colorKey: string,
): FinishedSku | undefined {
  if (!good) return undefined;
  const key = skuKey(subitemId, colorKey);
  return good.skus.find((sku) => keyOfSku(sku) === key);
}

// Saldo de UMA cor de uma peça (0 quando nunca foi produzida naquela cor).
export function balanceOf(
  good: FinishedGood | null | undefined,
  subitemId: string | undefined,
  colorKey: string,
): number {
  const sku = findSku(good, subitemId, colorKey);
  return sku ? skuBalance(sku) : 0;
}

// Todas as SKUs de UMA peça (o inteiro ou um subitem), uma por cor produzida.
export function skusOfPart(
  good: FinishedGood | null | undefined,
  subitemId?: string,
): FinishedSku[] {
  if (!good) return [];
  const part = subitemId ?? WHOLE_KEY;
  return good.skus.filter((sku) => (sku.subitemId ?? WHOLE_KEY) === part);
}

/**
 * Saldo de uma peça SOMANDO TODAS AS CORES (FEAT-11).
 *
 * É este — e não o saldo por cor — que responde "quantas dessas eu tenho na
 * prateleira": ter 2 azuis e 1 preto são 3 peças. A cor escolhe DE ONDE tirar
 * (`consumeFifo`), não quantas existem.
 */
export function partBalance(
  good: FinishedGood | null | undefined,
  subitemId?: string,
): number {
  return skusOfPart(good, subitemId).reduce((sum, sku) => sum + skuBalance(sku), 0);
}

// Uma cor disponível de uma peça (linha do seletor da venda / da tela do estoque).
export type ColorBalance = {
  colorKey: string;
  colorLabel: string;
  balance: number;
};

/**
 * As cores em que uma peça existe hoje, da maior para a menor (FEAT-11) — a
 * fonte do seletor de cor da venda e do detalhe por parte no estoque. Traz só o
 * que tem saldo ≠ 0: cor zerada não é opção de venda, e saldo NEGATIVO (D4)
 * continua aparecendo, porque esconder o buraco é justamente o que não se quer.
 * Empate resolvido pelo rótulo, para a ordem não oscilar entre renders.
 */
export function colorsWithBalance(
  good: FinishedGood | null | undefined,
  subitemId?: string,
): ColorBalance[] {
  return skusOfPart(good, subitemId)
    .map((sku) => ({
      colorKey: sku.colorKey,
      colorLabel: sku.colorLabel,
      balance: skuBalance(sku),
    }))
    .filter((c) => c.balance !== 0)
    .sort((a, b) => b.balance - a.balance || a.colorLabel.localeCompare(b.colorLabel));
}

/**
 * O doc lido virando o payload que se grava. UM lugar só, porque são TRÊS os
 * construtores de payload do acabado (esta função, o `addProductionLayers` e a
 * exclusão do evento na `/producao`) e campo esquecido em um deles não aparece
 * no preço nem na tela — FORM-01 aplicado a metadado de documento.
 *
 * ⚠ TD-026: o campo que some é o `rev`. Ele NÃO vai para o documento (o
 * `finishedGoodToDocument` o ignora de propósito; quem escreve o número novo é a
 * transação) — ele viaja no payload só para dizer à trava CONTRA QUAL VERSÃO
 * este plano foi calculado. Payload sem `rev` promete "versão 0", que só existe
 * antes da primeira produção: da segunda em diante a trava recusa a gravação com
 * a mensagem — falsa — de que outra aba mexeu no documento. Foi assim que a
 * `/producao` ficou produzindo cada produto uma única vez.
 */
export function finishedGoodToPayload(good: FinishedGood): FinishedGoodPayload {
  return {
    productId: good.productId,
    productName: good.productName,
    skus: good.skus,
    createdAt: good.createdAt,
    rev: good.rev,
  };
}

/**
 * Incremento de UMA produção `estoque` no doc do acabado. PURA: devolve o doc
 * novo, não grava. Cria o doc quando `good` é null (1ª produção do produto).
 *
 * Cada entry vira/soma uma camada na sua SKU. A `layerId` é evento+SKU, e a
 * inserção CONFERE esse id antes de empurrar: reaplicar o mesmo evento na mesma
 * SKU não soma nada (idempotente por evento). TD-023 — a conferência é nova; o
 * comentário afirmava a garantia desde o início, mas o código só fazia `push`.
 * Entries com qty ≤ 0 são ignoradas.
 *
 * ⚠ TD-027 — são DUAS perguntas, e o `continue` do TD-023 respondia as duas com
 * a mesma resposta. "Já apliquei este evento?" se decide UMA vez por chamada,
 * contra o doc que CHEGOU; "esta chamada trouxe duas entradas para a mesma SKU?"
 * é outra coisa, e a resposta é SOMAR — não descartar. Medido: 2 entries da
 * mesma SKU (2 un a R$ 30) davam saldo 2 numa camada e valor R$ 60, quando a
 * submissão custou R$ 120; a segunda sumia com a fatia de custo dela, calada.
 * Hoje o caminho era alcançável pelo `[CSV-32]` (dois subitens colidindo na
 * mesma `skuKey`); fechado ele, isto vira latente — mas `continue` que descarta
 * dado sem contar não é garantia, é armadilha, igual à que o próprio TD-023
 * levantou. Somar preserva o total: `qty` acumula e o `unitCost` vira a MÉDIA
 * PONDERADA, de modo que `qty × unitCost` continua sendo o custo submetido.
 */
export function addProductionLayers(
  good: FinishedGood | null,
  productId: string,
  productName: string,
  entries: FinishedEntry[],
  eventId: string,
  at: number,
): FinishedGoodPayload {
  // Clona as SKUs e seus arrays de camadas para não mutar o doc recebido.
  const skus: FinishedSku[] = good
    ? good.skus.map((sku) => ({ ...sku, layers: [...sku.layers] }))
    : [];
  const byKey = new Map(skus.map((sku) => [keyOfSku(sku), sku]));

  // TD-027: a idempotência por evento se decide AQUI, contra o doc que chegou —
  // não dentro do laço, onde as camadas que esta mesma chamada acabou de criar
  // já contaminam a resposta. SKU que já carrega camada deste evento é replay:
  // ignora-se a SKU inteira.
  const jaAplicado = new Set(
    skus
      .filter((sku) => sku.layers.some((l) => l.sourceEventId === eventId))
      .map(keyOfSku),
  );
  // As camadas criadas NESTA chamada, por SKU: a segunda entrada da mesma SKU
  // soma nesta camada em vez de virar uma segunda camada com id idêntico (o id
  // é evento+SKU, e duplicá-lo quebraria `removeEventLayers` e `shiftLayers`).
  const novas = new Map<string, FinishedLayer>();
  // Acumuladores da média ponderada, também por SKU. O breakdown só sobrevive à
  // fusão se TODAS as entradas o trouxerem — meia composição mentiria sobre o
  // `unitCost` que ela deveria somar.
  const somas = new Map<
    string,
    { valor: number; breakdown: FrozenCostBreakdown | null }
  >();

  for (const entry of entries) {
    const qty = num(entry.qty);
    if (qty <= 0) continue;
    const color = entry.color ?? NO_COLOR;
    const layer: FinishedLayer = {
      id: layerId(eventId, entry.subitemId, color.key),
      at: num(at),
      qty,
      unitCost: num(entry.unitCost),
      ...(entry.unitBreakdown ? { costBreakdown: entry.unitBreakdown } : {}),
      sourceEventId: eventId,
    };
    const key = skuKey(entry.subitemId, color.key);
    // TD-023: o comentário lá em cima promete idempotência por evento, e até o
    // TD-023 o código só fazia `push` — sem olhar o id. Medido: mesmo `eventId`
    // aplicado 2× produzia DUAS camadas com o id idêntico e o saldo dobrava
    // (4 → 8). Hoje é inalcançável pela UI (quem chama monta o doc inteiro e
    // grava com `batch.set`, que sobrescreve), mas um comentário que afirma
    // garantia inexistente é armadilha para quem confiar nela depois. Agora a
    // garantia é do CÓDIGO: reaplicar o mesmo evento na mesma SKU não soma.
    if (jaAplicado.has(key)) continue;

    // TD-027: a mesma SKU pela 2ª vez NESTA chamada não é replay — é dado novo.
    // Funde na camada já criada: `qty` soma e o `unitCost` vira a média
    // ponderada, para o valor total (qty × unitCost) seguir sendo o que se
    // submeteu.
    const criada = novas.get(key);
    if (criada) {
      const acumulado = somas.get(key)!;
      acumulado.valor += qty * num(entry.unitCost);
      acumulado.breakdown =
        acumulado.breakdown && entry.unitBreakdown
          ? addFrozen(acumulado.breakdown, scaleFrozen(entry.unitBreakdown, qty))
          : null;
      criada.qty = num(criada.qty) + qty;
      criada.unitCost = criada.qty !== 0 ? acumulado.valor / criada.qty : 0;
      if (acumulado.breakdown && criada.qty !== 0) {
        criada.costBreakdown = scaleFrozen(acumulado.breakdown, 1 / criada.qty);
      } else {
        delete criada.costBreakdown;
      }
      const alvo = byKey.get(key);
      if (alvo) {
        if (entry.name) alvo.name = entry.name;
        if (color.label) alvo.colorLabel = color.label;
      }
      continue;
    }
    novas.set(key, layer);
    somas.set(key, {
      valor: qty * num(entry.unitCost),
      breakdown: entry.unitBreakdown
        ? scaleFrozen(entry.unitBreakdown, qty)
        : null,
    });

    const existing = byKey.get(key);
    if (existing) {
      existing.layers.push(layer);
      if (entry.name) existing.name = entry.name;
      // O rótulo acompanha a cor viva: renomear "Azul" para "Azul Bebê" no
      // Estoque reflete aqui na próxima produção, sem partir o saldo (a chave é
      // o `filamentId`).
      if (color.label) existing.colorLabel = color.label;
    } else {
      const sku: FinishedSku = {
        ...(entry.subitemId ? { subitemId: entry.subitemId } : {}),
        colorKey: color.key,
        colorLabel: color.label,
        name: entry.name,
        layers: [layer],
      };
      byKey.set(key, sku);
      skus.push(sku);
    }
  }

  return {
    productId,
    productName,
    skus,
    createdAt: good ? good.createdAt : num(at),
    // TD-026: a versão do doc lido atravessa (ver `finishedGoodToPayload`).
    // `undefined` quando o doc ainda não existe — e aí "versão 0" é a verdade.
    rev: good?.rev,
  };
}

/**
 * Estorno de um evento (excluir a produção, 05b): remove as camadas que aquele
 * evento criou, em todas as SKUs. Round-trip de `addProductionLayers`. SKUs que
 * ficam sem camada são MANTIDAS (o nome/histórico continua; somem da tela por
 * saldo 0) — o doc não precisa encolher, e assim o custo já vendido não some do
 * rastro se o passo 8 tiver drenado a camada.
 */
export function removeEventLayers(
  good: FinishedGood,
  eventId: string,
): FinishedGood {
  return {
    ...good,
    skus: good.skus.map((sku) => ({
      ...sku,
      layers: sku.layers.filter((layer) => layer.sourceEventId !== eventId),
    })),
  };
}

/**
 * Consumo FIFO de uma SKU (passo 8) — DESCREVE o que sairia sem alterar o doc,
 * como `simulateConsumption` do filamento. Drena as camadas mais antigas; o COGS
 * é o custo CONGELADO de cada camada (não o preço do dia da venda). D4: o que
 * passar do saldo vira `shortfall` e é lançado na camada mais NOVA (empurrando o
 * saldo dela para negativo), nunca truncado. SKU sem camada nenhuma é o único
 * caso sem onde lançar: aí não há move e o `shortfall` sozinho carrega o recado.
 */
export function consumeFifo(
  good: FinishedGood | null | undefined,
  subitemId: string | undefined,
  colorKey: string,
  qty: number,
): FinishedConsumptionResult {
  const want = num(qty);
  const sku = findSku(good, subitemId, colorKey);
  if (want <= 0 || !good || !sku) {
    return {
      moves: [],
      cost: 0,
      shortfall: want > 0 ? want : 0,
      breakdown: ZERO_FROZEN,
      costUnknown: 0,
    };
  }

  const make = (layer: FinishedLayer, take: number): FinishedMove => ({
    productId: good.productId,
    ...(subitemId ? { subitemId } : {}),
    layerId: layer.id,
    qty: take,
    unitCost: num(layer.unitCost),
    cost: take * num(layer.unitCost),
  });

  const moves: FinishedMove[] = [];
  let remaining = want;
  const ordered = fifoLayers(sku);

  for (const layer of ordered) {
    if (remaining <= 0) break;
    const available = num(layer.qty);
    // Camada zerada (ou já negativa) não entra no FIFO: não há o que tirar dela.
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    moves.push(make(layer, take));
    remaining -= take;
  }

  const shortfall = remaining > 0 ? remaining : 0;
  if (shortfall > 0 && ordered.length > 0) {
    const target = ordered[ordered.length - 1];
    const existing = moves.find((move) => move.layerId === target.id);
    if (existing) {
      // A camada mais nova já entrou no FIFO: engrossa o mesmo move em vez de
      // criar um segundo para a mesma camada (o estorno soma por camada).
      existing.qty += shortfall;
      existing.cost = existing.qty * existing.unitCost;
    } else {
      moves.push(make(target, shortfall));
    }
  }

  // FEAT-06 — a composição do COGS, derivada dos moves JÁ FECHADOS. Não dá para
  // acumular dentro do laço acima: o overdraft (D4) engrossa o move da camada
  // mais nova DEPOIS dele, e a fatia excedente ficaria de fora, deixando os
  // componentes menores que o `cost`. Camada sem composição (anterior ao
  // FEAT-06) não vira zero — vai para `costUnknown`, e a UI diz "não detalhado".
  const byId = new Map(ordered.map((layer) => [layer.id, layer]));
  let breakdown = ZERO_FROZEN;
  let costUnknown = 0;
  for (const move of moves) {
    const layer = byId.get(move.layerId);
    if (layer?.costBreakdown) {
      breakdown = addFrozen(breakdown, scaleFrozen(layer.costBreakdown, move.qty));
    } else {
      costUnknown += move.cost;
    }
  }

  return {
    moves,
    cost: moves.reduce((sum, move) => sum + move.cost, 0),
    shortfall,
    breakdown,
    costUnknown,
  };
}

// Uma peça do conjunto a drenar, JÁ com a cor escolhida (FEAT-11). `subitemId`
// ausente = a SKU do inteiro (produto sem partes).
export type WholePart = {
  subitemId?: string;
  colorKey: string;
};

/**
 * Consumo do INTEIRO de um produto que vende por PARTES (BUG-05). O acabado desse
 * produto guarda uma SKU por subitem (a produção do inteiro credita as partes; não
 * existe uma SKU `__whole__`), então vender `qty` conjuntos drena `qty` de CADA
 * parte — uma montagem. Agrega os `FinishedMove` de todas as partes num resultado
 * só (é o mesmo `FinishedConsumptionResult` da venda de uma peça): custo e
 * composição somam as partes; o `shortfall` é o MAIOR entre as partes (quantos
 * conjuntos passaram da parte mais escassa = qty − inteiros montáveis).
 *
 * FEAT-11: cada parte traz a SUA cor — um conjunto é corpo azul + tampa vermelha
 * quando é assim que ele é. Uma lista de uma parte sem `subitemId` é o produto sem
 * subitens (drena a SKU do inteiro); lista vazia não tem o que drenar.
 */
export function consumeWholeFifo(
  good: FinishedGood | null | undefined,
  parts: WholePart[],
  qty: number,
): FinishedConsumptionResult {
  if (parts.length === 0) {
    const want = num(qty);
    return {
      moves: [],
      cost: 0,
      shortfall: want > 0 ? want : 0,
      breakdown: ZERO_FROZEN,
      costUnknown: 0,
    };
  }
  const moves: FinishedMove[] = [];
  let cost = 0;
  let breakdown = ZERO_FROZEN;
  let costUnknown = 0;
  let shortfall = 0;
  for (const part of parts) {
    const res = consumeFifo(good, part.subitemId, part.colorKey, qty);
    moves.push(...res.moves);
    cost += res.cost;
    breakdown = addFrozen(breakdown, res.breakdown);
    costUnknown += res.costUnknown;
    shortfall = Math.max(shortfall, res.shortfall);
  }
  return { moves, cost, shortfall, breakdown, costUnknown };
}

// O mínimo para mexer no saldo de uma camada — satisfeito pelo `FinishedMove` que
// `consumeFifo` descreve e que a venda grava. É o que deixa o estorno ler o doc da
// venda e devolver por camada, sem depender do custo (molde do `RollDelta`).
type LayerDelta = Pick<FinishedMove, "productId" | "layerId" | "qty">;

// ⚠ TD-023 — isto é DELTA, e de propósito NÃO é idempotente: aplicar duas vezes
// move o saldo duas vezes. É o oposto do `addProductionLayers`, e a assimetria
// não é descuido — lá a `layerId` identifica O EVENTO (reaplicar é repetição),
// aqui ela só aponta DE ONDE tirar. Dois recibos diferentes drenando a mesma
// camada são dois movimentos legítimos, e deduplicar por `layerId` engoliria o
// segundo — estornar um recibo devolveria material do outro junto.
function shiftLayers(
  good: FinishedGood,
  moves: LayerDelta[],
  sign: 1 | -1,
): FinishedGood {
  const deltaByLayer = new Map<string, number>();
  for (const move of moves) {
    // Moves de outros produtos passam batido: um recibo drena vários acabados e
    // cada doc só aplica o que é seu (espelha o `shiftRolls` do filamento).
    if (move.productId !== good.productId) continue;
    const previous = deltaByLayer.get(move.layerId) ?? 0;
    deltaByLayer.set(move.layerId, previous + sign * num(move.qty));
  }
  if (deltaByLayer.size === 0) return good;

  return {
    ...good,
    skus: good.skus.map((sku) => ({
      ...sku,
      layers: sku.layers.map((layer) => {
        const delta = deltaByLayer.get(layer.id);
        if (!delta) return layer;
        return { ...layer, qty: num(layer.qty) + delta };
      }),
    })),
  };
}

/**
 * Aplica a baixa do acabado descrita pelos `FinishedMove` (venda registrada):
 * subtrai a `qty` consumida da camada apontada. PURA (doc novo). Espelha
 * `applyConsumption` do filamento; D4 = a camada pode ficar negativa (nunca
 * trunca — o `consumeFifo` já lançou o excedente na camada mais nova).
 */
export function applyFinishedConsumption(
  good: FinishedGood,
  moves: FinishedMove[],
): FinishedGood {
  return shiftLayers(good, moves, -1);
}

/**
 * Devolve ao acabado exatamente o que a venda drenou (recibo editado/excluído),
 * camada a camada — inclusive camada já zerada. Round-trip de
 * `applyFinishedConsumption`: é o que impede editar um recibo de 3 → 2 unidades
 * corromper o estoque de produtos em silêncio (molde do `reverseConsumption`).
 */
export function reverseFinishedConsumption(
  good: FinishedGood,
  moves: FinishedMove[],
): FinishedGood {
  return shiftLayers(good, moves, 1);
}

/**
 * "Inteiros disponíveis = min das partes" (apresentação híbrida, 05c). Para um
 * produto que vende por subitens, o inteiro montável é o MENOR saldo entre TODOS
 * os subitens do produto (subitem nunca produzido conta como 0). `subitemIds` é a
 * lista VIVA do produto — não dá para inferir do doc, que só guarda as SKUs já
 * tocadas pela produção (senão uma parte nunca impressa seria ignorada e o inteiro
 * apareceria inflado). Sem subitens (`subitemIds` vazio) → saldo do inteiro.
 *
 * ⚠ FEAT-11: a montagem IGNORA a cor de propósito (`partBalance` soma as cores).
 * Um conjunto é corpo azul + tampa vermelha quando é assim que ele é — exigir a
 * mesma cor em todas as partes zeraria justamente o produto multicor de projeto.
 * A cor entra na hora de escolher DE ONDE tirar cada parte (`consumeWholeFifo`).
 */
export function assemblableWholes(
  good: FinishedGood | null | undefined,
  subitemIds: string[],
): number {
  if (subitemIds.length === 0) return partBalance(good, undefined);
  return Math.min(...subitemIds.map((id) => partBalance(good, id)));
}

// Valor congelado de uma SKU: Σ (qty × custo congelado) das camadas. Pode ser
// NEGATIVO se o saldo estiver negativo (D4) — reflete o buraco, não o zera.
export function skuValue(sku: FinishedSku): number {
  return sku.layers.reduce(
    (sum, layer) => sum + num(layer.qty) * num(layer.unitCost),
    0,
  );
}

// Valor congelado de todo o acabado de um produto (Σ das SKUs). É o COGS parado
// na loja — quanto custou produzir o que ainda não vendeu.
export function goodValue(good: FinishedGood | null | undefined): number {
  if (!good) return 0;
  return good.skus.reduce((sum, sku) => sum + skuValue(sku), 0);
}

// FEAT-06 — o `goodValue` DECOMPOSTO: de que é feito o COGS parado na loja
// (quanto é material, quanto é mão de obra, quanto é ímã…). `unknown` é a parcela
// vinda de camadas anteriores ao FEAT-06, que só têm o total; separá-la é o que
// impede a tela de mentir — sem isso o valor sem composição sumiria dos
// componentes e a soma não fecharia com o total.
// Invariante: `sumFrozen(breakdown) + unknown === total`.
export type GoodCostComposition = {
  breakdown: FrozenCostBreakdown;
  total: number;
  unknown: number;
};

export function skuCostComposition(sku: FinishedSku): GoodCostComposition {
  let breakdown = ZERO_FROZEN;
  let unknown = 0;
  for (const layer of sku.layers) {
    const qty = num(layer.qty);
    if (layer.costBreakdown) {
      breakdown = addFrozen(breakdown, scaleFrozen(layer.costBreakdown, qty));
    } else {
      unknown += qty * num(layer.unitCost);
    }
  }
  return { breakdown, total: sumFrozen(breakdown) + unknown, unknown };
}

export function goodCostComposition(
  good: FinishedGood | null | undefined,
): GoodCostComposition {
  if (!good) return { breakdown: ZERO_FROZEN, total: 0, unknown: 0 };
  return good.skus.reduce<GoodCostComposition>(
    (acc, sku) => {
      const comp = skuCostComposition(sku);
      return {
        breakdown: addFrozen(acc.breakdown, comp.breakdown),
        total: acc.total + comp.total,
        unknown: acc.unknown + comp.unknown,
      };
    },
    { breakdown: ZERO_FROZEN, total: 0, unknown: 0 },
  );
}

export type AssemblyPart = {
  subitemId: string;
  name: string;
  balance: number; // todas as cores somadas
  leftover: number; // saldo além dos conjuntos completos (peças avulsas)
  // FEAT-11: de que cores é esse saldo ("2 Azul, 1 Preto"). A tela mostra a
  // decomposição sem precisar re-perguntar ao doc.
  colors: ColorBalance[];
};

export type AssemblyBreakdown = {
  wholes: number; // inteiros montáveis = min das partes
  parts: AssemblyPart[];
  hasGap: boolean; // alguma parte sobra (conjunto incompleto — a lacuna)
};

/**
 * Decompõe o acabado de um produto COM subitens na apresentação "conjunto +
 * lacuna" (05c): `wholes` = quantos conjuntos completos dá para montar (min das
 * partes); cada parte com saldo ACIMA desse min tem `leftover` peças avulsas — a
 * lacuna ("conjunto sem X", = as outras partes que faltam para fechar o conjunto).
 * `subitems` é a lista VIVA do produto (o doc só guarda as SKUs já produzidas;
 * uma parte nunca impressa conta como 0 e puxa o `wholes` para baixo).
 */
export function assemblyBreakdown(
  good: FinishedGood | null | undefined,
  subitems: { id: string; name: string }[],
): AssemblyBreakdown {
  const wholes = assemblableWholes(
    good,
    subitems.map((s) => s.id),
  );
  const parts: AssemblyPart[] = subitems.map((s) => {
    const balance = partBalance(good, s.id);
    return {
      subitemId: s.id,
      name: s.name,
      balance,
      leftover: balance - wholes,
      colors: colorsWithBalance(good, s.id),
    };
  });
  return { wholes, parts, hasGap: parts.some((p) => p.leftover > 0) };
}
