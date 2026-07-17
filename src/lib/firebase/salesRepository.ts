import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import type {
  PaymentMethod,
  ReciboUpsert,
  Sale,
  SaleChannel,
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

export async function removeSale(saleId: string): Promise<void> {
  await deleteDoc(doc(db, "vendas", saleId));
}
