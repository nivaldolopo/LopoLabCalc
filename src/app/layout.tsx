import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { AuthGate } from "@/features/pricing-calculator/components/AuthGate";
import { BackToTop } from "@/features/pricing-calculator/components/BackToTop";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Lopo Lab — Calculadora de Preço",
  description: "Calculadora de preço para impressão 3D do Lopo Lab.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-theme="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable}`}
        suppressHydrationWarning
      >
        <AuthGate>
          {/* UX-29 — primeiro nó focável da página: quem navega por teclado
              pulava as 7 abas da nav + os 2 utilitários em TODA troca de rota
              antes de chegar no primeiro campo. Some da tela até receber foco
              (`.skip-link` no base.css). O alvo é o `<main>` das 8 rotas. */}
          <a className="skip-link" href="#conteudo">
            Pular para o conteúdo
          </a>
          {children}
          <BackToTop />
        </AuthGate>
      </body>
    </html>
  );
}
