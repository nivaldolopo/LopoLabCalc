import { describe, expect, it } from "vitest";
import { parseProductsCsv, type CsvIssue } from "./productCsv";
import type {
  FixedCostSettings,
  Machine,
  StockFilament,
  Supply,
} from "../types";

// CSV-05 — a planilha da carga em massa é escrita FORA do app. Estes testes
// cobrem o que ela perde no caminho: o que a importação engolia em silêncio
// passa a ser contado e mostrado antes de gravar (nada bloqueia).

const machines: Machine[] = [
  { id: "a1", name: "A1 Combo", price: 3200, lifeHours: 5000, watts: 95, maintenancePerHour: 0.15 },
  { id: "x2d", name: "X2D Combo", price: 9000, lifeHours: 5000, watts: 150, maintenancePerHour: 0.25 },
];
const fixedCosts: FixedCostSettings = {
  enabled: true, rent: 1500, other: 0, machines: 2, hoursDay: 10, daysMonth: 26,
};
const cor = {
  id: "cor_laranja", colorName: "Laranja", material: "PLA", brand: "Bambu",
  minG: 0, archived: false, rolls: [{ id: "r1", pricePerKg: 110, initialG: 1000, createdAt: 1, note: "" }],
  adjustments: [],
} as unknown as StockFilament;
const insumo = { id: "sup_argola", name: "Argola", archived: false } as unknown as Supply;

const opcoes = { fixedCosts, stock: [cor], supplies: [insumo], existingNames: ["Ja existe"] };

// Monta um CSV de 1 linha a partir de pares coluna→valor.
function csv(row: Record<string, string>): string {
  const headers = Object.keys(row);
  const cell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [headers.join(";"), headers.map((h) => cell(row[h])).join(";")].join("\n");
}

const LINHA_BOA: Record<string, string> = {
  Produto: "Caneca",
  Maquina: "A1 Combo",
  "Tempo (h)": "2",
  Markup: "3x",
  "Filamentos JSON": JSON.stringify([
    { filamentId: "cor_laranja", colorName: "Laranja", pricePerKg: 110, totalG: 50 },
  ]),
};

function achar(issues: CsvIssue[] | undefined, kind: string): CsvIssue | undefined {
  return (issues ?? []).find((issue) => issue.kind === kind);
}

// Mesma linha, sem uma das colunas — sem deixar binding morto no destructuring.
function sem(row: Record<string, string>, ...colunas: string[]): Record<string, string> {
  const out = { ...row };
  for (const coluna of colunas) delete out[coluna];
  return out;
}

describe("CSV-05 — a importação conta o que engoliu", () => {
  it("linha correta e ligada ao Estoque: nenhum apontamento", () => {
    const r = parseProductsCsv(csv(LINHA_BOA), machines, opcoes);
    expect(r.issues).toBeUndefined();
    expect(r.warnings).toEqual([]);
    expect(r.products).toHaveLength(1);
  });

  it("JSON quebrado: a coluna some, e agora isso é dito", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Etapas JSON": '[{"name":"Tampa",]' }),
      machines,
      opcoes,
    );
    const issue = achar(r.issues, "json-invalido");
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos[0]).toContain("Etapas JSON");
    // O comportamento não muda: a linha entra, sem a etapa.
    expect(r.products[0].stages).toEqual([]);
  });

  it("JSON válido que não é lista também conta", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Acessorios JSON": '{"desc":"Argola"}' }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "json-invalido")?.linhas).toBe(1);
  });

  it("filamento avulso (sem `filamentId`) é apontado — é o erro invisível", () => {
    const semId = csv({
      ...LINHA_BOA,
      "Filamentos JSON": JSON.stringify([{ colorName: "Laranja", pricePerKg: 110, totalG: 50 }]),
    });
    expect(achar(parseProductsCsv(semId, machines, opcoes).issues, "cor-avulsa")?.linhas).toBe(1);

    // O atalho dos escalares (sem a coluna JSON) também é avulso.
    const escalares = csv({
      Produto: "Chaveiro", Maquina: "A1 Combo", "Peso (g)": "40",
      "Tempo (h)": "2", "Filamento (R$/kg)": "110", Markup: "3",
    });
    expect(achar(parseProductsCsv(escalares, machines, opcoes).issues, "cor-avulsa")?.linhas).toBe(1);
  });

  it("`filamentId` que não existe no Estoque é apontado", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": JSON.stringify([
          { filamentId: "cor_que_nao_existe", colorName: "X", pricePerKg: 110, totalG: 50 },
        ]),
      }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "cor-inexistente")?.linhas).toBe(1);
    // …e não é confundido com avulso.
    expect(achar(r.issues, "cor-avulsa")).toBeUndefined();
  });

  it("`supplyId` inexistente é apontado; o que existe, não", () => {
    const acessorio = (supplyId: string) =>
      csv({
        ...LINHA_BOA,
        "Acessorios JSON": JSON.stringify([
          { desc: "Argola", qty: 1, unitPrice: 0.4, supplyId, subitemId: null },
        ]),
      });
    expect(
      achar(parseProductsCsv(acessorio("sup_fantasma"), machines, opcoes).issues, "insumo-inexistente")
        ?.linhas,
    ).toBe(1);
    expect(
      achar(parseProductsCsv(acessorio("sup_argola"), machines, opcoes).issues, "insumo-inexistente"),
    ).toBeUndefined();
  });

  it("subitem apontando para etapa inexistente, e acessório para subitem inexistente", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Etapas JSON": JSON.stringify([
          { id: "st_1", name: "Tampa", machineId: "a1", printHours: 1, laborMinutes: 0 },
        ]),
        "Vende por Subitens": "sim",
        "Subitens JSON": JSON.stringify([
          { id: "sub_1", name: "Corpo", stageKeys: ["main", "stage_0"] },
        ]),
        "Acessorios JSON": JSON.stringify([
          { desc: "Ima", qty: 1, unitPrice: 1, supplyId: null, subitemId: "sub_fantasma" },
        ]),
      }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "etapa-inexistente")?.linhas).toBe(1);
    expect(achar(r.issues, "etapa-inexistente")?.exemplos[0]).toContain("stage_0");
    expect(achar(r.issues, "subitem-inexistente")?.linhas).toBe(1);
  });

  it("arredondamento e markup ilegíveis são apontados", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Arredondamento: "psicologico", Markup: "tresx" }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "arredondamento-invalido")?.linhas).toBe(1);
    expect(achar(r.issues, "markup-invalido")?.linhas).toBe(1);
    // O fallback continua o mesmo — apontar não é bloquear.
    expect(r.products[0].roundingMode).toBe("exact");
    expect(r.products[0].markup).toBe(3);
  });

  it("nome repetido — no arquivo e contra o catálogo", () => {
    const duasLinhas = [
      "Produto;Maquina;Peso (g);Tempo (h);Markup",
      "Caneca;A1 Combo;40;2;3",
      "caneca;A1 Combo;40;2;3",
    ].join("\n");
    expect(achar(parseProductsCsv(duasLinhas, machines, opcoes).issues, "nome-duplicado")?.linhas).toBe(1);

    const contraCatalogo = csv({ ...LINHA_BOA, Produto: "JA EXISTE" });
    expect(achar(parseProductsCsv(contraCatalogo, machines, opcoes).issues, "nome-duplicado")?.linhas).toBe(1);
  });

  it("linha que o formulário recusaria (sem peso e sem tempo)", () => {
    const r = parseProductsCsv(
      csv({ Produto: "Vazio", Maquina: "A1 Combo", "Peso (g)": "0", "Tempo (h)": "0", Markup: "3" }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "linha-invalida")?.exemplos[0]).toContain("peso");
  });

  it("coluna com nome não reconhecido vira aviso — as CALCULADAS não", () => {
    const comTypo = parseProductsCsv(
      csv({ ...LINHA_BOA, Etapas: "[]", Observacao: "qualquer coisa" }),
      machines,
      opcoes,
    );
    expect(comTypo.warnings).toHaveLength(1);
    expect(comTypo.warnings[0]).toContain('"Etapas"');
    expect(comTypo.warnings[0]).toContain('"Observacao"');

    const calculadas = parseProductsCsv(
      csv({ ...LINHA_BOA, "Material (R$)": "4,01", "Margem (%)": "60", "Desgaste (R$)": "1,00" }),
      machines,
      opcoes,
    );
    expect(calculadas.warnings).toEqual([]);
  });

  it("conta TODAS as linhas, mostra no máximo 3 exemplos", () => {
    const linhas = Array.from({ length: 5 }, (_, i) => `Produto ${i};A1 Combo;40;2;3`);
    const arquivo = ["Produto;Maquina;Peso (g);Tempo (h);Markup", ...linhas].join("\n");
    const issue = achar(parseProductsCsv(arquivo, machines, opcoes).issues, "cor-avulsa");
    expect(issue?.linhas).toBe(5);
    expect(issue?.exemplos).toHaveLength(3);
  });

  it("sem opções (parsing puro) as checagens que dependem de dado externo não rodam", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": JSON.stringify([
          { filamentId: "cor_que_nao_existe", colorName: "X", pricePerKg: 110, totalG: 50 },
        ]),
      }),
      machines,
    );
    expect(achar(r.issues, "cor-inexistente")).toBeUndefined();
    expect(achar(r.issues, "insumo-inexistente")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Auditoria da entrada de dados (2026-08-22) — as três formas de a planilha
// escrita à mão errar SEM fazer barulho, medidas antes de existir a checagem.
// ---------------------------------------------------------------------------
describe("auditoria — número da célula", () => {
  const casos: Array<[string, string, number]> = [
    ["ponto decimal (o que o export escreve)", "118.90", 118.9],
    ["vírgula decimal", "118,90", 118.9],
    ["milhar pt-BR completo", "1.234,56", 1234.56],
    ["moeda colada", "R$ 118,90", 118.9],
    ["moeda sem espaço", "R$118,90", 118.9],
    ["espaço como milhar", "1 234,56", 1234.56],
    ["espaço não-separável como milhar", "1 234,56", 1234.56],
    ["percentual colado", "7%", 7],
    ["sobra só lixo", "R$ --", 0],
  ];
  casos.forEach(([nome, celula, esperado]) => {
    it(`"${celula}" (${nome}) → ${esperado}`, () => {
      const r = parseProductsCsv(
        csv({ ...LINHA_BOA, "Filamento (R$/kg)": celula, "Filamentos JSON": "" }),
        machines,
        opcoes,
      );
      expect(r.products[0].filamentPricePerKg).toBe(esperado);
    });
  });

  it('"1.234" segue DECIMAL (round-trip do export) mas é apontado', () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Peso (g)": "1.234", "Filamentos JSON": "" }),
      machines,
      opcoes,
    );
    expect(r.products[0].weightG).toBe(1.234);
    const issue = achar(r.issues, "milhar-ambiguo");
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos[0]).toContain("Peso (g)");
  });

  it("número comum não vira apontamento de milhar", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Peso (g)": "40", "Tempo (h)": "2.5" }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "milhar-ambiguo")).toBeUndefined();
  });
});

