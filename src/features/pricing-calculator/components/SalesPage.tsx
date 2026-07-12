"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { formatCurrency, formatDecimal } from "@/lib/formatting/currency";
import { PAYMENT_METHODS, SALE_CHANNELS } from "../constants";
import { useSales } from "../hooks/useSales";
import { useTheme } from "../hooks/useTheme";
import type { CloudStatus, Sale } from "../types";

const statusLabel: Record<CloudStatus, string> = {
  connecting: "Conectando nuvem...",
  synced: "Sincronizado",
  importing: "Importando...",
  error: "Erro de Conexão",
};

const paymentLabel = new Map(PAYMENT_METHODS.map((p) => [p.value, p.label]));
const channelLabel = new Map(SALE_CHANNELS.map((c) => [c.value, c.label]));

type Recibo = {
  reciboId: string;
  items: Sale[];
  saleDate: number;
  customer: string;
  channel: Sale["channel"];
  paymentMethod: Sale["paymentMethod"];
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR");
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
      const profit = revenue - cost;
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
        profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      };
    });

    return groups.sort((a, b) => b.saleDate - a.saleDate);
  }, [sales]);

  const totals = useMemo(() => {
    const revenue = sales.reduce((sum, sale) => sum + sale.totalRevenue, 0);
    const cost = sales.reduce((sum, sale) => sum + sale.totalCost, 0);
    const profit = revenue - cost;
    return {
      revenue,
      cost,
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
          <Link className="icon-label-button" href="/">
            <ArrowLeft size={15} /> Calculadora
          </Link>
          <button
            className="icon-label-button"
            type="button"
            onClick={toggleTheme}
          >
            <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
            {theme === "dark" ? "Claro" : "Escuro"}
          </button>
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
          Nenhuma venda registrada ainda. Abra a{" "}
          <Link href="/" className="link-inline">
            calculadora
          </Link>{" "}
          e use <strong>Registrar venda</strong> no card de preço.
        </div>
      ) : (
        <div className="recibo-list">
          {recibos.map((recibo) => (
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
                <div className="recibo-head-totals">
                  <span>
                    Receita{" "}
                    <strong className="mono">
                      {formatCurrency(recibo.revenue)}
                    </strong>
                  </span>
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
    </main>
  );
}
