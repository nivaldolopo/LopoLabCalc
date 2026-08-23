"use client";

import type { InputHTMLAttributes } from "react";
import { useRef, useState } from "react";
import { parseDecimalPtBr } from "@/lib/formatting/number";

type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "min" | "max" | "step"
> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
};

function clamp(value: number, min?: number, max?: number) {
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

// Casas decimais que o passo implica: 0.01 → 2, 0.1 → 1, 1 → 0. Sem isto o
// incremento acumula lixo de ponto flutuante (0,1 + 0,2 = 0,30000000000000004)
// e o campo passa a exibir a sujeira.
function decimalsOf(step: number): number {
  const texto = String(step);
  const ponto = texto.indexOf(".");
  return ponto < 0 ? 0 : texto.length - ponto - 1;
}

// Número → o texto que o campo mostra, em pt-BR (o resto do app já formata
// assim). Inteiro não ganha casa decimal à toa: passo 1 mostra "3", não "3,00".
function toText(value: number): string {
  return String(value).replace(".", ",");
}

/**
 * Input numérico controlado.
 *
 * **Por que não é `type="number"` (UX-41).** Medido no app com uma tecla de
 * vírgula de verdade, num campo nativo:
 *
 * ```
 * keydown      key=","   → chega, e é identificável
 * beforeinput  data=","  → dispara
 * input                  → NÃO dispara: o Chrome recusa a inserção
 * value: "3" → "5" → "35"        a vírgula some e os dígitos colam
 * validity.badInput: false       nada denuncia depois
 * selectionStart: null           e setRangeText lança InvalidStateError
 * ```
 *
 * É o `143,53 → 14353` da auditoria: 100× no preço, sem um aviso. E como o que
 * chega no código é um número VÁLIDO (`badInput` é false), não há erro a
 * detectar — avisar depois do fato é impossível.
 *
 * Interceptar no `beforeinput` seria possível, já que a vírgula É visível ali.
 * Não foi o caminho por três motivos: sem `selectionStart` só dá para acrescentar
 * no fim (editar no meio do número quebra); um campo numérico não consegue
 * exibir os estados intermediários "143," nem "143.", o que exige guardar um
 * "decimal pendente" com aresta em backspace, colagem e seleção; e o navegador
 * móvel não desenha spinner nenhum, então o incremento continuaria faltando lá.
 *
 * Trocado o tipo, as setinhas passam a ser nossas — e por isso funcionam também
 * no celular, e respeitam o `step` de cada campo. O contrato do componente não
 * mudou: continua entrando e saindo `number`.
 *
 * Mantém o UX-01 (zero à esquerda): o texto exibido vive em estado local, o
 * campo pode ficar vazio enquanto o número emitido segue clampado, e a
 * normalização é no blur. Resync com o valor externo pelo padrão "ajustar
 * estado no render".
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  onBlur,
  onKeyDown,
  className,
  ...rest
}: NumberInputProps) {
  const [text, setText] = useState(() => toText(value));
  const [lastEmitted, setLastEmitted] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Só resync quando o valor muda por fora deste input (não a cada tecla).
  if (value !== lastEmitted) {
    setLastEmitted(value);
    setText(toText(value));
  }

  const stepNum = Number(step) || 1;
  const casas = decimalsOf(stepNum);

  const emit = (raw: string) => {
    // Campo vazio é 0 — o mesmo contrato de antes. Ilegível também: aqui não há
    // para quem apontar, e travar a digitação no meio de "1," seria pior.
    const next = clamp(parseDecimalPtBr(raw) ?? 0, min, max);
    setLastEmitted(next);
    onChange(next);
  };

  const bump = (dir: 1 | -1) => {
    const atual = parseDecimalPtBr(text) ?? 0;
    const bruto = atual + dir * stepNum;
    const next = clamp(Number(bruto.toFixed(casas)), min, max);
    setText(toText(next));
    setLastEmitted(next);
    onChange(next);
    // O clique no botão tira o foco do campo; devolver mantém o ritmo de quem
    // está ajustando (e deixa o ↑↓ continuar de onde parou).
    inputRef.current?.focus();
  };

  return (
    <span className="num-field">
      <input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        className={className}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          emit(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            bump(1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            bump(-1);
          }
          onKeyDown?.(event);
        }}
        onBlur={(event) => {
          const next = clamp(parseDecimalPtBr(event.target.value) ?? 0, min, max);
          setText(toText(next));
          setLastEmitted(next);
          onChange(next);
          onBlur?.(event);
        }}
      />
      {/* A11Y-01: o campo já É o controle e responde a ↑↓ — os botões são um
          atalho de mouse. Fora da ordem de tabulação e escondidos do leitor de
          tela, senão cada campo do formulário viraria três paradas. */}
      <span className="num-spin" aria-hidden="true">
        <button type="button" tabIndex={-1} onClick={() => bump(1)}>
          <svg viewBox="0 0 8 5" width="8" height="5" focusable="false">
            <path d="M4 0 8 5H0z" fill="currentColor" />
          </svg>
        </button>
        <button type="button" tabIndex={-1} onClick={() => bump(-1)}>
          <svg viewBox="0 0 8 5" width="8" height="5" focusable="false">
            <path d="M4 5 0 0h8z" fill="currentColor" />
          </svg>
        </button>
      </span>
    </span>
  );
}
