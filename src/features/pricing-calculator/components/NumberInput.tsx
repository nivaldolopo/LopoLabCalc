"use client";

import type { InputHTMLAttributes } from "react";
import { useState } from "react";

type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "min" | "max"
> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

function clamp(value: number, min?: number, max?: number) {
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

/**
 * Input numérico controlado que evita o "zero à esquerda" (UX-01).
 *
 * O problema: com `value={number}` puro, apagar o campo o recoage para `0`,
 * então digitar deixa o `0` preso à esquerda (ex.: `05`). Aqui guardamos a
 * string exibida em estado local — o campo pode ficar vazio enquanto o número
 * emitido segue clampado. O texto só é normalizado no blur. Resync com o valor
 * externo via padrão "ajustar estado no render" (mesmo idioma do PrintTimeField).
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  onBlur,
  ...rest
}: NumberInputProps) {
  const [text, setText] = useState(() => String(value));
  const [lastEmitted, setLastEmitted] = useState(value);

  // Só resync quando o valor muda por fora deste input (não a cada tecla).
  if (value !== lastEmitted) {
    setLastEmitted(value);
    setText(String(value));
  }

  const emit = (raw: string) => {
    const next = clamp(Number(raw) || 0, min, max);
    setLastEmitted(next);
    onChange(next);
  };

  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        emit(event.target.value);
      }}
      onBlur={(event) => {
        const next = clamp(Number(event.target.value) || 0, min, max);
        setText(String(next));
        setLastEmitted(next);
        onChange(next);
        onBlur?.(event);
      }}
    />
  );
}
