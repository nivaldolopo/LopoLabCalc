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

// O que subir: a imagem que o arquivo CITA para cada impressão, entre as
// escolhidas pelo dono (pelo NOME do arquivo — nunca por convenção de nome: o
// que o JSON diz é o que vale). Comum ao import (S6) e à revisão (S7).
export function imageTasks<F>(
  prints: { taskId: string; imagens: { capa: string | null; foto: string | null } }[],
  escolhidas: Map<string, F>,
): { taskId: string; kind: PrintImageKind; file: F }[] {
  const out: { taskId: string; kind: PrintImageKind; file: F }[] = [];
  for (const p of prints) {
    for (const kind of ["capa", "foto"] as PrintImageKind[]) {
      const nome = p.imagens[kind];
      const file = nome ? escolhidas.get(nome) : undefined;
      if (file) out.push({ taskId: p.taskId, kind, file });
    }
  }
  return out;
}
