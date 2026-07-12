import {
  doc,
  onSnapshot,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import type {
  QuoteBusiness,
  QuoteConfig,
} from "@/features/pricing-calculator/types";
import { DEFAULT_QUOTE_BUSINESS } from "@/features/pricing-calculator/constants";

// Ajustes do orçamento num único doc de config, compartilhado entre aparelhos
// (mesmo padrão do config/machines): dados do negócio + última numeração usada.
const quoteDoc = doc(db, "config", "orcamento");

function toConfig(data: DocumentData): QuoteConfig {
  const business = data.business ?? {};
  return {
    business: {
      name: business.name ?? DEFAULT_QUOTE_BUSINESS.name,
      phone: business.phone ?? "",
      // Compat: docs antigos guardavam tudo em `contact` → cai no e-mail.
      email: business.email ?? business.contact ?? "",
      instagram: business.instagram ?? "",
    },
    lastNumber: Number(data.lastNumber) || 0,
  };
}

/**
 * Escuta o config do orçamento em tempo real. Chama `onConfig(null)` quando o
 * documento ainda não existe (primeiro uso).
 */
export function subscribeQuoteConfig(
  onConfig: (config: QuoteConfig | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    quoteDoc,
    (snapshot) => {
      if (!snapshot.exists()) {
        onConfig(null);
        return;
      }
      onConfig(toConfig(snapshot.data()));
    },
    (error) => onError(error),
  );
}

export async function persistQuoteBusiness(
  business: QuoteBusiness,
): Promise<void> {
  await setDoc(quoteDoc, { business }, { merge: true });
}

export async function persistQuoteNumber(lastNumber: number): Promise<void> {
  await setDoc(quoteDoc, { lastNumber }, { merge: true });
}
