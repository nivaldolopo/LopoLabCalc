import { describe, expect, it } from "vitest";
import { isMagnitudeAbsurda, isMilharAmbiguo, parseDecimalPtBr } from "./number";

describe("parseDecimalPtBr", () => {
  it("lê o pt-BR do dia a dia", () => {
    expect(parseDecimalPtBr("1,5")).toBe(1.5);
    expect(parseDecimalPtBr("143,53")).toBe(143.53);
    expect(parseDecimalPtBr("200,00")).toBe(200);
    expect(parseDecimalPtBr("-12,50")).toBe(-12.5);
  });

  it("lê o ponto decimal — é o que o próprio export escreve", () => {
    expect(parseDecimalPtBr("2.375")).toBe(2.375);
    expect(parseDecimalPtBr("27.14")).toBe(27.14);
    expect(parseDecimalPtBr("0.8")).toBe(0.8);
  });

  it("descarta moeda, espaço comum e os espaços do Excel", () => {
    expect(parseDecimalPtBr("R$ 118,90")).toBe(118.9);
    expect(parseDecimalPtBr("1 234,56")).toBe(1234.56);
    expect(parseDecimalPtBr("1 234,56")).toBe(1234.56);
    expect(parseDecimalPtBr("1 234,56")).toBe(1234.56);
  });

  it("CSV-08: com os DOIS separadores, o ÚLTIMO é o decimal", () => {
    // pt-BR
    expect(parseDecimalPtBr("1.234,56")).toBe(1234.56);
    // en-US — o Google Sheets em locale americano. Antes virava 1.23456.
    expect(parseDecimalPtBr("1,234.56")).toBe(1234.56);
    expect(parseDecimalPtBr("1,234,567.89")).toBe(1234567.89);
    expect(parseDecimalPtBr("1.234.567,89")).toBe(1234567.89);
  });

  it("CSV-08: separador REPETIDO só pode ser milhar", () => {
    // Antes o parseFloat truncava em 1.234.
    expect(parseDecimalPtBr("1.234.567")).toBe(1234567);
    expect(parseDecimalPtBr("1,234,567")).toBe(1234567);
  });

  it("devolve null — não 0 — para o que não é número", () => {
    expect(parseDecimalPtBr("")).toBeNull();
    expect(parseDecimalPtBr("   ")).toBeNull();
    expect(parseDecimalPtBr(null)).toBeNull();
    expect(parseDecimalPtBr(undefined)).toBeNull();
    expect(parseDecimalPtBr("abc")).toBeNull();
    expect(parseDecimalPtBr("R$")).toBeNull();
    expect(parseDecimalPtBr(NaN)).toBeNull();
    expect(parseDecimalPtBr(Infinity)).toBeNull();
  });

  it("zero é zero, e não se confunde com ilegível", () => {
    expect(parseDecimalPtBr("0")).toBe(0);
    expect(parseDecimalPtBr("0,00")).toBe(0);
    expect(parseDecimalPtBr(0)).toBe(0);
  });

  it("número já numérico passa direto", () => {
    expect(parseDecimalPtBr(143.53)).toBe(143.53);
    expect(parseDecimalPtBr(-2)).toBe(-2);
  });
});

