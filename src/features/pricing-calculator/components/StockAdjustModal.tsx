"use client";

import { useState } from "react";
import { formatDate, todayInputValue, toTimestamp } from "@/lib/formatting/date";
import { num } from "@/lib/number";
import { filamentLabel, rollNumbers } from "../lib/stock";
import type { StockFilament } from "../types";
import { NumberInput } from "./NumberInput";

type StockAdjustModalProps = {
  color: StockFilament;
  onClose: () => void;
  onSave: (input: {
    rollId: string;
    countedG: number;
    reason: string;
    at: number;
  }) => Promise<void>;
};

/**
 * Ajuste de inventário (D6). Contou o rolo e o saldo real diverge? É por aqui —
 * nunca editando `remainingG` na mão. O rastro guarda o que o sistema achava
 * (`beforeG`) e o que você contou (`afterG`), então o furo fica registrado com
 * o tamanho que tinha.
 *
 * Vale para rolo zerado (achou o spool na gaveta com sobra) e para saldo
 * negativo — aí a contagem é justamente o remédio do D4.
 */
export function StockAdjustModal({
  color,
  onClose,
  onSave,
}: StockAdjustModalProps) {
  const numbers = rollNumbers(color);
  // Ordem FIFO na lista: o rolo em uso é o primeiro candidato à contagem.
  const rolls = [...color.rolls].sort(
    (a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0),
  );

  const [rollId, setRollId] = useState(rolls[0]?.id ?? "");
  const selected = rolls.find((roll) => roll.id === rollId) ?? null;
  const beforeG = num(selected?.remainingG);

  const [countedG, setCountedG] = useState(beforeG);
  const [reason, setReason] = useState("");
  const [dateStr, setDateStr] = useState(todayInputValue());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const delta = countedG - beforeG;

  async function save() {
    if (!selected) {
      setError("Escolha o rolo que você contou.");
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
        rollId,
        countedG,
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
          {filamentLabel(color)} — pese o rolo e informe o que ele tem de
          verdade. O que o sistema achava fica guardado no histórico, junto com o
          motivo.
        </p>

        <div className="stock-form-grid">
          <div className="field-block stock-field-wide">
            <div className="section-label">Rolo contado</div>
            <select
              className="field-input"
              value={rollId}
              onChange={(event) => {
                const next = rolls.find((roll) => roll.id === event.target.value);
                setRollId(event.target.value);
                // O contado parte do saldo atual do rolo escolhido: quem só
                // confere um rolo certo não precisa redigitar o número.
                setCountedG(num(next?.remainingG));
              }}
            >
              {rolls.map((roll) => (
                <option key={roll.id} value={roll.id}>
                  Rolo #{numbers.get(roll.id)} · comprado em{" "}
                  {formatDate(roll.purchaseDate)} · sistema:{" "}
                  {Math.round(num(roll.remainingG))} g
                </option>
              ))}
            </select>
          </div>

          <div className="field-block">
            <div className="section-label">Contado (g)</div>
            <NumberInput
              aria-label="Gramas contadas"
              className="field-input"
              min={0}
              value={countedG}
              onChange={setCountedG}
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
              placeholder="Contagem, sobrou no bico, rolo veio com menos..."
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>

        {selected ? (
          <div className={`stock-delta ${delta === 0 ? "zero" : delta > 0 ? "pos" : "neg"}`}>
            {delta === 0
              ? "Sem diferença — o sistema já estava certo."
              : `O saldo do rolo vai de ${Math.round(beforeG)} g para ${Math.round(
                  countedG,
                )} g (${delta > 0 ? "+" : "−"}${Math.round(Math.abs(delta))} g).`}
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
