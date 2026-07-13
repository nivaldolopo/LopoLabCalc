import {
  doc,
  onSnapshot,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import type { FixedCostRate } from "@/features/pricing-calculator/types";

// Configurações do negócio compartilhadas entre aparelhos (mesmo padrão de
// config/machines e config/orcamento). Hoje guarda só a TAXA de custo fixo
// (aluguel/outros/máquinas/horas/dias) — TD-001. Os toggles enabled/markupOnFixed
// NÃO entram aqui: são por-produto. Doc pensado para crescer (ex.: o Estoque
// adiciona campos aqui sem migração).
const businessDoc = doc(db, "config", "negocio");

function toFixedCostRate(data: DocumentData): FixedCostRate {
  const fc = data.fixedCosts ?? {};
  return {
    rent: Number(fc.rent) || 0,
    other: Number(fc.other) || 0,
    machines: Math.max(1, Number(fc.machines) || 1),
    hoursDay: Number(fc.hoursDay) || 0,
    daysMonth: Number(fc.daysMonth) || 0,
  };
}

/**
 * Escuta a taxa de custo fixo em tempo real. Chama `onRate(null)` quando o
 * documento ainda não existe (primeiro uso), para o chamador semear.
 */
export function subscribeFixedCostRate(
  onRate: (rate: FixedCostRate | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    businessDoc,
    (snapshot) => {
      onRate(snapshot.exists() ? toFixedCostRate(snapshot.data()) : null);
    },
    (error) => onError(error),
  );
}

export async function persistFixedCostRate(rate: FixedCostRate): Promise<void> {
  await setDoc(businessDoc, { fixedCosts: rate }, { merge: true });
}
