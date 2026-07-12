import type { Metadata } from "next";
import { QuotePage } from "@/features/pricing-calculator/components/QuotePage";

export const metadata: Metadata = {
  title: "Lopo Lab — Orçamento",
  description: "Gerar orçamento em PDF do Lopo Lab.",
};

export default function Orcamento() {
  return <QuotePage />;
}
