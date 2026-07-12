"use client";

import { useEffect, useState } from "react";
import { removeSale, subscribeSales } from "@/lib/firebase/salesRepository";
import type { CloudStatus, Sale } from "../types";

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSales(
      (nextSales) => {
        setSales(nextSales);
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

  async function deleteSale(saleId: string) {
    await removeSale(saleId);
  }

  return { sales, status, error, deleteSale };
}
