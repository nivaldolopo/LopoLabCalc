import { formatDecimal } from "@/lib/formatting/currency";
import { isMilharAmbiguo, parseDecimalPtBr } from "@/lib/formatting/number";
import { normalizeText } from "@/lib/text";
import type {
  Accessory,
  FilamentUsage,
  FixedCostSettings,
  Machine,
  ProductInput,
  ProductPayload,
  PrintStage,
  RoundingMode,
  SavedProduct,
  StockFilament,
  Subitem,
} from "../types";
import { calculatePricing, MAIN_STAGE_KEY } from "./calculatePricing";
import { validateProduct } from "./validateProduct";
import {
  filamentTotalG,
  filamentsTotalG,
  makeFilament,
  normalizeFilaments,
  stripFilamentIds,
} from "./filaments";
import { catalogPricePerKg } from "./stock";
import { ROUNDING_OPTIONS } from "./roundPrice";
import { DEFAULT_FAILURE_RATE } from "../constants";
import { num } from "@/lib/number";

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

/**
 * CSV-04 — texto → REGISTROS, respeitando aspas.
 *
 * Quebrar por `\n` antes de olhar as aspas partia ao meio a linha de um produto
 * cuja célula tivesse quebra de linha (nome colado de outro lugar, observação):
 * nasciam dois produtos-lixo, em silêncio. O export já escapa esses valores com
 * aspas — faltava a volta saber disso. As aspas seguem no texto do registro: é
 * o `parseLine` quem as desfaz.
 */
function splitRecords(content: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (inQuotes) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          current += '""';
          index += 1;
        } else {
          inQuotes = false;
          current += char;
        }
      } else if (char !== "\r") {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      current += char;
    } else if (char === "\n") {
      records.push(current);
      current = "";
    } else if (char !== "\r") {
      current += char;
    }
  }

  records.push(current);
  return records.filter((record) => record.trim().length > 0);
}

// Célula numérica escrita à mão — ou formatada pelo Excel. A leitura em si vive
// em `parseDecimalPtBr` (`lib/formatting/number.ts`), o inverso do
// `formatDecimal`; aqui só se escolhe o comportamento leniente: ilegível vira 0.
// Use nas colunas cujo vazio JÁ significa zero. Onde a diferença entre "vazio" e
// "não consegui ler" importa, use `numFromJson`, que APONTA (CSV-06).
function parseNumber(value: string | undefined): number {
  return parseDecimalPtBr(value) ?? 0;
}

// CSV-06: o número que vem DENTRO de uma célula JSON. Era `Number(x) || 0`, que
// em pt-BR transforma "1,5" em 0 sem mover um músculo — e como 0 é um número
// plausível, nada a jusante desconfia: o produto só nasce mais barato.
//
// Duas diferenças para o `parseNumber`: lê o pt-BR (a primitiva) e, quando não
// consegue ler, CHAMA o `report` em vez de devolver 0 calado. O campo ausente
// (`undefined`) não é erro — é ausência, e cai no zero de sempre.
// O `kind` existe por causa do CSV-12: o mesmo reporter agora carrega duas
// notícias diferentes sobre o mesmo campo — "não consegui ler" e "li, mas o
// ponto pode ser milhar". Quem recebe é que decide a classe de aviso.
type NumIssueKind = "ilegivel" | "milhar";
type NumReporter = (campo: string, bruto: string, kind?: NumIssueKind) => void;

function numFromJson(
  value: unknown,
  campo: string,
  report?: NumReporter,
): number {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = parseDecimalPtBr(value);
  if (parsed === null) {
    report?.(campo, String(value));
    return 0;
  }
  // CSV-12: a checagem de milhar cobria 4 colunas escalares — e é DENTRO do
  // JSON que moram os pesos de verdade do modelo. `"totalG":"1.234"` entrava
  // como 1,234 g (1000× mais leve) sem um aviso, e nem o `cor-sem-peso` pegava,
  // porque 1,234 > 0. Aqui não há a ambiguidade que obrigou o CSV-07 a excluir
  // colunas: no JSON o decimal é escrito com PONTO por quem exporta, mas um
  // número com 3 casas exatas continua sendo o formato de milhar do Excel.
  if (isMilharAmbiguo(value)) report?.(campo, String(value), "milhar");
  return parsed;
}

// CSV-09: a célula de uma coluna ESCALAR. O default só valia quando a coluna
// estava AUSENTE (`index >= 0 ? parseNumber(...) : DEFAULT`); presente, ela caía
// no `parseNumber`, que devolve 0 para vazio e para ilegível — e em
// `Tarifa Energia`, `Valor-hora`, `Mao de obra (min)` e `Taxa Falha` o vazio não
// significa zero, significa 0,8 / 30 / 15 / 3. Medido: a MESMA linha, com essas
// 4 colunas presentes e em branco, saía por R$ 21,24 em vez de R$ 30,10, com
// `warnings: []`. Das 8 colunas, só `Markup` avisava.
//
// A regra passa a tratar igual os dois jeitos de não escrever nada — coluna
// ausente e célula vazia caem no MESMO default — e a célula escrita que não dá
// para ler vira aviso NOMEANDO a coluna, em vez de virar 0 calado. É o CSV-06
// (que fechou isso DENTRO dos JSONs) valendo também fora deles.
function cellNumber(
  raw: string | undefined,
  present: boolean,
  coluna: string,
  fallback: number,
  report: NumReporter,
): number {
  if (!present) return fallback;
  const texto = String(raw ?? "").trim();
  if (!texto) return fallback;
  const parsed = parseDecimalPtBr(texto);
  if (parsed === null) {
    report(coluna, texto);
    return fallback;
  }
  return parsed;
}

// CSV-23: a coluna booleana aceitava EXATAMENTE "sim" — qualquer outra grafia
// virava `false` sem um aviso. A planilha da carga vem de um sistema externo, e
// "TRUE"/"1"/"VERDADEIRO" é o que uma planilha gerada fora escreve: com isso o
// catálogo inteiro nascia sem repassar o custo fixo (medido: R$ 57,98 → 53,22,
// −8,2% por peça) e a margem exibida continuava "normal", porque é calculada
// sobre o custo que ficou. Mesmo formato do `Tempo (min)` da AUD-11 — o
// default calado é o defeito, não a grafia.
//
// Duas metades, como no CSV-09: reconhecer o vocabulário de planilha, E acender
// a classe quando a grafia não estiver em nenhuma das duas listas. Célula VAZIA
// é ausência (cai no default, calada), não grafia desconhecida.
const BOOL_SIM = new Set([
  "sim", "s", "true", "verdadeiro", "v", "1", "x", "yes", "y",
]);
const BOOL_NAO = new Set([
  "nao", "n", "false", "falso", "f", "0", "no", "-",
]);

function parseBool(
  value: string | undefined,
  coluna?: string,
  report?: (coluna: string, bruto: string) => void,
): boolean {
  const texto = normalizeText(String(value ?? ""));
  if (!texto) return false;
  if (BOOL_SIM.has(texto)) return true;
  if (BOOL_NAO.has(texto)) return false;
  if (coluna) report?.(coluna, String(value ?? "").trim());
  return false;
}

// CSV-16: o cabeçalho DIZ a unidade — e era só isso que faltava ler. O needle
// da coluna de tempo é "tempo" e o casamento é `includes`, então "Tempo (min)"
// caía na coluna de HORAS: 120 minutos entravam como 120 HORAS, 60x errado e
// calado. Não é hipótese: a planilha da carga vem de fora, e fatiador e
// impressora reportam o tempo em MINUTOS — depois de "Tempo (h)" é o cabeçalho
// mais provável que existe.
//
// São duas travas. A primeira é a coluna própria `timeMinutes`, com needle mais
// LONGO que "tempo": a ordenação por comprimento do CSV-10 garante que ela
// reclama o cabeçalho antes. A segunda é esta função, para o que o needle não
// pega — "Tempo de impressao (min)" não contém "tempo (min". Quando só a coluna
// de horas casou, o texto dela ainda pode dizer minuto.
//
// `\bmin(utos?)?\b` e não `includes("min")`: "Tempo mínimo" normaliza para
// "tempo minimo", que contém "min" e NÃO é uma coluna de minutos.
function headerEmMinutos(header: string | undefined): boolean {
  return /\bmin(utos?)?\b/.test(normalizeText(header ?? ""));
}

