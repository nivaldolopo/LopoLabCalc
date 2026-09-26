import { num } from "@/lib/number";
import { normalizeText } from "@/lib/text";
import { normalizeStages } from "./calculatePricing";
import { machineNameToId } from "./productCsv";
import { ALIAS_FONTES, lookupPrintAlias, stageKeysOf } from "./printAliases";
import { isSafeTaskId, type PrintImageKind } from "./printImages";
import {
  buildProductionPayloads,
  MANUAL_SOURCE,
  nextRowKey,
  planEventRows,
  resolveFilRow,
  scaleRow,
  submissionColors,
  subitemEventRows,
  wholeEventRows,
  type EventRow,
  type FilRow,
  type PlannedRows,
} from "./productionPlan";
import { brandCandidates, maxCandidatePrice } from "./stock";
import { addProductionLayers, submissionEntries } from "./finishedGoods";
import type {
  EventSource,
  FinishedGood,
  FinishedGoodPayload,
  Machine,
  NumbersSource,
  PrintAliasFonte,
  PrintAliasKey,
  PrintFactFilament,
  PrintFacts,
  PrintImages,
  ProductionOutcome,
  ProductionPayload,
  SavedPrintAlias,
  SavedProduct,
  StockFilament,
  SubitemPrice,
  Supply,
} from "../types";

// S6 (lote 5b da 3a) — o "Importar impressões" da /producao: o ARQUIVO DE
// PRODUÇÃO que o `LopoLabPrintPipeline` exporta (fora deste repo) vira eventos.
// Formato definitivo, o MESMO nas fases A e B (seção 3 do
// `.claude/handoff/PEDIDO_PRINTPIPELINE.md`) — este arquivo é a referência dele.
//
// Regras que valem pra tudo aqui (brainstorm, HISTORICO.md):
// · o pipeline entrega FATOS; o site decide o SIGNIFICADO. Por isso a
//   estimativa da cancelada, a soma por cor e a leitura do apelido são daqui —
//   a regra e o comparador têm de ser o mesmo código;
// · grava pelo MESMO caminho do registro manual: `wholeEventRows`/
//   `subitemEventRows` → `planEventRows` → `buildProductionPayloads` →
//   `submissionEntries`/`addProductionLayers`. Nenhuma segunda regra de custo;
// · avisa, não engole (CSV-05/AUD-16): o que não dá pra ler é DESCARTADO com o
//   motivo, nunca vira um valor plausível calado.
//
// 5b = só o modo `historico` (fase A: impressão com `curadoria`). Impressão sem
// curadoria é do dia a dia (fase B) e espera a revisão linha a linha do 5c.
//
// Tudo PURO: quem toca Firestore/Storage é o componente.

export const IMPORT_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// O arquivo, já lido e validado.
// ---------------------------------------------------------------------------

export type ImportStatus = "concluida" | "cancelada" | "falha";
const STATUS_VALIDOS: ImportStatus[] = ["concluida", "cancelada", "falha"];

// Destino decidido no curador (fase A). `teste` e `falha` também contam
// filamento e hora; só `estoque` vira peça pronta.
export type ImportDestino = "historico" | "estoque" | "falha" | "teste";
const DESTINOS_VALIDOS: ImportDestino[] = ["historico", "estoque", "falha", "teste"];

// A cor da lista do SITE (a do "Copiar lista de cores" do /estoque), sem marca.
export type ImportSiteColor = { cor: string; material: string };

export type ImportCuradoria = {
  destino: ImportDestino;
  // O apelido que liga a impressão a produto + etapa (o mesmo que foi no CSV do
  // catálogo). `null` = avulso (não é produto do catálogo).
  apelidoProduto: PrintAliasKey | null;
  unidadesProduzidas: number;
  unidadesCreditadas: number;
  // Impressões com o mesmo valor formam UMA submissão (as mesas de um produto
  // vendido inteiro — decisão do dono, 2026-09-25). `null` = sozinha.
  submissao: string | null;
};

export type ImportPrint = {
  taskId: string;
  at: number; // o `inicio`, em ms
  status: ImportStatus;
  // Os fatos crus, como vão pro evento (`impressao`).
  facts: PrintFacts;
  // Em paralelo a `facts.filamentos`: a cor já traduzida pro site (fase A).
  coresSite: (ImportSiteColor | null)[];
  // Nomes dos arquivos ao lado do JSON (`{task_id}_capa.png`), ou null.
  imagens: { capa: string | null; foto: string | null };
  curadoria: ImportCuradoria | null;
};

export type ImportFile = {
  schemaVersion: number;
  fonte: string;
  geradoEm: string | null;
  impressoes: ImportPrint[];
};

export type ImportDiscard = { taskId: string | null; motivo: string };

export type ImportParseResult =
  | { ok: true; file: ImportFile; descartadas: ImportDiscard[] }
  | { ok: false; erro: string };

// ---------------------------------------------------------------------------
// Leitura estrita — tipo errado é DESCARTE (AUD-16 [E5]), nunca coerção.
// ---------------------------------------------------------------------------

