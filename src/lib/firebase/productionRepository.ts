import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  where,
  runTransaction,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "./client";
import { withWriteTimeout } from "@/lib/errors";
import { lerEConferirRevs } from "./revGuard";
import { serializeRolls } from "./stockRepository";
import { serializeLots } from "./suppliesRepository";
import { finishedGoodToDocument } from "./finishedGoodsRepository";
import { frozenFromDocument, frozenToDocument } from "./frozenCost";
import type {
  FinishedGoodPayload,
  ProductionEvent,
  ProductionFilament,
  ProductionMode,
  ProductionOutcome,
  ProductionPayload,
  StockFilament,
  StockMove,
  Supply,
  SupplyUsage,
} from "@/features/pricing-calculator/types";
import { num } from "@/lib/number";

// Incremento/estorno do Estoque de Produtos junto do evento (FEAT-05b): o estado
// FINAL do doc do acabado (já com a camada empilhada OU já sem as camadas do
// evento), gravado na MESMA transação. `null`/ausente quando a submissão não
// mexe em acabado (desfecho ≠ estoque, avulso, ou evento que não criou camada).
export type FinishedUpdate = { productId: string; payload: FinishedGoodPayload };

// Registro de Produção (FEAT-04): a coleção `producao` é a fonte da verdade do
// consumo de filamento + hora. A baixa entra na MESMA transação do evento
// (atômica com ele), atualizando o campo `rolls` dos docs de `estoque` afetados
// — exatamente como o passo 8 fará na venda. Um evento por doc.
const productionCollection = collection(db, "producao");

const OUTCOME_VALUES: ProductionOutcome[] = [
  "estoque",
  "encomenda",
  "teste",
  "falha",
  "brinde",
  "historico",
];
const MODE_VALUES: ProductionMode[] = ["real", "historico"];

// Serializa uma cor congelada campo a campo (o Firestore rejeita `undefined`, e
// material/brand são congelados aqui — D7). Espelha `stripFilamentIds`, mas
// MANTÉM material/brand (a venda os congela só no passo 8; a produção já aqui).
function usageToDocument(f: ProductionFilament): DocumentData {
  return {
    filamentId: f.filamentId ?? null,
    colorName: f.colorName ?? "",
    // AUD-14 [D9] — o nome diz que é o preço do CADASTRO. O custo que a impressão
    // pagou é FIFO e mora no `frozenBreakdown.material` do mesmo documento.
    catalogPricePerKg: num(f.catalogPricePerKg),
    totalG: num(f.totalG),
    ...(f.modelG !== undefined ? { modelG: num(f.modelG) } : {}),
    ...(f.supportG !== undefined ? { supportG: num(f.supportG) } : {}),
    ...(f.purgedG !== undefined ? { purgedG: num(f.purgedG) } : {}),
    ...(f.towerG !== undefined ? { towerG: num(f.towerG) } : {}),
    ...(f.material ? { material: f.material } : {}),
    ...(f.brand ? { brand: f.brand } : {}),
  };
}

function usageFromDocument(data: DocumentData): ProductionFilament {
  return {
    filamentId: data.filamentId ?? null,
    colorName: data.colorName ?? "",
    // Sem migração (Diretriz 7): documento anterior ao [D9] tem `pricePerKg`, e a
    // leitura o aceita como o que ele sempre foi — o preço de cadastro. Escrever,
    // só com o nome novo.
    catalogPricePerKg: num(data.catalogPricePerKg ?? data.pricePerKg),
    totalG: num(data.totalG),
    ...(data.modelG !== undefined ? { modelG: num(data.modelG) } : {}),
    ...(data.supportG !== undefined ? { supportG: num(data.supportG) } : {}),
    ...(data.purgedG !== undefined ? { purgedG: num(data.purgedG) } : {}),
    ...(data.towerG !== undefined ? { towerG: num(data.towerG) } : {}),
    ...(data.material ? { material: String(data.material) } : {}),
    ...(data.brand ? { brand: String(data.brand) } : {}),
  };
}

// 7e: snapshot do insumo consumido. `supplyId` vai como null quando o acessório
// é avulso — Firestore rejeita `undefined`.
function supplyUsageToDocument(usage: SupplyUsage): DocumentData {
  return {
    supplyId: usage.supplyId ?? null,
    name: usage.name ?? "",
    qty: num(usage.qty),
    catalogUnitPrice: num(usage.catalogUnitPrice),
  };
}

