import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import type {
  QuoteBusiness,
  QuoteItemSnapshot,
  QuoteRecord,
  QuoteRecordPayload,
} from "@/features/pricing-calculator/types";
import { DEFAULT_QUOTE_BUSINESS } from "@/features/pricing-calculator/constants";

const quotesCollection = collection(db, "orcamentos");

function num(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function toBusiness(data: DocumentData | undefined): QuoteBusiness {
  const business = data ?? {};
  return {
    name: business.name ?? DEFAULT_QUOTE_BUSINESS.name,
    phone: business.phone ?? "",
    email: business.email ?? business.contact ?? "",
    instagram: business.instagram ?? "",
  };
}

function toItems(value: unknown): QuoteItemSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    description: item?.description ?? "",
    quantity: Math.max(1, num(item?.quantity) || 1),
    unitPrice: Math.max(0, num(item?.unitPrice)),
  }));
}

function toQuoteRecord(id: string, data: DocumentData): QuoteRecord {
  return {
    id,
    number: data.number ?? "",
    numberValue: num(data.numberValue),
    customer: data.customer ?? "",
    date: num(data.date) || num(data.createdAt),
    validityDays: Math.max(1, num(data.validityDays) || 1),
    items: toItems(data.items),
    notes: data.notes ?? "",
    business: toBusiness(data.business),
    total: num(data.total),
    createdAt: num(data.createdAt),
  };
}

export function subscribeQuotes(
  onQuotes: (quotes: QuoteRecord[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    quotesCollection,
    (snapshot) => {
      onQuotes(snapshot.docs.map((item) => toQuoteRecord(item.id, item.data())));
    },
    (error) => onError(error),
  );
}

export async function createQuote(payload: QuoteRecordPayload): Promise<void> {
  await addDoc(quotesCollection, payload);
}

export async function removeQuote(quoteId: string): Promise<void> {
  await deleteDoc(doc(db, "orcamentos", quoteId));
}
