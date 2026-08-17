"use client";

import { formatCurrency } from "@/lib/formatting/currency";
import type { PricingResult } from "../types";

export function CostBars({ result }: { result: PricingResult }) {
  // TD-014 — as cores saíram do JSX e viraram os `--cost-*` do `base.css`.
  // Antes, 6 dos 8 tons eram hex cravados aqui: não respondiam ao tema E
  // divergiam da paleta que a composição de custo do `/estoque` (`.fg-comp`)
  // já usava para as MESMAS categorias — energia era #E0A96D aqui e #d9a021
  // lá, manutenção #5FA8A0 contra #a8617a. Venceu a do `.fg-comp`, que já
  // tinha variante escura pensada.
  //
  // ⚠ Isto é só a parte de COR do [UX-26]. A queixa de que as barras mentem a
  // proporção (`maxValue` = o maior item, então o maior sempre desenha 100%)
  // é da onda 5 e NÃO foi tocada aqui — ver o `maxValue` logo abaixo.
  const items = [
    { label: "Material", value: result.materialCost, color: "var(--cost-material)" },
    { label: "Energia", value: result.energyCost, color: "var(--cost-energy)" },
    {
      label: "Desgaste",
      value: result.depreciationCost,
      color: "var(--cost-depreciation)",
    },
    { label: "Mão de obra", value: result.laborCost, color: "var(--cost-labor)" },
  ];

  if (result.maintenanceCost > 0) {
    items.push({
      label: "Manutenção",
      value: result.maintenanceCost,
      color: "var(--cost-maintenance)",
    });
  }
  if (result.failureReserve > 0) {
    items.push({
      label: "Reserva de falha",
      value: result.failureReserve,
      // UX-26 (parte-cor): era #D2726B, quase igual ao #C4836B do custo fixo
      // na linha vizinha. Falha é risco → vermelho semântico.
      color: "var(--cost-failure)",
    });
  }
  if (result.accessoriesCost > 0) {
    items.push({
      label: "Acessórios",
      value: result.accessoriesCost,
      color: "var(--cost-supplies)",
    });
  }
  if (result.fixedCost > 0) {
    items.push({
      label: "Custo fixo",
      value: result.fixedCost,
      // ...e o custo fixo vira o neutro: é o balde do que não se atribui a
      // nenhuma categoria, e o neutro é o que menos disputa atenção.
      color: "var(--cost-fixed)",
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
