import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import { frozenFromDocument, frozenToDocument } from "./frozenCost";
import type {
  FinishedGood,
  FinishedGoodPayload,
  FinishedLayer,
  FinishedSku,
} from "@/features/pricing-calculator/types";
import { num } from "@/lib/number";

// Estoque de Produtos / acabados (FEAT-05): um doc por PRODUTO, id do doc =
// productId (DETERMINÍSTICO — a baixa da produção acha o doc sem query e grava no
// MESMO `writeBatch` do evento, 05b). As SKUs (subitens) e suas camadas FIFO ficam
// dentro do doc; são poucas por produto, então cabem e a escrita continua atômica
// — o que importa quando o incremento entra junto do evento de produção.
const finishedCollection = collection(db, "acabados");

function toLayer(data: DocumentData): FinishedLayer {
  return {
    id: String(data.id ?? ""),
    at: num(data.at),
    qty: num(data.qty),
    unitCost: num(data.unitCost),
    ...(data.costBreakdown
      ? { costBreakdown: frozenFromDocument(data.costBreakdown) }
      : {}),
    sourceEventId: String(data.sourceEventId ?? ""),
  };
}

function toSku(data: DocumentData): FinishedSku {
  return {
    ...(data.subitemId ? { subitemId: String(data.subitemId) } : {}),
    name: data.name ?? "",
    layers: Array.isArray(data.layers) ? data.layers.map(toLayer) : [],
  };
}

function toFinishedGood(id: string, data: DocumentData): FinishedGood {
  return {
    id,
    productId: data.productId ?? id,
    productName: data.productName ?? "",
    skus: Array.isArray(data.skus) ? data.skus.map(toSku) : [],
    createdAt: num(data.createdAt),
  };
}

// Serializa campo a campo (o Firestore rejeita `undefined`, e `subitemId` é
// opcional — a SKU do inteiro não o tem). Mesma disciplina do `rollToDocument`.
function layerToDocument(layer: FinishedLayer): DocumentData {
  return {
    id: layer.id,
    at: num(layer.at),
    qty: num(layer.qty),
    unitCost: num(layer.unitCost),
    // FEAT-06: a composição do `unitCost`. Camada anterior não tem — spread
    // condicional (o Firestore rejeita `undefined`).
    ...(layer.costBreakdown
      ? { costBreakdown: frozenToDocument(layer.costBreakdown) }
      : {}),
    sourceEventId: layer.sourceEventId,
  };
}

function skuToDocument(sku: FinishedSku): DocumentData {
  return {
    ...(sku.subitemId ? { subitemId: sku.subitemId } : {}),
    name: sku.name ?? "",
    layers: sku.layers.map(layerToDocument),
  };
}

// Serializa o array de SKUs. Exportado para a baixa da produção (FEAT-05b): ela
// grava o doc do acabado no mesmo `writeBatch` do evento e reusa esta serialização
// para não divergir da escrita normal (molde do `serializeRolls`).
export function serializeSkus(skus: FinishedSku[]): DocumentData[] {
  return skus.map(skuToDocument);
}

export function finishedGoodToDocument(
  payload: FinishedGoodPayload,
): DocumentData {
  return {
    productId: payload.productId,
    productName: payload.productName ?? "",
    skus: serializeSkus(payload.skus),
    createdAt: num(payload.createdAt),
  };
}

export function subscribeFinishedGoods(
  onData: (goods: FinishedGood[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    finishedCollection,
    (snapshot) => {
      onData(snapshot.docs.map((item) => toFinishedGood(item.id, item.data())));
    },
    (error) => onError(error),
  );
}

// Grava (cria/atualiza) o doc de um produto. Id do doc = productId (setDoc, não
// addDoc). Usado avulso; a baixa atômica junto do evento vem no repo da produção
// (05b), reusando `serializeSkus`.
export async function saveFinishedGood(
  payload: FinishedGoodPayload,
): Promise<void> {
  await setDoc(
    doc(finishedCollection, payload.productId),
    finishedGoodToDocument(payload),
  );
}

export async function removeFinishedGood(productId: string): Promise<void> {
  await deleteDoc(doc(db, "acabados", productId));
}
