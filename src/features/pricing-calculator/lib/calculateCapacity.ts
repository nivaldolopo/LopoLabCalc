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
  const machines = Math.max(1, Number(settings.machines) || 1);

  if (totalPrintHours <= 0 || hoursDay <= 0 || daysMonth <= 0) return null;

  // TD-003 — capacidade pelo GARGALO, não pela soma. Máquinas diferentes rodam
  // em PARALELO (a A1 imprime uma etapa enquanto a X2D imprime outra), então
  // quem dita o ritmo é a máquina mais ocupada, não o total somado. As horas por
  // máquina vêm do `machineUsage` (que é POR PEÇA em calculatePricing → multiplico
  // de volta por `pieces` para voltar ao tempo por IMPRESSÃO/ciclo). Produto de
  // uma máquina só: max === soma === totalPrintHours → número idêntico ao antigo.
  // TD-010 — o horizonte mensal usa `daysMonth` (o MESMO do rateio do custo
  // fixo), não um 30 fixo. O mês tinha 26 dias de um lado e 30 do outro: o
  // fixo/h saía ~13% maior que a capacidade que o justificava.
  const horizon = hoursDay * daysMonth;
  const perMachine = result.machineUsage.map((usage) => ({
    machineId: usage.machineId,
    machineName: usage.machineName,
    cycleHours: usage.hours * result.pieces,
  }));
  const bottleneckHours =
    perMachine.length > 0
      ? Math.max(...perMachine.map((m) => m.cycleHours))
      : totalPrintHours;

  // Cada máquina imprime continuamente ao longo do mês; um job pode atravessar
  // vários dias. Por isso contamos os ciclos sobre o horizonte mensal — assim
  // uma mesa que leva mais que "horas/dia" não zera (ela só rende <1 peça/dia).
  const cyclesMonth = Math.floor(horizon / bottleneckHours) * machines;
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

  // Repartição por máquina: quantas peças/mês CADA impressora renderia se fosse
  // o único limite. A do gargalo bate com `piecesMonth`; as outras têm folga.
  const machineBreakdown = perMachine
    .map((m) => ({
      machineId: m.machineId,
      machineName: m.machineName,
      cycleHours: m.cycleHours,
      piecesMonth:
        m.cycleHours > 0
          ? Math.floor(
              Math.floor(horizon / m.cycleHours) *
                machines *
                result.pieces *
                yieldFactor,
            )
          : 0,
      isBottleneck: m.cycleHours === bottleneckHours,
    }))
    .sort((a, b) => b.cycleHours - a.cycleHours);

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
    machineBreakdown,
  };
}
