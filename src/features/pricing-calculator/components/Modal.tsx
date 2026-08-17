"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { X } from "lucide-react";

type ModalProps = {
  // Vira o `<h3>` do cabeçalho E o nome acessível do diálogo (`aria-labelledby`).
  title: ReactNode;
  // A linha explicativa abaixo do título. Fica no cabeçalho FIXO, junto do
  // título — é contexto da tarefa, não conteúdo que rola.
  sub?: ReactNode;
  children: ReactNode;
  // Os botões da ação. Ficam no rodapé FIXO: o `SaleModal` mede 774px numa
  // viewport de 910px e antes deste componente eles rolavam junto do corpo,
  // parando abaixo da dobra.
  footer?: ReactNode;
  onClose: () => void;
  // Classe de escopo da página (`.sale-modal`, `.confirm-box`) — o CSS que já
  // existia continua mirando a mesma caixa.
  className?: string;
  // Quem quer o foco em outro lugar que não o primeiro controle. Só o
  // `ConfirmDialog` usa: lá o foco nasce no CANCELAR de propósito, para que
  // quem apertar Enter por reflexo não apague nada (UX-15).
  initialFocusRef?: RefObject<HTMLElement | null>;
};

// Os focáveis de verdade: o `[tabindex]` genérico entra, mas o `-1` (foco
// programático, não tabulável) fica de fora.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * TD-015 — a casca de modal, uma só.
 *
 * O padrão certo já existia em dois lugares e nunca foi propagado: o
 * `ConfirmDialog` (UX-15) fazia Escape + `role="dialog"` + foco inicial, e a
 * gaveta da nav (UX-14) travava a rolagem do fundo. Os outros 8 modais do app
 * não faziam NADA disso — eram `<div>` sobre `<div>`: sem papel, sem nome
 * acessível, sem Escape, sem ✕ e com o fundo rolando atrás.
 *
 * Este componente é a extração desses dois efeitos + o layout em três faixas
 * (cabeçalho fixo / corpo rolável / rodapé fixo) que resolve o rodapé abaixo da
 * dobra do `SaleModal`. Cada modal passou a ser só o seu FORMULÁRIO.
 */
export function Modal({
  title,
  sub,
  children,
  footer,
  onClose,
  className,
  initialFocusRef,
}: ModalProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  // Escape fecha, como na gaveta da nav (UX-14) e no ConfirmDialog.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Trava a rolagem do fundo. É o MESMO efeito da gaveta (NavBar), inclusive em
  // salvar e restaurar o valor anterior em vez de zerar — sem isso, fechar um
  // modal aberto por cima da gaveta destravaria a página que ela quer travada.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // O foco entra no diálogo: primeiro controle do CORPO (não do box — senão
  // seria sempre o ✕, que é o primeiro nó do cabeçalho), com o ✕ de reserva
  // para quem não tem campo nenhum.
  useEffect(() => {
    const target =
      initialFocusRef?.current ??
      bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      closeRef.current;
    target?.focus();
  }, [initialFocusRef]);

  // ...e não sai por Tab enquanto estiver aberto. A lista é consultada no
  // momento da tecla, não na montagem: o corpo do SaleModal muda de tamanho
  // conforme itens entram na cesta.
  function onBoxKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !boxRef.current) return;
    const items = Array.from(
      boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((item) => item.offsetParent !== null);
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="modal-overlay open" onMouseDown={onClose}>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`modal-box${className ? ` ${className}` : ""}`}
        ref={boxRef}
        role="dialog"
        onKeyDown={onBoxKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-head-text">
            {/* UX-29 — `<h2>`, não `<h3>`: era o `<h3>` sem `<h2>` acima que
                fazia o salto h1→h3 do app (os 10 `h3` eram TODOS título de
                modal). Dentro de um `role="dialog"` este é o heading do topo. */}
            <h2 className="modal-title" id={titleId}>
              {title}
            </h2>
            {sub ? <p className="modal-sub">{sub}</p> : null}
          </div>
          <button
            aria-label="Fechar"
            className="modal-close"
            ref={closeRef}
            title="Fechar"
            type="button"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body" ref={bodyRef}>
          {children}
        </div>

        {footer ? <div className="modal-actions">{footer}</div> : null}
      </div>
    </div>
  );
}
