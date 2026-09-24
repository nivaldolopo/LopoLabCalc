// S3 (frente 3a) — APELIDOS de impressão: a ligação "de onde veio a impressão"
// → produto + etapa + objetos por unidade. Tudo aqui é puro: a chave
// canônica, o id do documento, a leitura da coluna `Apelidos JSON` e a busca
// em camadas que a revisão de impressões (lote 5) vai consumir.
//
// Regra da busca (brainstorm 2026-09-22/23): **só a exata preenche sozinha**.
// Todo o resto é SUGESTÃO, com o motivo dito — o dono decide.

import { normalizeText } from "@/lib/text";
import { MAIN_STAGE_KEY, stageKeyFor } from "./calculatePricing";
import { parseProductCode } from "./productCode";
import type {
  PrintAliasDraft,
  PrintAliasFonte,
  PrintAliasKey,
  PrintStage,
  SavedPrintAlias,
} from "../types";

export const ALIAS_FONTES: readonly PrintAliasFonte[] = ["codigo", "mw", "arquivo"];

// Extensão de arquivo de impressão não é parte do NOME: `Quatto.3mf` e
// `Quatto.gcode.3mf` são o mesmo projeto.
const EXTENSOES = /\.(gcode\.3mf|3mf|gcode|stl|step|stp|obj)$/i;

// A chave na forma em que se COMPARA. Normalizar ≠ traduzir: caixa, acento,
// `_` e espaço repetido somem; as palavras continuam as do original.
// `null` = chave inutilizável (vazia, ou código ilegível).
export function normalizeAliasChave(
  fonte: PrintAliasFonte,
  chave: string,
): string | null {
  const bruta = String(chave ?? "").trim();
  if (!bruta) return null;
  if (fonte === "codigo") return parseProductCode(bruta);
  if (fonte === "mw") return bruta;
  const nome = normalizeText(bruta.replace(EXTENSOES, ""))
    .replace(/[_\s]+/g, " ")
    .trim();
  return nome || null;
}

// Um id de documento por apelido, calculado da chave: é assim que "o mesmo
// apelido nunca aponta pra dois produtos" vira garantia do banco, e não uma
// checagem que uma corrida entre duas abas atravessa. `~` separa os campos,
// então ele mesmo é escapado dentro dos valores (senão `a~b` + variante vazia
// colidiria com `a` + variante `b`); o `encodeURIComponent` cuida da `/`, que o
// Firestore não aceita em id.
function idPart(value: string): string {
  return encodeURIComponent(value).replace(/~/g, "%7E");
}

export function aliasDocId(key: PrintAliasKey): string {
  return [
    key.fonte,
    idPart(key.chave),
    idPart(key.variante ?? ""),
    key.plate === null ? "" : String(key.plate),
  ].join("~");
}

// A chave da etapa como os subitens já a escrevem: `"main"` ou o id da etapa
// (posicional quando o documento não tem id — mesma regra do RT-02).
export function stageKeysOf(stages: PrintStage[] | undefined): string[] {
  return [
    MAIN_STAGE_KEY,
    ...(stages ?? []).map(stageKeyFor),
  ];
}

// ─── A coluna `Apelidos JSON` do CSV do catálogo ─────────────────────────────

export type AliasCellProblem = {
  // `invalido`: item que não dá pra ler (descartado) · `codigo`: fonte
  // `codigo` na planilha — o produto ainda não tem código, é o site que gera.
  kind: "invalido" | "codigo";
  detalhe: string;
};

