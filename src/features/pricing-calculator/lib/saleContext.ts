import { round2 } from "@/lib/number";
import { grossUpForFee } from "./paymentFees";
import { roundPrice } from "./roundPrice";
import type {
  FilamentUsage,
  PricingResult,
  RoundingMode,
  SaleCostBreakdown,
  SavedProduct,
  SubitemPrice,
} from "../types";

// Dados de origem de UM produto — servem tanto para o formulário ao vivo quanto
// para um produto vindo do catálogo. O modal só lê isto e congela.
export type SaleModalContext = {
  defaultProductName: string;
  productId: string;
  // FEAT-01: quando a unidade vendável é um SUBITEM (parte do produto), guarda o
  // `Subitem.id`. Ausente = produto inteiro. Congelado no snapshot da venda.
  subitemId?: string;
  printHours: number;
  // ⚠ [FROTA] Fase 1 — aqui viviam `machineId`, `machineName` e `machineUsage`.
  // Os três saíram: eles diziam quem foi PRECIFICADO, e a venda precisa de quem
  // IMPRIMIU. Essa resposta só existe na reconciliação (eventos da encomenda ou
  // camadas drenadas do acabado), e é lá que ela passou a nascer.
  //
  // Saíram agora, e não junto da Fase 2, para não ficarem carregados e ignorados
  // entre as duas — campo que ninguém lê é campo que volta a ser lido por engano.
  suggestedPrice: number;
  // Critério de arredondamento do produto — reaplicado ao preço inflado quando
  // a taxa é repassada ao cliente, pra não expor centavo quebrado.
  roundingMode: RoundingMode;
  unitCost: number;
  costBreakdown: SaleCostBreakdown;
  // FEAT-02: consumo por cor (pesos por impressão) para congelar no snapshot da
  // venda. mono vs multicolor = `filaments.length`.
  filaments: FilamentUsage[];
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
    printHours,
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
    filaments: result.filaments,
  };
}

// FEAT-01: foto congelada de UM SUBITEM vendável a partir do seu preço rateado.
// O subitem já carrega custo/preço/filamentos próprios (aditivos), então a venda
// de uma parte congela exatamente o dela — e a baixa do passo 8 deduz só os
// filamentos deste subitem.
export function saleContextFromSubitem(
  baseName: string,
  productId: string,
  subitem: SubitemPrice,
  roundingMode: RoundingMode,
): SaleModalContext {
  const subName = subitem.name?.trim();
  return {
    defaultProductName: subName ? `${baseName} — ${subName}` : baseName,
    productId,
    subitemId: subitem.id,
    printHours: subitem.printHours,
    suggestedPrice: subitem.price,
    roundingMode,
    unitCost: subitem.cost,
    costBreakdown: subitem.costBreakdown,
    filaments: subitem.filaments,
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
