import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import { finishedGoodToDocument } from "./finishedGoodsRepository";
import { productionToDocument } from "./productionRepository";
import { serializeRolls } from "./stockRepository";
import type {
  FinishedGoodPayload,
  FinishedMove,
  PaymentMethod,
  ProductionPayload,
  ReciboUpsert,
  Sale,
  SaleChannel,
  StockFilament,
} from "@/features/pricing-calculator/types";
import { num } from "@/lib/number";

const salesCollection = collection(db, "vendas");

const PAYMENT_VALUES: PaymentMethod[] = [
  "dinheiro",
  "pix",
  "debito",
  "credito",
  "outro",
];
const CHANNEL_VALUES: SaleChannel[] = [
  "quiosque",
  "online",
  "encomenda",
  "outro",
];

function toFinishedMove(data: DocumentData): FinishedMove {
  return {
    productId: String(data.productId ?? ""),
    ...(data.subitemId ? { subitemId: String(data.subitemId) } : {}),
    layerId: String(data.layerId ?? ""),
    qty: num(data.qty),
    unitCost: num(data.unitCost),
    cost: num(data.cost),
  };
}

function toSale(id: string, data: DocumentData): Sale {
  const breakdown = data.costBreakdown ?? {};
  // Repartição por máquina (vendas novas). Ausente nas antigas → deixa undefined
  // e o ROI cai no fallback (tudo na máquina principal). Filtra entradas inválidas.
  const machineUsage = Array.isArray(data.machineUsage)
    ? data.machineUsage
        .filter((usage: DocumentData) => usage && usage.machineId)
        .map((usage: DocumentData) => ({
          machineId: String(usage.machineId),
          machineName: usage.machineName ?? "",
          hours: num(usage.hours),
          depreciation: num(usage.depreciation),
        }))
    : undefined;
  return {
    id,
    reciboId: data.reciboId ?? id,
    saleDate: num(data.saleDate) || num(data.createdAt),
    customer: data.customer ?? "",
    material: data.material ?? "",
    paymentMethod: PAYMENT_VALUES.includes(data.paymentMethod)
      ? data.paymentMethod
      : "outro",
    channel: CHANNEL_VALUES.includes(data.channel) ? data.channel : "outro",
    notes: data.notes ?? "",
    status: "concluida",
    productId: data.productId ?? "",
    // FEAT-01: subitem vendido (só em vendas de parte; ausente nas de inteiro).
    ...(data.subitemId ? { subitemId: String(data.subitemId) } : {}),
    productName: data.productName ?? "",
    machineId: data.machineId ?? "",
    machineName: data.machineName ?? "",
    printHours: num(data.printHours),
    ...(machineUsage ? { machineUsage } : {}),
    // FEAT-02: consumo por cor congelado (vendas novas). Ausente nas antigas →
    // undefined (tratadas como monocolor pelo costBreakdown.material).
    ...(Array.isArray(data.filaments) && data.filaments.length > 0
      ? { filaments: data.filaments }
      : {}),
    quantity: Math.max(1, num(data.quantity) || 1),
    suggestedPrice: num(data.suggestedPrice),
    salePrice: num(data.salePrice),
    unitCost: num(data.unitCost),
    costBreakdown: {
      material: num(breakdown.material),
      energy: num(breakdown.energy),
      depreciation: num(breakdown.depreciation),
      maintenance: num(breakdown.maintenance),
      labor: num(breakdown.labor),
      accessories: num(breakdown.accessories),
      failureReserve: num(breakdown.failureReserve),
      fixed: num(breakdown.fixed),
    },
    totalCost: num(data.totalCost),
    totalRevenue: num(data.totalRevenue),
    // Vendas anteriores ao recurso de taxa não têm estes campos → 0/false, e o
    // `profit` gravado já era receita − custo (sem taxa). Fica consistente.
    feeRate: num(data.feeRate),
    feeAmount: num(data.feeAmount),
    feePassedToCustomer: Boolean(data.feePassedToCustomer),
    profit: num(data.profit),
    margin: num(data.margin),
    // Passo 8 — reconciliação. Ausentes nas vendas anteriores ao recurso (não
    // estornam nada). `origem` decide o caminho; os moves/ids são o rastro do
    // estorno ao editar/excluir.
    ...(data.origem === "acabado" || data.origem === "encomenda"
      ? { origem: data.origem }
      : {}),
    ...(Array.isArray(data.finishedMoves) && data.finishedMoves.length > 0
      ? { finishedMoves: data.finishedMoves.map(toFinishedMove) }
      : {}),
    ...(Array.isArray(data.productionEventIds) &&
    data.productionEventIds.length > 0
      ? { productionEventIds: data.productionEventIds.map(String) }
      : {}),
    createdAt: num(data.createdAt),
  };
}

