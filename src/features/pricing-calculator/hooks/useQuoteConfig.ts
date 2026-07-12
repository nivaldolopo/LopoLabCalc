"use client";

import { useEffect, useState } from "react";
import {
  persistQuoteBusiness,
  persistQuoteNumber,
  subscribeQuoteConfig,
} from "@/lib/firebase/quoteConfigRepository";
import { DEFAULT_QUOTE_BUSINESS } from "../constants";
import type { QuoteBusiness } from "../types";

export function useQuoteConfig() {
  const [business, setBusiness] = useState<QuoteBusiness>(
    DEFAULT_QUOTE_BUSINESS,
  );
  const [lastNumber, setLastNumber] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeQuoteConfig(
      (config) => {
        if (config) {
          setBusiness(config.business);
          setLastNumber(config.lastNumber);
        }
        setLoaded(true);
      },
      () => setLoaded(true),
    );
    return unsubscribe;
  }, []);

  async function saveBusiness(next: QuoteBusiness) {
    setBusiness(next);
    await persistQuoteBusiness(next);
  }

  // Grava o número usado como "último" (a próxima geração parte de +1).
  async function commitNumber(used: number) {
    setLastNumber(used);
    await persistQuoteNumber(used);
  }

  return { business, lastNumber, loaded, saveBusiness, commitNumber };
}
