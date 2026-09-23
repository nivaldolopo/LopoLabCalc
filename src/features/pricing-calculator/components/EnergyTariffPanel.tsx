"use client";

import { useId, useState } from "react";
import { formatUnitCurrency } from "@/lib/formatting/currency";
import { describeEnergyTariffChange } from "../lib/changeLog";
import { NumberInput } from "./NumberInput";

type EnergyTariffPanelProps = {
  // A tarifa GLOBAL em vigor (`config/negocio`). Era `ProductInput.energyTariff`
  // (por produto) até a frente 2 (2026-09-17) — todo produto usa energia, então
  // não há toggle por-produto aqui, ao contrário do custo fixo.
  tariff: number;
  // [FEAT-12] — abre o passo de confirmação com o rascunho. Só é chamado
  // quando há mudança de verdade.
  onApplyTariff: (tariff: number) => void;
  saveError?: string | null;
};

/**
 * A aba "Energia" do modal de Configurações.
 *
 * Mesma disciplina das outras alavancas GLOBAIS (máquinas, custo fixo): o
 * campo edita um RASCUNHO local, aplicar é um ato consciente com prévia
 * (`RepriceGate`, montado por quem hospeda esta aba).
 */
export function EnergyTariffPanel({
  tariff,
  onApplyTariff,
  saveError = null,
}: EnergyTariffPanelProps) {
  const fieldId = useId();
  const [draft, setDraft] = useState<number>(tariff);
  const mudancas = describeEnergyTariffChange(tariff, draft);

  return (
    <div>
      <p className="settings-tab-intro">
        A tarifa da conta de luz (R$/kWh, com imposto e bandeira), usada no
        custo de TODO produto — não há &ldquo;incluir energia&rdquo; por peça,
        ao contrário do custo fixo.
      </p>
      <div className="fc-grid">
        <div className="fc-item">
          <label htmlFor={`${fieldId}-energy`}>Tarifa de energia (R$/kWh)</label>
          <NumberInput
            id={`${fieldId}-energy`}
            min={0}
            step={0.01}
            value={draft}
            onChange={setDraft}
          />
        </div>
      </div>
      <div className="fc-result">
        <div className="fc-result-item">
          <span className="fclabel">Em vigor</span>
          <span className="fcvalue accent">{formatUnitCurrency(tariff)}/kWh</span>
        </div>
      </div>
      {mudancas.length > 0 ? (
        <div className="fc-apply" role="group" aria-label="Alteração pendente da tarifa de energia">
          <span className="fc-apply-text">
            <strong>Tarifa alterada</strong> — ainda não vale. Ela reprecifica{" "}
            <strong>todos os produtos</strong> do catálogo, em todos os
            aparelhos.
          </span>
          <button
            className="btn primary"
            type="button"
            onClick={() => onApplyTariff(draft)}
          >
            Revisar e aplicar
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setDraft(tariff)}
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
