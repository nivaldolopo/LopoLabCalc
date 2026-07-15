import { num } from "@/lib/number";
import type {
  ConsumptionMove,
  ConsumptionResult,
  FilamentRoll,
  StockAdjustment,
  StockFilament,
  StockMove,
} from "../types";

// Matemática pura do Estoque (item 3, etapa 7a). Modelo híbrido COR + ROLOS
// (D2): o produto aponta para a cor (id estável), os rolos vivem dentro dela e
// são consumidos do mais antigo para o mais novo (FIFO).
//
// O miolo é `simulateConsumption`: uma simulação que DESCREVE o que aconteceria
// sem mudar nada. Ela serve aos três consumidores — o aviso no formulário (7c),
// o custo real da venda e a baixa (8) — justamente por ser a mesma conta nos
// três: aviso e baixa que divergissem seriam pior que não ter aviso.
//
// Todas as funções são imutáveis: devolvem uma cor nova, nunca mexem na
// recebida.

// O mínimo para mexer no saldo de um rolo. Satisfeito tanto por
// `ConsumptionMove` (a simulação) quanto por `StockMove` (o que a venda gravou)
// — é o que permite estornar lendo o doc da venda, sem depender do preço.
export type RollDelta = Pick<StockMove, "stockId" | "rollId" | "qty">;

// Rolos em ordem FIFO: compra mais antiga primeiro. Empate de data resolvido
// pela ordem de inserção no array, para o consumo ser determinístico (dois rolos
// comprados no mesmo dia não podem trocar de lugar entre uma simulação e a
// baixa).
function fifoRolls(color: StockFilament): FilamentRoll[] {
  return color.rolls
    .map((roll, index) => ({ roll, index }))
    .sort(
      (a, b) =>
        num(a.roll.purchaseDate) - num(b.roll.purchaseDate) || a.index - b.index,
    )
    .map((entry) => entry.roll);
}

// Saldo da cor: soma dos rolos. Pode ser NEGATIVO — é o sintoma de contagem
// furada que o D4 existe para deixar visível.
export function balanceG(color: StockFilament): number {
  return color.rolls.reduce((sum, roll) => sum + num(roll.remainingG), 0);
}

// O rolo EM USO: o mais antigo com saldo. É o que a UI mostra junto do dropdown
// ("quanto resta nele") e o primeiro a ser consumido. `null` quando todos estão
// zerados — aí a próxima impressão já nasce em overdraft (D4).
export function activeRoll(color: StockFilament): FilamentRoll | null {
  return fifoRolls(color).find((roll) => num(roll.remainingG) > 0) ?? null;
}

// O rolo mais NOVO por data de compra (independe de ter saldo: mesmo vazio, ele
// é a última cotação real). É o dono do overdraft (D4) e a base do preço de
// catálogo (D3).
export function newestRoll(color: StockFilament): FilamentRoll | null {
  const rolls = fifoRolls(color);
  return rolls.length > 0 ? rolls[rolls.length - 1] : null;
}

// D3, lado CATÁLOGO: preço do rolo mais novo = custo de REPOR. Precificar é
// sobre a próxima impressão, então nunca subprecifica em cima de um rolo velho
// quase vazio. 0 quando a cor não tem rolo nenhum (o chamador cai no fallback do
// `FilamentUsage.pricePerKg`).
export function catalogPricePerKg(color: StockFilament): number {
  return num(newestRoll(color)?.pricePerKg);
}

// Alerta de estoque mínimo. `minG` 0 = sem alerta.
export function isBelowMin(color: StockFilament): boolean {
  return num(color.minG) > 0 && balanceG(color) < num(color.minG);
}

function makeMove(
  color: StockFilament,
  roll: FilamentRoll,
  qty: number,
): ConsumptionMove {
  const pricePerKg = num(roll.pricePerKg);
  return {
    stockId: color.id,
    rollId: roll.id,
    qty,
    pricePerKg,
    cost: (qty / 1000) * pricePerKg,
  };
}

/**
 * Simula consumir `grams` da cor, FIFO. PURA: não altera a cor recebida —
 * descreve o que aconteceria. É a mesma conta usada para avisar (7c), para
 * cobrar (custo real da venda, D3) e para dar baixa (8).
 *
 * Quando a impressão atravessa rolos, o custo é MISTO e exato: cada `move` diz
 * quanto saiu de qual rolo e a que preço.
 *
 * D4 — saldo negativo é PERMITIDO: o que faltar NÃO é truncado nem "deduzido até
 * zero" (isso esconderia o tamanho do furo). O excedente vira consumo no rolo
 * mais novo, empurrando o saldo dele para negativo, e sai reportado em
 * `shortfallG`. Cor sem rolo nenhum é o único caso sem onde lançar: aí não há
 * move e o `shortfallG` sozinho carrega o recado.
 */
