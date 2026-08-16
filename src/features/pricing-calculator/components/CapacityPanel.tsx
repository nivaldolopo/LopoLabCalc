"use client";

import { useId } from "react";
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
  const fieldId = useId();
  // Mesmo critério do card "Rentabilidade": só é "Lucro" quando o custo fixo
  // entra no totalCost; sem o fixo, o líquido é apenas "Contribuição".
  const term = result?.fixedIncluded ? "Lucro" : "Contribuição";
  const failurePct = result?.failureRatePct ?? 0;
  // DEC-06: mesmo saneamento do `calculateCapacity` (piso 1), para o aviso falar
  // o número que a conta de fato usou, não o que está digitado no campo.
  const machinesCount = Math.max(1, Number(settings.machines) || 1);

  return (
    <div className="capacity-box">
      <div className="capacity-title">
        📊 Capacidade produtiva deste produto
      </div>
      <div className="capacity-inputs">
        <div className="ci-item">
          <label htmlFor={`${fieldId}-hours-day`}>Horas de impressão/dia</label>
          <NumberInput
            id={`${fieldId}-hours-day`}
            max={24}
            min={0}
            value={settings.hoursDay}
            onChange={(hoursDay) => onChange({ hoursDay })}
          />
        </div>
        <div className="ci-item">
          <label htmlFor={`${fieldId}-days-month`}>Dias de impressão/mês</label>
          <NumberInput
            id={`${fieldId}-days-month`}
            max={31}
            min={1}
            value={settings.daysMonth}
            onChange={(daysMonth) => onChange({ daysMonth })}
          />
        </div>
        <div className="ci-item">
          <label htmlFor={`${fieldId}-machines`}>Máquinas dedicadas</label>
          <NumberInput
            id={`${fieldId}-machines`}
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
      {/* DEC-06 (dono, 2026-08-16) — `machines` significa N CÓPIAS IDÊNTICAS do
          conjunto que o produto usa, e o `× machines` de calculateCapacity é
          intencional sob essa definição. O que faltava era o app dizer isso: um
          produto que roda em 2 máquinas com "Máquinas dedicadas: 2" pressupõe
          QUATRO impressoras, e nada na tela avisava. Só aparece quando as duas
          condições coexistem — é aí que a premissa deixa de ser óbvia. */}
      {result && result.machineBreakdown.length > 1 && machinesCount > 1 ? (
        <div className="capacity-note">
          Este produto usa <strong>{result.machineBreakdown.length}</strong>{" "}
          máquinas. “Máquinas dedicadas: {machinesCount}” significa{" "}
          <strong>{machinesCount} conjuntos completos</strong> ({machinesCount}×
          cada uma delas ={" "}
          {machinesCount * result.machineBreakdown.length} impressoras), não{" "}
          {machinesCount} impressoras no total.
        </div>
      ) : null}
    </div>
  );
}
