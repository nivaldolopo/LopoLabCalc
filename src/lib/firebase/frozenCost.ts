import type { DocumentData } from "firebase/firestore";
import { num } from "@/lib/number";
import type {
  FrozenCostBreakdown,
  MachineUsage,
} from "@/features/pricing-calculator/types";

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

// ---------------------------------------------------------------------------
// [FROTA] Fase 1 — serialização da REPARTIÇÃO por máquina. Mora aqui pelo mesmo
// motivo do bloco acima: é o mesmo objeto gravado em duas coleções (`acabados`,
// por camada, e `vendas`, por item), e ele viaja pelo mesmo caminho do custo
// congelado — do evento à camada, da camada à venda.
//
// A leitura DESCARTA a entrada sem `machineId` em vez de coagi-la (AUD-16 [E5]:
// `String(item)` fabricava chave que não existe). Lista vazia é resposta
// legítima: quer dizer "sem lastro", e é assim que o ROI a lê.
// ---------------------------------------------------------------------------

export function machineUsageToDocument(usage: MachineUsage[]): DocumentData[] {
  return usage.map((u) => ({
    machineId: u.machineId,
    machineName: u.machineName ?? "",
    hours: num(u.hours),
    depreciation: num(u.depreciation),
  }));
}

export function machineUsageFromDocument(data: unknown): MachineUsage[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter(
      (item): item is DocumentData =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as DocumentData).machineId === "string" &&
        (item as DocumentData).machineId !== "",
    )
    .map((item) => ({
      machineId: String(item.machineId),
      machineName: typeof item.machineName === "string" ? item.machineName : "",
      hours: num(item.hours),
      depreciation: num(item.depreciation),
    }));
}
