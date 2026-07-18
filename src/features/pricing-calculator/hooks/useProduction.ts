"use client";

import { useEffect, useState } from "react";
import {
  removeProduction,
  saveProduction,
  subscribeProduction,
} from "@/lib/firebase/productionRepository";
import type {
  CloudStatus,
  ProductionEvent,
  ProductionPayload,
  StockFilament,
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
  // das cores afetadas, tudo atômico.
  async function addProduction(
    entries: { id: string; payload: ProductionPayload }[],
    colorUpdates: StockFilament[],
  ) {
    await saveProduction(entries, colorUpdates);
  }

  // Exclui um evento e estorna sua baixa. `colorUpdates` vem de
  // `reverseProduction` (cores com os rolos restaurados); vazio no historico.
  async function deleteProduction(
    eventId: string,
    colorUpdates: StockFilament[],
  ) {
    await removeProduction(eventId, colorUpdates);
  }

  return { events, status, error, addProduction, deleteProduction };
}
