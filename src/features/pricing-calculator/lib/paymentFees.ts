import type { PaymentFeeSettings, PaymentMethod } from "../types";

// Fração da taxa (0..0,95) a partir do percentual configurado. Clamp em 95%
// para nunca explodir o gross-up (dividir por algo perto de zero).
export function feeFraction(feeRatePct: number): number {
  const pct = Number(feeRatePct);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(0.95, pct / 100);
}

// Percentual da taxa de um método (0 se não configurado ou inválido).
export function feeRateForMethod(
  fees: PaymentFeeSettings | null | undefined,
  method: PaymentMethod,
): number {
  const pct = Number(fees?.[method]);
  return Number.isFinite(pct) && pct > 0 ? pct : 0;
}

// Preço inflado para REPASSAR a taxa ao cliente: para você receber `base`
// líquido após uma taxa f, o cliente paga base / (1 − f). Sem taxa, devolve base.
export function grossUpForFee(base: number, feeRatePct: number): number {
  const value = Math.max(0, Number(base) || 0);
  const f = feeFraction(feeRatePct);
  return f > 0 ? value / (1 - f) : value;
}

export type SaleItemFinancials = {
  totalRevenue: number; // o que o cliente paga (chargedUnit × qty)
  totalCost: number;
  feeAmount: number; // taxa descontada no total do item (R$)
  profit: number; // líquido: totalRevenue − totalCost − feeAmount
  margin: number; // profit / totalRevenue (%)
};

// Financeiro de UM item da venda. `chargedUnitPrice` é o que o cliente paga por
// unidade (já com o repasse embutido, se houver). A taxa é sempre descontada do
// que você recebe — em Pix/dinheiro (feeRatePct=0) o líquido é a margem cheia.
export function saleItemFinancials(params: {
  chargedUnitPrice: number;
  quantity: number;
  unitCost: number;
  feeRatePct: number;
}): SaleItemFinancials {
  const qty = Math.max(1, Number(params.quantity) || 1);
  const charged = Math.max(0, Number(params.chargedUnitPrice) || 0);
  const f = feeFraction(params.feeRatePct);
  const totalRevenue = charged * qty;
  const totalCost = Math.max(0, Number(params.unitCost) || 0) * qty;
  const feeAmount = totalRevenue * f;
  const profit = totalRevenue - totalCost - feeAmount;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  return { totalRevenue, totalCost, feeAmount, profit, margin };
}
