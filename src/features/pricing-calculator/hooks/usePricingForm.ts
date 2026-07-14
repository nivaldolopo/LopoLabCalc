"use client";

import { useState } from "react";
import { DEFAULT_PRODUCT_INPUT } from "../constants";
import { makeFilament, normalizeFilaments } from "../lib/filaments";
import type {
  Accessory,
  FilamentUsage,
  FixedCostSettings,
  PrintStage,
  ProductInput,
  SavedProduct,
} from "../types";

// As cores no estado do formulário ganham um `id` só para servir de chave de
// lista estável (descartado ao persistir). `normalizeFilaments` migra dado
// legado (escalar) ou já usa o array salvo.
let filamentSeq = 0;
function withFilamentIds(filaments: FilamentUsage[]): FilamentUsage[] {
  return filaments.map((f) => {
    filamentSeq += 1;
    return {
      ...makeFilament(f),
      id: f.id ?? `fil_${Date.now()}_${filamentSeq}`,
    };
  });
}

function cloneDefaultProduct(): ProductInput {
  return {
    ...DEFAULT_PRODUCT_INPUT,
    stages: [],
    accessories: [],
    filaments: withFilamentIds(normalizeFilaments(DEFAULT_PRODUCT_INPUT)),
  };
}

function createStage(index: number, data?: Partial<PrintStage>): PrintStage {
  return {
    id: `stage_${Date.now()}_${index}`,
    name: data?.name ?? "",
    machineId: data?.machineId ?? "a1",
    printHours: data?.printHours ?? 0,
    laborMinutes: data?.laborMinutes ?? 0,
    energyTariff: data?.energyTariff,
    laborRate: data?.laborRate,
    filaments: withFilamentIds(
      normalizeFilaments(data ?? { filamentPricePerKg: 110 }),
    ),
  };
}

function createAccessory(index: number, data?: Partial<Accessory>): Accessory {
  return {
    id: `acc_${Date.now()}_${index}`,
    desc: data?.desc ?? "",
    qty: data?.qty ?? 1,
    unitPrice: data?.unitPrice ?? 0,
  };
}

export function usePricingForm() {
  const [product, setProduct] = useState<ProductInput>(() =>
    cloneDefaultProduct(),
  );
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  function updateProduct(patch: Partial<ProductInput>) {
    setProduct((current) => ({ ...current, ...patch }));
  }

  function updateStage(stageId: string, patch: Partial<PrintStage>) {
    setProduct((current) => ({
      ...current,
      stages: current.stages.map((stage) =>
        stage.id === stageId ? { ...stage, ...patch } : stage,
      ),
    }));
  }

  function addStage(data?: Partial<PrintStage>) {
    setProduct((current) => ({
      ...current,
      stages: [...current.stages, createStage(current.stages.length, data)],
    }));
  }

  function removeStage(stageId: string) {
    setProduct((current) => ({
      ...current,
      stages: current.stages.filter((stage) => stage.id !== stageId),
    }));
  }

  function updateAccessory(accessoryId: string, patch: Partial<Accessory>) {
    setProduct((current) => ({
      ...current,
      accessories: current.accessories.map((accessory) =>
        accessory.id === accessoryId ? { ...accessory, ...patch } : accessory,
      ),
    }));
  }

  function addAccessory(data?: Partial<Accessory>) {
    setProduct((current) => ({
      ...current,
      accessories: [
        ...current.accessories,
        createAccessory(current.accessories.length, data),
      ],
    }));
  }

  function removeAccessory(accessoryId: string) {
    setProduct((current) => ({
      ...current,
      accessories: current.accessories.filter(
        (accessory) => accessory.id !== accessoryId,
      ),
    }));
  }

  function resetForm() {
    setEditingProductId(null);
    setProduct(cloneDefaultProduct());
  }

  function loadProduct(
    savedProduct: SavedProduct,
    setFixedCosts: (patch: Partial<FixedCostSettings>) => void,
  ) {
    const loadedStages =
      savedProduct.stages?.length || !savedProduct.stage2
        ? savedProduct.stages
        : [savedProduct.stage2];

    setEditingProductId(savedProduct.id);
    setProduct({
      ...cloneDefaultProduct(),
      ...savedProduct,
      filaments: withFilamentIds(normalizeFilaments(savedProduct)),
      stages: (loadedStages ?? []).map((stage, index) =>
        createStage(index, stage),
      ),
      accessories: (savedProduct.accessories ?? []).map((accessory, index) =>
        createAccessory(index, accessory),
      ),
      includeFixed: savedProduct.includeFixed,
      fixedCostPerHour: null,
      combineEnabled: null,
      stage2: null,
    });
    setFixedCosts({
      enabled: savedProduct.includeFixed,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return {
    product,
    editingProductId,
    updateProduct,
    updateStage,
    addStage,
    removeStage,
    updateAccessory,
    addAccessory,
    removeAccessory,
    resetForm,
    loadProduct,
  };
}
