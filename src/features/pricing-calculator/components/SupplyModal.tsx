"use client";

import { useState } from "react";
import type { Supply } from "../types";
import { NumberInput } from "./NumberInput";

export type SupplyDraft = {
  name: string;
  unit: string;
  minQty: number;
};

type SupplyModalProps = {
  supply: Supply | null; // null = criar
  onClose: () => void;
  onSave: (draft: SupplyDraft) => Promise<void>;
};

// Unidades sugeridas. Lista curta de propósito: é rótulo de tela, não regra —
// o campo aceita qualquer texto.
const UNITS = ["un", "par", "m", "cm", "kit", "folha"];

/**
 * Cadastro do insumo (7e). Diferente da cor de filamento (D8), aqui o nome é um
 * campo mesmo: "ímã 6×2mm" não se deriva de atributos.
 *
 * O que NÃO se cadastra aqui é o preço — ele é do LOTE, como no rolo, senão o
 * custo de uma compra antiga se perderia na primeira reposição.
 */
export function SupplyModal({ supply, onClose, onSave }: SupplyModalProps) {
  const [name, setName] = useState(supply?.name ?? "");
  const [unit, setUnit] = useState(supply?.unit ?? "un");
  const [minQty, setMinQty] = useState(supply?.minQty ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      setError("Dê um nome ao insumo (ex: ímã 6×2mm, argola 20mm).");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        unit: unit.trim() || "un",
        minQty,
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
        <h3 className="modal-title">
          {supply ? "Editar insumo" : "Novo insumo"}
        </h3>
        <p className="modal-sub">
          Componentes que entram na peça sem ser filamento: ímã, argola,
          parafuso, corrente, embalagem. O preço vem das compras (lotes), não
          daqui.
        </p>

        <div className="stock-form-grid">
          <div className="field-block stock-field-wide">
            <div className="section-label">Nome</div>
            <input
              className="field-input"
              type="text"
              value={name}
              placeholder="Ex: Ímã 6×2mm"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="field-block">
            <div className="section-label">Unidade</div>
            <input
              className="field-input"
              type="text"
              list="supply-units"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            />
            <datalist id="supply-units">
              {UNITS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <div className="field-hint">só rótulo de tela</div>
          </div>

          <div className="field-block">
            <div className="section-label">Estoque mínimo</div>
            <NumberInput
              aria-label="Estoque mínimo"
              className="field-input"
              min={0}
              value={minQty}
              onChange={setMinQty}
            />
            <div className="field-hint">0 = sem alerta</div>
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
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
