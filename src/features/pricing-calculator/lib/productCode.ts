// S2 (frente 3a) — o CÓDIGO do produto: `LL-0042`. Gerado pelo site na
// criação (contador único em transação, `config/produtoSeq`), nunca
// reaproveitado, sem significado embutido e não editável. É o apelido mais
// forte de uma impressão: o dono põe o código no nome do projeto no Bambu
// Studio (`LL-0042 Quatto face`) e a impressão chega reconhecida desde a 1ª.
//
// O zero à esquerda é só visual: `LL-10000` segue o mesmo formato sem quebrar.

export const PRODUCT_CODE_PREFIX = "LL";
const PAD = 4;

export function formatProductCode(sequence: number): string {
  return `${PRODUCT_CODE_PREFIX}-${String(sequence).padStart(PAD, "0")}`;
}

// Leitura TOLERANTE: `LL-0042`, `LL0042`, `ll-42`, `LL_42`, `LL 42` e o código
// no meio de um título (`LL-0042 Quatto face`) viram `LL-0042`. A borda da
// frente impede `ALL-42` de casar; a de trás, `LL-42abc` e número que continua
// (`LL-3.2`, `LL-42-7` — versão, não código). Número 0 não é código (o
// contador começa em 1) → `null`, nunca um palpite.
const CODE_PATTERN = /(?:^|[^a-z0-9])ll[-_ ]?(\d{1,7})(?![a-z0-9]|[.,-]\d)/i;

export function parseProductCode(text: string | null | undefined): string | null {
  const match = CODE_PATTERN.exec(String(text ?? ""));
  if (!match) return null;
  const sequence = Number(match[1]);
  if (!Number.isInteger(sequence) || sequence < 1) return null;
  return formatProductCode(sequence);
}