function texto(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function inteiroPositivo(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 ? n : null;
}

function resolveEtapa(
  raw: unknown,
  mainStageName: string,
  stages: PrintStage[],
): string | null {
  const alvo = texto(raw);
  if (alvo === null || alvo === "" || alvo === MAIN_STAGE_KEY) return MAIN_STAGE_KEY;
  const chaves = stageKeysOf(stages);
  if (chaves.includes(alvo)) return alvo;
  // Pelo NOME: o curador escreve "Tampa", não `stage_1712…`. Nome que casa com
  // duas etapas é ambíguo — descarta, não chuta.
  const nome = normalizeText(alvo);
  const porNome = [
    ...(normalizeText(mainStageName) === nome ? [MAIN_STAGE_KEY] : []),
    ...stages.flatMap((stage, index) =>
      normalizeText(stage.name ?? "") === nome ? [chaves[index + 1]] : [],
    ),
  ];
  return porNome.length === 1 ? porNome[0] : null;
}

// Lê a célula. Célula vazia = nenhum apelido (não é problema). Item ruim sai
// da lista e SE ANUNCIA (AUD-16 [E5]: tipo errado se descarta, nunca se
// converte às cegas); os bons entram.
export function parseAliasesCell(
  raw: string | undefined,
  mainStageName: string,
  stages: PrintStage[],
): { aliases: PrintAliasDraft[]; problems: AliasCellProblem[] } {
  const aliases: PrintAliasDraft[] = [];
  const problems: AliasCellProblem[] = [];
  const cell = String(raw ?? "").trim();
  if (!cell) return { aliases, problems };

  let parsed: unknown;
  try {
    parsed = JSON.parse(cell);
  } catch {
    problems.push({ kind: "invalido", detalhe: "JSON ilegível" });
    return { aliases, problems };
  }
  if (!Array.isArray(parsed)) {
    problems.push({ kind: "invalido", detalhe: "não é uma lista [...]" });
    return { aliases, problems };
  }

  parsed.forEach((item, index) => {
    const onde = `item ${index + 1}`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      problems.push({ kind: "invalido", detalhe: `${onde}: não é um objeto {...}` });
      return;
    }
    const obj = item as Record<string, unknown>;
    const fonte = texto(obj.fonte);
    if (!fonte || !ALIAS_FONTES.includes(fonte as PrintAliasFonte)) {
      problems.push({
        kind: "invalido",
        detalhe: `${onde}: fonte "${fonte ?? ""}" (use mw ou arquivo)`,
      });
      return;
    }
    if (fonte === "codigo") {
      problems.push({ kind: "codigo", detalhe: `${onde}: "${texto(obj.chave) ?? ""}"` });
      return;
    }
    const chave = normalizeAliasChave(fonte as PrintAliasFonte, texto(obj.chave) ?? "");
    if (!chave) {
      problems.push({ kind: "invalido", detalhe: `${onde}: chave vazia` });
      return;
    }
    const variante = texto(obj.variante);
    if (obj.variante !== undefined && obj.variante !== null && variante === null) {
      problems.push({ kind: "invalido", detalhe: `${onde}: variante não é texto` });
      return;
    }
    let plate: number | null = null;
    if (obj.plate !== undefined && obj.plate !== null && obj.plate !== "") {
      plate = inteiroPositivo(obj.plate);
      if (plate === null) {
        problems.push({
          kind: "invalido",
          detalhe: `${onde}: plate "${String(obj.plate)}" (inteiro a partir de 1)`,
        });
        return;
      }
    }
    let objetosPorUnidade = 1;
    if (
      obj.objetosPorUnidade !== undefined &&
      obj.objetosPorUnidade !== null &&
      obj.objetosPorUnidade !== ""
    ) {
      const n = inteiroPositivo(obj.objetosPorUnidade);
      if (n === null) {
        problems.push({
          kind: "invalido",
          detalhe: `${onde}: objetosPorUnidade "${String(obj.objetosPorUnidade)}" (inteiro a partir de 1)`,
        });
        return;
      }
      objetosPorUnidade = n;
    }
    const stageKey = resolveEtapa(obj.etapa, mainStageName, stages);
    if (!stageKey) {
      problems.push({
        kind: "invalido",
        detalhe: `${onde}: etapa "${texto(obj.etapa) ?? ""}" não existe (ou é ambígua) na linha`,
      });
      return;
    }
    aliases.push({
      fonte: fonte as PrintAliasFonte,
      chave,
      variante: variante ? variante : null,
      plate,
      stageKey,
      objetosPorUnidade,
    });
  });

  return { aliases, problems };
}

// A forma que o export escreve — a mesma que o parser lê (etapa pelo id).
export function aliasesCell(aliases: SavedPrintAlias[]): string {
  if (aliases.length === 0) return "";
  const ordenados = [...aliases].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(
    ordenados.map((alias) => ({
      fonte: alias.fonte,
      chave: alias.chave,
      variante: alias.variante,
      plate: alias.plate,
      etapa: alias.stageKey,
      objetosPorUnidade: alias.objetosPorUnidade,
    })),
  );
}

// ─── A busca em camadas ──────────────────────────────────────────────────────

export type AliasLookupProduct = {
  id: string;
  name: string;
  codigo?: string | null;
  linkModel?: string;
  stages?: PrintStage[];
};

export type AliasSuggestionMotivo =
  // Mesmo apelido, mas a etapa que ele apontava foi removida do produto.
  | "etapa-removida"
  // Mesma origem (fonte+chave+variante), outra mesa: "produto X, qual etapa?"
  | "outra-mesa"
  // O código no nome do projeto é de um produto, mas nenhuma mesa dele foi
  // ligada ainda: "qual etapa?"
  | "codigo"
  // Mesmo design do MakerWorld, outra instância.
  | "outra-variante"
  // O Link Modelo do produto aponta para este design.
  | "link-modelo"
  // Nome de arquivo parecido ("Rev J" × "Rev K").
  | "nome-parecido";

