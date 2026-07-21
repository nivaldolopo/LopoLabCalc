import type { DocumentData } from "firebase/firestore";
import { num } from "@/lib/number";
import type { FrozenCostBreakdown } from "@/features/pricing-calculator/types";

// FEAT-06 — serialização da composição do custo congelado. Mora fora dos dois
// repositórios porque exatamente o mesmo objeto é gravado em três coleções:
// `producao` (por evento), `acabados` (por camada) e `vendas` (por item).
//
// A leitura devolve `undefined` — não um objeto zerado — quando o campo não
// existe. É o único fallback permitido pela Diretriz 7: documento anterior ao
// FEAT-06 simplesmente não tem a composição, e um `{material: 0, …}` sintético
// mentiria na tela ("Material R$ 0,00") em vez de dizer "não detalhado".

export function frozenToDocument(breakdown: FrozenCostBreakdown): DocumentData {
  return {
    material: num(breakdown.material),
    energy: num(breakdown.energy),
    depreciation: num(breakdown.depreciation),
    maintenance: num(breakdown.maintenance),
    labor: num(breakdown.labor),
    supplies: num(breakdown.supplies),
  };
}

export function frozenFromDocument(
  data: unknown,
): FrozenCostBreakdown | undefined {
  if (!data || typeof data !== "object") return undefined;
  const raw = data as DocumentData;
  return {
    material: num(raw.material),
    energy: num(raw.energy),
    depreciation: num(raw.depreciation),
    maintenance: num(raw.maintenance),
    labor: num(raw.labor),
    supplies: num(raw.supplies),
  };
}