export function subscribeSales(
  onSales: (sales: Sale[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    salesCollection,
    (snapshot) => {
      onSales(snapshot.docs.map((item) => toSale(item.id, item.data())));
    },
    (error) => onError(error),
  );
}

// Grava um recibo inteiro (cria e/ou edita) numa transação atômica. Cada upsert
// sem `id` vira um doc novo; com `id`, atualiza o doc existente. Os `removedIds`
// são itens que saíram do recibo na edição. Todos os itens de um recibo
// compartilham o mesmo `reciboId` (definido pelo chamador). Ou entra tudo, ou
// nada. Serve tanto para registrar uma venda nova quanto para editar uma já feita.
export async function saveRecibo(
  upserts: ReciboUpsert[],
  removedIds: string[] = [],
): Promise<void> {
  if (upserts.length === 0 && removedIds.length === 0) return;
  const batch = writeBatch(db);
  for (const { id, payload } of upserts) {
    const ref = id ? doc(db, "vendas", id) : doc(salesCollection);
    batch.set(ref, payload);
  }
  for (const id of removedIds) {
    batch.delete(doc(db, "vendas", id));
  }
  await batch.commit();
}

// Serializa um FinishedMove campo a campo (o Firestore rejeita `undefined`, e
// `subitemId` é opcional — a SKU do inteiro não o tem).
function finishedMoveToDocument(move: FinishedMove): DocumentData {
  return {
    productId: move.productId,
    ...(move.subitemId ? { subitemId: move.subitemId } : {}),
    layerId: move.layerId,
    qty: num(move.qty),
    unitCost: num(move.unitCost),
    cost: num(move.cost),
  };
}

// Serializa o doc da venda, tratando os campos do passo 8 (o restante já vem
// limpo do `SaleModal`, como antes). Só grava origem/moves/ids quando existem.
function saleToDocument(payload: ReciboUpsert["payload"]): DocumentData {
  const { finishedMoves, productionEventIds, origem, ...rest } = payload;
  return {
    ...rest,
    ...(origem ? { origem } : {}),
    ...(finishedMoves && finishedMoves.length > 0
      ? { finishedMoves: finishedMoves.map(finishedMoveToDocument) }
      : {}),
    ...(productionEventIds && productionEventIds.length > 0
      ? { productionEventIds }
      : {}),
  };
}

// Tudo que a reconciliação de um recibo grava num ÚNICO `writeBatch` (passo 8):
// vendas (upsert/delete) + producao das encomendas (criar/apagar) + estoque de
// filamento (rolos) + acabados (SKUs). Ou entra tudo, ou nada — a baixa nunca fica
// sem a venda que a explica, nem o contrário. Vem pronto de `reconcileReciboWrite`.
export type ReciboWrite = {
  saleUpserts: ReciboUpsert[];
  saleRemovedIds: string[];
  productionCreates: { id: string; payload: ProductionPayload }[];
  productionDeleteIds: string[];
  colorUpdates: StockFilament[];
  finishedUpdates: FinishedGoodPayload[];
};

export async function reconcileRecibo(write: ReciboWrite): Promise<void> {
  const batch = writeBatch(db);

  for (const { id, payload } of write.saleUpserts) {
    const ref = id ? doc(db, "vendas", id) : doc(salesCollection);
    batch.set(ref, saleToDocument(payload));
  }
  for (const id of write.saleRemovedIds) {
    batch.delete(doc(db, "vendas", id));
  }
  // Encomendas: cria os eventos de produção novos e apaga os do recibo antigo.
  for (const { id, payload } of write.productionCreates) {
    batch.set(doc(db, "producao", id), productionToDocument(payload));
  }
  for (const id of write.productionDeleteIds) {
    batch.delete(doc(db, "producao", id));
  }
  // Estoque de filamento: só o campo `rolls` das cores afetadas.
  for (const color of write.colorUpdates) {
    batch.update(doc(db, "estoque", color.id), {
      rolls: serializeRolls(color.rolls),
    });
  }
  // Acabados: o doc inteiro (id = productId) já com/sem as camadas.
  for (const payload of write.finishedUpdates) {
    batch.set(doc(db, "acabados", payload.productId), finishedGoodToDocument(payload));
  }

  await batch.commit();
}

export async function removeSale(saleId: string): Promise<void> {
  await deleteDoc(doc(db, "vendas", saleId));
}
