"use client";

import { useState } from "react";
import type { StockFilament } from "../types";
import { NumberInput } from "./NumberInput";

// O que o formulário edita: a identidade da cor. Rolos e ajustes NÃO passam por
// aqui — cada um tem o seu caminho próprio (registrar compra / adjustRoll), que
// é o que mantém o rastro do D6 inteiro.
export type StockColorDraft = {
  material: string;
  brand: string;
  colorName: string;
  colorHex: string;
  minG: number;
};

type StockColorModalProps = {
  color: StockFilament | null; // null = criar
  materials: string[]; // D8: os já cadastrados
  onClose: () => void;
  onSave: (draft: StockColorDraft) => Promise<void>;
};

const NEW_MATERIAL = "__novo__";

export function StockColorModal({
  color,
  materials,
  onClose,
  onSave,
}: StockColorModalProps) {
  const [material, setMaterial] = useState(color?.material ?? "");
  const [brand, setBrand] = useState(color?.brand ?? "");
  const [colorName, setColorName] = useState(color?.colorName ?? "");
  const [colorHex, setColorHex] = useState(color?.colorHex ?? "#888888");
  const [minG, setMinG] = useState(color?.minG ?? 0);
  // D8: o input é dropdown dos já cadastrados + digitar um novo. Sem lista não
  // há o que escolher (primeira cor do sistema), então já abre digitando.
  const [typingMaterial, setTypingMaterial] = useState(materials.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!material.trim()) {
      setError("Escolha ou digite o material (PLA, PETG...).");
      return;
    }
    if (!colorName.trim()) {
      setError("Dê um nome à cor (Preto, Vermelho...).");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSave({
        material: material.trim(),
        brand: brand.trim(),
        colorName: colorName.trim(),
        colorHex,
        minG,
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
        <h3 className="modal-title">{color ? "Editar cor" : "Nova cor"}</h3>
        <p className="modal-sub">
          A cor é o que o produto vai apontar — os rolos vivem dentro dela, cada
          um com o preço que você pagou. O nome exibido é montado a partir de
          material, cor e marca.
        </p>

        <div className="stock-form-grid">
          <div className="field-block">
            <div className="section-label">Material</div>
            {typingMaterial ? (
              <div className="stock-material-new">
                <input
                  className="field-input"
                  type="text"
                  value={material}
                  autoFocus
                  placeholder="PLA Basic, PETG HF..."
                  onChange={(event) => setMaterial(event.target.value)}
                />
                {materials.length > 0 ? (
                  <button
                    className="link-button"
                    type="button"
                    onClick={() => {
                      setTypingMaterial(false);
                      setMaterial("");
                    }}
                  >
                    escolher da lista
                  </button>
                ) : null}
              </div>
            ) : (
              <select
                className="field-input"
                value={material}
                onChange={(event) => {
                  if (event.target.value === NEW_MATERIAL) {
                    setTypingMaterial(true);
                    setMaterial("");
                    return;
                  }
                  setMaterial(event.target.value);
                }}
              >
                <option value="">Selecione...</option>
                {materials.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value={NEW_MATERIAL}>+ Novo material...</option>
              </select>
            )}
          </div>

          <div className="field-block">
            <div className="section-label">Marca</div>
            <input
              className="field-input"
              type="text"
              value={brand}
              placeholder="Bambu, Voolt... (opcional)"
              onChange={(event) => setBrand(event.target.value)}
            />
          </div>

          <div className="field-block">
            <div className="section-label">Cor</div>
            <input
              className="field-input"
              type="text"
              value={colorName}
              placeholder="Preto, Vermelho..."
              onChange={(event) => setColorName(event.target.value)}
            />
          </div>

          <div className="field-block">
            <div className="section-label">Amostra</div>
            <input
              aria-label="Amostra da cor"
              className="stock-hex-input"
              type="color"
              value={colorHex}
              onChange={(event) => setColorHex(event.target.value)}
            />
          </div>

          <div className="field-block">
            <div className="section-label">Estoque mínimo (g)</div>
            <NumberInput
              aria-label="Estoque mínimo em gramas"
              className="field-input"
              min={0}
              value={minG}
              onChange={setMinG}
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
