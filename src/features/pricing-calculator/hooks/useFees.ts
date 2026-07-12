"use client";

import { useEffect, useState } from "react";
import { persistFees, subscribeFees } from "@/lib/firebase/feesRepository";
import { DEFAULT_PAYMENT_FEES } from "../constants";
import type { PaymentFeeSettings } from "../types";

export function useFees() {
  const [fees, setFees] = useState<PaymentFeeSettings>(DEFAULT_PAYMENT_FEES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeFees(
      (next) => {
        if (next) setFees(next);
        setLoaded(true);
      },
      () => setLoaded(true),
    );
    return unsubscribe;
  }, []);

  async function saveFees(next: PaymentFeeSettings) {
    setFees(next);
    await persistFees(next);
  }

  return { fees, loaded, saveFees };
}
