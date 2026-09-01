"use client";

import type { Machine } from "../types";

type MachineCheckboxesProps = {
  machines: Machine[];
  selectedIds: string[];
  onChange: (machineIds: string[]) => void;
  labelledBy: string;
};

/**
 * [FROTA] Fase 2 — as máquinas ELEGÍVEIS, como caixas de seleção.
 *
 * Eram chips de escolha ÚNICA, e a mudança não é cosmética: um chip aceso dizia
 * "é nesta que vai rodar" (e o preço saía do custo dela); a caixa marcada diz
 * "cabe nesta", e o preço é a média ponderada de todas as marcadas. Radio → checkbox
 * é a única forma do controle não continuar prometendo a semântica antiga.
 *
 * ⚠ Desmarcar a ÚLTIMA é no-op de propósito. Um produto sem máquina nenhuma não
 * tem preço definível, e o `validateProduct` o reprovaria só na hora de salvar —
 * longe do clique que causou o problema. O conjunto vazio continua existindo como
 * DADO (os produtos anteriores à fase), só não como algo que se produz aqui.
 */
export function MachineCheckboxes({
  machines,
  selectedIds,
  onChange,
  labelledBy,
}: MachineCheckboxesProps) {
  const selected = new Set(selectedIds);
  const orphan = selectedIds.length === 0;

  function toggle(id: string, checked: boolean) {
    if (!checked && selected.size <= 1) return;
    const next = machines
      .filter((machine) =>
        machine.id === id ? checked : selected.has(machine.id),
      )
      .map((machine) => machine.id);
    onChange(next);
  }

  return (
    <>
      <div className="machine-row" role="group" aria-labelledby={labelledBy}>
        {machines.map((machine) => {
          const checked = selected.has(machine.id);
          return (
            <label
              className={`machine-chip ${checked ? "active" : ""}`}
              key={machine.id}
            >
              <input
                type="checkbox"
                className="machine-chip-box"
                checked={checked}
                onChange={(event) => toggle(machine.id, event.target.checked)}
              />
              <span className="mname">{machine.name}</span>
              {/* O peso é o que decide quanto esta máquina puxa a média — sem
                  ele à vista, o dono não tem como prever o efeito de marcar
                  mais uma. 0% se anuncia como fora da conta. */}
              <span className="mmeta">
                {machine.watts}W · {machine.weight > 0 ? `${machine.weight}%` : "0% (fora da média)"}
              </span>
            </label>
          );
        })}
      </div>
      {orphan ? (
        <p className="machine-orphan-note">
          ⚠ Nenhuma máquina marcada — este produto está sendo precificado pela{" "}
          <strong>frota inteira</strong>. Marque onde ele realmente cabe.
        </p>
      ) : null}
    </>
  );
}
