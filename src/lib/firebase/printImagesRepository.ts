import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./client";
import { guardOnline } from "@/lib/errors";
import {
  PRINT_IMAGE_CONTENT_TYPE,
  printImagePath,
  type PrintImageKind,
} from "@/features/pricing-calculator/lib/printImages";

// S5 (lote 5 da 3a) — capa e foto das impressões no Firebase Storage. O caminho
// sai SEMPRE do `printImagePath` (lib puro), o mesmo que o evento grava em
// `imagens` — quem sobe e quem lê nunca discordam de onde a imagem está.
//
// Subir de novo o mesmo arquivo SOBRESCREVE o mesmo caminho: repetir um upload
// que falhou no meio é seguro (não há contador nem id novo aqui).

export async function uploadPrintImage(
  taskId: string,
  kind: PrintImageKind,
  file: Blob,
): Promise<string> {
  guardOnline();
  const path = printImagePath(taskId, kind);
  // O tipo vai EXPLÍCITO: a regra só aceita `image/*`, e o navegador pode
  // mandar vazio pra arquivo escolhido de uma pasta.
  await uploadBytes(ref(storage, path), file, {
    contentType: PRINT_IMAGE_CONTENT_TYPE[kind],
  });
  return path;
}

// As imagens escolhidas de um lote (S6 e S7): poucas de cada vez — são arquivos
// de ~20 KB, e o limite é o navegador, não a banda. Devolve o conjunto
// `${taskId}:${kind}` do que SUBIU (é ele que decide as `imagens` do evento: o
// evento nunca aponta pra imagem que não existe). Falha de uma = rejeita.
export async function uploadPrintImages(
  tarefas: { taskId: string; kind: PrintImageKind; file: Blob }[],
  onProgress: (feitas: number, total: number) => void,
  paralelo = 6,
): Promise<Set<string>> {
  const subiram = new Set<string>();
  let i = 0;
  const workers = Array.from({ length: Math.min(paralelo, tarefas.length) }, async () => {
    while (i < tarefas.length) {
      const t = tarefas[i++];
      await uploadPrintImage(t.taskId, t.kind, t.file);
      subiram.add(`${t.taskId}:${t.kind}`);
      onProgress(subiram.size, tarefas.length);
    }
  });
  await Promise.all(workers);
  return subiram;
}

// A URL para `<img src>` a partir do caminho gravado no evento.
export function printImageUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path));
}
