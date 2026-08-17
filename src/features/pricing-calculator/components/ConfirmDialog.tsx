"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Modal } from "./Modal";

export type ConfirmRequest = {
  // Pergunta curta, já com o alvo pelo nome: `Excluir "Vaso Hexagonal"?`.
  title: string;
  // O que se perde × o que NÃO é afetado. É o corpo do aviso, em JSX porque
  // quase todo caso quer uma lista ou uma linha em destaque.
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // Só o que apaga/estorna pinta o botão de vermelho.
  danger?: boolean;
};

type ConfirmDialogProps = ConfirmRequest & {
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmação própria, no lugar do `window.confirm` (UX-15).
 *
 * ⚠ Reverte uma decisão do TD-004 (que manteve nativos os confirmes
 * destrutivos) — e a reverte de propósito: o nativo não cabe o texto que
 * importa (o que some, o que sobrevive), não responde ao tema e chega sem
 * hierarquia, com o botão perigoso no lugar do OK.
 *
 * Reusa a casca de modal que já existe (`<Modal>`), a mesma do SaleModal e
 * dos modais do estoque — nada de um segundo sistema de diálogo.
 *
 * TD-015: o Escape, o `role="dialog"`, o `aria-modal` e a trava de rolagem que
 * moravam AQUI viraram o `<Modal>`. Este arquivo ficou só com o que é decisão
 * do UX-15: a ordem dos botões e o foco no Cancelar.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // O foco nasce no CANCELAR: quem apertar Enter por reflexo não apaga nada.
  // É por isso que o `<Modal>` aceita um alvo de foco — no resto do app ele
  // usa o primeiro controle do corpo, que aqui seria o botão que APAGA.
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Modal
      className="confirm-box"
      initialFocusRef={cancelRef}
      title={title}
      onClose={onCancel}
      footer={
        <>
          {/* O destrutivo NÃO é o primeiro: a leitura (e o Tab) chega no
              Cancelar antes. */}
          <button
            className="btn btn-secondary"
            ref={cancelRef}
            type="button"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? "danger" : "primary"}`}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {body ? <div className="confirm-body">{body}</div> : null}
    </Modal>
  );
}

/**
 * `ask()` devolve uma Promise<boolean> — o mesmo formato do `window.confirm`,
 * só que assíncrono. Os handlers que já existiam seguem inteiros:
 *
 *   if (!(await ask({ title: ... }))) return;
 *
 * Sem isto, cada um dos 8 pontos teria de ser partido em "abre o modal" +
 * "continua quando confirmar", espalhando estado por 7 arquivos.
 */
export function useConfirm() {
  const [pending, setPending] = useState<{
    request: ConfirmRequest;
    resolve: (value: boolean) => void;
  } | null>(null);

  const ask = useCallback((request: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      setPending({ request, resolve });
    });
  }, []);

  const close = useCallback(
    (value: boolean) => {
      // A Promise SEMPRE resolve (false no cancelar/Escape): um `await ask()`
      // pendente para sempre travaria o handler que o chamou.
      pending?.resolve(value);
      setPending(null);
    },
    [pending],
  );

  const dialog = pending ? (
    <ConfirmDialog
      {...pending.request}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  ) : null;

  return { ask, dialog };
}
