import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import { COM_METADATA, type SnapshotOrigin } from "@/lib/cloudStatus";
import { withWriteTimeout } from "@/lib/errors";
import { num } from "@/lib/number";
import type {
  ChangeCrossing,
  ChangeImpact,
  ChangeLever,
  ChangeRecord,
  ChangeRecordPayload,
  ChangeState,
  ChangeTopItem,
  FixedCostRate,
  Machine,
} from "@/features/pricing-calculator/types";
import type { MarginTier } from "@/features/pricing-calculator/lib/marginTier";

// [FEAT-12] — o REGISTRO de mudança global de preço. Um documento por mudança.
//
// ⚠ Coleção nova. As regras do Firestore a cobrem pelo `match /{document=**}`
// (rules_version 2 alcança qualquer profundidade), e o `pnpm test:rules` prova
// isso com a sonda "colecao inedita"; esta ganhou sonda própria, nomeada, para
// a próxima varredura não ter de deduzir a cobertura.
const changesCollection = collection(db, "alteracoes");

// Quantas entradas a página de Configurações assina. O registro é permanente,
// mas ninguém lê a milésima linha — e assinar a coleção inteira em tempo real
// era o que o TD-006 tirou da `producao`.
export const CHANGE_LOG_PAGE = 100;

const LEVERS: ChangeLever[] = ["maquinas", "custo-fixo", "cor", "insumo"];
const TIERS: MarginTier[] = ["bad", "ok", "good"];

function toLever(value: unknown): ChangeLever {
  // Alavanca desconhecida cai em `maquinas`? NÃO — isso mentiria sobre o que
  // aconteceu. Ela vira `cor`, a alavanca que NÃO oferece desfazer: um
  // documento que este código não entende não pode virar um botão que grava
  // `config/machines` com um `before` de forma desconhecida.
  return LEVERS.includes(value as ChangeLever) ? (value as ChangeLever) : "cor";
}

function toTier(value: unknown): MarginTier | null {
  return TIERS.includes(value as MarginTier) ? (value as MarginTier) : null;
}

function toMachine(data: DocumentData): Machine {
  return {
    id: String(data.id ?? ""),
    name: data.name ?? "",
    price: num(data.price),
    lifeHours: num(data.lifeHours),
    watts: num(data.watts),
    maintenancePerHour: num(data.maintenancePerHour),
    weight: num(data.weight),
  };
}

function toFixedCostRate(data: DocumentData): FixedCostRate {
  return {
    rent: num(data.rent),
    other: num(data.other),
    machines: Math.max(1, num(data.machines) || 1),
    hoursDay: num(data.hoursDay),
    daysMonth: num(data.daysMonth),
  };
}

// ⚠ AUD-16 [E5] — tipo errado se DESCARTA, não se coage. Uma lista que não é
// lista vira `null` ("não se aplica"), nunca um objeto meio montado: o desfazer
// grava o que ler daqui em `config/machines`, e um `[object Object]` no lugar de
// uma máquina não tem leitura possível.
function toState(data: DocumentData | undefined): ChangeState {
  const raw = data ?? {};
  return {
    machines: Array.isArray(raw.machines) ? raw.machines.map(toMachine) : null,
    fixedCostRate:
      raw.fixedCostRate && typeof raw.fixedCostRate === "object"
        ? toFixedCostRate(raw.fixedCostRate)
        : null,
    unitPrice:
      raw.unitPrice === undefined || raw.unitPrice === null
        ? null
        : num(raw.unitPrice),
  };
}

function toTop(value: unknown): ChangeTopItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    id: String(item?.id ?? ""),
    name: item?.name ?? "",
    before: num(item?.before),
    after: num(item?.after),
  }));
}

function toCrossings(value: unknown): ChangeCrossing[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    id: String(item?.id ?? ""),
    name: item?.name ?? "",
    from: toTier(item?.from),
    to: toTier(item?.to),
  }));
}

function toImpact(data: DocumentData | undefined): ChangeImpact {
  const raw = data ?? {};
  return {
    evaluated: num(raw.evaluated),
    affected: num(raw.affected),
    up: num(raw.up),
    down: num(raw.down),
    avgPct: num(raw.avgPct),
    top: toTop(raw.top),
    crossings: toCrossings(raw.crossings),
  };
}

function toChangeRecord(id: string, data: DocumentData): ChangeRecord {
  return {
    id,
    at: num(data.at),
    by: data.by ?? "",
    lever: toLever(data.lever),
    summary: data.summary ?? "",
    details: Array.isArray(data.details)
      ? data.details.map((line: unknown) => String(line ?? ""))
      : [],
    before: toState(data.before),
    after: toState(data.after),
    impact: toImpact(data.impact),
    undoOf: data.undoOf ? String(data.undoOf) : null,
  };
}

/**
 * Escuta o registro, do mais recente para o mais antigo.
 *
 * AUD-15 [E4]: o `origin` conta se o que chegou veio do servidor ou do cache —
 * sem ele o hook faria a afirmação "Sincronizado" com a rede caída.
 */
export function subscribeChangeLog(
  onChanges: (changes: ChangeRecord[], origin: SnapshotOrigin) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(changesCollection, orderBy("at", "desc"), limit(CHANGE_LOG_PAGE)),
    COM_METADATA,
    (snapshot) => {
      onChanges(
        snapshot.docs.map((item) => toChangeRecord(item.id, item.data())),
        snapshot.metadata,
      );
    },
    (error) => onError(error),
  );
}

/**
 * Grava uma entrada. Devolve o id — o desfazer precisa dele para apontar o
 * `undoOf` da entrada que ele desfaz.
 *
 * ⚠ Esta escrita NÃO é atômica com a da alavanca, e é de propósito: elas vivem
 * em documentos diferentes (`config/machines`, `config/negocio`, `estoque`,
 * `insumos`) e uma transação de quatro caminhos para gravar um rastro custaria
 * mais do que o rastro vale. A ordem escolhida é ALAVANCA PRIMEIRO: um registro
 * sem a mudança correspondente descreveria um preço que nunca existiu, enquanto
 * uma mudança sem registro é o que o app já fazia até hoje.
 */
export async function createChangeRecord(
  payload: ChangeRecordPayload,
): Promise<string> {
  const ref = await withWriteTimeout(addDoc(changesCollection, payload));
  return ref.id;
}
