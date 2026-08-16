"use client";

import { formatCurrency } from "@/lib/formatting/currency";
import type { PricingResult } from "../types";

type MobilePriceBarProps = {
  result: PricingResult;
  // Vem do formulário (não do resultado): é o valor do dial que o usuário está
  // arrastando enquanto lê esta barra.
  markup: number;
};

// UX-13b — barra fina fixa no rodapé, só no CELULAR (o CSS a esconde acima de
// 760px). Por que existe: no celular o `.result-card` é `position: static`
// (responsive.css) e mora DEPOIS do formulário inteiro — medido: página de
// 3314px, preço no offset 2080px, 569px abaixo do slider de markup. Ou seja, a
// interação central da calculadora (mexer no dial e ver o número) não
// funcionava. O colapso do UX-13a resolveu isso só no desktop.
//
// Requisito do dono: NÃO pode cobrir nada. Quem garante isso são duas regras
// que dependem do mesmo `--price-bar-h` (base.css): a reserva de
// `padding-bottom` no `.wrap.has-price-bar` e o deslocamento do `.back-to-top`.
export function MobilePriceBar({ result, markup }: MobilePriceBarProps) {
  // Um toque leva ao card de preço — onde estão as ações e a composição. Numa
  // página de 3300px isso substitui a rolagem manual.
  function scrollToCard() {
    const card = document.querySelector(".result-card");
    if (!card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <button
      className="price-bar"
      type="button"
      onClick={scrollToCard}
      title="Ver o card de preço"
    >
      <span className="price-bar-price sg">
        {formatCurrency(result.suggestedPrice)}
        <span className="price-bar-unit">/peça</span>
      </span>
      <span className="price-bar-meta">
        <span>margem {result.margin.toFixed(0)}%</span>
        <span aria-hidden="true">·</span>
        <span>markup {markup.toFixed(1)}x</span>
      </span>
    </button>
  );
}
