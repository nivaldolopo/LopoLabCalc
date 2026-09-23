"use client";

import { useMemo } from "react";
import { reconcileRecibo } from "@/lib/firebase/salesRepository";
import { useFees } from "../hooks/useFees";
import { useFinishedGoods } from "../hooks/useFinishedGoods";
import { useQuotes } from "../hooks/useQuotes";
import { calculatePricing } from "../lib/calculatePricing";
import {
  productPrintHours,
  saleContextFromResult,
  orphanFinishedContexts,
  saleContextFromSubitem,
  type SaleModalContext,
} from "../lib/saleContext";
import type {
  FixedCostSettings,
  Machine,
  PricingResult,
  SavedProduct,
  StockFilament,
} from "../types";
import { useSupplies } from "../hooks/useSupplies";
import { SaleModal } from "./SaleModal";

type SaleFlowProps = {
  // Semente do recibo: null = "Nova venda" (recibo vazio).
  seed: SaleModalContext | null;
  products: SavedProduct[];
  machines: Machine[];
  stock: StockFilament[];
  fixedCosts: FixedCostSettings;
  energyTariff: number;
  // Precificação já memoizada pela página (o catálogo tem a sua). Opcional —
  // sem ela o SaleFlow calcula por conta própria.
  pricingByProduct?: Map<string, PricingResult>;
  onClose: () => void;
};

// Fiação do modal de venda num lugar só. A calculadora (venda pelo card de
// resultado) e o catálogo (venda pelo card do produto) abrem o MESMO modal, que
// depende de 3 hooks só dele (taxas, acabados, produção) + a cesta do catálogo.
// Sem esta extração, essas ~40 linhas viveriam duplicadas nas duas páginas.
// Renderize condicionalmente (`{open ? <SaleFlow .../> : null}`) — as assinaturas
// do Firestore só sobem quando o modal abre.
export function SaleFlow({
  seed,
  products,
  machines,
  stock,
  fixedCosts,
  energyTariff,
  pricingByProduct,
  onClose,
}: SaleFlowProps) {
  const { fees } = useFees();
  const { goods } = useFinishedGoods();
  // 7e/W4: insumos para a baixa dos acessórios do conjunto. Assinado aqui (e não
  // vindo por prop) pelo mesmo motivo dos outros 3 hooks: é do modal, não da
  // página, e só sobe quando o modal abre.
  const { supplies } = useSupplies();
  // Link opcional orçamento → venda (ver `SaleInput.quoteId`) — mesmo motivo.
  const { quotes } = useQuotes();

  // Produtos do catálogo prontos como itens de cesta (para adicionar mais de um
  // produto ao mesmo recibo dentro do modal de venda).
  const catalogItems = useMemo(
    () =>
      products
        .flatMap((product) => {
          const result =
            pricingByProduct?.get(product.id) ??
            calculatePricing(product, machines, fixedCosts, energyTariff, stock, supplies);
          const baseName = product.name || product.mainStageName || "";
          // O produto inteiro sempre é vendável; subitens (FEAT-01) entram como
          // itens vendáveis à parte, cada um congelando só o seu custo/consumo.
          const whole = saleContextFromResult(
            baseName,
            product.id,
            result,
            productPrintHours(product),
            product.roundingMode,
            product.kind ?? "geral",
          );
          const subs = (result.subitems ?? []).map((subitem) =>
            saleContextFromSubitem(
              baseName,
              product.id,
              subitem,
              product.roundingMode,
              product.kind ?? "geral",
            ),
          );
          return [whole, ...subs];
        })
        // W5: as peças prontas de produto excluído continuam vendáveis.
        .concat(orphanFinishedContexts(goods, products))
        .sort((a, b) =>
          a.defaultProductName.localeCompare(b.defaultProductName, "pt-BR"),
        ),
    [products, pricingByProduct, machines, fixedCosts, energyTariff, stock, supplies, goods],
  );

  return (
    <SaleModal
      seed={seed}
      catalogItems={catalogItems}
      fees={fees}
      goods={goods}
      stock={stock}
      supplies={supplies}
      products={products}
      machines={machines}
      fixedCosts={fixedCosts}
      energyTariff={energyTariff}
      quotes={quotes}
      onClose={onClose}
      onConfirm={reconcileRecibo}
    />
  );
}
