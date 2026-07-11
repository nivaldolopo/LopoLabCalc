import type {
  CapacityResult,
  CapacitySettings,
  PricingResult,
  ProductInput,
} from "../types";

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
  const machines = Math.max(1, Number(settings.machines) || 1);

  if (totalPrintHours <= 0 || hoursDay <= 0) return null;

  // Cada máquina imprime continuamente ao longo do mês; um job pode atravessar
  // vários dias. Por isso contamos os ciclos sobre o horizonte mensal — assim
  // uma mesa que leva mais que "horas/dia" não zera (ela só rende <1 peça/dia).
  const cyclesMonth = Math.floor((hoursDay * 30) / totalPrintHours) * machines;
  const piecesMonth = cyclesMonth * result.pieces;
  // Diário é a média (fracionária quando o job dura mais de um dia).
  const cyclesDay = cyclesMonth / 30;
  const piecesDay = piecesMonth / 30;
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
  };
}
