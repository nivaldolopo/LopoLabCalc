"use client";

import { useEffect, useState } from "react";
import {
  removeProduction,
  saveProduction,
  subscribeProduction,
  type FinishedUpdate,
} from "@/lib/firebase/productionRepository";
import { cloudStatusOf } from "@/lib/cloudStatus";
import type {
  CloudStatus,
  ProductionEvent,
  ProductionPayload,
  StockFilament,
  Supply,
} from "../types";

// Registro de produção em tempo real (FEAT-04b). Molde do `useStock`/`useSales`:
// só assina a coleção `producao` e expõe gravar/excluir. A baixa dos rolos vai
// junto na mesma transação do repositório (atômica com os eventos).
export function useProduction() {
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeProduction(
      (nextEvents, origin) => {
        setEvents(nextEvents);
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

  // Grava N eventos (o "inteiro" multi-máquina vira mais de um) + a baixa final
  // das cores afetadas + o incremento do acabado (FEAT-05b, só desfecho
  // estoque), tudo atômico.
  async function addProduction(
    entries: { id: string; payload: ProductionPayload }[],
    colorUpdates: StockFilament[],
    finished?: FinishedUpdate | null,
    supplyUpdates: Supply[] = [],
  ) {
    await saveProduction(entries, colorUpdates, finished, supplyUpdates);
  }

  // [FROTA] Fase 1 — exclui a SUBMISSÃO inteira (os N eventos do lote) e estorna
  // a baixa de todos. `colorUpdates` vem de `reverseProduction` sobre os
  // `stockMoves` somados; vazio no historico. `finished` estorna o acabado que a
  // submissão havia creditado (05b).
  async function deleteProduction(
    eventIds: string[],
    colorUpdates: StockFilament[],
    finished?: FinishedUpdate | null,
    supplyUpdates: Supply[] = [],
  ) {
    await removeProduction(eventIds, colorUpdates, finished, supplyUpdates);
  }

  return { events, status, error, addProduction, deleteProduction };
}
