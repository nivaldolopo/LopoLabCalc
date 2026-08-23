// Leitura de número escrito por gente — o INVERSO do `formatDecimal` daqui do
// lado (`currency.ts`). O app tinha o caminho de saída (número → "1.234,56") e
// nenhum de entrada: cada porta que recebia texto improvisou o seu, e as quatro
// improvisaram errado. O CSV tinha um `parseNumber` decente só nas colunas
// escalares; dentro dos JSONs era `Number(x) || 0`, e o `NumberInput` era
// `Number(raw)`. Em pt-BR isso significa que "1,5" vira 0 — ou, pior, que
// "143,53" digitado vira 14353 quando o navegador come a vírgula.
//
// Uma função só, usada pelas quatro (CSV-06/07/08 + UX-41).

// Devolve `null` — e não 0 — quando não consegue ler. A diferença é o item
// inteiro: 0 é um número plausível que se confunde com "campo vazio", e foi
// exatamente assim que a importação zerou preço em silêncio. Quem quiser o
// comportamento leniente escreve `?? 0` e assume a escolha na cara.
export function parseDecimalPtBr(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  // Fora símbolo de moeda, espaço comum e os espaços não-separáveis (U+00A0 /
  // U+202F) que o Excel usa como milhar. Sobra dígito, sinal e separador.
  const limpo = raw.replace(/[^\d.,-]/g, "");
  if (!limpo || !/\d/.test(limpo)) return null;

  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  let normalizado: string;

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    // Os DOIS separadores presentes: o que vem por ÚLTIMO é o decimal, o outro
    // é milhar. É o que separa "1.234,56" (pt-BR) de "1,234.56" (en-US) —
    // CSV-08, que antes lia o segundo como 1,23456 (mil vezes menor).
    const decimal = ultimaVirgula > ultimoPonto ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    normalizado =
      limpo.split(milhar).join("").replace(decimal, ".");
  } else {
    const sep = ultimaVirgula >= 0 ? "," : ultimoPonto >= 0 ? "." : "";
    const ocorrencias = sep ? limpo.split(sep).length - 1 : 0;
    if (ocorrencias > 1) {
      // Repetido só pode ser milhar: "1.234.567" — que antes o `parseFloat`
      // truncava em 1.234 (CSV-08).
      normalizado = limpo.split(sep).join("");
    } else {
      // Uma ocorrência = decimal, nos dois separadores. A vírgula é o pt-BR
      // natural; o ponto é a forma que o próprio export escreve, e reinterpretá-lo
      // como milhar quebraria o round-trip do arquivo do app. O caso de verdade
      // ambíguo — "1.234", que no Excel pt-BR é mil duzentos e trinta e quatro —
      // não é adivinhado aqui: quem importa o APONTA (`milhar-ambiguo`).
      normalizado = sep === "," ? limpo.replace(",", ".") : limpo;
    }
  }

  const parsed = Number(normalizado);
  return Number.isFinite(parsed) ? parsed : null;
}

// "1.234" — um ponto, exatamente 3 dígitos depois e nada mais. Escrito à mão em
// pt-BR quase sempre é milhar; vindo do export é decimal. As duas leituras são
// plausíveis e diferem por 1000×, então a importação não escolhe calada.
//
// ⚠ CSV-07: isto se testa no texto LIMPO, nunca no cru. No cru o teste errava
// dos dois lados — "R$ 1.234" não acendia (o prefixo quebra a âncora `^`) e o
// `2.375` que o próprio export escreve acendia à toa no round-trip.
export function isMilharAmbiguo(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const limpo = value.replace(/[^\d.,-]/g, "");
  return /^-?\d{1,3}\.\d{3}$/.test(limpo);
}
