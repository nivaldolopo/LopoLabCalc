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

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR");
}

function buildCsv(sales: Sale[]): string {
  const headers = [
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

  const ordered = useMemo(
    () => [...sales].sort((a, b) => b.saleDate - a.saleDate),
    [sales],
  );

  const totals = useMemo(() => {
    const revenue = sales.reduce((sum, sale) => sum + sale.totalRevenue, 0);
    const cost = sales.reduce((sum, sale) => sum + sale.totalCost, 0);
    const profit = revenue - cost;
    return {
      count: sales.length,
      revenue,
      cost,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    };
  }, [sales]);

  function exportCsv() {
    const blob = new Blob([`﻿${buildCsv(ordered)}`], {
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
      `Excluir a venda "${sale.productName}" de ${formatDate(sale.saleDate)}? Isso não pode ser desfeito.`,
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
          <strong className="sg">{totals.count}</strong>
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
            disabled={ordered.length === 0}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {ordered.length === 0 ? (
        <div className="sales-empty">
          Nenhuma venda registrada ainda. Abra a{" "}
          <Link href="/" className="link-inline">
            calculadora
          </Link>{" "}
          e use <strong>Registrar venda</strong> no card de preço.
        </div>
      ) : (
        <div className="sales-table-wrap">
          <table className="sales-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th className="num">Qtd</th>
                <th className="num">Preço</th>
                <th className="num">Receita</th>
                <th className="num">Custo</th>
                <th className="num">Lucro</th>
                <th className="num">Margem</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ordered.map((sale) => (
                <tr key={sale.id}>
                  <td>{formatDate(sale.saleDate)}</td>
                  <td>
                    <div className="sales-product">{sale.productName}</div>
                    {sale.material ? (
                      <div className="sales-product-sub">{sale.material}</div>
                    ) : null}
                  </td>
                  <td>{sale.customer || "—"}</td>
                  <td>
                    <span className="sales-badge">
                      {channelLabel.get(sale.channel) ?? sale.channel}
                    </span>
                  </td>
                  <td className="num">{sale.quantity}</td>
                  <td className="num mono">{formatCurrency(sale.salePrice)}</td>
                  <td className="num mono">
                    {formatCurrency(sale.totalRevenue)}
                  </td>
                  <td className="num mono">{formatCurrency(sale.totalCost)}</td>
                  <td
                    className={`num mono ${sale.profit < 0 ? "sale-neg" : "sale-pos"}`}
                  >
                    {formatCurrency(sale.profit)}
                  </td>
                  <td className="num mono">{sale.margin.toFixed(0)}%</td>
                  <td>
                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={() => handleDelete(sale)}
                      title="Excluir venda"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
