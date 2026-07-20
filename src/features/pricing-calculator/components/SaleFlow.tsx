"use client";

import { useMemo } from "react";
import { reconcileRecibo } from "@/lib/firebase/salesRepository";
import { useFees } from "../hooks/useFees";
import { useFinishedGoods } from "../hooks/useFinishedGoods";
import { useProduction } from "../hooks/useProduction";
import { calculatePricing } from "../lib/calculatePricing";
import {
  productPrintHours,
  saleContextFromResult,
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
import { SaleModal } from "./SaleModal";

type SaleFlowProps = {
  // Semente do recibo: null = "Nova venda" (recibo vazio).
  seed: SaleModalContext | null;
  products: SavedProduct[];
  machines: Machine[];
  stock: StockFilament[];
  fixedCosts: FixedCostSettings;
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
  pricingByProduct,
  onClose,
}: SaleFlowProps) {
  const { fees, saveFees } = useFees();
  const { goods } = useFinishedGoods();
  const { events: production } = useProduction();

  // Produtos do catálogo prontos como itens de cesta (para adicionar mais de um
  // produto ao mesmo recibo dentro do modal de venda).
  const catalogItems = useMemo(
    () =>
      products
        .flatMap((product) => {
          const result =
            pricingByProduct?.get(product.id) ??
            calculatePricing(product, machines, fixedCosts, stock);
          const baseName = product.name || product.mainStageName || "";
          // O produto inteiro sempre é vendável; subitens (FEAT-01) entram como
          // itens vendáveis à parte, cada um congelando só o seu custo/consumo.
          const whole = saleContextFromResult(
            baseName,
            product.id,
            result,
            productPrintHours(product),
            product.roundingMode,
          );
          const subs = (result.subitems ?? []).map((subitem) =>
            saleContextFromSubitem(
              baseName,
              product.id,
              subitem,
              product.roundingMode,
            ),
          );
          return [whole, ...subs];
        })
        .sort((a, b) =>
          a.defaultProductName.localeCompare(b.defaultProductName, "pt-BR"),
        ),
    [products, pricingByProduct, machines, fixedCosts, stock],
  );

  return (
    <SaleModal
      seed={seed}
      catalogItems={catalogItems}
      fees={fees}
      onFeesChange={saveFees}
      goods={goods}
      stock={stock}
      products={products}
      machines={machines}
      fixedCosts={fixedCosts}
      production={production}
      onClose={onClose}
      onConfirm={reconcileRecibo}
    />
  );
}
