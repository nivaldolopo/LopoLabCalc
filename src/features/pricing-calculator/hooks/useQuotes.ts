"use client";

import { useEffect, useState } from "react";
import {
  createQuote,
  removeQuote,
  subscribeQuotes,
} from "@/lib/firebase/quotesRepository";
import { guardOnline } from "@/lib/errors";
import { cloudStatusOf } from "@/lib/cloudStatus";
import type { CloudStatus, QuoteRecord, QuoteRecordPayload } from "../types";

export function useQuotes() {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeQuotes(
      (next, origin) => {
        setQuotes(next);
        // AUD-15 [E4]: "chegou" não é "veio do servidor" — ver `cloudStatusOf`.
        setStatus(cloudStatusOf(origin));
        setError(null);
      },
      (nextError) => {
        setStatus("error");
        setError(nextError.message);
      },
    );
    return unsubscribe;
  }, []);

  // TD-029 — as duas LANÇAM (ao contrário do `saveBusiness` ao lado): os dois
  // chamadores já esperam o resultado dentro de um `try` que reporta pelo
  // `FeedbackNote`. Sem o guarda, offline o `await` do excluir ficava pendente
  // para sempre e o orçamento sumia da lista (mutação local) sem aviso nenhum.
  async function addQuote(payload: QuoteRecordPayload) {
    guardOnline();
    await createQuote(payload);
  }

  async function deleteQuote(quoteId: string) {
    guardOnline();
    await removeQuote(quoteId);
  }

  return { quotes, status, error, addQuote, deleteQuote };
}
