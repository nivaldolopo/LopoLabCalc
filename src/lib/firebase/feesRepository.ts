import {
  doc,
  onSnapshot,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import type {
  PaymentFeeSettings,
  PaymentMethod,
} from "@/features/pricing-calculator/types";
import { DEFAULT_PAYMENT_FEES } from "@/features/pricing-calculator/constants";

// Taxas por forma de pagamento num doc de config, compartilhado entre aparelhos
// (mesmo padrão do config/machines e config/orcamento).
const feesDoc = doc(db, "config", "taxas");

const METHODS: PaymentMethod[] = ["pix", "dinheiro", "debito", "credito", "outro"];

function toFees(data: DocumentData): PaymentFeeSettings {
  const fees = data.fees ?? {};
  const result = { ...DEFAULT_PAYMENT_FEES };
  for (const method of METHODS) {
    const value = Number(fees[method]);
    if (Number.isFinite(value) && value >= 0) result[method] = value;
  }
  return result;
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
