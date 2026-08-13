import { round2 } from "@/lib/number";
import { CARD_BRAND_TIERS } from "../constants";
import type {
  CardBrandTier,
  Discount,
  PaymentFeeSettings,
  PaymentMethod,
} from "../types";

// Fração da taxa (0..0,95) a partir do percentual configurado. Clamp em 95%
// para nunca explodir o gross-up (dividir por algo perto de zero).
export function feeFraction(feeRatePct: number): number {
  const pct = Number(feeRatePct);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(0.95, pct / 100);
}

function posOrZero(value: unknown): number {
  const pct = Number(value);
  return Number.isFinite(pct) && pct > 0 ? pct : 0;
}

// Percentual da taxa RESOLVIDA de uma combinação forma × bandeira × parcela (0 se
// não configurado ou inválido). Débito depende só da bandeira; crédito também da
// parcela (`installments`: 1 = à vista, clampado ao vetor da bandeira). Pix/dinheiro/
// outro são planos e ignoram bandeira/parcela.
export function resolveFeeRate(
  fees: PaymentFeeSettings | null | undefined,
  method: PaymentMethod,
  tier: CardBrandTier,
  installments = 1,
): number {
  if (!fees) return 0;
  if (method === "debito") return posOrZero(fees.card?.[tier]?.debito);
  if (method === "credito") {
    const rates = fees.card?.[tier]?.credito ?? [];
    if (rates.length === 0) return 0;
    const n = Math.min(
      Math.max(1, Math.round(Number(installments) || 1)),
      rates.length,
    );
    return posOrZero(rates[n - 1]);
  }
  if (method === "pix") return posOrZero(fees.pix);
  if (method === "dinheiro") return posOrZero(fees.dinheiro);
  return posOrZero(fees.outro);
}

// Preço inflado para REPASSAR a taxa ao cliente: para você receber `base`
// líquido após uma taxa f, o cliente paga base / (1 − f). Sem taxa, devolve base.
export function grossUpForFee(base: number, feeRatePct: number): number {
  const value = Math.max(0, Number(base) || 0);
  const f = feeFraction(feeRatePct);
  return f > 0 ? value / (1 - f) : value;
}

// FEAT-09: R$ efetivo de um desconto sobre uma base (o total bruto da linha ou do
// recibo). Clamp: nunca negativo, nunca acima da base; percentual limitado a 100%.
// Arredonda a centavos. Sem desconto (null/zero) devolve 0.
export function discountAmountOf(
  base: number,
  discount: Discount | null | undefined,
): number {
  const b = Math.max(0, Number(base) || 0);
  const value = Math.max(0, Number(discount?.value) || 0);
  if (!discount || value <= 0 || b <= 0) return 0;
  const raw = discount.mode === "pct" ? (b * Math.min(100, value)) / 100 : value;
  return round2(Math.min(b, raw));
}

// FEAT-09: rateia um desconto no TOTAL do recibo entre as linhas, proporcional à
// receita BRUTA de cada uma (salePrice × qty). O resíduo de arredondamento vai na
// última linha com receita > 0, para a soma das fatias bater exatamente com o
// desconto (limitado ao bruto total). Devolve o R$ por linha, na ordem recebida.
export function apportionDiscount(
  lineGross: number[],
  totalDiscount: number,
): number[] {
  const grosses = lineGross.map((g) => Math.max(0, Number(g) || 0));
  const sum = grosses.reduce((acc, g) => acc + g, 0);
  const capped = Math.min(Math.max(0, Number(totalDiscount) || 0), sum);
  if (capped <= 0 || sum <= 0) return grosses.map(() => 0);
  const shares = grosses.map((g) => round2((capped * g) / sum));
  const residual = round2(capped - shares.reduce((acc, s) => acc + s, 0));
  if (residual !== 0) {
    for (let i = shares.length - 1; i >= 0; i -= 1) {
      if (grosses[i] > 0) {
        shares[i] = round2(shares[i] + residual);
        break;
      }
    }
  }
  return shares;
}