function supplyUsageFromDocument(data: DocumentData): SupplyUsage {
  return {
    supplyId: data.supplyId ?? null,
    name: data.name ?? "",
    qty: num(data.qty),
    // Mesma leitura tolerante do filamento: doc antigo grava `unitPrice`.
    catalogUnitPrice: num(data.catalogUnitPrice ?? data.unitPrice),
  };
}

function moveToDocument(move: StockMove): DocumentData {
  return {
    itemId: move.itemId,
    kind: move.kind,
    stockId: move.stockId,
    rollId: move.rollId,
    qty: num(move.qty),
  };
}

function moveFromDocument(data: DocumentData): StockMove {
  return {
    itemId: String(data.itemId ?? ""),
    kind: data.kind === "supply" ? "supply" : "filament",
    stockId: String(data.stockId ?? ""),
    rollId: String(data.rollId ?? ""),
    qty: num(data.qty),
  };
}

// Exportado para o batch da VENDA (passo 8): a encomenda grava eventos de produção
// na coleção `producao` dentro da mesma transação do recibo, reusando esta
// serialização para não divergir da escrita da /producao.
export function productionToDocument(payload: ProductionPayload): DocumentData {
  return {
    at: num(payload.at),
    outcome: payload.outcome,
    mode: payload.mode,
    ...(payload.productId ? { productId: payload.productId } : {}),
    ...(payload.subitemId ? { subitemId: payload.subitemId } : {}),
    productName: payload.productName ?? "",
    machineId: payload.machineId ?? "",
    machineName: payload.machineName ?? "",
    printHours: num(payload.printHours),
    filaments: payload.filaments.map(usageToDocument),
    ...(payload.supplies && payload.supplies.length > 0
      ? { supplies: payload.supplies.map(supplyUsageToDocument) }
      : {}),
    frozenCost: num(payload.frozenCost),
    // FEAT-06: spread condicional — evento antigo não tem, e o Firestore rejeita
    // `undefined`.
    ...(payload.frozenBreakdown
      ? { frozenBreakdown: frozenToDocument(payload.frozenBreakdown) }
      : {}),
    stockMoves: payload.stockMoves.map(moveToDocument),
    ...(payload.notes ? { notes: payload.notes } : {}),
    createdAt: num(payload.createdAt),
  };
}

function toProduction(id: string, data: DocumentData): ProductionEvent {
  return {
    id,
    at: num(data.at) || num(data.createdAt),
    outcome: OUTCOME_VALUES.includes(data.outcome) ? data.outcome : "historico",
    mode: MODE_VALUES.includes(data.mode) ? data.mode : "historico",
    ...(data.productId ? { productId: String(data.productId) } : {}),
    ...(data.subitemId ? { subitemId: String(data.subitemId) } : {}),
    productName: data.productName ?? "",
    machineId: data.machineId ?? "",
    machineName: data.machineName ?? "",
    printHours: num(data.printHours),
    filaments: Array.isArray(data.filaments)
      ? data.filaments.map(usageFromDocument)
      : [],
    ...(Array.isArray(data.supplies)
      ? { supplies: data.supplies.map(supplyUsageFromDocument) }
      : {}),
    frozenCost: num(data.frozenCost),
    ...(data.frozenBreakdown
      ? { frozenBreakdown: frozenFromDocument(data.frozenBreakdown) }
      : {}),
    stockMoves: Array.isArray(data.stockMoves)
      ? data.stockMoves.map(moveFromDocument)
      : [],
    ...(data.notes ? { notes: String(data.notes) } : {}),
    createdAt: num(data.createdAt),
  };
}

// Id de um evento GERADO ANTES de gravar. A baixa (`planProduction`) precisa do
// id do evento para gravar `stockMoves.itemId` — e é de lá que o estorno (04c)
// lê. Sem pré-gerar, o auto-id do doc não bateria com o `itemId`.
export function newProductionId(): string {
  return doc(productionCollection).id;
}

export function subscribeProduction(
  onProduction: (events: ProductionEvent[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    productionCollection,
    (snapshot) => {
      onProduction(
        snapshot.docs.map((item) => toProduction(item.id, item.data())),
      );
    },
    (error) => onError(error),
  );
}

// TD-006 Fase 3: filtro server-side da produção. `productId` filtra o produto
// (inteiro + subitens; o avulso não tem id e some do filtro — correto);
// `start`/`end` (ms, meio-dia local) delimitam o período por `at`, inclusivo.
export type ProductionQuery = {
  productId?: string | null;
  start?: number | null;
  end?: number | null;
};

function periodConstraints(filter: ProductionQuery): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  if (filter.start != null) constraints.push(where("at", ">=", filter.start));
  if (filter.end != null) constraints.push(where("at", "<=", filter.end));
  return constraints;
}

