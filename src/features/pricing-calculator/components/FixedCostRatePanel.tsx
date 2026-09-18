"use client";

import { useId, useState } from "react";
import type { FixedCostRate } from "../types";
import { formatCurrency } from "@/lib/formatting/currency";
import { calculateFixedCostSummary } from "../lib/calculatePricing";
import { describeFixedCostChanges } from "../lib/changeLog";
import { NumberInput } from "./NumberInput";

type FixedCostRatePanelProps = {
  // A taxa GLOBAL em vigor (`config/negocio`). O toggle `enabled` NÃO entra
  // aqui — ele é por-produto e continua na calculadora (ver `FixedCostsPanel`).
  rate: FixedCostRate;
  // [FEAT-12] — abre o passo de confirmação com o rascunho. Só é chamado
  // quando há mudança de verdade.
  onApplyRate: (rate: FixedCostRate) => void;
  saveError?: string | null;
};

/**
 * A aba "Custo fixo" do modal de Configurações.
 *
 * ⚠ Era o CORPO do `FixedCostsPanel` da calculadora (frente 2, 2026-09-17): a
 * calculadora fica só com o TOGGLE por-produto (`includeFixed`); os campos da
 * taxa global — que reprecificam o catálogo inteiro, não só o produto em
 * edição — moram aqui, sempre visíveis (não há "desativado" nesta tela: o
 * toggle de exibir é por produto, a taxa é do negócio).
 *
 * Mesma disciplina do antigo painel: os campos editam um RASCUNHO local,
 * aplicar é um ato consciente com prévia (`RepriceGate`, montado por quem
 * hospeda esta aba). "Incluído nesta impressão" saiu do resumo — não há
 * produto em edição aqui para calcular.
 */
export function FixedCostRatePanel({
  rate,
  onApplyRate,
  saveError = null,
}: FixedCostRatePanelProps) {
  const fieldId = useId();
  const [draft, setDraft] = useState<FixedCostRate>(rate);
  const mudancas = describeFixedCostChanges(rate, draft);
  const summary = calculateFixedCostSummary({ ...draft, enabled: true }, 0);

  function updateRate(patch: Partial<FixedCostRate>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <div>
      <p className="settings-tab-intro">
        A taxa do aluguel/quiosque, ratada pelas horas de produção do mês.
        Vale para todo produto que marcar &ldquo;Incluir custo fixo&rdquo; na
        calculadora.
      </p>
      <div className="fc-grid">
        <div className="fc-item">
          <label htmlFor={`${fieldId}-rent`}>Aluguel (R$/mês)</label>
          <NumberInput
            id={`${fieldId}-rent`}
            min={0}
            value={draft.rent}
            onChange={(rent) => updateRate({ rent })}
          />
        </div>
        <div className="fc-item">
          <label htmlFor={`${fieldId}-other`}>
            Outros custos fixos (R$/mês)
          </label>
          <NumberInput
            id={`${fieldId}-other`}
            min={0}
            value={draft.other}
            onChange={(other) => updateRate({ other })}
            placeholder="contador, internet..."
          />
        </div>
        <div className="fc-item">
          <label htmlFor={`${fieldId}-machines`}>Máquinas operando</label>
          <NumberInput
            id={`${fieldId}-machines`}
            min={0}
            value={draft.machines}
            onChange={(machines) => updateRate({ machines })}
          />
        </div>
        <div className="fc-item">
          <label htmlFor={`${fieldId}-hours-day`}>Horas de operação/dia</label>
          <NumberInput
            id={`${fieldId}-hours-day`}
            min={0}
            value={draft.hoursDay}
            onChange={(hoursDay) => updateRate({ hoursDay })}
          />
        </div>
        <div className="fc-item">
          <label htmlFor={`${fieldId}-days-month`}>Dias de operação/mês</label>
          <NumberInput
            id={`${fieldId}-days-month`}
            min={0}
            value={draft.daysMonth}
            onChange={(daysMonth) => updateRate({ daysMonth })}
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
      </div>
      {/* [FEAT-12] — a barra de aplicar. Ela SÓ existe quando há mudança: um
          botão permanentemente aceso convidaria a gravar o que já está
          gravado, e cada gravação desta taxa é uma reprecificação global. */}
      {mudancas.length > 0 ? (
        <div className="fc-apply" role="group" aria-label="Alteração pendente do custo fixo">
          <span className="fc-apply-text">
            <strong>
              {mudancas.length === 1
                ? "1 campo alterado"
                : `${mudancas.length} campos alterados`}
            </strong>{" "}
            — ainda não valem. Esta taxa reprecifica{" "}
            <strong>todos os produtos</strong> que incluem custo fixo, em
            todos os aparelhos.
          </span>
          <button
            className="btn primary"
            type="button"
            onClick={() => onApplyRate(draft)}
          >
            Revisar e aplicar
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setDraft(rate)}
          >
            Descartar
          </button>
        </div>
      ) : null}
      {saveError ? (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}
