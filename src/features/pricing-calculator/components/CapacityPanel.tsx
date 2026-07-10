"use client";

import { formatCurrency } from "@/lib/formatting/currency";
import type { CapacityResult, CapacitySettings } from "../types";

type CapacityPanelProps = {
  settings: CapacitySettings;
  result: CapacityResult | null;
  onChange: (patch: Partial<CapacitySettings>) => void;
};

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
              onChange({ hoursDay: Number(event.target.value) || 0 })
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
              onChange({ machines: Number(event.target.value) || 1 })
            }
          />
        </div>
      </div>
      <div className="capacity-grid">
        <div>
          <div className="capacity-col-title">☀️ Diário</div>
          <div className="capacity-val">
            {result ? `${result.piecesDay} peças` : "—"}
          </div>
          <div className="capacity-sub">
            {result
              ? `${result.cyclesDay} impressões/dia`
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
