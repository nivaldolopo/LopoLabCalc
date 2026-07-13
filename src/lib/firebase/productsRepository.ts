import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import type {
  ProductPayload,
  SavedProduct,
} from "@/features/pricing-calculator/types";
import { DEFAULT_FAILURE_RATE } from "@/features/pricing-calculator/constants";

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
    failureRate:
      data.failureRate !== undefined && data.failureRate !== null
        ? Number(data.failureRate)
        : DEFAULT_FAILURE_RATE,
    includeFixed:
      data.includeFixed !== undefined && data.includeFixed !== null
        ? Boolean(data.includeFixed)
        : Number(data.fixedCostPerHour) > 0,
    markupOnFixed: Boolean(data.markupOnFixed),
    roundingMode: data.roundingMode ?? "exact",
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

// Cria vários produtos de uma vez (importação de CSV). Cada lote de até 500 é
// atômico (teto de um writeBatch do Firestore). ATENÇÃO: acima de 500 são vários
// commits SEQUENCIAIS — não há transação única cross-lote no cliente Firestore.
// Logo, se um lote falhar no meio, os anteriores JÁ foram gravados. Em vez de
// deixar esse estado parcial em silêncio (TD-009/TD-007), o erro informa quantos
// já entraram, para o usuário reimportar só o restante.
const BATCH_LIMIT = 500;

export async function createProductsBatch(
  payloads: ProductPayload[],
): Promise<void> {
  let imported = 0;
  for (let start = 0; start < payloads.length; start += BATCH_LIMIT) {
    const chunk = payloads.slice(start, start + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const payload of chunk) {
      batch.set(doc(productsCollection), payload);
    }
    try {
      await batch.commit();
      imported += chunk.length;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      // Só há o que reportar quando parte já foi gravada (>1 lote). No caso
      // comum (≤500, atômico) nada entrou, então repassa o erro cru.
      if (imported === 0) throw error;
      throw new Error(
        `Importados ${imported} de ${payloads.length} produtos antes de ` +
          `falhar (${reason}). Os já importados foram mantidos — reimporte ` +
          `apenas os ${payloads.length - imported} restantes.`,
      );
    }
  }
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
