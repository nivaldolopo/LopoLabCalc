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
  Subitem,
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

// Exportada só para teste, mesmo motivo do `createAccessory`: é ela que
// reconstrói a etapa ao CARREGAR um produto salvo.
export function createStage(index: number, data?: Partial<PrintStage>): PrintStage {
  return {
    // FEAT-01: preserva o id salvo (os `stageKeys` dos subitens referenciam-no);
    // só gera um novo quando a etapa nasce sem id.
    id: data?.id ?? `stage_${Date.now()}_${index}`,
    name: data?.name ?? "",
    machineId: data?.machineId ?? "a1",
    printHours: data?.printHours ?? 0,
    laborMinutes: data?.laborMinutes ?? 0,
    filaments: withFilamentIds(
      normalizeFilaments(data ?? { filamentPricePerKg: 110 }),
    ),
  };
}

// Exportada só para teste: é ela que reconstrói o acessório ao CARREGAR um
// produto salvo, e um campo esquecido aqui vira gravação com `null` no save
// seguinte (foi o que aconteceu com o `supplyId`).
export function createAccessory(
  index: number,
  data?: Partial<Accessory>,
): Accessory {
  return {
    id: `acc_${Date.now()}_${index}`,
    desc: data?.desc ?? "",
    qty: data?.qty ?? 1,
    unitPrice: data?.unitPrice ?? 0,
    // FEAT-01: atribuição a um subitem (null = nível do produto, rateado).
    subitemId: data?.subitemId ?? null,
    // 7e: o insumo ligado é DADO SALVO, não estado novo. Sem esta linha,
    // carregar um produto devolvia o acessório como avulso e o `buildPayload`
    // gravava `supplyId: null` no save seguinte — a baixa na produção morria
    // sem que o preço se mexesse (o `unitPrice` sobrevive), então nada avisava.
    supplyId: data?.supplyId ?? null,
  };
}

// O DOCUMENTO salvo → o estado do formulário. Pura e exportada: é o par do
// `buildProductPayload`, e juntos formam o round-trip "abrir e salvar sem tocar
// em nada". Campo que esta função esquecer some no save seguinte (FORM-01), e o
// preço não denuncia — por isso o teste é diff campo a campo do documento.
export function buildLoadedProduct(savedProduct: SavedProduct): ProductInput {
  const loadedStages =
    savedProduct.stages?.length || !savedProduct.stage2
      ? savedProduct.stages
      : [savedProduct.stage2];

  return {
    ...cloneDefaultProduct(),
    ...savedProduct,
    filaments: withFilamentIds(normalizeFilaments(savedProduct)),
    // RT-02: etapa salva SEM `id` recebe a chave POSICIONAL — a mesma que o
    // `stageKeyFor` e o export já usam (`stage_${index}`). Deixar o
    // `createStage` inventar um id por timestamp aqui reescrevia a identidade
    // da etapa ao abrir o produto, e todo `stageKey` de subitem que apontava
    // para ela virava órfão no save seguinte: o custo daquela parte caía sem
    // um aviso. Etapa NOVA (criada no formulário) continua nascendo com o id
    // por timestamp — ali o índice não serve, porque remover uma etapa faria a
    // seguinte reusar um id vivo.
    stages: (loadedStages ?? []).map((stage, index) =>
      createStage(index, { ...stage, id: stage.id ?? `stage_${index}` }),
    ),
    accessories: (savedProduct.accessories ?? []).map((accessory, index) =>
      createAccessory(index, accessory),
    ),
    includeFixed: savedProduct.includeFixed,
    fixedCostPerHour: null,
    combineEnabled: null,
    stage2: null,
  };
}

function createSubitem(index: number): Subitem {
  return {
    id: `sub_${Date.now()}_${index}`,
    name: "",
    stageKeys: [],
  };
}

export function usePricingForm() {
  const [product, setProduct] = useState<ProductInput>(() =>
    cloneDefaultProduct(),
  );
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  // TD-022: a versão do documento que este formulário carregou. Fica FORA do
  // `product` de propósito — é metadado do documento, não campo que se edita, e
  // dentro do estado ele viraria mais um campo que o `buildProductPayload`
  // precisa lembrar de tirar (a armadilha FORM-01).
  const [editingProductRev, setEditingProductRev] = useState(0);

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

  // FEAT-01 — subitens vendáveis.
  function setSellBySubitems(on: boolean) {
    setProduct((current) => ({
      ...current,
      sellBySubitems: on,
      // Ao ligar sem nenhum subitem, semeia um para a UI não abrir vazia.
      subitems:
        on && current.subitems.length === 0
          ? [createSubitem(0)]
          : current.subitems,
    }));
  }

  function addSubitem() {
    setProduct((current) => ({
      ...current,
      subitems: [...current.subitems, createSubitem(current.subitems.length)],
    }));
  }

  function removeSubitem(subitemId: string) {
    setProduct((current) => ({
      ...current,
      subitems: current.subitems.filter((s) => s.id !== subitemId),
      // Acessórios que apontavam para o subitem removido voltam ao nível do
      // produto (rateado).
      accessories: current.accessories.map((a) =>
        a.subitemId === subitemId ? { ...a, subitemId: null } : a,
      ),
    }));
  }

  function updateSubitem(subitemId: string, patch: Partial<Subitem>) {
    setProduct((current) => ({
      ...current,
      subitems: current.subitems.map((s) =>
        s.id === subitemId ? { ...s, ...patch } : s,
      ),
    }));
  }

  // Inclui/remove uma etapa num subitem. Uma etapa pertence a NO MÁXIMO um
  // subitem (peça física num grupo só): ao incluir aqui, sai dos outros.
  function toggleStageInSubitem(
    subitemId: string,
    stageKey: string,
    include: boolean,
  ) {
    setProduct((current) => ({
      ...current,
      subitems: current.subitems.map((s) => {
        if (s.id === subitemId) {
          const has = s.stageKeys.includes(stageKey);
          if (include && !has) {
            return { ...s, stageKeys: [...s.stageKeys, stageKey] };
          }
          if (!include && has) {
            return { ...s, stageKeys: s.stageKeys.filter((k) => k !== stageKey) };
          }
          return s;
        }
        if (include && s.stageKeys.includes(stageKey)) {
          return { ...s, stageKeys: s.stageKeys.filter((k) => k !== stageKey) };
        }
        return s;
      }),
    }));
  }

  function resetForm() {
    setEditingProductId(null);
    setEditingProductRev(0);
    setProduct(cloneDefaultProduct());
  }

  function loadProduct(
    savedProduct: SavedProduct,
    setFixedCosts: (patch: Partial<FixedCostSettings>) => void,
  ) {
    setEditingProductId(savedProduct.id);
    setEditingProductRev(savedProduct.rev ?? 0);
    setProduct(buildLoadedProduct(savedProduct));
    setFixedCosts({
      enabled: savedProduct.includeFixed,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return {
    product,
    editingProductId,
    editingProductRev,
    setEditingProductRev,
    // UX-11: "salvar e vender/produzir/orçar" cria o produto e mantém o
    // formulário EDITANDO o recém-criado (em vez de limpar como o botão
    // Salvar), pra quem volta de /producao continuar de onde parou.
    setEditingProductId,
    updateProduct,
    updateStage,
    addStage,
    removeStage,
    updateAccessory,
    addAccessory,
    removeAccessory,
    setSellBySubitems,
    addSubitem,
    removeSubitem,
    updateSubitem,
    toggleStageInSubitem,
    resetForm,
    loadProduct,
  };
}
