"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  Factory,
  Package,
  Palette,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { errorMessage, guardOnline } from "@/lib/errors";
import { formatCurrency, formatDecimal } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/date";
import { num } from "@/lib/number";
import { matchesQuery } from "@/lib/text";
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
  goodCostComposition,
  goodValue,
  partBalance,
  skuBalance,
  skusOfPart,
  skuValue,
} from "../lib/finishedGoods";
import { calculatePricing } from "../lib/calculatePricing";
import { NO_COLOR_KEY } from "../lib/filaments";
import { marginTierClass, marginTierTitle } from "../lib/marginTier";
import {
  productPrintHours,
  saleContextFromResult,
  saleContextFromSubitem,
  type SaleModalContext,
} from "../lib/saleContext";
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
  FilamentRoll,
  FinishedGood,
  FixedCostSettings,
  FrozenCostBreakdown,
  PricingResult,
  ProductionEvent,
  SavedProduct,
  StockFilament,
  StockFilamentPayload,
} from "../types";
import { useConfirm } from "./ConfirmDialog";
import { CostBreakdownTable, CostDetail } from "./CostDetail";
import { FeedbackNote, useFeedback } from "./FeedbackNote";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { PageIntro } from "./PageIntro";
import { SaleFlow } from "./SaleFlow";
import { SearchBox } from "./SearchBox";
import { StockAdjustModal } from "./StockAdjustModal";
import { StockColorModal, type StockColorDraft } from "./StockColorModal";
import { StockRollModal } from "./StockRollModal";
import { SuppliesTab } from "./SuppliesTab";

function grams(value: number): string {
  return `${Math.round(num(value))} g`;
}

// Nota do rodapé da composição do custo na /estoque. O default do
// CostBreakdownTable fala em "nesta impressão" (certo para a /producao, que é
// um evento só); aqui o valor é o custo real PARADO em estoque, somando as
// várias impressões que encheram o saldo — então o texto precisa refletir isso.
const STOCK_COST_NOTE = (
  <>
    É o custo real <strong>parado em estoque</strong> nestas peças já impressas,
    pelo preço do rolo e do lote realmente usados na produção de cada uma. Não
    inclui reserva de falha nem custo fixo — essas são provisões do preço, não
    gasto. É este número que vira o custo da peça quando ela for vendida.
  </>
);

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

