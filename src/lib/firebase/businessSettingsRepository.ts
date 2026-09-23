import {
  doc,
  onSnapshot,
  runTransaction,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import { ErroAutoExplicativo, withWriteTimeout } from "@/lib/errors";
import { COM_METADATA, type SnapshotOrigin } from "@/lib/cloudStatus";
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

// Lote 1 da 3a [W3] — a trava de `rev` que a AUD-18 deu só a `config/machines`.
//
// Custo fixo e energia são alavancas GLOBAIS com prévia e rastro, e os dois
// partem de uma foto: o "antes" da proposta é o que estava em vigor quando o
// dono clicou "Revisar e aplicar". Sem a trava, A abre em R0, B aplica R1, A
// aplica R2 — o rastro diz "R0→R2", o R1 some sem entrada, e o desfazer volta
// a R0. UMA versão para o doc inteiro (e não uma por campo): a prévia de custo
// fixo conta a tarifa de energia dos dois lados, e vice-versa, então mexer em
// qualquer um dos dois já invalida a prévia do outro.
export class NegocioDesatualizadoError extends ErroAutoExplicativo {
  constructor() {
    super(
      "O custo fixo ou a tarifa de energia mudaram em outro dispositivo (ou em " +
        "outra aba) enquanto esta prévia estava aberta. Nada foi gravado — " +
        "feche a prévia e revise de novo sobre o valor atual, senão a " +
        "alteração do outro lado seria apagada sem rastro.",
    );
    this.name = "NegocioDesatualizadoError";
  }
}

/**
 * A regra da trava, pura e testável: devolve a versão a gravar, ou recusa.
 * Doc sem `rev` (anterior ao lote) vale 0, como em `config/machines`.
 */
export function proximaRevDoNegocio(atual: number, esperado: number): number {
  if (atual !== esperado) throw new NegocioDesatualizadoError();
  return atual + 1;
}

/**
 * Escuta o negócio (taxa de custo fixo + tarifa de energia) em tempo real.
 * Chama `onSettings(null, …)` quando o documento ainda não existe (primeiro
 * uso), para o chamador semear.
 *
 * ⚠ `energyTariff` chega `null` quando o doc já existe mas ainda não tem o
 * campo (doc antigo, de antes da frente 2) — o chamador semeia só o que falta.
 *
 * [W2] O `origin` vai junto (e a assinatura pede `COM_METADATA`): um "doc não
 * existe" que veio do CACHE não é prova de que o servidor não tem o doc —
 * semear em cima disso regravaria os padrões por cima do valor real.
 */
export function subscribeBusinessSettings(
  onSettings: (
    settings: { fixedCostRate: FixedCostRate; energyTariff: number | null } | null,
    rev: number,
    origin: SnapshotOrigin,
  ) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    businessDoc,
    COM_METADATA,
    (snapshot) => {
      if (!snapshot.exists()) {
        onSettings(null, 0, snapshot.metadata);
        return;
      }
      const data = snapshot.data();
      onSettings(
        {
          fixedCostRate: toFixedCostRate(data),
          energyTariff:
            data.energyTariff === undefined || data.energyTariff === null
              ? null
              : Number(data.energyTariff) || 0,
        },
        Number(data.rev) || 0,
        snapshot.metadata,
      );
    },
    (error) => onError(error),
  );
}

// Grava UM campo do doc conferindo a versão DENTRO da transação — a leitura
// ali é do servidor, e é ela que torna a conferência atômica com a escrita.
async function gravarComRev(
  campos: DocumentData,
  revEsperado: number,
): Promise<void> {
  const gravacao = runTransaction(db, async (tx) => {
    const atual = await tx.get(businessDoc);
    const rev = proximaRevDoNegocio(
      atual.exists() ? Number(atual.data().rev) || 0 : 0,
      revEsperado,
    );
    tx.set(businessDoc, { ...campos, rev }, { merge: true });
  });
  await withWriteTimeout(gravacao);
}

export async function persistFixedCostRate(
  rate: FixedCostRate,
  revEsperado: number,
): Promise<void> {
  await gravarComRev({ fixedCosts: rate }, revEsperado);
}

export async function persistEnergyTariff(
  energyTariff: number,
  revEsperado: number,
): Promise<void> {
  await gravarComRev({ energyTariff }, revEsperado);
}

/**
 * [W2] Semeia os padrões SÓ no que o SERVIDOR não tem. A decisão sai da leitura
 * dentro da transação, nunca do snapshot que disparou a semeadura: esse pode
 * ter vindo do cache ("lie-fi" — conectado, sem internet — passa pelo
 * `guardOnline`), e o `setDoc(merge)` antigo regravava os padrões por cima do
 * custo fixo real. Campo que já existe no servidor não é tocado.
 *
 * Devolve `true` se gravou algo.
 */
export async function seedBusinessSettings(
  rate: FixedCostRate,
  energyTariff: number,
): Promise<boolean> {
  const gravacao = runTransaction(db, async (tx) => {
    const atual = await tx.get(businessDoc);
    const data = atual.exists() ? atual.data() : {};
    const faltando: DocumentData = {};
    if (data.fixedCosts === undefined || data.fixedCosts === null) {
      faltando.fixedCosts = rate;
    }
    if (data.energyTariff === undefined || data.energyTariff === null) {
      faltando.energyTariff = energyTariff;
    }
    if (Object.keys(faltando).length === 0) return false;
    // Semear também é mudar o que as prévias abertas usaram como "antes".
    tx.set(
      businessDoc,
      { ...faltando, rev: (Number(data.rev) || 0) + 1 },
      { merge: true },
    );
    return true;
  });
  return withWriteTimeout(gravacao);
}
