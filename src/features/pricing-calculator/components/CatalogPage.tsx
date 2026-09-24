"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_FIXED_COSTS, PRODUCT_KINDS } from "../constants";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useFees } from "../hooks/useFees";
import { useMachines } from "../hooks/useMachines";
import { usePrintAliases } from "../hooks/usePrintAliases";
import { useProducts } from "../hooks/useProducts";
import { useStock } from "../hooks/useStock";
import { useSupplies } from "../hooks/useSupplies";
import { useTheme } from "../hooks/useTheme";
import { calculatePricing } from "../lib/calculatePricing";
import {
  productPrintHours,
  saleContextFromResult,
  saleContextFromSubitem,
  type SaleModalContext,
} from "../lib/saleContext";
import type {
  CapacitySettings,
  FixedCostSettings,
  PricingResult,
  ProductKind,
  SavedProduct,
  SortMode,
} from "../types";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { ProductCatalog } from "./ProductCatalog";
import { SaleFlow } from "./SaleFlow";

// FEAT-07: o catálogo saiu da página principal pra rota própria. A principal
// ficou só calculadora/cadastro; aqui o catálogo tem a página inteira.
export function CatalogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();

  // UX-08: "Ver no catálogo" (aba Produtos do estoque) manda pra cá com
  // `?produto=<id>` — o card abre expandido. Lido UMA vez; a URL é limpa depois
  // pra um refresh não re-focar. Congelado em estado (o efeito abaixo zera a query).
  const [focusId] = useState<string | null>(() => searchParams.get("produto"));
  useEffect(() => {
    if (focusId) window.history.replaceState(null, "", "/catalogo");
  }, [focusId]);
  const { machines } = useMachines();
  const { filaments: stock } = useStock();
  // CSV-05: só para a importação CONFERIR o `supplyId` dos acessórios da
  // planilha. Não entra em cálculo nenhum desta página.
  const { supplies } = useSupplies();
  const { fixedCostRate, energyTariff } = useBusinessSettings();
  // UX-10: só para EXIBIR a margem líquida ao lado da bruta — nenhuma taxa entra
  // no preço aqui (o repasse continua sendo escolha da venda).
  const { fees } = useFees();
  const productsApi = useProducts();
  // S3 — a importação confere apelido contra o catálogo inteiro; o export leva.
  const { aliases, error: aliasesError } = usePrintAliases();
  // Só o apelido de produto VIVO está em uso: órfão (produto apagado pelo
  // Console) é sobrescrito na importação — ver `createProductsTx`.
  const liveAliases = useMemo(() => {
    const ids = new Set(productsApi.products.map((product) => product.id));
    return aliases.filter((alias) => ids.has(alias.productId));
  }, [aliases, productsApi.products]);

  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleSeed, setSaleSeed] = useState<SaleModalContext | null>(null);
  // Duas "gavetas" do mesmo catálogo — dia a dia × sob medida (ver `ProductKind`
  // em types.ts). Cada aba é um catálogo próprio: busca, ordenação e export/
  // import operam só sobre o que está na aba aberta.
  const [activeKind, setActiveKind] = useState<ProductKind>("geral");
  const productsInKind = useMemo(
    () =>
      productsApi.products.filter(
        (product) => (product.kind ?? "geral") === activeKind,
      ),
    [productsApi.products, activeKind],
  );
  const kindCounts = useMemo(() => {
    const counts: Record<ProductKind, number> = { geral: 0, personalizado: 0 };
    productsApi.products.forEach((product) => {
      counts[product.kind ?? "geral"] += 1;
    });
    return counts;
  }, [productsApi.products]);

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
  // mudou nos custos fixos, mudou aqui. TD-010: o `daysMonth` fecha o trio — o
  // horizonte da capacidade virou o mesmo mês que rateia o fixo.
  const capacitySettings = useMemo<CapacitySettings>(
    () => ({
      hoursDay: fixedCostRate.hoursDay,
      machines: fixedCostRate.machines,
      daysMonth: fixedCostRate.daysMonth,
    }),
    [fixedCostRate],
  );

  // Precifica cada produto UMA vez, memoizado — reusado pela tabela e pela
  // cesta de venda do SaleFlow.
  const pricingByProduct = useMemo(() => {
    const map = new Map<string, PricingResult>();
    productsApi.products.forEach((product) => {
      map.set(
        product.id,
        calculatePricing(product, machines, fixedCosts, energyTariff, stock, supplies),
      );
    });
    return map;
  }, [productsApi.products, machines, fixedCosts, energyTariff, stock, supplies]);

  // "Editar" virou cross-page: manda pra calculadora com o produto na query.
  // A `PricingCalculator` carrega o produto no form e limpa a URL.
  function editProduct(product: SavedProduct) {
    router.push(`/?load=${encodeURIComponent(product.id)}`);
  }

  // FEAT-08: a mesma query serve produção e orçamento — cada página traduz pro
  // formato interno dela. `subitem` ausente = produto inteiro.
  function seedQuery(product: SavedProduct, subitemId?: string) {
    const params = new URLSearchParams({ produto: product.id });
    if (subitemId) params.set("subitem", subitemId);
    return params.toString();
  }

  function produceProduct(product: SavedProduct, subitemId?: string) {
    router.push(`/producao?${seedQuery(product, subitemId)}`);
  }

  function quoteProduct(product: SavedProduct, subitemId?: string) {
    router.push(`/orcamento?${seedQuery(product, subitemId)}`);
  }

  function openSaleFromCatalog(
    product: SavedProduct,
    result: PricingResult,
    subitemId?: string,
  ) {
    const baseName = product.name || product.mainStageName || "";
    // FEAT-01 já congelava a foto de UM subitem (preço/custo/filamentos próprios,
    // aditivos) — aqui só escolhemos qual das duas fotos o modal recebe.
    const subitem = subitemId
      ? result.subitems?.find((item) => item.id === subitemId)
      : undefined;
    setSaleSeed(
      subitem
        ? saleContextFromSubitem(
            baseName,
            product.id,
            subitem,
            product.roundingMode,
            product.kind ?? "geral",
          )
        : saleContextFromResult(
            baseName,
            product.id,
            result,
            productPrintHours(product),
            product.roundingMode,
            product.kind ?? "geral",
          ),
    );
    setSaleOpen(true);
  }

  function openNewSale() {
    setSaleSeed(null);
    setSaleOpen(true);
  }

  return (
    <main className="wrap" id="conteudo" tabIndex={-1}>
      <PageHeader
        title="Catálogo"
        meta="Produtos cadastrados — Lopo Lab"
        status={productsApi.status}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <NavBar />

      {productsApi.error ? (
        <div className="app-error">{productsApi.error}</div>
      ) : null}
      {aliasesError ? (
        <div className="app-error">
          Apelidos de impressão indisponíveis: {aliasesError}
        </div>
      ) : null}

      {/* Duas gavetas do mesmo catálogo (ver `ProductKind`) — dia a dia × sob
          medida. Cada uma é um catálogo próprio: busca, ordenação e
          export/import da `ProductCatalog` operam só sobre a aba aberta.
          ⚠ A `ProductCatalog` renderiza MESMO VAZIA: é a barra dela que
          importa o CSV, e a carga da fase A começa com o banco zerado. */}
      {productsApi.products.length > 0 ? (
        <div className="stock-tabs" role="tablist">
          {PRODUCT_KINDS.map((option) => (
            <button
              key={option.value}
              className={`stock-tab ${activeKind === option.value ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeKind === option.value}
              onClick={() => setActiveKind(option.value)}
            >
              {option.label} ({kindCounts[option.value]})
            </button>
          ))}
        </div>
      ) : null}

      <ProductCatalog
        products={productsInKind}
        aliases={liveAliases}
        emptyState={
          productsApi.products.length === 0 ? (
            // Numa rota dedicada, catálogo vazio não pode ser tela em branco.
            <div className="catalog-card catalog-empty">
              <p>Nenhum produto cadastrado ainda.</p>
              <Link className="btn primary" href="/">
                Ir para a calculadora
              </Link>
            </div>
          ) : (
            <div className="catalog-card catalog-empty">
              <p>
                Nenhum produto{" "}
                {activeKind === "personalizado" ? "personalizado" : "geral"}{" "}
                ainda.
              </p>
            </div>
          )
        }
        machines={machines}
        stock={stock}
        supplies={supplies}
        fixedCosts={fixedCosts}
        energyTariff={energyTariff}
        pricingByProduct={pricingByProduct}
        capacitySettings={capacitySettings}
        fees={fees}
        initialOpenId={focusId}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        onLoadProduct={editProduct}
        onDeleteProduct={productsApi.deleteProduct}
        onImportProducts={productsApi.importProducts}
        onRegisterSale={openSaleFromCatalog}
        onProduce={produceProduct}
        onQuote={quoteProduct}
        onNewSale={openNewSale}
      />

      {saleOpen ? (
        <SaleFlow
          seed={saleSeed}
          products={productsApi.products}
          machines={machines}
          stock={stock}
          fixedCosts={fixedCosts}
          energyTariff={energyTariff}
          pricingByProduct={pricingByProduct}
          onClose={() => setSaleOpen(false)}
        />
      ) : null}
    </main>
  );
}
