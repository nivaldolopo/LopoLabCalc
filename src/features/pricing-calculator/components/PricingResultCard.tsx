"use client";

import { formatCurrency } from "@/lib/formatting/currency";
import type {
  CapacityResult,
  CapacitySettings,
  FixedCostSettings,
  PricingResult,
} from "../types";
import { CapacityPanel } from "./CapacityPanel";

type PricingResultCardProps = {
  result: PricingResult;
  fixedCosts: FixedCostSettings;
  capacitySettings: CapacitySettings;
  capacityResult: CapacityResult | null;
  onCapacityChange: (patch: Partial<CapacitySettings>) => void;
};

export function PricingResultCard({
  result,
  fixedCosts,
  capacitySettings,
  capacityResult,
  onCapacityChange,
}: PricingResultCardProps) {
  const totalFixedMonth = fixedCosts.rent + fixedCosts.other;
  const breakEvenUnits =
    totalFixedMonth > 0 && result.contributionMargin > 0
      ? Math.ceil(totalFixedMonth / result.contributionMargin)
      : null;
  const fixedCostPct =
    fixedCosts.enabled && result.totalCost > 0
      ? (result.fixedCost / result.totalCost) * 100
      : 0;

  return (
    <div className="result-card">
      <div className="result-label">Preço sugerido</div>
      <div className="result-price sg">{formatCurrency(result.suggestedPrice)}</div>
      <div className="result-margin">
        margem de {result.margin.toFixed(0)}% sobre o preço final
      </div>

      {breakEvenUnits ? (
        <div className="break-even-box visible">
          <div className="break-even-title">Meta de Break-Even</div>
          <div className="break-even-val">
            Vender <strong>{breakEvenUnits}</strong> peças/mês deste produto
            cobre o custo fixo e inicia o lucro.
          </div>
        </div>
      ) : null}

      <HorizontalBars result={result} />

      {result.pieces > 1 ? (
        <div className="per-piece-row">
          <div className="per-piece-label">
            Por peça ({result.pieces} peças/impressão)
          </div>
          <div className="result-price sg small">
            {formatCurrency(result.suggestedPrice)}
          </div>
        </div>
      ) : null}

      <div className="breakdown">
        <BreakdownRow label="Material" value={result.materialCost} />
        <BreakdownRow label="Energia" value={result.energyCost} />
        <BreakdownRow
          label={`Desgaste (${result.machine.name})`}
          value={result.depreciationCost}
        />
        <BreakdownRow label="Mão de obra" value={result.laborCost} />
        {result.stagesCost > 0 ? (
          <BreakdownRow label="Etapas extras" value={result.stagesCost} />
        ) : null}
        {result.accessoriesCost > 0 ? (
          <BreakdownRow label="Acessórios" value={result.accessoriesCost} />
        ) : null}
        {fixedCosts.enabled ? (
          <BreakdownRow
            active
            label="Custo fixo (aluguel etc.)"
            value={result.fixedCost}
          />
        ) : null}
        <div className="breakdown-total">
          <span>Custo total</span>
          <span className="mono">{formatCurrency(result.totalCost)}</span>
        </div>
      </div>

      {fixedCostPct > 30 ? (
        <div className="fc-warning visible">
          Custo fixo representa {fixedCostPct.toFixed(0)}% do custo total.
        </div>
      ) : null}

      <CapacityPanel
        settings={capacitySettings}
        result={capacityResult}
        onChange={onCapacityChange}
      />
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active?: boolean;
}) {
  return (
    <div className={`breakdown-row ${active ? "breakdown-fixed active" : ""}`}>
      <span className="blabel">{label}</span>
      <span className="mono">{formatCurrency(value)}</span>
    </div>
  );
}

function HorizontalBars({ result }: { result: PricingResult }) {
  const items = [
    { label: "Material", value: result.materialCost, color: "var(--accent)" },
    { label: "Energia", value: result.energyCost, color: "#E0A96D" },
    { label: "Desgaste", value: result.depreciationCost, color: "#6B88C4" },
    { label: "Mão de obra", value: result.laborCost, color: "var(--green)" },
  ];

  if (result.stagesCost > 0) {
    items.push({ label: "Etapas", value: result.stagesCost, color: "#9B97AA" });
  }
  if (result.accessoriesCost > 0) {
    items.push({
      label: "Acessórios",
      value: result.accessoriesCost,
      color: "#B57EDC",
    });
  }
  if (result.fixedCost > 0) {
    items.push({
      label: "Custo fixo",
      value: result.fixedCost,
      color: "#C4836B",
    });
  }

  const maxValue = Math.max(...items.map((item) => item.value), 0.0001);

  return (
    <div className="hbar-chart">
      {items.map((item) => (
        <div className="hbar-row" key={item.label}>
          <div className="hbar-label">{item.label}</div>
          <div className="hbar-track">
            <div
              className="hbar-fill"
              style={{
                width: `${((item.value / maxValue) * 100).toFixed(1)}%`,
                background: item.color,
              }}
            />
          </div>
          <div className="hbar-val">{formatCurrency(item.value)}</div>
        </div>
      ))}
    </div>
  );
}
