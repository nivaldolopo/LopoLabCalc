import type { Metadata } from "next";
import { SalesPage } from "@/features/pricing-calculator/components/SalesPage";

export const metadata: Metadata = {
  title: "Lopo Lab — Vendas",
  description: "Histórico de vendas do Lopo Lab.",
};

export default function Vendas() {
  return <SalesPage />;
}