function withinPeriod(event: ProductionEvent, filter: ProductionQuery): boolean {
  if (filter.start != null && event.at < filter.start) return false;
  if (filter.end != null && event.at > filter.end) return false;
  return true;
}

// TD-006: assinatura PAGINADA + FILTRADA da produção. Gêmea da
// `subscribeSalesPage` — com `productId` traz todo o produto (equality só) e
// refina o período no cliente sem paginar; sem `productId` pagina por `at` com o
// range de período (mesmo campo do orderBy). Nenhuma das formas usa índice
// composto. O ROI (/maquinas) segue lendo tudo por `subscribeProduction`.
export function subscribeProductionPage(
  filter: ProductionQuery,
  pageLimit: number,
  onProduction: (events: ProductionEvent[], hasMore: boolean) => void,
  onError: (error: Error) => void,
): () => void {
  if (filter.productId) {
    return onSnapshot(
      query(productionCollection, where("productId", "==", filter.productId)),
      (snapshot) => {
        const events = snapshot.docs
          .map((item) => toProduction(item.id, item.data()))
          .filter((event) => withinPeriod(event, filter));
        onProduction(events, false);
      },
      (error) => onError(error),
    );
  }
  return onSnapshot(
    query(
      productionCollection,
      ...periodConstraints(filter),
      orderBy("at", "desc"),
      fsLimit(pageLimit + 1),
    ),
    (snapshot) => {
      const docs = snapshot.docs;
      const hasMore = docs.length > pageLimit;
      const page = hasMore ? docs.slice(0, pageLimit) : docs;
      onProduction(
        page.map((item) => toProduction(item.id, item.data())),
        hasMore,
      );
    },
    (error) => onError(error),
  );
}

// TD-006: contagem de eventos (aggregation) para o "X de N" — respeita o período
// (mesmo campo do orderBy, sem índice composto). O caminho de produto conta no
// cliente (conjunto já em memória), então não passa por aqui.
export async function fetchProductionCount(
  filter: ProductionQuery = {},
): Promise<number> {
  const snap = await getCountFromServer(
    query(productionCollection, ...periodConstraints(filter)),
  );
  return num(snap.data().count);
}

// TD-006: resolve eventos de produção POR ID direto no banco, sem depender da
// lista em memória. O estorno de uma venda/encomenda (SalesPage/SaleModal) lia os
// eventos pela lista assinada; com a produção paginada, um evento antigo fora da
// janela carregada não seria encontrado e o estoque NÃO seria estornado. Buscar
// por id garante o estorno correto de qualquer venda, nova ou antiga. Um evento já
// apagado à mão vem ausente (filtrado) — não estorna em dobro, como antes.
export async function fetchProductionEventsByIds(
  ids: string[],
): Promise<ProductionEvent[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  const events = await Promise.all(
    unique.map(async (id) => {
      const snap = await getDoc(doc(productionCollection, id));
      return snap.exists() ? toProduction(snap.id, snap.data()) : null;
    }),
  );
  return events.filter((event): event is ProductionEvent => event !== null);
}

// Grava N eventos de produção e dá baixa dos rolos ATOMICAMENTE (ou entra tudo,
// ou nada — a baixa nunca fica sem os eventos que a explicam, nem o contrário).
// Os ids são PRÉ-GERADOS (`newProductionId`) para que `payload.stockMoves.itemId`
// bata com o doc. A lista tem mais de 1 evento quando um produto inteiro roda em
// máquinas diferentes (um evento por máquina, baixa encadeada — ver 04b).
// `colorUpdates` é o estado FINAL das cores afetadas (já decrementado por todos
// os eventos); no modo historico é `[]`. Só o campo `rolls` da cor é reescrito.
// `finished` (FEAT-05b) é o doc do acabado já incrementado pela submissão, quando
// o desfecho é `estoque`; grava no mesmo batch (id do doc = productId).
export async function saveProduction(
  events: { id: string; payload: ProductionPayload }[],
  colorUpdates: StockFilament[],
  finished?: FinishedUpdate | null,
  supplyUpdates: Supply[] = [],
): Promise<void> {
  // TD-022: virou transação com conferência de `rev` (ver `revGuard.ts`). A
  // produção grava exatamente os mesmos três documentos que a venda, e sem a
  // trava uma produção salva no mesmo instante que uma venda apagava a baixa da
  // outra. Atomicidade idêntica à do batch; o que entra é o isolamento.
  const gravacao = runTransaction(db, async (tx) => {
    const revs = await escreverEstoqueNaTransacao(
      tx,
      colorUpdates,
      supplyUpdates,
      finished,
    );
    for (const { id, payload } of events) {
      tx.set(doc(productionCollection, id), productionToDocument(payload));
    }
    revs();
  });
  await withWriteTimeout(gravacao);
}