describe("auditoria — cor declarada que não pesa nada", () => {
  // CSV-06: "decimal com vírgula dentro do JSON" SAIU desta lista — a vírgula
  // pt-BR passou a ser lida, então "50,5" pesa 50,5 g e não há o que apontar.
  // A cobertura dela virou o bloco de paridade vírgula/ponto mais abaixo.
  const semPeso: Array<[string, unknown]> = [
    ["chave errada (weightG)", { filamentId: "cor_laranja", colorName: "L", pricePerKg: 110, weightG: 50 }],
    ["sem o peso", { filamentId: "cor_laranja", colorName: "L", pricePerKg: 110 }],
    ["peso zero explícito", { filamentId: "cor_laranja", colorName: "L", pricePerKg: 110, totalG: 0 }],
  ];
  semPeso.forEach(([nome, entrada]) => {
    it(nome, () => {
      const r = parseProductsCsv(
        csv({ ...LINHA_BOA, "Filamentos JSON": JSON.stringify([entrada]) }),
        machines,
        opcoes,
      );
      const issue = achar(r.issues, "cor-sem-peso");
      expect(issue?.linhas).toBe(1);
      expect(issue?.exemplos[0]).toContain("Filamentos JSON");
    });
  });

  it("número como STRING com ponto é válido e não aponta", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": JSON.stringify([
          { filamentId: "cor_laranja", colorName: "L", pricePerKg: 110, totalG: "50.5" },
        ]),
      }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "cor-sem-peso")).toBeUndefined();
  });

  it("etapa com cor sem peso também é apontada, pela etapa certa", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Etapas JSON": JSON.stringify([
          {
            id: "s1", name: "Tampa", machineId: "a1", printHours: 1, laborMinutes: 5,
            filaments: [{ filamentId: null, colorName: "X", pricePerKg: 90, totalG: 0 }],
          },
        ]),
      }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "cor-sem-peso")?.exemplos[0]).toContain("etapa 2");
  });

  // CSV-06: o caso mais caro da planilha à mão, e o que a checagem no array CRU
  // deixava passar. `totalG` bom + `modelG` ilegível: no cru a cor pesa 143,53,
  // mas `makeFilament` recalcula o total como a SOMA do detalhe — que zerou. Só
  // conferindo a cor normalizada isto aparece.
  it("totalG válido com detalhe ILEGÍVEL é apontado (o cru mentia)", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": JSON.stringify([
          { filamentId: "cor_laranja", colorName: "L", pricePerKg: 110, totalG: 143.53, modelG: "cento e quarenta" },
        ]),
      }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "cor-sem-peso")?.linhas).toBe(1);
    expect(achar(r.issues, "numero-nao-reconhecido")?.exemplos[0]).toContain("modelG");
  });

  it("etapa SEM cor nenhuma (só mão de obra) não é apontada", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Etapas JSON": JSON.stringify([
          { id: "s1", name: "Montagem", machineId: "a1", printHours: 0, laborMinutes: 20, filaments: [] },
        ]),
      }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "cor-sem-peso")).toBeUndefined();
  });
});

describe("auditoria — arquivo salvo em ANSI", () => {
  it("acento corrompido vira aviso de arquivo, não passa calado", () => {
    const texto = csv({ ...LINHA_BOA, Produto: "Coração de Mãe" });
    // O que o navegador entrega quando o Excel gravou em Windows-1252 e o app
    // lê como UTF-8 (`readAsText(file, "UTF-8")`).
    const comoOAppLe = new TextDecoder("utf-8").decode(
      Uint8Array.from(texto, (c) => c.charCodeAt(0) & 0xff),
    );
    const r = parseProductsCsv(comoOAppLe, machines, opcoes);
    expect(r.warnings.some((w) => /ANSI/.test(w))).toBe(true);
    expect(r.warnings.some((w) => /CSV UTF-8/.test(w))).toBe(true);
    // Não bloqueia: a linha entra do mesmo jeito.
    expect(r.products).toHaveLength(1);
  });

  it("arquivo UTF-8 com acento não gera o aviso", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Produto: "Coração de Mãe" }),
      machines,
      opcoes,
    );
    expect(r.warnings).toEqual([]);
    expect(r.products[0].name).toBe("Coração de Mãe");
  });
});

// ---------------------------------------------------------------------------
// CSV-06 / CSV-07 / CSV-08 — a vírgula pt-BR nas células JSON.
//
// Fora das colunas escalares, TODO número do JSON era lido com `Number(x) || 0`.
// Em pt-BR isso zera o valor sem um aviso, e como 0 é um número plausível nada
// a jusante desconfia: o produto só nasce mais barato. Medido antes do
// conserto: as cores viajavam como STRING até o Firestore, num campo que o tipo
// declara `number`.
// ---------------------------------------------------------------------------
describe("CSV-06 — vírgula pt-BR dentro do JSON", () => {
  const COM_VIRGULA = {
    ...LINHA_BOA,
    "Filamentos JSON": '[{"filamentId":"cor_laranja","colorName":"L","pricePerKg":"110,00","totalG":"143,53"}]',
    "Etapas JSON": '[{"id":"s1","name":"Tampa","machineId":"a1","printHours":"1,5","laborMinutes":"12,5"}]',
    "Acessorios JSON": '[{"desc":"ima","qty":"2","unitPrice":"12,50"}]',
    "Subitens JSON": '[{"id":"sb1","name":"Corpo","stageKeys":[],"markup":"2,5"}]',
  };
  const COM_PONTO = {
    ...LINHA_BOA,
    "Filamentos JSON": '[{"filamentId":"cor_laranja","colorName":"L","pricePerKg":110,"totalG":143.53}]',
    "Etapas JSON": '[{"id":"s1","name":"Tampa","machineId":"a1","printHours":1.5,"laborMinutes":12.5}]',
    "Acessorios JSON": '[{"desc":"ima","qty":2,"unitPrice":12.5}]',
    "Subitens JSON": '[{"id":"sb1","name":"Corpo","stageKeys":[],"markup":2.5}]',
  };

  it("lê a vírgula nas 4 portas — e o resultado é IDÊNTICO ao do ponto", () => {
    // Diff campo a campo do documento: preço não é canário (FORM-01/RT-01) — o
    // `supplyId` já sumiu uma vez sem mover um centavo.
    // ⚠ `createdAt` sai de `Date.now()` e os dois parses caem em milissegundos
    // diferentes: compará-lo reprovava o teste em ~1 de cada 5 execuções. Ele é
    // conferido pelo TIPO, e o resto campo a campo.
    const { createdAt: tsVirgula, ...virgula } = parseProductsCsv(
      csv(COM_VIRGULA), machines, opcoes,
    ).products[0] as Record<string, unknown>;
    const { createdAt: tsPonto, ...ponto } = parseProductsCsv(
      csv(COM_PONTO), machines, opcoes,
    ).products[0] as Record<string, unknown>;

    expect(virgula).toEqual(ponto);
    expect(typeof tsVirgula).toBe("number");
    expect(typeof tsPonto).toBe("number");
  });

  it("grava NÚMERO, não a string crua (o `as` deixava a string ir ao Firestore)", () => {
    const p = parseProductsCsv(csv(COM_VIRGULA), machines, opcoes).products[0];
    expect(p.filaments?.[0].totalG).toBe(143.53);
    expect(p.filaments?.[0].pricePerKg).toBe(110);
    expect(typeof p.filaments?.[0].totalG).toBe("number");
    expect(p.stages?.[0].printHours).toBe(1.5);
    expect(p.stages?.[0].laborMinutes).toBe(12.5);
    expect(p.accessories?.[0].unitPrice).toBe(12.5);
    expect(p.subitems?.[0].markup).toBe(2.5);
  });

  it("a vírgula legítima não gera apontamento nenhum", () => {
    const r = parseProductsCsv(csv(COM_VIRGULA), machines, opcoes);
    expect(achar(r.issues, "numero-nao-reconhecido")).toBeUndefined();
    expect(achar(r.issues, "cor-sem-peso")).toBeUndefined();
  });

  it("o que NÃO é número vira aviso NOMEANDO o campo, em vez de 0 calado", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": '[{"filamentId":"cor_laranja","colorName":"L","pricePerKg":"duzentos","totalG":50}]',
        "Acessorios JSON": '[{"desc":"ima","qty":2,"unitPrice":"R$"}]',
      }),
      machines,
      opcoes,
    );
    const issue = achar(r.issues, "numero-nao-reconhecido");
    // CSV-21: 1 LINHA, com os 2 campos nos exemplos — os dois erros estão na
    // mesma linha da planilha, e é linha que o dono conta.
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos).toHaveLength(2);
    expect(issue?.exemplos.join(" | ")).toContain("pricePerKg");
    expect(issue?.exemplos.join(" | ")).toContain("unitPrice");
  });

  it("campo AUSENTE é ausência, não erro — não avisa", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Acessorios JSON": '[{"desc":"ima","qty":2,"unitPrice":12}]',
      }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "numero-nao-reconhecido")).toBeUndefined();
  });

  it("CSV-08: formato en-US do Google Sheets não entra 1000× menor", () => {
    const p = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": '[{"filamentId":"cor_laranja","colorName":"L","pricePerKg":"1,234.56","totalG":"1.234.567"}]',
      }),
      machines,
      opcoes,
    ).products[0];
    expect(p.filaments?.[0].pricePerKg).toBe(1234.56);
    expect(p.filaments?.[0].totalG).toBe(1234567);
  });
});