class Descarte extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);
const ausente = (v: unknown) => v === undefined || v === null;

function texto(item: Obj, campo: string): string {
  const v = item[campo];
  if (typeof v !== "string" || !v.trim()) throw new Descarte(`"${campo}" ausente ou não é texto`);
  return v.trim();
}

function textoOuNull(item: Obj, campo: string): string | null {
  const v = item[campo];
  if (ausente(v) || v === "") return null;
  if (typeof v !== "string") throw new Descarte(`"${campo}" não é texto`);
  return v.trim() || null;
}

function numero(item: Obj, campo: string, min = 0): number {
  const v = item[campo];
  if (typeof v !== "number" || !Number.isFinite(v) || v < min) {
    throw new Descarte(`"${campo}" não é um número ≥ ${min}`);
  }
  return v;
}

function numeroOuNull(item: Obj, campo: string): number | null {
  return ausente(item[campo]) ? null : numero(item, campo);
}

function inteiro(item: Obj, campo: string, min: number): number {
  const v = numero(item, campo, min);
  if (!Number.isInteger(v)) throw new Descarte(`"${campo}" não é inteiro`);
  return v;
}

function inteiroOuNull(item: Obj, campo: string): number | null {
  return ausente(item[campo]) ? null : inteiro(item, campo, 0);
}

function booleanoOuNull(item: Obj, campo: string): boolean | null {
  const v = item[campo];
  if (ausente(v)) return null;
  if (typeof v !== "boolean") throw new Descarte(`"${campo}" não é verdadeiro/falso`);
  return v;
}

// O formato é UTC. Sem `Z`/offset, o `Date.parse` lê como hora LOCAL do
// navegador e a impressão da noite cai no dia seguinte — recusa em vez de
// adivinhar o fuso.
const ISO_COM_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

function dataIso(item: Obj, campo: string): number {
  const v = item[campo];
  const ms = typeof v === "string" && ISO_COM_FUSO.test(v.trim()) ? Date.parse(v) : NaN;
  if (!Number.isFinite(ms)) {
    throw new Descarte(`"${campo}" não é uma data ISO com fuso (ex.: 2026-07-01T12:00:00Z)`);
  }
  return ms;
}

function objeto(item: Obj, campo: string): Obj {
  const v = item[campo];
  if (!isObj(v)) throw new Descarte(`"${campo}" não é um objeto`);
  return v;
}

function objetoOuNull(item: Obj, campo: string): Obj | null {
  return ausente(item[campo]) ? null : objeto(item, campo);
}

function lista(item: Obj, campo: string): unknown[] {
  const v = item[campo];
  if (!Array.isArray(v)) throw new Descarte(`"${campo}" não é uma lista`);
  return v;
}

function lerApelido(raw: Obj): PrintAliasKey {
  const fonte = texto(raw, "fonte");
  if (!ALIAS_FONTES.includes(fonte as PrintAliasFonte)) {
    throw new Descarte(`fonte de apelido desconhecida: "${fonte}"`);
  }
  return {
    fonte: fonte as PrintAliasFonte,
    chave: texto(raw, "chave"),
    variante: textoOuNull(raw, "variante"),
    plate: inteiroOuNull(raw, "plate"),
  };
}

function lerFilamento(raw: unknown): { fato: PrintFactFilament; site: ImportSiteColor | null } {
  if (!isObj(raw)) throw new Descarte('item de "filamentos" não é um objeto');
  const cs = objetoOuNull(raw, "cor_site");
  return {
    fato: {
      corCarregada: textoOuNull(raw, "cor_carregada"),
      corPlanejada: textoOuNull(raw, "cor_planejada"),
      material: textoOuNull(raw, "material") ?? "",
      g: numero(raw, "g"),
      ams: inteiroOuNull(raw, "ams"),
      slot: inteiroOuNull(raw, "slot"),
      idNaFonte: textoOuNull(raw, "filament_id_bambu"),
    },
    site: cs ? { cor: texto(cs, "cor"), material: texto(cs, "material") } : null,
  };
}

function lerCuradoria(raw: Obj): ImportCuradoria {
  const destino = texto(raw, "destino");
  if (!DESTINOS_VALIDOS.includes(destino as ImportDestino)) {
    throw new Descarte(`destino desconhecido: "${destino}"`);
  }
  const produzidas = inteiro(raw, "unidades_produzidas", 1);
  const creditadas = ausente(raw.unidades_creditadas)
    ? 0
    : inteiro(raw, "unidades_creditadas", 0);
  if (creditadas > produzidas) {
    throw new Descarte('"unidades_creditadas" maior que "unidades_produzidas"');
  }
  if (creditadas > 0 && destino !== "estoque") {
    throw new Descarte(`unidades creditadas com destino "${destino}" (só "estoque" credita)`);
  }
  const apelido = objetoOuNull(raw, "apelido_produto");
  return {
    destino: destino as ImportDestino,
    apelidoProduto: apelido ? lerApelido(apelido) : null,
    unidadesProduzidas: produzidas,
    unidadesCreditadas: creditadas,
    submissao: textoOuNull(raw, "submissao"),
  };
}

