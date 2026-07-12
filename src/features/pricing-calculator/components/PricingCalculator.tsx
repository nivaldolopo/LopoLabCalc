"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_CAPACITY,
  DEFAULT_FIXED_COSTS,
  DEFAULT_MACHINES,
} from "../constants";
import type {
  CapacitySettings,
  FixedCostSettings,
  PricingResult,
  ProductPayload,
  SavedProduct,
  SortMode,
} from "../types";
import { useFees } from "../hooks/useFees";
import { useMachines } from "../hooks/useMachines";
import { usePricingForm } from "../hooks/usePricingForm";
import { useProducts } from "../hooks/useProducts";
import { useTheme } from "../hooks/useTheme";
import {
  calculateFixedCostSummary,
  calculatePricing,
} from "../lib/calculatePricing";
import { calculateCapacity } from "../lib/calculateCapacity";
import { validateProduct } from "../lib/validateProduct";
import { saveRecibo } from "@/lib/firebase/salesRepository";
import { FixedCostsPanel } from "./FixedCostsPanel";
import { Header } from "./Header";
import { MachineManagerModal } from "./MachineManagerModal";
import { PricingResultCard } from "./PricingResultCard";
import { ProductCatalog } from "./ProductCatalog";
import { ProductForm } from "./ProductForm";
import {
  SaleModal,
  productPrintHours,
  saleContextFromResult,
  type SaleModalContext,
} from "./SaleModal";

