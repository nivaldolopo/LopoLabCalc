import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import type {
  ProductPayload,
  SavedProduct,
} from "@/features/pricing-calculator/types";

const productsCollection = collection(db, "products");

function toSavedProduct(id: string, data: DocumentData): SavedProduct {
  return {
    id,
    name: data.name ?? "",
    mainStageName: data.mainStageName ?? "",
    weightG: Number(data.weightG) || 0,
    printHours: Number(data.printHours) || 0,
    machineId: data.machineId ?? "a1",
    filamentPricePerKg: Number(data.filamentPricePerKg) || 0,
    energyTariff: Number(data.energyTariff) || 0,
    laborMinutes: Number(data.laborMinutes) || 0,
    laborRate: Number(data.laborRate) || 0,
    markup: Number(data.markup) || 3,
    includeFixed:
      data.includeFixed !== undefined && data.includeFixed !== null
        ? Boolean(data.includeFixed)
        : Number(data.fixedCostPerHour) > 0,
    markupOnFixed: Boolean(data.markupOnFixed),
    piecesCount: Math.max(1, Number(data.piecesCount) || 1),
    stages: Array.isArray(data.stages) ? data.stages : [],
    accessories: Array.isArray(data.accessories) ? data.accessories : [],
    linkModel: data.linkModel ?? "",
    linkCompetitor: data.linkCompetitor ?? "",
    linkFile: data.linkFile ?? "",
    fixedCostPerHour: data.fixedCostPerHour ?? null,
    combineEnabled: data.combineEnabled ?? null,
    stage2: data.stage2 ?? null,
    createdAt: Number(data.createdAt) || 0,
  };
}

export function subscribeProducts(
  onProducts: (products: SavedProduct[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    productsCollection,
    (snapshot) => {
      const products = snapshot.docs.map((item) =>
        toSavedProduct(item.id, item.data()),
      );
      onProducts(products);
    },
    (error) => onError(error),
  );
}

export async function createProduct(payload: ProductPayload): Promise<void> {
  await addDoc(productsCollection, payload);
}

export async function saveProduct(
  productId: string,
  payload: ProductPayload,
): Promise<void> {
  await updateDoc(doc(db, "products", productId), { ...payload });
}

export async function removeProduct(productId: string): Promise<void> {
  await deleteDoc(doc(db, "products", productId));
}
