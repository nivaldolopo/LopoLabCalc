"use client";

import { formatCurrency } from "@/lib/formatting/currency";
import type { CapacityResult, CapacitySettings } from "../types";
import { NumberInput } from "./NumberInput";

type CapacityPanelProps = {
  settings: CapacitySettings;
  result: CapacityResult | null;
  onChange: (patch: Partial<CapacitySettings>) => void;
};

// Diário pode ser fracionário (job que dura mais de um dia). Mostra até 1 casa
// decimal, sem zeros à toa: 4 → "4", 0.25 → "0,3", 1.5 → "1,5".
function formatCount(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function CapacityPanel({
  settings,
  result,
  onChange,
}: CapacityPanelProps) {
  // Mesmo critério do card "Rentabilidade": só é "Lucro" quando o custo fixo
  // entra no totalCost; sem o fixo, o líquido é apenas "Contribuição".
  const term = result?.fixedIncluded ? "Lucro" : "Contribuição";

  return (
    <div className="capacity-box">
      <div className="capacity-title">
        📊 Capacidade produtiva deste produto
      </div>
      <div className="capacity-inputs">
        <div className="ci-item">
          <label>Horas de impressão/dia</label>
          <NumberInput
            max={24}
            min={0}
            value={settings.hoursDay}
            onChange={(hoursDay) => onChange({ hoursDay })}
          />
        </div>
        <div className="ci-item">
          <label>Máquinas dedicadas</label>
          <NumberInput
            min={1}
            value={settings.machines}
            onChange={(machines) => onChange({ machines })}
          />
        </div>
      </div>
      <div className="capacity-grid">
        <div>
          <div className="capacity-col-title">☀️ Diário</div>
          <div className="capacity-val">
            {result ? `${formatCount(result.piecesDay)} peças` : "—"}
          </div>
          <div className="capacity-sub">
            {result
              ? `${formatCount(result.cyclesDay)} impressões/dia`
              : "defina tempo de impressão"}
          </div>
          <div className="capacity-profit">
            {result ? `Fat. bruto: ${formatCurrency(result.grossDay)}` : ""}
          </div>
          <div className="capacity-sub">
            {result ? `${term}: ${formatCurrency(result.netDay)}` : ""}
          </div>
        </div>
        <div>
          <div className="capacity-col-title">📅 Mensal (30d)</div>
          <div className="capacity-val">
            {result ? `${result.piecesMonth} peças` : "—"}
          </div>
          <div className="capacity-sub">
            {result ? `${result.cyclesMonth} impressões/mês` : ""}
          </div>
          <div className="capacity-profit">
            {result ? `Fat. bruto: ${formatCurrency(result.grossMonth)}` : ""}
          </div>
          <div className="capacity-sub">
            {result ? `${term}: ${formatCurrency(result.netMonth)}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
