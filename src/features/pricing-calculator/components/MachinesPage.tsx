"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { formatCurrency, formatDecimal } from "@/lib/formatting/currency";
import { computeMachineRoi, type MachineRoi } from "../lib/machineRoi";
import { useMachines } from "../hooks/useMachines";
import { useSales } from "../hooks/useSales";
import { useTheme } from "../hooks/useTheme";
import type { CloudStatus } from "../types";
import { LogoutButton } from "./LogoutButton";

const statusLabel: Record<CloudStatus, string> = {
  connecting: "Conectando nuvem...",
  synced: "Sincronizado",
  importing: "Importando...",
  error: "Erro de Conexão",
};

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function barWidth(fraction: number): string {
  return `${Math.min(100, Math.max(0, fraction * 100))}%`;
}

function formatMonths(months: number): string {
  if (months < 1) return "menos de 1 mês";
  if (months < 12) return `~${Math.round(months)} ${Math.round(months) === 1 ? "mês" : "meses"}`;
  const years = months / 12;
  return `~${years.toFixed(1).replace(".", ",")} anos`;
}

function formatMonthYear(ms: number): string {
  return new Date(ms)
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(".", "");
}

// Frase de status do payback, do "melhor" caso ao "pior".
function paybackStatus(roi: MachineRoi): { text: string; tone: "pos" | "neg" | "muted" } {
  if (roi.salesCount === 0) {
    return { text: "Sem vendas registradas ainda.", tone: "muted" };
  }
  if (roi.isPaidBack) {
    return {
      text: `Paga! Lucro além da máquina: ${formatCurrency(roi.surplus)}.`,
      tone: "pos",
    };
  }
  if (roi.profit <= 0) {
    return {
      text: `No prejuízo até aqui (${formatCurrency(roi.profit)}). Sem projeção.`,
      tone: "neg",
    };
  }
  if (roi.monthsToPayback !== null && roi.projectedPaybackDate !== null) {
    return {
      text: `Falta ${formatCurrency(roi.remaining)} · ${formatMonths(
        roi.monthsToPayback,
      )} no ritmo atual (por volta de ${formatMonthYear(roi.projectedPaybackDate)}).`,
      tone: "muted",
    };
  }
  return {
    text: `Falta ${formatCurrency(roi.remaining)} · junte ~2 semanas de vendas para projetar o prazo.`,
    tone: "muted",
  };
}

export function MachinesPage() {
  const { theme, toggleTheme } = useTheme();
  const { machines } = useMachines();
  const { sales, status, error } = useSales();

  const rois = useMemo(
    () => computeMachineRoi(machines, sales),
    [machines, sales],
  );

  const totals = useMemo(() => {
    const investment = rois.reduce((sum, r) => sum + r.machine.price, 0);
    const profit = rois.reduce((sum, r) => sum + r.profit, 0);
    const paid = rois.filter((r) => r.isPaidBack).length;
    return { investment, profit, paid, count: rois.length };
  }, [rois]);

  return (
    <main className="wrap">
      <div className="header">
        <div className="brand">
          <div>
            <h1 className="sg">Impressoras</h1>
            <div className="brand-meta">
              <span>ROI e payback — Lopo Lab</span>
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
          <Link className="icon-label-button" href="/vendas">
            <span aria-hidden="true">🧾</span> Vendas
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

      <div className="sales-totals roi-totals">
        <div className="sales-total-card">
          <span>Investimento</span>
          <strong className="sg mono">{formatCurrency(totals.investment)}</strong>
          <span className="sales-total-sub">{totals.count} máquinas</span>
        </div>
        <div className="sales-total-card">
          <span>Lucro acumulado</span>
          <strong
            className={`sg mono ${totals.profit < 0 ? "sale-neg" : "sale-pos"}`}
          >
            {formatCurrency(totals.profit)}
          </strong>
          <span className="sales-total-sub">líquido de taxas</span>
        </div>
        <div className="sales-total-card">
          <span>Máquinas pagas</span>
          <strong className="sg">
            {totals.paid}/{totals.count}
          </strong>
          <span className="sales-total-sub">pelo lucro gerado</span>
        </div>
      </div>

      <p className="roi-note">
        O payback cruza o preço de compra de cada máquina com o lucro que ela já
        gerou nas vendas. A atribuição usa a máquina principal de cada venda — se
        um produto tem uma 2ª etapa em outra impressora, as horas ficam todas na
        principal.
      </p>

      <div className="roi-list">
        {rois.map((roi) => {
          const st = paybackStatus(roi);
          return (
            <div className="roi-card" key={roi.machine.id}>
              <div className="roi-head">
                <div className="roi-title">{roi.machine.name}</div>
                <div className="roi-price mono">
                  {formatCurrency(roi.machine.price)}
                </div>
              </div>

              <div className="roi-block">
                <div className="roi-block-label">
                  <span>Payback do investimento</span>
                  <strong className="mono">{pct(roi.paybackFraction)}</strong>
                </div>
                <div className="roi-bar">
                  <div
                    className={`roi-bar-fill payback ${roi.isPaidBack ? "done" : ""}`}
                    style={{ width: barWidth(roi.paybackFraction) }}
                  />
                </div>
                <div className={`roi-status ${st.tone}`}>{st.text}</div>
              </div>

              <div className="roi-block">
                <div className="roi-block-label">
                  <span>Vida útil consumida</span>
                  <strong className="mono">{pct(roi.lifeUsedFraction)}</strong>
                </div>
                <div className="roi-bar">
                  <div
                    className="roi-bar-fill life"
                    style={{ width: barWidth(roi.lifeUsedFraction) }}
                  />
                </div>
                <div className="roi-status muted">
                  {formatDecimal(roi.printedHours)} h impressas de{" "}
                  {formatDecimal(roi.machine.lifeHours)} h ·{" "}
                  {formatCurrency(roi.depreciationRecovered)} de depreciação já
                  embutida nos preços.
                </div>
              </div>

              <div className="roi-metrics">
                <div className="roi-metric">
                  <span>Vendas</span>
                  <strong className="mono">{roi.salesCount}</strong>
                </div>
                <div className="roi-metric">
                  <span>Receita</span>
                  <strong className="mono">{formatCurrency(roi.revenue)}</strong>
                </div>
                <div className="roi-metric">
                  <span>Lucro</span>
                  <strong
                    className={`mono ${roi.profit < 0 ? "sale-neg" : "sale-pos"}`}
                  >
                    {formatCurrency(roi.profit)}
                  </strong>
                </div>
                <div className="roi-metric">
                  <span>Ritmo</span>
                  <strong className="mono">
                    {roi.profitPerMonth !== null
                      ? `${formatCurrency(roi.profitPerMonth)}/mês`
                      : "—"}
                  </strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
