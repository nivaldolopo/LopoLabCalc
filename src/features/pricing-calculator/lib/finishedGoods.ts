import { num } from "@/lib/number";
import type {
  FinishedConsumptionResult,
  FinishedGood,
  FinishedGoodPayload,
  FinishedLayer,
  FinishedMove,
  FinishedSku,
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
  name: string;
  qty: number;
  unitCost: number;
};

// Chave estável da SKU: o subitem, ou a sentinela do inteiro. Duas entradas da
// mesma SKU somam no mesmo saldo.
const WHOLE_KEY = "__whole__";
function skuKey(subitemId?: string): string {
  return subitemId ?? WHOLE_KEY;
}

// Id determinístico da camada: um evento cria no máximo UMA camada por SKU, então
// evento+SKU identifica sem ambiguidade (e o teste não depende de UUID).
function layerId(eventId: string, subitemId?: string): string {
  return `${eventId}__${skuKey(subitemId)}`;
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
  subitemId?: string,
): FinishedSku | undefined {
  if (!good) return undefined;
  const key = skuKey(subitemId);
  return good.skus.find((sku) => skuKey(sku.subitemId) === key);
}

// Saldo de uma SKU do doc (0 quando a SKU nunca foi produzida — não há doc/camada).
export function balanceOf(
  good: FinishedGood | null | undefined,
  subitemId?: string,
): number {
  const sku = findSku(good, subitemId);
  return sku ? skuBalance(sku) : 0;
}

/**
 * Incremento de UMA produção `estoque` no doc do acabado. PURA: devolve o doc
 * novo, não grava. Cria o doc quando `good` é null (1ª produção do produto).
 *
 * Cada entry vira/soma uma camada na sua SKU. A `layerId` é evento+SKU, então um
 * mesmo evento nunca duplica camada na mesma SKU (idempotente por evento).
 * Entries com qty ≤ 0 são ignoradas.
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
  const byKey = new Map(skus.map((sku) => [skuKey(sku.subitemId), sku]));

  for (const entry of entries) {
    const qty = num(entry.qty);
    if (qty <= 0) continue;
    const layer: FinishedLayer = {
      id: layerId(eventId, entry.subitemId),
      at: num(at),
      qty,
      unitCost: num(entry.unitCost),
      sourceEventId: eventId,
    };
    const key = skuKey(entry.subitemId);
    const existing = byKey.get(key);
    if (existing) {
      existing.layers.push(layer);
      if (entry.name) existing.name = entry.name;
    } else {
      const sku: FinishedSku = {
        ...(entry.subitemId ? { subitemId: entry.subitemId } : {}),
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
  qty: number,
): FinishedConsumptionResult {
  const want = num(qty);
  const sku = findSku(good, subitemId);
  if (want <= 0 || !good || !sku) {
    return { moves: [], cost: 0, shortfall: want > 0 ? want : 0 };
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

  return {
    moves,
    cost: moves.reduce((sum, move) => sum + move.cost, 0),
    shortfall,
  };
}

/**
 * "Inteiros disponíveis = min das partes" (apresentação híbrida, 05c). Para um
 * produto que vende por subitens, o inteiro montável é o MENOR saldo entre TODOS
 * os subitens do produto (subitem nunca produzido conta como 0). `subitemIds` é a
 * lista VIVA do produto — não dá para inferir do doc, que só guarda as SKUs já
 * tocadas pela produção (senão uma parte nunca impressa seria ignorada e o inteiro
 * apareceria inflado). Sem subitens (`subitemIds` vazio) → saldo do inteiro.
 */
export function assemblableWholes(
  good: FinishedGood | null | undefined,
  subitemIds: string[],
): number {
  if (subitemIds.length === 0) return balanceOf(good, undefined);
  return Math.min(...subitemIds.map((id) => balanceOf(good, id)));
}
