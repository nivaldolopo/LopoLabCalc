import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import { serializeRolls } from "./stockRepository";
import type {
  FilamentUsage,
  ProductionEvent,
  ProductionMode,
  ProductionOutcome,
  ProductionPayload,
  StockFilament,
  StockMove,
} from "@/features/pricing-calculator/types";
import { num } from "@/lib/number";

// Registro de Produção (FEAT-04): a coleção `producao` é a fonte da verdade do
// consumo de filamento + hora. A baixa entra no MESMO `writeBatch` do evento
// (atômica com ele), atualizando o campo `rolls` dos docs de `estoque` afetados
// — exatamente como o passo 8 fará na venda. Um evento por doc.
const productionCollection = collection(db, "producao");

const OUTCOME_VALUES: ProductionOutcome[] = [
  "estoque",
  "encomenda",
  "teste",
  "falha",
  "brinde",
  "historico",
];
const MODE_VALUES: ProductionMode[] = ["real", "historico"];

// Serializa uma cor congelada campo a campo (o Firestore rejeita `undefined`, e
// material/brand são congelados aqui — D7). Espelha `stripFilamentIds`, mas
// MANTÉM material/brand (a venda os congela só no passo 8; a produção já aqui).
function usageToDocument(f: FilamentUsage): DocumentData {
  return {
    filamentId: f.filamentId ?? null,
    colorName: f.colorName ?? "",
    pricePerKg: num(f.pricePerKg),
    totalG: num(f.totalG),
    ...(f.modelG !== undefined ? { modelG: num(f.modelG) } : {}),
    ...(f.supportG !== undefined ? { supportG: num(f.supportG) } : {}),
    ...(f.purgedG !== undefined ? { purgedG: num(f.purgedG) } : {}),
    ...(f.towerG !== undefined ? { towerG: num(f.towerG) } : {}),
    ...(f.material ? { material: f.material } : {}),
    ...(f.brand ? { brand: f.brand } : {}),
  };
}

function usageFromDocument(data: DocumentData): FilamentUsage {
  return {
    filamentId: data.filamentId ?? null,
    colorName: data.colorName ?? "",
    pricePerKg: num(data.pricePerKg),
    totalG: num(data.totalG),
    ...(data.modelG !== undefined ? { modelG: num(data.modelG) } : {}),
    ...(data.supportG !== undefined ? { supportG: num(data.supportG) } : {}),
    ...(data.purgedG !== undefined ? { purgedG: num(data.purgedG) } : {}),
    ...(data.towerG !== undefined ? { towerG: num(data.towerG) } : {}),
    ...(data.material ? { material: String(data.material) } : {}),
    ...(data.brand ? { brand: String(data.brand) } : {}),
  };
}

function moveToDocument(move: StockMove): DocumentData {
  return {
    itemId: move.itemId,
    kind: move.kind,
    stockId: move.stockId,
    rollId: move.rollId,
    qty: num(move.qty),
  };
}

function moveFromDocument(data: DocumentData): StockMove {
  return {
    itemId: String(data.itemId ?? ""),
    kind: data.kind === "supply" ? "supply" : "filament",
    stockId: String(data.stockId ?? ""),
    rollId: String(data.rollId ?? ""),
    qty: num(data.qty),
  };
}

function toDocument(payload: ProductionPayload): DocumentData {
  return {
    at: num(payload.at),
    outcome: payload.outcome,
    mode: payload.mode,
    ...(payload.productId ? { productId: payload.productId } : {}),
    ...(payload.subitemId ? { subitemId: payload.subitemId } : {}),
    productName: payload.productName ?? "",
    machineId: payload.machineId ?? "",
    machineName: payload.machineName ?? "",
    printHours: num(payload.printHours),
    filaments: payload.filaments.map(usageToDocument),
    frozenCost: num(payload.frozenCost),
    stockMoves: payload.stockMoves.map(moveToDocument),
    ...(payload.notes ? { notes: payload.notes } : {}),
    createdAt: num(payload.createdAt),
  };
}

function toProduction(id: string, data: DocumentData): ProductionEvent {
  return {
    id,
    at: num(data.at) || num(data.createdAt),
    outcome: OUTCOME_VALUES.includes(data.outcome) ? data.outcome : "historico",
    mode: MODE_VALUES.includes(data.mode) ? data.mode : "historico",
    ...(data.productId ? { productId: String(data.productId) } : {}),
    ...(data.subitemId ? { subitemId: String(data.subitemId) } : {}),
    productName: data.productName ?? "",
    machineId: data.machineId ?? "",
    machineName: data.machineName ?? "",
    printHours: num(data.printHours),
    filaments: Array.isArray(data.filaments)
      ? data.filaments.map(usageFromDocument)
      : [],
    frozenCost: num(data.frozenCost),
    stockMoves: Array.isArray(data.stockMoves)
      ? data.stockMoves.map(moveFromDocument)
      : [],
    ...(data.notes ? { notes: String(data.notes) } : {}),
    createdAt: num(data.createdAt),
  };
}

// Id de um evento GERADO ANTES de gravar. A baixa (`planProduction`) precisa do
// id do evento para gravar `stockMoves.itemId` — e é de lá que o estorno (04c)
// lê. Sem pré-gerar, o auto-id do doc não bateria com o `itemId`.
export function newProductionId(): string {
  return doc(productionCollection).id;
}

export function subscribeProduction(
  onProduction: (events: ProductionEvent[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    productionCollection,
    (snapshot) => {
      onProduction(
        snapshot.docs.map((item) => toProduction(item.id, item.data())),
      );
    },
    (error) => onError(error),
  );
}

// Grava N eventos de produção e dá baixa dos rolos ATOMICAMENTE (ou entra tudo,
// ou nada — a baixa nunca fica sem os eventos que a explicam, nem o contrário).
// Os ids são PRÉ-GERADOS (`newProductionId`) para que `payload.stockMoves.itemId`
// bata com o doc. A lista tem mais de 1 evento quando um produto inteiro roda em
// máquinas diferentes (um evento por máquina, baixa encadeada — ver 04b).
// `colorUpdates` é o estado FINAL das cores afetadas (já decrementado por todos
// os eventos); no modo historico é `[]`. Só o campo `rolls` da cor é reescrito.
export async function saveProduction(
  events: { id: string; payload: ProductionPayload }[],
  colorUpdates: StockFilament[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const { id, payload } of events) {
    batch.set(doc(productionCollection, id), toDocument(payload));
  }
  for (const color of colorUpdates) {
    batch.update(doc(db, "estoque", color.id), {
      rolls: serializeRolls(color.rolls),
    });
  }
  await batch.commit();
}

// Exclui um evento e estorna a baixa no mesmo batch. `colorUpdates` vem de
// `reverseProduction` (cores com os rolos restaurados). Evento historico tem
// `colorUpdates` vazio → só apaga o doc.
export async function removeProduction(
  eventId: string,
  colorUpdates: StockFilament[] = [],
): Promise<void> {
  if (colorUpdates.length === 0) {
    await deleteDoc(doc(db, "producao", eventId));
    return;
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, "producao", eventId));
  for (const color of colorUpdates) {
    batch.update(doc(db, "estoque", color.id), {
      rolls: serializeRolls(color.rolls),
    });
  }
  await batch.commit();
}
