import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogPage } from "@/features/pricing-calculator/components/CatalogPage";

export const metadata: Metadata = {
  title: "Lopo Lab — Catálogo",
  description: "Catálogo de produtos cadastrados do Lopo Lab.",
};

export default function Catalogo() {
  // UX-08: lê `?produto=` (ação "Ver no catálogo" do estoque) com
  // `useSearchParams`, que o Next exige dentro de um limite de Suspense.
  return (
    <Suspense>
      <CatalogPage />
    </Suspense>
  );
}
