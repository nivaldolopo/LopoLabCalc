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

  return (
    <div className="capacity-box">
      <h2 className="capacity-title">
        📊 Capacidade produtiva deste produto
      </h2>
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

      {/* ⚠ [FROTA] Fase 2 — aqui vivia o aviso do DEC-06 ("2 máquinas dedicadas
          num produto de 2 impressoras = QUATRO"). Ele dependia do
          `machineBreakdown`, que dependia da máquina atribuída a cada etapa na
          PRECIFICAÇÃO — e é essa atribuição que a taxa de frota desfez. O `×
          machines` do `calculateCapacity` continua igual e continua significando
          conjuntos completos; o que não existe mais é o dado que dizia quando a
          premissa deixava de ser óbvia. Desembaraçar o duplo papel do campo
          "Máquinas" está no BACKLOG, e é lá que este aviso volta com base real.

          O ciclo também deixou de ser o gargalo por máquina: virou a soma das
          horas (o pior caso honesto). Ver o comentário no `calculateCapacity`. */}
    </div>
  );
}
