"use client";

import { useEffect, useState } from "react";
import {
  removeProduction,
  saveProduction,
  subscribeProduction,
  type FinishedUpdate,
} from "@/lib/firebase/productionRepository";
import type {
  CloudStatus,
  ProductionEvent,
  ProductionPayload,
  StockFilament,
  Supply,
} from "../types";

// Registro de produção em tempo real (FEAT-04b). Molde do `useStock`/`useSales`:
// só assina a coleção `producao` e expõe gravar/excluir. A baixa dos rolos vai
// junto no mesmo `writeBatch` do repositório (atômica com os eventos).
export function useProduction() {
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeProduction(
      (nextEvents) => {
        setEvents(nextEvents);
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

  // Exclui um evento e estorna sua baixa. `colorUpdates` vem de
  // `reverseProduction` (cores com os rolos restaurados); vazio no historico.
  // `finished` estorna o acabado quando o evento o havia incrementado (05b).
  async function deleteProduction(
    eventId: string,
    colorUpdates: StockFilament[],
    finished?: FinishedUpdate | null,
    supplyUpdates: Supply[] = [],
  ) {
    await removeProduction(eventId, colorUpdates, finished, supplyUpdates);
  }

  return { events, status, error, addProduction, deleteProduction };
}
