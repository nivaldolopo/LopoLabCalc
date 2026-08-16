// UX-19 — faixa de margem: a régua que decide se um número é ruim, ok ou bom.
//
// Os cortes são a [DEC-04] (dono, 2026-08-15): `< 50%` ruim · `50–65%` ok ·
// `> 65%` bom. Ficam AQUI, numa constante nomeada, e não como três literais
// espalhados pelos componentes — a régua é uma decisão de negócio, e mudá-la
// deve ser um lugar só.
//
// ⚠ A MESMA régua vale nas 4 superfícies, mas os números medem coisas
// diferentes (e isso é aceito de propósito): catálogo e calculadora = margem
// PRECIFICADA (bruta, pré-taxa); `/vendas` = lucro REALIZADO (já líquido da
// taxa de pagamento); estoque = margem CONGELADA da camada. A pergunta que a
// cor responde é "isso é um bom negócio?", não "é a mesma grandeza?".

export type MarginTier = "bad" | "ok" | "good";

// Piso de cada faixa, em % sobre o preço final.
export const MARGIN_TIER_CUTS = { ok: 50, good: 65 } as const;

// Bordas exatamente como a DEC-04 foi escrita: `50` cai em OK (a faixa é
// "50–65", fechada nas duas pontas) e `65` também — "bom" começa ACIMA de 65.
//
// ⚠ A faixa é do número ARREDONDADO, o mesmo que o `toFixed(0)` põe na tela.
// Sem isso, 65,4% e 65,6% aparecem os DOIS como "65%" com cores diferentes —
// pego medindo o catálogo real, que tinha 65% âmbar e 65% verde lado a lado. A
// cor tem que explicar o número que está escrito, não um decimal invisível.
//
// Devolve `null` para valor não-finito: margem é derivada de uma divisão pela
// receita, e recibo com receita 0 produz NaN/Infinity. Pintar isso seria pior
// que não pintar — quem chama trata o `null` como "sem faixa".
export function marginTier(pct: number): MarginTier | null {
  if (!Number.isFinite(pct)) return null;
  const shown = Math.round(pct);
  if (shown < MARGIN_TIER_CUTS.ok) return "bad";
  if (shown > MARGIN_TIER_CUTS.good) return "good";
  return "ok";
}

// Classe CSS da faixa (declarada no `base.css`, junto dos tokens de cor).
// String vazia quando não há faixa — o elemento fica sem classe e herda a cor
// de sempre.
export function marginTierClass(pct: number): string {
  const tier = marginTier(pct);
  return tier ? `margin-${tier}` : "";
}

const TIER_WORD: Record<MarginTier, string> = {
  bad: "baixa",
  ok: "ok",
  good: "boa",
};

// Texto do `title`. Existe para a faixa não ser transmitida SÓ por cor: o
// número já está escrito, e o tooltip nomeia a faixa e mostra a régua inteira.
export function marginTierTitle(pct: number): string {
  const tier = marginTier(pct);
  if (!tier) return "";
  return (
    `Margem ${TIER_WORD[tier]} — a régua é: abaixo de ${MARGIN_TIER_CUTS.ok}% baixa · ` +
    `${MARGIN_TIER_CUTS.ok}–${MARGIN_TIER_CUTS.good}% ok · acima de ${MARGIN_TIER_CUTS.good}% boa.`
  );
}
