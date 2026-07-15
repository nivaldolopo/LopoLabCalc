import type { Metadata } from "next";
import { StockPage } from "@/features/pricing-calculator/components/StockPage";

export const metadata: Metadata = {
  title: "Lopo Lab — Estoque",
  description: "Estoque de filamento por cor do Lopo Lab.",
};

export default function Estoque() {
  return <StockPage />;
}
