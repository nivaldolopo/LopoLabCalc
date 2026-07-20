"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_CAPACITY,
  DEFAULT_FIXED_COSTS,
  DEFAULT_MACHINES,
} from "../constants";
import type {
  CapacitySettings,
  FixedCostRate,
  FixedCostSettings,
  ProductPayload,
  SavedProduct,
} from "../types";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useMachines } from "../hooks/useMachines";
import { usePricingForm } from "../hooks/usePricingForm";
import { useProducts } from "../hooks/useProducts";
import { useStock } from "../hooks/useStock";
import { useSupplies } from "../hooks/useSupplies";
import { useTheme } from "../hooks/useTheme";
import {
  calculateFixedCostSummary,
  calculatePricing,
} from "../lib/calculatePricing";
import { calculateCapacity } from "../lib/calculateCapacity";
import { stripFilamentIds } from "../lib/filaments";
import { validateProduct } from "../lib/validateProduct";
import { FixedCostsPanel } from "./FixedCostsPanel";
import { Header } from "./Header";
import { MachineManagerModal } from "./MachineManagerModal";
import { PricingResultCard } from "./PricingResultCard";
import { ProductForm } from "./ProductForm";
import { SaleFlow } from "./SaleFlow";
import {
  saleContextFromResult,
  type SaleModalContext,
} from "../lib/saleContext";

