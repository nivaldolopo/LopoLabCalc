"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Machine } from "../types";
import { Modal } from "./Modal";
import { NumberInput } from "./NumberInput";

type MachineManagerModalProps = {
  open: boolean;
  machines: Machine[];
  onClose: () => void;
  // TD-020: devolve a mensagem de erro da gravação, ou `null` se deu certo —
  // é o que permite ao modal NÃO fechar em cima de um save que não aconteceu.
  onSave: (machines: Machine[]) => Promise<string | null>;
};

export function MachineManagerModal({
  open,
  machines,
  onClose,
  onSave,
}: MachineManagerModalProps) {
  const [draft, setDraft] = useState<Machine[]>(machines);
  // Aviso de validação inline, no lugar do window.alert (TD-004).
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        lifeHours: 7500, // DEC-02 — mesmo padrão do DEFAULT_MACHINES
        watts: 100,
        maintenancePerHour: 0,
      },
    ]);
  }

  function removeMachine(index: number) {
    if (draft.length <= 1) {
      setError("É preciso ter ao menos uma máquina.");
      return;
    }
    setError(null);
    setDraft((current) =>
      current.filter((_, machineIndex) => machineIndex !== index),
    );
  }

  async function saveDraft() {
    for (const machine of draft) {
      if (!machine.name.trim()) {
        setError("Toda máquina precisa de um nome.");
        return;
      }
      if (
        machine.price < 0 ||
        machine.lifeHours <= 0 ||
        machine.watts < 0 ||
        machine.maintenancePerHour < 0
      ) {
        setError(`Valores inválidos em "${machine.name}".`);
        return;
      }
    }

    setError(null);
    setSaving(true);
    const falha = await onSave(draft);
    setSaving(false);
    // TD-020: offline (ou erro de escrita) o modal fechava como se tivesse
    // salvo. Agora ele fica aberto com o motivo — e o rascunho não se perde.
    if (falha) {
      setError(falha);
      return;
    }
    onClose();
  }

  return (
    <Modal
      title="Gerenciar Máquinas"
      sub="Adicione, edite ou remova impressoras. Preço e vida útil calculam a depreciação; watts calcula a energia; manutenção/hora cobre bicos, placa, correias e demais consumíveis."
      onClose={onClose}
      footer={
        <>
          <button
            className="btn primary"
            type="button"
            onClick={saveDraft}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
        </>
      }
    >
      <div className="machine-edit-header">
        <span>Nome</span>
        <span>Preço (R$)</span>
        <span>Vida (h)</span>
        <span>Watts</span>
        <span>Manut. (R$/h)</span>
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
            <NumberInput
              aria-label="Preço da máquina"
              min={0}
              value={machine.price}
              onChange={(price) => updateMachine(index, { price })}
            />
            <NumberInput
              aria-label="Vida útil em horas"
              min={1}
              value={machine.lifeHours}
              onChange={(lifeHours) => updateMachine(index, { lifeHours })}
            />
            <NumberInput
              aria-label="Consumo em watts"
              min={0}
              value={machine.watts}
              onChange={(watts) => updateMachine(index, { watts })}
            />
            <NumberInput
              aria-label="Manutenção por hora"
              min={0}
              step="0.1"
              value={machine.maintenancePerHour}
              onChange={(maintenancePerHour) =>
                updateMachine(index, { maintenancePerHour })
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
      {error ? <div className="form-error">{error}</div> : null}
    </Modal>
  );
}
