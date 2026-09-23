"use client";

import { useId, useState } from "react";
import { CARD_BRAND_TIERS, MAX_INSTALLMENTS } from "../constants";
import { MAX_FEE_PCT } from "../lib/paymentFees";
import type { CardBrandTier, PaymentFeeSettings } from "../types";
import { NumberInput } from "./NumberInput";

type PaymentFeesPanelProps = {
  fees: PaymentFeeSettings;
  // Grava as taxas; devolve a mensagem de erro, ou `null` se gravou (TD-020).
  onSave: (fees: PaymentFeeSettings) => Promise<string | null>;
  // A falha do último save. Vem de FORA porque este painel remonta quando o
  // cache já mudou — antes de o save responder (ver `SettingsModal`).
  error: string | null;
};

/**
 * A aba "Taxas" do modal de Configurações.
 *
 * ⚠ Era o `.fee-editor` embutido no `SaleModal` (frente 2, 2026-09-17), atrás
 * do link "Ajustar taxas". A venda continua LENDO `fees` (o toggle
 * repassar/absorver e o cálculo da margem líquida ficam lá) — só a EDIÇÃO da
 * taxa saiu de lá pra cá. Sem RepriceGate de propósito: `config/taxas` só
 * move a dica de margem líquida, nunca a etiqueta (decisão já registrada).
 *
 * [V8] Mas sem gate não quer dizer "grava a cada tecla": era assim, com
 * `<input type="number">` cru — uma escrita no Firestore por dígito, e a
 * vírgula engolida (o `143,53 → 14353` do UX-41). Agora é o molde das outras
 * abas: `NumberInput` num RASCUNHO, e "Salvar" só quando há mudança.
 */
export function PaymentFeesPanel({ fees, onSave, error }: PaymentFeesPanelProps) {
  const fieldId = useId();
  const [draft, setDraft] = useState<PaymentFeeSettings>(fees);
  const [saving, setSaving] = useState(false);
  const sujo = JSON.stringify(draft) !== JSON.stringify(fees);

  function updateFlatFee(key: "pix" | "dinheiro" | "outro", value: number) {
    setDraft((atual) => ({ ...atual, [key]: value }));
  }

  function updateTierDebito(tier: CardBrandTier, value: number) {
    setDraft((atual) => ({
      ...atual,
      card: { ...atual.card, [tier]: { ...atual.card[tier], debito: value } },
    }));
  }

  function updateTierCredito(tier: CardBrandTier, index: number, value: number) {
    setDraft((atual) => {
      const credito = atual.card[tier].credito.map((v, i) => (i === index ? value : v));
      return {
        ...atual,
        card: { ...atual.card, [tier]: { ...atual.card[tier], credito } },
      };
    });
  }

  async function salvar() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  }

  function campo(
    id: string,
    label: string,
    value: number,
    onChange: (value: number) => void,
  ) {
    return (
      <div className="fee-editor-item" key={id}>
        <label htmlFor={id}>{label}</label>
        <NumberInput
          id={id}
          min={0}
          max={MAX_FEE_PCT}
          step={0.1}
          value={value ?? 0}
          onChange={onChange}
        />
      </div>
    );
  }

  return (
    <div>
      <p className="settings-tab-intro">
        Taxas da maquininha (%), por forma de pagamento e bandeira. Valem para
        toda venda seguinte — salvo na nuvem, compartilhado entre aparelhos.
      </p>
      <div className="fee-editor-grid">
        {campo(`${fieldId}-fee-pix`, "Pix", draft.pix, (v) => updateFlatFee("pix", v))}
        {campo(`${fieldId}-fee-dinheiro`, "Dinheiro", draft.dinheiro, (v) =>
          updateFlatFee("dinheiro", v),
        )}
        {campo(`${fieldId}-fee-outro`, "Outro", draft.outro, (v) =>
          updateFlatFee("outro", v),
        )}
      </div>
      {CARD_BRAND_TIERS.map((tier) => (
        <div className="fee-editor-tier" key={tier.value}>
          <div className="fee-editor-subtitle">{tier.label}</div>
          <div className="fee-editor-grid">
            {campo(
              `${fieldId}-fee-${tier.value}-debito`,
              "Débito",
              draft.card[tier.value].debito,
              (v) => updateTierDebito(tier.value, v),
            )}
            {draft.card[tier.value].credito.map((rate, index) =>
              campo(
                `${fieldId}-fee-${tier.value}-${index}`,
                index === 0 ? "Créd. à vista" : `Créd. ${index + 1}x`,
                rate,
                (v) => updateTierCredito(tier.value, index, v),
              ),
            )}
          </div>
        </div>
      ))}
      <div className="fee-editor-hint">
        Máximo de {MAX_INSTALLMENTS}x no crédito. Ajuste aqui se a adquirente
        repactuar as taxas.
      </div>
      {sujo ? (
        <div className="fc-apply" role="group" aria-label="Alteração pendente das taxas">
          <span className="fc-apply-text">
            Taxas alteradas — ainda não valem. Movem só a margem líquida das
            vendas seguintes, não o preço de etiqueta.
          </span>
          <button className="btn primary" type="button" onClick={salvar} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setDraft(fees)}
          >
            Descartar
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
