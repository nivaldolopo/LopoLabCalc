"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Machine } from "../types";

type MachineManagerModalProps = {
  open: boolean;
  machines: Machine[];
  onClose: () => void;
  onSave: (machines: Machine[]) => void;
};

export function MachineManagerModal({
  open,
  machines,
  onClose,
  onSave,
}: MachineManagerModalProps) {
  const [draft, setDraft] = useState<Machine[]>(machines);

  if (!open) return null;

  function updateMachine(index: number, patch: Partial<Machine>) {
    setDraft((current) =>
      current.map((machine, machineIndex) =>
        machineIndex === index ? { ...machine, ...patch } : machine,
      ),
    );
  }

  function addMachine() {
    setDraft((current) => [
      ...current,
      {
        id: `m_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: "",
        price: 0,
        lifeHours: 5000,
        watts: 100,
      },
    ]);
  }

  function removeMachine(index: number) {
    if (draft.length <= 1) {
      window.alert("É preciso ter ao menos uma máquina.");
      return;
    }
    setDraft((current) =>
      current.filter((_, machineIndex) => machineIndex !== index),
    );
  }

  function saveDraft() {
    for (const machine of draft) {
      if (!machine.name.trim()) {
        window.alert("Toda máquina precisa de um nome.");
        return;
      }
      if (machine.price < 0 || machine.lifeHours <= 0 || machine.watts < 0) {
        window.alert(`Valores inválidos em "${machine.name}".`);
        return;
      }
    }

    onSave(draft);
    onClose();
  }

  return (
    <div className="modal-overlay open" onMouseDown={onClose}>
      <div className="modal-box" onMouseDown={(event) => event.stopPropagation()}>
        <h3 className="modal-title">Gerenciar Máquinas</h3>
        <p className="modal-sub">
          Adicione, edite ou remova impressoras. Preço e vida útil calculam a
          depreciação; watts calcula a energia.
        </p>
        <div className="machine-edit-header">
          <span>Nome</span>
          <span>Preço (R$)</span>
          <span>Vida (h)</span>
          <span>Watts</span>
          <span />
        </div>
        <div>
          {draft.map((machine, index) => (
            <div className="machine-edit-row" key={machine.id}>
              <input
                aria-label="Nome da máquina"
                type="text"
                value={machine.name}
                onChange={(event) =>
                  updateMachine(index, { name: event.target.value })
                }
                placeholder="Nome"
              />
              <input
                aria-label="Preço da máquina"
                min={0}
                type="number"
                value={machine.price}
                onChange={(event) =>
                  updateMachine(index, {
                    price: Math.max(0, Number(event.target.value) || 0),
                  })
                }
              />
              <input
                aria-label="Vida útil em horas"
                min={1}
                type="number"
                value={machine.lifeHours}
                onChange={(event) =>
                  updateMachine(index, {
                    lifeHours: Math.max(0, Number(event.target.value) || 0),
                  })
                }
              />
              <input
                aria-label="Consumo em watts"
                min={0}
                type="number"
                value={machine.watts}
                onChange={(event) =>
                  updateMachine(index, {
                    watts: Math.max(0, Number(event.target.value) || 0),
                  })
                }
              />
              <button
                className="icon-button danger"
                type="button"
                onClick={() => removeMachine(index)}
                title="Remover máquina"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button className="link-button add-line" type="button" onClick={addMachine}>
          <Plus size={15} />
          Adicionar máquina
        </button>
        <div className="modal-actions">
          <button className="btn primary" type="button" onClick={saveDraft}>
            Salvar
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
