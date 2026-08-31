"use client";

import { Check, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type Feedback = { kind: "error" | "ok"; msg: string };

// Sucesso some sozinho (decisão do dono, UX-15): a tela já mostra o resultado,
// e o aviso pendurado deixava de dizer a QUE ação se referia. Erro não some —
// quem precisa ler e agir decide quando fechar.
const OK_TIMEOUT_MS = 5000;

/**
 * O aviso inline de escrita das páginas (UX-15). Nasceu como quatro cópias do
 * mesmo `useState<{kind, msg}>` + `<div>` (estoque, insumos, produção,
 * orçamento) — e a `/vendas`, que grava o estorno mais delicado do app, não
 * tinha cópia nenhuma: falha de exclusão era silenciosa.
 *
 * Mantém as classes `.form-ok`/`.form-error` que já existiam: a aparência é a
 * mesma, o que muda é quem produz o aviso.
 */
export function FeedbackNote({
  note,
  onClose,
}: {
  note: Feedback | null;
  onClose: () => void;
}) {
  if (!note) return null;

  const isOk = note.kind === "ok";
  return (
    <div
      className={`feedback-note ${isOk ? "form-ok" : "form-error"}`}
      role="status"
    >
      {/* O ✓ era texto dentro da mensagem (emoji não herda `currentColor` nem
          renderiza igual em cada SO — DEC-05). Agora é ícone, uma vez só. */}
      {isOk ? <Check size={15} /> : <TriangleAlert size={15} />}
      <span className="fb-msg">{note.msg}</span>
      {isOk ? null : (
        <button
          className="icon-button fb-close"
          type="button"
          onClick={onClose}
          title="Fechar aviso"
          aria-label="Fechar aviso"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function useFeedback() {
  const [note, setNote] = useState<Feedback | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  // Sem isto, um sucesso disparado pouco antes de sair da página tentaria
  // atualizar estado de componente desmontado.
  useEffect(() => stopTimer, [stopTimer]);

  const clear = useCallback(() => {
    stopTimer();
    setNote(null);
  }, [stopTimer]);

  const ok = useCallback(
    (msg: string) => {
      stopTimer();
      setNote({ kind: "ok", msg });
      timer.current = setTimeout(() => setNote(null), OK_TIMEOUT_MS);
    },
    [stopTimer],
  );

  const fail = useCallback(
    (msg: string) => {
      // Um erro chegando cancela o timer do sucesso anterior: a mensagem que
      // fica na tela é sempre a mais recente.
      stopTimer();
      setNote({ kind: "error", msg });
    },
    [stopTimer],
  );

  return { note, ok, fail, clear };
}
