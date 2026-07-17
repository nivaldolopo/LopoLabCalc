import type { FilamentUsage, ProductInput } from "../types";
import { normalizeFilaments } from "./filaments";
import { num } from "@/lib/number";

// Nenhum peso/preço de cor pode ser negativo. `context` posiciona o erro (ex.:
// " da etapa 2"). A UI já trava a digitação, mas CSV/produto legado pode furar.
function filamentError(
  filaments: FilamentUsage[],
  context: string,
): string | null {
  for (const f of filaments) {
    if (num(f.pricePerKg) < 0) {
      return `⚠️ Preço do filamento${context} não pode ser negativo.`;
    }
    if (
      num(f.totalG) < 0 ||
      num(f.modelG) < 0 ||
      num(f.supportG) < 0 ||
      num(f.purgedG) < 0 ||
      num(f.towerG) < 0
    ) {
      return `⚠️ Peso do filamento${context} não pode ser negativo.`;
    }
  }
  return null;
}

export function validateProduct(product: ProductInput): string | null {
  const checks: Array<[number, string]> = [
    [product.printHours, "Tempo de impressão"],
    [product.energyTariff, "Tarifa de energia"],
    [product.laborMinutes, "Mão de obra (min)"],
    [product.laborRate, "Valor-hora"],
  ];

  for (const [value, label] of checks) {
    if (num(value) < 0) return `⚠️ "${label}" não pode ser negativo.`;
  }

  // Cores da etapa principal (FEAT-02) — migra o escalar legado quando preciso.
  const mainFilaments = normalizeFilaments(product);
  const mainError = filamentError(mainFilaments, "");
  if (mainError) return mainError;

  const mainWeight = mainFilaments.reduce(
    (sum, f) => sum + Math.max(0, num(f.totalG)),
    0,
  );
  if (mainWeight === 0 && num(product.printHours) === 0) {
    return "⚠️ Informe pelo menos o peso ou o tempo de impressão.";
  }

  if (product.markup < 1) return "⚠️ O markup deve ser no mínimo 1x.";

  // Etapas extras: nenhum campo pode ser negativo (tempo/mão de obra/energia/
  // valor-hora e o peso/preço de cada cor).
  const stages = product.stages ?? [];
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    if (
      num(stage.printHours) < 0 ||
      num(stage.laborMinutes) < 0 ||
      num(stage.energyTariff ?? 0) < 0 ||
      num(stage.laborRate ?? 0) < 0
    ) {
      return `⚠️ A etapa ${index + 2} contém valores negativos.`;
    }
    const stageError = filamentError(
      normalizeFilaments(stage),
      ` da etapa ${index + 2}`,
    );
    if (stageError) return stageError;
  }

  // FEAT-01: subitens vendáveis. Só valida quando o modo está ligado. Cada
  // subitem precisa de nome e ao menos uma etapa; o markup override (se houver)
  // respeita o mínimo de 1x, como o do produto.
  if (product.sellBySubitems) {
    const subitems = product.subitems ?? [];
    if (subitems.length === 0) {
      return "⚠️ Adicione ao menos um subitem ou desligue a venda por subitens.";
    }
    for (let index = 0; index < subitems.length; index += 1) {
      const subitem = subitems[index];
      const label = subitem.name?.trim() || `Subitem ${index + 1}`;
      if (!subitem.name?.trim()) {
        return `⚠️ Dê um nome ao ${label}.`;
      }
      if ((subitem.stageKeys ?? []).length === 0) {
        return `⚠️ "${label}" não tem nenhuma etapa. Marque ao menos uma.`;
      }
      if (subitem.markup !== undefined && subitem.markup < 1) {
        return `⚠️ O markup de "${label}" deve ser no mínimo 1x.`;
      }
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
