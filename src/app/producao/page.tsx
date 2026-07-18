import type { Metadata } from "next";
import { ProductionPage } from "@/features/pricing-calculator/components/ProductionPage";

export const metadata: Metadata = {
  title: "Lopo Lab — Produção",
  description: "Registro de impressão (produção) do Lopo Lab.",
};

export default function Producao() {
  return <ProductionPage />;
}
