// Arredondamento do preço sugerido para valores "de mercado".
// Sempre arredonda PARA CIMA (ceil), pra nunca cair abaixo do preço calculado
// e comer a margem — o valor exibido é sempre >= ao valor exato.

export type RoundingMode = "exact" | "0.5" | "1" | "5" | "10" | "0.90";

export const ROUNDING_OPTIONS: { value: RoundingMode; label: string }[] = [
  { value: "exact", label: "Exato (sem arredondar)" },
  { value: "0.90", label: "Final ,90 (psicológico)" },
  { value: "0.5", label: "Múltiplo de R$ 0,50" },
  { value: "1", label: "Inteiro (R$ 1)" },
  { value: "5", label: "Múltiplo de R$ 5" },
  { value: "10", label: "Múltiplo de R$ 10" },
];

// Tolerância pra absorver ruído de ponto flutuante (ex.: 40 que virou 39,9999999).
const EPSILON = 1e-9;

export function roundPrice(value: number, mode: RoundingMode): number {
  if (!Number.isFinite(value) || value <= 0 || mode === "exact") {
    return value;
  }

  if (mode === "0.90") {
    const base = Math.floor(value);
    const target = base + 0.9;
    return value <= target + EPSILON ? target : base + 1.9;
  }

  const step = Number(mode);
  return Math.ceil((value - EPSILON) / step) * step;
}
