"use client";

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
  return (
    <div className="field-block">
      <div className="section-head">
        <label className="section-label">Máquina</label>
        <button className="link-button" type="button" onClick={onManage}>
          <Settings size={14} />
          Gerenciar
        </button>
      </div>
      <div className="machine-row">
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
