import { round2 } from "@/lib/number";
import { grossUpForFee } from "./paymentFees";
import { roundPrice } from "./roundPrice";
import type {
  MachineUsage,
  PricingResult,
  RoundingMode,
  SaleCostBreakdown,
  SavedProduct,
} from "../types";

// Dados de origem de UM produto — servem tanto para o formulário ao vivo quanto
// para um produto vindo do catálogo. O modal só lê isto e congela.
export type SaleModalContext = {
  defaultProductName: string;
  productId: string;
  machineId: string;
  machineName: string;
  printHours: number;
  // Repartição de horas/depreciação por máquina (por unidade). Congelada no
  // snapshot para o ROI atribuir corretamente produtos com 2ª etapa em outra
  // impressora.
  machineUsage: MachineUsage[];
  suggestedPrice: number;
  // Critério de arredondamento do produto — reaplicado ao preço inflado quando
  // a taxa é repassada ao cliente, pra não expor centavo quebrado.
  roundingMode: RoundingMode;
  unitCost: number;
  costBreakdown: SaleCostBreakdown;
};

// Monta a foto congelada de UM produto a partir do resultado de precificação.
// Pura (sem estado): serve o item que abre o modal e a lista do catálogo.
export function saleContextFromResult(
  productName: string,
  productId: string,
  result: PricingResult,
  printHours: number,
  roundingMode: RoundingMode,
): SaleModalContext {
  return {
    defaultProductName: productName,
    productId,
    machineId: result.machine.id,
    machineName: result.machine.name,
    printHours,
    machineUsage: result.machineUsage,
    suggestedPrice: result.suggestedPrice,
    roundingMode,
    unitCost: result.totalCost,
    costBreakdown: {
      material: result.materialCost,
      energy: result.energyCost,
      depreciation: result.depreciationCost,
      maintenance: result.maintenanceCost,
      labor: result.laborCost,
      accessories: result.accessoriesCost,
      failureReserve: result.failureReserve,
      fixed: result.fixedCost,
    },
  };
}

// Horas totais de impressão de um produto (etapa principal + etapas extras).
export function productPrintHours(product: SavedProduct): number {
  return (
    product.printHours +
    (product.stages ?? []).reduce(
      (sum, stage) => sum + (stage.printHours || 0),
      0,
    )
  );
}

// Preço cobrado com a taxa repassada: infla (preço/(1−f)) e reaplica o mesmo
// arredondamento do produto, pra o cliente ver um valor redondo (nunca abaixo do
// exato, já que roundPrice arredonda pra cima).
export function chargedWithFee(
  source: SaleModalContext,
  ratePct: number,
): number {
  return round2(
    roundPrice(grossUpForFee(source.suggestedPrice, ratePct), source.roundingMode),
  );
}