describe("CSV-07 — o apontamento de milhar errava dos dois lados", () => {
  it("acende com prefixo de moeda (o teste no texto cru não acendia)", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Peso (g)": "R$ 1.234" }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "milhar-ambiguo")?.linhas).toBe(1);
  });

  it("NÃO acende no Tempo (h) — falso positivo do round-trip do próprio export", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Tempo (h)": "2.375" }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "milhar-ambiguo")).toBeUndefined();
    expect(r.products[0].printHours).toBe(2.375);
  });
});

// ---------------------------------------------------------------------------
// AUD-09 — os 3 bloqueantes da carga em massa. Cada caso abaixo é a reprodução
// medida na varredura, virada em teste.
// ---------------------------------------------------------------------------

describe("CSV-09 — coluna escalar presente e vazia caía em 0, não no default", () => {
  // As 4 colunas cujo vazio NÃO significa zero (as outras 3 têm default 0/1).
  const DEFAULTS = {
    "Tarifa Energia": ["energyTariff", 0.8],
    "Valor-hora (R$)": ["laborRate", 30],
    "Mao de obra (min)": ["laborMinutes", 15],
    "Taxa Falha (%)": ["failureRate", 3],
  } as const;

  it("as 4 presentes e EM BRANCO caem no default, e não avisam", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Tarifa Energia": "",
        "Valor-hora (R$)": "",
        "Mao de obra (min)": "",
        "Taxa Falha (%)": "",
      }),
      machines,
      opcoes,
    );
    const p = r.products[0];
    expect(p.energyTariff).toBe(0.8);
    expect(p.laborRate).toBe(30);
    expect(p.laborMinutes).toBe(15);
    expect(p.failureRate).toBe(3);
    // Vazio é o dono não escrevendo nada — não há o que apontar.
    expect(achar(r.issues, "coluna-numero-nao-reconhecido")).toBeUndefined();
  });

  it.each(Object.entries(DEFAULTS))(
    '"%s" ilegível: fica no default E aponta',
    (coluna, [campo, valor]) => {
      const r = parseProductsCsv(
        csv({ ...LINHA_BOA, [coluna]: "abc" }),
        machines,
        opcoes,
      );
      expect(r.products[0][campo]).toBe(valor);
      const issue = achar(r.issues, "coluna-numero-nao-reconhecido");
      expect(issue?.linhas).toBe(1);
      expect(issue?.exemplos[0]).toContain(coluna);
    },
  );

  it("as 3 colunas de default 0/1 também apontam quando ilegíveis", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Peso (g)": "abc",
        "Tempo (h)": "abc",
        Pecas: "abc",
      }),
      machines,
      opcoes,
    );
    expect(r.products[0].printHours).toBe(0);
    expect(r.products[0].piecesCount).toBe(1);
    // 1 linha (CSV-21), com 2 exemplos: `Tempo (h)` e `Pecas`. O `Peso (g)`
    // nem é lido — a linha traz `Filamentos JSON`, e com as cores presentes os
    // escalares não entram.
    const ilegivel = achar(r.issues, "coluna-numero-nao-reconhecido");
    expect(ilegivel?.linhas).toBe(1);
    expect(ilegivel?.exemplos).toHaveLength(2);
  });

  it("coluna AUSENTE segue no default, calada (o comportamento que já valia)", () => {
    const r = parseProductsCsv(csv(LINHA_BOA), machines, opcoes);
    expect(r.products[0].energyTariff).toBe(0.8);
    expect(r.products[0].laborRate).toBe(30);
    expect(r.issues).toBeUndefined();
  });

  it("valor escrito continua mandando", () => {
    const p = parseProductsCsv(
      csv({ ...LINHA_BOA, "Tarifa Energia": "0,95", "Valor-hora (R$)": "45" }),
      machines,
      opcoes,
    ).products[0];
    expect(p.energyTariff).toBe(0.95);
    expect(p.laborRate).toBe(45);
  });
});

describe("CSV-10 — o cabeçalho abreviado 'Filamentos' era roubado pelo PREÇO", () => {
  const { "Filamentos JSON": cores, ...SEM_CORES } = LINHA_BOA;

  it("'Filamentos' (sem JSON) fica com as cores, não com o R$/kg", () => {
    const r = parseProductsCsv(
      csv({ ...SEM_CORES, Filamentos: cores }),
      machines,
      opcoes,
    );
    const p = r.products[0];
    expect(p.filaments).toHaveLength(1);
    expect(p.filaments?.[0].totalG).toBe(50);
    // Era aqui que a lista de cores inteira virava 11050 R$/kg.
    expect(p.filamentPricePerKg).toBeUndefined();
    // AUD-11/D-3: o palpite continua CERTO — o que mudou é que ele agora se
    // anuncia, em vez de ficar calado (era aqui que um cabeçalho errado passava).
    expect(r.warnings).toEqual([
      'Coluna(s) lida(s) por aproximação — confira se o palpite está certo: ' +
        '"Filamentos" → Filamentos JSON.',
    ]);
  });

  it("com as DUAS presentes, cada uma fica com a sua", () => {
    const p = parseProductsCsv(
      csv({ ...SEM_CORES, "Filamento (R$/kg)": "120", Filamentos: cores }),
      machines,
      opcoes,
    ).products[0];
    expect(p.filaments?.[0].totalG).toBe(50);
    expect(p.filamentPricePerKg).toBeUndefined();
  });

  it("só o preço, sem cores: segue sendo o preço", () => {
    const p = parseProductsCsv(
      csv({ ...SEM_CORES, "Peso (g)": "50", "Filamento (R$/kg)": "120" }),
      machines,
      opcoes,
    ).products[0];
    expect(p.filamentPricePerKg).toBe(120);
    expect(p.weightG).toBe(50);
  });
});

describe("CSV-11 — a supressão do aviso engolia 2 colunas de ENTRADA", () => {
  it('"Tarifa de Energia" agora é LIDA (era 0,8 calado)', () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Tarifa de Energia": "99" }),
      machines,
      opcoes,
    );
    expect(r.products[0].energyTariff).toBe(99);
    expect(r.warnings).toEqual([
      'Coluna(s) lida(s) por aproximação — confira se o palpite está certo: ' +
        '"Tarifa de Energia" → Tarifa Energia.',
    ]);
  });

  it('"Energia (R$/kWh)" também', () => {
    const p = parseProductsCsv(
      csv({ ...LINHA_BOA, "Energia (R$/kWh)": "1,2" }),
      machines,
      opcoes,
    ).products[0];
    expect(p.energyTariff).toBe(1.2);
  });

  it('"Inclui custo fixo" agora é LIDA (era false calado)', () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Inclui custo fixo": "sim" }),
      machines,
      opcoes,
    );
    expect(r.products[0].includeFixed).toBe(true);
    expect(r.warnings).toEqual([
      'Coluna(s) lida(s) por aproximação — confira se o palpite está certo: ' +
        '"Inclui custo fixo" → Inclui Fixo.',
    ]);
  });

  it("a coluna CALCULADA 'Energia (R$)' não vira tarifa nem acende aviso", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Energia (R$)": "3,40" }),
      machines,
      opcoes,
    );
    expect(r.products[0].energyTariff).toBe(0.8);
    expect(r.warnings).toEqual([]);
  });

  it("coluna desconhecida de verdade continua sendo apontada", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Coluna Inventada": "x" }),
      machines,
      opcoes,
    );
    expect(r.warnings.join(" ")).toContain("Coluna Inventada");
  });
});

