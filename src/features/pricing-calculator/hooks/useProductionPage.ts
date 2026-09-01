"use client";

import { useEffect, useState } from "react";
import {
  fetchProductionCount,
  removeProduction,
  saveProduction,
  subscribeProductionPage,
  type FinishedUpdate,
  type ProductionQuery,
} from "@/lib/firebase/productionRepository";
import { cloudStatusOf } from "@/lib/cloudStatus";
import type {
  CloudStatus,
  ProductionEvent,
  ProductionPayload,
  StockFilament,
  Supply,
} from "../types";

const PAGE_SIZE = 25;

// TD-006: versão PAGINADA + FILTRADA do `useProduction` para a lista da
// /producao. Assina só a janela recente por `at` OU o conjunto (limitado) de um
// produto selecionado; `totalCount` (aggregation, ou contagem local no caminho de
// produto) alimenta o "X de N". As mutações (gravar/excluir) são write one-shot —
// não assinam nada — então moram aqui também. O ROI (/maquinas) segue no
// `useProduction` cheio; o estorno resolve os eventos por id.
export function useProductionPage(filter: ProductionQuery) {
  const { productId, start, end } = filter;
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  // Filtro novo recomeça a janela do topo (ajuste no render, não em effect).
  const filterKey = `${productId ?? ""}|${start ?? ""}|${end ?? ""}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (filterKey !== prevKey) {
    setPrevKey(filterKey);
    setPageLimit(PAGE_SIZE);
  }

  useEffect(() => {
    let cancelled = false;
    const activeFilter: ProductionQuery = { productId, start, end };
    const unsubscribe = subscribeProductionPage(
      activeFilter,
      pageLimit,
      (nextEvents, more, origin) => {
        setEvents(nextEvents);
        setHasMore(more);
        // AUD-15 [E4]: "chegou" não é "veio do servidor" — ver `cloudStatusOf`.
        setStatus(cloudStatusOf(origin));
        setError(null);
        if (productId) {
          setTotalCount(nextEvents.length);
        } else if (!origin.hasPendingWrites) {
          // Mesma espera do `useSalesPage` (TD-019), que aqui só passou a ser
          // possível com o [E4]: a contagem vem de uma aggregation query no
          // SERVIDOR, e disparada no snapshot otimista ela volta o número de
          // ANTES da gravação. Sem `includeMetadataChanges` o segundo snapshot
          // (o confirmado) nunca chegava, então o "X de N" ficava com o N velho
          // até a próxima mudança de dado — agora ele chega, e a contagem é
          // refeita já com o evento dentro.
          fetchProductionCount(activeFilter)
            .then((next) => {
              if (!cancelled) setTotalCount(next);
            })
            .catch(() => {});
        }
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
  }, [productId, start, end, pageLimit]);

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
    eventIds: string[],
    colorUpdates: StockFilament[],
    finished?: FinishedUpdate | null,
    supplyUpdates: Supply[] = [],
  ) {
    await removeProduction(eventIds, colorUpdates, finished, supplyUpdates);
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
