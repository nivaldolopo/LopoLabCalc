"use client";

import { useState } from "react";
import { todayInputValue, toTimestamp } from "@/lib/formatting/date";
import type { Supply, SupplyLot } from "../types";
import { NumberInput } from "./NumberInput";

type SupplyLotModalProps = {
  supply: Supply;
  onClose: () => void;
  onSave: (lot: SupplyLot) => Promise<void>;
};

/**
 * Registrar a compra de um lote de insumo — gêmeo do `StockRollModal`. O lote
 * nasce cheio (`remainingQty` = `initialQty`) e daí em diante só se move por
 * consumo (produção) ou por ajuste com rastro (D6).
 *
 * A data importa: é ela que ordena o FIFO, não a ordem de cadastro.
 */
export function SupplyLotModal({ supply, onClose, onSave }: SupplyLotModalProps) {
  const [initialQty, setInitialQty] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);
  const [dateStr, setDateStr] = useState(todayInputValue());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Conveniência de compra: quase toda nota de insumo vem com o total do pacote,
  // não com o preço unitário.
  const total = initialQty * unitPrice;

  async function save() {
    if (initialQty <= 0) {
      setError("Informe quantas unidades você comprou.");
      return;
    }
    if (unitPrice <= 0) {
      setError("Informe quanto custou cada unidade.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSave({
        id: crypto.randomUUID(),
        purchaseDate: toTimestamp(dateStr),
        initialQty,
        remainingQty: initialQty,
        unitPrice,
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
        <h3 className="modal-title">Registrar compra</h3>
        <p className="modal-sub">
          {supply.name} — o preço vale só para este lote. O produto precifica
          pelo lote mais novo (custo de repor) e a produção cobra o lote em uso
          (custo real).
        </p>

        <div className="stock-form-grid">
          <div className="field-block">
            <div className="section-label">Quantidade ({supply.unit})</div>
            <NumberInput
              aria-label="Quantidade comprada"
              className="field-input"
              min={0}
              value={initialQty}
              onChange={setInitialQty}
            />
          </div>

          <div className="field-block">
            <div className="section-label">Preço por {supply.unit} (R$)</div>
            <NumberInput
              aria-label="Preço por unidade"
              className="field-input"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={setUnitPrice}
            />
            {total > 0 ? (
              <div className="field-hint">
                total da compra: R$ {total.toFixed(2).replace(".", ",")}
              </div>
            ) : null}
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
