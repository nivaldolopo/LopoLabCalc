"use client";

import { netMarginPct, worstPaymentFee } from "../lib/paymentFees";
import type { PaymentFeeSettings, PricingResult } from "../types";

// UX-10: contraponto à margem BRUTA (`PricingResult.margin`, que ignora a taxa
// de pagamento). Mostra quanto sobra no PIOR meio de pagamento configurado — o
// piso da margem. Não recalcula preço nem custo: só reaplica a taxa por cima,
// pelo mesmo `saleItemFinancials` da venda real.
//
// Some quando não há taxa configurada (tudo isento) — sem taxa, a margem bruta
// já é a líquida e a segunda linha seria ruído.
export function NetMarginHint({
  result,
  fees,
  compact = false,
}: {
  result: PricingResult;
  fees: PaymentFeeSettings | null | undefined;
  // `compact` é a célula da tabela (só o número); o modo cheio nomeia o meio de
  // pagamento e cabe nos cards, onde há largura.
  compact?: boolean;
}) {
  const worst = worstPaymentFee(fees);
  if (!worst) return null;

  const net = netMarginPct(result.suggestedPrice, result.totalCost, worst.ratePct);
  const title = `Margem no pior meio de pagamento: ${worst.label} (taxa de ${worst.ratePct
    .toFixed(2)
    .replace(".", ",")}%). A margem cheia só vale em Pix/dinheiro.`;

  if (compact) {
    return (
      <span className="margin-net-hint" title={title}>
        {net.toFixed(0)}% líq.
      </span>
    );
  }

  return (
    <span className="margin-net-hint" title={title}>
      {net.toFixed(0)}% no pior meio de pagamento ({worst.label})
    </span>
  );
}