export type SaleItemFinancials = {
  totalRevenue: number; // o que o cliente paga: chargedUnit × qty − desconto
  totalCost: number;
  feeAmount: number; // taxa descontada no total do item (R$), sobre a receita líquida
  profit: number; // líquido: totalRevenue − totalCost − feeAmount
  margin: number; // profit / totalRevenue (%)
};

// Financeiro de UM item da venda. `chargedUnitPrice` é o que o cliente paga por
// unidade (já com o repasse embutido, se houver). `discountAmount` (FEAT-09) é o
// R$ abatido no TOTAL da linha antes da taxa — a taxa incide sobre o valor JÁ com
// desconto (o que a maquininha de fato cobra). A taxa é sempre descontada do que
// você recebe — em Pix/dinheiro (feeRatePct=0) o líquido é a margem cheia.
export function saleItemFinancials(params: {
  chargedUnitPrice: number;
  quantity: number;
  unitCost: number;
  feeRatePct: number;
  discountAmount?: number;
}): SaleItemFinancials {
  const qty = Math.max(1, Number(params.quantity) || 1);
  const charged = Math.max(0, Number(params.chargedUnitPrice) || 0);
  const gross = charged * qty;
  const discount = Math.min(gross, Math.max(0, Number(params.discountAmount) || 0));
  const f = feeFraction(params.feeRatePct);
  const totalRevenue = gross - discount;
  const totalCost = Math.max(0, Number(params.unitCost) || 0) * qty;
  const feeAmount = totalRevenue * f;
  const profit = totalRevenue - totalCost - feeAmount;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  return { totalRevenue, totalCost, feeAmount, profit, margin };
}

export type WorstPaymentFee = {
  ratePct: number; // a maior taxa configurada (%)
  label: string; // legível: "crédito 3× Amex / Elo", "débito Visa / Mastercard"…
};

// UX-10: a PIOR combinação forma × bandeira × parcela entre as taxas configuradas
// — a que mais come a margem se o cliente escolher. Existe porque
// `PricingResult.margin` é BRUTA (pré-taxa) e a decisão de preço acontece no
// catálogo/calculadora, onde só o número otimista aparecia; o `SaleModal` já
// calculava certo, mas aí a venda já está acontecendo. Devolve `null` quando
// nenhuma taxa está configurada (tudo isento) — aí não há contraponto a mostrar.
export function worstPaymentFee(
  fees: PaymentFeeSettings | null | undefined,
): WorstPaymentFee | null {
  if (!fees) return null;
  // Rate/label separados (não um objeto acumulador) só para não depender de
  // narrowing de `let` dentro do closure.
  let rate = 0;
  let label = "";
  const consider = (candidate: unknown, name: string) => {
    const pct = posOrZero(candidate);
    if (pct > rate) {
      rate = pct;
      label = name;
    }
  };

  consider(fees.pix, "Pix");
  consider(fees.dinheiro, "dinheiro");
  consider(fees.outro, "outro");
  // Percorre as bandeiras pela constante (não por Object.keys) para o rótulo sair
  // igual ao do editor de taxas e da venda.
  for (const tier of CARD_BRAND_TIERS) {
    const card = fees.card?.[tier.value];
    if (!card) continue;
    consider(card.debito, `débito ${tier.label}`);
    (card.credito ?? []).forEach((installmentRate, index) => {
      const n = index + 1;
      consider(
        installmentRate,
        `crédito ${n === 1 ? "à vista" : `${n}×`} ${tier.label}`,
      );
    });
  }

  return rate > 0 ? { ratePct: rate, label } : null;
}

// UX-10: margem LÍQUIDA do preço sugerido sob uma taxa. Passa pelo MESMO
// `saleItemFinancials` da venda real para os dois números não divergirem.
// Sem repasse a taxa sai do que você recebe, então a margem cai exatamente
// `feeRatePct` pontos percentuais — a conta é trivial, o valor aqui é a fonte
// única.
export function netMarginPct(
  suggestedPrice: number,
  unitCost: number,
  feeRatePct: number,
): number {
  return saleItemFinancials({
    chargedUnitPrice: suggestedPrice,
    quantity: 1,
    unitCost,
    feeRatePct,
  }).margin;
}
