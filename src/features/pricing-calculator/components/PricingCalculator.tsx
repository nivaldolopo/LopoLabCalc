"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { errorMessage, guardOnline } from "@/lib/errors";
import { DEFAULT_FIXED_COSTS } from "../constants";
import type {
  CapacitySettings,
  FixedCostRate,
  FixedCostSettings,
  ProductPayload,
  SavedProduct,
} from "../types";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useFees } from "../hooks/useFees";
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
import { buildProductPayload } from "../lib/productPayload";
import { validateProduct } from "../lib/validateProduct";
import { FixedCostsPanel } from "./FixedCostsPanel";
import { Header } from "./Header";
import { MachineManagerModal } from "./MachineManagerModal";
import { MobilePriceBar } from "./MobilePriceBar";
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
  const {
    fixedCostRate,
    saveFixedCostRate,
    error: fixedCostError,
  } = useBusinessSettings();
  // UX-10: exibição da margem líquida no card de preço. Não entra no cálculo.
  const { fees } = useFees();
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
  // UX-11: "Produzir"/"Orçar" saem daqui pras rotas semeadas por id (FEAT-08).
  const router = useRouter();

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
  // TD-010: a capacidade sai da MESMA fonte persistida que rateia o custo fixo
  // (config/negocio), igual ao /catalogo — antes esta página semeava com um
  // literal (1 máquina) e as duas telas mostravam capacidade diferente pro mesmo
  // produto. O override guarda a SIMULAÇÃO local ("e se eu dedicasse 3
  // máquinas?"): não persiste e não toca no preço. Tem que ser override e não
  // `useState(semente)` porque o `fixedCostRate` chega ASSÍNCRONO do Firestore —
  // semear no estado inicial congelaria o default.
  const [capacityOverride, setCapacityOverride] =
    useState<CapacitySettings | null>(null);
  const capacityFromRate = useMemo<CapacitySettings>(
    () => ({
      hoursDay: fixedCostRate.hoursDay,
      machines: fixedCostRate.machines,
      daysMonth: fixedCostRate.daysMonth,
    }),
    [fixedCostRate],
  );
  const capacitySettings = capacityOverride ?? capacityFromRate;
  const [machineModalOpen, setMachineModalOpen] = useState(false);
  // Modal de venda: aberto/fechado + a semente (produto que abriu). Semente null
  // = recibo vazio ("Nova venda"), preenchido só pelo seletor do catálogo.
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleSeed, setSaleSeed] = useState<SaleModalContext | null>(null);
  const [saved, setSaved] = useState(false);
  // AUD-14 [D2] — a calculadora era a única tela que gravava SEM estado de
  // "salvando": o botão continuava dizendo "Salvar" durante o await, e com a
  // rede pendurada (Wi-Fi sem internet) 4 cliques viraram 4 escritas
  // enfileiradas, sem mensagem nenhuma. Um estado só para os 4 caminhos que
  // gravam produto (Salvar, Salvar como novo, e o save embutido de
  // Vender/Produzir/Orçar): é sempre o MESMO documento, então travar um trava
  // todos, que é exatamente o que se quer.
  const [saving, setSaving] = useState(false);
  // Aviso de validação do formulário (inline, no lugar do window.alert).
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edições no produto limpam o aviso de validação — some assim que o usuário
  // começa a corrigir.
  function handleProductChange(patch: Partial<typeof form.product>) {
    if (saveError) setSaveError(null);
    // [FROTA] Fase 2 — o primeiro toque no conjunto de máquinas desliga o
    // acompanhamento automático da frota (ver `machinesTouched`, abaixo). Sem
    // isto, desmarcar uma caixa seria desfeito no render seguinte.
    if (patch.machineIds) setMachinesTouched(true);
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
      // Não se espera o resultado (é a cada tecla): a falha vira o
      // `fixedCostError`, que o painel mostra — TD-029.
      void saveFixedCostRate(ratePatch);
    }
  }

  function applyLoadedFixedCosts(patch: Partial<FixedCostSettings>) {
    // loadProduct só passa o toggle `enabled` do produto.
    setFixedToggles((current) => ({
      enabled: patch.enabled ?? current.enabled,
    }));
  }

  // [FROTA] Fase 2 — a frota viva, para produto/etapa NOVOS nascerem com todas as
  // máquinas marcadas. Não há mais "máquina padrão": o preço é a média da frota,
  // e restringir é a exceção que o dono declara marcando menos.
  const allMachineIds = useMemo(
    () => machines.map((machine) => machine.id),
    [machines],
  );

  function resetFormKeepingFixedCosts() {
    setSaveError(null);
    setMachinesTouched(false);
    form.resetForm(allMachineIds);
    form.updateProduct({
      includeFixed: fixedCosts.enabled,
    });
  }

  // Produto NOVO acompanha a FROTA VIVA até o dono mexer no conjunto.
  //
  // ⚠ Semear UMA VEZ não serve, e o motivo só aparece no navegador: o
  // `useMachines` inicia o estado com os `DEFAULT_MACHINES` (2 máquinas) e só
  // DEPOIS o snapshot do Firestore traz as 3 reais. Uma semeadura de tiro único
  // roda nas duas primeiras, e a terceira — a A1 Mini — nunca era marcada. Medido
  // ao vivo: produto novo abria com A1 e X2D marcadas e a Mini de fora, ou seja
  // com uma restrição que ninguém declarou, e precificado por 2 das 3 impressoras.
  //
  // Por isso o gatilho é "o dono TOCOU no conjunto?", não "já semeei?". Enquanto
  // ele não tocou, o conjunto persegue a lista viva; no primeiro clique numa
  // caixa o acompanhamento para para sempre (naquele produto).
  //
  // Ajuste DURANTE o render — o mesmo padrão do `?load=` acima. Não há laço: o
  // `updateProduct` deixa a condição falsa. E só vale com o formulário LIVRE:
  // produto CARREGADO com conjunto vazio é dado órfão, não estado por preencher,
  // e semear ali apagaria justamente o aviso que a Fase 2 acende.
  const [machinesTouched, setMachinesTouched] = useState(false);
  const conjuntoAtual = form.product.machineIds ?? [];
  if (
    !machinesTouched &&
    !form.editingProductId &&
    machines.length > 0 &&
    (conjuntoAtual.length !== allMachineIds.length ||
      allMachineIds.some((id) => !conjuntoAtual.includes(id)))
  ) {
    form.updateProduct({ machineIds: allMachineIds });
  }

  function buildPayload(includeCreatedAt: boolean): ProductPayload {
    return buildProductPayload(
      form.product,
      fixedCosts.enabled,
      includeCreatedAt,
    );
  }

  // UX-15: offline o Firestore ENFILEIRA a escrita e a Promise nunca resolve
  // (ver `guardOnline`) — o botão ficaria preso em "Salvando…" para sempre. As
  // telas de estoque/produção/venda já barravam isso; a calculadora não. O
  // aviso sai pelo mesmo canal das outras recusas do formulário.
  function blockedOffline(): boolean {
    try {
      guardOnline();
      return false;
    } catch (err) {
      setSaveError(errorMessage(err));
      return true;
    }
  }

  async function saveCurrentProduct() {
    if (saving) return;
    const error = validateProduct({
      ...form.product,
      includeFixed: fixedCosts.enabled,
    });
    if (error) {
      setSaveError(error);
      return;
    }
    setSaveError(null);
    if (blockedOffline()) return;

    // TD-022: a gravação pode ser RECUSADA quando outra aba já salvou este
    // produto — e recusar é o ponto. O formulário fica como está (nada se
    // perde), e a frase do erro diz o que fazer.
    setSaving(true);
    try {
      if (form.editingProductId) {
        await productsApi.updateProduct(
          form.editingProductId,
          buildPayload(false),
          form.editingProductRev,
        );
      } else {
        await productsApi.addProduct(buildPayload(true));
      }
    } catch (err) {
      // O formulário NÃO é limpo aqui: o `withWriteTimeout` desiste da espera,
      // mas a escrita segue enfileirada no SDK. Limpar a tela neste ponto era
      // o que fazia o dono perder o que digitou sem saber se entrou.
      setSaveError(errorMessage(err));
      return;
    } finally {
      setSaving(false);
    }

    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
    resetFormKeepingFixedCosts();
  }

  async function saveAsNewProduct() {
    if (saving) return;
    const error = validateProduct(form.product);
    if (error) {
      setSaveError(error);
      return;
    }
    setSaveError(null);
    if (blockedOffline()) return;
    // AUD-14 [D2]: era a única gravação da tela SEM try/catch — a falha virava
    // rejeição não tratada no console, e o dono via só o botão parado.
    setSaving(true);
    try {
      await productsApi.addProduct(buildPayload(true));
    } catch (err) {
      setSaveError(errorMessage(err));
      return;
    } finally {
      setSaving(false);
    }
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

  async function handleSaveMachines(nextMachines: typeof machines) {
    // TD-020: repassa a falha ao modal, que a mostra em vez de fechar.
    const falha = await saveMachines(nextMachines);
    if (falha) return falha;
    // [FROTA] Fase 2 — máquina REMOVIDA some do conjunto do produto e de cada
    // etapa; o que sobra continua valendo. Antes isto trocava o escalar pelo
    // fallback (a 1ª da lista), o que reprecificava o produto por uma impressora
    // que ninguém escolheu. Esvaziar o conjunto é um resultado possível (removeu
    // a única elegível) e o `validateProduct` avisa na hora de salvar.
    const vivos = new Set(nextMachines.map((machine) => machine.id));
    const filtrar = (ids: string[]) => ids.filter((id) => vivos.has(id));
    const atuais = form.product.machineIds ?? [];
    if (atuais.some((id) => !vivos.has(id))) {
      form.updateProduct({ machineIds: filtrar(atuais) });
    }
    for (const stage of form.product.stages) {
      const daEtapa = stage.machineIds ?? [];
      if (daEtapa.some((id) => !vivos.has(id))) {
        form.updateStage(stage.id ?? "", { machineIds: filtrar(daEtapa) });
      }
    }
    return null;
  }

  // UX-11: as 3 ações de destino (vender/produzir/orçar) precisam de um produto
  // SALVO. Vender sem id até funcionava, mas a reconciliação não acha o produto
  // no catálogo (`missingProduct`) e registra a receita SEM disparar produção,
  // SEM baixa de filamento/insumo e sem horas de máquina no ROI — venda pela
  // metade. Então elas salvam antes, num clique só. Diferente do botão Salvar,
  // aqui o formulário NÃO é limpo: fica editando o produto (recém-criado ou
  // não), pra quem volta de /producao continuar de onde parou.
  async function ensureSavedProductId(): Promise<string | null> {
    if (saving) return null;
    const error = validateProduct({
      ...form.product,
      includeFixed: fixedCosts.enabled,
    });
    if (error) {
      setSaveError(error);
      return null;
    }
    setSaveError(null);
    if (blockedOffline()) return null;

    setSaving(true);
    try {
      if (form.editingProductId) {
        // A versão nova volta e fica guardada: sem isso, este mesmo formulário
        // (que continua editando o produto) bateria contra a versão que ele
        // acabou de gravar no save seguinte.
        const rev = await productsApi.updateProduct(
          form.editingProductId,
          buildPayload(false),
          form.editingProductRev,
        );
        form.setEditingProductRev(rev);
        return form.editingProductId;
      }
      const newId = await productsApi.addProduct(buildPayload(true));
      form.setEditingProductId(newId);
      form.setEditingProductRev(1);
      return newId;
    } catch (err) {
      setSaveError(errorMessage(err));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function openSaleFromForm() {
    const productId = await ensureSavedProductId();
    if (!productId) return;
    setSaleSeed(
      saleContextFromResult(
        form.product.name || form.product.mainStageName || "",
        productId,
        pricingResult,
        totalPrintHours,
        form.product.roundingMode,
      ),
    );
    setSaleOpen(true);
  }

  async function produceFromForm() {
    const productId = await ensureSavedProductId();
    if (!productId) return;
    router.push(`/producao?produto=${productId}`);
  }

  async function quoteFromForm() {
    const productId = await ensureSavedProductId();
    if (!productId) return;
    router.push(`/orcamento?produto=${productId}`);
  }

  return (
    // UX-13b: `has-price-bar` reserva o espaço da barra fixa do celular no
    // padding-bottom. Só a calculadora tem barra — por isso a classe, e não uma
    // regra no `.wrap` global.
    <main className="wrap has-price-bar" id="conteudo">
      <Header theme={theme} status={productsApi.status} onToggleTheme={toggleTheme} />
      {productsApi.error ? <div className="app-error">{productsApi.error}</div> : null}

      <div className="grid">
        <div className="left-column">
          <ProductForm
            product={form.product}
            machines={machines}
            stock={stock}
            supplies={activeSupplies}
            onChange={handleProductChange}
            onManageMachines={() => setMachineModalOpen(true)}
            onAddStage={() => form.addStage(undefined, allMachineIds)}
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
          />
          <FixedCostsPanel
            fixedCosts={fixedCosts}
            summary={fixedSummary}
            fixedCostShare={fixedCostShare}
            onChange={updateFixedCosts}
            saveError={fixedCostError}
          />
        </div>
        <PricingResultCard
          result={pricingResult}
          fixedCosts={fixedCosts}
          fees={fees}
          capacitySettings={capacitySettings}
          capacityResult={capacityResult}
          capacityIsCustom={capacityOverride !== null}
          onCapacityReset={() => setCapacityOverride(null)}
          roundingMode={form.product.roundingMode}
          printHours={totalPrintHours}
          onRoundingModeChange={(mode) =>
            form.updateProduct({ roundingMode: mode })
          }
          onCapacityChange={(patch) =>
            setCapacityOverride({ ...capacitySettings, ...patch })
          }
          canSave={form.product.name.trim().length > 0}
          editingProductId={form.editingProductId}
          saved={saved}
          saving={saving}
          saveError={saveError}
          onSave={saveCurrentProduct}
          onSaveAsNew={saveAsNewProduct}
          onCancelEdit={resetFormKeepingFixedCosts}
          onRegisterSale={openSaleFromForm}
          onProduce={produceFromForm}
          onQuote={quoteFromForm}
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

      {/* UX-13b: só aparece no celular (CSS). Último filho do .wrap de
          propósito — é `position: fixed`, então não entra na conta do fluxo. */}
      <MobilePriceBar result={pricingResult} markup={form.product.markup} />
    </main>
  );
}