describe("isMilharAmbiguo", () => {
  it("CSV-07: acende no que é estruturalmente ambíguo", () => {
    expect(isMilharAmbiguo("1.234")).toBe(true);
    expect(isMilharAmbiguo("999.000")).toBe(true);
    // "2.375" é ambíguo do MESMO jeito — ler a estrutura não distingue os dois,
    // e é por isso que quem decide se vale avisar é a COLUNA (ver productCsv).
    expect(isMilharAmbiguo("2.375")).toBe(true);
  });

  it("CSV-07: acende MESMO com prefixo de moeda — o cru quebrava a âncora `^`", () => {
    expect(isMilharAmbiguo("R$ 1.234")).toBe(true);
    expect(isMilharAmbiguo(" 1.234 ")).toBe(true);
    expect(isMilharAmbiguo("R$ 1.234,00")).toBe(false);
  });

  it("não acende no que não tem a forma", () => {
    expect(isMilharAmbiguo("27.14")).toBe(false);
    expect(isMilharAmbiguo("1.5")).toBe(false);
    expect(isMilharAmbiguo("1.234,56")).toBe(false);
    expect(isMilharAmbiguo("143,53")).toBe(false);
    expect(isMilharAmbiguo("1.2345")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AUD-11/D-4 — dois formatos que a limpeza `[^\d.,-]` destruía em silêncio.
// ---------------------------------------------------------------------------

describe("AUD-11/D-4 — notação científica", () => {
  it("o que ANTES virava outro número plausível", () => {
    // Medidos na varredura: "1e3" saía 13, "1E+03" saía 103, "1,5E+03" saía 1,503.
    expect(parseDecimalPtBr("1e3")).toBe(1000);
    expect(parseDecimalPtBr("1E+03")).toBe(1000);
    expect(parseDecimalPtBr("1,5E+03")).toBe(1500);
  });

  it("mantissa em pt-BR e em en-US, expoente com e sem sinal", () => {
    expect(parseDecimalPtBr("2.5e2")).toBe(250);
    expect(parseDecimalPtBr("2,5e2")).toBe(250);
    expect(parseDecimalPtBr("2E-05")).toBeCloseTo(0.00002, 12);
    expect(parseDecimalPtBr("-1,5E3")).toBe(-1500);
    expect(parseDecimalPtBr("+1E2")).toBe(100);
  });

  it("símbolo de moeda e espaço em volta continuam tolerados", () => {
    expect(parseDecimalPtBr("R$ 1E+03")).toBe(1000);
    expect(parseDecimalPtBr(" 1e3 ")).toBe(1000);
  });

  it("⚠ TEXTO com 'e' no meio NÃO vira número — o espaço é a trava", () => {
    // Sem preservar o espaço na limpeza, "2 e 5" colaria em "2e5" = 200000.
    expect(parseDecimalPtBr("2 e 5")).not.toBe(200000);
    expect(parseDecimalPtBr("5 metros")).toBe(5);
    expect(parseDecimalPtBr("1E")).toBe(1);
    expect(parseDecimalPtBr("e5")).toBe(5);
  });

  it("não muda nada no caminho normal", () => {
    expect(parseDecimalPtBr("143,53")).toBe(143.53);
    expect(parseDecimalPtBr("1.234,56")).toBe(1234.56);
    expect(parseDecimalPtBr("1.234")).toBe(1.234);
    expect(parseDecimalPtBr("1.234.567")).toBe(1234567);
  });
});

describe("AUD-11/D-4 — negativo contábil entre parênteses", () => {
  it("(500) é MENOS quinhentos, não mais quinhentos", () => {
    expect(parseDecimalPtBr("(500)")).toBe(-500);
    expect(parseDecimalPtBr("(1.234,56)")).toBe(-1234.56);
    expect(parseDecimalPtBr("(R$ 80,00)")).toBe(-80);
  });

  it("parêntese que não envolve TUDO não conta", () => {
    expect(parseDecimalPtBr("a(5)b")).toBe(5);
    expect(parseDecimalPtBr("(abc)")).toBe(null);
  });

  it("o negativo entra e o validateProduct é quem reprova depois", () => {
    // A leitura fica correta aqui; recusar peso negativo é papel de quem valida.
    expect(parseDecimalPtBr("(200)")).toBe(-200);
  });
});

// CSV-29 — o alarme sobre dado CORRETO. A científica é lida certa pelo
// `parseDecimalPtBr` (a checagem dele roda antes da limpeza), mas a limpeza do
// `isMilharAmbiguo` apagava o "E+" e colava "1.503", que casa o padrão de
// milhar. O aviso sairia dizendo que 1500 virou 1,234 — contraditório.
describe("CSV-29 — isMilharAmbiguo não acende sobre notação científica", () => {
  it("científica é lida certa e NÃO vira aviso", () => {
    expect(parseDecimalPtBr("1.5E+03")).toBe(1500);
    expect(isMilharAmbiguo("1.5E+03")).toBe(false);
  });

  it("as outras formas de científica também ficam mudas", () => {
    for (const entrada of ["1e3", "1E+03", "1,5E+03", "2.5e-03"]) {
      expect(isMilharAmbiguo(entrada)).toBe(false);
    }
  });

  it("o milhar ambíguo de verdade continua acendendo", () => {
    expect(isMilharAmbiguo("1.234")).toBe(true);
    expect(isMilharAmbiguo("R$ 1.234")).toBe(true);
    expect(isMilharAmbiguo("(1.234)")).toBe(true);
  });

  it('"2 e 5" não é científica nem milhar — e segue sem virar 200000', () => {
    expect(isMilharAmbiguo("2 e 5")).toBe(false);
    expect(parseDecimalPtBr("2 e 5")).not.toBe(200000);
  });
});

// CSV-37 (AUD-13, lote E) — a limpeza apaga o que não é dígito e COLA o resto:
// um erro de digitação virava outro número plausível, sem nada avisando.
describe("CSV-37 — letra ENTRE dígitos não é número", () => {
  it("o caso medido e os vizinhos dele", () => {
    expect(parseDecimalPtBr("5X0")).toBeNull();
    expect(parseDecimalPtBr("5x0")).toBeNull();
    expect(parseDecimalPtBr("2h30")).toBeNull();
    expect(parseDecimalPtBr("1.2a34")).toBeNull();
  });

  it("letra ANTES ou DEPOIS segue tolerada — é unidade e moeda", () => {
    expect(parseDecimalPtBr("R$ 50")).toBe(50);
    expect(parseDecimalPtBr("5 metros")).toBe(5);
    expect(parseDecimalPtBr("5x")).toBe(5);
    expect(parseDecimalPtBr("X5")).toBe(5);
    expect(parseDecimalPtBr("50%")).toBe(50);
    expect(parseDecimalPtBr("1.234,56 kg")).toBe(1234.56);
  });

  it("a científica sai ANTES da trava e continua sendo lida", () => {
    expect(parseDecimalPtBr("1e3")).toBe(1000);
    expect(parseDecimalPtBr("1,5E+03")).toBe(1500);
    expect(parseDecimalPtBr("2E-05")).toBeCloseTo(0.00002, 12);
  });

  it('"2 e 5" era o exemplo do AUD-11/D-4 — agora é null, não 25', () => {
    expect(parseDecimalPtBr("2 e 5")).toBeNull();
  });
});

// AUD-14/D1 + AUD-15/E6 — o valor GRANDE DEMAIS. Não é ambiguidade de leitura:
// o número está errado, tenha ele chegado agrupado pelo Excel pt-BR ou escrito
// em qualquer outro formato.
describe("isMagnitudeAbsurda — o número que não cabe em coluna nenhuma daqui", () => {
  it("os 6 valores medidos na AUD-14, crus do arquivo salvo pelo Excel", () => {
    expect(isMagnitudeAbsurda("5.283.333.333.333.330")).toBe(true);
    expect(isMagnitudeAbsurda("52.666.666.666.666.600")).toBe(true);
    expect(isMagnitudeAbsurda("25.833.333.333.333.300")).toBe(true);
    expect(isMagnitudeAbsurda("6.183.333.333.333.330")).toBe(true);
    expect(isMagnitudeAbsurda("3.506.666.666.666.660")).toBe(true);
    expect(isMagnitudeAbsurda("7.366.666.666.666.660")).toBe(true);
  });

  it("1,2 milhão não é valor de nenhuma coluna daqui", () => {
    expect(isMagnitudeAbsurda("1.234.567")).toBe(true);
    expect(isMagnitudeAbsurda("R$ 1.234.567")).toBe(true);
    expect(isMagnitudeAbsurda("-1.234.567")).toBe(true);
  });

  // AUD-15/E6 — as 4 formas medidas que a trava de PONTUAÇÃO deixava passar:
  // qualquer parte decimal desarmava a âncora do fim, e en-US ou inteiro cru
  // nunca casavam o padrão. Todas valem 1,2 milhão.
  it("as 4 formas que a trava de pontuação deixava passar (E6)", () => {
    expect(isMagnitudeAbsurda("1.234.567,89")).toBe(true);
    expect(isMagnitudeAbsurda("1,234,567.89")).toBe(true);
    expect(isMagnitudeAbsurda("1.234.567,00")).toBe(true);
    expect(isMagnitudeAbsurda("1234567")).toBe(true);
    // O que está errado é o VALOR, não a leitura: as três escritas são lidas
    // certo, e é exatamente por isso que passavam caladas.
    expect(parseDecimalPtBr("1.234.567,89")).toBeCloseTo(1234567.89, 2);
    expect(parseDecimalPtBr("1,234,567.89")).toBeCloseTo(1234567.89, 2);
    expect(parseDecimalPtBr("1234567")).toBe(1234567);
  });

  it("a borda é 999.999 — o teto plausível NÃO acende, o que passa dele sim", () => {
    expect(isMagnitudeAbsurda("999999")).toBe(false);
    expect(isMagnitudeAbsurda("999.999,00")).toBe(false);
    expect(isMagnitudeAbsurda("999.999,99")).toBe(true);
    expect(isMagnitudeAbsurda("1000000")).toBe(true);
    expect(isMagnitudeAbsurda("-1.000.000")).toBe(true);
  });

  it("UM grupo continua sendo do isMilharAmbiguo, e não daqui", () => {
    expect(isMagnitudeAbsurda("1.234")).toBe(false);
    expect(isMilharAmbiguo("1.234")).toBe(true);
  });

  it("não acende no que o próprio export escreve", () => {
    expect(isMagnitudeAbsurda("5,283333333333333")).toBe(false);
    expect(isMagnitudeAbsurda("5.283333333333333")).toBe(false);
    expect(isMagnitudeAbsurda("2,5")).toBe(false);
    expect(isMagnitudeAbsurda("1.234,56")).toBe(false);
    expect(isMagnitudeAbsurda("")).toBe(false);
    expect(isMagnitudeAbsurda(5.28)).toBe(false);
  });

  // A versão de FORMA precisava excluir a científica para não mentir (CSV-29:
  // a limpeza colava "1.5E+03" em "1.503" e o aviso sairia contraditório). A de
  // MAGNITUDE lê o valor de verdade, então a científica entra pelo mérito.
  it("científica agora entra pelo VALOR, não pela pontuação", () => {
    expect(isMagnitudeAbsurda("5,28E+15")).toBe(true);
    expect(isMagnitudeAbsurda("1.5E+03")).toBe(false);
    // "1.234.567E+03" não é número nenhum (letra entre dígitos) — o que não se
    // lê já tem a classe dele, a `ilegivel`.
    expect(parseDecimalPtBr("1.234.567E+03")).toBeNull();
    expect(isMagnitudeAbsurda("1.234.567E+03")).toBe(false);
  });

  // Dentro de uma célula JSON o número chega como `number`, e a versão de forma
  // devolvia false para tudo que não fosse string.
  it("número cru também é valor, e também é absurdo", () => {
    expect(isMagnitudeAbsurda(1234567)).toBe(true);
    expect(isMagnitudeAbsurda(-5283333333333330)).toBe(true);
    expect(isMagnitudeAbsurda(999999)).toBe(false);
  });

  it("grupo de tamanho errado não é milhar — mas o VALOR ainda decide", () => {
    // Nenhum dos dois casa regra de milhar nenhuma; o parse lê os pontos
    // repetidos como agrupamento, e aí quem decide é o tamanho do que saiu.
    expect(isMagnitudeAbsurda("1.23.456")).toBe(false);
    expect(isMagnitudeAbsurda("1.2345.678")).toBe(true);
  });

  it("o número lido continua sendo o milhar — o defeito é o valor, não a leitura", () => {
    expect(parseDecimalPtBr("5.283.333.333.333.330")).toBe(5283333333333330);
  });
});
