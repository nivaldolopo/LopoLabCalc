"use client";

import { useState } from "react";
import type {
  Machine,
  PrintStage,
  ProductInput,
  StockFilament,
  Supply,
  Subitem,
  SubitemPrice,
} from "../types";
import { AccessoriesSection } from "./AccessoriesSection";
import { ExtraStagesSection } from "./ExtraStagesSection";
import { FilamentColorsSection } from "./FilamentColorsSection";
import { LinksSection } from "./LinksSection";
import { MachineSelector } from "./MachineSelector";
import { NumberInput } from "./NumberInput";
import { SubitemsSection } from "./SubitemsSection";

type ProductFormProps = {
  product: ProductInput;
  machines: Machine[];
  stock: StockFilament[];
  supplies: Supply[];
  onChange: (patch: Partial<ProductInput>) => void;
  onManageMachines: () => void;
  onAddStage: () => void;
  onRemoveStage: (stageId: string) => void;
  onUpdateStage: (stageId: string, patch: Partial<PrintStage>) => void;
  onAddAccessory: () => void;
  onRemoveAccessory: (accessoryId: string) => void;
  onUpdateAccessory: (accessoryId: string, patch: Partial<ProductInput["accessories"][number]>) => void;
  subitemPrices?: SubitemPrice[];
  onToggleSellBySubitems: (on: boolean) => void;
  onAddSubitem: () => void;
  onRemoveSubitem: (subitemId: string) => void;
  onUpdateSubitem: (subitemId: string, patch: Partial<Subitem>) => void;
  onToggleStageInSubitem: (
    subitemId: string,
    stageKey: string,
    include: boolean,
  ) => void;
};

export function ProductForm({
  product,
  machines,
  stock,
  supplies,
  onChange,
  onManageMachines,
  onAddStage,
  onRemoveStage,
  onUpdateStage,
  onAddAccessory,
  onRemoveAccessory,
  onUpdateAccessory,
  subitemPrices,
  onToggleSellBySubitems,
  onAddSubitem,
  onRemoveSubitem,
  onUpdateSubitem,
  onToggleStageInSubitem,
}: ProductFormProps) {

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
        <label className="section-label">
          🏷️ Nome da etapa principal{" "}
          <span className="label-hint">(opcional)</span>
        </label>
        <input
          className="field-input"
          value={product.mainStageName}
          onChange={(event) => onChange({ mainStageName: event.target.value })}
          placeholder="Ex: Corpo principal"
        />
      </div>

      <FilamentColorsSection
        filaments={product.filaments ?? []}
        stock={stock}
        onChange={(filaments) => onChange({ filaments })}
      />

      <div className="two-col">
        <PrintTimeField
          value={product.printHours}
          onChange={(printHours) => onChange({ printHours })}
        />
        <NumberField
          label="⚡ Tarifa energia (R$/kWh)"
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
          label="🔢 Peças por impressão"
          min={1}
          value={product.piecesCount}
          onChange={(piecesCount) => onChange({ piecesCount })}
        />
        <NumberField
          label="🎲 Taxa de falha (%)"
          max={95}
          step="1"
          value={product.failureRate}
          onChange={(failureRate) => onChange({ failureRate })}
        />
      </div>

      <ExtraStagesSection
        stages={product.stages}
        machines={machines}
        stock={stock}
        onAddStage={onAddStage}
        onRemoveStage={onRemoveStage}
        onUpdateStage={onUpdateStage}
      />

      <SubitemsSection
        product={product}
        subitemPrices={subitemPrices}
        onToggle={onToggleSellBySubitems}
        onAddSubitem={onAddSubitem}
        onRemoveSubitem={onRemoveSubitem}
        onUpdateSubitem={onUpdateSubitem}
        onToggleStage={onToggleStageInSubitem}
      />

      <AccessoriesSection
        accessories={product.accessories}
        subitems={product.sellBySubitems ? product.subitems : []}
        supplies={supplies}
        onAddAccessory={onAddAccessory}
        onRemoveAccessory={onRemoveAccessory}
        onUpdateAccessory={onUpdateAccessory}
      />

      <LinksSection product={product} onChange={onChange} />

      <div className="field-block">
        <label className="section-label markup-header">
          {/* DEC-03: a mão de obra é repasse — não entra na base do markup. */}
          <span>📈 Markup sobre o custo (sem mão de obra)</span>
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
          <span>1.5x — apertado</span>
          <span>3x — padrão varejo</span>
          <span>6x — premium</span>
        </div>
      </div>

      {/* UX-11: as ações (salvar/vender/produzir/orçar) e o aviso de validação
          MUDARAM para o card de preço, à direita — esta coluna é só input. */}
    </div>
  );
}

function splitPrintTime(total: number) {
  const safe = Math.max(0, total || 0);
  let h = Math.floor(safe);
  let min = Math.round((safe - h) * 60);
  if (min === 60) {
    h += 1;
    min = 0;
  }
  return { h, min };
}

export function PrintTimeField({
  value,
  onChange,
  label = "⏱ Tempo de impressão",
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}) {
  const initial = splitPrintTime(value);
  const [hours, setHours] = useState(String(initial.h));
  const [minutes, setMinutes] = useState(String(initial.min));

  // Resync os campos quando o valor muda por fora (ex.: carregar outro produto).
  // Padrão do React de ajustar estado durante o render ao detectar mudança de prop;
  // a tolerância evita sobrescrever o que está sendo digitado (o próprio emit muda `value`).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    const localTotal = (Number(hours) || 0) + (Number(minutes) || 0) / 60;
    if (Math.abs(localTotal - Math.max(0, value || 0)) > 1e-6) {
      const parts = splitPrintTime(value);
      setHours(String(parts.h));
      setMinutes(String(parts.min));
    }
  }

  const emit = (h: string, m: string) => {
    onChange(Math.max(0, (Number(h) || 0) + (Number(m) || 0) / 60));
  };

  // BUG-01: hora decimal é um total ABSOLUTO, não soma com os minutos residuais.
  // Ao digitar uma parte fracionária nas horas (ex.: 11.85), zera o campo de
  // minutos e emite só as horas — o blur/normalize converte para 11 h 51 min.
  // Sem fração, mantém o comportamento h + min.
  const onHoursChange = (raw: string) => {
    setHours(raw);
    if ((Number(raw) || 0) % 1 !== 0) {
      setMinutes("0");
      emit(raw, "0");
    } else {
      emit(raw, minutes);
    }
  };

  // No blur, normaliza o total para horas inteiras + minutos 0-59
  // (aceita horas decimais digitadas, ex.: 11.85 → 11 h 51 min).
  const normalize = () => {
    const parts = splitPrintTime(
      (Number(hours) || 0) + (Number(minutes) || 0) / 60,
    );
    setHours(String(parts.h));
    setMinutes(String(parts.min));
  };

  return (
    <div>
      <label className="section-label">{label}</label>
      <div className="time-inputs">
        <input
          className="field-input"
          aria-label="horas"
          min={0}
          step="0.1"
          type="number"
          value={hours}
          onChange={(event) => onHoursChange(event.target.value)}
          onBlur={normalize}
        />
        <span className="time-sep">h</span>
        <input
          className="field-input"
          aria-label="minutos"
          min={0}
          step="1"
          type="number"
          value={minutes}
          onChange={(event) => {
            setMinutes(event.target.value);
            emit(hours, event.target.value);
          }}
          onBlur={normalize}
        />
        <span className="time-sep">min</span>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <div>
      <label className="section-label">{label}</label>
      <NumberInput
        className="field-input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