// ---------------------------------------------------------------------------
// AUD-09, Lote B — os que não bloqueiam mas mordem na carga.
// ---------------------------------------------------------------------------

describe("CSV-12 — milhar ambíguo DENTRO da célula JSON", () => {
  it('"totalG":"1.234" acende (entrava 1000× mais leve, calado)', () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON":
          '[{"filamentId":"cor_laranja","colorName":"L","pricePerKg":110,"totalG":"1.234"}]',
      }),
      machines,
      opcoes,
    );
    // O valor NÃO muda — o ponto é decimal mesmo. O que muda é o dono saber.
    expect(r.products[0].filaments?.[0].totalG).toBe(1.234);
    const issue = achar(r.issues, "milhar-ambiguo-json");
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos[0]).toContain("totalG");
    // Nem o cor-sem-peso pegava: 1,234 > 0.
    expect(achar(r.issues, "cor-sem-peso")).toBeUndefined();
  });

  it("número normal e formato en-US não acendem", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON":
          '[{"filamentId":"cor_laranja","colorName":"L","pricePerKg":"1,234.56","totalG":50}]',
      }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "milhar-ambiguo-json")).toBeUndefined();
  });

  it("acende também nos acessórios", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Acessorios JSON": '[{"desc":"ima","qty":1,"unitPrice":"1.500"}]' }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "milhar-ambiguo-json")?.exemplos[0]).toContain("unitPrice");
  });
});

describe("CSV-13 — cor sem peso é olhada COR A COR, não pela soma", () => {
  it("multicolor com UMA cor zerada acende e diz qual", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": JSON.stringify([
          { filamentId: "cor_laranja", colorName: "Laranja", pricePerKg: 110, totalG: 50 },
          { filamentId: "cor_laranja", colorName: "Preto", pricePerKg: 110, totalG: 0 },
        ]),
      }),
      machines,
      opcoes,
    );
    const issue = achar(r.issues, "cor-sem-peso");
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos[0]).toContain("Preto");
  });

  it("todas com peso: calado", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": JSON.stringify([
          { filamentId: "cor_laranja", colorName: "Laranja", pricePerKg: 110, totalG: 50 },
          { filamentId: "cor_laranja", colorName: "Preto", pricePerKg: 110, totalG: 30 },
        ]),
      }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "cor-sem-peso")).toBeUndefined();
  });

  it("cor sem nome é apontada pela POSIÇÃO", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": '[{"filamentId":"cor_laranja","pricePerKg":110,"totalG":0}]',
      }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "cor-sem-peso")?.exemplos[0]).toContain("cor 1");
  });
});

describe("CSV-14 — o separador", () => {
  it("TAB é detectado (a linha inteira virava o NOME do produto)", () => {
    const r = parseProductsCsv(
      "Produto\tTempo (h)\tPeso (g)\nCaneca\t2\t50",
      machines,
      opcoes,
    );
    expect(r.products[0].name).toBe("Caneca");
    expect(r.products[0].printHours).toBe(2);
    expect(r.products[0].weightG).toBe(50);
  });

  it("vírgula com decimal pt-BR SEM aspas: a linha desalinha, e agora isso é dito", () => {
    const r = parseProductsCsv(
      "Produto,Tempo (h),Peso (g)\nCaneca,2,5,50",
      machines,
      opcoes,
    );
    expect(achar(r.issues, "celulas-demais")?.linhas).toBe(1);
  });

  it("vírgula COM aspas (o que o Excel escreve) continua certa e calada", () => {
    const r = parseProductsCsv(
      'Produto,Tempo (h),Peso (g)\nCaneca,"2,5",50',
      machines,
      opcoes,
    );
    expect(r.products[0].printHours).toBe(2.5);
    expect(r.products[0].weightG).toBe(50);
    expect(achar(r.issues, "celulas-demais")).toBeUndefined();
  });

  it("separador sobrando no fim da linha NÃO é desalinhamento", () => {
    const r = parseProductsCsv(
      "Produto;Tempo (h);Peso (g)\nCaneca;2;50;",
      machines,
      opcoes,
    );
    expect(achar(r.issues, "celulas-demais")).toBeUndefined();
  });

  it("cabeçalho que se parte dos dois jeitos: avisa qual usei", () => {
    const r = parseProductsCsv(
      "Produto;Nome Etapa Principal,Tempo (h)\nCaneca;Corpo,2",
      machines,
      opcoes,
    );
    expect(r.warnings.join(" ")).toContain("usei");
  });
});

describe("CSV-15 — createdAt distinto por linha", () => {
  it("3 linhas, 3 instantes, na ordem da planilha", () => {
    const linhas = ["Produto;Tempo (h)", "Um;1", "Dois;2", "Tres;3"].join("\n");
    const p = parseProductsCsv(linhas, machines, opcoes).products;
    const datas = p.map((x) => x.createdAt as number);
    expect(new Set(datas).size).toBe(3);
    expect(datas[0]).toBeLessThan(datas[1]);
    expect(datas[1]).toBeLessThan(datas[2]);
  });
});

// CSV-21 — `linhas` conta LINHA, não ocorrência. Uma linha com 3 células ruins
// da mesma classe era reportada como "3 linhas", e é esse número que decide se
// o dono confirma a carga ou volta pro Excel.
describe("CSV-21 — o contador conta linha, não ocorrência", () => {
  it("3 erros da MESMA classe numa linha só = 1 linha, 3 exemplos", () => {
    const r = parseProductsCsv(
      csv({
        Produto: "Caneca",
        "Tempo (h)": "abc",
        Pecas: "abc",
        "Valor-hora (R$)": "abc",
      }),
      machines,
      opcoes,
    );
    const issue = achar(r.issues, "coluna-numero-nao-reconhecido");
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos).toHaveLength(3);
    expect(issue?.exemplos.join(" | ")).toContain("Tempo (h)");
    expect(issue?.exemplos.join(" | ")).toContain("Pecas");
    expect(issue?.exemplos.join(" | ")).toContain("Valor-hora (R$)");
  });

  it("a mesma classe em 3 linhas distintas continua contando 3", () => {
    const arquivo = [
      "Produto;Tempo (h)",
      "Um;abc",
      "Dois;abc",
      "Tres;abc",
    ].join("\n");
    const r = parseProductsCsv(arquivo, machines, opcoes);
    expect(achar(r.issues, "coluna-numero-nao-reconhecido")?.linhas).toBe(3);
  });

  it("classes DIFERENTES na mesma linha seguem contando 1 cada", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Tempo (h)": "abc", Markup: "abc" }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "coluna-numero-nao-reconhecido")?.linhas).toBe(1);
    expect(achar(r.issues, "markup-invalido")?.linhas).toBe(1);
  });

  it("misto: 2 linhas, uma delas com 2 erros da classe = 2 linhas", () => {
    const arquivo = [
      "Produto;Tempo (h);Pecas",
      "Um;abc;abc",
      "Dois;abc;1",
    ].join("\n");
    const r = parseProductsCsv(arquivo, machines, opcoes);
    expect(achar(r.issues, "coluna-numero-nao-reconhecido")?.linhas).toBe(2);
  });
});

