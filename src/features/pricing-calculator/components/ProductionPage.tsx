"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Factory, Plus, Trash2 } from "lucide-react";
import { errorMessage, guardOnline } from "@/lib/errors";
import { formatCurrency } from "@/lib/formatting/currency";
import {
  formatDate,
  toTimestamp,
  todayInputValue,
} from "@/lib/formatting/date";
import { num } from "@/lib/number";
import {
  newProductionId,
  type FinishedUpdate,
  type ProductionQuery,
} from "@/lib/firebase/productionRepository";
import { matchesQuery } from "@/lib/text";
import { DEFAULT_FIXED_COSTS, DEFAULT_PRODUCT_INPUT } from "../constants";
import { calculatePricing } from "../lib/calculatePricing";
import { filamentTotalG } from "../lib/filaments";
import {
  addProductionLayers,
  removeEventLayers,
  submissionEntries,
} from "../lib/finishedGoods";
import { reverseProduction, reverseSupplies } from "../lib/production";
import {
  buildProductionPayloads,
  nextRowKey,
  planEventRows,
  scaleRow,
  subitemEventRows,
  submissionColors,
  wholeEventRows,
  type EventRow,
  type FilRow,
} from "../lib/productionPlan";
import { catalogPricePerKg, filamentLabel } from "../lib/stock";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useFinishedGoods } from "../hooks/useFinishedGoods";
import { useMachines } from "../hooks/useMachines";
import { useProducts } from "../hooks/useProducts";
import { useProductionPage } from "../hooks/useProductionPage";
import { useStock } from "../hooks/useStock";
import { useSupplies } from "../hooks/useSupplies";
import { useTheme } from "../hooks/useTheme";
import type {
  FixedCostSettings,
  ProductionEvent,
  ProductionMode,
  ProductionOutcome,
} from "../types";
import { useConfirm } from "./ConfirmDialog";
import { CostBreakdownTable, CostDetail } from "./CostDetail";
import { FeedbackNote, useFeedback } from "./FeedbackNote";
import { HistoryFilterBar } from "./HistoryFilterBar";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { PageIntro } from "./PageIntro";
import { NumberInput } from "./NumberInput";
import { PrintTimeField } from "./ProductForm";

const OUTCOMES: { value: ProductionOutcome; label: string }[] = [
  { value: "estoque", label: "Peça pro estoque" },
  { value: "encomenda", label: "Encomenda" },
  { value: "teste", label: "Teste / calibração" },
  { value: "falha", label: "Falha" },
  { value: "brinde", label: "Brinde / uso interno" },
  { value: "historico", label: "Histórico (backfill)" },
];
const outcomeLabel = (value: ProductionOutcome) =>
  OUTCOMES.find((o) => o.value === value)?.label ?? value;

function grams(value: number): string {
  return `${Math.round(num(value))} g`;
}