function lerStatusCru(raw: Obj): string | null {
  const v = raw.status_cru;
  if (ausente(v)) return null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string") return v.trim() || null;
  throw new Descarte('"status_cru" não é texto nem número');
}

function lerImpressao(raw: Obj): ImportPrint {
  const taskId = texto(raw, "task_id");
  if (!isSafeTaskId(taskId)) throw new Descarte(`"task_id" com caractere inválido: "${taskId}"`);
  const inicio = dataIso(raw, "inicio");
  const fim = ausente(raw.fim) ? null : dataIso(raw, "fim");
  const statusCru = lerStatusCru(raw);
  const status = texto(raw, "status");
  if (!STATUS_VALIDOS.includes(status as ImportStatus)) {
    // Status novo não vira "concluída" calado (pedido, seção 3).
    throw new Descarte(`status desconhecido: "${status}" (cru: ${statusCru ?? "—"})`);
  }
  const filamentos = lista(raw, "filamentos").map(lerFilamento);
  const objetos = lista(raw, "objetos").map((o) => {
    if (!isObj(o)) throw new Descarte('item de "objetos" não é um objeto');
    return { nome: texto(o, "nome"), qtd: inteiro(o, "qtd", 1) };
  });
  const apelido = objetoOuNull(raw, "apelido");
  const imagens = objetoOuNull(raw, "imagens");
  const curadoria = objetoOuNull(raw, "curadoria");

  return {
    taskId,
    at: inicio,
    status: status as ImportStatus,
    facts: {
      maquina: texto(raw, "maquina"),
      serial: textoOuNull(raw, "serial"),
      inicio,
      fim,
      duracaoPlanoS: numero(raw, "duracao_s"),
      duracaoRelogioS: numeroOuNull(raw, "duracao_relogio_s"),
      status,
      statusCru,
      pesoTotalG: numeroOuNull(raw, "peso_total_g"),
      objetos,
      filamentos: filamentos.map((f) => f.fato),
      // CRU: a chave como veio, sem validar a fonte — é fato, não referência.
      apelido: apelido
        ? {
            fonte: texto(apelido, "fonte"),
            chave: texto(apelido, "chave"),
            variante: textoOuNull(apelido, "variante"),
            plate: inteiroOuNull(apelido, "plate"),
          }
        : null,
      designId: textoOuNull(raw, "design_id"),
      titulo: textoOuNull(raw, "titulo"),
      personalizado: booleanoOuNull(raw, "personalizado"),
    },
    coresSite: filamentos.map((f) => f.site),
    imagens: {
      capa: imagens ? textoOuNull(imagens, "capa") : null,
      foto: imagens ? textoOuNull(imagens, "foto") : null,
    },
    curadoria: curadoria ? lerCuradoria(curadoria) : null,
  };
}

export function parseImportFile(raw: unknown): ImportParseResult {
  if (!isObj(raw)) return { ok: false, erro: "O arquivo não é um objeto JSON." };
  if (raw.schema_version !== IMPORT_SCHEMA_VERSION) {
    return {
      ok: false,
      erro:
        raw.schema_version === undefined
          ? 'O arquivo não tem "schema_version" — é do formato antigo? Exporte de novo pelo pipeline.'
          : `Versão do arquivo ${JSON.stringify(raw.schema_version)} não suportada (este site lê a ${IMPORT_SCHEMA_VERSION}).`,
    };
  }
  if (typeof raw.fonte !== "string" || !raw.fonte.trim()) {
    return { ok: false, erro: 'O arquivo não diz a "fonte" (ex.: "bambu").' };
  }
  if (!Array.isArray(raw.impressoes)) {
    return { ok: false, erro: 'O arquivo não tem a lista "impressoes".' };
  }
  const impressoes: ImportPrint[] = [];
  const descartadas: ImportDiscard[] = [];
  for (const item of raw.impressoes) {
    const taskId =
      isObj(item) && typeof item.task_id === "string" && item.task_id.trim()
        ? item.task_id.trim()
        : null;
    try {
      if (!isObj(item)) throw new Descarte("a impressão não é um objeto");
      impressoes.push(lerImpressao(item));
    } catch (err) {
      if (!(err instanceof Descarte)) throw err;
      descartadas.push({ taskId, motivo: err.message });
    }
  }
  return {
    ok: true,
    file: {
      schemaVersion: IMPORT_SCHEMA_VERSION,
      fonte: raw.fonte.trim(),
      geradoEm: typeof raw.gerado_em === "string" ? raw.gerado_em : null,
      impressoes,
    },
    descartadas,
  };
}

// Idempotência de DENTRO do arquivo: o mesmo `task_id` duas vezes → vale a 1ª.
// (A de fora — já gravado no Firestore — é do componente, por `origemExterna`.)
export function dedupeByTaskId(prints: ImportPrint[]): {
  unicas: ImportPrint[];
  duplicadasNoArquivo: number;
} {
  const vistos = new Set<string>();
  const unicas: ImportPrint[] = [];
  for (const p of prints) {
    if (vistos.has(p.taskId)) continue;
    vistos.add(p.taskId);
    unicas.push(p);
  }
  return { unicas, duplicadasNoArquivo: prints.length - unicas.length };
}

