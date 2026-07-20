"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_FIXED_COSTS } from "../constants";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useMachines } from "../hooks/useMachines";
import { useProducts } from "../hooks/useProducts";
import { useStock } from "../hooks/useStock";
import { useTheme } from "../hooks/useTheme";
import { calculatePricing } from "../lib/calculatePricing";
import {
  productPrintHours,
  saleContextFromResult,
  type SaleModalContext,
} from "../lib/saleContext";
import type {
  CapacitySettings,
  CloudStatus,
  FixedCostSettings,
  PricingResult,
  SavedProduct,
  SortMode,
} from "../types";
import { NavBar } from "./NavBar";
import { ProductCatalog } from "./ProductCatalog";
import { SaleFlow } from "./SaleFlow";

const statusLabel: Record<CloudStatus, string> = {
  connecting: "Conectando nuvem...",
  synced: "Sincronizado",
  importing: "Importando...",
  error: "Erro de Conexão",
};

// FEAT-07: o catálogo saiu da página principal pra rota própria. A principal
// ficou só calculadora/cadastro; aqui o catálogo tem a página inteira.
export function CatalogPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { machines } = useMachines();
  const { filaments: stock } = useStock();
  const { fixedCostRate } = useBusinessSettings();
  const productsApi = useProducts();

  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleSeed, setSaleSeed] = useState<SaleModalContext | null>(null);

  // O `enabled` daqui é só o piso: todo produto SALVO traz o próprio
  // `includeFixed`, que o `calculatePricing` usa por cima deste (ver a NOTA em
  // calculatePricing.ts). Por isso o catálogo não precisa do toggle da
  // calculadora — cada linha já se precifica com a própria escolha.
  const fixedCosts = useMemo<FixedCostSettings>(
    () => ({ ...fixedCostRate, enabled: DEFAULT_FIXED_COSTS.enabled }),
    [fixedCostRate],
  );

  // UX-02: a capacidade sai da MESMA fonte persistida que rateia o custo fixo
  // (config/negocio), não de um literal. Antes o catálogo usava DEFAULT_CAPACITY
  // (1 máquina) enquanto o rateio usava o rate salvo (2) — duas fontes de verdade
  // discordando, e o painel subestimava peças/mês. Derivado, sem estado próprio:
  // mudou nos custos fixos, mudou aqui.
  const capacitySettings = useMemo<CapacitySettings>(
    () => ({
      hoursDay: fixedCostRate.hoursDay,
      machines: fixedCostRate.machines,
    }),
    [fixedCostRate],
  );

  // Precifica cada produto UMA vez, memoizado — reusado pela tabela e pela
  // cesta de venda do SaleFlow.
  const pricingByProduct = useMemo(() => {
    const map = new Map<string, PricingResult>();
    productsApi.products.forEach((product) => {
      map.set(product.id, calculatePricing(product, machines, fixedCosts, stock));
    });
    return map;
  }, [productsApi.products, machines, fixedCosts, stock]);

  // "Editar" virou cross-page: manda pra calculadora com o produto na query.
  // A `PricingCalculator` carrega o produto no form e limpa a URL.
  function editProduct(product: SavedProduct) {
    router.push(`/?load=${encodeURIComponent(product.id)}`);
  }

  function openSaleFromCatalog(product: SavedProduct, result: PricingResult) {
    setSaleSeed(
      saleContextFromResult(
        product.name || product.mainStageName || "",
        product.id,
        result,
        productPrintHours(product),
        product.roundingMode,
      ),
    );
    setSaleOpen(true);
  }

  function openNewSale() {
    setSaleSeed(null);
    setSaleOpen(true);
  }

  return (
    <main className="wrap">
      <div className="header">
        <div className="brand">
          <div>
            <h1 className="sg">Catálogo</h1>
            <div className="brand-meta">
              <span>Produtos cadastrados — Lopo Lab</span>
              <span className={`cloud-status ${productsApi.status}`}>
                {statusLabel[productsApi.status]}
              </span>
            </div>
          </div>
        </div>
      </div>
      <NavBar theme={theme} onToggleTheme={toggleTheme} />

      {productsApi.error ? (
        <div className="app-error">{productsApi.error}</div>
      ) : null}

      {productsApi.products.length === 0 ? (
        // Numa rota dedicada, catálogo vazio não pode ser tela em branco (na
        // página principal o componente simplesmente sumia).
        <div className="catalog-card catalog-empty">
          <p>Nenhum produto cadastrado ainda.</p>
          <Link className="btn primary" href="/">
            Ir para a calculadora
          </Link>
        </div>
      ) : (
        <ProductCatalog
          products={productsApi.products}
          machines={machines}
          stock={stock}
          fixedCosts={fixedCosts}
          pricingByProduct={pricingByProduct}
          capacitySettings={capacitySettings}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          onLoadProduct={editProduct}
          onDeleteProduct={productsApi.deleteProduct}
          onImportProducts={productsApi.importProducts}
          onRegisterSale={openSaleFromCatalog}
          onNewSale={openNewSale}
        />
      )}

      {saleOpen ? (
        <SaleFlow
          seed={saleSeed}
          products={productsApi.products}
          machines={machines}
          stock={stock}
          fixedCosts={fixedCosts}
          pricingByProduct={pricingByProduct}
          onClose={() => setSaleOpen(false)}
        />
      ) : null}
    </main>
  );
}
