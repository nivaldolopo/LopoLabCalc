"use client";

import { useId } from "react";
import type { FixedCostSettings, FixedCostSummary } from "../types";
import { formatCurrency } from "@/lib/formatting/currency";
import { NumberInput } from "./NumberInput";

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
  const fieldId = useId();
  return (
    <div
      className={`fixed-costs-banner ${fixedCosts.enabled ? "" : "collapsed"}`}
    >
      <div className="fc-title">
        {/* UX-29: o `<h2>` é o TEXTO, não a faixa — a faixa também carrega o
            botão de ligar/desligar, e botão dentro de heading é ruído no
            sumário. Sem estilo próprio: herda da faixa, como o `<span>` herdava. */}
        <h2>🏪 Custos fixos mensais do quiosque</h2>
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
      {/* UX-13a (mesmo tema "colapsar o que não está em uso"): desativado, o
          corpo SOME em vez de ficar cinza — eram ~120px mortos no fim do
          formulário. Não se perde nada: o `.fc-body.disabled` já era
          `pointer-events: none`, ou seja os campos nunca foram editáveis com o
          toggle desligado, e o `.toggle-desc` acima já explica o estado.
          ⚠ Estes campos (machines/hoursDay/daysMonth) são a fonte persistida de
          onde a capacidade deriva (TD-010) — ligar o toggle segue sendo o
          caminho pra editá-los. */}
      {fixedCosts.enabled ? (
        <div className="fc-body">
          <div className="fc-grid">
            <div className="fc-item">
              <label htmlFor={`${fieldId}-rent`}>Aluguel (R$/mês)</label>
              <NumberInput
                id={`${fieldId}-rent`}
                min={0}
                value={fixedCosts.rent}
                onChange={(rent) => onChange({ rent })}
              />
            </div>
            <div className="fc-item">
              <label htmlFor={`${fieldId}-other`}>
                Outros custos fixos (R$/mês)
              </label>
              <NumberInput
                id={`${fieldId}-other`}
                min={0}
                value={fixedCosts.other}
                onChange={(other) => onChange({ other })}
                placeholder="contador, internet..."
              />
            </div>
            <div className="fc-item">
              <label htmlFor={`${fieldId}-machines`}>Máquinas operando</label>
              <NumberInput
                id={`${fieldId}-machines`}
                min={0}
                value={fixedCosts.machines}
                onChange={(machines) => onChange({ machines })}
              />
            </div>
            <div className="fc-item">
              <label htmlFor={`${fieldId}-hours-day`}>
                Horas de operação/dia
              </label>
              <NumberInput
                id={`${fieldId}-hours-day`}
                min={0}
                value={fixedCosts.hoursDay}
                onChange={(hoursDay) => onChange({ hoursDay })}
              />
            </div>
            <div className="fc-item">
              <label htmlFor={`${fieldId}-days-month`}>
                Dias de operação/mês
              </label>
              <NumberInput
                id={`${fieldId}-days-month`}
                min={0}
                value={fixedCosts.daysMonth}
                onChange={(daysMonth) => onChange({ daysMonth })}
              />
            </div>
          </div>
          <div className="fc-result">
            <div className="fc-result-item">
              <span className="fclabel">Total fixo/mês</span>
              <span className="fcvalue">
                {formatCurrency(summary.totalFixed)}
              </span>
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
          {fixedCostShare > 30 ? (
            <div className="fc-warning">
              ⚠️ Custo fixo representa {fixedCostShare.toFixed(0)}% do custo
              total — considere desativar e monitorar separadamente.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
