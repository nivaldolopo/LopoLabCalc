"use client";

import { useState } from "react";
import { formatDate, todayInputValue, toTimestamp } from "@/lib/formatting/date";
import { num } from "@/lib/number";
import { lotNumbers } from "../lib/supplies";
import type { Supply } from "../types";
import { NumberInput } from "./NumberInput";

type SupplyAdjustModalProps = {
  supply: Supply;
  onClose: () => void;
  onSave: (input: {
    lotId: string;
    counted: number;
    reason: string;
    at: number;
  }) => Promise<void>;
};

/**
 * Ajuste de inventário do insumo (D6) — gêmeo do `StockAdjustModal`. Contou os
 * ímãs na gaveta e o saldo diverge? É por aqui, nunca editando `remainingQty` na
 * mão: o rastro guarda o que o sistema achava e o que você contou.
 *
 * Também é o remédio do D4: com saldo negativo por overdraft, a contagem
 * registra o furo com o tamanho que ele tinha.
 */
export function SupplyAdjustModal({
  supply,
  onClose,
  onSave,
}: SupplyAdjustModalProps) {
  const numbers = lotNumbers(supply);
  // Ordem FIFO na lista: o lote em uso é o primeiro candidato à contagem.
  const lots = [...supply.lots].sort(
    (a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0),
  );

  const [lotId, setLotId] = useState(lots[0]?.id ?? "");
  const selected = lots.find((lot) => lot.id === lotId) ?? null;
  const before = num(selected?.remainingQty);

  const [counted, setCounted] = useState(before);
  const [reason, setReason] = useState("");
  const [dateStr, setDateStr] = useState(todayInputValue());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const delta = counted - before;

  async function save() {
    if (!selected) {
      setError("Escolha o lote que você contou.");
      return;
    }
    if (!reason.trim()) {
      setError("Diga o motivo — é o que dá sentido ao rastro depois.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSave({
        lotId,
        counted,
        reason: reason.trim(),
        at: toTimestamp(dateStr),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay open" onMouseDown={onClose}>
      <div className="modal-box" onMouseDown={(event) => event.stopPropagation()}>
        <h3 className="modal-title">Ajuste de inventário</h3>
        <p className="modal-sub">
          {supply.name} — conte o que existe de verdade e informe aqui. O que o
          sistema achava fica guardado no histórico, junto com o motivo.
        </p>

        <div className="stock-form-grid">
          <div className="field-block stock-field-wide">
            <div className="section-label">Lote contado</div>
            <select
              className="field-input"
              value={lotId}
              onChange={(event) => {
                const next = lots.find((lot) => lot.id === event.target.value);
                setLotId(event.target.value);
                // O contado parte do saldo atual: quem só confere um lote certo
                // não precisa redigitar o número.
                setCounted(num(next?.remainingQty));
              }}
            >
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  Lote #{numbers.get(lot.id)} · comprado em{" "}
                  {formatDate(lot.purchaseDate)} · sistema:{" "}
                  {Math.round(num(lot.remainingQty))} {supply.unit}
                </option>
              ))}
            </select>
          </div>

          <div className="field-block">
            <div className="section-label">Contado ({supply.unit})</div>
            <NumberInput
              aria-label="Quantidade contada"
              className="field-input"
              min={0}
              value={counted}
              onChange={setCounted}
            />
          </div>

          <div className="field-block">
            <div className="section-label">Data da contagem</div>
            <input
              aria-label="Data da contagem"
              className="field-input"
              type="date"
              value={dateStr}
              onChange={(event) => setDateStr(event.target.value)}
            />
          </div>

          <div className="field-block stock-field-wide">
            <div className="section-label">Motivo</div>
            <input
              className="field-input"
              type="text"
              value={reason}
              placeholder="Contagem, caiu no chão, veio menos que a nota..."
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>

        {selected ? (
          <div
            className={`stock-delta ${delta === 0 ? "zero" : delta > 0 ? "pos" : "neg"}`}
          >
            {delta === 0
              ? "Sem diferença — o sistema já estava certo."
              : `O saldo do lote vai de ${Math.round(before)} para ${Math.round(
                  counted,
                )} ${supply.unit} (${delta > 0 ? "+" : "−"}${Math.round(
                  Math.abs(delta),
                )}).`}
          </div>
        ) : null}

        {error ? <div className="form-error">{error}</div> : null}

        <div className="modal-actions">
          <button
            className="btn primary"
            type="button"
            onClick={save}
            disabled={saving || !selected}
          >
            {saving ? "Salvando..." : "Registrar ajuste"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
