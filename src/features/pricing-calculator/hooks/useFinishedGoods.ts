"use client";

import { useEffect, useState } from "react";
import {
  removeFinishedGood,
  saveFinishedGood,
  subscribeFinishedGoods,
} from "@/lib/firebase/finishedGoodsRepository";
import type {
  CloudStatus,
  FinishedGood,
  FinishedGoodPayload,
} from "../types";

// Estoque de Produtos / acabados em tempo real (um doc por produto, FEAT-05a).
// Molde do `useStock`/`useProduction`: só assina a coleção `acabados` e expõe
// gravar/excluir. O incremento atômico junto do evento de produção vai no repo da
// produção (05b); este hook é a leitura viva (tela 05c) e os avulsos.
export function useFinishedGoods() {
  const [goods, setGoods] = useState<FinishedGood[]>([]);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeFinishedGoods(
      (nextGoods) => {
        setGoods(nextGoods);
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

  async function saveGood(payload: FinishedGoodPayload) {
    await saveFinishedGood(payload);
  }

  async function deleteGood(productId: string) {
    await removeFinishedGood(productId);
  }

  return { goods, status, error, saveGood, deleteGood };
}
