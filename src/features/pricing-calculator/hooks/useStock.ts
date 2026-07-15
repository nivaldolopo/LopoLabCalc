"use client";

import { useEffect, useState } from "react";
import {
  createStockFilament,
  removeStockFilament,
  saveStockFilament,
  subscribeStock,
} from "@/lib/firebase/stockRepository";
import type { CloudStatus, StockFilament, StockFilamentPayload } from "../types";

// Estoque de filamento em tempo real (uma cor por doc). Segue o `useSales`: sem
// o semeio de localStorage do `useMachines` — lá é herança de uma versão
// anterior, aqui não há nada para migrar (a cor nasce no cadastro da 7b).
export function useStock() {
  const [filaments, setFilaments] = useState<StockFilament[]>([]);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeStock(
      (nextFilaments) => {
        setFilaments(nextFilaments);
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

  async function addFilament(payload: StockFilamentPayload) {
    await createStockFilament(payload);
  }

  async function updateFilament(
    filamentId: string,
    payload: StockFilamentPayload,
  ) {
    await saveStockFilament(filamentId, payload);
  }

  async function deleteFilament(filamentId: string) {
    await removeStockFilament(filamentId);
  }

  return {
    filaments,
    status,
    error,
    addFilament,
    updateFilament,
    deleteFilament,
  };
}
