import type { PrintImages } from "../types";

// S5 (lote 5 da 3a) — onde mora a imagem de uma impressão no Firebase Storage.
// Puro: o caminho é a MESMA função pra quem grava (o upload do import) e pra
// quem lê (o evento guarda o caminho em `imagens`), então os dois nunca
// divergem sobre onde a capa está.
//
// Só dois tipos, decididos no brainstorm (HISTORICO.md): a CAPA (render 512×512,
// ~20 KB — mostra as cores do ARQUIVO) e a FOTO real (876×324, ~16 KB, só X2D
// concluída — a única que mostra a cor impressa). Nada no doc do Firestore: o
// listener carregaria todas.

export type PrintImageKind = "capa" | "foto";

const EXTENSAO: Record<PrintImageKind, string> = { capa: "png", foto: "jpg" };
export const PRINT_IMAGE_CONTENT_TYPE: Record<PrintImageKind, string> = {
  capa: "image/png",
  foto: "image/jpeg",
};

// O `task_id` vira segmento de caminho: barra, ponto-ponto ou vazio mudariam de
// pasta (ou cairiam fora do `impressoes/` que a regra libera). Recusa em vez de
// "limpar" — um id adulterado viraria o caminho de OUTRA impressão.
const TASK_ID_SEGURO = /^[A-Za-z0-9_-]{1,128}$/;

export function isSafeTaskId(taskId: string): boolean {
  return TASK_ID_SEGURO.test(taskId);
}

export function printImagePath(taskId: string, kind: PrintImageKind): string {
  if (!isSafeTaskId(taskId)) {
    throw new Error(`task_id inválido para caminho de imagem: "${taskId}"`);
  }
  return `impressoes/${taskId}/${kind}.${EXTENSAO[kind]}`;
}

// O arquivo que o pipeline exporta ao lado do JSON: `{task_id}_capa.png` e
// `{task_id}_foto.jpg` (pedido, seção 4). Devolve de quem é e o quê — ou `null`
// pra qualquer outro arquivo da pasta (ignorado, nunca adivinhado).
export function parsePrintImageFileName(
  fileName: string,
): { taskId: string; kind: PrintImageKind } | null {
  const match = /^(.+)_(capa|foto)\.(png|jpe?g)$/i.exec(fileName.trim());
  if (!match) return null;
  const taskId = match[1];
  const kind = match[2].toLowerCase() as PrintImageKind;
  const ext = match[3].toLowerCase();
  // A capa é PNG e a foto é JPG — trocado é arquivo errado, não "quase certo".
  if (kind === "capa" ? ext !== "png" : ext === "png") return null;
  return isSafeTaskId(taskId) ? { taskId, kind } : null;
}

// As `imagens` do evento a partir do que existe (subiu agora ou já estava lá).
// Nenhuma das duas → `null` (a impressão não tem mídia), nunca `{null, null}`.
export function eventImages(
  taskId: string,
  has: { capa: boolean; foto: boolean },
): PrintImages | null {
  if (!has.capa && !has.foto) return null;
  return {
    capa: has.capa ? printImagePath(taskId, "capa") : null,
    foto: has.foto ? printImagePath(taskId, "foto") : null,
  };
}
