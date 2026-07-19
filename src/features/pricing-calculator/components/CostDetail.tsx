"use client";

import { useId } from "react";
import { formatCurrency } from "@/lib/formatting/currency";
import type { SaleCostBreakdown } from "../types";

// Detalhe do custo de UM item vendido — usado na SaleModal (venda viva) e no
// histórico (/vendas). O gatilho mostra o custo REAL (base do lucro); ao clicar,
// abre uma JANELA FLUTUANTE (Popover API nativa, top-layer — não é cortada pelo
// scroll do modal) com a composição do custo PRECIFICADO, separando as PROVISÕES
// (reserva de falha, custo fixo, acessórios) que NÃO entram no custo real da peça
// — falhas reais são registradas à parte na produção (ver ⚠ do passo 8 / FEAT-06).
// Só EXIBE; não recalcula nada.
//
// O custo real é um número único congelado (FIFO/camada do acabado), por isso não
// é decomposto por componente; o que se decompõe é o custo precificado
// (`SaleCostBreakdown`), presente tanto no item vivo quanto no doc da venda.
export function CostDetail({
  breakdown,
  realCogs,
  quantity = 1,
}: {
  breakdown: SaleCostBreakdown;
  realCogs: number;
  // Escala os valores por-unidade (breakdown/realCogs) para o total do item. A
  // SaleModal passa 1 (mostra por unidade, a qtd aparece à parte); o histórico
  // passa a qtd da venda, para a coluna bater com receita/lucro (também totais).
  quantity?: number;
}) {
  const popId = useId();
  const q = Math.max(1, quantity);
  const cogs = realCogs * q;
  const physical = [
    { label: "Material", value: breakdown.material * q },
    { label: "Energia", value: breakdown.energy * q },
    { label: "Desgaste", value: breakdown.depreciation * q },
    { label: "Manutenção", value: breakdown.maintenance * q },
    { label: "Mão de obra", value: breakdown.labor * q },
  ];
  const provisions = [
    { label: "Reserva de falha", value: breakdown.failureReserve * q },
    { label: "Custo fixo", value: breakdown.fixed * q },
    { label: "Acessórios", value: breakdown.accessories * q },
  ].filter((row) => row.value > 0);

  const priced =
    physical.reduce((sum, row) => sum + row.value, 0) +
    provisions.reduce((sum, row) => sum + row.value, 0);

  return (
    <>
      <button
        type="button"
        className="cost-detail-trigger"
        popoverTarget={popId}
      >
        custo real <strong>{formatCurrency(cogs)}</strong>
        <span className="cost-detail-hint">· composição do preço ▾</span>
      </button>

      <div id={popId} popover="auto" className="cost-detail-pop">
        <div className="cost-detail-pop-head">
          <span>Composição do custo</span>
          <button
            type="button"
            className="cost-detail-close"
            aria-label="Fechar"
            popoverTarget={popId}
            popoverTargetAction="hide"
          >
            ✕
          </button>
        </div>

        <div className="cost-detail-section">Custo precificado (base do preço)</div>
        <table className="cost-detail-table">
          <tbody>
            {physical.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="num mono">{formatCurrency(row.value)}</td>
              </tr>
            ))}
            {provisions.length > 0 ? (
              <>
                <tr className="cost-detail-divider">
                  <td colSpan={2}>Provisões do preço (fora do custo real)</td>
                </tr>
                {provisions.map((row) => (
                  <tr className="cost-detail-prov" key={row.label}>
                    <td>{row.label}</td>
                    <td className="num mono">{formatCurrency(row.value)}</td>
                  </tr>
                ))}
              </>
            ) : null}
            <tr className="cost-detail-total">
              <td>Custo precificado</td>
              <td className="num mono">{formatCurrency(priced)}</td>
            </tr>
            <tr className="cost-detail-total real">
              <td>Custo real (base do lucro)</td>
              <td className="num mono">{formatCurrency(cogs)}</td>
            </tr>
          </tbody>
        </table>
        <p className="cost-detail-note">
          O lucro usa o <strong>custo real</strong>. As provisões (reserva de
          falha, custo fixo, acessórios) entram no preço, não no custo físico da
          peça — falhas reais são registradas à parte na produção.
        </p>
      </div>
    </>
  );
}
