"use client";

import { useEffect, useState } from "react";
import { persistFees, subscribeFees } from "@/lib/firebase/feesRepository";
import { errorMessage, guardOnline } from "@/lib/errors";
import { DEFAULT_PAYMENT_FEES } from "../constants";
import type { PaymentFeeSettings } from "../types";

export function useFees() {
  const [fees, setFees] = useState<PaymentFeeSettings>(DEFAULT_PAYMENT_FEES);
  const [loaded, setLoaded] = useState(false);
  // TD-020: a última falha de gravação, para a tela poder dizer. `null` = ok.
  const [error, setError] = useState<string | null>(null);

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

  /**
   * TD-020 — o editor de taxas chama isto a CADA TECLA, e o chamador não espera
   * o resultado. Por isso a falha não é lançada (viraria unhandled rejection a
   * cada dígito): ela vira o `error`, que a tela mostra.
   *
   * O `guardOnline` vem antes do `await` pelo motivo de sempre — offline a
   * Promise do Firestore fica pendente para sempre. O valor local é aplicado do
   * mesmo jeito, senão o campo travaria enquanto se digita.
   */
  async function saveFees(next: PaymentFeeSettings) {
    setFees(next);
    try {
      guardOnline();
      await persistFees(next);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return { fees, loaded, saveFees, error };
}
