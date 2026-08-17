"use client";

import { useId } from "react";
import { Settings } from "lucide-react";
import type { Machine } from "../types";

type MachineSelectorProps = {
  machines: Machine[];
  selectedMachineId: string;
  onSelect: (machineId: string) => void;
  onManage: () => void;
};

export function MachineSelector({
  machines,
  selectedMachineId,
  onSelect,
  onManage,
}: MachineSelectorProps) {
  const labelId = useId();
  return (
    <div className="field-block">
      <div className="section-head">
        {/* UX-16: rotula um grupo de BOTÕES (chips), não um campo — `role="group"`
            + `aria-labelledby` no lugar de um <label> que não aponta pra nada. */}
        {/* UX-29: `<h2>` porque é seção da página, não rótulo de campo. Continua
            servindo de `aria-labelledby` do grupo de chips. */}
        <h2 className="section-label" id={labelId}>
          Máquina
        </h2>
        <button className="link-button" type="button" onClick={onManage}>
          <Settings size={14} />
          Gerenciar
        </button>
      </div>
      <div className="machine-row" role="group" aria-labelledby={labelId}>
        {machines.map((machine) => (
          <button
            className={`machine-chip ${
              selectedMachineId === machine.id ? "active" : ""
            }`}
            key={machine.id}
            type="button"
            onClick={() => onSelect(machine.id)}
          >
            <span className="mname">{machine.name}</span>
            <span className="mmeta">{machine.watts}W</span>
          </button>
        ))}
      </div>
    </div>
  );
}