// CSV-16: horas + minutos SOMAM, exatamente como o `PrintTimeField` do
// formulário — é a mesma conta (`h + min / 60`), agora do lado da planilha.
// `Tempo (h)` decimal continua valendo (2,5 = 2 h 30), porque é o que o export
// escreve e o que o round-trip depende.
function printTimeHours(
  horasRaw: string | undefined,
  horasPresente: boolean,
  horasEmMinutos: boolean,
  minutosRaw: string | undefined,
  minutosPresente: boolean,
  report: NumReporter,
): number {
  const primeira = cellNumber(
    horasRaw,
    horasPresente,
    horasEmMinutos ? "Tempo (min)" : "Tempo (h)",
    0,
    report,
  );
  const horas = horasEmMinutos ? primeira / 60 : primeira;
  const minutos = cellNumber(
    minutosRaw,
    minutosPresente,
    "Tempo (min)",
    0,
    report,
  );
  return Math.max(0, horas + minutos / 60);
}

// CSV-02 — cada coluna que a importação LÊ, com o nome exato que o export
// escreve e o pedaço que ainda a reconhece num arquivo escrito à mão.
//
// ⚠ Casar só por `includes` fazia a PRIMEIRA vitória vencer: `"filamento"`
// achava `"Filamentos JSON"` se ela viesse antes de `"Filamento (R$/kg)"` no
// cabeçalho. Como o export fixa a ordem, isso nunca acontecia com o arquivo
// dele mesmo — mas a planilha da carga em massa é escrita fora, e lá a ordem é
// de quem escreve.
const COLUMN_SPECS = {
  name: { exact: "Produto", needle: "produto" },
  mainName: { exact: "Nome Etapa Principal", needle: "nome etapa principal" },
  machine: { exact: "Maquina", needle: "maquina" },
  weight: { exact: "Peso (g)", needle: "peso" },
  time: { exact: "Tempo (h)", needle: "tempo" },
  // CSV-16: needle sem o parêntese de fechar, para pegar também
  // "Tempo (min.)" e "Tempo (minutos)". Com 10 caracteres ele vence
  // "tempo" (5) na passada ordenada por comprimento — ver o CSV-10.
  timeMinutes: { exact: "Tempo (min)", needle: "tempo (min" },
  pieces: { exact: "Pecas", needle: "pecas" },
  filamentPrice: { exact: "Filamento (R$/kg)", needle: "filamento" },
  markup: { exact: "Markup", needle: "markup" },
  failure: { exact: "Taxa Falha (%)", needle: "taxa falha" },
  laborMinutes: { exact: "Mao de obra (min)", needle: "mao de obra (min)" },
  laborRate: { exact: "Valor-hora (R$)", needle: "valor-hora" },
  // CSV-11: needles curtos de propósito — "Tarifa de Energia" e "Inclui custo
  // fixo" (o que uma planilha à mão escreve) não casavam com o needle longo e
  // ainda eram engolidos pela supressão do aviso. Quem impede que "energia"
  // roube a coluna CALCULADA "Energia (R$)" é a `COLUNAS_CALCULADAS`, logo
  // abaixo. Em `includeFixed` o needle é "inclui", não "fixo": "fixo" casaria
  // com qualquer coluna de custo fixo que alguém invente ao lado.
  energy: { exact: "Tarifa Energia", needle: "energia" },
  includeFixed: { exact: "Inclui Fixo", needle: "inclui" },
  rounding: { exact: "Arredondamento", needle: "arredondamento" },
  linkModel: { exact: "Link Modelo", needle: "link modelo" },
  linkCompetitor: { exact: "Link Concorrente", needle: "link concorrente" },
  linkFile: { exact: "Link Arquivo", needle: "link arquivo" },
  stages: { exact: "Etapas JSON", needle: "etapas json" },
  accessories: { exact: "Acessorios JSON", needle: "acessorios json" },
  // CSV-10: needle "filamentos" (não "filamentos json") + a passada por needle
  // ordenada do mais LONGO para o mais curto — assim o cabeçalho abreviado
  // "Filamentos" fica com as cores em vez de ser reclamado por "filamento".
  filaments: { exact: "Filamentos JSON", needle: "filamentos" },
  sellBySubitems: { exact: "Vende por Subitens", needle: "vende por subitens" },
  subitems: { exact: "Subitens JSON", needle: "subitens json" },
  // CSV-03: as duas colunas calculadas que alguém de fato tentaria editar para
  // "definir" o preço. As outras 10 são detalhamento — ninguém mexe no
  // "Desgaste (R$)" esperando mudar o resultado, e avisar sobre 12 colunas ×
  // N linhas viraria parede de texto.
  price: { exact: "Preco Sugerido (R$)", needle: "preco sugerido" },
  totalCost: { exact: "Custo Total (R$)", needle: "custo total" },
} as const;

type ColumnKey = keyof typeof COLUMN_SPECS;

// CSV-11 — as 10 colunas que o export CALCULA e a importação ignora de
// propósito (o preço sai das entradas). Nome EXATO, normalizado.
//
// ⚠ A lista antiga suprimia o aviso "coluna ignorada" por `includes` sobre o
// cabeçalho inteiro, e continha "energia" e "custo fixo" — que também casam com
// os nomes das colunas de ENTRADA "Tarifa de Energia" e "Inclui custo fixo".
// Resultado: elas não eram reconhecidas NEM avisadas. Duplamente caladas.
//
// Ela tem dois usos, e é por causa do primeiro que os needles de `energy` e
// `includeFixed` puderam encurtar: (1) nenhuma delas pode ser capturada por
// needle; (2) só o nome EXATO some do aviso — "Energia (R$/kWh)", que é
// entrada, continua sendo apontada quando não casar com nada.
//
// "Custo Total (R$)" e "Preco Sugerido (R$)" NÃO entram aqui: são calculadas,
// mas a importação as LÊ para conferir divergência (CSV-03).
const COLUNAS_CALCULADAS = [
  "Material (R$)",
  "Energia (R$)",
  "Desgaste (R$)",
  "Manutencao (R$)",
  "Mao de obra (R$)",
  "Etapas (R$)",
  "Acessorios (R$)",
  "Reserva Falha (R$)",
  "Custo Fixo (R$)",
  "Margem (%)",
].map((header) => normalizeText(header).trim());

/**
 * Cabeçalho → índice de cada coluna, em DUAS passadas e sem reaproveitar
 * coluna: primeiro o nome exato (o arquivo do próprio app cai todo aqui),
 * depois o pedaço — pulando o que já foi reclamado. Assim `"Filamentos JSON"`
 * fica com a coluna dela antes de `"filamento"` procurar a sua, em qualquer
 * ordem de cabeçalho. Comparação sem acento e sem caixa: uma planilha à mão
 * escreve "Preço Sugerido", o export escreve "Preco Sugerido".
 */
