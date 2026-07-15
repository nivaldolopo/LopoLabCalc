"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Edit3, Plus, Trash2 } from "lucide-react";
import { formatCurrency, formatDecimal } from "@/lib/formatting/currency";
import {
  DEFAULT_FIXED_COSTS,
  PAYMENT_METHODS,
  SALE_CHANNELS,
} from "../constants";
import { calculatePricing } from "../lib/calculatePricing";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useFees } from "../hooks/useFees";
import { useMachines } from "../hooks/useMachines";
import { useProducts } from "../hooks/useProducts";
import { useSales } from "../hooks/useSales";
import { useTheme } from "../hooks/useTheme";
import type { CloudStatus, RoundingMode, Sale } from "../types";
import { saveRecibo } from "@/lib/firebase/salesRepository";
import { LogoutButton } from "./LogoutButton";
import { SaleModal, type EditReciboSeed } from "./SaleModal";
import {
  productPrintHours,
  saleContextFromResult,
  type SaleModalContext,
} from "../lib/saleContext";

const statusLabel: Record<CloudStatus, string> = {
  connecting: "Conectando nuvem...",
  synced: "Sincronizado",
  importing: "Importando...",
  error: "Erro de Conexão",
};

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
  customer: string;
  channel: Sale["channel"];
  paymentMethod: Sale["paymentMethod"];
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
  const { sales, status, error, deleteSale } = useSales();
  const { products } = useProducts();
  const { machines } = useMachines();
  const { fixedCostRate } = useBusinessSettings();
  const { fees, saveFees } = useFees();
  const [editRecibo, setEditRecibo] = useState<EditReciboSeed | null>(null);
  const [newSale, setNewSale] = useState(false);
  const [sortMode, setSortMode] = useState<SalesSortMode>("recent");

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
        .map((product) =>
          saleContextFromResult(
            product.name || product.mainStageName || "",
            product.id,
            calculatePricing(product, machines, fixedCosts),
            productPrintHours(product),
            product.roundingMode,
          ),
        )
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
        customer: first.customer,
        channel: first.channel,
        paymentMethod: first.paymentMethod,
        revenue,
        cost,
        fee,
        profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      };
    });

    return groups.sort((a, b) => b.saleDate - a.saleDate);
  }, [sales]);

  const sortedRecibos = useMemo<Recibo[]>(() => {
    const next = [...recibos];
    switch (sortMode) {
      case "oldest":
        return next.sort((a, b) => a.saleDate - b.saleDate);
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
        return next.sort((a, b) => b.saleDate - a.saleDate);
    }
  }, [recibos, sortMode]);

  const totals = useMemo(() => {
    const revenue = sales.reduce((sum, sale) => sum + sale.totalRevenue, 0);
    const cost = sales.reduce((sum, sale) => sum + sale.totalCost, 0);
    const fee = sales.reduce((sum, sale) => sum + sale.feeAmount, 0);
    const profit = sales.reduce((sum, sale) => sum + sale.profit, 0);
    return {
      revenue,
      cost,
      fee,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    };
  }, [sales]);

  function exportCsv() {
    const flat = recibos.flatMap((recibo) => recibo.items);
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
    const ok = window.confirm(
      `Excluir "${sale.productName}" (${formatDate(sale.saleDate)})? Isso não pode ser desfeito.`,
    );
    if (!ok) return;
    await deleteSale(sale.id);
  }

  function openEdit(recibo: Recibo) {
    setEditRecibo({
      reciboId: recibo.reciboId,
      customer: recibo.customer,
      saleDate: recibo.saleDate,
      paymentMethod: recibo.paymentMethod,
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
        material: sale.material,
        quantity: sale.quantity,
        salePrice: sale.salePrice,
        createdAt: sale.createdAt,
      })),
    });
  }

  return (
    <main className="wrap">
      <div className="header">
        <div className="brand">
          <div>
            <h1 className="sg">Vendas</h1>
            <div className="brand-meta">
              <span>Histórico de vendas — Lopo Lab</span>
              <span className={`cloud-status ${status}`}>
                {statusLabel[status]}
              </span>
            </div>
          </div>
        </div>
        <div className="header-actions">
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
          <Link className="icon-label-button" href="/">
            <ArrowLeft size={15} /> Calculadora
          </Link>
          <Link className="icon-label-button" href="/orcamento">
            <span aria-hidden="true">📄</span> Orçamento
          </Link>
          <Link className="icon-label-button" href="/maquinas">
            <span aria-hidden="true">🖨️</span> Impressoras
          </Link>
          <Link className="icon-label-button" href="/estoque">
            <span aria-hidden="true">📦</span> Estoque
          </Link>
          <button
            className="icon-label-button"
            type="button"
            onClick={toggleTheme}
          >
            <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
            {theme === "dark" ? "Claro" : "Escuro"}
          </button>
          <LogoutButton />
        </div>
      </div>

      {error ? <div className="app-error">{error}</div> : null}

      <div className="sales-totals">
        <div className="sales-total-card">
          <span>Vendas</span>
          <strong className="sg">{recibos.length}</strong>
          <span className="sales-total-sub">{sales.length} itens</span>
        </div>
        <div className="sales-total-card">
          <span>Receita</span>
          <strong className="sg mono">{formatCurrency(totals.revenue)}</strong>
        </div>
        <div className="sales-total-card">
          <span>Custo</span>
          <strong className="sg mono">{formatCurrency(totals.cost)}</strong>
        </div>
        <div className="sales-total-card">
          <span>Lucro</span>
          <strong
            className={`sg mono ${totals.profit < 0 ? "sale-neg" : "sale-pos"}`}
          >
            {formatCurrency(totals.profit)}
          </strong>
          <span className="sales-total-sub">
            margem {totals.margin.toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="catalog-header">
        <div className="catalog-title">Histórico</div>
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
            onClick={exportCsv}
            disabled={recibos.length === 0}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {recibos.length === 0 ? (
        <div className="sales-empty">
          Nenhuma venda registrada ainda. Use{" "}
          <strong>Nova venda</strong> no topo da página, ou abra a{" "}
          <Link href="/" className="link-inline">
            calculadora
          </Link>{" "}
          e registre pelo card de preço.
        </div>
      ) : (
        <div className="recibo-list">
          {sortedRecibos.map((recibo) => (
            <div className="recibo-card" key={recibo.reciboId}>
              <div className="recibo-head">
                <div className="recibo-head-main">
                  <span className="recibo-date">
                    {formatDate(recibo.saleDate)}
                  </span>
                  <span className="recibo-customer">
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
                      <strong
                        className={`mono ${recibo.profit < 0 ? "sale-neg" : "sale-pos"}`}
                      >
                        {formatCurrency(recibo.profit)} (
                        {recibo.margin.toFixed(0)}%)
                      </strong>
                    </span>
                  </div>
                  <button
                    className="icon-button edit"
                    type="button"
                    onClick={() => openEdit(recibo)}
                    title="Editar venda"
                  >
                    <Edit3 size={15} />
                  </button>
                </div>
              </div>

              <table className="recibo-items">
                <tbody>
                  {recibo.items.map((sale) => (
                    <tr key={sale.id}>
                      <td className="ri-name">
                        <div className="sales-product">{sale.productName}</div>
                        {sale.material ? (
                          <div className="sales-product-sub">
                            {sale.material}
                          </div>
                        ) : null}
                      </td>
                      <td className="num mono ri-qty">{sale.quantity}×</td>
                      <td className="num mono ri-price">
                        {formatCurrency(sale.salePrice)}
                      </td>
                      <td className="num mono ri-rev">
                        {formatCurrency(sale.totalRevenue)}
                      </td>
                      <td className="num mono muted ri-cost">
                        custo {formatCurrency(sale.totalCost)}
                      </td>
                      <td
                        className={`num mono ri-profit ${sale.profit < 0 ? "sale-neg" : "sale-pos"}`}
                      >
                        {formatCurrency(sale.profit)}
                      </td>
                      <td className="ri-actions">
                        <button
                          className="icon-button danger"
                          type="button"
                          onClick={() => handleDelete(sale)}
                          title="Excluir item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {recibo.items.some((item) => item.notes) ? (
                <div className="recibo-notes">
                  {recibo.items.find((item) => item.notes)?.notes}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {editRecibo ? (
        <SaleModal
          editRecibo={editRecibo}
          catalogItems={catalogItems}
          fees={fees}
          onFeesChange={saveFees}
          onClose={() => setEditRecibo(null)}
          onConfirm={saveRecibo}
        />
      ) : null}

      {newSale ? (
        <SaleModal
          seed={null}
          catalogItems={catalogItems}
          fees={fees}
          onFeesChange={saveFees}
          onClose={() => setNewSale(false)}
          onConfirm={saveRecibo}
        />
      ) : null}
    </main>
  );
}
