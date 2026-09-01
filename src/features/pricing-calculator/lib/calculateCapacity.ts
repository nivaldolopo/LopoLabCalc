import type {
  CapacityResult,
  CapacitySettings,
  PricingResult,
  ProductInput,
} from "../types";
import { failureFractionOf } from "./calculatePricing";

export function calculateCapacity(
  result: PricingResult,
  product: ProductInput,
  settings: CapacitySettings,
): CapacityResult | null {
  const extraHours = (product.stages ?? []).reduce(
    (sum, stage) => sum + (stage.printHours || 0),
    0,
  );
  const totalPrintHours = product.printHours + extraHours;
  const hoursDay = Number(settings.hoursDay) || 0;
  const daysMonth = Number(settings.daysMonth) || 0;
  // DEC-06 (dono, 2026-08-16) — `machines` = N conjuntos completos rodando em
  // paralelo. A conta fica; o aviso do `CapacityPanel` que a explicava saiu junto
  // com o `machineBreakdown` ([FROTA] Fase 2), porque ele só aparecia quando o
  // produto usava mais de uma máquina — e não há mais como saber isso a partir
  // do preço. Desembaraçar este duplo papel está no BACKLOG.
  const machines = Math.max(1, Number(settings.machines) || 1);

  if (totalPrintHours <= 0 || hoursDay <= 0 || daysMonth <= 0) return null;

  // TD-010 — o horizonte mensal usa `daysMonth` (o MESMO do rateio do custo
  // fixo), não um 30 fixo. O mês tinha 26 dias de um lado e 30 do outro: o
  // fixo/h saía ~13% maior que a capacidade que o justificava.
  const horizon = hoursDay * daysMonth;
  // ⚠ [FROTA] Fase 2 — o ciclo voltou a ser a SOMA das horas. O TD-003 tirava o
  // gargalo do `machineUsage` da precificação (etapas em máquinas diferentes
  // rodam em paralelo, então mandava a mais ocupada). Esse `machineUsage` era a
  // máquina escolhida para PRECIFICAR, e ela deixou de existir: hoje a etapa tem
  // um conjunto elegível, e qualquer uma dele pode rodá-la. Dizer que "a A1 é o
  // gargalo" seria inventar um plano de produção que ninguém declarou — a soma é
  // o pior caso honesto (tudo em série). Creditar o paralelismo somando as
  // elegíveis está registrado no BACKLOG, fora do escopo desta fase.
  const cycleHours = totalPrintHours;

  // Cada máquina imprime continuamente ao longo do mês; um job pode atravessar
  // vários dias. Por isso contamos os ciclos sobre o horizonte mensal — assim
  // uma mesa que leva mais que "horas/dia" não zera (ela só rende <1 peça/dia).
  const cyclesMonth = Math.floor(horizon / cycleHours) * machines;
  // TD-011 — CICLO ≠ PEÇA VENDÁVEL. A taxa de falha já infla o custo (reserva de
  // falha, `calculatePricing`); aqui ela deflaciona o volume, que é o outro lado
  // da mesma moeda — antes a falha subia o preço e deixava a receita projetada
  // intacta. `cyclesMonth` NÃO muda: a máquina roda a impressão que falha do
  // mesmo jeito (é justamente por isso que sobra menos peça boa no mês).
  // Sem dupla contagem: a reserva paga o MATERIAL perdido, este fator conta a
  // MÁQUINA ocupada.
  const failureFraction = failureFractionOf(product.failureRate);
  const yieldFactor = 1 - failureFraction;
  const piecesMonth = Math.floor(cyclesMonth * result.pieces * yieldFactor);
  // Diário é a média (fracionária quando o job dura mais de um dia). Divide pelo
  // mesmo `daysMonth` do horizonte — numerador e denominador escalam juntos, então
  // a média DIÁRIA não muda com os 26 dias; só a mensal cai.
  const cyclesDay = cyclesMonth / daysMonth;
  const piecesDay = piecesMonth / daysMonth;
  const grossPerPiece = result.suggestedPrice;
  const netPerPiece = result.suggestedPrice - result.totalCost;

  return {
    piecesDay,
    cyclesDay,
    grossDay: grossPerPiece * piecesDay,
    netDay: netPerPiece * piecesDay,
    piecesMonth,
    cyclesMonth,
    grossMonth: grossPerPiece * piecesMonth,
    netMonth: netPerPiece * piecesMonth,
    fixedIncluded: result.fixedCost > 0,
    failureRatePct: failureFraction * 100,
  };
}
