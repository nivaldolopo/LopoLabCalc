"use client";

import { formatCurrency } from "@/lib/formatting/currency";
import type { PricingResult } from "../types";

// Card de rentabilidade compartilhado entre o card de preço sugerido e o
// dropdown do catálogo — assim os dois mostram sempre a mesma informação.
export function ProfitSummary({
  result,
  printHours,
}: {
  result: PricingResult;
  printHours: number;
}) {
  const profitPerPiece = result.suggestedPrice - result.totalCost;
  const profitBatch = profitPerPiece * result.pieces;
  const profitPerHour = printHours > 0 ? profitBatch / printHours : 0;
  const cls = profitPerPiece < 0 ? "sale-neg" : "sale-pos";

  return (
    <div className="cd-profit-card">
      <div className="cd-section-head">
        <span className="result-label">💵 Rentabilidade</span>
      </div>
      <div className="cd-profit-rows">
        <div className="cd-profit-row">
          <span className="cd-profit-label">Lucro / peça</span>
          <span className={`cd-profit-value ${cls}`}>
            {formatCurrency(profitPerPiece)}
          </span>
        </div>
        <div className="cd-profit-row">
          <span className="cd-profit-label">Lucro / hora de máquina</span>
          <span className={`cd-profit-value ${cls}`}>
            {formatCurrency(profitPerHour)}
            <em>/h</em>
          </span>
        </div>
        {result.pieces > 1 ? (
          <div className="cd-profit-row">
            <span className="cd-profit-label">
              Lucro do lote ({result.pieces} pçs)
            </span>
            <span className={`cd-profit-value ${cls}`}>
              {formatCurrency(profitBatch)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
