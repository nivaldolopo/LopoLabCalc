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

  // Calculados no render (a lista é de 2-4 itens): memoizar aqui esconderia a
  // conta atrás de um hook que não pode existir antes do `return null` acima.
  const zeradas = draft.filter((machine) => !(machine.weight > 0));
  const somaPesos = draft.reduce(
    (sum, machine) => sum + Math.max(0, machine.weight || 0),
    0,
  );

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
        // [FROTA] Fase 2 — máquina nova nasce a 0% DE PROPÓSITO. Dar-lhe uma
        // fatia igual automática reprecificaria o catálogo inteiro no ato do
        // cadastro, antes de ela ter imprimido uma peça. O aviso abaixo da lista
        // cobra o ajuste; até lá ela fica fora da média ponderada.
        weight: 0,
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
        machine.maintenancePerHour < 0 ||
        machine.weight < 0
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
    // UX-44/[FROTA] Fase 2 — `machine-modal`: a 6ª coluna (Peso) não cabia nos
    // 560px da casca padrão, o campo Nome ficaria com 76px. A caixa alarga para
    // 680; abaixo de 640 a fileira já vira cartão e a largura deixa de importar.
    <Modal
      title="Gerenciar Máquinas"
      sub="Adicione, edite ou remova impressoras. Preço e vida útil calculam a depreciação; watts calcula a energia; manutenção/hora cobre bicos, placa, correias e demais consumíveis. O peso é a fatia de uso de cada uma na taxa de frota que precifica os produtos."
      onClose={onClose}
      className="machine-modal"
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
      {/* UX-44: no celular esta faixa some e cada campo carrega o próprio
          rótulo (o `.me-label` abaixo) — a linha vira CARTÃO. Aqui ela é
          decorativa: quem nomeia o campo para leitor de tela é o `aria-label`
          de cada input, que existe nos dois modos. */}
      <div className="machine-edit-header" aria-hidden="true">
        <span>Nome</span>
        <span>Preço (R$)</span>
        <span>Vida (h)</span>
        <span>Watts</span>
        <span>Manut. (R$/h)</span>
        <span>Peso (%)</span>
        <span />
      </div>
      <div>
        {draft.map((machine, index) => (
          <div className="machine-edit-row" key={machine.id}>
            <span className="me-field me-field-name">
              <span className="me-label" aria-hidden="true">
                Nome
              </span>
              <input
                aria-label="Nome da máquina"
                type="text"
                value={machine.name}
                onChange={(event) =>
                  updateMachine(index, { name: event.target.value })
                }
                placeholder="Nome"
              />
            </span>
            <span className="me-field">
              <span className="me-label" aria-hidden="true">
                Preço (R$)
              </span>
              <NumberInput
                aria-label="Preço da máquina"
                min={0}
                value={machine.price}
                onChange={(price) => updateMachine(index, { price })}
              />
            </span>
            <span className="me-field">
              <span className="me-label" aria-hidden="true">
                Vida (h)
              </span>
              <NumberInput
                aria-label="Vida útil em horas"
                min={1}
                value={machine.lifeHours}
                onChange={(lifeHours) => updateMachine(index, { lifeHours })}
              />
            </span>
            <span className="me-field">
              <span className="me-label" aria-hidden="true">
                Watts
              </span>
              <NumberInput
                aria-label="Consumo em watts"
                min={0}
                value={machine.watts}
                onChange={(watts) => updateMachine(index, { watts })}
              />
            </span>
            <span className="me-field">
              <span className="me-label" aria-hidden="true">
                Manut. (R$/h)
              </span>
              <NumberInput
                aria-label="Manutenção por hora"
                min={0}
                step="0.1"
                value={machine.maintenancePerHour}
                onChange={(maintenancePerHour) =>
                  updateMachine(index, { maintenancePerHour })
                }
              />
            </span>
            {/* [FROTA] Fase 2 — o peso na taxa de frota. Mora AQUI, junto dos
                outros campos da máquina, porque é atributo dela e não do
                produto. ⚠ Percentual puro: horas/dia criariam uma segunda fonte
                da verdade contra o `hoursDay`/`machines` do custo fixo (D6.1). */}
            <span className="me-field">
              <span className="me-label" aria-hidden="true">
                Peso (%)
              </span>
              <NumberInput
                aria-label="Peso na taxa de frota, em porcentagem"
                min={0}
                max={100}
                value={machine.weight}
                onChange={(weight) => updateMachine(index, { weight })}
              />
            </span>
            <button
              className="icon-button danger"
              type="button"
              onClick={() => removeMachine(index)}
              title="Remover máquina"
              aria-label={`Remover a máquina ${machine.name || index + 1}`}
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
      {/* Os pesos NÃO precisam somar 100 — a fórmula renormaliza dentro do
          subconjunto elegível de cada produto. O que precisa de aviso é o peso
          ZERO, que tira a máquina da média sem que nada na tela diga. */}
      {zeradas.length > 0 ? (
        <div className="machine-weight-note">
          ⚠ {zeradas.length === 1 ? "A máquina" : "As máquinas"}{" "}
          <strong>{zeradas.map((m) => m.name || "sem nome").join(", ")}</strong>{" "}
          {zeradas.length === 1 ? "está" : "estão"} com peso 0% e não{" "}
          {zeradas.length === 1 ? "entra" : "entram"} na média da frota. Um
          produto que só possa rodar {zeradas.length === 1 ? "nela" : "nelas"} cai
          em média simples.
        </div>
      ) : null}
      <div className="machine-weight-note muted-note">
        Soma atual: <strong>{somaPesos}%</strong>. Não precisa dar 100 — o que
        vale é a proporção entre as máquinas <em>elegíveis</em> de cada produto.
      </div>
      {error ? <div className="form-error">{error}</div> : null}
    </Modal>
  );
}
