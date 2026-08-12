"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

// Botão flutuante "voltar ao topo". Mora no layout (dentro do AuthGate), então
// aparece em TODAS as páginas — mas só se materializa depois de rolar um pouco,
// então não atrapalha nas telas curtas. Rolagem suave ao topo ao clicar.
const SHOW_AFTER = 400; // px de rolagem antes de aparecer

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER);
    onScroll(); // estado inicial (ex.: recarregar já rolado)
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      className={`back-to-top${visible ? " is-visible" : ""}`}
      onClick={toTop}
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}