function resolveColumns(headers: string[]): {
  index: Record<ColumnKey, number>;
  claimed: Set<number>;
  // AUD-11/D-3: as colunas que só casaram por PEDAÇO, com o cabeçalho que
  // reclamaram. Ver o aviso "lidas por aproximação" em `parseProductsCsv`.
  aproximadas: { cabecalho: string; virou: string }[];
} {
  const normalized = headers.map((header) => normalizeText(header).trim());
  const claimed = new Set<number>();
  const aproximadas: { cabecalho: string; virou: string }[] = [];
  const index = {} as Record<ColumnKey, number>;
  const keys = Object.keys(COLUMN_SPECS) as ColumnKey[];

  const take = (found: number, key: ColumnKey) => {
    index[key] = found;
    if (found >= 0) claimed.add(found);
  };

  keys.forEach((key) => {
    const alvo = normalizeText(COLUMN_SPECS[key].exact).trim();
    take(
      normalized.findIndex((header, i) => !claimed.has(i) && header === alvo),
      key,
    );
  });
  keys
    .filter((key) => index[key] < 0)
    // CSV-10: do needle mais LONGO para o mais curto, e não na ordem de
    // declaração. Era a ordem que decidia quem levava um cabeçalho abreviado:
    // "filamento" (o PREÇO, declarado antes) reclamava a coluna "Filamentos" e
    // a lista de cores inteira virava um R$/kg absurdo, sem um aviso. Needle
    // mais longo = mais específico, e é o desempate certo em qualquer par.
    .sort(
      (a, b) => COLUMN_SPECS[b].needle.length - COLUMN_SPECS[a].needle.length,
    )
    .forEach((key) => {
      const needle = normalizeText(COLUMN_SPECS[key].needle).trim();
      const found = normalized.findIndex(
        (header, i) =>
          !claimed.has(i) &&
          // CSV-11: coluna calculada nunca é capturada por needle — é ela que
          // permite o needle curto ("energia" não rouba "Energia (R$)").
          !COLUNAS_CALCULADAS.includes(header) &&
          header.includes(needle),
      );
      take(found, key);
      if (found >= 0) {
        aproximadas.push({
          cabecalho: headers[found].trim(),
          virou: COLUMN_SPECS[key].exact,
        });
      }
    });

  return { index, claimed, aproximadas };
}

// A célula JSON que não parseia vira lista VAZIA — e é justamente esse silêncio
// que engolia etapas/acessórios/subitens inteiros numa planilha escrita à mão
// (aspas internas precisam ir dobradas no CSV). O `ok` existe para a importação
// poder CONTAR o que engoliu; o comportamento em si não muda: uma célula
// quebrada nunca derruba a linha toda.
function parseJsonArraySafe(value: string | undefined): {
  items: unknown[];
  ok: boolean;
} {
  const raw = String(value ?? "").trim();
  if (!raw) return { items: [], ok: true };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { items: parsed, ok: true };
    // JSON válido que não é lista (`{...}` em vez de `[{...}]`) é erro de forma
    // tão silencioso quanto o outro.
    return { items: [], ok: false };
  } catch {
    return { items: [], ok: false };
  }
}

function parseJsonArray(value: string | undefined): unknown[] {
  return parseJsonArraySafe(value).items;
}

// CSV-06: as cores NÃO eram lidas — a linha era `parseJsonArray(...) as
// FilamentUsage[]`, um `as` cru. Um `"totalG":"143,53"` viajava como STRING até
// o Firestore, num campo que o tipo declara `number`. Agora cada campo passa
// pela mesma leitura dos outros três JSONs.
function parseFilaments(
  value: string | undefined,
  onde: string,
  report?: NumReporter,
): FilamentUsage[] {
  return parseJsonArray(value).map((raw) => {
    const item = raw as Partial<FilamentUsage>;
    const campo = (nome: string) => `${onde} → ${nome}`;
    return {
      ...(item.id ? { id: item.id } : {}),
      filamentId: item.filamentId ?? null,
      colorName: item.colorName ?? "",
      pricePerKg: numFromJson(item.pricePerKg, campo("pricePerKg"), report),
      totalG: numFromJson(item.totalG, campo("totalG"), report),
      // Detalhe é OPCIONAL: ausente continua ausente (`makeFilament` distingue
      // "sem detalhamento" de "detalhado com zero" para recalcular o totalG).
      ...(item.modelG !== undefined
        ? { modelG: numFromJson(item.modelG, campo("modelG"), report) }
        : {}),
      ...(item.supportG !== undefined
        ? { supportG: numFromJson(item.supportG, campo("supportG"), report) }
        : {}),
      ...(item.purgedG !== undefined
        ? { purgedG: numFromJson(item.purgedG, campo("purgedG"), report) }
        : {}),
      ...(item.towerG !== undefined
        ? { towerG: numFromJson(item.towerG, campo("towerG"), report) }
        : {}),
    };
  });
}

function parseStages(
  value: string | undefined,
  fallbackMachineId: string,
  report?: NumReporter,
): PrintStage[] {
  return parseJsonArray(value).map((stage, index) => {
    const item = stage as Partial<PrintStage>;
    const campo = (nome: string) => `Etapas JSON — etapa ${index + 2} → ${nome}`;
    const base: PrintStage = {
      // FEAT-01: o id é a IDENTIDADE da etapa — os `stageKeys` dos subitens
      // referenciam-no. Descartá-lo aqui faria todo subitem importado nascer
      // apontando para o vazio, então ele vem antes de qualquer outra coisa.
      ...(item.id ? { id: String(item.id) } : {}),
      name: item.name ?? "",
      machineId: item.machineId ?? fallbackMachineId,
      printHours: numFromJson(item.printHours, campo("printHours"), report),
      laborMinutes: numFromJson(item.laborMinutes, campo("laborMinutes"), report),
      // `energyTariff`/`laborRate` da etapa são IGNORADOS de propósito: valem os
      // do produto (colunas "Tarifa Energia" e "Valor-hora"). Um CSV que os
      // traga na etapa não vira override — não há onde editá-los depois, e a
      // produção sempre usou o do produto.
    };
    // FEAT-02: usa as cores quando presentes; senão mantém os escalares legados
    // (migrados no cálculo por `normalizeFilaments`).
    if (Array.isArray(item.filaments) && item.filaments.length > 0) {
      base.filaments = item.filaments.map((f) => {
        const cor = f as Partial<FilamentUsage>;
        const cf = (nome: string) =>
          `Etapas JSON — etapa ${index + 2}, cor → ${nome}`;
        return {
          ...(cor.id ? { id: cor.id } : {}),
          filamentId: cor.filamentId ?? null,
          colorName: cor.colorName ?? "",
          pricePerKg: numFromJson(cor.pricePerKg, cf("pricePerKg"), report),
          totalG: numFromJson(cor.totalG, cf("totalG"), report),
          ...(cor.modelG !== undefined
            ? { modelG: numFromJson(cor.modelG, cf("modelG"), report) }
            : {}),
          ...(cor.supportG !== undefined
            ? { supportG: numFromJson(cor.supportG, cf("supportG"), report) }
            : {}),
          ...(cor.purgedG !== undefined
            ? { purgedG: numFromJson(cor.purgedG, cf("purgedG"), report) }
            : {}),
          ...(cor.towerG !== undefined
            ? { towerG: numFromJson(cor.towerG, cf("towerG"), report) }
            : {}),
        };
      });
    } else {
      base.weightG = numFromJson(item.weightG, campo("weightG"), report);
      base.filamentPricePerKg = numFromJson(
        item.filamentPricePerKg,
        campo("filamentPricePerKg"),
        report,
      );
    }
    return base;
  });
}

