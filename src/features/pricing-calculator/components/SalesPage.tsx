"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { errorMessage, guardOnline } from "@/lib/errors";
import { formatCurrency, formatDecimal } from "@/lib/formatting/currency";
import {
  DEFAULT_FIXED_COSTS,
  PAYMENT_METHODS,
  SALE_CHANNELS,
} from "../constants";
import { calculatePricing } from "../lib/calculatePricing";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useFees } from "../hooks/useFees";
import { useFinishedGoods } from "../hooks/useFinishedGoods";
import { useMachines } from "../hooks/useMachines";
import { useProducts } from "../hooks/useProducts";
import { useSalesPage } from "../hooks/useSalesPage";
import { useStock } from "../hooks/useStock";
import { useSupplies } from "../hooks/useSupplies";
import { useTheme } from "../hooks/useTheme";
import { marginTierClass, marginTierTitle } from "../lib/marginTier";
import { reverseReciboReconciliation } from "../lib/saleReconciliation";
import type { ProductionEvent, RoundingMode, Sale } from "../types";
import {
  fetchAllSales,
  reconcileRecibo,
  type SalesQuery,
} from "@/lib/firebase/salesRepository";
import { fetchProductionEventsByIds } from "@/lib/firebase/productionRepository";
import { toTimestamp } from "@/lib/formatting/date";
import { matchesQuery } from "@/lib/text";
import { useConfirm } from "./ConfirmDialog";
import { CostBreakdownTable } from "./CostDetail";
import { FeedbackNote, useFeedback } from "./FeedbackNote";
import { HistoryFilterBar } from "./HistoryFilterBar";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { SaleModal, type EditReciboSeed } from "./SaleModal";
import {
  productPrintHours,
  saleContextFromResult,
  saleContextFromSubitem,
  type SaleModalContext,
} from "../lib/saleContext";

const paymentLabel = new Map(PAYMENT_METHODS.map((p) => [p.value, p.label]));
const channelLabel = new Map(SALE_CHANNELS.map((c) => [c.value, c.label]));

// Ordenação da lista de vendas (espelha o catálogo, mas sobre recibos).
type SalesSortMode =
  | "recent"
  | "oldest"
  | "customer-az"
  | "customer-za"
  | "revenue-desc"
  | "revenue-asc"
  | "profit-desc"
  | "profit-asc"
  | "margin-desc"
  | "margin-asc";

type Recibo = {
  reciboId: string;
  items: Sale[];
  saleDate: number;
  // BUG-03: `saleDate` guarda só o DIA → recibos do mesmo dia empatam. O
  // `createdAt` (timestamp cheio, o mais recente do recibo) é o desempate.
  createdAt: number;
  customer: string;
  channel: Sale["channel"];
  paymentMethod: Sale["paymentMethod"];
  cardBrandTier?: Sale["cardBrandTier"];
  installments?: Sale["installments"];
  revenue: number;
  cost: number;
  fee: number;
  profit: number;
  margin: number;
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR");
}

// Reconstrói a foto congelada (SaleModalContext) a partir de uma venda salva,
// para reabrir o item no modal em modo edição sem recalcular custo/preço.
function contextFromSale(
  sale: Sale,
  roundingMode: RoundingMode,
): SaleModalContext {
  return {
    defaultProductName: sale.productName,
    productId: sale.productId,
    // FEAT-01: preserva o subitem vendido ao reabrir para editar.
    ...(sale.subitemId ? { subitemId: sale.subitemId } : {}),
    machineId: sale.machineId,
    machineName: sale.machineName,
    printHours: sale.printHours,
    // Vendas antigas não têm a repartição → reconstrói uma entrada única com a
    // máquina principal (mantém o snapshot congelado ao reabrir para editar).
    machineUsage:
      sale.machineUsage && sale.machineUsage.length > 0
        ? sale.machineUsage
        : [
            {
              machineId: sale.machineId,
              machineName: sale.machineName,
              hours: sale.printHours,
              depreciation: sale.costBreakdown.depreciation,
            },
          ],
    suggestedPrice: sale.suggestedPrice,
    roundingMode,
    unitCost: sale.unitCost,
    costBreakdown: sale.costBreakdown,
    // FEAT-02: preserva o consumo por cor congelado (vazio nas vendas antigas).
    filaments: sale.filaments ?? [],
  };
}

