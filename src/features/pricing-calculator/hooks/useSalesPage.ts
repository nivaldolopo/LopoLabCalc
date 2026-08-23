"use client";

import { useEffect, useState } from "react";
import {
  fetchSalesTotals,
  subscribeSalesPage,
  totalsOfSales,
  type SalesQuery,
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

// TD-006: versão PAGINADA + FILTRADA do `useSales` para a lista da /vendas.
// Assina só a janela recente (limite crescente via "carregar mais") OU, quando um
// produto está selecionado, o conjunto (limitado) daquele produto. Os totais dos
// cards respeitam o filtro: por período vêm de aggregation query server-side; por
// produto são somados no cliente sobre o conjunto carregado. O ROI (/maquinas)
// segue no `useSales` cheio.
export function useSalesPage(filter: SalesQuery) {
  const { productId, start, end } = filter;
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  const [sales, setSales] = useState<Sale[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totals, setTotals] = useState<SalesTotals>(EMPTY_TOTALS);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  // Filtro novo recomeça a janela do topo. Padrão do React de ajustar estado no
  // render (não em effect) quando uma "chave" derivada muda — evita a cascata de
  // renders de resetar via useEffect.
  const filterKey = `${productId ?? ""}|${start ?? ""}|${end ?? ""}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (filterKey !== prevKey) {
    setPrevKey(filterKey);
    setPageLimit(PAGE_SIZE);
  }

  useEffect(() => {
    let cancelled = false;
    const activeFilter: SalesQuery = { productId, start, end };
    const unsubscribe = subscribeSalesPage(
      activeFilter,
      pageLimit,
      (nextSales, more, pending) => {
        setSales(nextSales);
        setHasMore(more);
        setStatus("synced");
        setError(null);
        if (productId) {
          // Caminho de produto: conjunto inteiro em memória → soma no cliente.
          // Aqui `pending` não atrapalha — o doc otimista já está na lista, e é
          // ele mesmo que queremos somar.
          setTotals(totalsOfSales(nextSales));
        } else if (!pending) {
          // TD-019: os cards vinham de uma aggregation query no SERVIDOR,
          // disparada assim que a latency compensation entregava o doc local —
          // ou seja, antes de o servidor ter a escrita. O total voltava o de
          // antes (medido: gravei a venda, a linha apareceu e o topo continuou
          // 47 / R$2.620,70; recarregando, 48 / R$2.729,60).
          //
          // Esperar o snapshot CONFIRMADO resolve os dois lados: enquanto
          // `pending` é true o total anterior continua na tela (não pisca nem
          // mente), e quando a confirmação chega — que só existe porque a
          // assinatura pede `includeMetadataChanges` — a soma é refeita já com
          // a venda dentro.
          fetchSalesTotals(activeFilter)
            .then((next) => {
              if (!cancelled) setTotals(next);
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

  return { sales, totals, hasMore, loadMore, status, error };
}
