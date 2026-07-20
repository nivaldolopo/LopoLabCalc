"use client";

import { useMemo } from "react";
import { formatCurrency, formatDecimal } from "@/lib/formatting/currency";
import { computeMachineRoi, type MachineRoi } from "../lib/machineRoi";
import { useMachines } from "../hooks/useMachines";
import { useProduction } from "../hooks/useProduction";
import { useSales } from "../hooks/useSales";
import { useTheme } from "../hooks/useTheme";
import type { CloudStatus } from "../types";
import { NavBar } from "./NavBar";

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
  const { events: production } = useProduction();

  const rois = useMemo(
    () => computeMachineRoi(machines, sales, production),
    [machines, sales, production],
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
      </div>
      <NavBar theme={theme} onToggleTheme={toggleTheme} />

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
        O <strong>payback</strong> cruza o preço de compra de cada máquina com o
        lucro que ela já gerou nas vendas (o lucro/receita/depreciação são
        repartidos pela máquina certa quando o produto usa mais de uma). A{" "}
        <strong>vida útil</strong> vem do registro de produção: toda impressão
        desgasta a máquina, inclusive teste, falha e brinde que nunca viram venda.
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
                  {formatDecimal(roi.machine.lifeHours)} h em{" "}
                  {roi.printedCount}{" "}
                  {roi.printedCount === 1 ? "impressão" : "impressões"} ·{" "}
                  {formatCurrency(roi.depreciationRecovered)} de depreciação já
                  embutida nos preços de venda.
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
