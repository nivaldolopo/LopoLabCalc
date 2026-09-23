"use client";

import { useEffect, useState } from "react";
import { persistFees, subscribeFees } from "@/lib/firebase/feesRepository";
import { errorMessage, guardOnline } from "@/lib/errors";
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

  /**
   * TD-020 — grava as taxas e devolve a mensagem de erro, ou `null`. [V8] Era
   * chamada a CADA TECLA (por isso engolia o erro num estado); agora só no
   * "Salvar" da aba, que mostra o retorno.
   *
   * O `guardOnline` vem antes do `await` pelo motivo de sempre — offline a
   * Promise do Firestore fica pendente para sempre. O estado local não é
   * adiantado: o valor novo chega pelo snapshot.
   */
  async function saveFees(next: PaymentFeeSettings): Promise<string | null> {
    try {
      guardOnline();
      await persistFees(next);
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  }

  return { fees, loaded, saveFees };
}
