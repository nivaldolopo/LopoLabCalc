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
import { EstoqueDesatualizadoError } from "./revGuard";
import type {
  FilamentRoll,
  StockAdjustment,
  StockFilament,
  StockFilamentPayload,
} from "@/features/pricing-calculator/types";
import { num } from "@/lib/number";

// Estoque de filamento (item 3): um doc por COR, com os rolos em array dentro
// (D2). São poucos rolos por cor, então cabem no doc e a escrita continua
// atômica — o que importa quando a baixa da venda (passo 8) entrar no mesmo
// `writeBatch` do recibo.
const stockCollection = collection(db, "estoque");

function toRoll(data: DocumentData): FilamentRoll {
  return {
    id: String(data.id ?? ""),
    purchaseDate: num(data.purchaseDate),
    initialG: num(data.initialG),
    remainingG: num(data.remainingG),
    pricePerKg: num(data.pricePerKg),
    ...(data.note ? { note: String(data.note) } : {}),
  };
}

function toAdjustment(data: DocumentData): StockAdjustment {
  return {
    id: String(data.id ?? ""),
    at: num(data.at),
    rollId: String(data.rollId ?? ""),
    beforeG: num(data.beforeG),
    afterG: num(data.afterG),
    reason: data.reason ?? "",
  };
}

// Exportada para o teste do TD-026 (ver `toFinishedGood`): a produção repetida
// só se reproduz relendo a cor do banco entre uma gravação e a seguinte.
export function toStockFilament(id: string, data: DocumentData): StockFilament {
  return {
    id,
    // TD-022: a versão do documento entra na leitura para viajar de carona nos
    // planos (as funções puras fazem `{...color}`) e voltar na gravação, que a
    // confere dentro da transação.
    rev: Number(data.rev) || 0,
    material: data.material ?? "",
    brand: data.brand ?? "",
    colorName: data.colorName ?? "",
    ...(data.colorHex ? { colorHex: String(data.colorHex) } : {}),
    minG: num(data.minG),
    archived: Boolean(data.archived),
    rolls: Array.isArray(data.rolls) ? data.rolls.map(toRoll) : [],
    adjustments: Array.isArray(data.adjustments)
      ? data.adjustments.map(toAdjustment)
      : [],
    createdAt: num(data.createdAt),
  };
}

// Monta o documento campo a campo (mesma disciplina do `persistMachines`). Não é
// zelo à toa: `colorHex` e `note` são opcionais e o Firestore REJEITA `undefined`
// — espalhar o objeto cru quebraria a gravação de uma cor sem hex.
function rollToDocument(roll: FilamentRoll): DocumentData {
  return {
    id: roll.id,
    purchaseDate: num(roll.purchaseDate),
    initialG: num(roll.initialG),
    remainingG: num(roll.remainingG),
    pricePerKg: num(roll.pricePerKg),
    ...(roll.note ? { note: roll.note } : {}),
  };
}

// Serializa o array de rolos de uma cor. Exportado para a baixa da produção
// (FEAT-04): ela atualiza só o campo `rolls` do doc da cor no mesmo `writeBatch`
// do evento, e reusa esta serialização para não divergir da escrita normal.
export function serializeRolls(rolls: FilamentRoll[]): DocumentData[] {
  return rolls.map(rollToDocument);
}

function adjustmentToDocument(adjustment: StockAdjustment): DocumentData {
  return {
    id: adjustment.id,
    at: num(adjustment.at),
    rollId: adjustment.rollId,
    beforeG: num(adjustment.beforeG),
    afterG: num(adjustment.afterG),
    reason: adjustment.reason,
  };
}

function toDocument(payload: StockFilamentPayload): DocumentData {
  return {
    material: payload.material,
    brand: payload.brand,
    colorName: payload.colorName,
    ...(payload.colorHex ? { colorHex: payload.colorHex } : {}),
    minG: num(payload.minG),
    archived: Boolean(payload.archived),
    rolls: payload.rolls.map(rollToDocument),
    adjustments: payload.adjustments.map(adjustmentToDocument),
    createdAt: num(payload.createdAt),
  };
}

export function subscribeStock(
  onStock: (filaments: StockFilament[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    stockCollection,
    (snapshot) => {
      onStock(
        snapshot.docs.map((item) => toStockFilament(item.id, item.data())),
      );
    },
    (error) => onError(error),
  );
}

export async function createStockFilament(
  payload: StockFilamentPayload,
): Promise<void> {
  await addDoc(stockCollection, { ...toDocument(payload), rev: 1 });
}

// TD-022: a edição manual da cor (novo rolo, ajuste D6, arquivar, renomear)
// grava o doc INTEIRO, e por isso participa do mesmo contador que a venda e a
// produção conferem. Duas razões, e as duas importam:
// · duas abas mexendo na mesma cor não se apagam mais;
// · e — o que faz o guarda da venda VALER — nenhuma escrita passa sem
//   incrementar. Se esta tela gravasse sem mexer no `rev`, um plano de venda
//   calculado sobre o saldo velho atravessaria a conferência intacto.
export async function saveStockFilament(
  filamentId: string,
  payload: StockFilamentPayload,
): Promise<void> {
  const ref = doc(db, "estoque", filamentId);
  const esperado = payload.rev ?? 0;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new EstoqueDesatualizadoError(`A cor "${payload.colorName}"`);
    }
    const atual = Number(snap.data().rev) || 0;
    if (atual !== esperado) {
      throw new EstoqueDesatualizadoError(`A cor "${payload.colorName}"`);
    }
    tx.update(ref, { ...toDocument(payload), rev: atual + 1 });
  });
}

export async function removeStockFilament(filamentId: string): Promise<void> {
  await deleteDoc(doc(db, "estoque", filamentId));
}
