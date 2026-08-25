import {
  doc,
  onSnapshot,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import { withWriteTimeout } from "@/lib/errors";
import type { QuoteBusiness } from "@/features/pricing-calculator/types";
import { DEFAULT_QUOTE_BUSINESS } from "@/features/pricing-calculator/constants";

// Dados do negócio do orçamento num doc de config, compartilhado entre aparelhos
// (mesmo padrão do config/machines).
// ⚠ AUD-14 [D7] — a numeração continua NÃO ficando aqui, mas o resto da frase
// envelheceu: ela dizia que o número era "derivado do histórico (maior + 1), então
// zera sozinha quando o histórico esvazia". Isso valia até o contador atômico. Hoje
// ela é RESERVADA no servidor, em `config/orcamentoSeq` (ver `reserveQuoteNumber`,
// quotesRepository), é monotônica de propósito — não decresce ao excluir orçamento —
// e o histórico entra só como PISO na 1ª vez. Esvaziar o histórico não zera nada:
// para zerar, apaga-se aquele doc.
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
  await withWriteTimeout(setDoc(quoteDoc, { business }, { merge: true }));
}
