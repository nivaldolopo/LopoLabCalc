// Utilitários numéricos compartilhados. Antes viviam duplicados em
// calculatePricing, machineRoi e nos repositórios (num) e em SaleModal/
// ProductCatalog (round2).

// Coage qualquer valor a número finito; devolve 0 para NaN/undefined/null/strings
// inválidas. Usado tanto na matemática pura quanto ao ler dados do Firestore
// (onde um campo pode vir como string).
export function num(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

// Arredonda para centavos (2 casas). O preço sugerido no modo "exato" vem com
// muitas casas; este corte evita ruído de ponto flutuante em valores exibidos.
export function round2(value: number): number {
  return Math.round(num(value) * 100) / 100;
}
