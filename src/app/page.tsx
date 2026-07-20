import { Suspense } from "react";
import { PricingCalculator } from "@/features/pricing-calculator/components/PricingCalculator";

export default function Home() {
  // A calculadora lê `?load=<id>` (FEAT-07: "editar" vindo do /catalogo) com
  // `useSearchParams`, que o Next exige dentro de um limite de Suspense.
  return (
    <Suspense>
      <PricingCalculator />
    </Suspense>
  );
}
