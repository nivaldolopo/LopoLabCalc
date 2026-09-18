"use client";

import { useId } from "react";
import { CARD_BRAND_TIERS, MAX_INSTALLMENTS } from "../constants";
import { MAX_FEE_PCT } from "../lib/paymentFees";
import type { CardBrandTier, PaymentFeeSettings } from "../types";

type PaymentFeesPanelProps = {
  fees: PaymentFeeSettings;
  onChange: (fees: PaymentFeeSettings) => void;
  error?: string | null;
};

function clampFeePct(valueStr: string): number {
  return Math.min(MAX_FEE_PCT, Math.max(0, Number(valueStr) || 0));
}

/**
 * A aba "Taxas" do modal de Configurações.
 *
 * ⚠ Era o `.fee-editor` embutido no `SaleModal` (frente 2, 2026-09-17), atrás
 * do link "Ajustar taxas". A venda continua LENDO `fees` (o toggle
 * repassar/absorver e o cálculo da margem líquida ficam lá) — só a EDIÇÃO da
 * taxa saiu de lá pra cá. Sem RepriceGate de propósito: `config/taxas` só
 * move a dica de margem líquida, nunca a etiqueta (decisão já registrada).
 */
export function PaymentFeesPanel({ fees, onChange, error = null }: PaymentFeesPanelProps) {
  const fieldId = useId();

  function updateFlatFee(key: "pix" | "dinheiro" | "outro", valueStr: string) {
    onChange({ ...fees, [key]: clampFeePct(valueStr) });
  }

  function updateTierDebito(tier: CardBrandTier, valueStr: string) {
    const value = clampFeePct(valueStr);
    onChange({
      ...fees,
      card: { ...fees.card, [tier]: { ...fees.card[tier], debito: value } },
    });
  }

  function updateTierCredito(tier: CardBrandTier, index: number, valueStr: string) {
    const value = clampFeePct(valueStr);
    const credito = fees.card[tier].credito.map((v, i) => (i === index ? value : v));
    onChange({
      ...fees,
      card: { ...fees.card, [tier]: { ...fees.card[tier], credito } },
    });
  }

  return (
    <div>
      <p className="settings-tab-intro">
        Taxas da maquininha (%), por forma de pagamento e bandeira. Valem para
        toda venda seguinte — salvo na nuvem, compartilhado entre aparelhos.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="fee-editor-grid">
        <div className="fee-editor-item">
          <label htmlFor={`${fieldId}-fee-pix`}>Pix</label>
          <input
            id={`${fieldId}-fee-pix`}
            type="number"
            min={0}
            max={MAX_FEE_PCT}
            step="0.1"
            value={fees.pix ?? 0}
            onChange={(event) => updateFlatFee("pix", event.target.value)}
          />
        </div>
        <div className="fee-editor-item">
          <label htmlFor={`${fieldId}-fee-dinheiro`}>Dinheiro</label>
          <input
            id={`${fieldId}-fee-dinheiro`}
            type="number"
            min={0}
            max={MAX_FEE_PCT}
            step="0.1"
            value={fees.dinheiro ?? 0}
            onChange={(event) => updateFlatFee("dinheiro", event.target.value)}
          />
        </div>
        <div className="fee-editor-item">
          <label htmlFor={`${fieldId}-fee-outro`}>Outro</label>
          <input
            id={`${fieldId}-fee-outro`}
            type="number"
            min={0}
            max={MAX_FEE_PCT}
            step="0.1"
            value={fees.outro ?? 0}
            onChange={(event) => updateFlatFee("outro", event.target.value)}
          />
        </div>
      </div>
      {CARD_BRAND_TIERS.map((tier) => (
        <div className="fee-editor-tier" key={tier.value}>
          <div className="fee-editor-subtitle">{tier.label}</div>
          <div className="fee-editor-grid">
            <div className="fee-editor-item">
              <label htmlFor={`${fieldId}-fee-${tier.value}-debito`}>Débito</label>
              <input
                id={`${fieldId}-fee-${tier.value}-debito`}
                type="number"
                min={0}
                max={MAX_FEE_PCT}
                step="0.1"
                value={fees.card[tier.value].debito ?? 0}
                onChange={(event) => updateTierDebito(tier.value, event.target.value)}
              />
            </div>
            {fees.card[tier.value].credito.map((rate, index) => (
              <div className="fee-editor-item" key={index}>
                <label htmlFor={`${fieldId}-fee-${tier.value}-${index}`}>
                  {index === 0 ? "Créd. à vista" : `Créd. ${index + 1}x`}
                </label>
                <input
                  id={`${fieldId}-fee-${tier.value}-${index}`}
                  type="number"
                  min={0}
                  max={MAX_FEE_PCT}
                  step="0.1"
                  value={rate ?? 0}
                  onChange={(event) =>
                    updateTierCredito(tier.value, index, event.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="fee-editor-hint">
        Máximo de {MAX_INSTALLMENTS}x no crédito. Ajuste aqui se a adquirente
        repactuar as taxas.
      </div>
    </div>
  );
}