// ---------------------------------------------------------------------------
// Os números da impressão — a regra do SITE, não do pipeline.
// ---------------------------------------------------------------------------

// Concluída/falha: o tempo é o do fatiador (`costTime`), NUNCA o relógio (já
// divergiu 1295%), e as gramas são as medidas. Cancelada: a API só tem o PLANO;
// o consumido é `plano × min(1, relógio ÷ plano)` — o relógio é teto do que
// rodou (inclui aquecimento, então superestima cancelamento precoce; a rede de
// segurança é a contagem física do rolo, D6). Sem relógio, não há como estimar:
// fica o plano inteiro, ainda marcado como estimativa.
// A `falha` da IMPRESSORA (parou sozinha) é o mesmo caso: não terminou, e a API
// só guarda o plano. A "concluída mas descartada" do dono chega como
// `concluida` + destino `falha` — essa tem números medidos.
const naoTerminou = (status: ImportStatus) => status !== "concluida";

export function consumptionFactor(p: Pick<ImportPrint, "status" | "facts">): number {
  if (!naoTerminou(p.status)) return 1;
  const plano = num(p.facts.duracaoPlanoS);
  const relogio = p.facts.duracaoRelogioS;
  if (relogio === null || plano <= 0) return 1;
  return Math.min(1, Math.max(0, relogio / plano));
}

export function numbersSourceOf(p: Pick<ImportPrint, "status">): NumbersSource {
  return naoTerminou(p.status) ? "estimativa" : "impressora";
}

// As cores da impressão → linhas de filamento do evento. Soma por cor do SITE
// (3 cores planejadas podem cair no mesmo slot carregado — 1081441249). Sem
// tradução, a linha leva o hex carregado como nome (cor avulsa, que não casa
// com prateleira nenhuma — por isso `estoque` a recusa). O preço é o do grupo
// cor+material no Estoque (a maior entre as marcas, a regra da precificação);
// sem grupo, o R$/kg padrão do lote.
export function printFilRows(
  p: ImportPrint,
  stock: StockFilament[],
  defaultPricePerKg: number,
  stageKey: string,
): { rows: FilRow[]; precoPadrao: number; semTraducao: number } {
  const fator = consumptionFactor(p);
  const porCor = new Map<string, { colorName: string; material: string; g: number }>();
  let semTraducao = 0;
  p.facts.filamentos.forEach((f, i) => {
    const g = num(f.g) * fator;
    if (g <= 0) return;
    const site = p.coresSite[i];
    if (!site) semTraducao += 1;
    const colorName = site ? site.cor : f.corCarregada ? `#${f.corCarregada}` : "Sem cor";
    const material = site ? site.material : f.material;
    const key = `${normalizeText(material)}::${normalizeText(colorName)}`;
    const atual = porCor.get(key);
    if (atual) atual.g += g;
    else porCor.set(key, { colorName, material, g });
  });
  let precoPadrao = 0;
  const rows = [...porCor.values()].map((c) => {
    if (maxCandidatePrice(brandCandidates(stock, c.colorName, c.material)) <= 0) precoPadrao += 1;
    return resolveFilRow(
      {
        filamentId: null,
        colorName: c.colorName,
        material: c.material,
        pricePerKg: num(defaultPricePerKg),
        totalG: c.g,
      },
      stock,
      stageKey,
    );
  });
  return { rows, precoPadrao, semTraducao };
}

// ---------------------------------------------------------------------------
// Resolução: impressão → produto/etapa → SUBMISSÃO.
// ---------------------------------------------------------------------------

export type ImportContext = {
  machines: Machine[];
  products: SavedProduct[];
  aliases: SavedPrintAlias[];
  stock: StockFilament[];
  supplies: Supply[];
  energyTariff: number;
  // "R$/kg padrão pros materiais sem preço" — decisão de quem importa.
  defaultPricePerKg: number;
  // Os subitens PRECIFICADOS do produto (o rateio do inteiro com partes e as
  // linhas de um subitem) — o mesmo `calculatePricing` da tela.
  subitemPrices: (productId: string) => SubitemPrice[];
};

export type RejectReason =
  | "sem-curadoria"
  | "maquina-nao-reconhecida"
  | "apelido-desconhecido"
  | "submissao-incoerente"
  | "submissao-parcial"
  | "etapa-repetida"
  | "estoque-sem-produto"
  | "estoque-nao-forma-produto"
  | "cor-sem-traducao";

export type RejectedPrint = { taskId: string; reason: RejectReason; detail: string };

export type ResolvedPrint = {
  print: ImportPrint;
  machine: Machine;
  machineFuzzyMatched: boolean;
  product: SavedProduct | null; // null = avulso
  stageKey: string | null;
};

