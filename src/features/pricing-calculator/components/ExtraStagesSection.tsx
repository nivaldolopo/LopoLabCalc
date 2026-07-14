"use client";

import { Plus, Trash2 } from "lucide-react";
import type { Machine, PrintStage } from "../types";
import { FilamentColorsSection } from "./FilamentColorsSection";
import { NumberInput } from "./NumberInput";
import { PrintTimeField } from "./ProductForm";

type ExtraStagesSectionProps = {
  stages: PrintStage[];
  machines: Machine[];
  onAddStage: () => void;
  onRemoveStage: (stageId: string) => void;
  onUpdateStage: (stageId: string, patch: Partial<PrintStage>) => void;
};

export function ExtraStagesSection({
  stages,
  machines,
  onAddStage,
  onRemoveStage,
  onUpdateStage,
}: ExtraStagesSectionProps) {
  return (
    <div className="field-block">
      <div className="section-head">
        <label className="section-label">🔗 Etapas de impressão extras</label>
        <button className="link-button bordered" type="button" onClick={onAddStage}>
          <Plus size={15} />
          Adicionar etapa
        </button>
      </div>
      <div className="section-note">
        Para peças que exigem várias impressões (ex: uma cor por vez). Cada etapa
        soma no custo final do produto.
      </div>
      {stages.map((stage, index) => (
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
            <label className="section-label">
              🏷️ Nome da etapa <span className="label-hint">(opcional)</span>
            </label>
            <input
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
            <label className="section-label">Máquina</label>
            <div className="machine-row">
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
              <label className="section-label">Mão de obra (min)</label>
              <NumberInput
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
      ))}
    </div>
  );
}
