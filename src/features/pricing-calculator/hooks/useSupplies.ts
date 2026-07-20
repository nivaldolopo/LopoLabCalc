"use client";

import { useEffect, useState } from "react";
import {
  createSupply,
  removeSupply,
  saveSupply,
  subscribeSupplies,
} from "@/lib/firebase/suppliesRepository";
import type { CloudStatus, Supply, SupplyPayload } from "../types";

// Estoque de insumos em tempo real (um insumo por doc). Molde do `useStock`:
// sem estado otimista — o `onSnapshot` é a única fonte de verdade.
export function useSupplies() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSupplies(
      (nextSupplies) => {
        setSupplies(nextSupplies);
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

  async function addSupply(payload: SupplyPayload) {
    await createSupply(payload);
  }

  async function updateSupply(supplyId: string, payload: SupplyPayload) {
    await saveSupply(supplyId, payload);
  }

  async function deleteSupply(supplyId: string) {
    await removeSupply(supplyId);
  }

  return {
    supplies,
    status,
    error,
    addSupply,
    updateSupply,
    deleteSupply,
  };
}