// O que a submissão É, na linguagem do registro manual.
export type SubmissionSelection =
  | { kind: "avulso" }
  | { kind: "whole" }
  | { kind: "subitem"; subitem: SubitemPrice }
  // Etapas que não formam o produto nem uma parte: custo + hora, sem crédito.
  | { kind: "partial" };

export type ResolvedSubmission = {
  prints: ResolvedPrint[]; // em ordem de `at`
  destino: ImportDestino;
  product: SavedProduct | null;
  selection: SubmissionSelection;
  unidadesProduzidas: number;
  unidadesCreditadas: number;
  at: number; // a da ÚLTIMA impressão (quando o conjunto ficou pronto)
};

const OUTCOME_OF: Record<ImportDestino, ProductionOutcome> = {
  historico: "historico",
  estoque: "estoque",
  falha: "falha",
  teste: "teste",
};

// As chaves de etapa na ORDEM das linhas do `wholeEventRows` (que também passa
// pelo `normalizeStages`) — a mesma função que valida o apelido.
function productStageKeys(product: SavedProduct): string[] {
  return stageKeysOf(normalizeStages(product));
}

const mesmoConjunto = (a: string[], b: string[]) =>
  a.length === b.length && a.every((k) => b.includes(k));

function resolvePrint(
  p: ImportPrint,
  ctx: ImportContext,
): { ok: true; r: ResolvedPrint } | { ok: false; rej: RejectedPrint } {
  const rej = (reason: RejectReason, detail: string) =>
    ({ ok: false, rej: { taskId: p.taskId, reason, detail } }) as const;
  if (!p.curadoria) {
    return rej(
      "sem-curadoria",
      "Impressão do dia a dia (sem curadoria) — a revisão linha a linha chega no próximo lote",
    );
  }
  let machineFuzzyMatched = false;
  const machineId = machineNameToId(p.facts.maquina, ctx.machines, undefined, () => {
    machineFuzzyMatched = true;
  });
  const machine = machineId ? ctx.machines.find((m) => m.id === machineId) : undefined;
  if (!machine) {
    return rej("maquina-nao-reconhecida", `Máquina "${p.facts.maquina}" não bate com o cadastro`);
  }
  const key = p.curadoria.apelidoProduto;
  if (!key) {
    return { ok: true, r: { print: p, machine, machineFuzzyMatched, product: null, stageKey: null } };
  }
  // Só a EXATA preenche (regra do S3): sugestão aqui seria palpite gravado.
  const { exata } = lookupPrintAlias(key, ctx.aliases, ctx.products);
  const product = exata ? ctx.products.find((pr) => pr.id === exata.productId) : undefined;
  if (!exata || !product) {
    return rej(
      "apelido-desconhecido",
      `Apelido ${key.fonte}:${key.chave}${key.variante ? `/${key.variante}` : ""}` +
        `${key.plate !== null ? ` mesa ${key.plate}` : ""} não está no catálogo — importe o CSV do catálogo antes`,
    );
  }
  return {
    ok: true,
    r: { print: p, machine, machineFuzzyMatched, product, stageKey: exata.stageKey },
  };
}

