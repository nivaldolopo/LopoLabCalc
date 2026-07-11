"use client";

import { useEffect, useState } from "react";
import {
  createSale,
  removeSale,
  subscribeSales,
  updateSale,
} from "@/lib/firebase/salesRepository";
import type { CloudStatus, Sale, SalePayload } from "../types";

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

  async function addSale(payload: SalePayload) {
    await createSale(payload);
  }

  async function editSale(saleId: string, patch: Partial<SalePayload>) {
    await updateSale(saleId, patch);
  }

  async function deleteSale(saleId: string) {
    await removeSale(saleId);
  }

  return { sales, status, error, addSale, editSale, deleteSale };
}
