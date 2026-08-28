"use client";

import { useEffect, useState } from "react";
import { subscribeSales } from "@/lib/firebase/salesRepository";
import { cloudStatusOf } from "@/lib/cloudStatus";
import type { CloudStatus, Sale } from "../types";

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSales(
      (nextSales, origin) => {
        setSales(nextSales);
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

  // AUD-14 [D7] — o `deleteSale` daqui saiu junto com o `removeSale` do
  // repositório: nenhum componente o destruturava, e apagar a venda sozinha
  // deixaria filamento, insumo e acabado debitados sem a venda que os explica.
  // Quem exclui recibo é o `reconcileRecibo` (via `SaleFlow`), que estorna tudo
  // na mesma transação.
  return { sales, status, error };
}
