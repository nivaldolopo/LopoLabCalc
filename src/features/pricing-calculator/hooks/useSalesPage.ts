"use client";

import { useEffect, useState } from "react";
import {
  fetchSalesTotals,
  subscribeSalesPage,
  type SalesTotals,
} from "@/lib/firebase/salesRepository";
import type { CloudStatus, Sale } from "../types";

const PAGE_SIZE = 25;

const EMPTY_TOTALS: SalesTotals = {
  count: 0,
  revenue: 0,
  cost: 0,
  fee: 0,
  profit: 0,
};

// TD-006: versão PAGINADA do `useSales` para a lista da /vendas. Assina só a
// janela mais recente (limite crescente via "carregar mais") em vez da coleção
// inteira. Os totais dos cards vêm de uma aggregation query do histórico INTEIRO
// (não da janela) — re-buscada a cada snapshot da janela, o que cobre venda
// nova/excluída/editada visível. O ROI (/maquinas) segue no `useSales` cheio.
export function useSalesPage() {
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  const [sales, setSales] = useState<Sale[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totals, setTotals] = useState<SalesTotals>(EMPTY_TOTALS);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeSalesPage(
      pageLimit,
      (nextSales, more) => {
        setSales(nextSales);
        setHasMore(more);
        setStatus("synced");
        setError(null);
        fetchSalesTotals()
          .then((next) => {
            if (!cancelled) setTotals(next);
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

  return { sales, totals, hasMore, loadMore, status, error };
}