// CSV-22 — o `filamentId` é um auto-id do Firestore: ninguém digita, todo mundo
// cola. Um paste deslocado amarra o produto na cor ERRADA e a checagem de
// existência não pega, porque o id existe. O nome ao lado é a segunda fonte.
describe("CSV-22 — nome da cor × id", () => {
  const comCor = (filamentId: string, colorName: string) =>
    parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": JSON.stringify([
          { filamentId, colorName, pricePerKg: 110, totalG: 50 },
        ]),
      }),
      machines,
      opcoes,
    );

  it("id e nome batendo: calado", () => {
    expect(achar(comCor("cor_laranja", "Laranja").issues, "cor-nome-divergente"))
      .toBeUndefined();
  });

  it("id certo, nome de OUTRA cor: avisa dizendo os dois", () => {
    const r = comCor("cor_laranja", "Preto");
    const issue = achar(r.issues, "cor-nome-divergente");
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos[0]).toContain("cor_laranja");
    expect(issue?.exemplos[0]).toContain("Laranja");
    expect(issue?.exemplos[0]).toContain("Preto");
    // O id continua valendo — o aviso não muda o vínculo.
    expect(r.products[0].filaments?.[0].filamentId).toBe("cor_laranja");
  });

  it("acento e caixa não são divergência", () => {
    expect(achar(comCor("cor_laranja", "LARANJA").issues, "cor-nome-divergente"))
      .toBeUndefined();
  });

  it("nome ausente é ausência, não divergência", () => {
    expect(achar(comCor("cor_laranja", "").issues, "cor-nome-divergente"))
      .toBeUndefined();
  });

  it("id que não existe acende SÓ o cor-inexistente, não os dois", () => {
    const r = comCor("cor_fantasma", "Laranja");
    expect(achar(r.issues, "cor-inexistente")?.linhas).toBe(1);
    expect(achar(r.issues, "cor-nome-divergente")).toBeUndefined();
  });

  it("vale também para a cor de uma ETAPA", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Etapas JSON": JSON.stringify([
          {
            id: "stage_1",
            name: "Base",
            machineId: "a1",
            printHours: 1,
            laborMinutes: 0,
            filaments: [
              { filamentId: "cor_laranja", colorName: "Verde", pricePerKg: 110, totalG: 20 },
            ],
          },
        ]),
      }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "cor-nome-divergente")?.exemplos[0]).toContain("Verde");
  });

  it("sem estoque nas opções, a checagem não roda", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": JSON.stringify([
          { filamentId: "cor_laranja", colorName: "Preto", pricePerKg: 110, totalG: 50 },
        ]),
      }),
      machines,
    );
    expect(achar(r.issues, "cor-nome-divergente")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AUD-11 — os três defeitos de CSV que a varredura de 2026-08-23 reproduziu.
// ---------------------------------------------------------------------------

describe("AUD-11/D-1 — `Tempo (min)` entrou na checagem de milhar", () => {
  const SEM_TEMPO = sem(LINHA_BOA, "Tempo (h)");

  it('"1.234" em `Tempo (min)` acende o aviso (antes: 0,02 h calado)', () => {
    const r = parseProductsCsv(
      csv({ ...SEM_TEMPO, "Tempo (min)": "1.234" }),
      machines,
      opcoes,
    );
    const issue = achar(r.issues, "milhar-ambiguo");
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos[0]).toContain("Tempo (min)");
    // O VALOR não muda — o parser não adivinha, aponta (mesma regra do CSV-07).
    expect(r.products[0].printHours).toBeCloseTo(1.234 / 60, 10);
  });

  it("a 2ª trava do CSV-16 também é coberta: coluna de HORAS que diz minuto", () => {
    const r = parseProductsCsv(
      csv({ ...SEM_TEMPO, "Tempo de impressao (min)": "1.234" }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "milhar-ambiguo")?.exemplos[0]).toContain("Tempo (min)");
  });

  it("`Pecas` também: 1,234 peça divide o custo por 1,234, não por 1234", () => {
    const r = parseProductsCsv(csv({ ...LINHA_BOA, Pecas: "1.234" }), machines, opcoes);
    expect(achar(r.issues, "milhar-ambiguo")?.exemplos[0]).toContain("Pecas");
  });

  it("`Taxa Falha (%)` continua FORA — o clamp em 95 mata a ambiguidade", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Taxa Falha (%)": "1.234" }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "milhar-ambiguo")).toBeUndefined();
    expect(r.products[0].failureRate).toBeCloseTo(1.234, 10);
  });

  it("`Tempo (h)` continua FORA — é o valor que o próprio export escreve", () => {
    const r = parseProductsCsv(csv({ ...LINHA_BOA, "Tempo (h)": "2.375" }), machines, opcoes);
    expect(achar(r.issues, "milhar-ambiguo")).toBeUndefined();
    expect(r.products[0].printHours).toBe(2.375);
  });

  it("tempo normal em minutos não acende nada", () => {
    const r = parseProductsCsv(
      csv({ ...SEM_TEMPO, "Tempo (min)": "150" }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "milhar-ambiguo")).toBeUndefined();
    expect(r.products[0].printHours).toBe(2.5);
  });
});

describe("AUD-11/D-2 — cor que PESA mas não CUSTA", () => {
  const semRolo = { ...cor, rolls: [] } as unknown as StockFilament;
  const corDe = (over: Record<string, unknown>) =>
    JSON.stringify([
      { filamentId: "cor_laranja", colorName: "Laranja", pricePerKg: 110, totalG: 50, ...over },
    ]);

  it("cor cadastrada SEM ROLO e preço 0 na planilha: acende", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Filamentos JSON": corDe({ pricePerKg: 0 }) }),
      machines,
      { ...opcoes, stock: [semRolo] },
    );
    const issue = achar(r.issues, "cor-sem-preco");
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos[0]).toContain("não tem rolo");
  });

  it("a MESMA linha com a cor tendo rolo: silêncio (o preço vivo resolve)", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Filamentos JSON": corDe({ pricePerKg: 0 }) }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "cor-sem-preco")).toBeUndefined();
  });

  it("caminho ESCALAR: Peso preenchido com Filamento (R$/kg) vazio", () => {
    const r = parseProductsCsv(
      csv({ ...sem(LINHA_BOA, "Filamentos JSON"), "Peso (g)": "200", "Filamento (R$/kg)": "" }),
      machines,
      opcoes,
    );
    const issue = achar(r.issues, "cor-sem-preco");
    expect(issue?.linhas).toBe(1);
    // Nomeia a coluna que a linha usou de verdade — aqui não existe JSON nenhum.
    expect(issue?.exemplos[0]).toContain("Peso (g) / Filamento (R$/kg)");
    expect(issue?.exemplos[0]).not.toContain("Filamentos JSON");
  });

  it("cor avulsa sem preço também acende", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": JSON.stringify([
          { filamentId: null, colorName: "Dourado", pricePerKg: 0, totalG: 80 },
        ]),
      }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "cor-sem-preco")?.exemplos[0]).toContain("Dourado");
  });

  it("peso 0 NÃO acende as duas classes — ali quem fala é o cor-sem-peso", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Filamentos JSON": corDe({ pricePerKg: 0, totalG: 0 }) }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "cor-sem-peso")?.linhas).toBe(1);
    expect(achar(r.issues, "cor-sem-preco")).toBeUndefined();
  });

  it("etapa extra com cor sem preço é apontada com o número da etapa", () => {
    const r = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Etapas JSON": JSON.stringify([
          {
            id: "st",
            machineId: "a1",
            printHours: 1,
            laborMinutes: 0,
            filaments: [{ filamentId: null, colorName: "Tampa", pricePerKg: 0, totalG: 30 }],
          },
        ]),
      }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "cor-sem-preco")?.exemplos[0]).toContain("etapa 2");
  });

  it("linha boa segue sem apontamento nenhum", () => {
    const r = parseProductsCsv(csv(LINHA_BOA), machines, opcoes);
    expect(r.issues).toBeUndefined();
  });
});

describe("AUD-11/D-3 — a coluna lida por APROXIMAÇÃO se anuncia", () => {
  const SEM_TEMPO = sem(LINHA_BOA, "Tempo (h)");

  it("cabeçalho errado sem a coluna canônica: agora avisa (antes: calado)", () => {
    const r = parseProductsCsv(
      csv({ ...SEM_TEMPO, "Tempo de cura (h)": "11" }),
      machines,
      opcoes,
    );
    // O comportamento não muda — o palpite continua sendo feito.
    expect(r.products[0].printHours).toBe(11);
    expect(r.warnings.join(" ")).toContain('"Tempo de cura (h)" → Tempo (h)');
  });

  it("nome EXATO não entra no aviso — só o pedaço entra", () => {
    const r = parseProductsCsv(csv(LINHA_BOA), machines, opcoes);
    expect(r.warnings).toEqual([]);
  });

  it("com a canônica presente, a intrusa vira 'ignorada' e não 'aproximação'", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Tempo de cura (h)": "11" }),
      machines,
      opcoes,
    );
    expect(r.products[0].printHours).toBe(2);
    expect(r.warnings.join(" ")).toContain("Coluna(s) ignorada(s)");
    expect(r.warnings.join(" ")).not.toContain("aproximação");
  });

  it("UMA linha por arquivo, com todas as colunas adivinhadas juntas", () => {
    const r = parseProductsCsv(
      csv({
        ...sem(LINHA_BOA, "Filamentos JSON", "Tempo (h)"),
        Filamentos: LINHA_BOA["Filamentos JSON"],
        Peso: "50",
        Tempo: "2",
      }),
      machines,
      opcoes,
    );
    const aprox = r.warnings.filter((w) => w.includes("aproximação"));
    expect(aprox).toHaveLength(1);
    expect(aprox[0]).toContain('"Filamentos" → Filamentos JSON');
    expect(aprox[0]).toContain('"Peso" → Peso (g)');
    expect(aprox[0]).toContain('"Tempo" → Tempo (h)');
  });
});

// ---------------------------------------------------------------------------
// AUD-12 / lote A — os quatro que entravam CALADOS na carga.
// ---------------------------------------------------------------------------

describe("CSV-23 — booleano em vocabulário de planilha", () => {
  const grafiasSim = ["sim", "SIM", " sim ", "TRUE", "true", "VERDADEIRO", "1", "S", "x", "yes", "Y", "v"];

  it.each(grafiasSim)('"%s" liga o custo fixo, sem apontamento', (grafia) => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Inclui Fixo": grafia }),
      machines,
      opcoes,
    );
    expect(r.products[0].includeFixed).toBe(true);
    expect(achar(r.issues, "booleano-nao-reconhecido")).toBeUndefined();
  });

  it.each(["nao", "NÃO", "false", "FALSO", "0", "n", "-"])(
    '"%s" nega, e também não aponta',
    (grafia) => {
      const r = parseProductsCsv(
        csv({ ...LINHA_BOA, "Inclui Fixo": grafia }),
        machines,
        opcoes,
      );
      expect(r.products[0].includeFixed).toBe(false);
      expect(achar(r.issues, "booleano-nao-reconhecido")).toBeUndefined();
    },
  );

  it("grafia fora das duas listas entra como não — e APONTA, nomeando a coluna", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Inclui Fixo": "talvez" }),
      machines,
      opcoes,
    );
    expect(r.products[0].includeFixed).toBe(false);
    const issue = achar(r.issues, "booleano-nao-reconhecido");
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos[0]).toContain('"Inclui Fixo"');
    expect(issue?.exemplos[0]).toContain("talvez");
  });

  it("célula VAZIA é ausência, não grafia desconhecida — segue calada", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Inclui Fixo": "" }),
      machines,
      opcoes,
    );
    expect(r.products[0].includeFixed).toBe(false);
    expect(achar(r.issues, "booleano-nao-reconhecido")).toBeUndefined();
  });

  it("vale igual para Vende por Subitens", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Vende por Subitens": "TRUE" }),
      machines,
      opcoes,
    );
    expect(r.products[0].sellBySubitems).toBe(true);
  });
});

