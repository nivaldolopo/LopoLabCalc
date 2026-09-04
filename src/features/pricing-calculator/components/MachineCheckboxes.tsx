"use client";

import type { Machine } from "../types";
import {
  machineSelectionNote,
  selectedLive,
  toggleSelection,
  weightOf,
} from "../lib/fleet";

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
 * "cabe nesta", e o preço é a média ponderada de todas as marcadas. Radio →
 * checkbox é a única forma do controle não continuar prometendo a semântica
 * antiga.
 *
 * ⚠ Desmarcar a ÚLTIMA VIVA é no-op de propósito. Um produto sem máquina nenhuma
 * não tem preço definível, e o `validateProduct` o reprovaria só na hora de
 * salvar — longe do clique que causou o problema. O conjunto vazio continua
 * existindo como DADO (os produtos anteriores à fase), só não como algo que se
 * produz aqui. A decisão mora no `toggleSelection`, pura e testada.
 */
export function MachineCheckboxes({
  machines,
  selectedIds,
  onChange,
  labelledBy,
}: MachineCheckboxesProps) {
  const selected = new Set(selectedIds);
  // ⚠ AUD-17 [E4]: tudo aqui conta o marcado VIVO, nunca `selectedIds` — um
  // conjunto só de ids apagados tem tamanho > 0 e nenhuma caixa marcada, e
  // contar o fantasma trocava o aviso certo ("frota inteira") pelo aviso de
  // outra conta ("peso 0% → média simples"). Qual aviso é decisão pura, do
  // `machineSelectionNote`; aqui fica só a redação.
  const marcadas = selectedLive(machines, selectedIds);
  const aviso = machineSelectionNote(machines, selectedIds);

  // A soma dos pesos DO SUBCONJUNTO marcado — é ela que decide se a média é
  // ponderada ou simples, e é sobre ela que a fatia de cada uma se renormaliza.
  // A frota inteira não serve aqui: marcar duas de três muda a fatia das duas.
  const pesoMarcado = marcadas.reduce(
    (sum, machine) => sum + weightOf(machine),
    0,
  );

  function toggle(id: string, checked: boolean) {
    const next = toggleSelection(machines, selectedIds, id, checked);
    if (next === null) return;
    onChange(next);
  }

  // O que a máquina contribui, dito do jeito que vale AGORA — sem ele, o dono
  // não tem como prever o efeito de marcar mais uma.
  //
  // ⚠ Com TODOS os pesos do subconjunto em zero a média é SIMPLES, e todas
  // entram nela. Dizer "0% (fora da média)" em cada uma seria o oposto do que
  // acontece — foi o que a tela mostrou antes de qualquer peso ser cadastrado,
  // que é justamente o estado em que o app nasce.
  function contribuicao(machine: Machine): string {
    if (!selected.has(machine.id)) return `peso ${weightOf(machine)}%`;
    if (pesoMarcado <= 0) return "média simples";
    const peso = weightOf(machine);
    if (peso <= 0) return "0% — fora da média";
    return `${Math.round((peso / pesoMarcado) * 100)}% da média`;
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
              <span className="mmeta">
                {machine.watts}W · {contribuicao(machine)}
              </span>
            </label>
          );
        })}
      </div>
      {aviso === "orfa" ? (
        <p className="machine-orphan-note">
          ⚠ Nenhuma máquina marcada — este produto está sendo precificado pela{" "}
          <strong>frota inteira</strong>. Marque onde ele realmente cabe.
        </p>
      ) : null}
      {aviso === "peso-zero" ? (
        <p className="machine-orphan-note">
          ⚠ As máquinas marcadas estão todas com <strong>peso 0%</strong>, então
          a média está <strong>simples</strong> (todas pesam igual). Defina a
          proporção de uso em <em>Gerenciar</em> para o preço refletir a frota.
        </p>
      ) : null}
    </>
  );
}
