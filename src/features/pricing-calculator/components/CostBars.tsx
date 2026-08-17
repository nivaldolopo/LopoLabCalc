"use client";

import { formatCurrency } from "@/lib/formatting/currency";
import type { PricingResult } from "../types";

export type CostStackItem = {
  // A chave é a COR: vira a classe `.cost-stack-seg.<key>` no `sections.css`,
  // que aponta pro `--cost-<key>` do `base.css`. Por isso ela não é livre —
  // material · labor · supplies · energy · depreciation · maintenance ·
  // failure · fixed.
  key: string;
  label: string;
  value: number;
};

/**
 * Faixa empilhada 100% — a composição de um custo, proporcional ao TOTAL.
 *
 * UX-26: nasceu como o `.fg-comp` do `/estoque` e agora é o desenho único da
 * composição de custo do app (o `CostBars` abaixo e a aba Produtos do estoque
 * consomem os dois). `flex-grow` recebe o valor cru: a largura sai proporcional
 * sozinha, sem calcular porcentagem nem depender de arredondamento.
 *
 * A faixa é decorativa (`aria-hidden`) — quem carrega o dado é a legenda.
 * `showValue` liga o R$ ao lado da % (a calculadora e o catálogo mostram os
 * dois; o estoque, só a %).
 */
export function CostStack({
  items,
  total,
  showValue = false,
}: {
  items: CostStackItem[];
  total: number;
  showValue?: boolean;
}) {
  const parts = items.filter((item) => item.value > 0);
  if (total <= 0 || parts.length === 0) return null;

  return (
    <div className="cost-stack">
      <div className="cost-stack-bar" aria-hidden="true">
        {parts.map((part) => (
          <span
            key={part.key}
            className={`cost-stack-seg ${part.key}`}
            style={{ flexGrow: part.value }}
            title={`${part.label}: ${formatCurrency(part.value)}`}
          />
        ))}
      </div>
      <div className="cost-stack-legend">
        {parts.map((part) => (
          <span className="cost-stack-item" key={part.key}>
            <i className={`cost-stack-dot ${part.key}`} aria-hidden="true" />
            {part.label}
            {showValue ? (
              <span className="cost-stack-val mono">
                {formatCurrency(part.value)}
              </span>
            ) : null}
            <span className="cost-stack-pct">
              {Math.round((part.value / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function CostBars({ result }: { result: PricingResult }) {
  // TD-014 — as cores saíram do JSX e viraram os `--cost-*` do `base.css`; a
  // chave de cada item abaixo é justamente o nome do token.
  //
  // UX-26 (onda 5) — a MATEMÁTICA. Antes cada categoria virava uma barra
  // própria com `maxValue = Math.max(...items)`: o maior custo SEMPRE desenhava
  // barra inteira (mão de obra a 100% sendo 40% do total). Como o bloco termina
  // em "Custo total", o olho lia fatia do total — e não era. Agora é uma faixa
  // empilhada sobre `result.totalCost`, e as 8 categorias somam exatamente ele
  // (`stagesCost` é subtotal informativo, já dobrado dentro das categorias).
  const items: CostStackItem[] = [
    { key: "material", label: "Material", value: result.materialCost },
    { key: "energy", label: "Energia", value: result.energyCost },
    { key: "depreciation", label: "Desgaste", value: result.depreciationCost },
    { key: "labor", label: "Mão de obra", value: result.laborCost },
    { key: "maintenance", label: "Manutenção", value: result.maintenanceCost },
    // Falha é risco → vermelho semântico (UX-26, parte-cor da onda 2).
    { key: "failure", label: "Reserva de falha", value: result.failureReserve },
    { key: "supplies", label: "Acessórios", value: result.accessoriesCost },
    // ...e o custo fixo é o neutro: o balde do que não se atribui a nenhuma
    // categoria, e o neutro é o que menos disputa atenção.
    { key: "fixed", label: "Custo fixo", value: result.fixedCost },
  ];

  return <CostStack items={items} total={result.totalCost} showValue />;
}
