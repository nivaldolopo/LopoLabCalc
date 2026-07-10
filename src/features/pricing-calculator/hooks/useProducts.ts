"use client";

import { useEffect, useState } from "react";
import {
  createProduct,
  removeProduct,
  saveProduct,
  subscribeProducts,
} from "@/lib/firebase/productsRepository";
import type { CloudStatus, ProductPayload, SavedProduct } from "../types";

export function useProducts() {
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeProducts(
      (nextProducts) => {
        setProducts(nextProducts);
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

  async function addProduct(payload: ProductPayload) {
    await createProduct(payload);
  }

  async function updateProduct(productId: string, payload: ProductPayload) {
    await saveProduct(productId, payload);
  }

  async function deleteProduct(productId: string) {
    await removeProduct(productId);
  }

  async function importProducts(payloads: ProductPayload[]) {
    setStatus("importing");
    for (const payload of payloads) {
      await createProduct(payload);
    }
    setStatus("synced");
  }

  return {
    products,
    status,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    importProducts,
  };
}