export function ProductionPage() {
  const fieldId = useId();
  const { theme, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  const { products } = useProducts();
  const { machines } = useMachines();
  const { filaments: stock } = useStock();
  // 7e: insumos para a baixa dos acessórios ligados (o avulso segue só no custo).
  const { supplies } = useSupplies();
  const { fixedCostRate } = useBusinessSettings();
  // O custo fixo NÃO entra no frozenCost da produção — só uso o `calculatePricing`
  // pelos subitens/consumo, e nada que eu leio depende do fixo. `enabled: false`.
  const fixedCosts = useMemo<FixedCostSettings>(
    () => ({ ...fixedCostRate, enabled: DEFAULT_FIXED_COSTS.enabled }),
    [fixedCostRate],
  );
  // TD-006 Fase 3: filtro server-side (produto + período) + refino por nome.
  const [filterProductId, setFilterProductId] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const productionFilter = useMemo<ProductionQuery>(
    () => ({
      productId: filterProductId || null,
      start: filterStart ? toTimestamp(filterStart) : null,
      end: filterEnd ? toTimestamp(filterEnd) : null,
    }),
    [filterProductId, filterStart, filterEnd],
  );
  const {
    events,
    totalCount,
    hasMore,
    loadMore,
    status,
    error,
    addProduction,
    deleteProduction,
  } = useProductionPage(productionFilter);
  // Leitura viva dos acabados: a submissão empilha camada no doc do produto e a
  // exclusão a estorna (FEAT-05b). O incremento/estorno grava no batch do evento.
  const { goods } = useFinishedGoods();

  const [selectedKey, setSelectedKey] = useState("");
  // UX-06: qual produção recente está com o detalhe aberto (linha + dropdown).
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [rows, setRows] = useState<EventRow[]>([]);
  // BUG-02: uma submissão pode ser P PLACAS de uma vez (o quiosque imprime a mesa
  // cheia). Escala filamento/horas e os acabados; default 1.
  const [plates, setPlates] = useState(1);
  const [outcome, setOutcome] = useState<ProductionOutcome>("estoque");
  const [mode, setMode] = useState<ProductionMode>("real");
  const [dateStr, setDateStr] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { note, ok, fail, clear } = useFeedback();
  const { ask, dialog } = useConfirm();

  // Precificação viva por produto — de onde saem os subitens e o consumo default.
  const pricingByProduct = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculatePricing>>();
    for (const product of products) {
      map.set(product.id, calculatePricing(product, machines, fixedCosts, stock));
    }
    return map;
  }, [products, machines, fixedCosts, stock]);

  // Opções do seletor: produto inteiro + cada subitem vendável + "Avulso".
  const options = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    const sorted = [...products].sort((a, b) =>
      (a.name || a.mainStageName || "").localeCompare(
        b.name || b.mainStageName || "",
        "pt-BR",
      ),
    );
    for (const product of sorted) {
      const base = product.name || product.mainStageName || "(sem nome)";
      list.push({ key: `whole:${product.id}`, label: base });
      const subitems = pricingByProduct.get(product.id)?.subitems ?? [];
      for (const sub of subitems) {
        list.push({
          key: `sub:${product.id}:${sub.id}`,
          label: `${base} — ${sub.name || "subitem"}`,
        });
      }
    }
    return list;
  }, [products, pricingByProduct]);

  // Linha avulsa (sem produto): a única montada aqui — as de produto/subitem vêm
  // do builder compartilhado (`productionPlan`), que a encomenda do passo 8 reusa.
  function avulsoRow(): EventRow {
    return {
      key: nextRowKey(),
      productName: "",
      machineId: machines[0]?.id ?? "",
      printHours: 0,
      filaments: [
        {
          filamentId: null,
          label: "",
          colorName: "",
          totalG: 0,
          pricePerKg: DEFAULT_PRODUCT_INPUT.filamentPricePerKg ?? 110,
          stageKey: "",
        },
      ],
      laborCost: 0,
      energyTariff: DEFAULT_PRODUCT_INPUT.energyTariff ?? 0,
      // Impressão avulsa não tem produto, logo não tem acessório para dar baixa.
      supplies: [],
    };
  }

  function selectOption(key: string) {
    setSelectedKey(key);
    clear();
    setPlates(1);
    if (key === "avulso") {
      setRows([avulsoRow()]);
      return;
    }
    if (key.startsWith("whole:")) {
      const product = products.find((p) => p.id === key.slice("whole:".length));
      setRows(product ? wholeEventRows(product, machines, stock) : []);
      return;
    }
    if (key.startsWith("sub:")) {
      const [, productId, subitemId] = key.split(":");
      const product = products.find((p) => p.id === productId);
      const sub = pricingByProduct
        .get(productId ?? "")
        ?.subitems?.find((s) => s.id === subitemId);
      setRows(product && sub ? subitemEventRows(product, sub, stock) : []);
      return;
    }
    setRows([]);
  }

  // FEAT-08: "Produzir" no catálogo manda pra cá com `?produto=&subitem=`. Os
  // produtos chegam por assinatura, então só dá pra semear quando a lista popular
  // — ajuste DURANTE o render (padrão do FEAT-07), não efeito. O `handledSeed`
  // marca o par já consumido pra que snapshots seguintes do Firestore não
  // resetem as linhas por cima do que o dono já editou.
  const seedProductId = searchParams.get("produto");
  const seedSubitemId = searchParams.get("subitem");
  const seedToken = seedProductId ? `${seedProductId}:${seedSubitemId ?? ""}` : null;
  const [handledSeed, setHandledSeed] = useState<string | null>(null);
  if (seedToken && handledSeed !== seedToken && products.length > 0) {
    const product = products.find((item) => item.id === seedProductId);
    // Subitem removido do produto entre o clique e o load: ignora em silêncio.
    // Cair pro produto inteiro sem o dono pedir seria pior — produção grava
    // estoque.
    const subitemOk =
      !seedSubitemId ||
      Boolean(
        pricingByProduct
          .get(product?.id ?? "")
          ?.subitems?.some((sub) => sub.id === seedSubitemId),
      );
    setHandledSeed(seedToken);
    if (product && subitemOk) {
      selectOption(
        seedSubitemId
          ? `sub:${product.id}:${seedSubitemId}`
          : `whole:${product.id}`,
      );
    }
  }

  // Some com a query depois de consumida: recarregar não deve semear de novo.
  // Sync com history (sem setState) — por isso vive no efeito.
  useEffect(() => {
    if (handledSeed) window.history.replaceState(null, "", "/producao");
  }, [handledSeed]);

  function updateRow(key: string, patch: Partial<EventRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function updateFil(rowKeyId: string, index: number, patch: Partial<FilRow>) {
    setRows((current) =>
      current.map((row) =>
        row.key === rowKeyId
          ? {
              ...row,
              filaments: row.filaments.map((f, i) =>
                i === index ? { ...f, ...patch } : f,
              ),
            }
          : row,
      ),
    );
  }

  function setFilColor(rowKeyId: string, index: number, filamentId: string) {
    const color = stock.find((c) => c.id === filamentId);
    updateFil(rowKeyId, index, {
      filamentId: color ? color.id : null,
      label: color ? filamentLabel(color) : "",
      colorName: color ? color.colorName : "",
      pricePerKg: color
        ? catalogPricePerKg(color) || DEFAULT_PRODUCT_INPUT.filamentPricePerKg || 110
        : DEFAULT_PRODUCT_INPUT.filamentPricePerKg ?? 110,
    });
  }

  function addFil(rowKeyId: string) {
    setRows((current) =>
      current.map((row) =>
        row.key === rowKeyId
          ? {
              ...row,
              filaments: [
                ...row.filaments,
                {
                  filamentId: null,
                  label: "",
                  colorName: "",
                  totalG: 0,
                  pricePerKg: DEFAULT_PRODUCT_INPUT.filamentPricePerKg ?? 110,
                  stageKey: "",
                },
              ],
            }
          : row,
      ),
    );
  }

  function removeFil(rowKeyId: string, index: number) {
    setRows((current) =>
      current.map((row) =>
        row.key === rowKeyId && row.filaments.length > 1
          ? { ...row, filaments: row.filaments.filter((_, i) => i !== index) }
          : row,
      ),
    );
  }

  // Planeja as linhas via builder compartilhado (baixa FIFO encadeada + custo
  // congelado). `genId` gera o id de cada evento (real ao salvar; fixo no preview).
  // BUG-02: escala as linhas (placa inteira) por `plates` antes de planejar → o
  // filamento/horas deduzidos e exibidos = P placas.
  const planEvents = (genId: () => string) =>
    planEventRows(
      rows.map((row) => scaleRow(row, Math.max(1, plates))),
      mode,
      stock,
      supplies,
      machines,
      genId,
    );

  // 7e: os insumos da submissão inteira (já escalados por peças × placas). Vêm do
  // produto, não são editáveis aqui — quem muda a receita é a calculadora.
  const plannedSupplies = useMemo(
    () => rows.flatMap((row) => row.supplies.map((s) => ({ ...s, qty: s.qty * Math.max(1, plates) }))),
    [rows, plates],
  );

  // Preview ao vivo (não grava): usa um id fixo — o itemId não importa aqui.
  const preview = useMemo(
    () => planEvents(() => "preview"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, plates, mode, stock, supplies, machines],
  );

  // Delta do acabado da submissão (FEAT-05b). Só quando o desfecho é `estoque` e
  // há produto (avulso não vira acabado). O custo é a soma do `frozenCost` de todos
  // os eventos (dedup multi-máquina). As camadas são ancoradas no PRIMEIRO evento
  // (`built[0].id`) — excluir aquele card estorna o acabado inteiro da submissão;
  // cards de máquina secundária só estornam filamento.
  // BUG-02: a submissão gera `units = piecesCount × placas` unidades (mesa de N
  // peças × P placas), não 1 — cada acabado a `custo ÷ units`.
  // FEAT-06: recebe o `summary` inteiro (não só o total) para que a composição
  // congelada desça junto até a camada do acabado.
  function finishedForSave(
    built: ReturnType<typeof planEvents>["built"],
    summary: ReturnType<typeof planEvents>["summary"],
    at: number,
  ): FinishedUpdate | null {
    if (outcome !== "estoque" || built.length === 0) return null;

    let productId: string | undefined;
    let subitemId: string | undefined;
    if (selectedKey.startsWith("whole:")) {
      productId = selectedKey.slice("whole:".length);
    } else if (selectedKey.startsWith("sub:")) {
      [, productId, subitemId] = selectedKey.split(":");
    }
    if (!productId) return null; // avulso

    const product = products.find((p) => p.id === productId);
    if (!product) return null;
    const name = product.name || product.mainStageName || "(sem nome)";
    const subitems = pricingByProduct.get(productId)?.subitems ?? [];
    const pieces = Math.max(1, num(product.piecesCount) || 1);
    const units = pieces * Math.max(1, plates);

    // FEAT-11: as cores COMO ESTÃO na tela (já com as trocas). No inteiro com
    // partes, cada subitem recebe a cor das SUAS etapas — é o que credita
    // corpo=Azul e tampa=Vermelho num evento só, em vez de carimbar a mistura
    // nas duas SKUs. As linhas aqui não estão escaladas por placas, e nem
    // precisam: escala não muda cor.
    const colors = submissionColors(
      rows,
      !subitemId ? (product.subitems ?? []) : [],
    );

    const entries = submissionEntries(name, summary.frozen, {
      subitemId,
      subitemName: subitems.find((s) => s.id === subitemId)?.name,
      color: colors.whole,
      subitems:
        !subitemId && subitems.length > 0
          ? subitems.map((s) => ({
              id: s.id,
              name: s.name,
              cost: s.cost,
              color: colors.bySubitem.get(s.id),
            }))
          : undefined,
      units,
      breakdown: summary.frozenBreakdown,
    });

    const good = goods.find((g) => g.id === productId) ?? null;
    const payload = addProductionLayers(
      good,
      productId,
      name,
      entries,
      built[0].id,
      at,
    );
    return { productId, payload };
  }

  // Estorno do acabado ao excluir um evento (FEAT-05b): só quando aquele evento
  // criou camadas (é o PRIMEIRO da sua submissão). Devolve o doc já sem elas.
  function finishedForRemove(event: ProductionEvent): FinishedUpdate | null {
    if (event.outcome !== "estoque" || !event.productId) return null;
    const good = goods.find((g) => g.id === event.productId);
    if (!good) return null;
    const created = good.skus.some((sku) =>
      sku.layers.some((layer) => layer.sourceEventId === event.id),
    );
    if (!created) return null;
    const reverted = removeEventLayers(good, event.id);
    return {
      productId: good.productId,
      payload: {
        productId: good.productId,
        productName: good.productName,
        skus: reverted.skus,
        createdAt: good.createdAt,
      },
    };
  }

  async function save() {
    if (rows.length === 0) {
      fail("Escolha o que foi impresso.");
      return;
    }
    for (const row of rows) {
      if (!row.productName.trim()) {
        fail("Dê um nome à impressão.");
        return;
      }
      if (num(row.printHours) <= 0) {
        fail(
          `Informe o tempo de impressão de “${row.productName || "impressão"}”.`,
        );
        return;
      }
    }

    try {
      guardOnline();
    } catch (err) {
      fail(errorMessage(err));
      return;
    }

    setSaving(true);
    clear();
    const now = Date.now();
    const at = toTimestamp(dateStr);
    const planned = planEvents(newProductionId);

    const entries = buildProductionPayloads(planned.built, {
      at,
      outcome,
      mode,
      notes,
      createdAt: now,
    });

    const finished = finishedForSave(planned.built, planned.summary, at);

    try {
      await addProduction(
        entries,
        planned.colorUpdates,
        finished,
        planned.supplyUpdates,
      );
      ok(
        entries.length > 1
          ? `${entries.length} produções registradas.`
          : "Produção registrada.",
      );
      setSelectedKey("");
      setRows([]);
      setPlates(1);
      setNotes("");
    } catch (err) {
      fail(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(event: ProductionEvent) {
    const confirmed = await ask({
      title: `Excluir a produção “${event.productName || "impressão"}”?`,
      body: (
        <>
          {event.stockMoves.length > 0 ? (
            <p className="confirm-safe">
              O filamento e os insumos deduzidos <strong>voltam</strong> pro
              estoque, e as peças acabadas que esta produção creditou saem.
            </p>
          ) : null}
          <p>
            As horas dela também somem do ROI da máquina. Isso não pode ser
            desfeito.
          </p>
        </>
      ),
      confirmLabel: "Excluir produção",
      danger: true,
    });
    if (!confirmed) return;
    try {
      guardOnline();
      const colorUpdates = reverseProduction(event.stockMoves, stock);
      const supplyUpdates = reverseSupplies(event.stockMoves, supplies);
      await deleteProduction(
        event.id,
        colorUpdates,
        finishedForRemove(event),
        supplyUpdates,
      );
      ok("Produção excluída e estoque estornado.");
    } catch (err) {
      fail(errorMessage(err));
    }
  }

  const recent = useMemo(
    () => [...events].sort((a, b) => b.at - a.at),
    [events],
  );

  // Opções do seletor de produto do filtro (catálogo atual, por nome).
  const filterProductOptions = useMemo(
    () =>
      [...products]
        .map((product) => ({
          id: product.id,
          name: product.name || product.mainStageName || "(sem nome)",
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [products],
  );

  // Refino por nome (client-side sobre a janela já filtrada no banco): casa por
  // nome da impressão ou observações.
  const visibleEvents = useMemo(() => {
    if (!nameQuery.trim()) return recent;
    return recent.filter((event) =>
      matchesQuery(nameQuery, event.productName, event.notes ?? ""),
    );
  }, [recent, nameQuery]);

  const hasServerFilter =
    filterProductId !== "" || filterStart !== "" || filterEnd !== "";

  // BUG-02: peças por placa do produto selecionado (mesa de N), para escalar o
  // acabado e mostrar quantas unidades saem. Avulso/sem produto = 1.
  const selectedPieces = useMemo(() => {
    let productId: string | undefined;
    if (selectedKey.startsWith("whole:")) {
      productId = selectedKey.slice("whole:".length);
    } else if (selectedKey.startsWith("sub:")) {
      productId = selectedKey.split(":")[1];
    }
    const product = productId
      ? products.find((p) => p.id === productId)
      : undefined;
    return product ? Math.max(1, num(product.piecesCount) || 1) : 1;
  }, [selectedKey, products]);

  const finishedUnits = selectedPieces * Math.max(1, plates);
  const isProductSelected = Boolean(selectedKey) && selectedKey !== "avulso";

  // FEAT-11 — o que a troca de cor custou, por linha. A baixa FIFO e o custo real
  // já seguem a cor escolhida; o PREÇO do produto, não (ele veio do cadastro).
  // Sem este aviso o efeito só apareceria depois, congelado na venda.
  function swapOf(fil: FilRow): { deltaKg: number; perPiece: number } | null {
    if (!fil.origin || fil.filamentId === fil.origin.filamentId) return null;
    const deltaKg = num(fil.pricePerKg) - num(fil.origin.pricePerKg);
    const submission = ((num(fil.totalG) * Math.max(1, plates)) / 1000) * deltaKg;
    return { deltaKg, perPiece: submission / Math.max(1, finishedUnits) };
  }

  // O efeito somado de TODAS as trocas, por peça — e a margem que sobra com ele.
  const swapImpact = useMemo(() => {
    const perPiece = rows.reduce(
      (sum, row) =>
        sum +
        row.filaments.reduce((s, fil) => {
          if (!fil.origin || fil.filamentId === fil.origin.filamentId) return s;
          const deltaKg = num(fil.pricePerKg) - num(fil.origin.pricePerKg);
          return s + ((num(fil.totalG) * Math.max(1, plates)) / 1000) * deltaKg;
        }, 0),
      0,
    );
    return perPiece / Math.max(1, finishedUnits);
  }, [rows, plates, finishedUnits]);

  // Preço e margem PRECIFICADOS do que está selecionado (produto inteiro ou
  // subitem), para o aviso dizer de quanto para quanto a margem foi.
  const selectedPricing = useMemo((): { price: number; margin: number } | null => {
    if (selectedKey.startsWith("whole:")) {
      const result = pricingByProduct.get(selectedKey.slice("whole:".length));
      if (!result || result.suggestedPrice <= 0) return null;
      return { price: result.suggestedPrice, margin: result.margin };
    }
    if (selectedKey.startsWith("sub:")) {
      const [, productId, subitemId] = selectedKey.split(":");
      const sub = pricingByProduct
        .get(productId)
        ?.subitems?.find((s) => s.id === subitemId);
      if (!sub || sub.price <= 0) return null;
      return { price: sub.price, margin: ((sub.price - sub.cost) / sub.price) * 100 };
    }
    return null;
  }, [selectedKey, pricingByProduct]);

  const canSave = rows.length > 0 && !saving;

  return (
    <main className="wrap">
      <PageHeader
        icon={<Factory size={18} />}
        title="Produção"
        meta="Registro de impressão — Lopo Lab"
        status={status}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <NavBar />

      {error ? <div className="app-error">{error}</div> : null}

      <PageIntro>
        Registre TODA impressão — vire venda ou não. É daqui que sai a baixa de
        filamento e as horas de máquina. Teste, falha e brinde também contam.
      </PageIntro>

      <div className="prod-form">
        <div className="field-block">
          <label className="section-label" htmlFor={`${fieldId}-what`}>
            O que foi impresso?
          </label>
          <select
            id={`${fieldId}-what`}
            className="field-input"
            value={selectedKey}
            onChange={(event) => selectOption(event.target.value)}
          >
            <option value="">Escolha um produto, subitem ou avulso…</option>
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
            <option value="avulso">Avulso / sem produto</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="prod-empty">
            Escolha acima para começar. Cada peça/subitem vira um registro; um
            produto inteiro que roda em máquinas diferentes gera um registro por
            máquina.
          </div>
        ) : null}

        {rows.map((row) => {
          const isAvulso = !row.productId && !row.subitemId;
          const rowId = `${fieldId}-${row.key}`;
          return (
            <div className="prod-event" key={row.key}>
              <div className="field-block compact">
                <label className="section-label" htmlFor={`${rowId}-name`}>
                  Nome da impressão
                </label>
                <input
                  id={`${rowId}-name`}
                  className="field-input"
                  type="text"
                  value={row.productName}
                  onChange={(event) =>
                    updateRow(row.key, { productName: event.target.value })
                  }
                  placeholder="Ex.: Vaso espiral"
                />
              </div>

              <div className="two-col">
                <div className="field-block compact">
                  <label className="section-label" htmlFor={`${rowId}-machine`}>
                    Máquina
                  </label>
                  <select
                    id={`${rowId}-machine`}
                    className="field-input"
                    value={row.machineId}
                    onChange={(event) =>
                      updateRow(row.key, { machineId: event.target.value })
                    }
                  >
                    {machines.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-block compact">
                  <PrintTimeField
                    label="⏱ Tempo"
                    value={row.printHours}
                    onChange={(printHours) =>
                      updateRow(row.key, { printHours })
                    }
                  />
                </div>
              </div>

              {/* UX-16: rotula a LISTA de cores (N linhas), não um campo — segue
                  <div>, e cada controle da linha ganha o próprio `aria-label`
                  (antes nenhum deles tinha nome). */}
              <div className="section-label">Filamento</div>
              {/* FEAT-11: o seletor de cor vale para QUALQUER linha — a mesma peça
                  é impressa em outra cor o tempo todo, e antes disso só dava para
                  trocar editando o produto no catálogo. O produto não muda: a cor
                  da vez vale para este evento, e custo/baixa/frozenCost seguem a
                  cor efetivamente escolhida. "Avulso (livre)" segue disponível
                  (decisão do dono) para filamento que não está no Estoque. */}
              {row.filaments.map((fil, index) => {
                const swap = swapOf(fil);
                return (
                <div className="prod-fil-wrap" key={index}>
                <div className="prod-fil">
                  <select
                    className="field-input"
                    aria-label="Cor do filamento"
                    value={fil.filamentId ?? ""}
                    onChange={(event) =>
                      setFilColor(row.key, index, event.target.value)
                    }
                  >
                    <option value="">Avulso (livre)</option>
                    {stock
                      .filter((c) => !c.archived)
                      .map((color) => (
                        <option key={color.id} value={color.id}>
                          {filamentLabel(color)}
                        </option>
                      ))}
                  </select>
                  {!fil.filamentId ? (
                    <input
                      className="field-input prod-fil-free"
                      type="text"
                      aria-label="Nome da cor avulsa"
                      value={fil.colorName}
                      onChange={(event) =>
                        updateFil(row.key, index, {
                          colorName: event.target.value,
                        })
                      }
                      placeholder="Cor (livre)"
                    />
                  ) : null}
                  <div className="prod-fil-g">
                    <NumberInput
                      className="field-input"
                      aria-label="Gramas usadas"
                      min={0}
                      value={fil.totalG}
                      onChange={(totalG) =>
                        updateFil(row.key, index, { totalG })
                      }
                    />
                    <span className="prod-unit">g</span>
                  </div>
                  {!fil.filamentId ? (
                    <div className="prod-fil-price">
                      <NumberInput
                        className="field-input"
                        aria-label="Preço por kg"
                        min={0}
                        step="0.01"
                        value={fil.pricePerKg}
                        onChange={(pricePerKg) =>
                          updateFil(row.key, index, { pricePerKg })
                        }
                      />
                      <span className="prod-unit">/kg</span>
                    </div>
                  ) : null}
                  {isAvulso && row.filaments.length > 1 ? (
                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={() => removeFil(row.key, index)}
                      title="Remover cor"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
                {swap ? (
                  <div
                    className={`prod-fil-swap ${swap.perPiece > 0 ? "up" : swap.perPiece < 0 ? "down" : ""}`}
                  >
                    Trocou <strong>{fil.origin!.label}</strong> por{" "}
                    <strong>{fil.label || fil.colorName || "avulso"}</strong>:{" "}
                    {formatCurrency(fil.pricePerKg)}/kg vs.{" "}
                    {formatCurrency(fil.origin!.pricePerKg)}/kg do cadastro
                    {Math.abs(swap.perPiece) >= 0.005 ? (
                      <>
                        {" → "}
                        <strong>
                          {swap.perPiece > 0 ? "+" : "−"}
                          {formatCurrency(Math.abs(swap.perPiece))}
                        </strong>{" "}
                        por peça
                      </>
                    ) : (
                      " — mesmo custo"
                    )}
                  </div>
                ) : null}
                </div>
                );
              })}
              {isAvulso ? (
                <button
                  className="link-button prod-add-fil"
                  type="button"
                  onClick={() => addFil(row.key)}
                >
                  <Plus size={14} /> Outra cor
                </button>
              ) : null}
            </div>
          );
        })}

        {rows.length > 0 ? (
          <>
            <div className="field-block compact">
              <label className="section-label" htmlFor={`${fieldId}-plates`}>
                Quantas placas{" "}
                <span className="label-hint">(tiragem desta impressão)</span>
              </label>
              <NumberInput
                id={`${fieldId}-plates`}
                className="field-input"
                min={1}
                step="1"
                value={plates}
                onChange={(value) => setPlates(Math.max(1, Math.round(value)))}
              />
              {isProductSelected && selectedPieces > 1 ? (
                <div className="prod-note prod-plates-hint">
                  Este produto sai <strong>{selectedPieces} por impressão</strong>{" "}
                  (mesa de {selectedPieces}) → esta tiragem produz{" "}
                  <strong>
                    {finishedUnits} {finishedUnits === 1 ? "peça" : "peças"}
                  </strong>
                  . Pra fazer menos, ajuste o &ldquo;peças por impressão&rdquo; do
                  produto na calculadora.
                </div>
              ) : null}
            </div>

            <div className="two-col">
              <div className="field-block compact">
                <label className="section-label" htmlFor={`${fieldId}-outcome`}>
                  Desfecho
                </label>
                <select
                  id={`${fieldId}-outcome`}
                  className="field-input"
                  value={outcome}
                  onChange={(event) => {
                    const next = event.target.value as ProductionOutcome;
                    setOutcome(next);
                    if (next === "historico") setMode("historico");
                  }}
                >
                  {OUTCOMES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-block compact">
                <label className="section-label" htmlFor={`${fieldId}-mode`}>
                  Modo
                </label>
                <select
                  id={`${fieldId}-mode`}
                  className="field-input"
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as ProductionMode)
                  }
                >
                  <option value="real">Real (deduz do estoque)</option>
                  <option value="historico">Histórico (não deduz)</option>
                </select>
              </div>
            </div>

            <div className="two-col">
              <div className="field-block compact">
                <label className="section-label" htmlFor={`${fieldId}-date`}>
                  Data
                </label>
                <input
                  id={`${fieldId}-date`}
                  className="field-input"
                  type="date"
                  value={dateStr}
                  onChange={(event) => setDateStr(event.target.value)}
                />
              </div>
              <div className="field-block compact">
                <label className="section-label" htmlFor={`${fieldId}-notes`}>
                  Observações <span className="label-hint">(opcional)</span>
                </label>
                <input
                  id={`${fieldId}-notes`}
                  className="field-input"
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Detalhes da impressão"
                />
              </div>
            </div>

            <div className="prod-summary">
              <div className="prod-summary-line">
                <span>
                  {preview.built.length > 1
                    ? `${preview.built.length} registros`
                    : "1 registro"}{" "}
                  · {grams(preview.summary.grams)}
                </span>
                {/* FEAT-06: o número já existia aqui, mas sem dizer QUE custo é
                    nem de que é feito. Agora é rotulado e detalhável — mesma
                    composição que a venda mostra como "custo real". */}
                <CostDetail
                  real={preview.summary.frozenBreakdown}
                  realCogs={preview.summary.frozen}
                  triggerLabel="custo real gasto"
                  hint="· composição ▾"
                />
              </div>
              {/* FEAT-11: o efeito somado das trocas de cor na margem. O preço do
                  produto NÃO muda com a cor (ele vem do cadastro), então uma cor
                  mais cara sai da margem — e é melhor ver isso agora do que
                  descobrir depois, congelado na venda. */}
              {Math.abs(swapImpact) >= 0.005 ? (
                <div className={`prod-warn ${swapImpact > 0 ? "info" : ""}`}>
                  Cor trocada:{" "}
                  <strong>
                    {swapImpact > 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(swapImpact))}
                  </strong>{" "}
                  por peça no custo real. O preço do produto não muda
                  {selectedPricing ? (
                    <>
                      {" "}
                      — a margem desta produção fica em{" "}
                      <strong>
                        {(
                          selectedPricing.margin -
                          (swapImpact / selectedPricing.price) * 100
                        ).toFixed(1)}
                        %
                      </strong>{" "}
                      (precificada {selectedPricing.margin.toFixed(1)}%)
                    </>
                  ) : null}
                  .
                </div>
              ) : null}
              {mode === "historico" ? (
                <div className="prod-note">
                  Modo histórico: registra horas e gramas, mas <strong>não</strong>{" "}
                  deduz rolo (custo pelo preço informado).
                </div>
              ) : (
                <>
                  {preview.summary.crossesRoll ? (
                    <div className="prod-warn info">
                      Vai atravessar pro próximo rolo em alguma cor — custo misto
                      (na A1 sem AMS, é troca manual no meio da impressão).
                    </div>
                  ) : null}
                  {preview.summary.shortfallG > 0 ? (
                    <div className="prod-warn strong">
                      Passa {grams(preview.summary.shortfallG)} do estoque total —
                      o saldo da cor fica negativo (contagem furada?).
                    </div>
                  ) : null}
                  {preview.summary.supplyShortfall > 0 ? (
                    <div className="prod-warn strong">
                      Faltam {Math.round(preview.summary.supplyShortfall)}{" "}
                      unidade(s) de insumo no estoque — o saldo fica negativo
                      (comprou e não lançou?).
                    </div>
                  ) : null}
                </>
              )}
              {plannedSupplies.length > 0 ? (
                <div className="prod-note">
                  Insumos desta impressão:{" "}
                  {plannedSupplies
                    .map((s) => `${Math.round(s.qty)}× ${s.name}`)
                    .join(", ")}{" "}
                  ({formatCurrency(preview.summary.supplies)}
                  {mode === "real" ? ", baixa automática" : ""}).
                </div>
              ) : null}
              {outcome === "estoque" && isProductSelected ? (
                <div className="prod-note">
                  → Entra no <strong>Estoque de Produtos</strong>:{" "}
                  <strong>
                    {finishedUnits} {finishedUnits === 1 ? "peça" : "peças"}
                  </strong>{" "}
                  {selectedPieces > 1
                    ? `(mesa de ${selectedPieces} × ${Math.max(1, plates)} placa${
                        Math.max(1, plates) === 1 ? "" : "s"
                      })`
                    : null}{" "}
                  com o custo desta impressão.
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        <FeedbackNote note={note} onClose={clear} />

        <div className="modal-actions">
          <button
            className="btn primary"
            type="button"
            onClick={save}
            disabled={!canSave}
          >
            {saving
              ? "Registrando..."
              : preview.built.length > 1
                ? `Registrar (${preview.built.length})`
                : "Registrar produção"}
          </button>
        </div>
      </div>

      <div className="section-label prod-recent-label">
        Produções recentes{" "}
        {totalCount > 0 ? `(${visibleEvents.length} de ${totalCount})` : ""}
      </div>

      <HistoryFilterBar
        products={filterProductOptions}
        productId={filterProductId}
        onProductId={setFilterProductId}
        startStr={filterStart}
        onStart={setFilterStart}
        endStr={filterEnd}
        onEnd={setFilterEnd}
        name={nameQuery}
        onName={setNameQuery}
        namePlaceholder="Refinar por nome…"
        resultCount={visibleEvents.length}
      />

      {visibleEvents.length === 0 ? (
        <div className="sales-empty">
          {hasServerFilter || nameQuery.trim()
            ? "Nenhuma produção para esse filtro."
            : "Nenhuma produção registrada ainda."}
        </div>
      ) : (
        <>
        <div className="prod-list">
          {visibleEvents.map((event) => {
            const totalG = event.filaments.reduce(
              (sum, f) => sum + filamentTotalG(f),
              0,
            );
            const hoursLabel = num(event.printHours).toLocaleString("pt-BR", {
              maximumFractionDigits: 2,
            });
            const isOpen = openEventId === event.id;
            return (
              <div
                className={`prod-card ${isOpen ? "open" : ""}`}
                key={event.id}
              >
                {/* UX-06: a linha vira gatilho do detalhe; o dropdown abaixo
                    absorve o antigo popover de custo (CostBreakdownTable). */}
                <div
                  className="prod-card-head"
                  onClick={() =>
                    setOpenEventId((current) =>
                      current === event.id ? null : event.id,
                    )
                  }
                >
                  <div className="prod-card-main">
                    <strong>
                      <span className="arrow-icon">▼</span>
                      {event.productName || "(sem nome)"}
                    </strong>
                    <span className="prod-card-sub">
                      {formatDate(event.at)} · {event.machineName || "—"} ·{" "}
                      {hoursLabel} h · {grams(totalG)}
                    </span>
                  </div>
                  <div className="prod-card-side">
                    <span className={`prod-badge ${event.outcome}`}>
                      {outcomeLabel(event.outcome)}
                    </span>
                    {event.mode === "historico" ? (
                      <span className="prod-badge hist">histórico</span>
                    ) : null}
                    <span className="prod-card-cost">
                      custo real{" "}
                      <strong className="mono">
                        {formatCurrency(event.frozenCost)}
                      </strong>
                    </span>
                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        void remove(event);
                      }}
                      title="Excluir e estornar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="prod-card-details">
                    <div className="cd-meta">
                      <span>
                        <span className="db-label">Máquina</span>{" "}
                        {event.machineName || "—"}
                      </span>
                      <span>
                        <span className="db-label">Tempo</span> {hoursLabel} h
                      </span>
                      <span>
                        <span className="db-label">Desfecho</span>{" "}
                        {outcomeLabel(event.outcome)}
                      </span>
                      <span>
                        <span className="db-label">Modo</span>{" "}
                        {event.mode === "historico"
                          ? "Histórico (não deduz)"
                          : "Real (deduz do estoque)"}
                      </span>
                      {event.notes ? (
                        <span>
                          <span className="db-label">Obs.</span> {event.notes}
                        </span>
                      ) : null}
                    </div>

                    {event.filaments.length > 0 ? (
                      <div className="details-span">
                        <div className="db-label">Filamento por cor</div>
                        <div className="details-tags">
                          {event.filaments.map((fil, index) => (
                            <span key={fil.id ?? index}>
                              {fil.colorName || "(cor)"}{" "}
                              <em>
                                {grams(filamentTotalG(fil))} ·{" "}
                                {formatCurrency(fil.pricePerKg)}/kg
                              </em>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* FEAT-06: composição congelada. Produção antiga sem
                        breakdown mostra só o total real (sem migração). */}
                    <CostBreakdownTable
                      real={event.frozenBreakdown}
                      realCogs={event.frozenCost}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {hasMore ? (
          <div className="load-more-row">
            <button
              className="btn ghost load-more"
              type="button"
              onClick={loadMore}
            >
              Carregar mais produções
            </button>
          </div>
        ) : null}
        </>
      )}

      {dialog}
    </main>
  );
}
