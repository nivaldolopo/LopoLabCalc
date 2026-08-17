"use client";

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Machine, PrintStage, StockFilament } from "../types";
import { FilamentColorsSection } from "./FilamentColorsSection";
import { NumberInput } from "./NumberInput";
import { PrintTimeField } from "./ProductForm";

type ExtraStagesSectionProps = {
  stages: PrintStage[];
  machines: Machine[];
  stock: StockFilament[];
  onAddStage: () => void;
  onRemoveStage: (stageId: string) => void;
  onUpdateStage: (stageId: string, patch: Partial<PrintStage>) => void;
};

export function ExtraStagesSection({
  stages,
  machines,
  stock,
  onAddStage,
  onRemoveStage,
  onUpdateStage,
}: ExtraStagesSectionProps) {
  const fieldId = useId();
  return (
    <div className="field-block">
      <div className="section-head">
        {/* Título da seção, não rótulo de campo — ver UX-16; `<h2>` no UX-29. */}
        <h2 className="section-label">🔗 Etapas de impressão extras</h2>
        <button className="link-button bordered" type="button" onClick={onAddStage}>
          <Plus size={15} />
          Adicionar etapa
        </button>
      </div>
      <div className="section-note">
        Para peças que exigem várias impressões (ex: uma cor por vez). Cada etapa
        soma no custo final do produto.
      </div>
      {stages.map((stage, index) => {
        const rowId = `${fieldId}-${stage.id ?? index}`;
        return (
        <div className="stage-card" key={stage.id}>
          <div className="stage-card-head">
            <span className="stage-card-title">Etapa {index + 2}</span>
            <button
              className="icon-button danger"
              type="button"
              onClick={() => onRemoveStage(stage.id ?? "")}
              title="Remover etapa"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="field-block compact">
            <label className="section-label" htmlFor={`${rowId}-name`}>
              🏷️ Nome da etapa <span className="label-hint">(opcional)</span>
            </label>
            <input
              id={`${rowId}-name`}
              className="field-input"
              type="text"
              value={stage.name ?? ""}
              onChange={(event) =>
                onUpdateStage(stage.id ?? "", { name: event.target.value })
              }
              placeholder="Ex: Cor vermelha"
            />
          </div>
          <div className="field-block compact">
            {/* Rotula um grupo de BOTÕES (chips), não um campo — `role="group"`
                em vez de <label>, mesmo tratamento das caixas do subitem. */}
            <div className="section-label" id={`${rowId}-machine-label`}>
              Máquina
            </div>
            <div
              className="machine-row"
              role="group"
              aria-labelledby={`${rowId}-machine-label`}
            >
              {machines.map((machine) => (
                <button
                  className={`machine-chip ${
                    stage.machineId === machine.id ? "active" : ""
                  }`}
                  key={machine.id}
                  type="button"
                  onClick={() =>
                    onUpdateStage(stage.id ?? "", { machineId: machine.id })
                  }
                >
                  <span className="mname">{machine.name}</span>
                  <span className="mmeta">{machine.watts}W</span>
                </button>
              ))}
            </div>
          </div>
          <FilamentColorsSection
            filaments={stage.filaments ?? []}
            stock={stock}
            onChange={(filaments) =>
              onUpdateStage(stage.id ?? "", { filaments })
            }
          />
          <div className="two-col no-margin">
            <PrintTimeField
              label="⏱ Tempo"
              value={stage.printHours}
              onChange={(printHours) =>
                onUpdateStage(stage.id ?? "", { printHours })
              }
            />
            <div>
              <label className="section-label" htmlFor={`${rowId}-labor`}>
                Mão de obra (min)
              </label>
              <NumberInput
                id={`${rowId}-labor`}
                className="field-input"
                min={0}
                value={stage.laborMinutes}
                onChange={(laborMinutes) =>
                  onUpdateStage(stage.id ?? "", { laborMinutes })
                }
              />
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}
