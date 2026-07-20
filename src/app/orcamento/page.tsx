import type { Metadata } from "next";
import { Suspense } from "react";
import { QuotePage } from "@/features/pricing-calculator/components/QuotePage";

export const metadata: Metadata = {
  title: "Lopo Lab — Orçamento",
  description: "Gerar orçamento em PDF do Lopo Lab.",
};

export default function Orcamento() {
  // FEAT-08: lê `?produto=&subitem=` (ação "Orçar" do catálogo) com
  // `useSearchParams`, que o Next exige dentro de um limite de Suspense.
  return (
    <Suspense>
      <QuotePage />
    </Suspense>
  );
}
