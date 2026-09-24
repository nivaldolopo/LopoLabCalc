import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import { COM_METADATA, type SnapshotOrigin } from "@/lib/cloudStatus";
import { BATCH_TIMEOUT_SECONDS, withWriteTimeout } from "@/lib/errors";
import type {
  NewProductRow,
  ProductPayload,
  SavedProduct,
} from "@/features/pricing-calculator/types";
import { DEFAULT_FAILURE_RATE } from "@/features/pricing-calculator/constants";
import { formatProductCode } from "@/features/pricing-calculator/lib/productCode";
import { aliasDocId } from "@/features/pricing-calculator/lib/printAliases";
import { aliasesCollection, aliasPayload } from "./printAliasesRepository";

const productsCollection = collection(db, "products");

// S2 — o contador do código `LL-0042`. Só anda (nunca reaproveita: produto
// apagado leva o número junto). Para recomeçar do LL-0001 — uma vez só, na
// limpeza da fase A — apague o doc `config/produtoSeq` junto com `products`.
const codeSeqRef = doc(db, "config", "produtoSeq");

function toSavedProduct(id: string, data: DocumentData): SavedProduct {
  return {
    id,
    // TD-022: o contador de versão do documento. Não é campo de negócio nem
    // entra no `ProductPayload` — é do REPOSITÓRIO, como o `id` é do caminho.
    // Documento antigo (os 97 do catálogo) não tem o campo e vale 0; a primeira
    // gravação já o cria. Nada a migrar.
    rev: Number(data.rev) || 0,
    // S2 — `null` = produto anterior ao código (Diretriz 6: sem backfill).
    codigo: typeof data.codigo === "string" && data.codigo ? data.codigo : null,
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
    // ⚠ `energyTariff` NÃO se lê mais daqui — virou GLOBAL (frente 2,
    // 2026-09-17). Documento antigo que ainda trouxer a chave por produto
    // carrega lixo inerte, ignorado (Diretriz 7: sem migração).
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
    // Ausente em doc anterior ao campo → "geral" (Diretriz 7, sem migração).
    kind: data.kind === "personalizado" ? "personalizado" : "geral",
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

// S3 — o apelido do CSV já tem dono: nada foi gravado (a transação inteira
// volta), e a frase diz qual apelido e o que fazer.
export class ApelidoEmUsoError extends Error {
  constructor(chave: string) {
    super(
      `O apelido "${chave}" já está ligado a outro produto (gravado depois que ` +
        "o arquivo foi lido, provavelmente em outra aba). Nada foi importado — " +
        "leia o CSV de novo para ver o aviso e decidir.",
    );
    this.name = "ApelidoEmUsoError";
  }
}

// S2/S3 — cria N produtos numa transação: reserva N códigos no contador,
// grava os produtos e os apelidos deles. Tudo ou nada (dentro do limite de 500
// escritas do Firestore — quem chama fatia). Transação exige servidor: offline
// ela FALHA em vez de ficar na fila como o `addDoc` ficava — e é o certo, o
// número do código só existe depois que o servidor o reservou.
async function createProductsTx(rows: NewProductRow[]): Promise<string[]> {
  const gravacao = runTransaction(db, async (tx) => {
    const seqSnap = await tx.get(codeSeqRef);
    const last = seqSnap.exists() ? Number(seqSnap.data().last) || 0 : 0;
    // Leituras ANTES das escritas (regra da transação): o apelido que outra
    // aba gravou depois da leitura do CSV derruba tudo, em vez de ser
    // sobrescrito calado apontando pra outro produto.
    const aliasRefs = rows.flatMap((row) =>
      row.aliases.map((alias) => ({
        alias,
        ref: doc(aliasesCollection, aliasDocId(alias)),
      })),
    );
    const lidos = await Promise.all(aliasRefs.map(({ ref }) => tx.get(ref)));
    // Apelido já gravado só está EM USO se o produto dele existe. Órfão (o
    // produto foi apagado pelo Console, ou numa corrida com o `removeProduct`)
    // e doc ilegível (sem `productId`) não aparecem em tela nenhuma — se
    // bloqueassem, aquela origem nunca mais se ligaria. Esses são
    // sobrescritos pelo `tx.set` abaixo.
    const donos = await Promise.all(
      lidos.map((snap) => {
        const dono = snap.exists() ? snap.data().productId : null;
        return typeof dono === "string" && dono
          ? tx.get(doc(productsCollection, dono))
          : null;
      }),
    );
    const emUso = donos.findIndex((dono) => dono?.exists());
    if (emUso >= 0) throw new ApelidoEmUsoError(aliasRefs[emUso].alias.chave);

    const agora = Date.now();
    const ids = rows.map((row, index) => {
      const ref = doc(productsCollection);
      tx.set(ref, {
        ...row.payload,
        codigo: formatProductCode(last + index + 1),
        rev: 1,
      });
      row.aliases.forEach((alias) => {
        tx.set(
          doc(aliasesCollection, aliasDocId(alias)),
          aliasPayload(alias, ref.id, agora),
        );
      });
      return ref.id;
    });
    tx.set(codeSeqRef, { last: last + rows.length }, { merge: true });
    return ids;
  });
  return gravacao;
}

// Devolve o id do documento criado: o UX-11 ("salvar e vender/produzir/orçar"
// num clique) precisa dele imediatamente para semear a venda ou a rota, sem
// esperar o produto voltar pela assinatura.
export async function createProduct(payload: ProductPayload): Promise<string> {
  const [id] = await withWriteTimeout(
    createProductsTx([{ payload, aliases: [] }]),
  );
  return id;
}

// Cria vários produtos de uma vez (importação de CSV). Cada fatia é atômica
// (transação; teto de 500 escritas do Firestore — o produto conta 1, cada
// apelido 1, o contador 1). ATENÇÃO: acima disso são várias transações
// SEQUENCIAIS — se uma falhar no meio, as anteriores JÁ foram gravadas. Em vez
// de deixar esse estado parcial em silêncio (TD-009/TD-007), o erro informa
// quantos já entraram, para o usuário reimportar só o restante.
const WRITE_LIMIT = 450;

function chunkRowsByWrites(rows: NewProductRow[]): NewProductRow[][] {
  const chunks: NewProductRow[][] = [];
  let atual: NewProductRow[] = [];
  let escritas = 1; // o contador
  for (const row of rows) {
    const custo = 1 + row.aliases.length;
    if (atual.length > 0 && escritas + custo > WRITE_LIMIT) {
      chunks.push(atual);
      atual = [];
      escritas = 1;
    }
    atual.push(row);
    escritas += custo;
  }
  if (atual.length > 0) chunks.push(atual);
  return chunks;
}

export async function createProductsBatch(rows: NewProductRow[]): Promise<void> {
  let imported = 0;
  for (const chunk of chunkRowsByWrites(rows)) {
    try {
      await withWriteTimeout(createProductsTx(chunk), BATCH_TIMEOUT_SECONDS);
      imported += chunk.length;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      // Só há o que reportar quando parte já foi gravada (>1 fatia). No caso
      // comum (uma fatia, atômica) nada entrou, então repassa o erro cru.
      if (imported === 0) throw error;
      throw new Error(
        `Importados ${imported} de ${rows.length} produtos antes de ` +
          `falhar (${reason}). Os já importados foram mantidos — reimporte ` +
          `apenas os ${rows.length - imported} restantes.`,
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

// S3 — o produto leva os apelidos junto, num lote só: apelido órfão faria a
// próxima impressão daquela origem "reconhecer" um produto que não existe.
// (A busca já ignora órfão — isto é para não deixar lixo, não a única trava.)
export async function removeProduct(productId: string): Promise<void> {
  const apelidos = await getDocs(
    query(aliasesCollection, where("productId", "==", productId)),
  );
  const batch = writeBatch(db);
  batch.delete(doc(db, "products", productId));
  apelidos.docs.forEach((apelido) => batch.delete(apelido.ref));
  await withWriteTimeout(batch.commit());
}
