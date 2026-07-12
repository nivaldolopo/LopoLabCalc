"use client";

import { useEffect, useState } from "react";
import {
  persistQuoteBusiness,
  subscribeQuoteBusiness,
} from "@/lib/firebase/quoteConfigRepository";
import { DEFAULT_QUOTE_BUSINESS } from "../constants";
import type { QuoteBusiness } from "../types";

export function useQuoteConfig() {
  const [business, setBusiness] = useState<QuoteBusiness>(
    DEFAULT_QUOTE_BUSINESS,
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeQuoteBusiness(
      (next) => {
        if (next) setBusiness(next);
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

  return { business, loaded, saveBusiness };
}
