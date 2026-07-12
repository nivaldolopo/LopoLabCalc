import {
  doc,
  onSnapshot,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import type { QuoteBusiness } from "@/features/pricing-calculator/types";
import { DEFAULT_QUOTE_BUSINESS } from "@/features/pricing-calculator/constants";

// Dados do negócio do orçamento num doc de config, compartilhado entre aparelhos
// (mesmo padrão do config/machines). A numeração NÃO fica aqui — é derivada do
// histórico (maior número + 1), então zera sozinha quando o histórico esvazia.
const quoteDoc = doc(db, "config", "orcamento");

function toBusiness(data: DocumentData): QuoteBusiness {
  const business = data.business ?? {};
  return {
    name: business.name ?? DEFAULT_QUOTE_BUSINESS.name,
    phone: business.phone ?? "",
    // Compat: docs antigos guardavam tudo em `contact` → cai no e-mail.
    email: business.email ?? business.contact ?? "",
    instagram: business.instagram ?? "",
  };
}

/**
 * Escuta os dados do negócio em tempo real. Chama `onBusiness(null)` quando o
 * documento ainda não existe (primeiro uso).
 */
export function subscribeQuoteBusiness(
  onBusiness: (business: QuoteBusiness | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    quoteDoc,
    (snapshot) => {
      onBusiness(snapshot.exists() ? toBusiness(snapshot.data()) : null);
    },
    (error) => onError(error),
  );
}

export async function persistQuoteBusiness(
  business: QuoteBusiness,
): Promise<void> {
  await setDoc(quoteDoc, { business }, { merge: true });
}
