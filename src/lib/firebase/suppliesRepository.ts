import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import { withWriteTimeout } from "@/lib/errors";
import { EstoqueDesatualizadoError } from "./revGuard";
import type {
  Supply,
  SupplyAdjustment,
  SupplyLot,
  SupplyPayload,
} from "@/features/pricing-calculator/types";
import { num } from "@/lib/number";

// Estoque de INSUMOS (7e): um doc por insumo, com os lotes em array dentro —
// mesma forma do `stockRepository` (D2), pelo mesmo motivo (poucos lotes cabem
// no doc e a baixa da produção entra no mesmo `writeBatch`).
//
// Coleção PRÓPRIA, não `estoque`: o `subscribeStock` devolve a coleção inteira
// tipada como cor, e o estorno filtra por `stockId` — insumo no meio das cores
// exigiria um discriminador em toda leitura, para não economizar nada.
const suppliesCollection = collection(db, "insumos");

function toLot(data: DocumentData): SupplyLot {
  return {
    id: String(data.id ?? ""),
    purchaseDate: num(data.purchaseDate),
    initialQty: num(data.initialQty),
    remainingQty: num(data.remainingQty),
    unitPrice: num(data.unitPrice),
    ...(data.note ? { note: String(data.note) } : {}),
  };
}

function toAdjustment(data: DocumentData): SupplyAdjustment {
  return {
    id: String(data.id ?? ""),
    at: num(data.at),
    lotId: String(data.lotId ?? ""),
    before: num(data.before),
    after: num(data.after),
    reason: data.reason ?? "",
  };
}

function toSupply(id: string, data: DocumentData): Supply {
  return {
    id,
    // TD-022: a versão do documento entra na leitura para viajar de carona nos
    // planos (as funções puras fazem `{...color}`) e voltar na gravação, que a
    // confere dentro da transação.
    rev: Number(data.rev) || 0,
    name: data.name ?? "",
    unit: data.unit ?? "un",
    minQty: num(data.minQty),
    archived: Boolean(data.archived),
    lots: Array.isArray(data.lots) ? data.lots.map(toLot) : [],
    adjustments: Array.isArray(data.adjustments)
      ? data.adjustments.map(toAdjustment)
      : [],
    createdAt: num(data.createdAt),
  };
}

// Campo a campo, como no estoque de filamento: `note` é opcional e o Firestore
// REJEITA `undefined` — espalhar o objeto cru quebraria a gravação de um lote
// sem nota fiscal.
function lotToDocument(lot: SupplyLot): DocumentData {
  return {
    id: lot.id,
    purchaseDate: num(lot.purchaseDate),
    initialQty: num(lot.initialQty),
    remainingQty: num(lot.remainingQty),
    unitPrice: num(lot.unitPrice),
    ...(lot.note ? { note: lot.note } : {}),
  };
}

// Serializa os lotes de um insumo. Exportado para a baixa da produção, que
// atualiza só o campo `lots` do doc no mesmo `writeBatch` do evento — mesmo
// papel do `serializeRolls`.
export function serializeLots(lots: SupplyLot[]): DocumentData[] {
  return lots.map(lotToDocument);
}

function adjustmentToDocument(adjustment: SupplyAdjustment): DocumentData {
  return {
    id: adjustment.id,
    at: num(adjustment.at),
    lotId: adjustment.lotId,
    before: num(adjustment.before),
    after: num(adjustment.after),
    reason: adjustment.reason,
  };
}

function toDocument(payload: SupplyPayload): DocumentData {
  return {
    name: payload.name,
    unit: payload.unit,
    minQty: num(payload.minQty),
    archived: Boolean(payload.archived),
    lots: payload.lots.map(lotToDocument),
    adjustments: payload.adjustments.map(adjustmentToDocument),
    createdAt: num(payload.createdAt),
  };
}

export function subscribeSupplies(
  onSupplies: (supplies: Supply[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    suppliesCollection,
    (snapshot) => {
      onSupplies(snapshot.docs.map((item) => toSupply(item.id, item.data())));
    },
    (error) => onError(error),
  );
}

export async function createSupply(payload: SupplyPayload): Promise<void> {
  await withWriteTimeout(
    addDoc(suppliesCollection, { ...toDocument(payload), rev: 1 }),
  );
}

// TD-022: idêntico ao `saveStockFilament` — ver a nota lá. Todo escritor do doc
// incrementa o contador, senão o guarda da venda não guarda nada.
export async function saveSupply(
  supplyId: string,
  payload: SupplyPayload,
): Promise<void> {
  const ref = doc(db, "insumos", supplyId);
  const esperado = payload.rev ?? 0;
  const gravacao = runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new EstoqueDesatualizadoError(`O insumo "${payload.name}"`);
    }
    const atual = Number(snap.data().rev) || 0;
    if (atual !== esperado) {
      throw new EstoqueDesatualizadoError(`O insumo "${payload.name}"`);
    }
    tx.update(ref, { ...toDocument(payload), rev: atual + 1 });
  });
  await withWriteTimeout(gravacao);
}

export async function removeSupply(supplyId: string): Promise<void> {
  await withWriteTimeout(deleteDoc(doc(db, "insumos", supplyId)));
}
