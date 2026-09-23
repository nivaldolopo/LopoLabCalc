import { round2 } from "@/lib/number";
import { skuBalance, skuValue } from "./finishedGoods";
import { grossUpForFee } from "./paymentFees";
import { roundPrice } from "./roundPrice";
import type {
  FilamentUsage,
  FinishedGood,
  FinishedSku,
  PricingResult,
  ProductKind,
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
  // IMPRIMIU. Essa resposta só existe na reconciliação (as camadas drenadas do
  // acabado), e é lá que ela passou a nascer.
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
  // O `ProductKind` do produto no momento em que o modal abriu — o SaleModal só
  // repassa para o snapshot congelado (`Sale.productKind`).
  kind: ProductKind;
};

// Monta a foto congelada de UM produto a partir do resultado de precificação.
// Pura (sem estado): serve o item que abre o modal e a lista do catálogo.
export function saleContextFromResult(
  productName: string,
  productId: string,
  result: PricingResult,
  printHours: number,
  roundingMode: RoundingMode,
  kind: ProductKind,
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
    kind,
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
  kind: ProductKind,
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
    kind,
  };
}

const ZERO_SALE_BREAKDOWN: SaleCostBreakdown = {
  material: 0,
  energy: 0,
  depreciation: 0,
  maintenance: 0,
  labor: 0,
  accessories: 0,
  failureReserve: 0,
  fixed: 0,
};

/**
 * W5 (lote 2 da 3a) — as peças prontas de produto que SAIU do catálogo.
 *
 * A lista vendável do modal nascia só do catálogo vivo: excluir o produto
 * deixava as peças dele encalhadas na prateleira, sem porta de saída — e a
 * confirmação da exclusão dizia que o estoque de acabados não era afetado.
 *
 * Um item por PARTE com saldo positivo (a peça única, ou cada subitem): sem o
 * cadastro não se sabe mais montar o conjunto. Sem preço sugerido — não há
 * cadastro que o calcule; o dono digita, e o modal já recusa venda a R$ 0. O
 * custo exibido é a média das camadas; o que grava é o FIFO da reconciliação.
 */
export function orphanFinishedContexts(
  goods: FinishedGood[],
  products: { id: string }[],
): SaleModalContext[] {
  const vivos = new Set(products.map((p) => p.id));
  const out: SaleModalContext[] = [];
  for (const good of goods) {
    if (vivos.has(good.productId)) continue;
    const porParte = new Map<string, FinishedSku[]>();
    for (const sku of good.skus) {
      const parte = sku.subitemId ?? "";
      porParte.set(parte, [...(porParte.get(parte) ?? []), sku]);
    }
    for (const [parte, skus] of porParte) {
      const saldo = skus.reduce((sum, sku) => sum + skuBalance(sku), 0);
      if (saldo <= 0) continue;
      const valor = skus.reduce((sum, sku) => sum + skuValue(sku), 0);
      const nome = good.productName || "(produto excluído)";
      const parteNome = skus[0]?.name?.trim();
      out.push({
        defaultProductName:
          parte && parteNome && parteNome !== nome ? `${nome} — ${parteNome}` : nome,
        productId: good.productId,
        ...(parte ? { subitemId: parte } : {}),
        printHours: 0,
        suggestedPrice: 0,
        roundingMode: "exact",
        unitCost: valor / saldo,
        costBreakdown: ZERO_SALE_BREAKDOWN,
        filaments: [],
        kind: "geral",
      });
    }
  }
  return out;
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
