"use client";

import { useState } from "react";
import { todayInputValue, toTimestamp } from "@/lib/formatting/date";
import { filamentLabel } from "../lib/stock";
import type { FilamentRoll, StockFilament } from "../types";
import { NumberInput } from "./NumberInput";

type StockRollModalProps = {
  color: StockFilament;
  onClose: () => void;
  onSave: (roll: FilamentRoll) => Promise<void>;
};

/**
 * Registrar a compra de um rolo (D2). O rolo nasce cheio: `remainingG` =
 * `initialG`. Daí em diante o saldo só se move por consumo (passo 8) ou por
 * ajuste com rastro (D6) — nunca editando o campo direto.
 *
 * A data importa: é ela que ordena o FIFO, não a ordem de cadastro. Registrar
 * hoje um rolo comprado semana passada põe ele na frente da fila, como deve ser.
 */
export function StockRollModal({ color, onClose, onSave }: StockRollModalProps) {
  const [initialG, setInitialG] = useState(1000);
  const [pricePerKg, setPricePerKg] = useState(0);
  const [dateStr, setDateStr] = useState(todayInputValue());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (initialG <= 0) {
      setError("O rolo precisa ter peso (normalmente 1000 g).");
      return;
    }
    if (pricePerKg <= 0) {
      setError("Informe quanto você pagou por kg neste rolo.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSave({
        id: crypto.randomUUID(),
        purchaseDate: toTimestamp(dateStr),
        initialG,
        remainingG: initialG,
        pricePerKg,
        ...(note.trim() ? { note: note.trim() } : {}),
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
        <h3 className="modal-title">Registrar rolo</h3>
        <p className="modal-sub">
          {filamentLabel(color)} — o preço vale só para este rolo. O catálogo
          precifica pelo rolo mais novo (custo de repor) e a venda cobra o rolo
          em uso (custo real).
        </p>

        <div className="stock-form-grid">
          <div className="field-block">
            <div className="section-label">Peso do rolo (g)</div>
            <NumberInput
              aria-label="Peso do rolo em gramas"
              className="field-input"
              min={0}
              value={initialG}
              onChange={setInitialG}
            />
          </div>

          <div className="field-block">
            <div className="section-label">Preço pago (R$/kg)</div>
            <NumberInput
              aria-label="Preço pago por kg"
              className="field-input"
              min={0}
              step="0.01"
              value={pricePerKg}
              onChange={setPricePerKg}
            />
          </div>

          <div className="field-block">
            <div className="section-label">Data da compra</div>
            <input
              aria-label="Data da compra"
              className="field-input"
              type="date"
              value={dateStr}
              onChange={(event) => setDateStr(event.target.value)}
            />
            <div className="field-hint">define a ordem de consumo (FIFO)</div>
          </div>

          <div className="field-block stock-field-wide">
            <div className="section-label">Nota</div>
            <input
              className="field-input"
              type="text"
              value={note}
              placeholder="NF, fornecedor... (opcional)"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="modal-actions">
          <button
            className="btn primary"
            type="button"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Registrar"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
