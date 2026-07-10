"use client";

import { CopyPlus, Save, X } from "lucide-react";
import type { Machine, PrintStage, ProductInput } from "../types";
import { AccessoriesSection } from "./AccessoriesSection";
import { ExtraStagesSection } from "./ExtraStagesSection";
import { LinksSection } from "./LinksSection";
import { MachineSelector } from "./MachineSelector";

type ProductFormProps = {
  product: ProductInput;
  machines: Machine[];
  editingProductId: string | null;
  saved: boolean;
  onChange: (patch: Partial<ProductInput>) => void;
  onManageMachines: () => void;
  onAddStage: () => void;
  onRemoveStage: (stageId: string) => void;
  onUpdateStage: (stageId: string, patch: Partial<PrintStage>) => void;
  onAddAccessory: () => void;
  onRemoveAccessory: (accessoryId: string) => void;
  onUpdateAccessory: (accessoryId: string, patch: Partial<ProductInput["accessories"][number]>) => void;
  onSave: () => void;
  onSaveAsNew: () => void;
  onCancelEdit: () => void;
};

export function ProductForm({
  product,
  machines,
  editingProductId,
  saved,
  onChange,
  onManageMachines,
  onAddStage,
  onRemoveStage,
  onUpdateStage,
  onAddAccessory,
  onRemoveAccessory,
  onUpdateAccessory,
  onSave,
  onSaveAsNew,
  onCancelEdit,
}: ProductFormProps) {
  const canSave = product.name.trim().length > 0;

  return (
    <div className="card">
      <div className="field-block">
        <label className="section-label">Nome do produto</label>
        <input
          className="field-input product-name"
          value={product.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Ex: Insert para Wingspan"
        />
      </div>

      <MachineSelector
        machines={machines}
        selectedMachineId={product.machineId}
        onSelect={(machineId) => onChange({ machineId })}
        onManage={onManageMachines}
      />

      <div className="field-block">
        <label className="section-label">Nome da etapa principal</label>
        <input
          className="field-input"
          value={product.mainStageName}
          onChange={(event) => onChange({ mainStageName: event.target.value })}
          placeholder="Ex: Corpo principal"
        />
      </div>

      <div className="two-col">
        <NumberField
          label="Peso da peça (g)"
          value={product.weightG}
          onChange={(weightG) => onChange({ weightG })}
        />
        <NumberField
          label="Tempo de impressão (h)"
          step="0.1"
          value={product.printHours}
          onChange={(printHours) => onChange({ printHours })}
        />
        <NumberField
          label="Filamento (R$/kg)"
          value={product.filamentPricePerKg}
          onChange={(filamentPricePerKg) => onChange({ filamentPricePerKg })}
        />
        <NumberField
          label="Tarifa energia (R$/kWh)"
          step="0.01"
          value={product.energyTariff}
          onChange={(energyTariff) => onChange({ energyTariff })}
        />
        <NumberField
          label="Mão de obra (min)"
          value={product.laborMinutes}
          onChange={(laborMinutes) => onChange({ laborMinutes })}
        />
        <NumberField
          label="Seu valor-hora (R$)"
          value={product.laborRate}
          onChange={(laborRate) => onChange({ laborRate })}
        />
        <NumberField
          label="Peças por impressão"
          min={1}
          value={product.piecesCount}
          onChange={(piecesCount) =>
            onChange({ piecesCount: Math.max(1, piecesCount || 1) })
          }
        />
      </div>

      <ExtraStagesSection
        stages={product.stages}
        machines={machines}
        onAddStage={onAddStage}
        onRemoveStage={onRemoveStage}
        onUpdateStage={onUpdateStage}
      />

      <AccessoriesSection
        accessories={product.accessories}
        onAddAccessory={onAddAccessory}
        onRemoveAccessory={onRemoveAccessory}
        onUpdateAccessory={onUpdateAccessory}
      />

      <LinksSection product={product} onChange={onChange} />

      <div className="field-block">
        <label className="section-label markup-header">
          <span>Markup sobre o custo</span>
          <span className="markup-value">{product.markup.toFixed(1)}x</span>
        </label>
        <input
          max={6}
          min={1.5}
          step={0.1}
          type="range"
          value={product.markup}
          onChange={(event) => onChange({ markup: Number(event.target.value) })}
        />
        <div className="markup-labels">
          <span>1.5x - apertado</span>
          <span>3x - padrão varejo</span>
          <span>6x - premium</span>
        </div>
      </div>

      <div className="btn-row">
        <button
          className={`btn primary ${saved ? "saved" : ""}`}
          disabled={!canSave}
          type="button"
          onClick={onSave}
        >
          <Save size={16} />
          {saved ? "Salvo!" : "Salvar"}
        </button>
        {editingProductId ? (
          <>
            <button className="btn btn-secondary" type="button" onClick={onCancelEdit}>
              <X size={16} />
              Cancelar
            </button>
            <button className="btn btn-secondary" type="button" onClick={onSaveAsNew}>
              <CopyPlus size={16} />
              Salvar como novo
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: string;
}) {
  return (
    <div>
      <label className="section-label">{label}</label>
      <input
        className="field-input"
        min={min}
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </div>
  );
}
