"use client";

import { useEffect, useState } from "react";
import { subscribeFinishedGoods } from "@/lib/firebase/finishedGoodsRepository";
import { cloudStatusOf } from "@/lib/cloudStatus";
import type { CloudStatus, FinishedGood } from "../types";

// Estoque de Produtos / acabados em tempo real (um doc por produto, FEAT-05a).
// Molde do `useStock`/`useProduction`, menos a escrita: este hook é só LEITURA.
// TD-030 — ele expunha `saveGood`/`deleteGood` e nenhum componente jamais os
// chamou. Quem escreve no acabado é a transação da produção (05b), a da venda
// e o do estorno, sempre junto do evento que o justifica; um atalho de gravar
// por fora só serviria para o saldo descolar do rastro.
export function useFinishedGoods() {
  const [goods, setGoods] = useState<FinishedGood[]>([]);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeFinishedGoods(
      (nextGoods, origin) => {
        setGoods(nextGoods);
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

  return { goods, status, error };
}
