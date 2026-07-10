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

  const cyclesDay = Math.floor(hoursDay / totalPrintHours) * machines;
  const piecesDay = cyclesDay * result.pieces;
  const cyclesMonth = cyclesDay * 30;
  const piecesMonth = piecesDay * 30;
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
