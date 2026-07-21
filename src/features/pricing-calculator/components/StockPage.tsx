"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Package,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatDecimal } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/date";
import { num } from "@/lib/number";
import {
  activeRoll,
  adjustRoll,
  balanceG,
  catalogPricePerKg,
  colorStatement,
  filamentLabel,
  filamentReferences,
  isBelowMin,
  materialOptions,
  rollNumbers,
} from "../lib/stock";
import {
  assemblyBreakdown,
  balanceOf,
  goodCostComposition,
  goodValue,
  skuBalance,
  skuValue,
} from "../lib/finishedGoods";
import { calculatePricing } from "../lib/calculatePricing";
import { addFrozen, sumFrozen, ZERO_FROZEN } from "../lib/production";
import { DEFAULT_FIXED_COSTS } from "../constants";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useMachines } from "../hooks/useMachines";
import { useFinishedGoods } from "../hooks/useFinishedGoods";
import { useProduction } from "../hooks/useProduction";
import { useProducts } from "../hooks/useProducts";
import { useSales } from "../hooks/useSales";
import { useStock } from "../hooks/useStock";
import { useTheme } from "../hooks/useTheme";
import type {
  CloudStatus,
  FilamentRoll,
  FinishedGood,
  FixedCostSettings,
  FrozenCostBreakdown,
  ProductionEvent,
  SavedProduct,
  StockFilament,
  StockFilamentPayload,
} from "../types";
import { CostDetail } from "./CostDetail";
import { NavBar } from "./NavBar";
import { StockAdjustModal } from "./StockAdjustModal";
import { StockColorModal, type StockColorDraft } from "./StockColorModal";
import { StockRollModal } from "./StockRollModal";
import { SuppliesTab } from "./SuppliesTab";

const statusLabel: Record<CloudStatus, string> = {
  connecting: "Conectando nuvem...",
  synced: "Sincronizado",
  importing: "Importando...",
  error: "Erro de Conexão",
};

function grams(value: number): string {
  return `${Math.round(num(value))} g`;
}

// Rótulo curto do desfecho da produção, para a linha de consumo do extrato.
const OUTCOME_SHORT: Record<ProductionEvent["outcome"], string> = {
  estoque: "estoque",
  encomenda: "encomenda",
  teste: "teste",
  falha: "falha",
  brinde: "brinde",
  historico: "histórico",
};

// A cor viva JÁ satisfaz o payload de gravação — o `id` sobra, mas é a chave do
// doc, não um campo: o repo monta o documento campo a campo e não o copia.
// Poupa uma cópia manual a cada gravação desta tela.
function toPayload(color: StockFilament): StockFilamentPayload {
  return color;
}

// Offline o Firestore enfileira a escrita e a Promise fica pendente para sempre
// (nem resolve, nem rejeita) — o botão travaria em "Salvando...". Bloqueia com
// aviso, como em SaleModal/QuotePage (TD-004).
function guardOnline() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(
      "Sem conexão com a internet. Reconecte e tente de novo — nada foi salvo ainda.",
    );
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Não foi possível salvar.";
}

