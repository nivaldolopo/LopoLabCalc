"use client";

import { formatCurrency } from "@/lib/formatting/currency";
import type {
  CapacityResult,
  CapacitySettings,
  FixedCostSettings,
  PricingResult,
  RoundingMode,
} from "../types";
import { ROUNDING_OPTIONS } from "../lib/roundPrice";
import { CapacityPanel } from "./CapacityPanel";
import { CostBars } from "./CostBars";
import { ProfitSummary } from "./ProfitSummary";

type PricingResultCardProps = {
  result: PricingResult;
  fixedCosts: FixedCostSettings;
  capacitySettings: CapacitySettings;
  capacityResult: CapacityResult | null;
  roundingMode: RoundingMode;
  printHours: number;
  onRoundingModeChange: (mode: RoundingMode) => void;
  onCapacityChange: (patch: Partial<CapacitySettings>) => void;
  onRegisterSale: () => void;
};

export function PricingResultCard({
  result,
  fixedCosts,
  capacitySettings,
  capacityResult,
  roundingMode,
  printHours,
  onRoundingModeChange,
  onCapacityChange,
  onRegisterSale,
}: PricingResultCardProps) {
  const totalFixedMonth = fixedCosts.rent + fixedCosts.other;
  const breakEvenUnits =
    totalFixedMonth > 0 && result.contributionMargin > 0
      ? Math.ceil(totalFixedMonth / result.contributionMargin)
      : null;
  // Contextualiza a meta contra a capacidade produtiva: a meta é fácil (usa
  // pouco da capacidade) ou impossível (acima do que dá pra produzir)?
  const capacityMonth = capacityResult?.piecesMonth ?? 0;
  const breakEvenPct =
    breakEvenUnits && capacityMonth > 0
      ? Math.round((breakEvenUnits / capacityMonth) * 100)
      : null;
  const breakEvenOverCapacity =
    breakEvenUnits != null && capacityMonth > 0 && breakEvenUnits > capacityMonth;
  const multiPiece = result.pieces > 1;

  const isRounded = result.suggestedPrice !== result.exactPrice;
  const batchTotal = result.suggestedPrice * result.pieces;

  return (
    <div className="result-card">
      <div className="result-label">
        Preço sugerido{multiPiece ? " (por peça)" : ""}
      </div>
      <div className="result-price sg">
        {formatCurrency(result.suggestedPrice)}
      </div>
      {isRounded ? (
        <div className="result-exact">
          exato: {formatCurrency(result.exactPrice)}
        </div>
      ) : null}
      <div className="result-margin">
        margem de {result.margin.toFixed(0)}% sobre o preço final
      </div>

      {result.machineMissing ? (
        <div className="form-error machine-missing">
          ⚠ Máquina não encontrada — usando “{result.machine.name}” como
          fallback. Reatribua a impressora do produto (o custo pode estar
          errado).
        </div>
      ) : null}

      <div className="rounding-control">
        <label htmlFor="rounding-mode">Arredondar preço</label>
        <select
          id="rounding-mode"
          value={roundingMode}
          onChange={(event) =>
            onRoundingModeChange(event.target.value as RoundingMode)
          }
        >
          {ROUNDING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <button
        className="btn primary register-sale-btn"
        type="button"
        onClick={onRegisterSale}
      >
        🧾 Registrar venda
      </button>

      {breakEvenUnits ? (
        <div className="break-even-box visible">
          <div className="break-even-title">🎯 Meta de Break-Even</div>
          <div className="break-even-val">
            Vender <strong>{breakEvenUnits}</strong> peças/mês deste produto
            cobre o aluguel + custos fixos e inicia o lucro.
          </div>
          {capacityMonth > 0 ? (
            breakEvenOverCapacity ? (
              <div className="break-even-context warn">
                ⚠️ Acima da capacidade ({capacityMonth} pçs/mês) — reveja preço
                ou volume.
              </div>
            ) : (
              <div className="break-even-context">
                ≈ {breakEvenPct}% da sua capacidade mensal ({breakEvenUnits} de{" "}
                {capacityMonth} peças).
              </div>
            )
          ) : null}
        </div>
      ) : null}

      <CostBars result={result} />

      <div className="breakdown-total">
        <span>Custo total{multiPiece ? " (por peça)" : ""}</span>
        <span className="mono">{formatCurrency(result.totalCost)}</span>
      </div>

      {multiPiece ? (
        <div className="per-piece-row">
          <div className="per-piece-label">
            Total da impressão ({result.pieces} peças)
          </div>
          <div className="result-price sg small">
            {formatCurrency(batchTotal)}
          </div>
        </div>
      ) : null}

      <ProfitSummary result={result} printHours={printHours} />

      <CapacityPanel
        settings={capacitySettings}
        result={capacityResult}
        onChange={onCapacityChange}
      />
    </div>
  );
}
