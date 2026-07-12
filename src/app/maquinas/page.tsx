import type { Metadata } from "next";
import { MachinesPage } from "@/features/pricing-calculator/components/MachinesPage";

export const metadata: Metadata = {
  title: "Lopo Lab — Impressoras",
  description: "ROI e payback das impressoras do Lopo Lab.",
};

export default function Maquinas() {
  return <MachinesPage />;
}