export function simulateConsumption(
  color: StockFilament,
  grams: number,
): ConsumptionResult {
  const want = num(grams);
  if (want <= 0) {
    return { moves: [], cost: 0, crossesRoll: false, shortfallG: 0 };
  }

  const moves: ConsumptionMove[] = [];
  let remaining = want;

  for (const roll of fifoRolls(color)) {
    if (remaining <= 0) break;
    const available = num(roll.remainingG);
    // Rolo zerado (ou já negativo) não entra no FIFO: não há o que tirar dele.
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    moves.push(makeMove(color, roll, take));
    remaining -= take;
  }

  const shortfallG = remaining > 0 ? remaining : 0;
  if (shortfallG > 0) {
    const target = newestRoll(color);
    if (target) {
      const existing = moves.find((move) => move.rollId === target.id);
      if (existing) {
        // O rolo mais novo já tinha entrado no FIFO: engrossa o mesmo move em
        // vez de criar um segundo para o mesmo rolo (o estorno soma por rolo,
        // mas dois moves iguais confundiriam a leitura do custo misto).
        existing.qty += shortfallG;
        existing.cost = (existing.qty / 1000) * existing.pricePerKg;
      } else {
        moves.push(makeMove(color, target, shortfallG));
      }
    }
  }

  return {
    moves,
    cost: moves.reduce((sum, move) => sum + move.cost, 0),
    // D5 informativo: passou do rolo em uso e vai atravessar para o próximo.
    crossesRoll: moves.length > 1,
    // D5 forte: passou do estoque TOTAL da cor.
    shortfallG,
  };
}

// D3, lado VENDA: custo REAL do consumo, pelo(s) rolo(s) em uso (FIFO). É o que
// faz a margem da venda divergir da margem do catálogo — divergência
// INTENCIONAL (o dono quer o custo fiel), que a SaleModal precisa mostrar.
export function saleCost(color: StockFilament, grams: number): number {
  return simulateConsumption(color, grams).cost;
}

function shiftRolls(
  color: StockFilament,
  moves: RollDelta[],
  sign: 1 | -1,
): StockFilament {
  const deltaByRoll = new Map<string, number>();
  for (const move of moves) {
    // Moves de outras cores (ou de insumos, na 7e) passam batido: um recibo
    // consome várias cores e cada doc só aplica o que é seu.
    if (move.stockId !== color.id) continue;
    const previous = deltaByRoll.get(move.rollId) ?? 0;
    deltaByRoll.set(move.rollId, previous + sign * num(move.qty));
  }
  if (deltaByRoll.size === 0) return color;

  return {
    ...color,
    rolls: color.rolls.map((roll) => {
      const delta = deltaByRoll.get(roll.id);
      if (!delta) return roll;
      return { ...roll, remainingG: num(roll.remainingG) + delta };
    }),
  };
}

// Aplica a baixa descrita pelos moves (venda registrada).
export function applyConsumption(
  color: StockFilament,
  moves: RollDelta[],
): StockFilament {
  return shiftRolls(color, moves, -1);
}

// Devolve ao estoque exatamente o que os moves tiraram (recibo editado/excluído),
// rolo a rolo — inclusive em rolo já zerado ou arquivado. Round-trip com
// `applyConsumption`: é isto que impede editar um recibo de 3 → 2 unidades
// corromper o estoque em silêncio.
export function reverseConsumption(
  color: StockFilament,
  moves: RollDelta[],
): StockFilament {
  return shiftRolls(color, moves, 1);
}

/**
 * D6 — ajuste de inventário COM RASTRO. Contou o rolo e o saldo real diverge?
 * O caminho é este, nunca editar `remainingG` na mão: um atalho fura o rastro
 * logo no primeiro uso.
 *
 * É também o remédio do D4: quando o saldo está negativo por overdraft, a
 * contagem gera um delta positivo e o `beforeG` negativo fica gravado como prova
 * do tamanho do furo.
 *
 * Vale para rolo arquivado/zerado (achou o spool na gaveta e não estava vazio).
 * Rolo inexistente é ERRO, não no-op: engolir uma contagem em silêncio é
 * exatamente o furo que o D6 quer evitar.
 */
export function adjustRoll(
  color: StockFilament,
  rollId: string,
  countedG: number,
  reason: string,
  at: number,
): StockFilament {
  const roll = color.rolls.find((item) => item.id === rollId);
  if (!roll) {
    throw new Error(
      `Ajuste de inventário: rolo ${rollId} não existe na cor ${color.id}.`,
    );
  }

  const beforeG = num(roll.remainingG);
  const afterG = num(countedG);
  const adjustment: StockAdjustment = {
    id: crypto.randomUUID(),
    at: num(at),
    rollId,
    beforeG,
    afterG,
    reason,
  };

  return {
    ...color,
    rolls: color.rolls.map((item) =>
      item.id === rollId ? { ...item, remainingG: afterG } : item,
    ),
    adjustments: [...color.adjustments, adjustment],
  };
}
