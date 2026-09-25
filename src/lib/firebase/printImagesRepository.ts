import { getDownloadURL, getMetadata, ref, uploadBytes } from "firebase/storage";
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

// Já existe? Para o import subir só "as imagens que faltam". 404 = não existe;
// qualquer outro erro (rede, permissão) SOBE — tratar como "não existe" faria o
// import reenviar tudo calado, ou pior, gravar `imagens: null` num evento que
// tem capa.
export async function printImageExists(
  taskId: string,
  kind: PrintImageKind,
): Promise<boolean> {
  try {
    await getMetadata(ref(storage, printImagePath(taskId, kind)));
    return true;
  } catch (err) {
    if ((err as { code?: string })?.code === "storage/object-not-found") return false;
    throw err;
  }
}

// A URL para `<img src>` a partir do caminho gravado no evento.
export function printImageUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path));
}
