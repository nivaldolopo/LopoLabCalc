"use client";

import { formatCurrency } from "@/lib/formatting/currency";
import type { CapacityResult, CapacitySettings } from "../types";

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
  return (
    <div className="capacity-box">
      <div className="capacity-title">
        📊 Capacidade produtiva deste produto
      </div>
      <div className="capacity-inputs">
        <div className="ci-item">
          <label>Horas de impressão/dia</label>
          <input
            max={24}
            min={0}
            type="number"
            value={settings.hoursDay}
            onChange={(event) =>
              onChange({
                hoursDay: Math.min(24, Math.max(0, Number(event.target.value) || 0)),
              })
            }
          />
        </div>
        <div className="ci-item">
          <label>Máquinas dedicadas</label>
          <input
            min={1}
            type="number"
            value={settings.machines}
            onChange={(event) =>
              onChange({ machines: Math.max(1, Number(event.target.value) || 1) })
            }
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
            {result ? `Fat. líquido: ${formatCurrency(result.netDay)}` : ""}
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
            {result ? `Fat. líquido: ${formatCurrency(result.netMonth)}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
