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
import type {
  QuoteBusiness,
  QuoteItemSnapshot,
  QuoteRecord,
  QuoteRecordPayload,
} from "@/features/pricing-calculator/types";
import { DEFAULT_QUOTE_BUSINESS } from "@/features/pricing-calculator/constants";
import { num } from "@/lib/number";

const quotesCollection = collection(db, "orcamentos");

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

// Contador atômico da numeração de orçamento. Antes o próximo número era
// derivado no browser (max do histórico + 1): duas abas ou dois cliques rápidos
// geravam o MESMO número. Aqui uma transação reserva o número no servidor antes
// de gerar o PDF, garantindo unicidade sob concorrência.
//
// `historyFloor` = maior `numberValue` já no histórico; semeia o contador na 1ª
// vez (doc ainda inexistente) e serve de piso caso o doc seja apagado. `preferred`
// = número digitado à mão pelo dono (override); quando ausente, usa piso + 1.
// O contador NÃO decresce ao excluir orçamentos (sequência monotônica, correta
// para números reais) — para zerar, apague o doc `config/orcamentoSeq`.
const seqRef = doc(db, "config", "orcamentoSeq");

export async function reserveQuoteNumber(
  historyFloor: number,
  preferred?: number,
): Promise<number> {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(seqRef);
    const stored = snap.exists() ? num(snap.data().last) : 0;
    const last = Math.max(stored, Math.max(0, num(historyFloor)));
    const next = preferred != null && preferred > 0 ? preferred : last + 1;
    tx.set(seqRef, { last: Math.max(last, next) }, { merge: true });
    return next;
  });
}

export async function createQuote(payload: QuoteRecordPayload): Promise<void> {
  await addDoc(quotesCollection, payload);
}

export async function removeQuote(quoteId: string): Promise<void> {
  await deleteDoc(doc(db, "orcamentos", quoteId));
}
