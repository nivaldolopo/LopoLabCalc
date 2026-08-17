import type { ReactNode } from "react";

type PageIntroProps = {
  children: ReactNode;
};

// UX-23 — o texto que explica a página tinha QUATRO tratamentos e três CSS
// diferentes: `.subtitle` na calculadora, `.subtitle .prod-intro` na /producao,
// `.stock-intro` espremido ao lado do botão no /estoque (com um max-width
// próprio) e `.roi-note` nas /maquinas. Nunca virou componente, então cada
// página inventou a própria medida de linha, o próprio espaçamento e a própria
// posição.
//
// Aqui ele é um só: sempre logo abaixo da NavBar, sempre com a mesma medida de
// linha (~70 caracteres — o `.page-intro` do header.css) e sempre com o mesmo
// espaço até o primeiro bloco de conteúdo.
//
// ⚠ /catalogo e /vendas seguem SEM introdução — decisão do dono (2026-08-16):
// texto de produto é voz dele, não se inventa para preencher simetria.
export function PageIntro({ children }: PageIntroProps) {
  return <p className="page-intro">{children}</p>;
}
