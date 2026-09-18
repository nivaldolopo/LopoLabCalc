import {
  doc,
  onSnapshot,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import { withWriteTimeout } from "@/lib/errors";
import type { FixedCostRate } from "@/features/pricing-calculator/types";

// Configurações do negócio compartilhadas entre aparelhos (mesmo padrão de
// config/machines e config/orcamento). Guarda a TAXA de custo fixo
// (aluguel/outros/máquinas/horas/dias) — TD-001 — e, desde a frente 2
// (2026-09-17), a tarifa de energia GLOBAL (`energyTariff`, R$/kWh) — era
// por produto, virou alavanca do `config/negocio` pelo mesmo motivo do custo
// fixo. O toggle `enabled` do custo fixo NÃO entra aqui: é por-produto. Doc
// pensado para crescer sem migração.
const businessDoc = doc(db, "config", "negocio");

export type BusinessSettings = {
  fixedCostRate: FixedCostRate;
  energyTariff: number;
};

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
 * Escuta o negócio (taxa de custo fixo + tarifa de energia) em tempo real.
 * Chama `onSettings(null)` quando o documento ainda não existe (primeiro uso),
 * para o chamador semear.
 *
 * ⚠ `energyTariff` chega `null` quando o doc já existe mas ainda não tem o
 * campo (doc antigo, de antes da frente 2) — o chamador semeia só o que falta,
 * sem sobrescrever a taxa de custo fixo já em vigor.
 */
export function subscribeBusinessSettings(
  onSettings: (settings: { fixedCostRate: FixedCostRate; energyTariff: number | null } | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    businessDoc,
    (snapshot) => {
      if (!snapshot.exists()) {
        onSettings(null);
        return;
      }
      const data = snapshot.data();
      onSettings({
        fixedCostRate: toFixedCostRate(data),
        energyTariff:
          data.energyTariff === undefined || data.energyTariff === null
            ? null
            : Number(data.energyTariff) || 0,
      });
    },
    (error) => onError(error),
  );
}

export async function persistFixedCostRate(rate: FixedCostRate): Promise<void> {
  await withWriteTimeout(
    setDoc(businessDoc, { fixedCosts: rate }, { merge: true }),
  );
}

export async function persistEnergyTariff(energyTariff: number): Promise<void> {
  await withWriteTimeout(
    setDoc(businessDoc, { energyTariff }, { merge: true }),
  );
}
