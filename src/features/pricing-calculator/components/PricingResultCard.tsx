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

  return (
    <div className="result-card">
      <div className="result-label">Preço sugerido</div>
      <div className="result-price sg">{formatCurrency(result.suggestedPrice)}</div>
      <div className="result-margin">
        margem de {result.margin.toFixed(0)}% sobre o preço final
      </div>

      {breakEvenUnits ? (
        <div className="break-even-box visible">
          <div className="break-even-title">🎯 Meta de Break-Even</div>
          <div className="break-even-val">
            Vender <strong>{breakEvenUnits}</strong> peças/mês deste produto
            cobre o custo fixo e inicia o lucro.
          </div>
        </div>
      ) : null}

      <HorizontalBars result={result} />

      <div className="breakdown-total">
        <span>Custo total</span>
        <span className="mono">{formatCurrency(result.totalCost)}</span>
      </div>

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

      <CapacityPanel
        settings={capacitySettings}
        result={capacityResult}
        onChange={onCapacityChange}
      />
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
