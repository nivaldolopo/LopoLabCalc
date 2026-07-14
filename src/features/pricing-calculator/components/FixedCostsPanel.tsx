"use client";

import type { FixedCostSettings, FixedCostSummary } from "../types";
import { formatCurrency } from "@/lib/formatting/currency";

type FixedCostsPanelProps = {
  fixedCosts: FixedCostSettings;
  summary: FixedCostSummary;
  fixedCostShare: number;
  onChange: (patch: Partial<FixedCostSettings>) => void;
};

export function FixedCostsPanel({
  fixedCosts,
  summary,
  fixedCostShare,
  onChange,
}: FixedCostsPanelProps) {
  return (
    <div className="fixed-costs-banner">
      <div className="fc-title">
        <span>🏪 Custos fixos mensais do quiosque</span>
        <button
          className="toggle-wrap"
          type="button"
          onClick={() => onChange({ enabled: !fixedCosts.enabled })}
        >
          <span>
            <span className="toggle-label">
              {fixedCosts.enabled ? "Incluído no preço da peça" : "Desativado"}
            </span>
            <span className="toggle-desc">
              {fixedCosts.enabled
                ? "O aluguel será embutido no custo de cada peça fabricada."
                : "Precifique pelo custo de produção. Monitore o aluguel separadamente no faturamento mensal."}
            </span>
          </span>
          <span className={`toggle-track ${fixedCosts.enabled ? "on" : ""}`}>
            <span className="toggle-thumb" />
          </span>
        </button>
      </div>
      <div className={`fc-body ${fixedCosts.enabled ? "" : "disabled"}`}>
        <div className="fc-grid">
          <div className="fc-item">
            <label>Aluguel (R$/mês)</label>
            <input
              min={0}
              type="number"
              value={fixedCosts.rent}
              onChange={(event) =>
                onChange({ rent: Math.max(0, Number(event.target.value) || 0) })
              }
            />
          </div>
          <div className="fc-item">
            <label>Outros custos fixos (R$/mês)</label>
            <input
              min={0}
              type="number"
              value={fixedCosts.other}
              onChange={(event) =>
                onChange({ other: Math.max(0, Number(event.target.value) || 0) })
              }
              placeholder="contador, internet..."
            />
          </div>
          <div className="fc-item">
            <label>Máquinas operando</label>
            <input
              min={0}
              type="number"
              value={fixedCosts.machines}
              onChange={(event) =>
                onChange({ machines: Math.max(0, Number(event.target.value) || 0) })
              }
            />
          </div>
          <div className="fc-item">
            <label>Horas de operação/dia</label>
            <input
              min={0}
              type="number"
              value={fixedCosts.hoursDay}
              onChange={(event) =>
                onChange({ hoursDay: Math.max(0, Number(event.target.value) || 0) })
              }
            />
          </div>
          <div className="fc-item">
            <label>Dias de operação/mês</label>
            <input
              min={0}
              type="number"
              value={fixedCosts.daysMonth}
              onChange={(event) =>
                onChange({ daysMonth: Math.max(0, Number(event.target.value) || 0) })
              }
            />
          </div>
        </div>
        <div className="fc-result">
          <div className="fc-result-item">
            <span className="fclabel">Total fixo/mês</span>
            <span className="fcvalue">{formatCurrency(summary.totalFixed)}</span>
          </div>
          <div className="fc-result-item">
            <span className="fclabel">Horas totais de produção/mês</span>
            <span className="fcvalue">{summary.hoursMonth}h</span>
          </div>
          <div className="fc-result-item">
            <span className="fclabel">Custo fixo/hora</span>
            <span className="fcvalue accent">
              {formatCurrency(summary.perHour)}/h
            </span>
          </div>
          <div className="fc-result-item">
            <span className="fclabel">Incluído nesta impressão</span>
            <span className="fcvalue accent">
              {formatCurrency(summary.perPrint)}
            </span>
          </div>
        </div>
        {fixedCosts.enabled && fixedCostShare > 30 ? (
          <div className="fc-warning">
            ⚠️ Custo fixo representa {fixedCostShare.toFixed(0)}% do custo total —
            considere desativar e monitorar separadamente.
          </div>
        ) : null}
      </div>
    </div>
  );
}
