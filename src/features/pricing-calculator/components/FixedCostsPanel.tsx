"use client";

import type { FixedCostSettings, FixedCostSummary } from "../types";
import { formatCurrency } from "@/lib/formatting/currency";

type FixedCostsPanelProps = {
  fixedCosts: FixedCostSettings;
  summary: FixedCostSummary;
  onChange: (patch: Partial<FixedCostSettings>) => void;
};

export function FixedCostsPanel({
  fixedCosts,
  summary,
  onChange,
}: FixedCostsPanelProps) {
  return (
    <div className="fixed-costs-banner">
      <div className="fc-title">
        <span>Custos fixos mensais do quiosque</span>
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
                : "Precifique pelo custo de produção e monitore o aluguel separadamente."}
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
              type="number"
              value={fixedCosts.rent}
              onChange={(event) =>
                onChange({ rent: Number(event.target.value) || 0 })
              }
            />
          </div>
          <div className="fc-item">
            <label>Outros custos fixos (R$/mês)</label>
            <input
              type="number"
              value={fixedCosts.other}
              onChange={(event) =>
                onChange({ other: Number(event.target.value) || 0 })
              }
              placeholder="contador, internet..."
            />
          </div>
          <div className="fc-item">
            <label>Máquinas operando</label>
            <input
              type="number"
              value={fixedCosts.machines}
              onChange={(event) =>
                onChange({ machines: Number(event.target.value) || 0 })
              }
            />
          </div>
          <div className="fc-item">
            <label>Horas de operação/dia</label>
            <input
              type="number"
              value={fixedCosts.hoursDay}
              onChange={(event) =>
                onChange({ hoursDay: Number(event.target.value) || 0 })
              }
            />
          </div>
          <div className="fc-item">
            <label>Dias de operação/mês</label>
            <input
              type="number"
              value={fixedCosts.daysMonth}
              onChange={(event) =>
                onChange({ daysMonth: Number(event.target.value) || 0 })
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
        <button
          className="markup-fixed-row"
          type="button"
          onClick={() => onChange({ markupOnFixed: !fixedCosts.markupOnFixed })}
        >
          <span className={`toggle-track ${fixedCosts.markupOnFixed ? "on" : ""}`}>
            <span className="toggle-thumb" />
          </span>
          <span>
            <span className="mf-label">Aplicar markup sobre custo fixo</span>
            <span className="mf-sub">
              {fixedCosts.markupOnFixed
                ? "Ativado - markup multiplica também o custo fixo"
                : "Desativado - custo fixo entra direto no preço"}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
