"use client";

import { useEffect, useState } from "react";
import {
  createQuote,
  removeQuote,
  subscribeQuotes,
} from "@/lib/firebase/quotesRepository";
import type { CloudStatus, QuoteRecord, QuoteRecordPayload } from "../types";

export function useQuotes() {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeQuotes(
      (next) => {
        setQuotes(next);
        setStatus("synced");
        setError(null);
      },
      (nextError) => {
        setStatus("error");
        setError(nextError.message);
      },
    );
    return unsubscribe;
  }, []);

  async function addQuote(payload: QuoteRecordPayload) {
    await createQuote(payload);
  }

  async function deleteQuote(quoteId: string) {
    await removeQuote(quoteId);
  }

  return { quotes, status, error, addQuote, deleteQuote };
}
