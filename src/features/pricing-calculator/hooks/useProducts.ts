"use client";

import { useEffect, useState } from "react";
import {
  createProduct,
  createProductsBatch,
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

  // Repassa o id do produto criado (UX-11: salvar e já vender/produzir/orçar).
  async function addProduct(payload: ProductPayload): Promise<string> {
    return createProduct(payload);
  }

  // TD-022: devolve a versão NOVA do documento. Quem continua editando o mesmo
  // produto depois de salvar (UX-11) precisa guardá-la, senão o próximo save
  // bate contra a versão que ele mesmo acabou de gravar.
  async function updateProduct(
    productId: string,
    payload: ProductPayload,
    expectedRev: number,
  ): Promise<number> {
    return saveProduct(productId, payload, expectedRev);
  }

  async function deleteProduct(productId: string) {
    await removeProduct(productId);
  }

  async function importProducts(payloads: ProductPayload[]) {
    setStatus("importing");
    // Atômico e em um só round-trip (por lote de 500), em vez de N gravações
    // sequenciais. O onSnapshot atualiza a lista e devolve o status a "synced".
    await createProductsBatch(payloads);
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