function buildCsv(sales: Sale[]): string {
  const headers = [
    "Recibo",
    "Data",
    "Produto",
    "Material",
    "Cliente",
    "Canal",
    "Pagamento",
    "Maquina",
    "Horas",
    "Qtd",
    "Preco Sugerido (R$)",
    "Preco Venda (R$)",
    "Desconto (R$)",
    "Custo Unit (R$)",
    "Custo Total (R$)",
    "Receita (R$)",
    "Taxa (%)",
    "Taxa (R$)",
    "Repassada",
    "Lucro (R$)",
    "Margem (%)",
    "Observacoes",
  ];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = sales.map((sale) =>
    [
      escape(sale.reciboId),
      formatDate(sale.saleDate),
      escape(sale.productName),
      escape(sale.material),
      escape(sale.customer),
      channelLabel.get(sale.channel) ?? sale.channel,
      paymentLabel.get(sale.paymentMethod) ?? sale.paymentMethod,
      escape(sale.machineName),
      formatDecimal(sale.printHours),
      String(sale.quantity),
      formatDecimal(sale.suggestedPrice),
      formatDecimal(sale.salePrice),
      formatDecimal(sale.discountAmount ?? 0),
      formatDecimal(sale.unitCost),
      formatDecimal(sale.totalCost),
      formatDecimal(sale.totalRevenue),
      formatDecimal(sale.feeRate),
      formatDecimal(sale.feeAmount),
      sale.feePassedToCustomer ? "Sim" : "Nao",
      formatDecimal(sale.profit),
      sale.margin.toFixed(0),
      escape(sale.notes),
    ].join(";"),
  );
  return [headers.join(";"), ...rows].join("\r\n");
}

