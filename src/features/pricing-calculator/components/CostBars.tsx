"use client";

import { formatCurrency } from "@/lib/formatting/currency";
import type { PricingResult } from "../types";

export function CostBars({ result }: { result: PricingResult }) {
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
