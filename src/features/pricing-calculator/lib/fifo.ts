import { num } from "@/lib/number";

// Núcleo do FIFO, compartilhado pelos DOIS estoques (7e): filamento (gramas,
// preço por kg) e insumos (unidades, preço por unidade). Só a ordem de consumo e
// a regra do overdraft moram aqui — a UNIDADE e o CUSTO ficam com quem chama,
// que é onde eles fazem sentido (gramas viram kg na conta do filamento, unidades
// multiplicam direto no insumo).
//
// Existe para a regra do D4 ter UMA implementação: duas cópias divergiriam no
// primeiro ajuste, e aí aviso e baixa passariam a discordar — exatamente o que
// `lib/stock.ts` foi escrito para impedir.

// Um lote genérico, já projetado: o que o FIFO precisa saber e nada mais.
export type FifoLot = {
  id: string;
  remaining: number;
  unitPrice: number;
};

// Quanto sai de UM lote, e a que preço. Quem chama converte para o seu move
// (`ConsumptionMove` no filamento, `SupplyConsumptionMove` no insumo) e calcula
// o custo na unidade dele.
export type FifoMove = {
  lotId: string;
  qty: number;
  unitPrice: number;
};

export type FifoResult = {
  moves: FifoMove[];
  // Passou do lote em uso e atravessou para o próximo (D5 informativo).
  crossesLot: boolean;
  // Passou do saldo TOTAL (D5 forte / o negativo do D4).
  shortfall: number;
};

/**
 * Ordena em FIFO: compra mais antiga primeiro. Empate de data resolvido pela
 * ordem de inserção no array, para o consumo ser determinístico (dois lotes
 * comprados no mesmo dia não podem trocar de lugar entre uma simulação e a
 * baixa).
 */
export function fifoSort<T>(items: T[], dateOf: (item: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => num(dateOf(a.item)) - num(dateOf(b.item)) || a.index - b.index)
    .map((entry) => entry.item);
}

/**
 * Simula consumir `want` dos lotes, FIFO. PURA: descreve o que aconteceria sem
 * mudar nada. `lots` precisa vir JÁ ORDENADO (use `fifoSort`) — o mais novo é o
 * último, e é ele que recebe o overdraft.
 *
 * D4 — saldo negativo é PERMITIDO: o que faltar NÃO é truncado nem "deduzido até
 * zero" (isso esconderia o tamanho do furo). O excedente vira consumo no lote
 * mais novo, empurrando o saldo dele para negativo, e sai reportado em
 * `shortfall`. Sem lote nenhum é o único caso sem onde lançar: aí não há move e
 * o `shortfall` sozinho carrega o recado.
 */
export function simulateFifo(lots: FifoLot[], want: number): FifoResult {
  const wanted = num(want);
  if (wanted <= 0) return { moves: [], crossesLot: false, shortfall: 0 };

  const moves: FifoMove[] = [];
  let remaining = wanted;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const available = num(lot.remaining);
    // Lote zerado (ou já negativo) não entra no FIFO: não há o que tirar dele.
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    moves.push({ lotId: lot.id, qty: take, unitPrice: num(lot.unitPrice) });
    remaining -= take;
  }

  const shortfall = remaining > 0 ? remaining : 0;
  if (shortfall > 0 && lots.length > 0) {
    const target = lots[lots.length - 1];
    const existing = moves.find((move) => move.lotId === target.id);
    if (existing) {
      // O lote mais novo já tinha entrado no FIFO: engrossa o mesmo move em vez
      // de criar um segundo para o mesmo lote (o estorno soma por lote, mas dois
      // moves iguais confundiriam a leitura do custo misto).
      existing.qty += shortfall;
    } else {
      moves.push({
        lotId: target.id,
        qty: shortfall,
        unitPrice: num(target.unitPrice),
      });
    }
  }

  return { moves, crossesLot: moves.length > 1, shortfall };
}

/**
 * Aplica deltas por lote (baixa com `sign: -1`, estorno com `sign: 1`). Genérico
 * sobre o nome do campo de saldo, que difere entre os dois estoques
 * (`remainingG` × `remainingQty`): quem chama diz como ler e como escrever.
 *
 * Lote que não aparece nos deltas volta IDÊNTICO (mesma referência), e o array
 * inteiro é preservado quando não há delta nenhum — imutável, como o resto.
 */
export function shiftLots<T extends { id: string }>(
  lots: T[],
  deltaByLot: Map<string, number>,
  remainingOf: (lot: T) => number,
  withRemaining: (lot: T, remaining: number) => T,
): T[] {
  if (deltaByLot.size === 0) return lots;
  return lots.map((lot) => {
    const delta = deltaByLot.get(lot.id);
    if (!delta) return lot;
    return withRemaining(lot, num(remainingOf(lot)) + delta);
  });
}
