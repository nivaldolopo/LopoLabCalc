import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductionPage } from "@/features/pricing-calculator/components/ProductionPage";

export const metadata: Metadata = {
  title: "Lopo Lab — Produção",
  description: "Registro de impressão (produção) do Lopo Lab.",
};

export default function Producao() {
  // FEAT-08: lê `?produto=&subitem=` (ação "Produzir" do catálogo) com
  // `useSearchParams`, que o Next exige dentro de um limite de Suspense.
  return (
    <Suspense>
      <ProductionPage />
    </Suspense>
  );
}