// Agrupa por `submissao` e confere a coerência do grupo. Rejeição de grupo
// rejeita TODAS as impressões dele: gravar metade de uma submissão credita o
// que não existe (ou deixa de creditar o que existe). `alreadyImported` é o
// que JÁ está no Firestore — a submissão com parte gravada não entra de novo.
export function resolveSubmissions(
  prints: ImportPrint[],
  ctx: ImportContext,
  alreadyImported: Set<string> = new Set(),
): { submissions: ResolvedSubmission[]; rejected: RejectedPrint[] } {
  const rejected: RejectedPrint[] = [];
  const grupos = new Map<string, ImportPrint[]>();
  for (const p of prints) {
    const chave = p.curadoria?.submissao ? `s:${p.curadoria.submissao}` : `t:${p.taskId}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), p]);
  }

  const submissions: ResolvedSubmission[] = [];
  for (const grupo of grupos.values()) {
    const novas = grupo.filter((p) => !alreadyImported.has(p.taskId));
    if (novas.length === 0) continue; // tudo já gravado: o chamador conta
    const rejeitaGrupo = (reason: RejectReason, detail: string) => {
      for (const p of novas) rejected.push({ taskId: p.taskId, reason, detail });
    };
    if (novas.length < grupo.length) {
      rejeitaGrupo("submissao-parcial", "Parte desta submissão já foi importada antes");
      continue;
    }

    const resolvidas: ResolvedPrint[] = [];
    const falhas: RejectedPrint[] = [];
    for (const p of grupo) {
      const res = resolvePrint(p, ctx);
      if (res.ok) resolvidas.push(res.r);
      else falhas.push(res.rej);
    }
    if (falhas.length > 0) {
      rejected.push(...falhas);
      // O resto do grupo cai junto: a submissão está incompleta.
      for (const r of resolvidas) {
        rejected.push({
          taskId: r.print.taskId,
          reason: "submissao-incoerente",
          detail: "Outra impressão da mesma submissão não pôde ser lida",
        });
      }
      continue;
    }

    const primeira = resolvidas[0];
    const cur = primeira.print.curadoria!;
    const incoerente = resolvidas.some(
      (r) =>
        r.print.curadoria!.destino !== cur.destino ||
        r.product?.id !== primeira.product?.id ||
        r.print.curadoria!.unidadesProduzidas !== cur.unidadesProduzidas ||
        r.print.curadoria!.unidadesCreditadas !== cur.unidadesCreditadas,
    );
    if (incoerente) {
      rejeitaGrupo(
        "submissao-incoerente",
        `Impressões da submissão "${cur.submissao}" com produto, destino ou unidades diferentes`,
      );
      continue;
    }
    const product = primeira.product;
    if (!product && resolvidas.length > 1) {
      rejeitaGrupo("submissao-incoerente", "Avulso não se junta em submissão");
      continue;
    }

    let selection: SubmissionSelection = { kind: "avulso" };
    if (product) {
      const keys = resolvidas.map((r) => r.stageKey!);
      if (new Set(keys).size !== keys.length) {
        rejeitaGrupo("etapa-repetida", "A mesma etapa aparece duas vezes na submissão");
        continue;
      }
      const sub = (product.subitems ?? []).find((s) => mesmoConjunto(s.stageKeys ?? [], keys));
      const subPrice = sub
        ? ctx.subitemPrices(product.id).find((s) => s.id === sub.id)
        : undefined;
      if (mesmoConjunto(productStageKeys(product), keys)) selection = { kind: "whole" };
      else if (subPrice) selection = { kind: "subitem", subitem: subPrice };
      else selection = { kind: "partial" };
    }

    if (cur.destino === "estoque") {
      if (!product) {
        rejeitaGrupo("estoque-sem-produto", 'Destino "estoque" sem produto (avulso não vira peça pronta)');
        continue;
      }
      if (selection.kind === "partial") {
        rejeitaGrupo(
          "estoque-nao-forma-produto",
          "As etapas não formam o produto nem uma parte — junte as mesas numa submissão, " +
            'ou marque como "historico"',
        );
        continue;
      }
      const semCor = resolvidas.some((r) =>
        r.print.facts.filamentos.some((f, i) => num(f.g) > 0 && !r.print.coresSite[i]),
      );
      if (semCor) {
        rejeitaGrupo(
          "cor-sem-traducao",
          "Peça pronta precisa da cor do site em todo filamento (a prateleira é material + cor)",
        );
        continue;
      }
    }

    const ordenadas = [...resolvidas].sort((a, b) => a.print.at - b.print.at);
    submissions.push({
      prints: ordenadas,
      destino: cur.destino,
      product,
      selection,
      unidadesProduzidas: cur.unidadesProduzidas,
      unidadesCreditadas: cur.destino === "estoque" ? cur.unidadesCreditadas : 0,
      at: ordenadas[ordenadas.length - 1].print.at,
    });
  }
  submissions.sort((a, b) => a.at - b.at);
  return { submissions, rejected };
}

// ---------------------------------------------------------------------------
// Custo: as linhas do registro manual, com os FATOS da impressão por cima.
// ---------------------------------------------------------------------------

// As linhas-base (uma por etapa) do que a submissão é, por chave de etapa.
function baseRows(
  sub: ResolvedSubmission,
  product: SavedProduct,
  ctx: ImportContext,
): Map<string, EventRow> {
  const byKey = new Map<string, EventRow>();
  const liveKeys = productStageKeys(product);
  if (sub.selection.kind === "subitem") {
    const subitem = sub.selection.subitem;
    const config = (product.subitems ?? []).find((s) => s.id === subitem.id);
    const rows = subitemEventRows(product, subitem, ctx.stock, ctx.machines, ctx.energyTariff);
    // `subitemEventRows` gera na ordem do `stageKeys` do subitem, pulando as
    // chaves que não existem mais — a mesma filtragem aqui mantém o par.
    const keys = (config?.stageKeys ?? []).filter((k) => liveKeys.includes(k));
    rows.forEach((row, i) => byKey.set(keys[i], row));
    return byKey;
  }
  const rows = wholeEventRows(product, ctx.machines, ctx.stock, ctx.energyTariff);
  liveKeys.forEach((key, i) => {
    // Etapa solta (partial) não forma produto: o acessório é do produto
    // montado, então não sai com ela.
    byKey.set(key, sub.selection.kind === "partial" ? { ...rows[i], supplies: [] } : rows[i]);
  });
  return byKey;
}

export type CostedSubmission = {
  sub: ResolvedSubmission;
  planned: PlannedRows;
  events: { id: string; payload: ProductionPayload }[];
  // As entradas do acabado (null = não credita).
  finishedEntries: ReturnType<typeof submissionEntries> | null;
  precoPadrao: number;
  semTraducao: number;
};

// `imagesOf` decide as `imagens` de cada evento: o componente sabe o que subiu
// e o que já existia no Storage.
export function costSubmission(
  sub: ResolvedSubmission,
  ctx: ImportContext,
  fonte: string,
  genId: () => string,
  now: number,
  imagesOf: (p: ImportPrint) => PrintImages | null,
): CostedSubmission {
  let precoPadrao = 0;
  let semTraducao = 0;
  const product = sub.product;
  const base = product ? baseRows(sub, product, ctx) : null;
  const pieces = product ? Math.max(1, num(product.piecesCount) || 1) : 1;
  // A linha-base é UMA mesa de `piecesCount` peças; a impressão real teve
  // `unidadesProduzidas`. Mão de obra e insumos seguem esse fator (a mesma
  // escala das placas da /producao); horas e gramas são os FATOS.
  const fator = sub.unidadesProduzidas / pieces;

  const rows: EventRow[] = sub.prints.map((r) => {
    const stageKey = r.stageKey ?? "";
    const fil = printFilRows(r.print, ctx.stock, ctx.defaultPricePerKg, stageKey);
    precoPadrao += fil.precoPadrao;
    semTraducao += fil.semTraducao;
    const printHours = (num(r.print.facts.duracaoPlanoS) * consumptionFactor(r.print)) / 3600;
    const row = base?.get(stageKey);
    if (!row) {
      return {
        key: nextRowKey(),
        productName: r.print.facts.titulo || "(sem título)",
        machineId: r.machine.id,
        fleetMachineIds: [],
        printHours,
        filaments: fil.rows,
        laborCost: 0,
        energyTariff: num(ctx.energyTariff),
        supplies: [],
      };
    }
    return { ...scaleRow(row, fator), machineId: r.machine.id, printHours, filaments: fil.rows };
  });

  const planned = planEventRows(rows, "historico", ctx.stock, ctx.supplies, ctx.machines, genId, sub.at);

  const herdado = rows.some((row) => row.laborCost > 0 || row.supplies.length > 0);
  const built = buildProductionPayloads(planned.built, {
    at: sub.at,
    outcome: OUTCOME_OF[sub.destino],
    mode: "historico",
    notes: herdado
      ? "mão de obra e acessórios herdados do cadastro atual do produto, não confirmados para esta impressão"
      : undefined,
    createdAt: now,
    unidadesProduzidas: sub.unidadesProduzidas,
    unidadesCreditadas: sub.unidadesCreditadas,
    source: MANUAL_SOURCE,
  });
  // Cada evento é UMA impressão: a hora e a origem são dela, não da submissão.
  const events = built.map(({ id, payload }, i) => {
    const p = sub.prints[i].print;
    const source: EventSource = {
      origemExterna: { fonte, id: p.taskId },
      fonteDosNumeros: numbersSourceOf(p),
      imagens: imagesOf(p),
      impressao: p.facts,
    };
    return { id, payload: { ...payload, at: p.at, ...source } };
  });

  let finishedEntries: CostedSubmission["finishedEntries"] = null;
  if (sub.destino === "estoque" && product && sub.unidadesCreditadas > 0) {
    const name = product.name || product.mainStageName || "(sem nome)";
    const whole = sub.selection.kind === "whole";
    const subitems = whole ? ctx.subitemPrices(product.id) : [];
    const colors = submissionColors(rows, whole ? (product.subitems ?? []) : []);
    finishedEntries = submissionEntries(name, planned.summary.frozen, {
      ...(sub.selection.kind === "subitem"
        ? { subitemId: sub.selection.subitem.id, subitemName: sub.selection.subitem.name }
        : {}),
      color: colors.whole,
      subitems:
        subitems.length > 0
          ? subitems.map((s) => ({
              id: s.id,
              name: s.name,
              cost: s.cost,
              color: colors.bySubitem.get(s.id),
            }))
          : undefined,
      units: sub.unidadesProduzidas,
      creditedUnits: sub.unidadesCreditadas,
      breakdown: planned.summary.frozenBreakdown,
      machineUsage: planned.summary.machineUsage,
    });
  }

  return { sub, planned, events, finishedEntries, precoPadrao, semTraducao };
}

// ---------------------------------------------------------------------------
// Gravação: o agrupamento em transações.
// ---------------------------------------------------------------------------

export type ImportFinishedUpdate = { productId: string; payload: FinishedGoodPayload };

export type ImportBatch = {
  events: CostedSubmission["events"];
  finished: ImportFinishedUpdate | null;
};

// Uma transação por PRODUTO com crédito (o `saveProduction` grava no máximo UM
// acabado por vez): todos os eventos dele + o acabado com as camadas empilhadas
// em ordem de data (FIFO), partindo do acabado VIVO. Reusa `addProductionLayers`
// — a mesma função da tela manual. O resto (sem crédito) vai em lotes de até
// `max` eventos, e uma submissão NUNCA se parte entre transações (o lote é a
// unidade de exclusão).
export function importBatches(
  costed: CostedSubmission[],
  goods: FinishedGood[],
  max = 300,
): ImportBatch[] {
  const batches: ImportBatch[] = [];
  const porProduto = new Map<string, CostedSubmission[]>();
  for (const c of costed) {
    if (!c.finishedEntries || !c.sub.product) continue;
    porProduto.set(c.sub.product.id, [...(porProduto.get(c.sub.product.id) ?? []), c]);
  }
  for (const [productId, lista] of porProduto) {
    const ordenada = [...lista].sort((a, b) => a.sub.at - b.sub.at);
    const product = ordenada[0].sub.product!;
    const name = product.name || product.mainStageName || "(sem nome)";
    let good: FinishedGood | null = goods.find((g) => g.id === productId) ?? null;
    let payload: FinishedGoodPayload | null = null;
    for (const c of ordenada) {
      payload = addProductionLayers(good, productId, name, c.finishedEntries!, c.events[0].id, c.sub.at);
      good = { ...payload, id: productId };
    }
    batches.push({
      events: ordenada.flatMap((c) => c.events),
      finished: { productId, payload: payload! },
    });
  }

  let atual: CostedSubmission["events"] = [];
  for (const c of costed) {
    if (c.finishedEntries) continue;
    if (atual.length > 0 && atual.length + c.events.length > max) {
      batches.push({ events: atual, finished: null });
      atual = [];
    }
    atual = atual.concat(c.events);
  }
  if (atual.length > 0) batches.push({ events: atual, finished: null });
  return batches;
}

// ---------------------------------------------------------------------------
// A prévia — obrigatória (é lote, a conferência também).
// ---------------------------------------------------------------------------

export type ImportPreview = {
  totalArquivo: number;
  descartadas: ImportDiscard[];
  jaImportadas: number;
  duplicadasNoArquivo: number;
  rejeitadas: RejectedPrint[];
  aImportar: number; // impressões
  submissoes: number;
  porDestino: Record<ImportDestino, number>;
  porMaquina: { machineId: string; machineName: string; impressoes: number; horas: number }[];
  maquinaAproximada: number;
  comProduto: number;
  avulsas: number;
  estimadas: number;
  unidadesCreditadas: number;
  corSemTraducao: number;
  precoPadrao: number;
  periodo: { inicio: number; fim: number } | null;
  imagens: { citadas: number; escolhidas: number };
};

export function buildImportPreview(args: {
  totalArquivo: number;
  descartadas: ImportDiscard[];
  jaImportadas: number;
  duplicadasNoArquivo: number;
  rejeitadas: RejectedPrint[];
  costed: CostedSubmission[];
  imagensEscolhidas: Set<string>; // `${taskId}:${kind}`
}): ImportPreview {
  const porDestino: Record<ImportDestino, number> = { historico: 0, estoque: 0, falha: 0, teste: 0 };
  const porMaquina = new Map<string, ImportPreview["porMaquina"][number]>();
  let maquinaAproximada = 0;
  let comProduto = 0;
  let estimadas = 0;
  let aImportar = 0;
  let inicio = Infinity;
  let fim = -Infinity;
  let citadas = 0;
  let escolhidas = 0;
  for (const c of args.costed) {
    c.sub.prints.forEach((r, i) => {
      aImportar += 1;
      porDestino[c.sub.destino] += 1;
      if (r.machineFuzzyMatched) maquinaAproximada += 1;
      if (c.sub.product) comProduto += 1;
      if (r.print.status === "cancelada") estimadas += 1;
      const horas = num(c.events[i].payload.printHours);
      const m = porMaquina.get(r.machine.id);
      if (m) {
        m.impressoes += 1;
        m.horas += horas;
      } else {
        porMaquina.set(r.machine.id, {
          machineId: r.machine.id,
          machineName: r.machine.name,
          impressoes: 1,
          horas,
        });
      }
      inicio = Math.min(inicio, r.print.at);
      fim = Math.max(fim, r.print.at);
      for (const kind of ["capa", "foto"] as PrintImageKind[]) {
        if (!r.print.imagens[kind]) continue;
        citadas += 1;
        if (args.imagensEscolhidas.has(`${r.print.taskId}:${kind}`)) escolhidas += 1;
      }
    });
  }
  return {
    totalArquivo: args.totalArquivo,
    descartadas: args.descartadas,
    jaImportadas: args.jaImportadas,
    duplicadasNoArquivo: args.duplicadasNoArquivo,
    rejeitadas: args.rejeitadas,
    aImportar,
    submissoes: args.costed.length,
    porDestino,
    porMaquina: [...porMaquina.values()].sort((a, b) => b.horas - a.horas),
    maquinaAproximada,
    comProduto,
    avulsas: aImportar - comProduto,
    estimadas,
    unidadesCreditadas: args.costed.reduce(
      (s, c) => s + (c.finishedEntries ? c.sub.unidadesCreditadas : 0),
      0,
    ),
    corSemTraducao: args.costed.reduce((s, c) => s + c.semTraducao, 0),
    precoPadrao: args.costed.reduce((s, c) => s + c.precoPadrao, 0),
    periodo: aImportar > 0 ? { inicio, fim } : null,
    imagens: { citadas, escolhidas },
  };
}
