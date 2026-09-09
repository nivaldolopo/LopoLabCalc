"use client";

import { useId, useState } from "react";
import type { FixedCostRate, FixedCostSettings, FixedCostSummary } from "../types";
import { formatCurrency } from "@/lib/formatting/currency";
import { describeFixedCostChanges } from "../lib/changeLog";
import { NumberInput } from "./NumberInput";

// A taxa GLOBAL que vive no `config/negocio`, separada do toggle `enabled` (que
// é por-produto). É ela que o rascunho abaixo edita.
function rateOf(fixedCosts: FixedCostSettings): FixedCostRate {
  return {
    rent: fixedCosts.rent,
    other: fixedCosts.other,
    machines: fixedCosts.machines,
    hoursDay: fixedCosts.hoursDay,
    daysMonth: fixedCosts.daysMonth,
  };
}

type FixedCostsPanelProps = {
  fixedCosts: FixedCostSettings;
  // [FEAT-12] — o resumo do RASCUNHO, não só o do que está em vigor: enquanto o
  // dono digita, o "custo fixo/hora" tem de acompanhar o que ele está digitando.
  // Quem sabe as horas da impressão é o pai, então a conta vem dele.
  summaryFor: (rate: FixedCostRate) => FixedCostSummary;
  fixedCostShare: number;
  // Só o toggle `enabled` (por-produto) passa por aqui agora. A TAXA é global e
  // reprecifica o catálogo inteiro — ela sai pelo `onApplyRate`, com prévia.
  onChange: (patch: Partial<FixedCostSettings>) => void;
  // [FEAT-12] — abre o passo de confirmação com o rascunho. Só é chamado quando
  // há mudança de verdade.
  onApplyRate: (rate: FixedCostRate) => void;
  // TD-029 — a última falha ao gravar a taxa no `config/negocio`. Estes campos
  // alimentam o custo fixo por hora do catálogo INTEIRO: offline eles mudavam na
  // tela, sem nada dizendo que o doc compartilhado não tinha mudado.
  saveError?: string | null;
};

/**
 * ⚠ [FEAT-12] — este painel GRAVAVA A CADA TECLA.
 *
 * O `config/negocio` é compartilhado e em tempo real, e o custo fixo/hora dele
 * alimenta o catálogo INTEIRO: cada dígito digitado aqui reprecificava todos os
 * produtos com `includeFixed`, em todos os aparelhos, sem prévia e sem rastro —
 * e passar de "1500" para "300" atravessava "150" e "15" no caminho, gravando os
 * três. Agora os campos editam um RASCUNHO local, e aplicar é um ato: o botão
 * abre a prévia, que diz quantos produtos se movem antes de qualquer escrita.
 *
 * O rascunho nasce do que está em vigor e é RECRIADO quando o valor vivo muda —
 * o pai remonta o painel por `key` (ver `PricingCalculator`). É a mesma
 * disciplina do `MachineManagerModal`, sem o efeito que o lint proíbe: quando o
 * doc compartilhado muda por baixo, um rascunho calculado contra o valor velho
 * já não descreve o "antes" de ninguém.
 */
export function FixedCostsPanel({
  fixedCosts,
  summaryFor,
  fixedCostShare,
  onChange,
  onApplyRate,
  saveError = null,
}: FixedCostsPanelProps) {
  const fieldId = useId();
  const emVigor = rateOf(fixedCosts);
  const [draft, setDraft] = useState<FixedCostRate>(emVigor);
  // Quem decide "mudou?" é a MESMA função que redige as linhas da prévia —
  // duas respostas para a mesma pergunta é como elas divergem.
  const mudancas = describeFixedCostChanges(emVigor, draft);
  const summary = summaryFor(draft);

  function updateRate(patch: Partial<FixedCostRate>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

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
              <label htmlFor={`${fieldId}-hours-day`}>
                Horas de operação/dia
              </label>
              <NumberInput
                id={`${fieldId}-hours-day`}
                min={0}
                value={draft.hoursDay}
                onChange={(hoursDay) => updateRate({ hoursDay })}
              />
            </div>
            <div className="fc-item">
              <label htmlFor={`${fieldId}-days-month`}>
                Dias de operação/mês
              </label>
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
          {/* [FEAT-12] — a barra de aplicar. Ela SÓ existe quando há mudança:
              um botão permanentemente aceso convidaria a gravar o que já está
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
                onClick={() => setDraft(emVigor)}
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