// A leitura+conferência e a escrita da trinca (cores, insumos, acabado), que é
// idêntica na criação e na exclusão do evento. Devolve a função que ESCREVE, e
// não escreve sozinha, porque a transação exige toda leitura antes de qualquer
// escrita — quem chama intercala o que é dele no meio.
async function escreverEstoqueNaTransacao(
  tx: Parameters<Parameters<typeof runTransaction>[1]>[0],
  colorUpdates: StockFilament[],
  supplyUpdates: Supply[],
  finished?: FinishedUpdate | null,
): Promise<() => void> {
  const cores = colorUpdates.map((color) => ({
    color,
    ref: doc(db, "estoque", color.id),
  }));
  const insumos = supplyUpdates.map((supply) => ({
    supply,
    ref: doc(db, "insumos", supply.id),
  }));
  const acabadoRef = finished
    ? doc(db, "acabados", finished.productId)
    : null;

  const revs = await lerEConferirRevs(tx, [
    ...cores.map(({ color, ref }) => ({
      ref,
      esperado: color.rev ?? 0,
      nome: `A cor "${color.colorName}"`,
    })),
    ...insumos.map(({ supply, ref }) => ({
      ref,
      esperado: supply.rev ?? 0,
      nome: `O insumo "${supply.name}"`,
    })),
    ...(finished && acabadoRef
      ? [
          {
            ref: acabadoRef,
            esperado: finished.payload.rev ?? 0,
            nome: `As peças prontas de "${finished.payload.productName ?? finished.productId}"`,
            podeNaoExistir: true,
          },
        ]
      : []),
  ]);

  return () => {
    cores.forEach(({ color, ref }, i) => {
      tx.update(ref, {
        rolls: serializeRolls(color.rolls),
        rev: revs[i] + 1,
      });
    });
    // 7e: os insumos entram na MESMA transação (só o campo `lots`) — o ímã não
    // pode sair do estoque sem o evento que o explica, nem o contrário.
    insumos.forEach(({ supply, ref }, i) => {
      tx.update(ref, {
        lots: serializeLots(supply.lots),
        rev: revs[cores.length + i] + 1,
      });
    });
    if (finished && acabadoRef) {
      tx.set(acabadoRef, {
        ...finishedGoodToDocument(finished.payload),
        rev: revs[cores.length + insumos.length] + 1,
      });
    }
  };
}

// Exclui um evento e estorna a baixa no mesmo batch. `colorUpdates` vem de
// `reverseProduction` (cores com os rolos restaurados). `finished` (FEAT-05b) é o
// doc do acabado já SEM as camadas do evento (`removeEventLayers`), quando o
// evento havia incrementado o estoque de produtos. Sem nada a estornar (evento
// historico, sem acabado) → só apaga o doc.
export async function removeProduction(
  eventId: string,
  colorUpdates: StockFilament[] = [],
  finished?: FinishedUpdate | null,
  supplyUpdates: Supply[] = [],
): Promise<void> {
  if (colorUpdates.length === 0 && supplyUpdates.length === 0 && !finished) {
    await withWriteTimeout(deleteDoc(doc(db, "producao", eventId)));
    return;
  }
  // TD-022: mesma transação da criação — o ESTORNO tem ainda mais motivo para
  // travar, porque devolver ao estoque um saldo calculado sobre uma foto velha
  // repõe grama que outra baixa já tinha tirado.
  const estorno = runTransaction(db, async (tx) => {
    const escrever = await escreverEstoqueNaTransacao(
      tx,
      colorUpdates,
      supplyUpdates,
      finished,
    );
    tx.delete(doc(db, "producao", eventId));
    escrever();
  });
  await withWriteTimeout(estorno);
}
