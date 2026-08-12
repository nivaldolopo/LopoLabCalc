import {
  doc,
  onSnapshot,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import type {
  CardTierRates,
  PaymentFeeSettings,
} from "@/features/pricing-calculator/types";
import { DEFAULT_PAYMENT_FEES } from "@/features/pricing-calculator/constants";

// Taxas por forma de pagamento num doc de config, compartilhado entre aparelhos
// (mesmo padrão do config/machines e config/orcamento).
const feesDoc = doc(db, "config", "taxas");

// Número válido (finito e ≥ 0) ou o fallback — cada campo ausente/inválido cai no
// default, então um doc parcial (ou anterior ao novo formato) nunca quebra a UI.
function numOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function toTier(raw: DocumentData | undefined, fallback: CardTierRates): CardTierRates {
  const credito = raw?.credito;
  return {
    debito: numOr(raw?.debito, fallback.debito),
    // Preserva o comprimento do default (à vista/2x/3x): cada parcela lê o valor
    // salvo ou cai no default. Ignora extras de um doc mais longo.
    credito: fallback.credito.map((f, i) => numOr(credito?.[i], f)),
  };
}

function toFees(data: DocumentData): PaymentFeeSettings {
  const fees = data.fees ?? {};
  const d = DEFAULT_PAYMENT_FEES;
  const card = fees.card ?? {};
  return {
    pix: numOr(fees.pix, d.pix),
    dinheiro: numOr(fees.dinheiro, d.dinheiro),
    outro: numOr(fees.outro, d.outro),
    card: {
      visamaster: toTier(card.visamaster, d.card.visamaster),
      amexelo: toTier(card.amexelo, d.card.amexelo),
    },
  };
}

/**
 * Escuta as taxas em tempo real. Chama `onFees(null)` quando o documento ainda
 * não existe (primeiro uso), para o chamador usar os defaults.
 */
export function subscribeFees(
  onFees: (fees: PaymentFeeSettings | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    feesDoc,
    (snapshot) => {
      onFees(snapshot.exists() ? toFees(snapshot.data()) : null);
    },
    (error) => onError(error),
  );
}

export async function persistFees(fees: PaymentFeeSettings): Promise<void> {
  await setDoc(feesDoc, { fees }, { merge: true });
}