export function PricingCalculator() {
  const { theme, toggleTheme } = useTheme();
  const { machines, saveMachines } = useMachines();
  const { fees, saveFees } = useFees();
  const productsApi = useProducts();
  const form = usePricingForm();

  const [fixedCosts, setFixedCosts] =
    useState<FixedCostSettings>(DEFAULT_FIXED_COSTS);
  const [capacitySettings, setCapacitySettings] =
    useState<CapacitySettings>(DEFAULT_CAPACITY);
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [machineModalOpen, setMachineModalOpen] = useState(false);
  // Modal de venda: aberto/fechado + a semente (produto que abriu). Semente null
  // = recibo vazio ("Nova venda"), preenchido só pelo seletor do catálogo.
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleSeed, setSaleSeed] = useState<SaleModalContext | null>(null);
  const [saved, setSaved] = useState(false);

  const totalPrintHours = useMemo(
    () =>
      form.product.printHours +
      form.product.stages.reduce(
        (sum, stage) => sum + (stage.printHours || 0),
        0,
      ),
    [form.product.printHours, form.product.stages],
  );

  const fixedSummary = useMemo(
    () => calculateFixedCostSummary(fixedCosts, totalPrintHours),
    [fixedCosts, totalPrintHours],
  );

  const pricingResult = useMemo(
    () => calculatePricing(form.product, machines, fixedCosts),
    [fixedCosts, form.product, machines],
  );

  const capacityResult = useMemo(
    () => calculateCapacity(pricingResult, form.product, capacitySettings),
    [capacitySettings, form.product, pricingResult],
  );

  // Precifica cada produto do catálogo UMA vez, memoizado (só recalcula quando
  // produtos/máquinas/custos fixos mudam — não a cada tecla no formulário).
  // Reusado pela tabela do catálogo e pela cesta de venda, evitando recalcular
  // o mesmo produto em vários lugares.
  const pricingByProduct = useMemo(() => {
    const map = new Map<string, PricingResult>();
    productsApi.products.forEach((product) => {
      map.set(product.id, calculatePricing(product, machines, fixedCosts));
    });
    return map;
  }, [productsApi.products, machines, fixedCosts]);

  const fixedCostShare =
    fixedCosts.enabled && pricingResult.totalCost > 0
      ? (pricingResult.fixedCost / pricingResult.totalCost) * 100
      : 0;

  function updateFixedCosts(patch: Partial<FixedCostSettings>) {
    setFixedCosts((current) => ({ ...current, ...patch }));
    if (patch.enabled !== undefined) {
      form.updateProduct({ includeFixed: patch.enabled });
    }
    if (patch.markupOnFixed !== undefined) {
      form.updateProduct({ markupOnFixed: patch.markupOnFixed });
    }
  }

  function applyLoadedFixedCosts(patch: Partial<FixedCostSettings>) {
    setFixedCosts((current) => ({ ...current, ...patch }));
  }

  function resetFormKeepingFixedCosts() {
    form.resetForm();
    form.updateProduct({
      includeFixed: fixedCosts.enabled,
      markupOnFixed: fixedCosts.markupOnFixed,
    });
  }

  function buildPayload(includeCreatedAt: boolean): ProductPayload {
    return {
      ...form.product,
      name: form.product.name.trim(),
      mainStageName: form.product.mainStageName.trim(),
      includeFixed: fixedCosts.enabled,
      markupOnFixed: fixedCosts.markupOnFixed,
      stages: form.product.stages.map((stage) => ({
        name: stage.name ?? "",
        machineId: stage.machineId,
        weightG: stage.weightG,
        printHours: stage.printHours,
        filamentPricePerKg: stage.filamentPricePerKg,
        energyTariff: form.product.energyTariff,
        laborMinutes: stage.laborMinutes,
        laborRate: form.product.laborRate,
      })),
      accessories: form.product.accessories.map((accessory) => ({
        desc: accessory.desc ?? "",
        qty: accessory.qty || 0,
        unitPrice: accessory.unitPrice || 0,
      })),
      linkModel: form.product.linkModel.trim(),
      linkCompetitor: form.product.linkCompetitor.trim(),
      linkFile: form.product.linkFile.trim(),
      fixedCostPerHour: null,
      combineEnabled: null,
      stage2: null,
      ...(includeCreatedAt ? { createdAt: Date.now() } : {}),
    };
  }

  async function saveCurrentProduct() {
    const error = validateProduct({
      ...form.product,
      includeFixed: fixedCosts.enabled,
      markupOnFixed: fixedCosts.markupOnFixed,
    });
    if (error) {
      window.alert(error);
      return;
    }

    if (form.editingProductId) {
      await productsApi.updateProduct(form.editingProductId, buildPayload(false));
    } else {
      await productsApi.addProduct(buildPayload(true));
    }

    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
    resetFormKeepingFixedCosts();
  }

  async function saveAsNewProduct() {
    const error = validateProduct(form.product);
    if (error) {
      window.alert(error);
      return;
    }
    await productsApi.addProduct(buildPayload(true));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
    resetFormKeepingFixedCosts();
  }

  function loadProduct(product: SavedProduct) {
    form.loadProduct(product, applyLoadedFixedCosts);
  }

  function handleSaveMachines(nextMachines: typeof machines) {
    saveMachines(nextMachines);
    const fallbackMachine = nextMachines[0] ?? DEFAULT_MACHINES[0];
    if (!nextMachines.some((machine) => machine.id === form.product.machineId)) {
      form.updateProduct({ machineId: fallbackMachine.id });
    }
  }

  // Produtos do catálogo prontos como itens de cesta (para adicionar mais de um
  // produto ao mesmo recibo dentro do modal de venda).
  const catalogSaleItems = useMemo(
    () =>
      productsApi.products
        .map((product) =>
          saleContextFromResult(
            product.name || product.mainStageName || "",
            product.id,
            pricingByProduct.get(product.id) ??
              calculatePricing(product, machines, fixedCosts),
            productPrintHours(product),
          ),
        )
        .sort((a, b) =>
          a.defaultProductName.localeCompare(b.defaultProductName, "pt-BR"),
        ),
    [productsApi.products, pricingByProduct, machines, fixedCosts],
  );

  function openSaleFromForm() {
    setSaleSeed(
      saleContextFromResult(
        form.product.name || form.product.mainStageName || "",
        form.editingProductId ?? "",
        pricingResult,
        totalPrintHours,
      ),
    );
    setSaleOpen(true);
  }

  function openSaleFromCatalog(product: SavedProduct, result: PricingResult) {
    setSaleSeed(
      saleContextFromResult(
        product.name || product.mainStageName || "",
        product.id,
        result,
        productPrintHours(product),
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
      <Header theme={theme} status={productsApi.status} onToggleTheme={toggleTheme} />
      {productsApi.error ? <div className="app-error">{productsApi.error}</div> : null}

      <div className="grid">
        <div className="left-column">
          <ProductForm
            product={form.product}
            machines={machines}
            editingProductId={form.editingProductId}
            saved={saved}
            onChange={form.updateProduct}
            onManageMachines={() => setMachineModalOpen(true)}
            onAddStage={form.addStage}
            onRemoveStage={form.removeStage}
            onUpdateStage={form.updateStage}
            onAddAccessory={form.addAccessory}
            onRemoveAccessory={form.removeAccessory}
            onUpdateAccessory={form.updateAccessory}
            onSave={saveCurrentProduct}
            onSaveAsNew={saveAsNewProduct}
            onCancelEdit={resetFormKeepingFixedCosts}
          />
          <FixedCostsPanel
            fixedCosts={fixedCosts}
            summary={fixedSummary}
            fixedCostShare={fixedCostShare}
            onChange={updateFixedCosts}
          />
        </div>
        <PricingResultCard
          result={pricingResult}
          fixedCosts={fixedCosts}
          capacitySettings={capacitySettings}
          capacityResult={capacityResult}
          roundingMode={form.product.roundingMode}
          printHours={totalPrintHours}
          onRoundingModeChange={(mode) =>
            form.updateProduct({ roundingMode: mode })
          }
          onCapacityChange={(patch) =>
            setCapacitySettings((current) => ({ ...current, ...patch }))
          }
          onRegisterSale={openSaleFromForm}
        />
      </div>

      <ProductCatalog
        products={productsApi.products}
        machines={machines}
        fixedCosts={fixedCosts}
        pricingByProduct={pricingByProduct}
        capacitySettings={capacitySettings}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        onLoadProduct={loadProduct}
        onDeleteProduct={productsApi.deleteProduct}
        onImportProducts={productsApi.importProducts}
        onRegisterSale={openSaleFromCatalog}
        onNewSale={openNewSale}
      />

      {machineModalOpen ? (
        <MachineManagerModal
          open={machineModalOpen}
          machines={machines}
          onClose={() => setMachineModalOpen(false)}
          onSave={handleSaveMachines}
        />
      ) : null}

      {saleOpen ? (
        <SaleModal
          seed={saleSeed}
          catalogItems={catalogSaleItems}
          fees={fees}
          onFeesChange={saveFees}
          onClose={() => setSaleOpen(false)}
          onConfirm={saveRecibo}
        />
      ) : null}
    </main>
  );
}