describe("CSV-24 — o palpite de máquina se anuncia", () => {
  it("nome exato não é palpite: nenhum apontamento", () => {
    const r = parseProductsCsv(csv(LINHA_BOA), machines, opcoes);
    expect(r.products[0].machineId).toBe("a1");
    expect(achar(r.issues, "maquina-por-aproximacao")).toBeUndefined();
  });

  it.each([
    ["AnyCubic A1 Mini", "a1"],
    ["Elegoo Neptune A1", "a1"],
    ["meu x2d antigo", "x2d"],
  ])('"%s" casa por substring — e agora avisa', (nome, id) => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Maquina: nome }),
      machines,
      opcoes,
    );
    expect(r.products[0].machineId).toBe(id);
    const issue = achar(r.issues, "maquina-por-aproximacao");
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos[0]).toContain(nome);
  });

  it("com dois ids no nome vence o MAIS LONGO, não o primeiro do array", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Maquina: "Maquina X2D e A1" }),
      machines,
      opcoes,
    );
    expect(r.products[0].machineId).toBe("x2d");
  });

  it("nome que não casa com nada segue no aviso de fallback, não na classe nova", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Maquina: "Prusa MK4" }),
      machines,
      opcoes,
    );
    expect(r.products[0].machineId).toBe("a1");
    expect(achar(r.issues, "maquina-por-aproximacao")).toBeUndefined();
    expect(r.warnings.join(" ")).toContain("não encontrada");
  });
});

describe("CSV-25 — linha sem nome entra na contagem", () => {
  it("3 linhas sem nome entre 5: 2 produtos, e o descarte é dito", () => {
    const linhas = [
      "Produto;Tempo (h)",
      "Caneca;2",
      ";3",
      "   ;4",
      '"";5',
      "Vaso;6",
    ].join("\n");
    const r = parseProductsCsv(linhas, machines, opcoes);
    expect(r.products).toHaveLength(2);
    const issue = achar(r.issues, "linha-sem-nome");
    expect(issue?.linhas).toBe(3);
    expect(issue?.exemplos).toHaveLength(3);
  });

  it("linha em branco no meio do arquivo continua sem apontar nada", () => {
    const linhas = ["Produto;Tempo (h)", "Caneca;2", "", ";;", "Vaso;6"].join("\n");
    const r = parseProductsCsv(linhas, machines, opcoes);
    expect(r.products).toHaveLength(2);
    expect(achar(r.issues, "linha-sem-nome")).toBeUndefined();
  });
});

describe("CSV-26 — o aviso do markup diz a verdade sobre o documento", () => {
  it("markup NEGATIVO não entra no documento — entra o 3x que o aviso promete", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Markup: "-2" }),
      machines,
      opcoes,
    );
    expect(r.products[0].markup).toBe(3);
    expect(achar(r.issues, "markup-invalido")?.exemplos[0]).toContain("-2");
  });

  it('"x" sozinho não some no replace: entra 3x E aponta', () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Markup: "x" }),
      machines,
      opcoes,
    );
    expect(r.products[0].markup).toBe(3);
    expect(achar(r.issues, "markup-invalido")?.exemplos[0]).toContain('"x"');
  });

  it("markup abaixo de 1 é LIDO certo, entra como está, e ganha classe própria", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Markup: "0,5" }),
      machines,
      opcoes,
    );
    expect(r.products[0].markup).toBe(0.5);
    expect(achar(r.issues, "markup-invalido")).toBeUndefined();
    expect(achar(r.issues, "markup-abaixo-de-1")?.linhas).toBe(1);
  });

  it("markup vazio cai em 3x sem apontar (a coluna existe, a célula é ausência)", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Markup: "" }),
      machines,
      opcoes,
    );
    expect(r.products[0].markup).toBe(3);
    expect(achar(r.issues, "markup-invalido")).toBeUndefined();
  });

  it('"2,5x" continua lendo o sufixo e o decimal pt-BR', () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Markup: "2,5x" }),
      machines,
      opcoes,
    );
    expect(r.products[0].markup).toBe(2.5);
    expect(r.issues).toBeUndefined();
  });
});

// ── Lote C da AUD-12 — a QUALIDADE do aviso ────────────────────────────────
//
// Os três abaixo já avisavam. O defeito era o CONTEÚDO: conselho que não
// resolve, razão errada, e alarme sobre dado correto. Aviso que mente custa
// mais caro que aviso ausente — ensina o dono a ignorar a lista inteira, e é
// justamente essa lista que decide se a carga em massa é confirmada.

// Cor cadastrada, COM rolo, mas o rolo está com preço 0. É o caso que o
// CSV-27 confundia com "não tem rolo".
const corRoloZerado = {
  id: "cor_zerada", colorName: "Verde", material: "PLA", brand: "Bambu",
  minG: 0, archived: false,
  rolls: [{ id: "r1", pricePerKg: 0, initialG: 1000, createdAt: 1, note: "" }],
  adjustments: [],
} as unknown as StockFilament;

// Cor cadastrada e sem rolo nenhum — o caso original do aviso.
const corSemRolo = {
  id: "cor_vazia", colorName: "Azul", material: "PLA", brand: "Bambu",
  minG: 0, archived: false, rolls: [], adjustments: [],
} as unknown as StockFilament;

const opcoesCores = { ...opcoes, stock: [cor, corRoloZerado, corSemRolo] };

function linhaComCor(filamentId: string, colorName: string) {
  return csv({
    ...LINHA_BOA,
    "Filamentos JSON": JSON.stringify([
      { filamentId, colorName, pricePerKg: 0, totalG: 50 },
    ]),
  });
}

describe("CSV-27 — o cor-sem-preco para de dizer 'não tem rolo' para cor que tem", () => {
  it("cor COM rolo a preço 0: aponta o rolo, não manda cadastrar outro", () => {
    const r = parseProductsCsv(
      linhaComCor("cor_zerada", "Verde"),
      machines,
      opcoesCores,
    );
    const issue = achar(r.issues, "cor-sem-preco");
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos[0]).toContain("TEM rolo");
    expect(issue?.exemplos[0]).toContain("preço 0");
    // O conselho antigo — cadastrar um rolo que já está lá — não pode voltar.
    expect(issue?.exemplos[0]).not.toContain("não tem rolo");
  });

  it("cor SEM rolo nenhum: a frase original continua, que ali ela está certa", () => {
    const r = parseProductsCsv(
      linhaComCor("cor_vazia", "Azul"),
      machines,
      opcoesCores,
    );
    const issue = achar(r.issues, "cor-sem-preco");
    expect(issue?.exemplos[0]).toContain("não tem rolo");
    expect(issue?.exemplos[0]).not.toContain("TEM rolo");
  });

  it("cor com rolo COM preço: nada a apontar", () => {
    const r = parseProductsCsv(
      linhaComCor("cor_laranja", "Laranja"),
      machines,
      opcoesCores,
    );
    expect(achar(r.issues, "cor-sem-preco")).toBeUndefined();
  });
});

describe("CSV-28 — coluna repetida não é 'nome não reconhecido'", () => {
  // O helper `csv()` é um objeto, então não consegue repetir chave: aqui o
  // arquivo vai escrito à mão, que é como a planilha de verdade chega.
  const repetida =
    "Produto;Maquina;Tempo (h);Markup;Peso (g);Peso (g)\n" +
    "Caneca;A1 Combo;2;3x;100;250";

  it("avisa como REPETIDA, dizendo qual das duas venceu", () => {
    const r = parseProductsCsv(repetida, machines, opcoes);
    const repetidaMsg = r.warnings.find((w) => w.includes("repetida"));
    expect(repetidaMsg).toContain('"Peso (g)"');
    expect(repetidaMsg).toContain("PRIMEIRA");
    // E some do aviso de nome não reconhecido, que mandava RENOMEAR.
    expect(r.warnings.some((w) => w.includes("não foi reconhecido"))).toBe(false);
  });

  it("o comportamento de leitura não muda: a primeira vence", () => {
    const r = parseProductsCsv(repetida, machines, opcoes);
    expect(r.products[0].weightG).toBe(100);
  });

  it("coluna de nome realmente desconhecido continua no aviso de sempre", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Etapas: "[]" }),
      machines,
      opcoes,
    );
    expect(r.warnings.some((w) => w.includes("não foi reconhecido"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("repetida"))).toBe(false);
  });
});

