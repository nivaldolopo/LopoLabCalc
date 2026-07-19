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
 */
export function submissionEntries(
  productName: string,
  totalFrozenCost: number,
  opts: {
    subitemId?: string;
    subitemName?: string;
    subitems?: { id: string; name: string; cost: number }[];
    units?: number;
  } = {},
): FinishedEntry[] {
  const total = num(totalFrozenCost);
  const units = Math.max(1, Math.round(num(opts.units ?? 1)));

  if (opts.subitemId) {
    return [
      {
        subitemId: opts.subitemId,
        name: opts.subitemName || productName,
        qty: units,
        unitCost: total / units,
      },
    ];
  }

  const subs = opts.subitems ?? [];
  if (subs.length > 0) {
    const sumCost = subs.reduce((sum, s) => sum + num(s.cost), 0);
    return subs.map((s) => {
      const partCost =
        sumCost > 0 ? total * (num(s.cost) / sumCost) : total / subs.length;
      return {
        subitemId: s.id,
        name: s.name,
        qty: units,
        unitCost: partCost / units,
      };
    });
  }

  return [{ name: productName, qty: units, unitCost: total / units }];
}

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

// O mínimo para mexer no saldo de uma camada — satisfeito pelo `FinishedMove` que
// `consumeFifo` descreve e que a venda grava. É o que deixa o estorno ler o doc da
// venda e devolver por camada, sem depender do custo (molde do `RollDelta`).
type LayerDelta = Pick<FinishedMove, "productId" | "layerId" | "qty">;

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
 */
export function assemblableWholes(
  good: FinishedGood | null | undefined,
  subitemIds: string[],
): number {
  if (subitemIds.length === 0) return balanceOf(good, undefined);
  return Math.min(...subitemIds.map((id) => balanceOf(good, id)));
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

export type AssemblyPart = {
  subitemId: string;
  name: string;
  balance: number;
  leftover: number; // saldo além dos conjuntos completos (peças avulsas)
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
    const balance = balanceOf(good, s.id);
    return { subitemId: s.id, name: s.name, balance, leftover: balance - wholes };
  });
  return { wholes, parts, hasGap: parts.some((p) => p.leftover > 0) };
}