export function StockPage() {
  const { theme, toggleTheme } = useTheme();
  const {
    filaments,
    status,
    error,
    addFilament,
    updateFilament,
    deleteFilament,
  } = useStock();
  // Só para o guarda do excluir: quem ainda aponta para a cor. Passa a ter
  // conteúdo a partir da 7c (produto) e da 8 (venda).
  const { products } = useProducts();
  const { sales } = useSales();
  // FEAT-04c: a 3ª fonte do extrato (consumo). Vem do `stockMoves` dos eventos
  // de produção — a produção é quem captura toda impressão que gasta filamento.
  const { events: production } = useProduction();
  // FEAT-05c: o Estoque de Produtos (acabados). Leitura viva; a produção é quem
  // incrementa (05b) e o passo 8 quem vai decrementar. Aqui é só apresentação.
  const { goods } = useFinishedGoods();

  const [tab, setTab] = useState<"filamentos" | "insumos" | "produtos">(
    "filamentos",
  );
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rollForId, setRollForId] = useState<string | null>(null);
  const [adjustForId, setAdjustForId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "error";
    msg: string;
  } | null>(null);

  // Os modais buscam a cor pelo id na lista viva (não guardam uma cópia): o
  // onSnapshot devolve o doc novo depois de cada gravação e uma cópia presa no
  // estado mostraria o saldo velho no ajuste seguinte.
  const byId = (id: string | null) =>
    id ? (filaments.find((color) => color.id === id) ?? null) : null;
  const editing = byId(editingId);
  const rollFor = byId(rollForId);
  const adjustFor = byId(adjustForId);

  const materials = useMemo(() => materialOptions(filaments), [filaments]);

  const { active, archived } = useMemo(() => {
    const sorted = [...filaments].sort((a, b) =>
      filamentLabel(a).localeCompare(filamentLabel(b), "pt-BR"),
    );
    return {
      active: sorted.filter((color) => !color.archived),
      archived: sorted.filter((color) => color.archived),
    };
  }, [filaments]);

  const totals = useMemo(() => {
    const totalG = active.reduce((sum, color) => sum + balanceG(color), 0);
    return {
      count: active.length,
      totalG,
      low: active.filter(isBelowMin).length,
    };
  }, [active]);

  // Casa cada acabado com o produto VIVO do catálogo (para ler a lista atual de
  // subitens — o doc só guarda as SKUs já produzidas).
  const productById = useMemo(() => {
    const map = new Map<string, SavedProduct>();
    for (const product of products) map.set(product.id, product);
    return map;
  }, [products]);

  // FEAT-06: o preço sugerido VIVO de cada produto, para confrontar com o custo
  // CONGELADO das camadas e mostrar a margem que o estoque parado embute. Só o
  // preço é vivo aqui — o custo vem da camada, nunca do catálogo (é o ponto do
  // FEAT-06). O custo fixo fica de fora pelo mesmo motivo da /producao: ele não
  // entra no custo real com que a margem é comparada.
  const { machines } = useMachines();
  const { fixedCostRate } = useBusinessSettings();
  const priceByProduct = useMemo(() => {
    const fixedCosts: FixedCostSettings = {
      ...fixedCostRate,
      enabled: DEFAULT_FIXED_COSTS.enabled,
    };
    const map = new Map<string, number>();
    for (const product of products) {
      map.set(
        product.id,
        calculatePricing(product, machines, fixedCosts, filaments).suggestedPrice,
      );
    }
    return map;
  }, [products, machines, fixedCostRate, filaments]);

  // Só produtos com algum saldo (≠ 0) aparecem; ordena por nome congelado.
  const stockedGoods = useMemo(
    () =>
      [...goods]
        .filter((good) => good.skus.some((sku) => skuBalance(sku) !== 0))
        .sort((a, b) => a.productName.localeCompare(b.productName, "pt-BR")),
    [goods],
  );

  const productTotals = useMemo(() => {
    const value = stockedGoods.reduce((sum, good) => sum + goodValue(good), 0);
    const negatives = stockedGoods.filter((good) =>
      good.skus.some((sku) => skuBalance(sku) < 0),
    ).length;
    // FEAT-06: a composição agregada de TODO o estoque parado, para o card do
    // topo dizer para onde o dinheiro foi (é quase sempre material — quando não
    // é, vale saber).
    const comp = stockedGoods.reduce(
      (acc, good) => {
        const one = goodCostComposition(good);
        return {
          breakdown: addFrozen(acc.breakdown, one.breakdown),
          unknown: acc.unknown + one.unknown,
        };
      },
      { breakdown: ZERO_FROZEN, unknown: 0 },
    );
    return { count: stockedGoods.length, value, negatives, comp };
  }, [stockedGoods]);

  async function saveColor(draft: StockColorDraft) {
    guardOnline();
    if (editing) {
      await updateFilament(editing.id, { ...toPayload(editing), ...draft });
      return;
    }
    await addFilament({
      ...draft,
      archived: false,
      rolls: [],
      adjustments: [],
      createdAt: Date.now(),
    });
  }

  async function saveRoll(color: StockFilament, roll: FilamentRoll) {
    guardOnline();
    await updateFilament(color.id, {
      ...toPayload(color),
      rolls: [...color.rolls, roll],
    });
  }

  async function saveAdjust(
    color: StockFilament,
    input: { rollId: string; countedG: number; reason: string; at: number },
  ) {
    guardOnline();
    // D6: o saldo passa por `adjustRoll`, que anexa o rastro. É o único caminho
    // desta tela que mexe em `remainingG`.
    const next = adjustRoll(
      color,
      input.rollId,
      input.countedG,
      input.reason,
      input.at,
    );
    await updateFilament(color.id, toPayload(next));
  }

  async function toggleArchive(color: StockFilament) {
    try {
      guardOnline();
      await updateFilament(color.id, {
        ...toPayload(color),
        archived: !color.archived,
      });
      setFeedback({
        kind: "ok",
        msg: color.archived
          ? `✓ "${filamentLabel(color)}" voltou para as cores ativas.`
          : `✓ "${filamentLabel(color)}" foi arquivada.`,
      });
    } catch (err) {
      setFeedback({ kind: "error", msg: errorMessage(err) });
    }
  }

  async function remove(color: StockFilament) {
    const rolls = color.rolls.length;
    const ok = window.confirm(
      `Excluir "${filamentLabel(color)}" de vez?\n\n` +
        (rolls > 0
          ? `Você perde o histórico de compra de ${rolls} rolo(s) desta cor.\n\n`
          : "") +
        "Isso não pode ser desfeito.",
    );
    if (!ok) return;

    try {
      guardOnline();
      await deleteFilament(color.id);
      setFeedback({ kind: "ok", msg: `✓ "${filamentLabel(color)}" excluída.` });
    } catch (err) {
      setFeedback({ kind: "error", msg: errorMessage(err) });
    }
  }

  function renderCard(color: StockFilament) {
    const balance = balanceG(color);
    const current = activeRoll(color);
    const numbers = rollNumbers(color);
    const refill = catalogPricePerKg(color);
    const low = isBelowMin(color);
    const expanded = expandedId === color.id;
    // Arquivar é a ação normal; excluir só quando ninguém mais aponta para a cor
    // (a partir da 7c/8 isso passa a bloquear de verdade).
    const refs = color.archived
      ? filamentReferences(color.id, products, sales)
      : null;
    const blocked =
      refs !== null && (refs.productNames.length > 0 || refs.salesCount > 0);

    const rolls = [...color.rolls].sort(
      (a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0),
    );
    const spent = rolls.filter((roll) => num(roll.remainingG) <= 0);
    const live = rolls.filter((roll) => num(roll.remainingG) > 0);

    return (
      <div
        className={`stock-card ${color.archived ? "archived" : ""}`}
        key={color.id}
      >
        <div className="stock-head">
          <span
            className="stock-dot"
            style={{ background: color.colorHex || "var(--muted2)" }}
            aria-hidden="true"
          />
          <div className="stock-title">
            <strong>{filamentLabel(color)}</strong>
            <span className="stock-sub">
              {rolls.length === 0
                ? "sem rolo registrado"
                : `${rolls.length} rolo${rolls.length > 1 ? "s" : ""} · repor a ${formatCurrency(refill)}/kg`}
            </span>
          </div>
          <div className="stock-balance">
            <strong className={`mono ${balance < 0 ? "sale-neg" : ""}`}>
              {grams(balance)}
            </strong>
            {low ? (
              <span className="stock-badge low">
                abaixo do mínimo ({grams(color.minG)})
              </span>
            ) : null}
          </div>
        </div>

        <div className="stock-current">
          {current ? (
            <>
              Rolo #{numbers.get(current.id)} em uso ·{" "}
              <strong className="mono">{grams(current.remainingG)}</strong>{" "}
              restantes · pago {formatCurrency(current.pricePerKg)}/kg
            </>
          ) : rolls.length === 0 ? (
            "Nenhum rolo — registre a compra para o saldo começar a contar."
          ) : (
            "Nenhum rolo com saldo. A próxima impressão já sai no negativo."
          )}
        </div>

        <div className="stock-actions">
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setRollForId(color.id)}
          >
            <Plus size={14} /> Rolo
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setAdjustForId(color.id)}
            disabled={rolls.length === 0}
            title={
              rolls.length === 0
                ? "Registre um rolo antes de contar"
                : "Ajuste de inventário"
            }
          >
            <ClipboardCheck size={14} /> Ajustar
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setEditingId(color.id)}
          >
            <Pencil size={14} /> Editar
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => void toggleArchive(color)}
          >
            {color.archived ? (
              <>
                <ArchiveRestore size={14} /> Reativar
              </>
            ) : (
              <>
                <Archive size={14} /> Arquivar
              </>
            )}
          </button>
          {refs !== null && !blocked ? (
            <button
              className="btn btn-secondary btn-sm danger"
              type="button"
              onClick={() => void remove(color)}
            >
              <Trash2 size={14} /> Excluir
            </button>
          ) : null}
          <button
            className="link-button stock-expand"
            type="button"
            onClick={() => setExpandedId(expanded ? null : color.id)}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {expanded ? "Ocultar" : "Rolos e extrato"}
          </button>
        </div>

        {blocked && refs ? (
          <div className="stock-blocked">
            Não dá para excluir: em uso por{" "}
            {refs.productNames.length > 0
              ? `${refs.productNames.length} produto(s) (${refs.productNames.join(", ")})`
              : ""}
            {refs.productNames.length > 0 && refs.salesCount > 0 ? " e " : ""}
            {refs.salesCount > 0 ? `${refs.salesCount} venda(s)` : ""}. Arquivada
            ela some da lista sem quebrar nada.
          </div>
        ) : null}

        {expanded ? (
          <div className="stock-detail">
            <div className="section-label">Rolos</div>
            {live.length === 0 ? (
              <div className="stock-empty-line">Nenhum rolo com saldo.</div>
            ) : (
              live.map((roll) => (
                <div className="stock-roll" key={roll.id}>
                  <span className="stock-roll-name">
                    #{numbers.get(roll.id)}
                    {roll.id === current?.id ? (
                      <em className="stock-tag">em uso</em>
                    ) : null}
                  </span>
                  <span className="stock-roll-info">
                    {formatDate(roll.purchaseDate)} · {grams(roll.initialG)} a{" "}
                    {formatCurrency(roll.pricePerKg)}/kg
                    {roll.note ? ` · ${roll.note}` : ""}
                  </span>
                  <span className="mono stock-roll-left">
                    {grams(roll.remainingG)}
                  </span>
                </div>
              ))
            )}

            {spent.length > 0 ? (
              <details className="stock-spent">
                <summary>Rolos anteriores ({spent.length})</summary>
                {spent.map((roll) => (
                  <div className="stock-roll" key={roll.id}>
                    <span className="stock-roll-name">#{numbers.get(roll.id)}</span>
                    <span className="stock-roll-info">
                      {formatDate(roll.purchaseDate)} · {grams(roll.initialG)} a{" "}
                      {formatCurrency(roll.pricePerKg)}/kg
                      {roll.note ? ` · ${roll.note}` : ""}
                    </span>
                    <span
                      className={`mono stock-roll-left ${
                        num(roll.remainingG) < 0 ? "sale-neg" : ""
                      }`}
                    >
                      {grams(roll.remainingG)}
                    </span>
                  </div>
                ))}
              </details>
            ) : null}

            <div className="section-label stock-statement-label">Extrato</div>
            {colorStatement(color, production).map((entry) => (
              <div className="stock-entry" key={entry.id}>
                <span className="stock-entry-date mono">
                  {formatDate(entry.at)}
                </span>
                <span className="stock-entry-desc">
                  {entry.kind === "purchase" ? (
                    <>
                      Compra do rolo #{numbers.get(entry.rollId)} ·{" "}
                      {formatCurrency(entry.pricePerKg)}/kg
                      {entry.note ? ` · ${entry.note}` : ""}
                    </>
                  ) : entry.kind === "adjustment" ? (
                    <>
                      Ajuste do rolo #{numbers.get(entry.rollId)} ·{" "}
                      {entry.reason}
                      <em className="stock-entry-sub">
                        sistema tinha {grams(entry.beforeG)}, contado{" "}
                        {grams(entry.afterG)}
                      </em>
                    </>
                  ) : (
                    <>
                      Produção do rolo #{numbers.get(entry.rollId)} ·{" "}
                      {OUTCOME_SHORT[entry.outcome]}
                      {entry.productName ? (
                        <em className="stock-entry-sub">{entry.productName}</em>
                      ) : null}
                    </>
                  )}
                </span>
                <span
                  className={`mono stock-entry-delta ${
                    entry.deltaG < 0 ? "sale-neg" : "sale-pos"
                  }`}
                >
                  {entry.deltaG > 0 ? "+" : "−"}
                  {Math.round(Math.abs(entry.deltaG))} g
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  // FEAT-05c: card de um produto no Estoque de Produtos. Apresentação híbrida
  // "conjunto + lacuna": o inteiro montável = min das partes, e a divergência
  // vira peças avulsas ("conjunto sem X"). Só leitura — a baixa é o passo 8.
  // FEAT-06: faixa de composição do valor parado — de que é feito o COGS que
  // está na prateleira. CSS puro (flex-grow proporcional), sem biblioteca.
  // Componentes zerados somem; valor negativo (D4) não vira barra (não há
  // proporção que faça sentido num buraco) — o card já avisa do saldo negativo.
  function renderCostBars(breakdown: FrozenCostBreakdown, total: number) {
    if (total <= 0) return null;
    const parts = [
      { key: "material", label: "Material", value: breakdown.material },
      { key: "labor", label: "Mão de obra", value: breakdown.labor },
      { key: "supplies", label: "Insumos", value: breakdown.supplies },
      { key: "energy", label: "Energia", value: breakdown.energy },
      { key: "depreciation", label: "Desgaste", value: breakdown.depreciation },
      { key: "maintenance", label: "Manutenção", value: breakdown.maintenance },
    ].filter((part) => part.value > 0);
    if (parts.length === 0) return null;
    const sum = sumFrozen(breakdown);
    return (
      <div className="fg-comp">
        <div className="fg-comp-bar">
          {parts.map((part) => (
            <span
              key={part.key}
              className={`fg-comp-seg ${part.key}`}
              style={{ flexGrow: part.value }}
              title={`${part.label}: ${formatCurrency(part.value)}`}
            />
          ))}
        </div>
        <div className="fg-comp-legend">
          {parts.map((part) => (
            <span className="fg-comp-item" key={part.key}>
              <i className={`fg-comp-dot ${part.key}`} aria-hidden="true" />
              {part.label} {Math.round((part.value / sum) * 100)}%
            </span>
          ))}
        </div>
      </div>
    );
  }

  // FEAT-06: custo congelado MÉDIO por unidade de uma SKU. Saldo 0 ou negativo
  // não tem média que signifique alguma coisa — devolve null e a linha só mostra
  // o saldo, como antes.
  function skuUnitCost(sku: FinishedGood["skus"][number]) {
    const balance = skuBalance(sku);
    if (balance <= 0) return null;
    return skuValue(sku) / balance;
  }

  // Custo congelado de UM conjunto = Σ do custo médio de cada parte. Devolve null
  // se qualquer parte não tiver saldo — a soma estaria incompleta e a margem sairia
  // otimista demais (parece barato só porque falta uma peça na conta).
  function wholeUnitCost(
    parts: { subitemId: string }[],
    skuByKey: Map<string, FinishedGood["skus"][number]>,
  ): number | null {
    let total = 0;
    for (const part of parts) {
      const sku = skuByKey.get(part.subitemId);
      const unit = sku ? skuUnitCost(sku) : null;
      if (unit === null) return null;
      total += unit;
    }
    return parts.length > 0 ? total : null;
  }

  // FEAT-06: a margem que o estoque parado embute — preço sugerido VIVO contra o
  // custo CONGELADO da peça que está na prateleira. É a pergunta prática do dono:
  // "se eu vender essa unidade hoje, quanto sobra?". Some quando o produto saiu do
  // catálogo (sem preço) ou o custo não é calculável.
  function renderMargin(price: number | undefined, unitCost: number | null) {
    if (price === undefined || unitCost === null || price <= 0) return null;
    const profit = price - unitCost;
    const margin = (profit / price) * 100;
    return (
      <div className="fg-margin">
        <span>
          preço sugerido <strong className="mono">{formatCurrency(price)}</strong>{" "}
          − custo congelado{" "}
          <strong className="mono">{formatCurrency(unitCost)}</strong>
        </span>
        <span className={`fg-margin-val ${profit < 0 ? "sale-neg" : ""}`}>
          <strong className="mono">{formatCurrency(profit)}</strong>
          <em>{margin.toFixed(0)}% de margem</em>
        </span>
      </div>
    );
  }

  function renderProductCard(good: FinishedGood) {
    const product = productById.get(good.productId);
    // FEAT-06: o valor parado DECOMPOSTO — só existe para camadas novas; o que
    // veio de produção antiga fica em `comp.unknown` ("não detalhado").
    const comp = goodCostComposition(good);
    const skuByKey = new Map(
      good.skus.map((sku) => [sku.subitemId ?? "__whole__", sku]),
    );
    const price = priceByProduct.get(good.productId);
    const negative = good.skus.some((sku) => skuBalance(sku) < 0);
    // Subitens VIVOS do produto (o doc só guarda as SKUs já produzidas).
    const subitems =
      product && product.sellBySubitems ? product.subitems : [];
    const wholeBalance = balanceOf(good, undefined);

    // Produto que vende por partes: conjuntos completos + lacuna.
    if (subitems.length > 0) {
      const bd = assemblyBreakdown(good, subitems);
      return (
        <div className="stock-card fg-card" key={good.id}>
          <div className="stock-head">
            <span className="fg-icon" aria-hidden="true">
              <Boxes size={18} />
            </span>
            <div className="stock-title">
              <strong>{good.productName}</strong>
              <span className="stock-sub">
                {subitems.length} subitens ·{" "}
                {/* FEAT-06: o valor parado virou detalhável — clique mostra de
                    que é feito o COGS que está na prateleira. */}
                <CostDetail
                  real={comp.breakdown}
                  realCogs={comp.total}
                  realUnknown={comp.unknown}
                  triggerLabel="valor parado"
                  hint="▾"
                />
              </span>
            </div>
            <div className="stock-balance">
              <strong className={`sg ${bd.wholes < 0 ? "sale-neg" : ""}`}>
                {bd.wholes}
              </strong>
              <span className="sales-total-sub">
                conjunto{bd.wholes === 1 ? "" : "s"} completo
                {bd.wholes === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {negative ? (
            <div className="fg-warn neg">
              Saldo negativo: vendeu/consumiu mais do que produziu. Registre a
              produção que faltou ou confira as baixas.
            </div>
          ) : bd.hasGap ? (
            <div className="fg-warn">
              Conjuntos incompletos: sobram peças avulsas. Reimprimir a parte que
              falta fecha mais conjuntos.
            </div>
          ) : null}

          <div className="fg-parts">
            {bd.parts.map((part) => {
              const sku = skuByKey.get(part.subitemId);
              const unit = sku ? skuUnitCost(sku) : null;
              return (
                <div className="fg-part" key={part.subitemId}>
                  <span className="fg-part-name">{part.name}</span>
                  <span
                    className={`mono fg-part-bal ${
                      part.balance < 0 ? "sale-neg" : ""
                    }`}
                  >
                    {part.balance} em estoque
                  </span>
                  {/* FEAT-06: o custo congelado médio da parte. */}
                  {unit !== null ? (
                    <span className="fg-part-cost mono">
                      {formatCurrency(unit)}/un
                    </span>
                  ) : null}
                  {part.leftover > 0 ? (
                    <em className="fg-leftover">
                      +{part.leftover} avulsa{part.leftover === 1 ? "" : "s"}
                    </em>
                  ) : null}
                </div>
              );
            })}
            {wholeBalance !== 0 ? (
              <div className="fg-part">
                <span className="fg-part-name">Inteiro (avulso)</span>
                <span
                  className={`mono fg-part-bal ${
                    wholeBalance < 0 ? "sale-neg" : ""
                  }`}
                >
                  {wholeBalance} em estoque
                </span>
              </div>
            ) : null}
          </div>

          {renderCostBars(comp.breakdown, comp.total)}
          {/* O custo de UM conjunto é a soma do custo médio de cada parte — não
              o valor parado ÷ conjuntos, que diluiria as peças avulsas que
              sobraram e não formam conjunto. Só quando todas as partes têm
              saldo (senão a soma estaria incompleta). */}
          {renderMargin(price, wholeUnitCost(bd.parts, skuByKey))}
        </div>
      );
    }

    // Produto sem subitens (ou fora do catálogo): lista as SKUs com saldo.
    const rows = good.skus
      .map((sku) => ({
        key: sku.subitemId ?? "__whole__",
        name: sku.subitemId ? sku.name : good.productName,
        balance: skuBalance(sku),
      }))
      .filter((row) => row.balance !== 0);
    const headline = rows.length === 1 ? rows[0].balance : wholeBalance;

    return (
      <div className="stock-card fg-card" key={good.id}>
        <div className="stock-head">
          <span className="fg-icon" aria-hidden="true">
            <Package size={18} />
          </span>
          <div className="stock-title">
            <strong>{good.productName}</strong>
            <span className="stock-sub">
              {product ? "unidade inteira" : "produto fora do catálogo"} ·{" "}
              <CostDetail
                real={comp.breakdown}
                realCogs={comp.total}
                realUnknown={comp.unknown}
                triggerLabel="valor parado"
                hint="▾"
              />
            </span>
          </div>
          <div className="stock-balance">
            <strong className={`sg ${headline < 0 ? "sale-neg" : ""}`}>
              {rows.length === 1 ? rows[0].balance : rows.length}
            </strong>
            <span className="sales-total-sub">
              {rows.length === 1 ? "em estoque" : "SKUs"}
            </span>
          </div>
        </div>

        {negative ? (
          <div className="fg-warn neg">
            Saldo negativo: vendeu/consumiu mais do que produziu. Registre a
            produção que faltou ou confira as baixas.
          </div>
        ) : !product ? (
          <div className="fg-warn">
            Este produto não está mais no catálogo — o acabado segue aqui com o
            nome e o custo congelados.
          </div>
        ) : null}

        {rows.length > 1 ? (
          <div className="fg-parts">
            {rows.map((row) => {
              const sku = skuByKey.get(row.key);
              const unit = sku ? skuUnitCost(sku) : null;
              return (
                <div className="fg-part" key={row.key}>
                  <span className="fg-part-name">{row.name}</span>
                  <span
                    className={`mono fg-part-bal ${
                      row.balance < 0 ? "sale-neg" : ""
                    }`}
                  >
                    {row.balance} em estoque
                  </span>
                  {unit !== null ? (
                    <span className="fg-part-cost mono">
                      {formatCurrency(unit)}/un
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {renderCostBars(comp.breakdown, comp.total)}
        {/* SKU única: o custo congelado dela é o custo da unidade vendável. Com
            várias SKUs num produto sem subitens vivos não há "a" unidade — a
            margem sairia de uma média sem significado. */}
        {rows.length === 1
          ? renderMargin(
              price,
              (() => {
                const sku = skuByKey.get(rows[0].key);
                return sku ? skuUnitCost(sku) : null;
              })(),
            )
          : null}
      </div>
    );
  }

  return (
    <main className="wrap">
      <div className="header">
        <div className="brand">
          <div>
            <h1 className="sg">Estoque</h1>
            <div className="brand-meta">
              <span>Filamento, insumos e produtos — Lopo Lab</span>
              <span className={`cloud-status ${status}`}>
                {statusLabel[status]}
              </span>
            </div>
          </div>
        </div>
      </div>
      <NavBar theme={theme} onToggleTheme={toggleTheme} />

      {error ? <div className="app-error">{error}</div> : null}

      <div className="stock-tabs" role="tablist">
        <button
          className={`stock-tab ${tab === "filamentos" ? "active" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === "filamentos"}
          onClick={() => setTab("filamentos")}
        >
          <Palette size={15} /> Filamentos
        </button>
        <button
          className={`stock-tab ${tab === "insumos" ? "active" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === "insumos"}
          onClick={() => setTab("insumos")}
        >
          <Package size={15} /> Insumos
        </button>
        <button
          className={`stock-tab ${tab === "produtos" ? "active" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === "produtos"}
          onClick={() => setTab("produtos")}
        >
          <Boxes size={15} /> Produtos
        </button>
      </div>

      {tab === "filamentos" ? (
        <>
      <div className="sales-totals stock-totals">
        <div className="sales-total-card">
          <span>Cores ativas</span>
          <strong className="sg">{totals.count}</strong>
          <span className="sales-total-sub">
            {archived.length > 0 ? `${archived.length} arquivada(s)` : "nenhuma arquivada"}
          </span>
        </div>
        <div className="sales-total-card">
          <span>Saldo total</span>
          <strong className={`sg mono ${totals.totalG < 0 ? "sale-neg" : ""}`}>
            {formatDecimal(totals.totalG / 1000)} kg
          </strong>
          <span className="sales-total-sub">soma dos rolos</span>
        </div>
        <div className="sales-total-card">
          <span>Abaixo do mínimo</span>
          <strong className={`sg ${totals.low > 0 ? "sale-neg" : ""}`}>
            {totals.low}
          </strong>
          <span className="sales-total-sub">precisa repor</span>
        </div>
      </div>

      <div className="stock-bar">
        <p className="stock-intro">
          Cada cor guarda os rolos que você comprou, com o preço real de cada um.
          O consumo é do rolo mais antigo para o mais novo. Já dá para escolher a
          cor no produto (o preço/kg sai daqui, do rolo mais novo); a baixa
          automática na venda vem no próximo passo.
        </p>
        <button
          className="btn primary"
          type="button"
          onClick={() => setCreating(true)}
        >
          <Plus size={15} /> Nova cor
        </button>
      </div>

      {feedback ? (
        <div className={feedback.kind === "ok" ? "form-ok" : "form-error"}>
          {feedback.msg}
        </div>
      ) : null}

      {filaments.length === 0 ? (
        <div className="sales-empty">
          Nenhuma cor cadastrada ainda. Comece pelo filamento que você mais usa —
          cadastre a cor e registre o rolo que está na impressora.
        </div>
      ) : (
        <div className="stock-list">{active.map(renderCard)}</div>
      )}

      {archived.length > 0 ? (
        <details className="stock-archived-box">
          <summary>Cores arquivadas ({archived.length})</summary>
          <div className="stock-list">{archived.map(renderCard)}</div>
        </details>
      ) : null}
        </>
      ) : tab === "insumos" ? (
        <SuppliesTab
          products={products}
          production={production}
          outcomeShort={OUTCOME_SHORT}
        />
      ) : (
        <>
          <div className="sales-totals stock-totals">
            <div className="sales-total-card">
              <span>Produtos com estoque</span>
              <strong className="sg">{productTotals.count}</strong>
              <span className="sales-total-sub">peças prontas para vender</span>
            </div>
            <div className="sales-total-card">
              <span>Valor parado</span>
              <strong
                className={`sg mono ${
                  productTotals.value < 0 ? "sale-neg" : ""
                }`}
              >
                {formatCurrency(productTotals.value)}
              </strong>
              {/* FEAT-06: para onde o dinheiro parado foi. */}
              <span className="sales-total-sub">
                {productTotals.value > 0 ? (
                  <CostDetail
                    real={productTotals.comp.breakdown}
                    realCogs={productTotals.value}
                    realUnknown={productTotals.comp.unknown}
                    triggerLabel="custo congelado"
                    hint="· composição ▾"
                  />
                ) : (
                  "custo congelado em estoque"
                )}
              </span>
            </div>
            <div className="sales-total-card">
              <span>Saldo negativo</span>
              <strong
                className={`sg ${productTotals.negatives > 0 ? "sale-neg" : ""}`}
              >
                {productTotals.negatives}
              </strong>
              <span className="sales-total-sub">produção a acertar</span>
            </div>
          </div>

          <div className="stock-bar">
            <p className="stock-intro">
              Peças já impressas e ainda não vendidas, com o custo congelado no
              momento da produção. A produção enche este estoque; a venda vai
              esvaziá-lo no próximo passo. Para produtos com subitens, o número em
              destaque é quantos conjuntos completos dá para montar (o menor saldo
              entre as partes).
            </p>
          </div>

          {stockedGoods.length === 0 ? (
            <div className="sales-empty">
              Nenhum produto em estoque ainda. Registre uma produção com desfecho
              &ldquo;peça para o estoque&rdquo; na tela de{" "}
              <Link className="inline-link" href="/producao">
                Produção
              </Link>{" "}
              e a peça aparece aqui.
            </div>
          ) : (
            <div className="stock-list">
              {stockedGoods.map(renderProductCard)}
            </div>
          )}
        </>
      )}

      {creating || editing ? (
        <StockColorModal
          color={editing}
          materials={materials}
          onClose={() => {
            setCreating(false);
            setEditingId(null);
          }}
          onSave={saveColor}
        />
      ) : null}

      {rollFor ? (
        <StockRollModal
          color={rollFor}
          onClose={() => setRollForId(null)}
          onSave={(roll) => saveRoll(rollFor, roll)}
        />
      ) : null}

      {adjustFor ? (
        <StockAdjustModal
          color={adjustFor}
          onClose={() => setAdjustForId(null)}
          onSave={(input) => saveAdjust(adjustFor, input)}
        />
      ) : null}
    </main>
  );
}
