"use client";

import { useEffect, useState } from "react";
import {
  fetchProductionCount,
  removeProduction,
  saveProduction,
  subscribeProductionPage,
  type FinishedUpdate,
} from "@/lib/firebase/productionRepository";
import type {
  CloudStatus,
  ProductionEvent,
  ProductionPayload,
  StockFilament,
  Supply,
} from "../types";

const PAGE_SIZE = 25;

// TD-006: versão PAGINADA do `useProduction` para a lista da /producao. Assina só
// a janela mais recente por `at` (limite crescente); `totalCount` (aggregation)
// alimenta o "X de N". As mutações (gravar/excluir) são write one-shot — não
// assinam nada — então moram aqui também, sem custo de leitura extra. O ROI
// (/maquinas) segue no `useProduction` cheio. O estorno resolve os eventos por id
// (fetchProductionEventsByIds), não pela janela.
export function useProductionPage() {
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeProductionPage(
      pageLimit,
      (nextEvents, more) => {
        setEvents(nextEvents);
        setHasMore(more);
        setStatus("synced");
        setError(null);
        fetchProductionCount()
          .then((next) => {
            if (!cancelled) setTotalCount(next);
          })
          .catch(() => {});
      },
      (nextError) => {
        setStatus("error");
        setError(nextError.message);
      },
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [pageLimit]);

  function loadMore() {
    setPageLimit((current) => current + PAGE_SIZE);
  }

  async function addProduction(
    entries: { id: string; payload: ProductionPayload }[],
    colorUpdates: StockFilament[],
    finished?: FinishedUpdate | null,
    supplyUpdates: Supply[] = [],
  ) {
    await saveProduction(entries, colorUpdates, finished, supplyUpdates);
  }

  async function deleteProduction(
    eventId: string,
    colorUpdates: StockFilament[],
    finished?: FinishedUpdate | null,
    supplyUpdates: Supply[] = [],
  ) {
    await removeProduction(eventId, colorUpdates, finished, supplyUpdates);
  }

  return {
    events,
    totalCount,
    hasMore,
    loadMore,
    status,
    error,
    addProduction,
    deleteProduction,
  };
}
