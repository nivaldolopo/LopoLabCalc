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
    if (value < 0) return `⚠️ "${label}" não pode ser negativo.`;
  }

  if (product.weightG === 0 && product.printHours === 0) {
    return "⚠️ Informe pelo menos o peso ou o tempo de impressão.";
  }

  if (product.markup < 1) return "⚠️ O markup deve ser no mínimo 1x.";

  // Etapas extras: nenhum campo pode ser negativo. Antes energia e valor-hora
  // (opcionais) escapavam da checagem.
  const stages = product.stages ?? [];
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    if (
      stage.weightG < 0 ||
      stage.printHours < 0 ||
      stage.filamentPricePerKg < 0 ||
      stage.laborMinutes < 0 ||
      (stage.energyTariff ?? 0) < 0 ||
      (stage.laborRate ?? 0) < 0
    ) {
      return `⚠️ A etapa ${index + 2} contém valores negativos.`;
    }
  }

  // Acessórios: quantidade e preço unitário não podem ser negativos. A UI já
  // trava a digitação, mas um CSV importado ou produto legado pode furar isso.
  const accessories = product.accessories ?? [];
  for (let index = 0; index < accessories.length; index += 1) {
    const accessory = accessories[index];
    if (accessory.qty < 0 || accessory.unitPrice < 0) {
      const label = accessory.desc?.trim() || `Acessório ${index + 1}`;
      return `⚠️ "${label}" tem quantidade ou preço negativo.`;
    }
  }

  return null;
}
