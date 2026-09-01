import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import { COM_METADATA, type SnapshotOrigin } from "@/lib/cloudStatus";
import { BATCH_TIMEOUT_SECONDS, withWriteTimeout } from "@/lib/errors";
import type {
  ProductPayload,
  SavedProduct,
} from "@/features/pricing-calculator/types";
import { DEFAULT_FAILURE_RATE } from "@/features/pricing-calculator/constants";

const productsCollection = collection(db, "products");

function toSavedProduct(id: string, data: DocumentData): SavedProduct {
  return {
    id,
    // TD-022: o contador de versão do documento. Não é campo de negócio nem
    // entra no `ProductPayload` — é do REPOSITÓRIO, como o `id` é do caminho.
    // Documento antigo (os 97 do catálogo) não tem o campo e vale 0; a primeira
    // gravação já o cria. Nada a migrar.
    rev: Number(data.rev) || 0,
    name: data.name ?? "",
    mainStageName: data.mainStageName ?? "",
    weightG: Number(data.weightG) || 0,
    printHours: Number(data.printHours) || 0,
    // [FROTA] Fase 2 — o conjunto de máquinas elegíveis. Ausente (todo doc
    // anterior à fase, que guardava um `machineId` escalar) vira lista VAZIA:
    // o cálculo cai na frota inteira e o badge de dado órfão acende. Diretriz 7
    // — não há migração, o dono recadastra.
    machineIds: Array.isArray(data.machineIds)
      ? data.machineIds.filter(
          (id: unknown): id is string => typeof id === "string" && id !== "",
        )
      : [],
    // FEAT-02: cores por produto (etapa principal). Ausente em docs legados →
    // `calculatePricing`/form migram a partir do escalar `weightG`/preço abaixo.
    filaments: Array.isArray(data.filaments) ? data.filaments : undefined,
    filamentPricePerKg: Number(data.filamentPricePerKg) || 0,
    energyTariff: Number(data.energyTariff) || 0,
    laborMinutes: Number(data.laborMinutes) || 0,
    laborRate: Number(data.laborRate) || 0,
    markup: Number(data.markup) || 3,
    failureRate:
      data.failureRate !== undefined && data.failureRate !== null
        ? Number(data.failureRate)
        : DEFAULT_FAILURE_RATE,
    includeFixed:
      data.includeFixed !== undefined && data.includeFixed !== null
        ? Boolean(data.includeFixed)
        : Number(data.fixedCostPerHour) > 0,
    roundingMode: data.roundingMode ?? "exact",
    piecesCount: Math.max(1, Number(data.piecesCount) || 1),
    stages: Array.isArray(data.stages) ? data.stages : [],
    accessories: Array.isArray(data.accessories) ? data.accessories : [],
    // FEAT-01: modo de venda por subitens. Ausente em docs legados → produto
    // só-inteiro (comportamento de hoje).
    sellBySubitems: Boolean(data.sellBySubitems),
    subitems: Array.isArray(data.subitems) ? data.subitems : [],
    linkModel: data.linkModel ?? "",
    linkCompetitor: data.linkCompetitor ?? "",
    linkFile: data.linkFile ?? "",
    fixedCostPerHour: data.fixedCostPerHour ?? null,
    combineEnabled: data.combineEnabled ?? null,
    stage2: data.stage2 ?? null,
    createdAt: Number(data.createdAt) || 0,
  };
}

// AUD-15 [E4] — o argumento `origin` conta de ONDE veio o snapshot (cache ou
// servidor). Sem ele o hook não distingue "chegou" de "chegou do cache porque a
// rede caiu", e era daí que saía o "Sincronizado" mentiroso.
export function subscribeProducts(
  onProducts: (products: SavedProduct[], origin: SnapshotOrigin) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    productsCollection,
    COM_METADATA,
    (snapshot) => {
      const products = snapshot.docs.map((item) =>
        toSavedProduct(item.id, item.data()),
      );
      onProducts(products, snapshot.metadata);
    },
    (error) => onError(error),
  );
}

// Devolve o id do documento criado: o UX-11 ("salvar e vender/produzir/orçar"
// num clique) precisa dele imediatamente para semear a venda ou a rota, sem
// esperar o produto voltar pela assinatura.
export async function createProduct(payload: ProductPayload): Promise<string> {
  const ref = await withWriteTimeout(
    addDoc(productsCollection, { ...payload, rev: 1 }),
  );
  return ref.id;
}

