// Busca por texto tolerante a acento e caixa (UX-05). Enquanto as listas
// limitadas (catálogo, estoque) moram inteiras no cliente, o filtro é local:
// normaliza os dois lados e testa substring. Quando a TD-006 paginar vendas/
// produção, ESSAS buscas viram query no Firestore — este helper segue valendo
// só para as listas que continuam inteiras.

// "Ação" e "acao" batem: tira acento (NFD + remove diacríticos), caixa e
// espaços das pontas. Um único ponto de verdade para toda busca client-side.
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

// Casa quando cada palavra da busca aparece em algum dos campos. Vários campos
// (ex.: material + cor de um filamento) contam como um texto só. Busca vazia
// casa com tudo — o filtro some quando não há termo.
export function matchesQuery(query: string, ...fields: string[]): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const haystack = normalizeText(fields.join(" "));
  return q.split(/\s+/).every((term) => haystack.includes(term));
}
