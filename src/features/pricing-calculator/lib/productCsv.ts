import { formatDecimal } from "@/lib/formatting/currency";
import type {
  Accessory,
  FilamentUsage,
  FixedCostSettings,
  Machine,
  ProductPayload,
  PrintStage,
  RoundingMode,
  SavedProduct,
  StockFilament,
  Subitem,
} from "../types";
import { calculatePricing } from "./calculatePricing";
import {
  filamentsTotalG,
  normalizeFilaments,
  stripFilamentIds,
} from "./filaments";
import { ROUNDING_OPTIONS } from "./roundPrice";
import { DEFAULT_FAILURE_RATE } from "../constants";

const VALID_ROUNDING_MODES = new Set(
  ROUNDING_OPTIONS.map((option) => option.value),
);

function parseRoundingMode(value: string | undefined): RoundingMode {
  // Os modos são tokens numéricos ("0.90", "0.5") escritos com PONTO. Num CSV
  // feito à mão — ou salvo pelo Excel em pt-BR — eles chegam com vírgula, e sem
  // esta troca "0,90" cairia calado em "exact", mudando o preço de tabela.
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");
  return VALID_ROUNDING_MODES.has(normalized as RoundingMode)
    ? (normalized as RoundingMode)
    : "exact";
}

const CSV_HEADERS = [
  "Produto",
  "Nome Etapa Principal",
  "Maquina",
  "Peso (g)",
  "Tempo (h)",
  "Pecas",
  "Material (R$)",
  "Energia (R$)",
  "Desgaste (R$)",
  "Manutencao (R$)",
  "Mao de obra (R$)",
  "Etapas (R$)",
  "Acessorios (R$)",
  "Reserva Falha (R$)",
  "Custo Fixo (R$)",
  "Custo Total (R$)",
  "Preco Sugerido (R$)",
  "Arredondamento",
  "Margem (%)",
  "Markup",
  "Taxa Falha (%)",
  "Filamento (R$/kg)",
  "Tarifa Energia",
  "Mao de obra (min)",
  "Valor-hora (R$)",
  "Inclui Fixo",
  "Link Modelo",
  "Link Concorrente",
  "Link Arquivo",
  "Etapas JSON",
  "Acessorios JSON",
  "Filamentos JSON",
  // FEAT-01 no CSV: as colunas novas vão no FIM. O `findColumn` casa por nome,
  // não por posição, então um CSV exportado antes disto continua importando —
  // sem estas duas o produto entra como só-inteiro, que é o default de sempre.
  "Vende por Subitens",
  "Subitens JSON",
];

