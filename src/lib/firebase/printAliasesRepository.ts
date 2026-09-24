import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import { COM_METADATA, type SnapshotOrigin } from "@/lib/cloudStatus";
import { withWriteTimeout } from "@/lib/errors";
import { ALIAS_FONTES, aliasDocId } from "@/features/pricing-calculator/lib/printAliases";
import type {
  PrintAliasDraft,
  PrintAliasFonte,
  SavedPrintAlias,
} from "@/features/pricing-calculator/types";

// S3 (frente 3a) — `apelidos`: um documento por apelido de impressão, id
// calculado da chave (`aliasDocId`). O doc do produto NÃO é reescrito a cada
// impressão aprendida — é por isso que é coleção própria.
//
// ⚠ Coleção nova: as regras cobrem pelo `match /{document=**}` (o mesmo caso
// da `alteracoes`, FEAT-12) — nada a publicar no Console.
//
// Quem ESCREVE apelido novo é a transação que cria o produto
// (`productsRepository`, importação) — e, no lote 5, a revisão de impressões.
// Daqui sai só a leitura e a remoção avulsa.
export const aliasesCollection = collection(db, "apelidos");

// O documento gravado. Todo campo explícito, `null` quando vazio (AUD-02).
export function aliasPayload(
  alias: PrintAliasDraft,
  productId: string,
  createdAt: number,
) {
  return {
    fonte: alias.fonte,
    chave: alias.chave,
    variante: alias.variante,
    plate: alias.plate,
    productId,
    stageKey: alias.stageKey,
    objetosPorUnidade: alias.objetosPorUnidade,
    createdAt,
  };
}

// Documento que este código não entende (fonte desconhecida, sem produto) é
// DESCARTADO — virar um apelido "arquivo" ou "sem dono" faria a busca preencher
// por engano (AUD-16 [E5]: tipo errado se descarta, não se converte).
function toSavedAlias(id: string, data: DocumentData): SavedPrintAlias | null {
  if (!ALIAS_FONTES.includes(data.fonte as PrintAliasFonte)) return null;
  if (typeof data.chave !== "string" || !data.chave) return null;
  if (typeof data.productId !== "string" || !data.productId) return null;
  const plate = Number(data.plate);
  const objetos = Number(data.objetosPorUnidade);
  return {
    id,
    fonte: data.fonte as PrintAliasFonte,
    chave: data.chave,
    variante: typeof data.variante === "string" && data.variante ? data.variante : null,
    plate: Number.isInteger(plate) && plate >= 1 ? plate : null,
    productId: data.productId,
    stageKey: typeof data.stageKey === "string" && data.stageKey ? data.stageKey : "main",
    objetosPorUnidade: Number.isInteger(objetos) && objetos >= 1 ? objetos : 1,
    createdAt: Number(data.createdAt) || 0,
  };
}

export function subscribePrintAliases(
  onAliases: (aliases: SavedPrintAlias[], origin: SnapshotOrigin) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    aliasesCollection,
    COM_METADATA,
    (snapshot) => {
      const aliases = snapshot.docs.flatMap((item) => {
        const alias = toSavedAlias(item.id, item.data());
        // O id é calculado da chave: doc cujo id não bate com o conteúdo foi
        // escrito à mão (Console) e quebraria a garantia de unicidade.
        return alias && aliasDocId(alias) === item.id ? [alias] : [];
      });
      onAliases(aliases, snapshot.metadata);
    },
    (error) => onError(error),
  );
}

export async function removePrintAlias(aliasId: string): Promise<void> {
  await withWriteTimeout(deleteDoc(doc(aliasesCollection, aliasId)));
}
