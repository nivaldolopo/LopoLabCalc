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
    expect(r.warnings).toEqual([]);
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
    expect(r.warnings).toEqual([]);
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
    expect(r.warnings).toEqual([]);
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