function parseAccessories(
  value: string | undefined,
  report?: NumReporter,
): Accessory[] {
  return parseJsonArray(value).map((accessory, index) => {
    const item = accessory as Partial<Accessory>;
    const campo = (nome: string) =>
      `Acessorios JSON — item ${index + 1} ("${item.desc ?? ""}") → ${nome}`;
    return {
      desc: item.desc ?? "",
      qty: numFromJson(item.qty, campo("qty"), report),
      unitPrice: numFromJson(item.unitPrice, campo("unitPrice"), report),
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
function parseSubitems(
  value: string | undefined,
  report?: NumReporter,
): Subitem[] {
  return parseJsonArray(value).flatMap((subitem, index) => {
    const item = subitem as Partial<Subitem>;
    const id = item.id ? String(item.id) : `sub_${index}`;
    // CSV-06: `Number("2,5")` era NaN, e o `markup > 0` seguinte DESCARTAVA o
    // campo — o subitem herdava o markup do produto sem nada dizer que a
    // planilha pedia outro.
    const markup = numFromJson(
      item.markup,
      `Subitens JSON — "${item.name ?? id}" → markup`,
      report,
    );
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
//
// CSV-24 — o palpite por SUBSTRING também se anuncia agora, e escolhe melhor.
// Ele nunca chamava callback nenhum: só o fracasso TOTAL avisava. Medido,
// "AnyCubic A1 Mini" e "Elegoo Neptune A1" caíam na A1 mudos — e o id `a1` tem
// 2 caracteres, logo cabe dentro de quase qualquer nome de impressora. Como
// `machineMissing` fica `false`, nem o badge ⚠ do catálogo aparecia; a
// diferença A1 × X2D no mesmo produto é R$ 53,22 → 65,13 (+22%), quase tudo
// desgaste. É o padrão 11 (o palpite que não se anuncia) — o casamento
// aproximado continua, virando aviso, como o CSV-10 fez com as colunas.
//
// E o desempate deixa de ser a ordem do array: vence o id MAIS LONGO que couber
// no nome, o mesmo critério do CSV-10 (needle mais longo é o mais específico).
// "Maquina X2D e A1" casava com a1 só porque a1 vem primeiro.
function machineNameToId(
  name: string | undefined,
  machines: Machine[],
  onFallback?: (usada: Machine | undefined) => void,
  onFuzzy?: (usada: Machine) => void,
): string {
  const fallback = machines[0];
  if (!name?.trim()) return fallback?.id ?? "a1";
  const normalized = name.toLowerCase().trim();
  const exact = machines.find(
    (machine) => machine.name.toLowerCase() === normalized,
  );
  if (exact) return exact.id;
  const fuzzy = machines
    .filter((machine) => normalized.includes(machine.id.toLowerCase()))
    .sort((a, b) => b.id.length - a.id.length)[0];
  if (fuzzy) {
    onFuzzy?.(fuzzy);
    return fuzzy.id;
  }
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
// CSV-05: um problema de uma classe, agrupado. A planilha da carga em massa é
// escrita FORA do app, então o erro vem em série — 40 linhas sem `filamentId` é
// um recado, não 40. Por isso conta e mostra até 3 exemplos, como o CSV-03.
export type CsvIssue = {
  // Chave estável da classe do problema (para teste e para React key).
  kind: string;
  // Frase pronta, no plural certo do grupo.
  label: string;
  linhas: number;
  exemplos: string[];
};

export type CsvImportResult = {
  products: ProductPayload[];
  // Máquina que não casou e coluna de cabeçalho ignorada: por linha (ou por
  // arquivo), e ACIONÁVEL (dá pra corrigir o CSV).
  warnings: string[];
  // CSV-03: presente só quando há divergência a contar.
  recalc?: CsvRecalcNotice;
  // CSV-05: presente só quando há o que apontar. Nada aqui bloqueia.
  issues?: CsvIssue[];
};

// Recalcular exige a taxa de custo fixo e as cores do Estoque — sem elas o
// número não é comparável, e a checagem simplesmente não roda (é o caso dos
// testes de parsing puro, que não têm negócio configurado).
export type CsvParseOptions = {
  fixedCosts: FixedCostSettings;
  stock?: StockFilament[];
  // CSV-05: só para CONFERIR referências da planilha — o insumo ligado ao
  // acessório (7e) e o nome já usado no catálogo. Nenhum dos dois entra em
  // cálculo; ausentes, as checagens correspondentes simplesmente não rodam.
  supplies?: { id: string }[];
  existingNames?: string[];
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

// CSV-14 — qual caractere separa as células. Era
// `header.includes(";") ? ";" : ","`, que só enxergava dois candidatos e nunca
// errava para MENOS: qualquer arquivo sem `;` virava CSV de vírgula, e um
// arquivo de TAB caía aí — a linha inteira virava o NOME do produto e todo o
// resto ficava no default, com `warnings: []`.
//
// Contar caractere seria frágil (vírgula dentro de célula citada conta igual),
// então quem decide é o próprio `parseLine`: o separador de verdade é o que
// PARTE o cabeçalho em mais células. Empate fica com `;`, que é o que o export
// escreve — daí a ordem dos candidatos.
function detectSeparator(header: string): {
  separator: string;
  runnerUp: string | null;
} {
  const scored = [";", "\t", ","].map((separator) => ({
    separator,
    cells: parseLine(header, separator).length,
  }));
  const best = scored.reduce((a, b) => (b.cells > a.cells ? b : a));
  // Dois candidatos partindo o mesmo cabeçalho é motivo de aviso, não de
  // adivinhação: o dono precisa saber qual eu usei.
  const rival = scored.find(
    (c) => c.separator !== best.separator && c.cells > 1,
  );
  return { separator: best.separator, runnerUp: rival?.separator ?? null };
}

export function parseProductsCsv(
  content: string,
  machines: Machine[],
  options?: CsvParseOptions,
): CsvImportResult {
  const rawLines = splitRecords(content.replace(/^\uFEFF/, ""));

  if (rawLines.length < 2) return { products: [], warnings: [] };

  const { separator, runnerUp } = detectSeparator(rawLines[0]);
  const headers = parseLine(rawLines[0], separator);

  const { index: col, claimed, aproximadas } = resolveColumns(headers);
  const indexName = col.name;
  const indexMainName = col.mainName;
  const indexMachine = col.machine;
  const indexWeight = col.weight;
  const indexTime = col.time;
  const indexTimeMinutes = col.timeMinutes;
  // CSV-16, a 2a trava: só quando NÃO há coluna de minutos própria — com as
  // duas presentes cada uma já está na sua unidade. Olha o cabeçalho que a
  // coluna de horas de fato reclamou, e não um nome hipotético.
  const tempoEmMinutos =
    indexTimeMinutes < 0 &&
    indexTime >= 0 &&
    headerEmMinutos(headers[indexTime]);
  const indexPieces = col.pieces;
  const indexFilament = col.filamentPrice;
  const indexMarkup = col.markup;
  const indexFailure = col.failure;
  const indexLaborMinutes = col.laborMinutes;
  const indexLaborRate = col.laborRate;
  const indexEnergy = col.energy;
  const indexIncludeFixed = col.includeFixed;
  const indexRounding = col.rounding;
  const indexLinkModel = col.linkModel;
  const indexLinkCompetitor = col.linkCompetitor;
  const indexLinkFile = col.linkFile;
  const indexStages = col.stages;
  const indexAccessories = col.accessories;
  const indexFilaments = col.filaments;
  const indexSellBySubitems = col.sellBySubitems;
  const indexSubitems = col.subitems;
  const indexPrice = col.price;
  const indexTotalCost = col.totalCost;

  if (indexName < 0) {
    throw new Error('Coluna "Produto" não encontrada.');
  }

  const warnings: string[] = [];

  // CSV-14: dois candidatos partem o cabeçalho — digo qual usei em vez de
  // escolher calado. O nome legível existe porque "usei o separador ' '" não
  // ajudaria ninguém.
  const nomeSep = (sep: string) => (sep === "\t" ? "TAB" : `"${sep}"`);
  if (runnerUp) {
    warnings.push(
      `O cabeçalho pode ser lido com ${nomeSep(separator)} ou com ` +
        `${nomeSep(runnerUp)} — usei ${nomeSep(separator)}. Se as colunas ` +
        `saírem trocadas, salve a planilha como "CSV UTF-8" separado por ";".`,
    );
  }

  // Arquivo salvo em ANSI/Windows-1252 e lido como UTF-8: cada acento vira
  // U+FFFD e o nome entra corrompido ("Coração" → "Cora??o"), sem nada quebrar.
  // No Excel pt-BR é o default — "CSV (separado por vírgulas)" grava ANSI; só
  // "CSV UTF-8" grava certo. Reinterpretar os bytes aqui é impossível (eles já
  // se perderam na decodificação), então o que dá para fazer é não deixar
  // passar calado.
  const corrompidos = (content.match(/�/g) ?? []).length;
  if (corrompidos > 0) {
    warnings.push(
      `Acentos corrompidos (${corrompidos} caractere(s) ilegível(is)) — o arquivo ` +
        `parece ter sido salvo em ANSI. Salve de novo como "CSV UTF-8" e reimporte.`,
    );
  }

  const recalcExemplos: string[] = [];
  let recalcComparadas = 0;
  let recalcDivergentes = 0;

  // CSV-05: agrupa por classe, conta todas e guarda até 3 exemplos.
  //
  // CSV-21: `linhas` conta LINHA, não ocorrência. O `+= 1` por chamada fazia uma
  // única linha com 3 células ruins da mesma classe ser reportada como "3
  // linhas" — e é justamente esse número que decide se o dono confirma a carga
  // ou volta pro Excel: "12 linhas com problema" em 100 é uma coisa, 4 linhas
  // com 3 erros cada é outra. O set é zerado a cada linha do laço, logo abaixo.
  // Os EXEMPLOS continuam vindo por ocorrência (até 3): numa linha só eles
  // nomeiam campos diferentes, que é a informação que o dono precisa.
  const issues = new Map<string, CsvIssue>();
  const classesDaLinha = new Set<string>();
  function addIssue(kind: string, label: string, exemplo: string) {
    const found = issues.get(kind) ?? { kind, label, linhas: 0, exemplos: [] };
    if (!classesDaLinha.has(kind)) {
      found.linhas += 1;
      classesDaLinha.add(kind);
    }
    if (found.exemplos.length < 3) found.exemplos.push(exemplo);
    issues.set(kind, found);
  }

  // Coluna cujo nome o `findColumn` não reconheceu passa despercebida — foi
  // assim que "Etapas" (em vez de "Etapas JSON") sumiria sem um pio. As 10
  // colunas calculadas são ignoradas DE PROPÓSITO (o preço sai das entradas),
  // então elas não contam como surpresa.
  // CSV-11: igualdade EXATA contra a `COLUNAS_CALCULADAS`, nunca `includes` —
  // ver o comentário lá em cima para o que o `includes` engolia.
  const ignoradas = headers.filter((header, index) => {
    if (claimed.has(index) || !header.trim()) return false;
    return !COLUNAS_CALCULADAS.includes(normalizeText(header).trim());
  });
  if (ignoradas.length > 0) {
    warnings.push(
      `Coluna(s) ignorada(s) — o nome não foi reconhecido: ` +
        `${ignoradas.map((h) => `"${h}"`).join(", ")}.`,
    );
  }

  // AUD-11/D-3 — o que a passada por PEDAÇO adivinhou.
  //
  // Reconhecer "Peso" como `Peso (g)` é o recurso (CSV-10/CSV-11) e tem de
  // continuar; o defeito era o silêncio quando o palpite estava ERRADO. Com a
  // coluna canônica ausente, a vizinha é reclamada e — por já estar reclamada —
  // some também do aviso "coluna ignorada". Medido: um arquivo só com
  // "Tempo de cura (h)" entrava com `printHours = 11` e `warnings: []`;
  // "Peso do modelo (g)" virava o peso total; "Tempo minimo" virava o tempo.
  //
  // UMA linha por arquivo (não uma por coluna): o palpite certo é o caso comum,
  // e um aviso por coluna viraria ruído em toda planilha escrita à mão. Assim o
  // dono lê a lista de uma vez e o palpite errado salta.
  if (aproximadas.length > 0) {
    warnings.push(
      `Coluna(s) lida(s) por aproximação — confira se o palpite está certo: ` +
        `${aproximadas.map((a) => `"${a.cabecalho}" → ${a.virou}`).join(", ")}.`,
    );
  }

  const nomesVistos = new Set(
    (options?.existingNames ?? []).map((nome) => normalizeText(nome)),
  );
  const estoqueIds = new Set((options?.stock ?? []).map((color) => color.id));
  // CSV-22: id -> cor viva, para cruzar com o `colorName` que a planilha
  // escreveu ao lado dele (ver o bloco 5b, lá embaixo).
  const estoquePorId = new Map(
    (options?.stock ?? []).map((color) => [color.id, color] as const),
  );
  const insumoIds = options?.supplies
    ? new Set(options.supplies.map((supply) => supply.id))
    : null;

  // CSV-15: um só instante de referência para o arquivo inteiro (ver o
  // `createdAt` lá embaixo).
  const importadoEm = Date.now();

  const products = rawLines.slice(1).flatMap((line, offset) => {
    // CSV-21: nova linha, contagem por classe zerada.
    classesDaLinha.clear();
    const columns = parseLine(line, separator);
    const name = columns[indexName]?.trim();
    // CSV-25: a linha sumia sem entrar em contador NENHUM — sem warning, sem
    // issue, sem contagem — e o diálogo mostra o total DEPOIS do descarte.
    // Medido: arquivo com 5 linhas de dado, 3 sem nome → "2 produtos",
    // `warnings: []`. Numa planilha de ~100 linhas gerada fora, uma coluna
    // deslocada ou uma linha de subtotal zeram o nome, e só se descobre
    // contando o catálogo contra a planilha à mão. Linha inteiramente em branco
    // não chega aqui (o `splitRecords` já a descarta), então o que acende é
    // linha COM dado e sem nome — irmã do `celulas-demais`.
    if (!name) {
      // A linha `;;` (só separadores, nenhuma célula com conteúdo) sobrevive ao
      // `splitRecords` — `";;".trim()` não é vazio — e a AUD-09 registrou o
      // silêncio dela como SÃO. Ela é uma linha em branco escrita com
      // separador, não uma linha de dado que perdeu o nome. Quem separa as duas
      // é ter ou não conteúdo em alguma outra célula.
      const preenchidas = columns
        .map((cell) => String(cell ?? "").trim())
        .filter(Boolean);
      if (preenchidas.length > 0) {
        addIssue(
          "linha-sem-nome",
          'Linha com dado mas SEM a coluna "Produto" preenchida — foi ' +
            "descartada e não entrou na contagem de produtos",
          `Linha ${offset + 2}: ${preenchidas.slice(0, 3).join(" | ")}`,
        );
      }
      return [];
    }

    // Declarado aqui em cima, e não junto do bloco CSV-05 lá embaixo, porque o
    // `reportNumero` o lê ao parsear os JSONs — que acontece ANTES (const em
    // zona morta temporal explodiria em ReferenceError).
    const ondeEstou = `Linha ${offset + 2} ("${name}")`;

    // CSV-14, a outra metade: com o separador `,` e decimais pt-BR SEM aspas
    // (`Caneca,2,5,50`), a detecção acerta o separador e ainda assim a linha
    // sai desalinhada — cada vírgula decimal vira uma célula a mais, e o que
    // sobra é descartado em silêncio. Célula A MAIS que o cabeçalho não tem
    // outra explicação plausível, então dá para apontar. A MENOS tem (planilha
    // enxuta, coluna final vazia) e segue calada.
    // Célula vazia sobrando no fim é só um separador a mais no fim da linha —
    // não é desalinhamento, e não vale aviso.
    const uteis = [...columns];
    while (
      uteis.length > headers.length &&
      !String(uteis[uteis.length - 1] ?? "").trim()
    ) {
      uteis.pop();
    }
    if (uteis.length > headers.length) {
      addIssue(
        "celulas-demais",
        `A linha tem mais células do que o cabeçalho — o excedente foi ` +
          `descartado. Com separador ${nomeSep(separator)}, um decimal escrito ` +
          `com vírgula precisa ir entre aspas ("1,5")`,
        `${ondeEstou}: ${uteis.length} células para ${headers.length} colunas`,
      );
    }

    // CSV-26 — o aviso do markup MENTIA sobre o que entrou no documento.
    // Três problemas na mesma checagem, e os três nascem de espremer leitura,
    // default e aviso numa expressão só:
    // · `markup: parseNumber(raw) || 3` — `-2` é TRUTHY, então o `|| 3` nunca
    //   disparava: o documento recebia −2 (preço −R$ 22,59) enquanto o aviso
    //   dizia "a linha entra com 3x";
    // · `"x"` virava string VAZIA no `replace("x", "")` e o guarda `if
    //   (markupRaw && …)` pulava — entrava a 3x sem aviso nenhum;
    // · `"0,5"` entrava a 0,5x (preço R$ 15,31 contra custo R$ 22,89) sem
    //   classe, porque o teste era `<= 0`. Esse foi LIDO certo; o que falta é
    //   dizer que vende abaixo do custo.
    // A separação: `markupCell` é o que a planilha escreveu (para o aviso),
    // `markupRaw` é o que se lê (sem o sufixo "x"), e `markupLido` é o número
    // — `null` quando ilegível. O default só entra onde o valor é inutilizável.
    const markupCell = indexMarkup >= 0 ? columns[indexMarkup]?.trim() ?? "" : "";
    const markupRaw = indexMarkup >= 0 ? markupCell.replace(/x\s*$/i, "").trim() : "3";
    const markupLido = markupRaw ? parseDecimalPtBr(markupRaw) : null;
    const markupUsavel = markupLido !== null && markupLido > 0;
    const markup = markupUsavel ? markupLido : 3;
    const machineName = columns[indexMachine];
    const machineId = machineNameToId(
      machineName,
      machines,
      (usada) => {
        warnings.push(
          `Linha ${offset + 2} ("${name}"): máquina "${machineName?.trim()}" ` +
            `não encontrada — usando "${usada?.name ?? "a primeira máquina"}".`,
        );
      },
      // CSV-24: classe agrupada, e não um `warnings.push` por linha como o
      // fallback acima. O palpite por substring erra em BLOCO — se o sistema
      // externo escrever "AnyCubic A1 Mini", são as 100 linhas de uma vez, e
      // 100 avisos iguais escondem o resto do diálogo.
      (usada) => {
        addIssue(
          "maquina-por-aproximacao",
          "Nome de máquina lido por APROXIMAÇÃO (o id apareceu dentro do " +
            "nome) — confira, porque energia e desgaste saem da máquina " +
            "escolhida",
          `${ondeEstou}: "${machineName?.trim()}" → ${usada.name}`,
        );
      },
    );
    // CSV-06: todo número dentro dos 4 JSONs passa a ser lido em pt-BR, e o que
    // não der para ler vira aviso NOMEANDO o campo — em vez de virar 0 calado.
    const reportNumero: NumReporter = (campo, bruto, kind = "ilegivel") => {
      if (kind === "milhar") {
        // Classe própria, e não a `milhar-ambiguo` das colunas: o conselho é
        // outro. Na coluna a saída é escrever com vírgula decimal; dentro do
        // JSON, onde o decimal já é o ponto, a saída é tirar o ponto.
        addIssue(
          "milhar-ambiguo-json",
          "Número com ponto e 3 casas DENTRO de uma célula JSON foi lido como " +
            'DECIMAL ("1.234" = 1,234) — se era mil duzentos e trinta e quatro, ' +
            "escreva 1234, sem o ponto",
          `${ondeEstou}: ${campo} = "${bruto}" → ${parseDecimalPtBr(bruto)}`,
        );
        return;
      }
      addIssue(
        "numero-nao-reconhecido",
        'Número não reconhecido dentro de uma célula JSON — virou 0. Dentro do JSON o decimal ' +
          'vai com PONTO ("1.5"), não com vírgula',
        `${ondeEstou}: ${campo} = "${bruto}"`,
      );
    };
    // CSV-09: o irmão do de cima, para as colunas escalares. Classe própria
    // porque o conselho é outro — na COLUNA o decimal vai com vírgula, e o que
    // acontece com a linha também é outro: ela fica com o default da coluna, e
    // não com 0.
    const reportColuna: NumReporter = (coluna, bruto) => {
      addIssue(
        "coluna-numero-nao-reconhecido",
        "Coluna numérica com valor ilegível — a linha ficou com o valor PADRÃO " +
          'dessa coluna. Na coluna o decimal vai com vírgula ("1,5")',
        `${ondeEstou}: coluna "${coluna}" = "${bruto}"`,
      );
    };

    // CSV-23: o terceiro irmão dos dois de cima. A coluna booleana com grafia
    // fora das duas listas cai em `false` — e `false` é um valor plausível, que
    // ninguém a jusante desconfia. O conselho é a lista de grafias aceitas,
    // porque o dono não tem como adivinhá-la.
    const reportBool = (coluna: string, bruto: string) => {
      addIssue(
        "booleano-nao-reconhecido",
        'Coluna de sim/não com valor não reconhecido — a linha entra como ' +
          '"não". Aceito: sim, s, true, verdadeiro, v, 1, x (e nao, n, false, ' +
          "falso, f, 0 para negar)",
        `${ondeEstou}: coluna "${coluna}" = "${bruto}"`,
      );
    };

    const stages = parseStages(columns[indexStages], machineId, reportNumero);
    const accessories = parseAccessories(
      columns[indexAccessories],
      reportNumero,
    );
    const subitems =
      indexSubitems >= 0
        ? parseSubitems(columns[indexSubitems], reportNumero)
        : [];
    // FEAT-02: cores da etapa principal quando o CSV as traz; senão os escalares
    // "Peso (g)"/"Filamento (R$/kg)" migram no cálculo (`normalizeFilaments`).
    const filaments =
      indexFilaments >= 0
        ? parseFilaments(
            columns[indexFilaments],
            "Filamentos JSON",
            reportNumero,
          )
        : [];

    const product: ProductPayload = {
        name,
        mainStageName:
          indexMainName >= 0 ? columns[indexMainName]?.trim() ?? "" : "",
        machineId,
        // CSV-09: as 7 colunas escalares passam pelo `cellNumber` — coluna
        // ausente e célula vazia caem no mesmo default, ilegível avisa. O
        // `Markup`, a 8ª, segue logo abaixo com a checagem própria dele.
        // CSV-16: as duas colunas somam, e a de horas ainda é reinterpretada
        // como minutos quando o cabeçalho dela diz minuto.
        printHours: printTimeHours(
          columns[indexTime],
          indexTime >= 0,
          tempoEmMinutos,
          columns[indexTimeMinutes],
          indexTimeMinutes >= 0,
          reportColuna,
        ),
        piecesCount: Math.max(
          1,
          cellNumber(
            columns[indexPieces],
            indexPieces >= 0,
            "Pecas",
            1,
            reportColuna,
          ) || 1,
        ),
        energyTariff: cellNumber(
          columns[indexEnergy],
          indexEnergy >= 0,
          "Tarifa Energia",
          0.8,
          reportColuna,
        ),
        laborMinutes: cellNumber(
          columns[indexLaborMinutes],
          indexLaborMinutes >= 0,
          "Mao de obra (min)",
          15,
          reportColuna,
        ),
        laborRate: cellNumber(
          columns[indexLaborRate],
          indexLaborRate >= 0,
          "Valor-hora (R$)",
          30,
          reportColuna,
        ),
        // `parseNumber`, não `parseFloat`: este é o único número do CSV que
        // vinha por parseFloat, e ele PARA na vírgula — "2,8" virava 2, um
        // catálogo inteiro precificado abaixo do devido, sem um aviso.
        markup,
        failureRate: Math.min(
          95,
          Math.max(
            0,
            cellNumber(
              columns[indexFailure],
              indexFailure >= 0,
              "Taxa Falha (%)",
              DEFAULT_FAILURE_RATE,
              reportColuna,
            ),
          ),
        ),
        includeFixed:
          indexIncludeFixed >= 0
            ? parseBool(columns[indexIncludeFixed], "Inclui Fixo", reportBool)
            : false,
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
            ? parseBool(
                columns[indexSellBySubitems],
                "Vende por Subitens",
                reportBool,
              )
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
              weightG: cellNumber(
                columns[indexWeight],
                indexWeight >= 0,
                "Peso (g)",
                0,
                reportColuna,
              ),
              filamentPricePerKg: cellNumber(
                columns[indexFilament],
                indexFilament >= 0,
                "Filamento (R$/kg)",
                0,
                reportColuna,
              ),
            }),
        // CSV-15: era `Date.now()` por linha, e o parse de 100 produtos leva
        // ~5 ms — medido, a carga inteira nascia com 3 valores distintos, e
        // "Mais recentes"/"Mais antigos" saía arbitrária para o lote todo. O
        // offset da linha dá um instante distinto por produto E preserva a
        // ordem da planilha (linha de baixo = mais recente).
        createdAt: importadoEm + offset,
        fixedCostPerHour: null,
        combineEnabled: null,
        stage2: null,
    };

    // -----------------------------------------------------------------------
    // CSV-05 — o que a linha PERDEU no caminho, dito antes de gravar.
    // Nada aqui bloqueia: a linha entra do mesmo jeito. O que muda é o dono
    // saber ANTES, em vez de descobrir na produção que não deu baixa.
    // -----------------------------------------------------------------------
    // 1) Célula JSON que não parseia — a coluna inteira vira lista vazia.
    ([
      [indexStages, "Etapas JSON"],
      [indexAccessories, "Acessorios JSON"],
      [indexFilaments, "Filamentos JSON"],
      [indexSubitems, "Subitens JSON"],
    ] as const).forEach(([index, coluna]) => {
      if (index < 0) return;
      if (!parseJsonArraySafe(columns[index]).ok) {
        addIssue(
          "json-invalido",
          "JSON inválido — a coluna foi ignorada (aspas internas vão DOBRADAS no CSV)",
          `${ondeEstou}: coluna "${coluna}"`,
        );
      }
    });

    // 2) Arredondamento fora da lista cai em "exact" — e muda o preço final.
    const roundingRaw = indexRounding >= 0 ? columns[indexRounding]?.trim() : "";
    if (
      roundingRaw &&
      !VALID_ROUNDING_MODES.has(roundingRaw.replace(",", ".") as RoundingMode)
    ) {
      addIssue(
        "arredondamento-invalido",
        'Arredondamento não reconhecido — a linha entra como "exact"',
        `${ondeEstou}: "${roundingRaw}"`,
      );
    }

    // 3) Markup inutilizável vira 3x — e agora o texto é verdade: o `markup`
    // lá em cima usa exatamente esta condição, então a linha entra COM 3x.
    // O aviso cita a célula CRUA (`markupCell`), não o resto depois de tirar o
    // "x": era assim que `"x"` aparecia como `""` e o guarda pulava.
    if (markupCell && !markupUsavel) {
      addIssue(
        "markup-invalido",
        "Markup não reconhecido (ou zero/negativo) — a linha entra com 3x",
        `${ondeEstou}: "${markupCell}"`,
      );
    }

    // 3a) Markup LIDO certo, mas menor que 1: o preço sai abaixo do custo. Não
    // é "não reconhecido" — é o número que a planilha pediu —, então classe
    // própria e a linha entra como está. Quem decide vender no prejuízo é o
    // dono; o que não pode é ele não saber.
    if (markupUsavel && markupLido < 1) {
      addIssue(
        "markup-abaixo-de-1",
        "Markup menor que 1x — o preço sai ABAIXO do custo. A linha entra " +
          "assim mesmo",
        `${ondeEstou}: "${markupCell}" → ${markupLido}x`,
      );
    }

    // 3b) A célula que o Excel formatou como MILHAR. "1.234" é lido como 1,234
    // (decimal, que é como o export escreve) — se o dono quis mil duzentos e
    // trinta e quatro, o número entra 1000× menor.
    //
    // CSV-07, os dois lados do erro:
    // · o teste rodava no texto CRU, então "R$ 1.234" NÃO acendia — o prefixo
    //   quebra a âncora `^` do regex. Agora `isMilharAmbiguo` limpa antes.
    // · e acendia à toa em `Tempo (h) = 2.375`, valor que o PRÓPRIO export
    //   escreve. Ler a estrutura não distingue os dois casos: quem distingue é
    //   a coluna. Onde o valor natural JÁ é um decimal pequeno, a leitura de
    //   milhar é absurda (2375 h são 99 dias de impressão; R$1.234/kWh não
    //   existe) e não há ambiguidade a apontar. Nas outras quatro, as duas
    //   leituras são plausíveis — e aí sim vale perguntar.
    //
    // AUD-11/D-4 — `Tempo (min)`, a coluna que o CSV-16 acabou de criar, ficou
    // FORA desta lista, e é a pior ausência possível: o argumento que excluiu
    // `Tempo (h)` era que 1234 h são 99 dias, absurdo. Mas 1234 MINUTOS são
    // 20h37 — um tempo de impressão comum. Medido: `Tempo (min) = "1.234"`
    // entrava como 0,0206 h (1000× menor) com `issues: []`, e o produto ficava
    // com energia, desgaste, manutenção e fixo zerados, aparentando margem
    // normal. A assimetria denunciava o esquecimento: `Mao de obra (min)`, a
    // coluna-irmã em minutos, já estava aqui.
    //
    // `Pecas` entra pelo mesmo motivo: 1,234 peça divide o custo por 1,234 em
    // vez de 1234, e as duas leituras são igualmente estranhas — quem decide é
    // o dono. `Taxa Falha (%)` continua FORA de propósito: ela é clampada em 95
    // logo acima, então a leitura de milhar (2375%) é impossível e não há
    // ambiguidade real a apontar.
    ([
      [indexWeight, "Peso (g)"],
      [indexFilament, "Filamento (R$/kg)"],
      [indexLaborRate, "Valor-hora (R$)"],
      [indexLaborMinutes, "Mao de obra (min)"],
      [indexTimeMinutes, "Tempo (min)"],
      // A 2ª trava do CSV-16 também precisa da checagem: quando NÃO há coluna
      // de minutos própria e o cabeçalho de horas diz minuto, é `indexTime` que
      // carrega os minutos, e a ambiguidade é a mesma.
      [tempoEmMinutos ? indexTime : -1, "Tempo (min)"],
      [indexPieces, "Pecas"],
    ] as const).forEach(([index, coluna]) => {
      if (index < 0) return;
      const bruto = columns[index]?.trim();
      if (bruto && isMilharAmbiguo(bruto)) {
        addIssue(
          "milhar-ambiguo",
          'Número com ponto e 3 casas foi lido como DECIMAL — se era separador de milhar, use vírgula decimal ("1234,00")',
          `${ondeEstou}: coluna "${coluna}" = "${bruto}" → ${parseNumber(bruto)}`,
        );
      }
    });

    // 3c) Lista de cores que existe mas não pesa NADA. É o erro mais caro da
    // planilha escrita à mão — `"totalG":"143,53"` (vírgula dentro do JSON) ou
    // a chave trocada (`weightG`) viram `NaN` → 0, o material zera e o produto
    // nasce a uma fração do preço, sem nada na tela denunciando. O
    // `validateProduct` não pega: lá o peso zero só reprova junto com tempo
    // zero, e toda linha importada tem tempo.
    // ⚠ Roda sobre as cores NORMALIZADAS (`makeFilament`), não sobre as cruas:
    // quando há detalhamento, o `totalG` é RECALCULADO como a soma de
    // model+suporte+purga+torre. Uma cor com `totalG` bom e `modelG` ilegível
    // pesa no array cru e zera depois — conferir o cru deixaria passar
    // exatamente o caso mais caro.
    ([
      [filaments, "Filamentos JSON"] as const,
      ...stages.map(
        (stage, i) =>
          [stage.filaments ?? [], `Etapas JSON — etapa ${i + 2}`] as const,
      ),
    // ⚠ CSV-13: COR A COR, não sobre a soma da lista. `filamentsTotalG(lista)
    // === 0` só acende quando TODAS zeram — em produto multicolor, que é a
    // feature-bandeira do app, uma cor zerada por engano some dentro do peso
    // das outras. Medido: 2 cores, uma com `totalG: 0`, nenhum aviso.
    ]).forEach(([lista, onde]) => {
      lista.map((f) => makeFilament(f)).forEach((cor, i) => {
        if (filamentsTotalG([cor]) !== 0) return;
        const quem = cor.colorName.trim() || `cor ${i + 1}`;
        addIssue(
          "cor-sem-peso",
          "Cor declarada com 0 g — o material fica ZERADO e o preço sai muito abaixo " +
            '(dentro do JSON o número vai com PONTO decimal e a chave do peso é "totalG")',
          `${ondeEstou}: ${onde} — ${quem}`,
        );
      });
    });

    // 3d) AUD-11/D-2 — a cor que PESA mas não CUSTA nada. Gêmeo do `cor-sem-peso`
    // do outro lado da multiplicação: peso × preço, e o CSV-13 só olhava o peso.
    //
    // O caso que motivou: uma cor JÁ CADASTRADA no Estoque mas ainda SEM ROLO.
    // O `catalogPricePerKg` devolve o preço do rolo mais novo — sem rolo, 0 —, e
    // o cálculo cai no `pricePerKg` salvo, que a planilha da carga escreve 0
    // justamente porque "o preço vem do Estoque". As três guardas falham juntas:
    // o `cor-inexistente` não acende (a cor existe), o `filamentMissing` fica
    // FALSE (idem, então nem o badge aparece) e o `cor-sem-peso` olha gramas.
    // Medido, a mesma linha: cor com rolo → material R$ 30,00 e preço R$ 108,43;
    // cor sem rolo → material R$ 0,00 e preço R$ 15,65, com `issues: []`.
    //
    // ⚠ Roda sobre as cores NORMALIZADAS, não sobre as parseadas: é assim que a
    // checagem também pega o caminho ESCALAR (`Peso (g)` preenchido com
    // `Filamento (R$/kg)` vazia), onde o array de cores nem existe.
    //
    // Peso 0 é pulado de propósito — ali quem fala é o `cor-sem-peso`, e duas
    // classes para o mesmo defeito ensinam a ignorar as duas.
    ([
      [
        normalizeFilaments(product),
        // Nomeia a coluna que a linha DE FATO usou: no caminho escalar não há
        // "Filamentos JSON" nenhum, e mandar o dono procurar essa coluna numa
        // planilha que não a tem é pior que não avisar.
        filaments.length > 0 ? "Filamentos JSON" : "Peso (g) / Filamento (R$/kg)",
      ] as const,
      ...stages.map(
        (stage, i) =>
          [normalizeFilaments(stage), `Etapas JSON — etapa ${i + 2}`] as const,
      ),
    ]).forEach(([lista, onde]) => {
      lista.forEach((cor, i) => {
        if (filamentTotalG(cor) <= 0) return;
        // Preço EFETIVO, na mesma ordem que o `resolveFilamentPrices` usa no
        // cálculo: o rolo mais novo manda; sem rolo (ou sem estoque para
        // consultar), vale o que a planilha escreveu.
        const viva = cor.filamentId ? estoquePorId.get(cor.filamentId) : undefined;
        const vivo = viva ? catalogPricePerKg(viva) : 0;
        if (vivo > 0 || num(cor.pricePerKg) > 0) return;
        const quem = cor.colorName.trim() || `cor ${i + 1}`;
        addIssue(
          "cor-sem-preco",
          "Cor com peso mas SEM preço — o material fica ZERADO e o preço sai muito " +
            "abaixo. Se o preço deve vir do Estoque, cadastre um rolo na cor antes " +
            "de importar; senão preencha o preço na planilha",
          `${ondeEstou}: ${onde} — ${quem}` +
            (viva ? ` (cor "${viva.colorName}" existe, mas não tem rolo)` : ""),
        );
      });
    });

    // 4) O vínculo com o Estoque. Cor SEM `filamentId` é avulsa: legítima, mas
    // não dá baixa na produção nem segue o preço vivo do rolo — e é o erro
    // invisível da carga em massa, porque nada na tela a distingue depois.
    const coresDaLinha = [
      ...(filaments ?? []),
      ...stages.flatMap((stage) => stage.filaments ?? []),
    ];
    if (coresDaLinha.length === 0 || coresDaLinha.every((f) => !f.filamentId)) {
      addIssue(
        "cor-avulsa",
        "Filamento AVULSO (sem vínculo com o Estoque): não dá baixa na produção nem segue o preço do rolo",
        ondeEstou,
      );
    }
    // 5) …e o vínculo que aponta para uma cor que não existe.
    if (options?.stock) {
      coresDaLinha.forEach((f) => {
        if (f.filamentId && !estoqueIds.has(f.filamentId)) {
          addIssue(
            "cor-inexistente",
            "Cor do Estoque não encontrada — o filamento entra com o preço salvo",
            `${ondeEstou}: filamentId "${f.filamentId}"`,
          );
          return;
        }
        // 5b) CSV-22: o id CONFERE, e mesmo assim pode ser o id errado. O
        // `filamentId` é um auto-id do Firestore (`4MKTY5K6OGldKp0zDZNB`) —
        // ninguém digita, todo mundo cola, e um paste deslocado ou um PROCV mal
        // ancorado na planilha amarra o produto na cor ERRADA sem que nada
        // acenda: o id existe. Era o último erro silencioso da carga em massa,
        // e o único que a checagem de existência não pega.
        //
        // O nome ao lado é a segunda fonte, e a planilha já o traz (o export
        // escreve os dois). Divergiu, alguma das duas células está errada — e
        // não dá para saber qual, então o parser NÃO escolhe: o id continua
        // valendo (é ele que liga ao Estoque) e o dono decide olhando o aviso.
        const viva = f.filamentId ? estoquePorId.get(f.filamentId) : undefined;
        const naPlanilha = (f.colorName ?? "").trim();
        if (viva && naPlanilha && normalizeText(naPlanilha) !== normalizeText(viva.colorName ?? "")) {
          addIssue(
            "cor-nome-divergente",
            "Nome da cor não bate com o id — vale o ID, confira se não é a cor errada",
            `${ondeEstou}: id "${f.filamentId}" é "${viva.colorName}", ` +
              `a planilha diz "${naPlanilha}"`,
          );
        }
      });
    }

    // 6) Insumo do acessório (7e) apontando para o vazio: sem baixa na produção.
    if (insumoIds) {
      accessories.forEach((accessory) => {
        if (accessory.supplyId && !insumoIds.has(accessory.supplyId)) {
          addIssue(
            "insumo-inexistente",
            "Insumo não encontrado — o acessório entra avulso (sem baixa no estoque)",
            `${ondeEstou}: supplyId "${accessory.supplyId}" em "${accessory.desc}"`,
          );
        }
      });
    }

    // 7) Referências INTERNAS da própria linha: o subitem que aponta para etapa
    // inexistente perde o custo dela, e o acessório que aponta para subitem
    // inexistente volta a ser rateado — os dois em silêncio.
    const chavesDeEtapa = new Set([
      MAIN_STAGE_KEY,
      ...stages.map((stage, index) => stage.id ?? `stage_${index}`),
    ]);
    subitems.forEach((subitem) => {
      subitem.stageKeys.forEach((key) => {
        if (!chavesDeEtapa.has(key)) {
          addIssue(
            "etapa-inexistente",
            'Subitem aponta para etapa que não existe na linha (use "main" ou o `id` de uma etapa)',
            `${ondeEstou}: subitem "${subitem.name || subitem.id}" → "${key}"`,
          );
        }
      });
    });
    const idsDeSubitem = new Set(subitems.map((subitem) => subitem.id));
    accessories.forEach((accessory) => {
      if (accessory.subitemId && !idsDeSubitem.has(accessory.subitemId)) {
        addIssue(
          "subitem-inexistente",
          "Acessório aponta para subitem que não existe na linha — o custo volta rateado",
          `${ondeEstou}: "${accessory.desc}" → "${accessory.subitemId}"`,
        );
      }
    });

    // 8) Nome repetido — no próprio arquivo ou já salvo no catálogo. A
    // importação NÃO substitui: entra um segundo produto com o mesmo nome.
    const nomeNormalizado = normalizeText(name);
    if (nomesVistos.has(nomeNormalizado)) {
      addIssue(
        "nome-duplicado",
        "Nome repetido (no arquivo ou já no catálogo) — entra um produto NOVO, nada é substituído",
        `${ondeEstou}`,
      );
    }
    nomesVistos.add(nomeNormalizado);

    // 9) A mesma validação do formulário. A importação nunca a rodou: linha sem
    // peso E sem tempo entra como produto de custo ~zero.
    const invalido = validateProduct(product as unknown as ProductInput);
    if (invalido) {
      addIssue(
        "linha-invalida",
        "Linha que o formulário recusaria",
        `${ondeEstou}: ${invalido.replace("⚠️ ", "")}`,
      );
    }

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
    ...(issues.size > 0 ? { issues: Array.from(issues.values()) } : {}),
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