// Cria vários produtos de uma vez (importação de CSV). Cada lote de até 500 é
// atômico (teto de um writeBatch do Firestore). ATENÇÃO: acima de 500 são vários
// commits SEQUENCIAIS — não há transação única cross-lote no cliente Firestore.
// Logo, se um lote falhar no meio, os anteriores JÁ foram gravados. Em vez de
// deixar esse estado parcial em silêncio (TD-009/TD-007), o erro informa quantos
// já entraram, para o usuário reimportar só o restante.
const BATCH_LIMIT = 500;

export async function createProductsBatch(
  payloads: ProductPayload[],
): Promise<void> {
  let imported = 0;
  for (let start = 0; start < payloads.length; start += BATCH_LIMIT) {
    const chunk = payloads.slice(start, start + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const payload of chunk) {
      batch.set(doc(productsCollection), { ...payload, rev: 1 });
    }
    try {
      await withWriteTimeout(batch.commit(), BATCH_TIMEOUT_SECONDS);
      imported += chunk.length;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      // Só há o que reportar quando parte já foi gravada (>1 lote). No caso
      // comum (≤500, atômico) nada entrou, então repassa o erro cru.
      if (imported === 0) throw error;
      throw new Error(
        `Importados ${imported} de ${payloads.length} produtos antes de ` +
          `falhar (${reason}). Os já importados foram mantidos — reimporte ` +
          `apenas os ${payloads.length - imported} restantes.`,
      );
    }
  }
}

// TD-022 — a gravação era `updateDoc(ref, {...payload})`, ou seja o DOCUMENTO
// INTEIRO, e o formulário guarda uma cópia local do produto que ele carregou.
// Duas abas abrindo o mesmo produto e salvando em sequência: a segunda escreve
// por cima da primeira e a alteração dela some sem um ruído.
//
// Reproduzido no Firestore de produção (sonda `__SONDA_TD022__`, 2026-08-23):
// aba A mudou o peso 40 → 99, aba B a mão de obra 10 → 55; B salvou primeiro,
// A depois. O documento ficou com peso 99 e mão de obra **10** — a alteração
// de B apagada. E o formulário de A continuava exibindo 10 no instante do
// salvar: a assinatura em tempo real atualiza a LISTA, não a cópia que o
// formulário está editando. Por isso ninguém percebe.
//
// A saída é a doutrina do resto do projeto: o silêncio é que é o defeito.
// Um contador de versão lido e conferido DENTRO de uma transação — o Firestore
// reexecuta o callback se o documento mudar no meio, então ou a versão bate e a
// escrita entra, ou ela não bate e a gravação é RECUSADA com uma frase que diz
// o que aconteceu. Mesclar campo a campo foi descartado de propósito: juntar
// duas edições cegamente produz um produto que nenhuma das duas abas quis.
export class ProdutoDesatualizadoError extends Error {
  constructor() {
    super(
      "Este produto foi alterado em outra aba ou dispositivo depois que você " +
        "o abriu. Nada foi gravado — carregue o produto de novo (Catálogo → " +
        "Carregar no formulário) para não apagar a alteração da outra ponta.",
    );
    this.name = "ProdutoDesatualizadoError";
  }
}

// Devolve a versão NOVA: quem continua editando o mesmo produto (o UX-11,
// "salvar e já vender/produzir/orçar") precisa dela para o próximo save não
// falhar contra a versão que ele mesmo acabou de criar.
export async function saveProduct(
  productId: string,
  payload: ProductPayload,
  expectedRev: number,
): Promise<number> {
  const ref = doc(db, "products", productId);
  const gravacao = runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    // Produto apagado em outra ponta: a mesma conversa, não uma recriação
    // silenciosa do documento.
    if (!snapshot.exists()) throw new ProdutoDesatualizadoError();
    const atual = Number(snapshot.data().rev) || 0;
    if (atual !== expectedRev) throw new ProdutoDesatualizadoError();
    const proxima = atual + 1;
    tx.update(ref, { ...payload, rev: proxima });
    return proxima;
  });
  return withWriteTimeout(gravacao);
}

export async function removeProduct(productId: string): Promise<void> {
  await withWriteTimeout(deleteDoc(doc(db, "products", productId)));
}
