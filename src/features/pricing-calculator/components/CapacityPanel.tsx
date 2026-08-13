"use client";

import { formatCurrency } from "@/lib/formatting/currency";
import type { CapacityResult, CapacitySettings } from "../types";
import { NumberInput } from "./NumberInput";

type CapacityPanelProps = {
  settings: CapacitySettings;
  result: CapacityResult | null;
  // TD-010: o painel abre com o padrão do negócio (config/negocio, o mesmo que
  // rateia o custo fixo). Mexer nos campos vira SIMULAÇÃO local — não persiste e
  // não muda preço nenhum —, e é isso que `isCustom`/`onReset` sinalizam.
  isCustom: boolean;
  onChange: (patch: Partial<CapacitySettings>) => void;
  onReset: () => void;
};

// Diário pode ser fracionário (job que dura mais de um dia). Mostra até 1 casa
// decimal, sem zeros à toa: 4 → "4", 0.25 → "0,3", 1.5 → "1,5".
function formatCount(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function CapacityPanel({
  settings,
  result,
  isCustom,
  onChange,
  onReset,
}: CapacityPanelProps) {
  // Mesmo critério do card "Rentabilidade": só é "Lucro" quando o custo fixo
  // entra no totalCost; sem o fixo, o líquido é apenas "Contribuição".
  const term = result?.fixedIncluded ? "Lucro" : "Contribuição";
  const failurePct = result?.failureRatePct ?? 0;

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
          <label>Dias de impressão/mês</label>
          <NumberInput
            max={31}
            min={1}
            value={settings.daysMonth}
            onChange={(daysMonth) => onChange({ daysMonth })}
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
      {isCustom ? (
        <div className="capacity-sim">
          <span>
            Simulando — os valores salvos do negócio (custos fixos) não mudaram.
          </span>
          <button type="button" className="capacity-sim-reset" onClick={onReset}>
            voltar ao padrão
          </button>
        </div>
      ) : null}
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
          <div className="capacity-col-title">
            📅 Mensal ({settings.daysMonth}d)
          </div>
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
      {result && failurePct > 0 ? (
        <div className="capacity-note">
          Peças = peças <strong>boas</strong>, já descontados{" "}
          {formatCount(failurePct)}% de falha. As impressões contam os ciclos
          rodados (a que falha ocupa a máquina do mesmo jeito).
        </div>
      ) : null}
      {result && result.machineBreakdown.length > 1 ? (
        <div className="capacity-bottleneck">
          {result.machineBreakdown.map((m) =>
            m.isBottleneck ? (
              <span key={m.machineId} className="cb-limit">
                🔧 Gargalo: <strong>{m.machineName}</strong> ({m.piecesMonth}/mês)
              </span>
            ) : (
              <span key={m.machineId} className="cb-slack">
                {m.machineName} tem folga (daria {m.piecesMonth}/mês)
              </span>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