function csvCell(value: unknown): string {
  const cell = String(value ?? "");
  if (/[;"\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

function parseLine(line: string, separator: string): string[] {
  const output: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === separator) {
      output.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  output.push(current);
  return output.map((value) => value.trim());
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  let normalized = value.trim();
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) normalized = normalized.replace(/\./g, "").replace(",", ".");
  else if (hasComma) normalized = normalized.replace(",", ".");

  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseBool(value: string | undefined): boolean {
  return String(value ?? "").toLowerCase().trim() === "sim";
}

function findColumn(headers: string[], name: string): number {
  return headers.findIndex((header) =>
    header.toLowerCase().includes(name.toLowerCase()),
  );
}

function parseJsonArray(value: string | undefined): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseStages(value: string | undefined, fallbackMachineId: string): PrintStage[] {
  return parseJsonArray(value).map((stage) => {
    const item = stage as Partial<PrintStage>;
    const base: PrintStage = {
      // FEAT-01: o id é a IDENTIDADE da etapa — os `stageKeys` dos subitens
      // referenciam-no. Descartá-lo aqui faria todo subitem importado nascer
      // apontando para o vazio, então ele vem antes de qualquer outra coisa.
      ...(item.id ? { id: String(item.id) } : {}),
      name: item.name ?? "",
      machineId: item.machineId ?? fallbackMachineId,
      printHours: Number(item.printHours) || 0,
      laborMinutes: Number(item.laborMinutes) || 0,
      // `energyTariff`/`laborRate` da etapa são IGNORADOS de propósito: valem os
      // do produto (colunas "Tarifa Energia" e "Valor-hora"). Um CSV que os
      // traga na etapa não vira override — não há onde editá-los depois, e a
      // produção sempre usou o do produto.
    };
    // FEAT-02: usa as cores quando presentes; senão mantém os escalares legados
    // (migrados no cálculo por `normalizeFilaments`).
    if (Array.isArray(item.filaments) && item.filaments.length > 0) {
      base.filaments = item.filaments as FilamentUsage[];
    } else {
      base.weightG = Number(item.weightG) || 0;
      base.filamentPricePerKg = Number(item.filamentPricePerKg) || 0;
    }
    return base;
  });
}

function parseAccessories(value: string | undefined): Accessory[] {
  return parseJsonArray(value).map((accessory) => {
    const item = accessory as Partial<Accessory>;
    return {
      desc: item.desc ?? "",
      qty: Number(item.qty) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      // 7e: o vínculo com o insumo sobrevive ao round-trip do CSV (o export é
      // JSON puro).
      supplyId: item.supplyId ?? null,
      // FEAT-01: a atribuição a um subitem viaja junto com os subitens — sem
      // ela o custo do acessório volta rateado entre as partes em vez de ir
      // 100% para a que o consome.
      subitemId: item.subitemId ?? null,
    };
  });
}

// FEAT-01: subitens vendáveis. `markup` é OMITIDO quando ausente (herda o do
// produto) — gravar `undefined` faria o Firestore recusar o lote.
function parseSubitems(value: string | undefined): Subitem[] {
  return parseJsonArray(value).flatMap((subitem, index) => {
    const item = subitem as Partial<Subitem>;
    const id = item.id ? String(item.id) : `sub_${index}`;
    const markup = Number(item.markup);
    return [
      {
        id,
        name: item.name ?? "",
        stageKeys: Array.isArray(item.stageKeys)
          ? item.stageKeys.map((key) => String(key))
          : [],
        ...(item.markup !== undefined && markup > 0 ? { markup } : {}),
      },
    ];
  });
}

// Nome da máquina → id. Casa por nome exato e, falhando, pelo id contido no
// nome ("Bambu Lab A1" → `a1`). Quando NADA casa, cai na primeira máquina — e
// avisa: um nome errado no CSV punha o produto na impressora errada em
// silêncio, e energia/desgaste saem de lá (mesma disciplina do TD-009).
function machineNameToId(
  name: string | undefined,
  machines: Machine[],
  onFallback?: (usada: Machine | undefined) => void,
): string {
  const fallback = machines[0];
  if (!name?.trim()) return fallback?.id ?? "a1";
  const normalized = name.toLowerCase().trim();
  const exact = machines.find(
    (machine) => machine.name.toLowerCase() === normalized,
  );
  if (exact) return exact.id;
  const fuzzy = machines.find((machine) =>
    normalized.includes(machine.id.toLowerCase()),
  );
  if (fuzzy) return fuzzy.id;
  onFallback?.(fallback);
  return fallback?.id ?? "a1";
}

export function exportProductsCsv(
  products: SavedProduct[],
  machines: Machine[],
  fixedCosts: FixedCostSettings,
  stock: StockFilament[] = [],
): string {
  const rows = products.map((product) => {
    const result = calculatePricing(product, machines, fixedCosts, stock);
    const includeFixed = Boolean(product.includeFixed);
    // FEAT-02: cores da etapa principal (mono = 1). Os escalares "Peso (g)" e
    // "Filamento (R$/kg)" viram resumo humano; o round-trip exato vai no JSON.
    const mainFilaments = stripFilamentIds(normalizeFilaments(product));
    // As etapas saem NORMALIZADAS, não cruas. Dumpar `product.stages` direto
    // fazia o CSV carregar o lixo inerte dos documentos antigos — 47 das 51
    // etapas ainda trazem `energyTariff`/`laborRate`, que o `parseStages`
    // descarta na volta. Exportar a mesma forma que a importação produz deixa
    // o arquivo da carga em massa autoconsistente: o que sai é o que entra.
    const exportedStages = (product.stages ?? []).map((stage, index) => ({
      id: stage.id ?? `stage_${index}`,
      name: stage.name ?? "",
      machineId: stage.machineId,
      printHours: stage.printHours,
      laborMinutes: stage.laborMinutes,
      filaments: stripFilamentIds(normalizeFilaments(stage)),
    }));

    return [
      csvCell(product.name),
      csvCell(product.mainStageName || ""),
      result.machine.name,
      formatDecimal(filamentsTotalG(mainFilaments)),
      product.printHours,
      product.piecesCount || 1,
      formatDecimal(result.materialCost),
      formatDecimal(result.energyCost),
      formatDecimal(result.depreciationCost),
      formatDecimal(result.maintenanceCost),
      formatDecimal(result.laborCost),
      formatDecimal(result.stagesCost),
      formatDecimal(result.accessoriesCost),
      formatDecimal(result.failureReserve),
      formatDecimal(result.fixedCost),
      formatDecimal(result.totalCost),
      formatDecimal(result.suggestedPrice),
      product.roundingMode ?? "exact",
      result.margin.toFixed(1),
      `${product.markup}x`,
      product.failureRate ?? DEFAULT_FAILURE_RATE,
      mainFilaments[0]?.pricePerKg ?? 0,
      product.energyTariff,
      product.laborMinutes,
      product.laborRate,
      includeFixed ? "sim" : "nao",
      csvCell(product.linkModel || ""),
      csvCell(product.linkCompetitor || ""),
      csvCell(product.linkFile || ""),
      csvCell(JSON.stringify(exportedStages)),
      csvCell(JSON.stringify(product.accessories || [])),
      csvCell(JSON.stringify(mainFilaments)),
      // FEAT-01: a flag vai SEPARADA do array de propósito — desligar a venda
      // por subitens não apaga os subitens salvos, então "desligado com partes
      // guardadas" é um estado real que inferir de `subitems.length` perderia.
      product.sellBySubitems ? "sim" : "nao",
      csvCell(JSON.stringify(product.subitems || [])),
    ].join(";");
  });

  return `\uFEFF${[CSV_HEADERS.join(";"), ...rows].join("\n")}`;
}

// CSV-03: 12 das 34 colunas são CALCULADAS (material, energia, desgaste,
// manutenção, mão de obra, etapas, acessórios, reserva de falha, fixo, custo
// total, preço sugerido, margem) e a importação as ignora — recalcular é a
// única opção correta, porque o preço é consequência das ENTRADAS e da config
// de máquina, que vive num doc compartilhado e pode mudar depois do export.
// Confiar no número exportado deixaria o catálogo com preço velho discordando
// das próprias entradas.
//
// O problema nunca foi recalcular: era o SILÊNCIO. Quem abrisse o CSV no Excel,
// corrigisse o "Preço Sugerido" e reimportasse não recebia aviso nenhum — a
// edição sumia. Isto conta o que foi ignorado, sem bloquear.
export type CsvRecalcNotice = {
  // Linhas cujo preço/custo do arquivo não bate com o recálculo.
  divergentes: number;
  // Linhas que traziam a coluna preenchida (a base da comparação).
  comparadas: number;
  // Até 3 casos concretos, para o dono reconhecer o que aconteceu.
  exemplos: string[];
};

// O que a importação devolve: os produtos e o que ela teve de ADIVINHAR ou
// IGNORAR. Nada disso bloqueia — aparece na confirmação, para o dono decidir
// antes de gravar (TD-009: sinalizar o dado órfão em vez de mascarar).
export type CsvImportResult = {
  products: ProductPayload[];
  // Máquina que não casou: por linha, e ACIONÁVEL (dá pra corrigir o CSV).
  warnings: string[];
  // CSV-03: presente só quando há divergência a contar.
  recalc?: CsvRecalcNotice;
};

// Recalcular exige a taxa de custo fixo e as cores do Estoque — sem elas o
// número não é comparável, e a checagem simplesmente não roda (é o caso dos
// testes de parsing puro, que não têm negócio configurado).
export type CsvParseOptions = {
  fixedCosts: FixedCostSettings;
  stock?: StockFilament[];
};

// Tolerância: o export grava com 2 casas (`formatDecimal`), então até 2 centavos
// é ruído do próprio arredondamento, não edição do dono.
const RECALC_TOLERANCE = 0.02;

function moneyCell(value: string | undefined): number | null {
  const raw = String(value ?? "").trim();
  // Célula ausente/vazia não é divergência — é um CSV enxuto, escrito à mão.
  if (!raw) return null;
  const parsed = parseNumber(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseProductsCsv(
  content: string,
  machines: Machine[],
  options?: CsvParseOptions,
): CsvImportResult {
  const normalizedContent = content.replace(/^\uFEFF/, "");
  const rawLines = normalizedContent
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (rawLines.length < 2) return { products: [], warnings: [] };

  const separator = rawLines[0].includes(";") ? ";" : ",";
  const headers = parseLine(rawLines[0], separator);

  const indexName = findColumn(headers, "produto");
  const indexMainName = findColumn(headers, "nome etapa principal");
  const indexMachine = findColumn(headers, "maquina");
  const indexWeight = findColumn(headers, "peso");
  const indexTime = findColumn(headers, "tempo");
  const indexPieces = findColumn(headers, "pecas");
  const indexFilament = findColumn(headers, "filamento");
  const indexMarkup = findColumn(headers, "markup");
  const indexFailure = findColumn(headers, "taxa falha");
  const indexLaborMinutes = findColumn(headers, "mao de obra (min)");
  const indexLaborRate = findColumn(headers, "valor-hora");
  const indexEnergy = findColumn(headers, "tarifa energia");
  const indexIncludeFixed = findColumn(headers, "inclui fixo");
  const indexRounding = findColumn(headers, "arredondamento");
  const indexLinkModel = findColumn(headers, "link modelo");
  const indexLinkCompetitor = findColumn(headers, "link concorrente");
  const indexLinkFile = findColumn(headers, "link arquivo");
  const indexStages = findColumn(headers, "etapas json");
  const indexAccessories = findColumn(headers, "acessorios json");
  const indexFilaments = findColumn(headers, "filamentos json");
  const indexSellBySubitems = findColumn(headers, "vende por subitens");
  const indexSubitems = findColumn(headers, "subitens json");
  // CSV-03: as duas colunas calculadas que alguém de fato tentaria editar para
  // "definir" o preço. As outras 10 são detalhamento — ninguém mexe no
  // "Desgaste (R$)" esperando mudar o resultado, e avisar sobre 12 colunas ×
  // N linhas viraria parede de texto.
  const indexPrice = findColumn(headers, "preco sugerido");
  const indexTotalCost = findColumn(headers, "custo total");

  if (indexName < 0) {
    throw new Error('Coluna "Produto" não encontrada.');
  }

  const warnings: string[] = [];
  const recalcExemplos: string[] = [];
  let recalcComparadas = 0;
  let recalcDivergentes = 0;

  const products = rawLines.slice(1).flatMap((line, offset) => {
    const columns = parseLine(line, separator);
    const name = columns[indexName]?.trim();
    if (!name) return [];

    const markupRaw = columns[indexMarkup]?.replace("x", "").trim() ?? "3";
    const machineName = columns[indexMachine];
    const machineId = machineNameToId(machineName, machines, (usada) => {
      warnings.push(
        `Linha ${offset + 2} ("${name}"): máquina "${machineName?.trim()}" ` +
          `não encontrada — usando "${usada?.name ?? "a primeira máquina"}".`,
      );
    });
    const stages = parseStages(columns[indexStages], machineId);
    const accessories = parseAccessories(columns[indexAccessories]);
    const subitems =
      indexSubitems >= 0 ? parseSubitems(columns[indexSubitems]) : [];
    // FEAT-02: cores da etapa principal quando o CSV as traz; senão os escalares
    // "Peso (g)"/"Filamento (R$/kg)" migram no cálculo (`normalizeFilaments`).
    const filaments =
      indexFilaments >= 0
        ? (parseJsonArray(columns[indexFilaments]) as FilamentUsage[])
        : [];

    const product: ProductPayload = {
        name,
        mainStageName:
          indexMainName >= 0 ? columns[indexMainName]?.trim() ?? "" : "",
        machineId,
        printHours: parseNumber(columns[indexTime]),
        piecesCount:
          indexPieces >= 0
            ? Math.max(1, parseNumber(columns[indexPieces]) || 1)
            : 1,
        energyTariff: indexEnergy >= 0 ? parseNumber(columns[indexEnergy]) : 0.8,
        laborMinutes:
          indexLaborMinutes >= 0 ? parseNumber(columns[indexLaborMinutes]) : 15,
        laborRate: indexLaborRate >= 0 ? parseNumber(columns[indexLaborRate]) : 30,
        // `parseNumber`, não `parseFloat`: este é o único número do CSV que
        // vinha por parseFloat, e ele PARA na vírgula — "2,8" virava 2, um
        // catálogo inteiro precificado abaixo do devido, sem um aviso.
        markup: parseNumber(markupRaw) || 3,
        failureRate:
          indexFailure >= 0
            ? Math.min(95, Math.max(0, parseNumber(columns[indexFailure])))
            : DEFAULT_FAILURE_RATE,
        includeFixed:
          indexIncludeFixed >= 0 ? parseBool(columns[indexIncludeFixed]) : false,
        roundingMode:
          indexRounding >= 0
            ? parseRoundingMode(columns[indexRounding])
            : "exact",
        linkModel: indexLinkModel >= 0 ? columns[indexLinkModel]?.trim() ?? "" : "",
        linkCompetitor:
          indexLinkCompetitor >= 0
            ? columns[indexLinkCompetitor]?.trim() ?? ""
            : "",
        linkFile: indexLinkFile >= 0 ? columns[indexLinkFile]?.trim() ?? "" : "",
        stages,
        accessories,
        // FEAT-01: o CSV que não traz as colunas de subitem (export antigo, ou
        // carga escrita à mão que só quer o produto inteiro) entra como só-
        // inteiro — o default de sempre.
        sellBySubitems:
          indexSellBySubitems >= 0
            ? parseBool(columns[indexSellBySubitems])
            : false,
        subitems,
        // FEAT-02: com as cores na linha, elas são a fonte da verdade — e os
        // escalares "Peso (g)"/"Filamento (R$/kg)" NÃO entram no documento.
        // Gravá-los junto fazia o produto da carga em massa nascer com os dois
        // campos legados que o formulário parou de persistir (RT-01): inertes
        // no custo, mas uma forma que só sumia ao abrir e salvar o produto.
        // Sem as cores eles são o peso/preço de verdade (CSV escrito à mão) e
        // seguem entrando — é deles que `normalizeFilaments` migra.
        ...(filaments.length > 0
          ? { filaments }
          : {
              weightG: parseNumber(columns[indexWeight]),
              filamentPricePerKg: parseNumber(columns[indexFilament]),
            }),
        createdAt: Date.now(),
        fixedCostPerHour: null,
        combineEnabled: null,
        stage2: null,
    };

    // CSV-03: o que o arquivo AFIRMA × o que o app recalcula. Simétrico ao
    // export (mesma chamada, mesmas máquinas/taxa/estoque), então numa
    // reimportação sem nada ter mudado no meio isto fica em zero — e acende
    // exatamente quando alguém editou a coluna à mão, ou quando a config mudou
    // desde o export (que é a outra coisa que o dono quer saber).
    if (options) {
      const arquivoPreco =
        indexPrice >= 0 ? moneyCell(columns[indexPrice]) : null;
      const arquivoCusto =
        indexTotalCost >= 0 ? moneyCell(columns[indexTotalCost]) : null;

      if (arquivoPreco !== null || arquivoCusto !== null) {
        recalcComparadas += 1;
        const recalculado = calculatePricing(
          product,
          machines,
          options.fixedCosts,
          options.stock ?? [],
        );
        const divergePreco =
          arquivoPreco !== null &&
          Math.abs(arquivoPreco - recalculado.suggestedPrice) > RECALC_TOLERANCE;
        const divergeCusto =
          arquivoCusto !== null &&
          Math.abs(arquivoCusto - recalculado.totalCost) > RECALC_TOLERANCE;

        if (divergePreco || divergeCusto) {
          recalcDivergentes += 1;
          if (recalcExemplos.length < 3) {
            const partes: string[] = [];
            if (divergePreco) {
              partes.push(
                `preço ${formatDecimal(arquivoPreco as number)} → ` +
                  `${formatDecimal(recalculado.suggestedPrice)}`,
              );
            }
            if (divergeCusto) {
              partes.push(
                `custo ${formatDecimal(arquivoCusto as number)} → ` +
                  `${formatDecimal(recalculado.totalCost)}`,
              );
            }
            recalcExemplos.push(
              `Linha ${offset + 2} ("${name}"): ${partes.join(" · ")}`,
            );
          }
        }
      }
    }

    return [product];
  });

  return {
    products,
    warnings,
    ...(recalcDivergentes > 0
      ? {
          recalc: {
            divergentes: recalcDivergentes,
            comparadas: recalcComparadas,
            exemplos: recalcExemplos,
          },
        }
      : {}),
  };
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