describe("CSV-31 — peça fracionária é reprovada, não arredondada", () => {
  it('Pecas = "1.234" acende o milhar E reprova a linha', () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Pecas: "1.234" }),
      machines,
      opcoes,
    );
    expect(achar(r.issues, "milhar-ambiguo")?.linhas).toBe(1);
    const invalida = achar(r.issues, "linha-invalida");
    expect(invalida?.exemplos[0]).toContain("inteiro");
  });

  it("Pecas inteira continua passando sem apontamento", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Pecas: "4" }),
      machines,
      opcoes,
    );
    expect(r.products[0].piecesCount).toBe(4);
    expect(achar(r.issues, "linha-invalida")).toBeUndefined();
  });
});


// CSV-32 — o id do subitem tem de sair único daqui. Misturar id explícito com id
// ausente colidia na mesma `skuKey` (subitem+cor) e o acabado creditava UMA parte
// no lugar de duas: medido ao vivo, produção de R$ 15,75 creditou R$ 11,69.
describe("CSV-32 — id de subitem repetido não entra calado", () => {
  const subitens = (lista: unknown[]) => ({
    ...LINHA_BOA,
    "Vende por Subitens": "sim",
    "Subitens JSON": JSON.stringify(lista),
  });

  it("id explícito na posição 3 não é roubado pelo fallback da posição 1", () => {
    const r = parseProductsCsv(
      csv(
        subitens([
          { name: "Corpo", stageKeys: [] },
          { name: "Tampa", stageKeys: [] },
          { id: "sub_1", name: "Alça", stageKeys: [] },
        ]),
      ),
      machines,
      opcoes,
    );
    const ids = r.products[0].subitems?.map((s) => s.id) ?? [];
    expect(new Set(ids).size).toBe(3);
    expect(ids).toContain("sub_1"); // o explícito continua sendo dele
    expect(ids[2]).toBe("sub_1");
    // O acidente se resolve sozinho: não há nada para o dono corrigir.
    expect(achar(r.issues, "subitem-id-repetido")).toBeUndefined();
  });

  it("o caso medido (sub_1 explícito + subitem sem id na posição 1) sai com 2 SKUs", () => {
    const r = parseProductsCsv(
      csv(
        subitens([
          { id: "sub_1", name: "Corpo", stageKeys: [] },
          { name: "Tampa", stageKeys: [] },
        ]),
      ),
      machines,
      opcoes,
    );
    const ids = r.products[0].subitems?.map((s) => s.id) ?? [];
    expect(ids).toEqual(["sub_1", "sub_2"]);
    expect(achar(r.issues, "subitem-id-repetido")).toBeUndefined();
  });

  it("id explícito REPETIDO avisa nomeando os dois — e a peça não some", () => {
    const r = parseProductsCsv(
      csv(
        subitens([
          { id: "sub_1", name: "Corpo", stageKeys: [] },
          { id: "sub_1", name: "Tampa", stageKeys: [] },
        ]),
      ),
      machines,
      opcoes,
    );
    const ids = r.products[0].subitems?.map((s) => s.id) ?? [];
    expect(new Set(ids).size).toBe(2);
    const issue = achar(r.issues, "subitem-id-repetido");
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos[0]).toContain("Corpo");
    expect(issue?.exemplos[0]).toContain("Tampa");
  });

  it("lista sem id nenhum segue com sub_0, sub_1… e sem apontamento", () => {
    const r = parseProductsCsv(
      csv(
        subitens([
          { name: "Corpo", stageKeys: [] },
          { name: "Tampa", stageKeys: [] },
        ]),
      ),
      machines,
      opcoes,
    );
    expect(r.products[0].subitems?.map((s) => s.id)).toEqual(["sub_0", "sub_1"]);
    expect(achar(r.issues, "subitem-id-repetido")).toBeUndefined();
  });
});

// UX-48 — o valor mais preciso que a planilha pode trazer é o ID da máquina, e
// era justamente ele que caía no palpite por substring: 100 linhas com
// `Maquina = A1` acendiam `maquina-por-aproximacao = 100` numa planilha CERTA.
describe("UX-48 — id de máquina é identidade, não palpite", () => {
  it.each(["a1", "A1", "x2d", "X2D", " A1 "])(
    '"%s" casa pelo id, sem aviso',
    (nome) => {
      const r = parseProductsCsv(
        csv({ ...LINHA_BOA, Maquina: nome }),
        machines,
        opcoes,
      );
      expect(r.products[0].machineId).toBe(nome.trim().toLowerCase());
      expect(achar(r.issues, "maquina-por-aproximacao")).toBeUndefined();
    },
  );

  it("espaço duplo no nome não é palpite — é o mesmo nome", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Maquina: "A1  Combo" }),
      machines,
      opcoes,
    );
    expect(r.products[0].machineId).toBe("a1");
    expect(achar(r.issues, "maquina-por-aproximacao")).toBeUndefined();
  });

  it("em escala: 100 linhas com o id não acendem nada", () => {
    const linhas = ["Produto;Maquina;Tempo (h)"];
    for (let i = 0; i < 100; i += 1) linhas.push(`Caneca ${i};A1;2`);
    const r = parseProductsCsv(linhas.join("\n"), machines, opcoes);
    expect(r.products).toHaveLength(100);
    expect(achar(r.issues, "maquina-por-aproximacao")).toBeUndefined();
  });

  it("o palpite de verdade (id DENTRO de um nome maior) continua avisando", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Maquina: "AnyCubic A1 Mini" }),
      machines,
      opcoes,
    );
    expect(r.products[0].machineId).toBe("a1");
    expect(achar(r.issues, "maquina-por-aproximacao")?.linhas).toBe(1);
  });
});


// ---------------------------------------------------------------------------
// AUD-13, lote E — a poeira do parser (CSV-33, CSV-35, CSV-37).
// ---------------------------------------------------------------------------

describe("CSV-33 — Pecas zero ou negativa não entra calada", () => {
  it('"0" e "-1" entram como 1 E acendem a classe', () => {
    for (const bruto of ["0", "-1", "-3"]) {
      const r = parseProductsCsv(
        csv({ ...LINHA_BOA, Pecas: bruto }),
        machines,
        opcoes,
      );
      expect(r.products[0].piecesCount).toBe(1);
      const issue = achar(r.issues, "pecas-invalida");
      expect(issue?.linhas).toBe(1);
      // O aviso cita a célula CRUA — o número que o dono procura na planilha.
      expect(issue?.exemplos[0]).toContain(`"${bruto}"`);
    }
  });

  it("coluna ausente e célula VAZIA seguem sendo ausência, não erro", () => {
    const semColuna = parseProductsCsv(csv(LINHA_BOA), machines, opcoes);
    expect(semColuna.products[0].piecesCount).toBe(1);
    expect(achar(semColuna.issues, "pecas-invalida")).toBeUndefined();

    const vazia = parseProductsCsv(
      csv({ ...LINHA_BOA, Pecas: "" }),
      machines,
      opcoes,
    );
    expect(vazia.products[0].piecesCount).toBe(1);
    expect(achar(vazia.issues, "pecas-invalida")).toBeUndefined();
  });

  it("ilegível continua com a classe do CSV-09, sem aviso em dobro", () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Pecas: "abc" }),
      machines,
      opcoes,
    );
    expect(r.products[0].piecesCount).toBe(1);
    expect(achar(r.issues, "coluna-numero-nao-reconhecido")?.linhas).toBe(1);
    expect(achar(r.issues, "pecas-invalida")).toBeUndefined();
  });

  it("peça válida não acende nada — e a fracionária segue com o dono do CSV-31", () => {
    const boa = parseProductsCsv(
      csv({ ...LINHA_BOA, Pecas: "4" }),
      machines,
      opcoes,
    );
    expect(boa.products[0].piecesCount).toBe(4);
    expect(achar(boa.issues, "pecas-invalida")).toBeUndefined();

    // > 1 e fracionária: passa aqui de propósito, o validateProduct é que reprova.
    const fracionaria = parseProductsCsv(
      csv({ ...LINHA_BOA, Pecas: "1.234" }),
      machines,
      opcoes,
    );
    expect(achar(fracionaria.issues, "pecas-invalida")).toBeUndefined();
    expect(achar(fracionaria.issues, "linha-invalida")?.exemplos[0]).toContain(
      "inteiro",
    );
  });
});

