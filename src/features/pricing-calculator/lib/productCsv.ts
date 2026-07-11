import { formatDecimal } from "@/lib/formatting/currency";
import type {
  Accessory,
  FixedCostSettings,
  Machine,
  ProductPayload,
  PrintStage,
  RoundingMode,
  SavedProduct,
} from "../types";
import { calculatePricing } from "./calculatePricing";
import { ROUNDING_OPTIONS } from "./roundPrice";

const VALID_ROUNDING_MODES = new Set(
  ROUNDING_OPTIONS.map((option) => option.value),
);

function parseRoundingMode(value: string | undefined): RoundingMode {
  const normalized = String(value ?? "").trim();
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
  "Mao de obra (R$)",
  "Etapas (R$)",
  "Acessorios (R$)",
  "Custo Fixo (R$)",
  "Custo Total (R$)",
  "Preco Sugerido (R$)",
  "Arredondamento",
  "Margem (%)",
  "Markup",
  "Filamento (R$/kg)",
  "Tarifa Energia",
  "Mao de obra (min)",
  "Valor-hora (R$)",
  "Inclui Fixo",
  "Markup no Fixo",
  "Link Modelo",
  "Link Concorrente",
  "Link Arquivo",
  "Etapas JSON",
  "Acessorios JSON",
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
    return {
      name: item.name ?? "",
      machineId: item.machineId ?? fallbackMachineId,
      weightG: Number(item.weightG) || 0,
      printHours: Number(item.printHours) || 0,
      filamentPricePerKg: Number(item.filamentPricePerKg) || 0,
      energyTariff: Number(item.energyTariff) || undefined,
      laborMinutes: Number(item.laborMinutes) || 0,
      laborRate: Number(item.laborRate) || undefined,
    };
  });
}

function parseAccessories(value: string | undefined): Accessory[] {
  return parseJsonArray(value).map((accessory) => {
    const item = accessory as Partial<Accessory>;
    return {
      desc: item.desc ?? "",
      qty: Number(item.qty) || 0,
      unitPrice: Number(item.unitPrice) || 0,
    };
  });
}

function machineNameToId(name: string | undefined, machines: Machine[]): string {
  if (!name) return machines[0]?.id ?? "a1";
  const normalized = name.toLowerCase().trim();
  const exact = machines.find(
    (machine) => machine.name.toLowerCase() === normalized,
  );
  if (exact) return exact.id;
  const fuzzy = machines.find((machine) =>
    normalized.includes(machine.id.toLowerCase()),
  );
  return fuzzy?.id ?? machines[0]?.id ?? "a1";
}

export function exportProductsCsv(
  products: SavedProduct[],
  machines: Machine[],
  fixedCosts: FixedCostSettings,
): string {
  const rows = products.map((product) => {
    const result = calculatePricing(product, machines, fixedCosts);
    const includeFixed = Boolean(product.includeFixed);

    return [
      csvCell(product.name),
      csvCell(product.mainStageName || ""),
      result.machine.name,
      product.weightG,
      product.printHours,
      product.piecesCount || 1,
      formatDecimal(result.materialCost),
      formatDecimal(result.energyCost),
      formatDecimal(result.depreciationCost),
      formatDecimal(result.laborCost),
      formatDecimal(result.stagesCost),
      formatDecimal(result.accessoriesCost),
      formatDecimal(result.fixedCost),
      formatDecimal(result.totalCost),
      formatDecimal(result.suggestedPrice),
      product.roundingMode ?? "exact",
      result.margin.toFixed(1),
      `${product.markup}x`,
      product.filamentPricePerKg,
      product.energyTariff,
      product.laborMinutes,
      product.laborRate,
      includeFixed ? "sim" : "nao",
      product.markupOnFixed ? "sim" : "nao",
      csvCell(product.linkModel || ""),
      csvCell(product.linkCompetitor || ""),
      csvCell(product.linkFile || ""),
      csvCell(JSON.stringify(product.stages || [])),
      csvCell(JSON.stringify(product.accessories || [])),
    ].join(";");
  });

  return `\uFEFF${[CSV_HEADERS.join(";"), ...rows].join("\n")}`;
}

export function parseProductsCsv(
  content: string,
  machines: Machine[],
): ProductPayload[] {
  const normalizedContent = content.replace(/^\uFEFF/, "");
  const rawLines = normalizedContent
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (rawLines.length < 2) return [];

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
  const indexLaborMinutes = findColumn(headers, "mao de obra (min)");
  const indexLaborRate = findColumn(headers, "valor-hora");
  const indexEnergy = findColumn(headers, "tarifa energia");
  const indexIncludeFixed = findColumn(headers, "inclui fixo");
  const indexMarkupFixed = findColumn(headers, "markup no fixo");
  const indexRounding = findColumn(headers, "arredondamento");
  const indexLinkModel = findColumn(headers, "link modelo");
  const indexLinkCompetitor = findColumn(headers, "link concorrente");
  const indexLinkFile = findColumn(headers, "link arquivo");
  const indexStages = findColumn(headers, "etapas json");
  const indexAccessories = findColumn(headers, "acessorios json");

  if (indexName < 0) {
    throw new Error('Coluna "Produto" não encontrada.');
  }

  return rawLines.slice(1).flatMap((line) => {
    const columns = parseLine(line, separator);
    const name = columns[indexName]?.trim();
    if (!name) return [];

    const markupRaw = columns[indexMarkup]?.replace("x", "").trim() ?? "3";
    const machineId = machineNameToId(columns[indexMachine], machines);
    const stages = parseStages(columns[indexStages], machineId);
    const accessories = parseAccessories(columns[indexAccessories]);

    return [
      {
        name,
        mainStageName:
          indexMainName >= 0 ? columns[indexMainName]?.trim() ?? "" : "",
        machineId,
        weightG: parseNumber(columns[indexWeight]),
        printHours: parseNumber(columns[indexTime]),
        piecesCount:
          indexPieces >= 0
            ? Math.max(1, parseNumber(columns[indexPieces]) || 1)
            : 1,
        filamentPricePerKg: parseNumber(columns[indexFilament]),
        energyTariff: indexEnergy >= 0 ? parseNumber(columns[indexEnergy]) : 0.8,
        laborMinutes:
          indexLaborMinutes >= 0 ? parseNumber(columns[indexLaborMinutes]) : 15,
        laborRate: indexLaborRate >= 0 ? parseNumber(columns[indexLaborRate]) : 30,
        markup: Number.parseFloat(markupRaw) || 3,
        includeFixed:
          indexIncludeFixed >= 0 ? parseBool(columns[indexIncludeFixed]) : false,
        markupOnFixed:
          indexMarkupFixed >= 0 ? parseBool(columns[indexMarkupFixed]) : false,
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
        createdAt: Date.now(),
        fixedCostPerHour: null,
        combineEnabled: null,
        stage2: null,
      },
    ];
  });
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
