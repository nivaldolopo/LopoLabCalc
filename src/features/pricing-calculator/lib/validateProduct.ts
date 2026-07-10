import type { ProductInput } from "../types";

export function validateProduct(product: ProductInput): string | null {
  const checks: Array<[number, string]> = [
    [product.weightG, "Peso da peça"],
    [product.printHours, "Tempo de impressão"],
    [product.filamentPricePerKg, "Preço do filamento"],
    [product.energyTariff, "Tarifa de energia"],
    [product.laborMinutes, "Mão de obra (min)"],
    [product.laborRate, "Valor-hora"],
  ];

  for (const [value, label] of checks) {
    if (value < 0) return `"${label}" não pode ser negativo.`;
  }

  if (product.weightG === 0 && product.printHours === 0) {
    return "Informe pelo menos o peso ou o tempo de impressão.";
  }

  if (product.markup < 1) return "O markup deve ser no mínimo 1x.";

  for (let index = 0; index < (product.stages ?? []).length; index += 1) {
    const stage = product.stages[index];
    if (
      stage.weightG < 0 ||
      stage.printHours < 0 ||
      stage.filamentPricePerKg < 0 ||
      stage.laborMinutes < 0
    ) {
      return `A etapa ${index + 2} contém valores negativos.`;
    }
  }

  return null;
}
