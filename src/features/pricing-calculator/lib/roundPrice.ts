// Arredondamento do preço sugerido para valores "de mercado".
// Sempre arredonda PARA CIMA (ceil), pra nunca cair abaixo do preço calculado
// e comer a margem — o valor exibido é sempre >= ao valor exato.

export type RoundingMode =
  | "exact"
  | "0.5"
  | "1"
  | "5"
  | "10"
  | "0.90"
  | "4.90";

export const ROUNDING_OPTIONS: { value: RoundingMode; label: string }[] = [
  { value: "exact", label: "Exato (sem arredondar)" },
  { value: "0.90", label: "Final ,90 (psicológico)" },
  { value: "4.90", label: "Final 4,90 ou 9,90 (varejo)" },
  { value: "0.5", label: "Múltiplo de R$ 0,50" },
  { value: "1", label: "Inteiro (R$ 1)" },
  { value: "5", label: "Múltiplo de R$ 5" },
  { value: "10", label: "Múltiplo de R$ 10" },
];

// Tolerância pra absorver ruído de ponto flutuante (ex.: 40 que virou 39,9999999).
const EPSILON = 1e-9;

// Modos "psicológicos": o preço termina sempre em ,90 — o passo diz de quanto em
// quanto o degrau anda. "0.90" = passo de R$ 1 (35,90 · 36,90…); "4.90" = passo
// de R$ 5, então os finais permitidos são 4,90 E 9,90 (24,90 · 29,90 · 34,90…).
const NINETY_STEP: Partial<Record<RoundingMode, number>> = {
  "0.90": 1,
  "4.90": 5,
};

export function roundPrice(value: number, mode: RoundingMode): number {
  if (!Number.isFinite(value) || value <= 0 || mode === "exact") {
    return value;
  }

  const ninetyStep = NINETY_STEP[mode];
  if (ninetyStep) {
    const base = Math.floor(value / ninetyStep) * ninetyStep;
    const target = base + ninetyStep - 0.1;
    return value <= target + EPSILON ? target : target + ninetyStep;
  }

  const step = Number(mode);
  return Math.ceil((value - EPSILON) / step) * step;
}