export function SalesPage() {
  const { theme, toggleTheme } = useTheme();
  // TD-006 Fase 3: filtro server-side (produto + período) + refino por nome
  // (client-side sobre a janela carregada).
  const [filterProductId, setFilterProductId] = useState("");
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const salesFilter = useMemo<SalesQuery>(
    () => ({
      productId: filterProductId || null,
      start: startStr ? toTimestamp(startStr) : null,
      end: endStr ? toTimestamp(endStr) : null,
    }),
    [filterProductId, startStr, endStr],
  );
  const { sales, totals: salesTotals, hasMore, loadMore, status, error } =
    useSalesPage(salesFilter);
  const { products } = useProducts();
  const { machines } = useMachines();
  const { fixedCostRate } = useBusinessSettings();
  const { fees, saveFees } = useFees();
  // Passo 8: dados vivos para a reconciliação (custo real + baixa por caminho).
  const { filaments: stock } = useStock();
  // 7e: insumos — o estorno da venda devolve também os acessórios da encomenda.
  const { supplies } = useSupplies();
  const { goods } = useFinishedGoods();
  const [editRecibo, setEditRecibo] = useState<EditReciboSeed | null>(null);
  // TD-006: eventos de produção da encomenda do recibo em edição, resolvidos por
  // id ao abrir (a coleção não é mais assinada inteira). Alimentam o estorno do
  // SaleModal — sem eles, editar uma venda antiga não devolveria o filamento.
  const [editEvents, setEditEvents] = useState<ProductionEvent[]>([]);
  const [newSale, setNewSale] = useState(false);
  const [sortMode, setSortMode] = useState<SalesSortMode>("recent");
  // UX-06: qual item do recibo está com o detalhe aberto (linha + dropdown).
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);
  // UX-15: esta página não tinha aviso de escrita nenhum — a exclusão (que
  // estorna acabado + filamento) falhava em silêncio.
  const { note, ok, fail, clear } = useFeedback();
  const { ask, dialog } = useConfirm();

  // Taxa de custo fixo real do negócio (TD-001) para reprecificar os itens de
  // catálogo ao editar um recibo. O toggle `enabled` vem do produto.
  const fixedCosts = useMemo(
    () => ({ ...DEFAULT_FIXED_COSTS, ...fixedCostRate }),
    [fixedCostRate],
  );

  // Produtos do catálogo como itens prontos, para adicionar mais linhas a um
  // recibo durante a edição (mesma lista alfabética do modal de venda).
  const catalogItems = useMemo<SaleModalContext[]>(
    () =>
      products
        .flatMap((product) => {
          const result = calculatePricing(product, machines, fixedCosts);
          const baseName = product.name || product.mainStageName || "";
          // FEAT-01: inteiro + um item vendável por subitem (mesma lista do
          // modal aberto pela calculadora).
          const whole = saleContextFromResult(
            baseName,
            product.id,
            result,
            productPrintHours(product),
            product.roundingMode,
          );
          const subs = (result.subitems ?? []).map((subitem) =>
            saleContextFromSubitem(
              baseName,
              product.id,
              subitem,
              product.roundingMode,
            ),
          );
          return [whole, ...subs];
        })
        .sort((a, b) =>
          a.defaultProductName.localeCompare(b.defaultProductName, "pt-BR"),
        ),
    [products, machines, fixedCosts],
  );

  // Agrupa as vendas por recibo (fase 1b): itens de uma mesma compra ficam juntos.
  const recibos = useMemo<Recibo[]>(() => {
    const map = new Map<string, Sale[]>();
    for (const sale of sales) {
      const group = map.get(sale.reciboId);
      if (group) group.push(sale);
      else map.set(sale.reciboId, [sale]);
    }

    const groups: Recibo[] = [...map.entries()].map(([reciboId, items]) => {
      const revenue = items.reduce((sum, item) => sum + item.totalRevenue, 0);
      const cost = items.reduce((sum, item) => sum + item.totalCost, 0);
      const fee = items.reduce((sum, item) => sum + item.feeAmount, 0);
      // Lucro do recibo = soma do lucro (já LÍQUIDO de taxa) de cada item.
      const profit = items.reduce((sum, item) => sum + item.profit, 0);
      const first = items[0];
      return {
        reciboId,
        items: [...items].sort((a, b) => a.createdAt - b.createdAt),
        saleDate: Math.max(...items.map((item) => item.saleDate)),
        createdAt: Math.max(...items.map((item) => item.createdAt)),
        customer: first.customer,
        channel: first.channel,
        paymentMethod: first.paymentMethod,
        cardBrandTier: first.cardBrandTier,
        installments: first.installments,
        revenue,
        cost,
        fee,
        profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      };
    });

    return groups.sort(
      (a, b) => b.saleDate - a.saleDate || b.createdAt - a.createdAt,
    );
  }, [sales]);

  const sortedRecibos = useMemo<Recibo[]>(() => {
    const next = [...recibos];
    switch (sortMode) {
      case "oldest":
        return next.sort(
          (a, b) => a.saleDate - b.saleDate || a.createdAt - b.createdAt,
        );
      case "customer-az":
        return next.sort((a, b) =>
          (a.customer || "").localeCompare(b.customer || "", "pt-BR"),
        );
      case "customer-za":
        return next.sort((a, b) =>
          (b.customer || "").localeCompare(a.customer || "", "pt-BR"),
        );
      case "revenue-desc":
        return next.sort((a, b) => b.revenue - a.revenue);
      case "revenue-asc":
        return next.sort((a, b) => a.revenue - b.revenue);
      case "profit-desc":
        return next.sort((a, b) => b.profit - a.profit);
      case "profit-asc":
        return next.sort((a, b) => a.profit - b.profit);
      case "margin-desc":
        return next.sort((a, b) => b.margin - a.margin);
      case "margin-asc":
        return next.sort((a, b) => a.margin - b.margin);
      case "recent":
      default:
        return next.sort(
          (a, b) => b.saleDate - a.saleDate || b.createdAt - a.createdAt,
        );
    }
  }, [recibos, sortMode]);

  // Opções do seletor de produto do filtro (catálogo atual, por nome).
  const productOptions = useMemo(
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
  // produto ou cliente. Não mexe nos totais (que refletem o filtro server-side).
  const visibleRecibos = useMemo(() => {
    if (!nameQuery.trim()) return sortedRecibos;
    return sortedRecibos.filter((recibo) =>
      matchesQuery(
        nameQuery,
        recibo.customer,
        ...recibo.items.map((item) => item.productName),
      ),
    );
  }, [sortedRecibos, nameQuery]);

  const hasServerFilter =
    filterProductId !== "" || startStr !== "" || endStr !== "";

  // TD-006: os cards somam o histórico INTEIRO via aggregation query
  // (`salesTotals`), não a janela paginada. Só a margem é derivada aqui.
  const margin =
    salesTotals.revenue > 0
      ? (salesTotals.profit / salesTotals.revenue) * 100
      : 0;

  // TD-006: o export lê o histórico COMPLETO sob demanda (`fetchAllSales`) — não a
  // janela paginada — para o CSV nunca sair truncado. É ação explícita do dono.
  async function exportCsv() {
    const flat = await fetchAllSales();
    const blob = new Blob([`﻿${buildCsv(flat)}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vendas-lopolab-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(sale: Sale) {
    const hasReversal =
      (sale.finishedMoves?.length ?? 0) > 0 ||
      (sale.productionEventIds?.length ?? 0) > 0;
    const confirmed = await ask({
      title: `Excluir “${sale.productName}” (${formatDate(sale.saleDate)})?`,
      body: (
        <>
          <p>A receita sai do histórico e dos totais do período.</p>
          {hasReversal ? (
            <p className="confirm-safe">
              O que a venda consumiu <strong>volta</strong>: a peça acabada
              retorna ao estoque e, se foi encomenda, o filamento e os insumos
              são estornados junto com os eventos de produção dela.
            </p>
          ) : null}
          <p>Isso não pode ser desfeito.</p>
        </>
      ),
      confirmLabel: "Excluir venda",
      danger: true,
    });
    if (!confirmed) return;

    // UX-15: até aqui este caminho era o único da app que gravava sem aviso
    // nenhum — falha de estorno passava em silêncio e a linha só não sumia.
    try {
      guardOnline();
      // Passo 8: excluir uma venda estorna o que ela consumiu — acabado (finishedMoves)
      // e/ou filamento das encomendas — e apaga os eventos de produção, tudo atômico.
      // TD-006: os eventos vêm por id do banco (não da janela paginada) — um evento
      // já apagado à mão vem ausente e não estorna em dobro, como antes.
      const events = await fetchProductionEventsByIds(
        sale.productionEventIds ?? [],
      );
      const { colorUpdates, supplyUpdates, finishedUpdates } =
        reverseReciboReconciliation(
          sale.finishedMoves ?? [],
          events.flatMap((event) => event.stockMoves),
          goods,
          stock,
          supplies,
        );
      await reconcileRecibo({
        saleUpserts: [],
        saleRemovedIds: [sale.id],
        productionCreates: [],
        productionDeleteIds: events.map((event) => event.id),
        colorUpdates,
        supplyUpdates,
        finishedUpdates,
      });
      ok(
        hasReversal
          ? `“${sale.productName}” excluída e o estoque estornado.`
          : `“${sale.productName}” excluída do histórico.`,
      );
    } catch (err) {
      fail(
        `Não foi possível excluir “${sale.productName}”: ${errorMessage(err)}`,
      );
    }
  }

  async function openEdit(recibo: Recibo) {
    // TD-006: resolve por id os eventos de produção das encomendas do recibo, para
    // o estorno na edição (a janela paginada pode não conter os eventos antigos).
    const ids = recibo.items.flatMap((item) => item.productionEventIds ?? []);
    setEditEvents(await fetchProductionEventsByIds(ids));
    setEditRecibo({
      reciboId: recibo.reciboId,
      customer: recibo.customer,
      saleDate: recibo.saleDate,
      paymentMethod: recibo.paymentMethod,
      cardBrandTier: recibo.cardBrandTier,
      installments: recibo.installments,
      channel: recibo.channel,
      feePassedToCustomer: recibo.items[0]?.feePassedToCustomer ?? false,
      // notes é compartilhado no recibo — pega o primeiro item que tiver.
      notes: recibo.items.find((item) => item.notes)?.notes ?? "",
      items: recibo.items.map((sale) => ({
        id: sale.id,
        // O snapshot da venda não guarda o modo de arredondamento; usa o do
        // produto atual (se ainda existe) ou um fallback redondo (R$ 0,50).
        source: contextFromSale(
          sale,
          products.find((product) => product.id === sale.productId)
            ?.roundingMode ?? "0.5",
        ),
        productName: sale.productName,
        quantity: sale.quantity,
        salePrice: sale.salePrice,
        createdAt: sale.createdAt,
        // FEAT-09: reabre a venda com o desconto congelado (modo + valor + R$).
        ...(sale.discountKind ? { discountKind: sale.discountKind } : {}),
        ...(sale.discountInput ? { discountInput: sale.discountInput } : {}),
        ...(sale.discountAmount !== undefined
          ? { discountAmount: sale.discountAmount }
          : {}),
        // Passo 8: carrega o rastro da reconciliação salva para o estorno da edição.
        ...(sale.origem ? { origem: sale.origem } : {}),
        ...(sale.finishedMoves ? { finishedMoves: sale.finishedMoves } : {}),
        // FEAT-11: as cores escolhidas voltam para a linha — reeditar o recibo
        // reaplica a baixa na MESMA prateleira de onde a peça saiu.
        ...(sale.finishedColors ? { finishedColors: sale.finishedColors } : {}),
        ...(sale.productionEventIds
          ? { productionEventIds: sale.productionEventIds }
          : {}),
      })),
    });
  }

  return (
    <main className="wrap" id="conteudo">
      <PageHeader
        title="Vendas"
        meta="Histórico de vendas — Lopo Lab"
        status={status}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <NavBar>
        <button
          className="icon-label-button"
          type="button"
          onClick={() => setNewSale(true)}
          disabled={catalogItems.length === 0}
          title={
            catalogItems.length === 0
              ? "Cadastre um produto na calculadora antes de registrar uma venda"
              : "Registrar uma nova venda"
          }
        >
          <Plus size={15} /> Nova venda
        </button>
      </NavBar>

      {error ? <div className="app-error">{error}</div> : null}

      <FeedbackNote note={note} onClose={clear} />

      <div className="sales-totals">
        <div className="sales-total-card">
          <span>Vendas</span>
          <strong className="sg">{salesTotals.count}</strong>
          <span className="sales-total-sub">itens no histórico</span>
        </div>
        <div className="sales-total-card">
          <span>Receita</span>
          <strong className="sg mono">
            {formatCurrency(salesTotals.revenue)}
          </strong>
        </div>
        <div className="sales-total-card">
          <span>Custo</span>
          <strong className="sg mono">{formatCurrency(salesTotals.cost)}</strong>
        </div>
        <div className="sales-total-card">
          <span>Lucro</span>
          {/* UX-20: a cor mora na % (logo abaixo, na sub-linha "margem"); aqui
              só sobra o `.sale-neg` do valor negativo. A regra inteira está no
              `auth-sale.css`, no bloco do `.sale-pos`. */}
          <strong className={`sg mono ${salesTotals.profit < 0 ? "sale-neg" : ""}`}>
            {formatCurrency(salesTotals.profit)}
          </strong>
          <span className="sales-total-sub">
            margem{" "}
            <span
              className={marginTierClass(margin)}
              title={marginTierTitle(margin)}
            >
              {margin.toFixed(0)}%
            </span>
          </span>
        </div>
      </div>

      <div className="catalog-header">
        {/* UX-29 — `<h2>`, o par do que o `ProductCatalog` já fazia. */}
        <h2 className="catalog-title">Histórico</h2>
        <div className="catalog-actions">
          <select
            value={sortMode}
            onChange={(event) =>
              setSortMode(event.target.value as SalesSortMode)
            }
          >
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
            <option value="customer-az">Cliente (A→Z)</option>
            <option value="customer-za">Cliente (Z→A)</option>
            <option value="revenue-desc">Receita (maior)</option>
            <option value="revenue-asc">Receita (menor)</option>
            <option value="profit-desc">Lucro (maior)</option>
            <option value="profit-asc">Lucro (menor)</option>
            <option value="margin-desc">Margem (maior)</option>
            <option value="margin-asc">Margem (menor)</option>
          </select>
          <button
            className="icon-label-button"
            type="button"
            onClick={() => void exportCsv()}
            disabled={recibos.length === 0}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      <HistoryFilterBar
        products={productOptions}
        productId={filterProductId}
        onProductId={setFilterProductId}
        startStr={startStr}
        onStart={setStartStr}
        endStr={endStr}
        onEnd={setEndStr}
        name={nameQuery}
        onName={setNameQuery}
        namePlaceholder="Refinar por produto ou cliente…"
        resultCount={visibleRecibos.length}
      />

      {visibleRecibos.length === 0 ? (
        <div className="sales-empty">
          {hasServerFilter || nameQuery.trim() ? (
            "Nenhuma venda para esse filtro."
          ) : (
            <>
              Nenhuma venda registrada ainda. Use{" "}
              <strong>Nova venda</strong> no topo da página, ou abra a{" "}
              <Link href="/" className="link-inline">
                calculadora
              </Link>{" "}
              e registre pelo card de preço.
            </>
          )}
        </div>
      ) : (
        <>
        <div className="recibo-list">
          {visibleRecibos.map((recibo) => (
            <div className="recibo-card" key={recibo.reciboId}>
              <div className="recibo-head">
                <div className="recibo-head-main">
                  <span className="recibo-date">
                    {formatDate(recibo.saleDate)}
                  </span>
                  {/* UX-19: "Sem cliente" é um campo VAZIO — não pode ocupar a
                      posição de maior ênfase da linha em toda venda. Mudo
                      (muted2, peso normal), mas continua escrito: a ausência do
                      nome sozinha não diria que o campo existe. */}
                  <span
                    className={`recibo-customer ${recibo.customer ? "" : "is-empty"}`}
                  >
                    {recibo.customer || "Sem cliente"}
                  </span>
                  <span className="sales-badge">
                    {channelLabel.get(recibo.channel) ?? recibo.channel}
                  </span>
                  <span className="recibo-pay">
                    {paymentLabel.get(recibo.paymentMethod) ??
                      recibo.paymentMethod}
                  </span>
                  {recibo.items.length > 1 ? (
                    <span className="recibo-count">
                      {recibo.items.length} itens
                    </span>
                  ) : null}
                </div>
                <div className="recibo-head-side">
                  <div className="recibo-head-totals">
                    <span>
                      Receita{" "}
                      <strong className="mono">
                        {formatCurrency(recibo.revenue)}
                      </strong>
                    </span>
                    {recibo.fee > 0 ? (
                      <span>
                        Taxa{" "}
                        <strong className="mono sale-neg">
                          −{formatCurrency(recibo.fee)}
                        </strong>
                      </span>
                    ) : null}
                    <span>
                      Lucro{" "}
                      {/* UX-20 (2026-08-16) REVERTEU o que estava escrito aqui:
                          o R$ NÃO segue mais verde/vermelho no positivo — a cor
                          mora só na %, que já carrega a faixa da DEC-04. Ter os
                          dois era o mesmo verde dobrado quando a margem era boa
                          e dois recados opostos quando ela caía. Regra completa
                          no `auth-sale.css`, bloco do `.sale-pos`.
                          ⚠ Aqui a margem é REALIZADA (já líquida da taxa),
                          diferente da precificada do catálogo; a régua é a
                          mesma por decisão do dono. */}
                      <strong className={`mono ${recibo.profit < 0 ? "sale-neg" : ""}`}>
                        {formatCurrency(recibo.profit)} (
                        <span
                          className={marginTierClass(recibo.margin)}
                          title={marginTierTitle(recibo.margin)}
                        >
                          {recibo.margin.toFixed(0)}%
                        </span>
                        )
                      </strong>
                    </span>
                  </div>
                  <button
                    className="icon-button edit"
                    type="button"
                    onClick={() => void openEdit(recibo)}
                    title="Editar venda"
                  >
                    <Edit3 size={15} />
                  </button>
                </div>
              </div>

              {/* BUG-06: o `.recibo-card` tem `overflow: hidden` (é ele que
                  arredonda o cartão) e a tabela é mais larga que ele no
                  celular — o excedente não rolava, era CORTADO. Medido a
                  375×812: 345px de cartão contra 414…471px de tabela, e é
                  justamente ali que ficam a coluna de lucro e o botão de
                  excluir. Este scroller devolve o acesso; o `overflow: hidden`
                  do cartão fica. */}
              <div className="recibo-items-scroll">
              <table className="recibo-items">
                {/* UX-21 — cada recibo era uma <table> PRÓPRIA em layout
                    automático, então as colunas se dimensionavam pelo nome mais
                    longo DAQUELE recibo. Medido a 1280 com 23 recibos na tela:
                    até 39px de deslocamento entre a mesma coluna de recibos
                    diferentes (a auditoria tinha visto 8px entre dois vizinhos).
                    Este colgroup + o `table-layout: fixed` do CSS dão a TODOS a
                    mesma grade. As faixas de número são fixas (largura medida no
                    DOM); o nome é o resto, e é ele quem absorve a variação. */}
                <colgroup>
                  <col />
                  <col className="ri-col-qty" />
                  <col className="ri-col-money" />
                  <col className="ri-col-money" />
                  <col className="ri-col-cost" />
                  <col className="ri-col-money" />
                  <col className="ri-col-actions" />
                </colgroup>
                <tbody>
                  {recibo.items.map((sale) => {
                    const isOpen = openSaleId === sale.id;
                    return (
                      <Fragment key={sale.id}>
                        {/* UX-06: a linha do item vira gatilho; o dropdown abaixo
                            absorve o antigo popover de custo (CostBreakdownTable). */}
                        <tr
                          className={`ri-row ${isOpen ? "open" : ""}`}
                          onClick={() =>
                            setOpenSaleId((current) =>
                              current === sale.id ? null : sale.id,
                            )
                          }
                        >
                          <td className="ri-name">
                            <span className="arrow-icon">▼</span>
                            <span className="ri-name-text">
                              <span className="sales-product">
                                {sale.productName}
                              </span>
                              {sale.material ? (
                                <span className="sales-product-sub">
                                  {sale.material}
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="num mono ri-qty">{sale.quantity}×</td>
                          <td className="num mono ri-price">
                            {formatCurrency(sale.salePrice)}
                            {sale.discountAmount && sale.discountAmount > 0 ? (
                              <div className="ri-discount sale-neg">
                                −{formatCurrency(sale.discountAmount)}
                                {sale.discountKind === "total"
                                  ? " (rateado)"
                                  : ""}
                              </div>
                            ) : null}
                          </td>
                          <td className="num mono ri-rev">
                            {formatCurrency(sale.totalRevenue)}
                          </td>
                          <td className="ri-cost mono">
                            custo real{" "}
                            <strong>
                              {formatCurrency(
                                sale.unitCost * Math.max(1, sale.quantity),
                              )}
                            </strong>
                          </td>
                          {/* UX-20 — EXCEÇÃO DELIBERADA, não esquecimento: a
                              linha do item não tem % ao lado, então é o R$ que
                              carrega o sinal. "Sem % companheira, a cor mora no
                              R$" (sub-decisão (c) do dono). Não uniformizar com
                              o cabeçalho do recibo logo acima — lá existe %,
                              aqui não. */}
                          <td
                            className={`num mono ri-profit ${sale.profit < 0 ? "sale-neg" : "sale-pos"}`}
                          >
                            {formatCurrency(sale.profit)}
                          </td>
                          <td className="ri-actions">
                            <button
                              className="icon-button danger"
                              type="button"
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation();
                                handleDelete(sale);
                              }}
                              title="Excluir item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                        {isOpen ? (
                          <tr className="ri-details-row">
                            <td colSpan={7}>
                              <div className="ri-details">
                                <div className="cd-meta">
                                  <span>
                                    <span className="db-label">Máquina</span>{" "}
                                    {sale.machineName || "—"}
                                  </span>
                                  <span>
                                    <span className="db-label">Tempo</span>{" "}
                                    {formatDecimal(sale.printHours)} h
                                  </span>
                                  <span>
                                    <span className="db-label">Qtd</span>{" "}
                                    {sale.quantity}×
                                  </span>
                                  {/* FEAT-11: de que cor a peça pronta saiu,
                                      congelado na venda (a cor pode ser
                                      renomeada ou arquivada depois). */}
                                  {sale.finishedColorLabel ? (
                                    <span>
                                      <span className="db-label">
                                        Cor vendida
                                      </span>{" "}
                                      {sale.finishedColorLabel}
                                    </span>
                                  ) : null}
                                  {sale.discountAmount &&
                                  sale.discountAmount > 0 ? (
                                    <span>
                                      <span className="db-label">Desconto</span>{" "}
                                      {sale.discountInput
                                        ? sale.discountInput.mode === "pct"
                                          ? `${sale.discountInput.value}%`
                                          : formatCurrency(
                                              sale.discountInput.value,
                                            )
                                        : ""}
                                      {sale.discountKind === "total"
                                        ? " (rateado do total)"
                                        : ""}{" "}
                                      = −{formatCurrency(sale.discountAmount)}
                                    </span>
                                  ) : null}
                                </div>

                                {sale.filaments &&
                                sale.filaments.length > 0 ? (
                                  <div className="details-span">
                                    <div className="db-label">
                                      Filamento por cor
                                    </div>
                                    <div className="details-tags">
                                      {sale.filaments.map((fil, index) => (
                                        <span key={fil.id ?? index}>
                                          {fil.colorName || "(cor)"}{" "}
                                          <em>
                                            {Math.round(fil.totalG)} g ·{" "}
                                            {formatCurrency(fil.pricePerKg)}/kg
                                          </em>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                <CostBreakdownTable
                                  breakdown={sale.costBreakdown}
                                  real={sale.realCostBreakdown}
                                  realCogs={sale.unitCost}
                                  quantity={sale.quantity}
                                />
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>

              {recibo.items.some((item) => item.notes) ? (
                <div className="recibo-notes">
                  {recibo.items.find((item) => item.notes)?.notes}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {hasMore ? (
          <div className="load-more-row">
            <button
              className="btn ghost load-more"
              type="button"
              onClick={loadMore}
            >
              Carregar mais vendas
            </button>
          </div>
        ) : null}
        </>
      )}

      {editRecibo ? (
        <SaleModal
          editRecibo={editRecibo}
          catalogItems={catalogItems}
          fees={fees}
          onFeesChange={saveFees}
          goods={goods}
          stock={stock}
          supplies={supplies}
          products={products}
          machines={machines}
          fixedCosts={fixedCosts}
          production={editEvents}
          onClose={() => {
            setEditRecibo(null);
            setEditEvents([]);
          }}
          onConfirm={reconcileRecibo}
        />
      ) : null}

      {newSale ? (
        <SaleModal
          seed={null}
          catalogItems={catalogItems}
          fees={fees}
          onFeesChange={saveFees}
          goods={goods}
          stock={stock}
          supplies={supplies}
          products={products}
          machines={machines}
          fixedCosts={fixedCosts}
          // Venda nova não estorna produção — o `production` só serve à edição.
          production={[]}
          onClose={() => setNewSale(false)}
          onConfirm={reconcileRecibo}
        />
      ) : null}

      {dialog}
    </main>
  );
}
