import {
  collection,
  onSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import { COM_METADATA, type SnapshotOrigin } from "@/lib/cloudStatus";
import { frozenFromDocument, frozenToDocument } from "./frozenCost";
import {
  NO_COLOR_KEY,
  NO_COLOR_LABEL,
} from "@/features/pricing-calculator/lib/filaments";
import type {
  FinishedGood,
  FinishedGoodPayload,
  FinishedLayer,
  FinishedSku,
} from "@/features/pricing-calculator/types";
import { num } from "@/lib/number";

// Estoque de Produtos / acabados (FEAT-05): um doc por PRODUTO, id do doc =
// productId (DETERMINÍSTICO — a baixa da produção acha o doc sem query e grava no
// MESMA transação do evento, 05b). As SKUs (subitens) e suas camadas FIFO ficam
// dentro do doc; são poucas por produto, então cabem e a escrita continua atômica
// — o que importa quando o incremento entra junto do evento de produção.
const finishedCollection = collection(db, "acabados");

function toLayer(data: DocumentData): FinishedLayer {
  return {
    id: String(data.id ?? ""),
    at: num(data.at),
    qty: num(data.qty),
    unitCost: num(data.unitCost),
    ...(data.costBreakdown
      ? { costBreakdown: frozenFromDocument(data.costBreakdown) }
      : {}),
    sourceEventId: String(data.sourceEventId ?? ""),
  };
}

// FEAT-11: SKU gravada antes da cor virar dimensão não tem `colorKey` — vira o
// balde "Sem cor" AQUI, no único ponto de entrada do dado, para o núcleo puro não
// carregar `??` em cada função. Diretriz 7: sem migração; o saldo velho fica
// nesse balde e não se mistura com o das produções novas.
function toSku(data: DocumentData): FinishedSku {
  return {
    ...(data.subitemId ? { subitemId: String(data.subitemId) } : {}),
    colorKey: data.colorKey ? String(data.colorKey) : NO_COLOR_KEY,
    colorLabel: data.colorLabel ? String(data.colorLabel) : NO_COLOR_LABEL,
    name: data.name ?? "",
    layers: Array.isArray(data.layers) ? data.layers.map(toLayer) : [],
  };
}

// Exportada para o teste do TD-026: é a metade LEITURA do round-trip com o
// `finishedGoodToDocument`, e o defeito daquele item vivia exatamente na volta
// (o doc trazia o `rev`, o payload remontado o perdia).
export function toFinishedGood(id: string, data: DocumentData): FinishedGood {
  return {
    id,
    // TD-022: a versão do documento entra na leitura para viajar de carona nos
    // planos (as funções puras fazem `{...color}`) e voltar na gravação, que a
    // confere dentro da transação.
    rev: Number(data.rev) || 0,
    productId: data.productId ?? id,
    productName: data.productName ?? "",
    skus: Array.isArray(data.skus) ? data.skus.map(toSku) : [],
    createdAt: num(data.createdAt),
  };
}

// Serializa campo a campo (o Firestore rejeita `undefined`, e `subitemId` é
// opcional — a SKU do inteiro não o tem). Mesma disciplina do `rollToDocument`.
function layerToDocument(layer: FinishedLayer): DocumentData {
  return {
    id: layer.id,
    at: num(layer.at),
    qty: num(layer.qty),
    unitCost: num(layer.unitCost),
    // FEAT-06: a composição do `unitCost`. Camada anterior não tem — spread
    // condicional (o Firestore rejeita `undefined`).
    ...(layer.costBreakdown
      ? { costBreakdown: frozenToDocument(layer.costBreakdown) }
      : {}),
    sourceEventId: layer.sourceEventId,
  };
}

function skuToDocument(sku: FinishedSku): DocumentData {
  return {
    ...(sku.subitemId ? { subitemId: sku.subitemId } : {}),
    colorKey: sku.colorKey || NO_COLOR_KEY,
    colorLabel: sku.colorLabel || NO_COLOR_LABEL,
    name: sku.name ?? "",
    layers: sku.layers.map(layerToDocument),
  };
}

// Serializa o array de SKUs.
// ⚠ AUD-14 [D7] — o comentário daqui dizia que a exportação existia "para a baixa
// da produção reusar esta serialização, no mesmo writeBatch do evento". Medido: 0
// importadores fora deste arquivo, nem em teste. Quem os outros dois repositórios
// de escrita importam é o `finishedGoodToDocument` abaixo, que já embrulha esta
// função; o `export` sobrou de quando a produção montava o doc do acabado campo a
// campo. Sem chamador de fora, ela deixou de ser exportada — API pública que
// ninguém usa é convite a divergir da escrita normal, que é justo o que o
// comentário dizia evitar.
function serializeSkus(skus: FinishedSku[]): DocumentData[] {
  return skus.map(skuToDocument);
}

export function finishedGoodToDocument(
  payload: FinishedGoodPayload,
): DocumentData {
  return {
    productId: payload.productId,
    productName: payload.productName ?? "",
    skus: serializeSkus(payload.skus),
    createdAt: num(payload.createdAt),
  };
}

// AUD-15 [E4] — o argumento `origin` conta de ONDE veio o snapshot (cache ou
// servidor). Sem ele o hook não distingue "chegou" de "chegou do cache porque a
// rede caiu", e era daí que saía o "Sincronizado" mentiroso.
export function subscribeFinishedGoods(
  onData: (goods: FinishedGood[], origin: SnapshotOrigin) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    finishedCollection,
    COM_METADATA,
    (snapshot) => {
      onData(
        snapshot.docs.map((item) => toFinishedGood(item.id, item.data())),
        snapshot.metadata,
      );
    },
    (error) => onError(error),
  );
}

// TD-030 — aqui moravam `saveFinishedGood` e `removeFinishedGood`, o par
// "avulso" que nunca ganhou chamador: quem cria e mexe no doc de acabado é
// SEMPRE a transação de outra coleção (produção 05b, venda, estorno), e é isso
// que mantém a baixa atômica. Um caminho solto de gravar/apagar o acabado por
// fora seria a porta para o saldo divergir do rastro que o produziu, então o
// código morto saiu em vez de ganhar botão. O que sobra deste arquivo é a
// LEITURA viva (`subscribeFinishedGoods`) e o `finishedGoodToDocument`, que os
// dois repositórios de escrita importam.
// ⚠ Consequência declarada: doc de acabado com saldo 0 (produto excluído, ou
// produção estornada) fica na coleção, invisível na tela. É o retrato certo do
// que aconteceu — o produto foi excluído, o rastro do que já foi produzido
// não.
