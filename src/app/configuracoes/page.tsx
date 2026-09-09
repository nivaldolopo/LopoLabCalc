import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsPage } from "@/features/pricing-calculator/components/SettingsPage";

export const metadata: Metadata = {
  title: "Lopo Lab — Configurações",
  description:
    "Registro de alterações de preço e configurações do Lopo Lab.",
};

export default function Configuracoes() {
  // O `useSearchParams` (o `?entrada=` do aviso pós-fato) obriga a fronteira de
  // Suspense no App Router — sem ela a rota inteira vira dinâmica na build.
  return (
    <Suspense fallback={null}>
      <SettingsPage />
    </Suspense>
  );
}