export type AliasSuggestion = {
  productId: string;
  // `null` = o produto é conhecido, a etapa não.
  stageKey: string | null;
  motivo: AliasSuggestionMotivo;
};

export type AliasLookupResult = {
  // Só a EXATA preenche.
  exata: SavedPrintAlias | null;
  // Mais forte primeiro; um produto aparece uma vez só (no motivo mais forte).
  sugestoes: AliasSuggestion[];
};

const LINK_MW = /makerworld\.[a-z.]+\/(?:[a-z-]+\/)?models\/(\d+)/i;

function tokens(nome: string): Set<string> {
  return new Set(nome.split(/[^a-z0-9]+/).filter(Boolean));
}

// Parecido = metade ou mais das palavras em comum (Jaccard). "zipper pull rev
// j" × "zipper pull rev k" = 3/5.
function nomeParecido(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let comum = 0;
  ta.forEach((t) => {
    if (tb.has(t)) comum += 1;
  });
  return comum / (ta.size + tb.size - comum) >= 0.5;
}

export function lookupPrintAlias(
  query: PrintAliasKey,
  aliases: SavedPrintAlias[],
  products: AliasLookupProduct[],
): AliasLookupResult {
  const vazio: AliasLookupResult = { exata: null, sugestoes: [] };
  const chave = normalizeAliasChave(query.fonte, query.chave);
  if (!chave) return vazio;
  const alvo: PrintAliasKey = {
    fonte: query.fonte,
    chave,
    variante: query.variante?.trim() ? query.variante.trim() : null,
    plate: query.plate,
  };

  const porId = new Map(products.map((product) => [product.id, product]));
  const etapaViva = (alias: SavedPrintAlias) =>
    stageKeysOf(porId.get(alias.productId)?.stages).includes(alias.stageKey);
  // Apelido de produto apagado é lixo (a exclusão os leva junto; isto cobre a
  // corrida entre abas) — não preenche nem sugere.
  const vivos = aliases.filter((alias) => porId.has(alias.productId));

  const sugestoes: AliasSuggestion[] = [];
  const vistos = new Set<string>();
  const sugerir = (productId: string, stageKey: string | null, motivo: AliasSuggestionMotivo) => {
    if (vistos.has(productId)) return;
    vistos.add(productId);
    sugestoes.push({ productId, stageKey, motivo });
  };

  const id = aliasDocId(alvo);
  const exataCandidata = vivos.find((alias) => alias.id === id) ?? null;
  let exata: SavedPrintAlias | null = null;
  if (exataCandidata) {
    if (etapaViva(exataCandidata)) exata = exataCandidata;
    else sugerir(exataCandidata.productId, null, "etapa-removida");
  }
  if (exata) vistos.add(exata.productId);

  const mesmaOrigem = (alias: SavedPrintAlias) =>
    alias.fonte === alvo.fonte && alias.chave === alvo.chave;

  // Camada 2 — mesma origem, outra mesa.
  vivos
    .filter((alias) => mesmaOrigem(alias) && alias.variante === alvo.variante && alias.id !== id)
    .forEach((alias) => sugerir(alias.productId, null, "outra-mesa"));

  // O código do produto resolve o PRODUTO mesmo sem apelido gravado.
  if (alvo.fonte === "codigo") {
    products
      .filter((product) => product.codigo === alvo.chave)
      .forEach((product) => sugerir(product.id, null, "codigo"));
  }

  if (alvo.fonte === "mw") {
    // Camada 3 — mesmo design, outra instância.
    vivos
      .filter((alias) => mesmaOrigem(alias) && alias.variante !== alvo.variante)
      .forEach((alias) => sugerir(alias.productId, null, "outra-variante"));
    // Extra — o Link Modelo já traz o designId.
    products
      .filter((product) => LINK_MW.exec(product.linkModel ?? "")?.[1] === alvo.chave)
      .forEach((product) => sugerir(product.id, null, "link-modelo"));
  }

  // Camada 4 — nome de arquivo parecido.
  if (alvo.fonte === "arquivo") {
    vivos
      .filter(
        (alias) =>
          alias.fonte === "arquivo" &&
          alias.chave !== alvo.chave &&
          nomeParecido(alias.chave, alvo.chave),
      )
      .forEach((alias) => sugerir(alias.productId, null, "nome-parecido"));
  }

  return { exata, sugestoes };
}