export function PricingCalculator() {
  const { theme, toggleTheme } = useTheme();
  const { machines, saveMachines } = useMachines();
  const { fixedCostRate, saveFixedCostRate } = useBusinessSettings();
  // 7c: cores do Estoque para o dropdown de filamento e o preço vivo (D3). O
  // produto guarda só o `filamentId`; o preço/kg sai da cor no cálculo.
  const { filaments: stock } = useStock();
  // 7e: insumos do Estoque para ligar ao acessório. Só os ATIVOS entram no
  // seletor — arquivado é "parei de usar", não se liga de novo (um produto que
  // já apontava para ele continua apontando; o guarda do excluir cobre isso).
  const { supplies } = useSupplies();
  const productsApi = useProducts();
  const form = usePricingForm();
  const searchParams = useSearchParams();

  // A TAXA de custo fixo vem persistida (global do negócio, TD-001); o toggle
  // `enabled` é por-produto (espelha o produto em edição). O `fixedCosts`
  // completo é a junção dos dois.
  const [fixedToggles, setFixedToggles] = useState({
    enabled: DEFAULT_FIXED_COSTS.enabled,
  });
  const fixedCosts = useMemo<FixedCostSettings>(
    () => ({ ...fixedCostRate, ...fixedToggles }),
    [fixedCostRate, fixedToggles],
  );
  const [capacitySettings, setCapacitySettings] =
    useState<CapacitySettings>(DEFAULT_CAPACITY);
  const [machineModalOpen, setMachineModalOpen] = useState(false);
  // Modal de venda: aberto/fechado + a semente (produto que abriu). Semente null
  // = recibo vazio ("Nova venda"), preenchido só pelo seletor do catálogo.
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleSeed, setSaleSeed] = useState<SaleModalContext | null>(null);
  const [saved, setSaved] = useState(false);
  // Aviso de validação do formulário (inline, no lugar do window.alert).
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edições no produto limpam o aviso de validação — some assim que o usuário
  // começa a corrigir.
  function handleProductChange(patch: Partial<typeof form.product>) {
    if (saveError) setSaveError(null);
    form.updateProduct(patch);
  }

  const activeSupplies = useMemo(
    () =>
      supplies
        .filter((supply) => !supply.archived)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [supplies],
  );

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
    () => calculatePricing(form.product, machines, fixedCosts, stock),
    [fixedCosts, form.product, machines, stock],
  );

  const capacityResult = useMemo(
    () => calculateCapacity(pricingResult, form.product, capacitySettings),
    [capacitySettings, form.product, pricingResult],
  );

  const fixedCostShare =
    fixedCosts.enabled && pricingResult.totalCost > 0
      ? (pricingResult.fixedCost / pricingResult.totalCost) * 100
      : 0;

  function updateFixedCosts(patch: Partial<FixedCostSettings>) {
    // Toggle por-produto: atualiza o estado local e espelha no produto.
    if (patch.enabled !== undefined) {
      setFixedToggles({ enabled: patch.enabled });
      form.updateProduct({ includeFixed: patch.enabled });
    }
    // Taxa (aluguel/outros/máquinas/horas/dias): persiste no negócio (TD-001).
    const ratePatch: Partial<FixedCostRate> = {};
    if (patch.rent !== undefined) ratePatch.rent = patch.rent;
    if (patch.other !== undefined) ratePatch.other = patch.other;
    if (patch.machines !== undefined) ratePatch.machines = patch.machines;
    if (patch.hoursDay !== undefined) ratePatch.hoursDay = patch.hoursDay;
    if (patch.daysMonth !== undefined) ratePatch.daysMonth = patch.daysMonth;
    if (Object.keys(ratePatch).length > 0) {
      saveFixedCostRate(ratePatch);
    }
  }

  function applyLoadedFixedCosts(patch: Partial<FixedCostSettings>) {
    // loadProduct só passa o toggle `enabled` do produto.
    setFixedToggles((current) => ({
      enabled: patch.enabled ?? current.enabled,
    }));
  }

  function resetFormKeepingFixedCosts() {
    setSaveError(null);
    form.resetForm();
    form.updateProduct({
      includeFixed: fixedCosts.enabled,
    });
  }

  function buildPayload(includeCreatedAt: boolean): ProductPayload {
    // Produtos novos gravam `filaments` (FEAT-02) e não persistem os escalares
    // legados `weightG`/`filamentPricePerKg` — removidos aqui do spread.
    const base = { ...form.product };
    delete base.weightG;
    delete base.filamentPricePerKg;
    return {
      ...base,
      name: form.product.name.trim(),
      mainStageName: form.product.mainStageName.trim(),
      includeFixed: fixedCosts.enabled,
      filaments: stripFilamentIds(form.product.filaments),
      stages: form.product.stages.map((stage, index) => ({
        // FEAT-01: persiste o id (chave estável dos subitens); sempre presente
        // no estado do form, com fallback por posição por segurança.
        id: stage.id ?? `stage_${index}`,
        name: stage.name ?? "",
        machineId: stage.machineId,
        printHours: stage.printHours,
        energyTariff: form.product.energyTariff,
        laborMinutes: stage.laborMinutes,
        laborRate: form.product.laborRate,
        filaments: stripFilamentIds(stage.filaments),
      })),
      accessories: form.product.accessories.map((accessory) => ({
        desc: accessory.desc ?? "",
        qty: accessory.qty || 0,
        unitPrice: accessory.unitPrice || 0,
        // FEAT-01: atribuição a subitem (null = produto, rateado). Firestore não
        // aceita undefined, por isso o ?? null.
        subitemId: accessory.subitemId ?? null,
        // 7e: insumo do estoque (null = avulso, sem baixa na produção).
        supplyId: accessory.supplyId ?? null,
      })),
      // FEAT-01: modo de venda por subitens + os grupos. Limpa `markup` ausente
      // (Firestore rejeita undefined) — ausente = herda o markup do produto.
      sellBySubitems: form.product.sellBySubitems ?? false,
      subitems: (form.product.subitems ?? []).map((subitem) => ({
        id: subitem.id,
        name: subitem.name ?? "",
        stageKeys: subitem.stageKeys ?? [],
        ...(subitem.markup !== undefined ? { markup: subitem.markup } : {}),
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
    });
    if (error) {
      setSaveError(error);
      return;
    }
    setSaveError(null);

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
      setSaveError(error);
      return;
    }
    setSaveError(null);
    await productsApi.addProduct(buildPayload(true));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
    resetFormKeepingFixedCosts();
  }

  function loadProduct(product: SavedProduct) {
    setSaveError(null);
    form.loadProduct(product, applyLoadedFixedCosts);
  }

  // FEAT-07: "editar" no catálogo (rota própria) manda pra cá com `?load=<id>`.
  // Os produtos chegam por assinatura, então só dá pra carregar quando a lista
  // popular. Ajuste DURANTE o render (padrão do React p/ "reagir a uma prop que
  // mudou") em vez de efeito — o `handledLoad` marca o id já consumido, para que
  // snapshots seguintes do Firestore não recarreguem o produto por cima do que o
  // usuário editou (o `replaceState` limpa a URL mas não o `useSearchParams`).
  const loadId = searchParams.get("load");
  const [handledLoad, setHandledLoad] = useState<string | null>(null);
  if (loadId && handledLoad !== loadId) {
    const pending = productsApi.products.find((item) => item.id === loadId);
    if (pending) {
      setHandledLoad(loadId);
      loadProduct(pending);
    }
  }

  // Some com o `?load=` da URL depois de consumido: recarregar a página não
  // deve puxar o produto de novo. É sync com sistema externo (history), sem
  // setState — por isso vive no efeito.
  useEffect(() => {
    if (handledLoad) window.history.replaceState(null, "", "/");
  }, [handledLoad]);

  function handleSaveMachines(nextMachines: typeof machines) {
    saveMachines(nextMachines);
    const fallbackMachine = nextMachines[0] ?? DEFAULT_MACHINES[0];
    if (!nextMachines.some((machine) => machine.id === form.product.machineId)) {
      form.updateProduct({ machineId: fallbackMachine.id });
    }
  }

  function openSaleFromForm() {
    setSaleSeed(
      saleContextFromResult(
        form.product.name || form.product.mainStageName || "",
        form.editingProductId ?? "",
        pricingResult,
        totalPrintHours,
        form.product.roundingMode,
      ),
    );
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
            stock={stock}
            supplies={activeSupplies}
            editingProductId={form.editingProductId}
            saved={saved}
            onChange={handleProductChange}
            onManageMachines={() => setMachineModalOpen(true)}
            onAddStage={form.addStage}
            onRemoveStage={form.removeStage}
            onUpdateStage={form.updateStage}
            onAddAccessory={form.addAccessory}
            onRemoveAccessory={form.removeAccessory}
            onUpdateAccessory={form.updateAccessory}
            subitemPrices={pricingResult.subitems}
            onToggleSellBySubitems={form.setSellBySubitems}
            onAddSubitem={form.addSubitem}
            onRemoveSubitem={form.removeSubitem}
            onUpdateSubitem={form.updateSubitem}
            onToggleStageInSubitem={form.toggleStageInSubitem}
            onSave={saveCurrentProduct}
            onSaveAsNew={saveAsNewProduct}
            onCancelEdit={resetFormKeepingFixedCosts}
            saveError={saveError}
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

      {machineModalOpen ? (
        <MachineManagerModal
          open={machineModalOpen}
          machines={machines}
          onClose={() => setMachineModalOpen(false)}
          onSave={handleSaveMachines}
        />
      ) : null}

      {saleOpen ? (
        <SaleFlow
          seed={saleSeed}
          products={productsApi.products}
          machines={machines}
          stock={stock}
          fixedCosts={fixedCosts}
          onClose={() => setSaleOpen(false)}
        />
      ) : null}
    </main>
  );
}
