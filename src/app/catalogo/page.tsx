import type { Metadata } from "next";
import { CatalogPage } from "@/features/pricing-calculator/components/CatalogPage";

export const metadata: Metadata = {
  title: "Lopo Lab — Catálogo",
  description: "Catálogo de produtos cadastrados do Lopo Lab.",
};

export default function Catalogo() {
  return <CatalogPage />;
}