export function StockPage() {
  const router = useRouter();
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
  // UX-05: busca por aba. Client-side — filamentos e acabados têm teto natural,
  // moram inteiros no cliente (não paginam na TD-006).
  const [colorQuery, setColorQuery] = useState("");
  const [goodQuery, setGoodQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rollForId, setRollForId] = useState<string | null>(null);
  const [adjustForId, setAdjustForId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // UX-07a: qual produto acabado está com o detalhe aberto (linha + dropdown).
  const [openGoodId, setOpenGoodId] = useState<string | null>(null);
  // UX-08: venda direto do estoque — reusa a fiação do SaleFlow/SaleModal com o
  // produto semeado (peça pronta). null = fechado.
  const [saleSeed, setSaleSeed] = useState<SaleModalContext | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const { note, ok, fail, clear } = useFeedback();
  const { ask, dialog } = useConfirm();

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

  // UX-05: filtro por nome/material da cor. Os totais do topo seguem no conjunto
  // inteiro (contam o estoque, não a busca) — só a lista visível filtra.
  const activeShown = useMemo(
    () => active.filter((color) => matchesQuery(colorQuery, filamentLabel(color))),
    [active, colorQuery],
  );
  const archivedShown = useMemo(
    () => archived.filter((color) => matchesQuery(colorQuery, filamentLabel(color))),
    [archived, colorQuery],
  );

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
  // O `enabled` segue o mesmo racional do catálogo: cada produto traz o próprio
  // `includeFixed`, aplicado por cima deste piso pelo `calculatePricing`.
  const fixedCosts = useMemo<FixedCostSettings>(
    () => ({ ...fixedCostRate, enabled: DEFAULT_FIXED_COSTS.enabled }),
    [fixedCostRate],
  );
  // Precifica cada produto UMA vez: alimenta a margem congelada da aba Produtos
  // (só o `suggestedPrice`) E o seed da venda direto do estoque (UX-08).
  const pricingByProduct = useMemo(() => {
    const map = new Map<string, PricingResult>();
    for (const product of products) {
      map.set(product.id, calculatePricing(product, machines, fixedCosts, filaments));
    }
    return map;
  }, [products, machines, fixedCosts, filaments]);

  // Só produtos com algum saldo (≠ 0) aparecem; ordena por nome congelado.
  const stockedGoods = useMemo(
    () =>
      [...goods]
        .filter((good) => good.skus.some((sku) => skuBalance(sku) !== 0))
        .sort((a, b) => a.productName.localeCompare(b.productName, "pt-BR")),
    [goods],
  );

  // UX-05: filtro por nome do produto acabado. Os totais do topo seguem no
  // conjunto inteiro; só a lista visível filtra.
  const stockedGoodsShown = useMemo(
    () => stockedGoods.filter((good) => matchesQuery(goodQuery, good.productName)),
    [stockedGoods, goodQuery],
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
      ok(
        color.archived
          ? `“${filamentLabel(color)}” voltou para as cores ativas.`
          : `“${filamentLabel(color)}” foi arquivada.`,
      );
    } catch (err) {
      fail(errorMessage(err));
    }
  }

  async function remove(color: StockFilament) {
    const rolls = color.rolls.length;
    const confirmed = await ask({
      title: `Excluir “${filamentLabel(color)}” de vez?`,
      body: (
        <>
          {rolls > 0 ? (
            <p>
              Você perde o histórico de compra de{" "}
              <strong>
                {rolls} rolo{rolls > 1 ? "s" : ""}
              </strong>{" "}
              desta cor.
            </p>
          ) : null}
          <p className="confirm-safe">
            As produções e vendas que já usaram esta cor não mudam — o custo
            delas está congelado.
          </p>
          <p>Isso não pode ser desfeito.</p>
        </>
      ),
      confirmLabel: "Excluir cor",
      danger: true,
    });
    if (!confirmed) return;

    try {
      guardOnline();
      await deleteFilament(color.id);
      ok(`“${filamentLabel(color)}” excluída.`);
    } catch (err) {
      fail(errorMessage(err));
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

  // FEAT-11: o custo médio de uma PEÇA somando as cores. Depois que a cor virou
  // dimensão da SKU, uma parte pode ter várias (2 azuis a R$ 6 + 1 preta a R$ 7):
  // o custo da peça é a média ponderada, não o da primeira SKU que aparecer.
  function partUnitCost(
    good: FinishedGood,
    subitemId?: string,
  ): number | null {
    const balance = partBalance(good, subitemId);
    if (balance <= 0) return null;
    const value = skusOfPart(good, subitemId).reduce(
      (sum, sku) => sum + skuValue(sku),
      0,
    );
    return value / balance;
  }

  // Custo congelado de UM conjunto = Σ do custo médio de cada parte. Devolve null
  // se qualquer parte não tiver saldo — a soma estaria incompleta e a margem sairia
  // otimista demais (parece barato só porque falta uma peça na conta).
  function wholeUnitCost(
    good: FinishedGood,
    parts: { subitemId: string }[],
  ): number | null {
    let total = 0;
    for (const part of parts) {
      const unit = partUnitCost(good, part.subitemId);
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
          {/* UX-20 (2026-08-16) REVERTEU o que estava escrito aqui: o R$ não
              segue mais verde/vermelho no positivo — a cor mora só na %, que já
              carrega a faixa da DEC-04. O verde vinha da classe `.fg-margin-val`
              (não do `.sale-pos`), e o prejuízo era LARANJA aqui contra vermelho
              no resto do app: duas cores para o mesmo significado. As duas
              coisas foram corrigidas no `stock.css`. Regra completa no
              `auth-sale.css`, bloco do `.sale-pos`. */}
          <em>
            <span
              className={marginTierClass(margin)}
              title={marginTierTitle(margin)}
            >
              {margin.toFixed(0)}%
            </span>{" "}
            de margem
          </em>
        </span>
      </div>
    );
  }

  // UX-08: abre o modal de venda com o produto INTEIRO já na cesta. Semeia a foto
  // congelada (mesmo helper do catálogo); o SaleModal escolhe "acabado" sozinho
  // porque há saldo (defaultOrigin).
  function openSaleWhole(product: SavedProduct, result: PricingResult) {
    const baseName = product.name || product.mainStageName || "";
    setSaleSeed(
      saleContextFromResult(
        baseName,
        product.id,
        result,
        productPrintHours(product),
        product.roundingMode,
      ),
    );
    setSaleOpen(true);
  }

  // UX-08: venda de UMA parte (subitem) direto do estoque — a foto congela só o
  // custo/consumo daquele subitem (FEAT-01), casando com a baixa da SKU da parte.
  function openSaleSubitem(
    product: SavedProduct,
    result: PricingResult,
    subitemId: string,
  ) {
    const subitem = result.subitems?.find((item) => item.id === subitemId);
    if (!subitem) return;
    const baseName = product.name || product.mainStageName || "";
    setSaleSeed(
      saleContextFromSubitem(baseName, product.id, subitem, product.roundingMode),
    );
    setSaleOpen(true);
  }

  // FEAT-08: manda pra /producao já semeado com o produto (e o subitem, pra
  // "fechar conjunto" produzindo só a parte que falta). Mesma query do catálogo.
  function produce(productId: string, subitemId?: string) {
    const params = new URLSearchParams({ produto: productId });
    if (subitemId) params.set("subitem", subitemId);
    router.push(`/producao?${params.toString()}`);
  }

  // Abre o produto no catálogo (card expandido, com as ações por parte de lá).
  function openInCatalog(productId: string) {
    router.push(`/catalogo?produto=${encodeURIComponent(productId)}`);
  }

  // Botão compacto de ação (vender/produzir). Só aparece pra produto que ainda
  // vive no catálogo — sem ele não há precificação viva pra congelar a foto/semear.
  function actionButton(
    product: SavedProduct | undefined,
    icon: ReactNode,
    label: string,
    onClick: () => void,
    variant: "primary" | "secondary",
  ) {
    if (!product || !pricingByProduct.get(product.id)) return null;
    return (
      <button
        className={`btn ${variant === "primary" ? "primary" : "btn-secondary"} btn-sm fg-sell-btn`}
        type="button"
        onClick={onClick}
      >
        {icon} {label}
      </button>
    );
  }

  function renderProductCard(good: FinishedGood) {
    const product = productById.get(good.productId);
    // FEAT-06: o valor parado DECOMPOSTO — só existe para camadas novas; o que
    // veio de produção antiga fica em `comp.unknown` ("não detalhado").
    const comp = goodCostComposition(good);
    const price = pricingByProduct.get(good.productId)?.suggestedPrice;
    const negative = good.skus.some((sku) => skuBalance(sku) < 0);
    // "Peças por impressão" (mesa de N): cada Produzir abre a Produção com 1 placa,
    // que rende N peças. Deixa isso explícito na dica (produzir NÃO faz sempre 1).
    const pieces = Math.max(1, num(product?.piecesCount) || 1);
    // UX-07a: linha + dropdown (irmão do catálogo/produção). O "valor parado"
    // que era popover agora é texto na linha e a composição desce pro dropdown.
    const isOpen = openGoodId === good.id;
    const toggle = () =>
      setOpenGoodId((current) => (current === good.id ? null : good.id));
    // Subitens VIVOS do produto (o doc só guarda as SKUs já produzidas).
    const subitems =
      product && product.sellBySubitems ? product.subitems : [];
    // FEAT-11: soma as cores — a prateleira tem 3 peças, sendo 2 azuis e 1 preta.
    const wholeBalance = partBalance(good, undefined);

    // Produto que vende por partes: conjuntos completos + lacuna.
    if (subitems.length > 0) {
      const bd = assemblyBreakdown(good, subitems);
      return (
        <div className={`stock-card fg-card ${isOpen ? "open" : ""}`} key={good.id}>
          <div className="stock-head fg-head" onClick={toggle}>
            <span className="arrow-icon">▼</span>
            <span className="fg-icon" aria-hidden="true">
              <Boxes size={18} />
            </span>
            <div className="stock-title">
              <strong>{good.productName}</strong>
              <span className="stock-sub">
                {subitems.length} subitens ·{" "}
                <span className="fg-value-inline">
                  valor parado{" "}
                  <strong className="mono">{formatCurrency(comp.total)}</strong>
                </span>
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

          {isOpen ? (
            <div className="fg-details">
              {product ? (
                <div className="fg-sell-bar">
                  {bd.wholes > 0
                    ? actionButton(
                        product,
                        <ShoppingCart size={13} />,
                        `Vender conjunto (${bd.wholes})`,
                        () =>
                          openSaleWhole(product, pricingByProduct.get(product.id)!),
                        "primary",
                      )
                    : null}
                  {actionButton(
                    product,
                    <Factory size={13} />,
                    "Produzir conjunto",
                    () => produce(product.id),
                    "secondary",
                  )}
                  {actionButton(
                    product,
                    <ExternalLink size={13} />,
                    "Ver no catálogo",
                    () => openInCatalog(product.id),
                    "secondary",
                  )}
                  <span className="fg-sell-hint">
                    {bd.wholes > 0
                      ? "Vender / produzir por peça nos botões de cada linha."
                      : "Produza a peça que falta pra fechar o conjunto (botões de cada linha)."}
                    {pieces > 1
                      ? ` Cada impressão deste produto rende ${pieces} peças (mesa de ${pieces}).`
                      : ""}
                  </span>
                </div>
              ) : null}
              {negative ? (
                <div className="fg-warn neg">
                  Saldo negativo: vendeu/consumiu mais do que produziu. Registre
                  a produção que faltou ou confira as baixas.
                </div>
              ) : bd.hasGap ? (
                <div className="fg-warn">
                  Conjuntos incompletos: sobram peças avulsas. Reimprimir a parte
                  que falta fecha mais conjuntos.
                </div>
              ) : null}

              <div className="section-label">Peças em estoque</div>
              <div className="fg-parts">
                {bd.parts.map((part) => {
                  const unit = partUnitCost(good, part.subitemId);
                  return (
                    <div className="fg-part" key={part.subitemId}>
                      <div className="fg-part-main">
                        <span className="fg-part-name">{part.name}</span>
                        {/* FEAT-11: de que cores é este saldo. O conjunto monta
                            com qualquer combinação (corpo azul + tampa vermelha é
                            um produto legítimo), então a cor é detalhe da PARTE,
                            não uma trava do conjunto. */}
                        {part.colors.length > 1 ||
                        (part.colors[0] && part.colors[0].colorKey !== NO_COLOR_KEY) ? (
                          <span className="fg-part-colors">
                            {part.colors
                              .map((c) => `${c.balance} ${c.colorLabel}`)
                              .join(" · ")}
                          </span>
                        ) : null}
                        {part.leftover > 0 ? (
                          <span className="fg-part-note">
                            +{part.leftover} avulsa
                            {part.leftover === 1 ? "" : "s"} (não fecham conjunto)
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={`mono fg-part-bal ${
                          part.balance < 0 ? "sale-neg" : ""
                        }`}
                      >
                        {part.balance} em estoque
                      </span>
                      {/* FEAT-06: o custo congelado médio da parte. */}
                      <span className="fg-part-cost mono">
                        {unit !== null ? `${formatCurrency(unit)}/un` : ""}
                      </span>
                      {/* UX-08: vender / produzir só esta parte (subitem). Produzir
                          fecha conjunto: imprime a peça que falta. */}
                      <span className="fg-part-action">
                        {part.balance > 0
                          ? actionButton(
                              product,
                              <ShoppingCart size={13} />,
                              "Vender",
                              () =>
                                openSaleSubitem(
                                  product!,
                                  pricingByProduct.get(product!.id)!,
                                  part.subitemId,
                                ),
                              "secondary",
                            )
                          : null}
                        {actionButton(
                          product,
                          <Factory size={13} />,
                          "Produzir",
                          () => produce(product!.id, part.subitemId),
                          "secondary",
                        )}
                      </span>
                    </div>
                  );
                })}
                {wholeBalance !== 0 ? (
                  <div className="fg-part">
                    <div className="fg-part-main">
                      <span className="fg-part-name">Inteiro (avulso)</span>
                    </div>
                    <span
                      className={`mono fg-part-bal ${
                        wholeBalance < 0 ? "sale-neg" : ""
                      }`}
                    >
                      {wholeBalance} em estoque
                    </span>
                    <span className="fg-part-cost" />
                    <span className="fg-part-action" />
                  </div>
                ) : null}
              </div>

              {comp.total > 0 ? (
                <div className="section-label">Composição do custo parado</div>
              ) : null}
              {renderCostBars(comp.breakdown, comp.total)}
              {/* O custo de UM conjunto é a soma do custo médio de cada parte —
                  não o valor parado ÷ conjuntos, que diluiria as peças avulsas
                  que sobraram e não formam conjunto. Só quando todas as partes
                  têm saldo (senão a soma estaria incompleta). */}
              {renderMargin(price, wholeUnitCost(good, bd.parts))}
              {/* UX-07a: a composição que era popover, agora inline no dropdown. */}
              <CostBreakdownTable
                real={comp.breakdown}
                realCogs={comp.total}
                realUnknown={comp.unknown}
                note={STOCK_COST_NOTE}
              />
            </div>
          ) : null}
        </div>
      );
    }

    // Produto sem subitens (ou fora do catálogo): lista as SKUs com saldo.
    // FEAT-11: uma linha por SKU = por PEÇA e COR. Num produto de cor única a
    // lista continua com uma linha só (nada muda na tela); com duas cores, o
    // saldo aparece separado — que é o ponto do recurso.
    const rows = good.skus
      .map((sku) => ({
        key: `${sku.subitemId ?? "__whole__"}::${sku.colorKey}`,
        subitemId: sku.subitemId,
        name: sku.subitemId ? sku.name : good.productName,
        colorLabel: sku.colorKey === NO_COLOR_KEY ? "" : sku.colorLabel,
        unitCost: skuUnitCost(sku),
        balance: skuBalance(sku),
      }))
      .filter((row) => row.balance !== 0);
    // FEAT-11: o número da linha é quantas PEÇAS existem — somando as cores. Antes
    // do recurso um produto sem partes tinha uma SKU só e isso era o saldo dela;
    // com a cor na chave, contar SKUs mostraria "2" para quem tem 5 peças em duas
    // cores. A decomposição por cor fica na lista do dropdown.
    const headline = rows.reduce((sum, row) => sum + row.balance, 0);
    // Só é "a mesma peça em N cores" quando nenhuma linha é de subitem (produto
    // que saiu do catálogo pode ter SKUs de partes penduradas aqui).
    const soCores = rows.length > 1 && rows.every((row) => !row.subitemId);

    return (
      <div className={`stock-card fg-card ${isOpen ? "open" : ""}`} key={good.id}>
        <div className="stock-head fg-head" onClick={toggle}>
          <span className="arrow-icon">▼</span>
          <span className="fg-icon" aria-hidden="true">
            <Package size={18} />
          </span>
          <div className="stock-title">
            <strong>{good.productName}</strong>
            <span className="stock-sub">
              {product ? "unidade inteira" : "produto fora do catálogo"} ·{" "}
              <span className="fg-value-inline">
                valor parado{" "}
                <strong className="mono">{formatCurrency(comp.total)}</strong>
              </span>
            </span>
          </div>
          <div className="stock-balance">
            <strong className={`sg ${headline < 0 ? "sale-neg" : ""}`}>
              {headline}
            </strong>
            <span className="sales-total-sub">
              {soCores
                ? `em ${rows.length} cores`
                : rows.length > 1
                  ? `em ${rows.length} SKUs`
                  : "em estoque"}
            </span>
          </div>
        </div>

        {isOpen ? (
          <div className="fg-details">
            {product ? (
              <div className="fg-sell-bar">
                {headline > 0
                  ? actionButton(
                      product,
                      <ShoppingCart size={13} />,
                      "Vender",
                      () =>
                        openSaleWhole(product, pricingByProduct.get(product.id)!),
                      "primary",
                    )
                  : null}
                {actionButton(
                  product,
                  <Factory size={13} />,
                  "Produzir",
                  () => produce(product.id),
                  "secondary",
                )}
                {actionButton(
                  product,
                  <ExternalLink size={13} />,
                  "Ver no catálogo",
                  () => openInCatalog(product.id),
                  "secondary",
                )}
                {pieces > 1 ? (
                  <span className="fg-sell-hint">
                    Cada impressão deste produto rende {pieces} peças (mesa de{" "}
                    {pieces}).
                  </span>
                ) : null}
              </div>
            ) : null}
            {negative ? (
              <div className="fg-warn neg">
                Saldo negativo: vendeu/consumiu mais do que produziu. Registre a
                produção que faltou ou confira as baixas.
              </div>
            ) : !product ? (
              <div className="fg-warn">
                Este produto não está mais no catálogo — o acabado segue aqui com
                o nome e o custo congelados.
              </div>
            ) : null}

            {rows.length > 1 ? (
              <>
                <div className="section-label">
                  {soCores ? "Peças por cor" : "SKUs em estoque"}
                </div>
                <div className="fg-parts">
                  {rows.map((row) => {
                    const unit = row.unitCost;
                    return (
                      <div className="fg-part" key={row.key}>
                        <div className="fg-part-main">
                          <span className="fg-part-name">{row.name}</span>
                          {row.colorLabel ? (
                            <span className="fg-part-colors">{row.colorLabel}</span>
                          ) : null}
                        </div>
                        <span
                          className={`mono fg-part-bal ${
                            row.balance < 0 ? "sale-neg" : ""
                          }`}
                        >
                          {row.balance} em estoque
                        </span>
                        <span className="fg-part-cost mono">
                          {unit !== null ? `${formatCurrency(unit)}/un` : ""}
                        </span>
                        <span className="fg-part-action" />
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}

            {comp.total > 0 ? (
              <div className="section-label">Composição do custo parado</div>
            ) : null}
            {renderCostBars(comp.breakdown, comp.total)}
            {/* SKU única: o custo congelado dela é o custo da unidade vendável.
                FEAT-11: a MESMA peça em várias cores também tem "a" unidade — o
                custo médio ponderado entre as cores é a resposta certa para "se eu
                vender uma hoje, quanto sobra?" (o azul e o vermelho custam
                diferente, mas é a mesma peça pelo mesmo preço). O que continua
                sem média possível é misturar SKUs de PARTES diferentes, num
                produto que saiu do catálogo. */}
            {rows.length === 1
              ? renderMargin(price, rows[0].unitCost)
              : soCores
                ? renderMargin(price, partUnitCost(good, undefined))
                : null}
            {/* UX-07a: a composição que era popover, agora inline no dropdown. */}
            <CostBreakdownTable
              real={comp.breakdown}
              realCogs={comp.total}
              realUnknown={comp.unknown}
              note={STOCK_COST_NOTE}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <main className="wrap" id="conteudo">
      <PageHeader
        title="Estoque"
        meta="Filamento, insumos e produtos — Lopo Lab"
        status={status}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <NavBar />

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

      {/* UX-23 — a introdução saiu de DENTRO da `.stock-bar`, onde dividia a
          linha com o botão e ficava espremida numa medida própria. Agora ela é
          `PageIntro` (mesma largura de leitura das outras páginas) e a barra
          fica só com a ação. */}
      <PageIntro>
        Cada cor guarda os rolos que você comprou, com o preço real de cada um. O
        consumo é do rolo mais antigo para o mais novo. Já dá para escolher a cor
        no produto (o preço/kg sai daqui, do rolo mais novo); a baixa automática
        na venda vem no próximo passo.
      </PageIntro>
      <div className="stock-bar">
        <button
          className="btn primary"
          type="button"
          onClick={() => setCreating(true)}
        >
          <Plus size={15} /> Nova cor
        </button>
      </div>

      <FeedbackNote note={note} onClose={clear} />

      {filaments.length === 0 ? (
        <div className="sales-empty">
          Nenhuma cor cadastrada ainda. Comece pelo filamento que você mais usa —
          cadastre a cor e registre o rolo que está na impressora.
        </div>
      ) : (
        <>
          {active.length > 0 ? (
            <div className="stock-search">
              <SearchBox
                value={colorQuery}
                onChange={setColorQuery}
                placeholder="Buscar cor ou material..."
                resultCount={activeShown.length}
              />
            </div>
          ) : null}
          {activeShown.length === 0 && colorQuery.trim() ? (
            <div className="sales-empty">
              Nenhuma cor encontrada para “{colorQuery.trim()}”.
            </div>
          ) : (
            <div className="stock-list">{activeShown.map(renderCard)}</div>
          )}
        </>
      )}

      {archivedShown.length > 0 ? (
        <details className="stock-archived-box">
          <summary>Cores arquivadas ({archivedShown.length})</summary>
          <div className="stock-list">{archivedShown.map(renderCard)}</div>
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
                    note={STOCK_COST_NOTE}
                    triggerLabel="ver composição"
                    hint="▾"
                    showAmount={false}
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

          {/* UX-23 — aqui a `.stock-bar` não tinha nem botão: era um invólucro
              só para carregar o parágrafo. Sai junto com o `.stock-intro`. */}
          <PageIntro>
            Peças já impressas e ainda não vendidas, com o custo congelado no
            momento da produção. A produção enche este estoque; a venda vai
            esvaziá-lo no próximo passo. Para produtos com subitens, o número em
            destaque é quantos conjuntos completos dá para montar (o menor saldo
            entre as partes). Ao <strong>Produzir</strong>, cada impressão rende a
            quantidade definida em &ldquo;peças por impressão&rdquo; do produto
            (mesa de N) — ajuste a tiragem na tela de Produção.
          </PageIntro>

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
            <>
              <div className="stock-search">
                <SearchBox
                  value={goodQuery}
                  onChange={setGoodQuery}
                  placeholder="Buscar produto..."
                  resultCount={stockedGoodsShown.length}
                />
              </div>
              {stockedGoodsShown.length === 0 ? (
                <div className="sales-empty">
                  Nenhum produto encontrado para “{goodQuery.trim()}”.
                </div>
              ) : (
                <div className="fg-list">
                  {stockedGoodsShown.map(renderProductCard)}
                </div>
              )}
            </>
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

      {saleOpen ? (
        <SaleFlow
          seed={saleSeed}
          products={products}
          machines={machines}
          stock={filaments}
          fixedCosts={fixedCosts}
          pricingByProduct={pricingByProduct}
          onClose={() => setSaleOpen(false)}
        />
      ) : null}

      {dialog}
    </main>
  );
}