describe("CSV-35 — coluna repetida com grafia VARIANTE recebe o conselho certo", () => {
  it('"Peso (g);Peso" é repetida, não "nome não reconhecido"', () => {
    const r = parseProductsCsv(
      // Sem as cores, o peso escalar é o que entra no documento (CSV/RT-01).
      csv({ ...sem(LINHA_BOA, "Filamentos JSON"), "Peso (g)": "50", Peso: "80" }),
      machines,
      opcoes,
    );
    expect(r.warnings.join(" ")).toContain("Coluna(s) repetida(s)");
    expect(r.warnings.join(" ")).not.toContain("não foi reconhecido");
    // Vale a primeira da esquerda para a direita — a variante é descartada.
    expect(r.products[0].weightG).toBe(50);
  });

  it("a abreviação sozinha continua sendo RECLAMADA, não descartada", () => {
    const r = parseProductsCsv(
      csv({ ...sem(LINHA_BOA, "Tempo (h)"), Tempo: "2" }),
      machines,
      opcoes,
    );
    expect(r.products[0].printHours).toBe(2);
    expect(r.warnings.join(" ")).not.toContain("repetida");
  });

  it("⚠ nome com palavra a MAIS não é variante — segue 'ignorada'", () => {
    // A trava do AUD-11/D-3: "Tempo de cura (h)" é OUTRA coluna, e o conselho
    // "apague a coluna extra" seria errado.
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, "Tempo de cura (h)": "11" }),
      machines,
      opcoes,
    );
    expect(r.warnings.join(" ")).toContain("Coluna(s) ignorada(s)");
    expect(r.warnings.join(" ")).not.toContain("repetida");
  });

  it("a duplicata EXATA do CSV-28 não regrediu", () => {
    const cru = `Produto;Peso (g);Peso (g);Tempo (h)
Caneca;50;80;2`;
    const r = parseProductsCsv(cru, machines, opcoes);
    expect(r.warnings.join(" ")).toContain("Coluna(s) repetida(s)");
    expect(r.products[0].weightG).toBe(50);
  });
});

describe("CSV-37 — letra no meio do número não vira outro número", () => {
  it('Markup "5X0" não entra como 50 — acende o markup-invalido e usa 3x', () => {
    const r = parseProductsCsv(
      csv({ ...LINHA_BOA, Markup: "5X0" }),
      machines,
      opcoes,
    );
    expect(r.products[0].markup).toBe(3);
    expect(achar(r.issues, "markup-invalido")?.exemplos[0]).toContain("5X0");
  });

  it('"5x", "X5" e "5 x" continuam valendo 5 — o "x" é sufixo, não erro', () => {
    for (const bruto of ["5x", "X5", "5 x", "5"]) {
      const r = parseProductsCsv(
        csv({ ...LINHA_BOA, Markup: bruto }),
        machines,
        opcoes,
      );
      expect(r.products[0].markup).toBe(5);
      expect(achar(r.issues, "markup-invalido")).toBeUndefined();
    }
  });

  it("a mesma trava vale para as colunas escalares", () => {
    const r = parseProductsCsv(
      csv({ ...sem(LINHA_BOA, "Filamentos JSON"), "Peso (g)": "2h30" }),
      machines,
      opcoes,
    );
    // Antes: 230 g calados. Agora cai no default da coluna, com a classe do CSV-09.
    expect(achar(r.issues, "coluna-numero-nao-reconhecido")?.exemplos[0]).toContain(
      "2h30",
    );
    expect(r.products[0].weightG).not.toBe(230);
  });
});

// AUD-14/D1 — a reprodução do defeito, do jeito que ele apareceu: o CSV
// exportado abriu no Excel 16 pt-BR, foi salvo e reimportado. Seis dos 97
// produtos voltaram com `Tempo (h)` multiplicado por 10¹⁵ e a importação
// devolveu `warnings: []` — nenhum aviso sobre o número.
describe("AUD-14/D1 — o decimal que o Excel transformou em milhar", () => {
  it("o valor medido acende a classe, citando a célula crua e o que entrou", () => {
    const resultado = parseProductsCsv(
      csv({ ...LINHA_BOA, "Tempo (h)": "5.283.333.333.333.330" }),
      machines,
      opcoes,
    );
    const issue = achar(resultado.issues, "magnitude-absurda");
    expect(issue?.linhas).toBe(1);
    expect(issue?.exemplos[0]).toContain('"5.283.333.333.333.330"');
    expect(issue?.exemplos[0]).toContain("5283333333333330");
    // A classe de UM grupo não se mete: as duas leituras não são plausíveis
    // aqui, e o conselho é outro.
    expect(achar(resultado.issues, "milhar-ambiguo")).toBeUndefined();
  });

  it("`Tempo (h)` estava FORA da checagem de 3b — é a coluna do defeito", () => {
    // O argumento que excluía a coluna de lá ("2375 h são 99 dias, absurdo") é
    // o que a traz para cá: absurdo é justamente o que se quer apontar.
    const antes = parseProductsCsv(csv({ ...LINHA_BOA, "Tempo (h)": "2.375" }), machines, opcoes);
    expect(achar(antes.issues, "magnitude-absurda")).toBeUndefined();
    expect(achar(antes.issues, "milhar-ambiguo")).toBeUndefined();
  });

  it("`Taxa Falha (%)` entra porque o clamp de 95 ESCONDE o estrago", () => {
    const resultado = parseProductsCsv(
      csv({ ...LINHA_BOA, "Taxa Falha (%)": "5.283.333" }),
      machines,
      opcoes,
    );
    expect(achar(resultado.issues, "magnitude-absurda")?.linhas).toBe(1);
    // O produto entra com 95% de reserva de falha; sem o aviso, nada dizia que
    // a célula estava corrompida.
    expect(resultado.products[0].failureRate).toBe(95);
  });

  it("as outras colunas que entram no documento", () => {
    const colunas: Record<string, string> = {
      "Peso (g)": "1.234.567",
      Pecas: "1.234.567",
      "Filamento (R$/kg)": "1.234.567",
      Markup: "1.234.567x",
      "Mao de obra (min)": "1.234.567",
      "Valor-hora (R$)": "1.234.567",
      "Tarifa Energia": "1.234.567",
      "Tempo (min)": "1.234.567",
    };
    Object.entries(colunas).forEach(([coluna, valor]) => {
      const resultado = parseProductsCsv(csv({ ...LINHA_BOA, [coluna]: valor }), machines, opcoes);
      expect(
        achar(resultado.issues, "magnitude-absurda"),
        `coluna "${coluna}" não acendeu`,
      ).toBeDefined();
    });
  });

  it("dentro do JSON tem classe própria — lá o conselho é outro", () => {
    const resultado = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": JSON.stringify([
          { filamentId: "cor_laranja", colorName: "Laranja", pricePerKg: 110, totalG: "1.234.567" },
        ]),
      }),
      machines,
      opcoes,
    );
    expect(achar(resultado.issues, "magnitude-absurda-json")?.linhas).toBe(1);
    expect(achar(resultado.issues, "milhar-ambiguo-json")).toBeUndefined();
  });

  it("contraponto: a linha boa não acende nenhuma das duas", () => {
    const resultado = parseProductsCsv(csv(LINHA_BOA), machines, opcoes);
    expect(achar(resultado.issues, "magnitude-absurda")).toBeUndefined();
    expect(achar(resultado.issues, "magnitude-absurda-json")).toBeUndefined();
  });

  it("o decimal em pt-BR que o export passou a escrever atravessa intacto", () => {
    const resultado = parseProductsCsv(
      csv({ ...LINHA_BOA, "Tempo (h)": "5,283333333333333" }),
      machines,
      opcoes,
    );
    expect(achar(resultado.issues, "magnitude-absurda")).toBeUndefined();
    expect(resultado.products[0].printHours).toBe(5.283333333333333);
  });
});


// AUD-15/E6 — a trava que a AUD-14 escreveu era de PONTUAÇÃO, e a justificativa
// escrita ao lado dela era de MAGNITUDE. Quem gera a planilha da carga é um
// sistema EXTERNO: a forma que ele escreve o número não é escolha do app, então
// a trava não pode depender dela.
describe("AUD-15/E6 — o valor absurdo entra em qualquer formato, e agora acende em todos", () => {
  // As 3 escritas medidas na AUD-15, todas valendo R$ 1,2 milhão por hora de
  // mão de obra. Antes: `issues: []` e `warnings: []` nas três.
  const formas = {
    "com decimal junto (pt-BR)": "1.234.567,89",
    "en-US": "1,234,567.89",
    "com decimal zerado": "1.234.567,00",
    "inteiro cru, sem pontuação": "1234567",
  };
  Object.entries(formas).forEach(([nome, valor]) => {
    it(`Valor-hora de 1,2 milhão ${nome} acende`, () => {
      const resultado = parseProductsCsv(
        csv({ ...LINHA_BOA, "Valor-hora (R$)": valor }),
        machines,
        opcoes,
      );
      const issue = achar(resultado.issues, "magnitude-absurda");
      expect(issue?.linhas).toBe(1);
      expect(issue?.exemplos[0]).toContain(`"${valor}"`);
      expect(issue?.exemplos[0]).toContain("Valor-hora (R$)");
    });
  });

  it("dentro do JSON, o mesmo — inclusive quando o número não é texto", () => {
    const resultado = parseProductsCsv(
      csv({
        ...LINHA_BOA,
        "Filamentos JSON": JSON.stringify([
          { filamentId: "cor_laranja", colorName: "Laranja", pricePerKg: 1234567, totalG: 50 },
        ]),
      }),
      machines,
      opcoes,
    );
    expect(achar(resultado.issues, "magnitude-absurda-json")?.linhas).toBe(1);
  });

  it("o teto plausível de 999.999 continua atravessando calado", () => {
    const resultado = parseProductsCsv(
      csv({ ...LINHA_BOA, "Valor-hora (R$)": "999.999,00" }),
      machines,
      opcoes,
    );
    expect(achar(resultado.issues, "magnitude-absurda")).toBeUndefined();
    expect(resultado.products[0].laborRate).toBe(999999);
  });
});
