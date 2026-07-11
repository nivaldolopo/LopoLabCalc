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
  PaymentMethod,
  Sale,
  SaleChannel,
  SalePayload,
} from "@/features/pricing-calculator/types";

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

function num(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function toSale(id: string, data: DocumentData): Sale {
  const breakdown = data.costBreakdown ?? {};
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
    productName: data.productName ?? "",
    machineId: data.machineId ?? "",
    machineName: data.machineName ?? "",
    printHours: num(data.printHours),
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

export async function createSale(payload: SalePayload): Promise<void> {
  await addDoc(salesCollection, payload);
}

export async function updateSale(
  saleId: string,
  patch: Partial<SalePayload>,
): Promise<void> {
  await updateDoc(doc(db, "vendas", saleId), { ...patch });
}

export async function removeSale(saleId: string): Promise<void> {
  await deleteDoc(doc(db, "vendas", saleId));
}
