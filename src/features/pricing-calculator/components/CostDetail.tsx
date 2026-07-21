"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatCurrency } from "@/lib/formatting/currency";
import type { FrozenCostBreakdown, SaleCostBreakdown } from "../types";

// Detalhe do custo — usado na SaleModal (venda viva), no histórico (/vendas), na
// /producao e na aba Produtos da /estoque. O gatilho mostra o custo REAL; ao
// clicar, abre uma JANELA FLUTUANTE ANCORADA nele (Popover API nativa na
// top-layer — não é cortada pelo scroll do modal — posicionada via
// getBoundingClientRect) com a composição.
//
// FEAT-06: o custo real deixou de ser um número único e opaco. A composição é
// congelada na produção e desce pela camada do acabado até a venda, então o
// popover passa a ter DUAS colunas — precificado × real —, que é o payoff da
// feature: dá para ver onde a estimativa errou, componente a componente.
//
// Três modos, conforme o que chega:
//  1. só `breakdown`  → uma coluna precificada (venda anterior ao FEAT-06);
//  2. `breakdown` + `real` → as duas colunas lado a lado;
//  3. só `real` → uma coluna de custo real, SEM o bloco de provisões (a
//     /producao e a /estoque não têm preço nenhum envolvido — só gasto).
//
// As provisões (reserva de falha e custo fixo) nunca têm coluna real: não são
// gasto, existem só no preço. Falhas reais são registradas à parte na produção.
export function CostDetail({
  breakdown,
  real,
  realCogs,
  realUnknown = 0,
  quantity = 1,
  triggerLabel = "custo real",
  hint = "· composição do preço ▾",
}: {
  // O custo PRECIFICADO (estimativa do catálogo). Ausente fora da venda.
  breakdown?: SaleCostBreakdown;
  // FEAT-06: o custo REAL decomposto. Ausente em registro anterior.
  real?: FrozenCostBreakdown;
  realCogs: number;
  // Parcela do `realCogs` sem composição (camada pré-FEAT-06) — vira uma linha
  // "não detalhado" em vez de sumir e furar a soma da coluna.
  realUnknown?: number;
  // Escala os valores por-unidade para o total do item. A SaleModal passa 1
  // (mostra por unidade, a qtd aparece à parte); o histórico passa a qtd da
  // venda, para a coluna bater com receita/lucro (também totais).
  quantity?: number;
  triggerLabel?: string;
  hint?: string;
}) {
  const popId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // Ancora o popover ao gatilho: abaixo e alinhado à esquerda, com clamp nas
  // bordas da viewport (sobe se não couber embaixo). `position: fixed` + a
  // top-layer nativa = ancorado E sem ser cortado pelo scroll do modal.
  const place = () => {
    const trigger = triggerRef.current;
    const pop = popRef.current;
    if (!trigger || !pop) return;
    const r = trigger.getBoundingClientRect();
    const gap = 6;
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    let left = r.left;
    let top = r.bottom + gap;
    if (left + pw > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - 8 - pw);
    }
    if (top + ph > window.innerHeight - 8) {
      top = Math.max(8, r.top - gap - ph);
    }
    pop.style.margin = "0";
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  };

  // Acompanha abrir/fechar (inclui light-dismiss por Esc/clique fora) e reancora
  // enquanto aberto, em scroll (capture: pega o scroll do modal) e resize.
  useEffect(() => {
    const pop = popRef.current;
    if (!pop) return;
    const onToggle = (event: Event) => {
      const isOpen = (event as ToggleEvent).newState === "open";
      setOpen(isOpen);
      if (isOpen) place();
    };
    pop.addEventListener("toggle", onToggle);
    return () => pop.removeEventListener("toggle", onToggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const q = Math.max(1, quantity);
  const cogs = realCogs * q;
  const unknown = realUnknown * q;
  const twoCols = Boolean(breakdown && real);

  // Os componentes que compõem o custo FÍSICO, pareados: mesma linha para o que
  // o catálogo estimou e para o que de fato saiu. O par acessórios/insumos tem
  // nomes diferentes dos dois lados de propósito — no preço é o item do catálogo,
  // no real é a baixa do estoque de insumos (7e).
  const physical: { label: string; priced?: number; real?: number }[] = [
    { label: "Material", priced: breakdown?.material, real: real?.material },
    { label: "Energia", priced: breakdown?.energy, real: real?.energy },
    { label: "Desgaste", priced: breakdown?.depreciation, real: real?.depreciation },
    { label: "Manutenção", priced: breakdown?.maintenance, real: real?.maintenance },
    { label: "Mão de obra", priced: breakdown?.labor, real: real?.labor },
    {
      label: twoCols ? "Acessórios / insumos" : real ? "Insumos" : "Acessórios",
      priced: breakdown?.accessories,
      real: real?.supplies,
    },
  ]
    .map((row) => ({
      ...row,
      priced: row.priced === undefined ? undefined : row.priced * q,
      real: row.real === undefined ? undefined : row.real * q,
    }))
    // Some só quando as DUAS colunas são zero — senão um componente que existe
    // só de um lado (insumo sem acessório precificado, p. ex.) desapareceria.
    .filter((row) => (row.priced ?? 0) !== 0 || (row.real ?? 0) !== 0);

  // Provisões: só no preço. No modo 3 nem aparecem (não há preço envolvido).
  const provisions = breakdown
    ? [
        { label: "Reserva de falha", value: breakdown.failureReserve * q },
        { label: "Custo fixo", value: breakdown.fixed * q },
      ].filter((row) => row.value > 0)
    : [];

  const priced = breakdown
    ? physical.reduce((sum, row) => sum + (row.priced ?? 0), 0) +
      provisions.reduce((sum, row) => sum + row.value, 0)
    : 0;

  const cols = twoCols ? 3 : 2;
  const money = (value: number | undefined) =>
    value === undefined ? "—" : formatCurrency(value);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="cost-detail-trigger"
        popoverTarget={popId}
      >
        {triggerLabel} <strong>{formatCurrency(cogs)}</strong>
        {hint ? <span className="cost-detail-hint">{hint}</span> : null}
      </button>

      <div
        id={popId}
        ref={popRef}
        popover="auto"
        className={`cost-detail-pop${twoCols ? " two-cols" : ""}`}
      >
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

        {!twoCols ? (
          <div className="cost-detail-section">
            {breakdown
              ? "Custo precificado (estimado, base do preço)"
              : "Custo real gasto (o que saiu do estoque)"}
          </div>
        ) : null}

        <table className="cost-detail-table">
          {twoCols ? (
            <thead>
              <tr>
                <th />
                <th className="num">Precificado</th>
                <th className="num">Real</th>
              </tr>
            </thead>
          ) : null}
          <tbody>
            {physical.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                {breakdown ? (
                  <td className="num mono">{money(row.priced)}</td>
                ) : null}
                {real ? <td className="num mono">{money(row.real)}</td> : null}
              </tr>
            ))}

            {/* Camada anterior ao FEAT-06: o valor existe, a composição não.
                Só faz sentido (e só fecha a contagem de colunas) quando há
                coluna real — sem ela, `realUnknown` não teria onde aparecer. */}
            {real && unknown !== 0 ? (
              <tr className="cost-detail-prov">
                <td>Não detalhado</td>
                {twoCols ? <td className="num mono">—</td> : null}
                <td className="num mono">{formatCurrency(unknown)}</td>
              </tr>
            ) : null}

            {provisions.length > 0 ? (
              <>
                <tr className="cost-detail-divider">
                  <td colSpan={cols}>Provisões — só no preço, não são gasto</td>
                </tr>
                {provisions.map((row) => (
                  <tr className="cost-detail-prov" key={row.label}>
                    <td>{row.label}</td>
                    <td className="num mono">{formatCurrency(row.value)}</td>
                    {twoCols ? <td className="num mono">—</td> : null}
                  </tr>
                ))}
              </>
            ) : null}

            {breakdown ? (
              <tr className="cost-detail-total">
                <td>Custo precificado</td>
                <td className="num mono">{formatCurrency(priced)}</td>
                {twoCols ? <td className="num mono">—</td> : null}
              </tr>
            ) : null}
            {/* O total real fica na coluna "Real" quando ela existe; nos modos
                de coluna única, na única que há. */}
            <tr className="cost-detail-total real">
              <td>Custo real gasto (base do lucro)</td>
              {twoCols ? <td className="num mono">—</td> : null}
              <td className="num mono">{formatCurrency(cogs)}</td>
            </tr>
          </tbody>
        </table>

        <p className="cost-detail-note">
          {breakdown ? (
            <>
              O <strong>precificado</strong> é a estimativa do catálogo que gerou
              o preço. O <strong>custo real</strong> é o que de fato saiu do
              estoque nesta peça — pelo preço do rolo e do lote realmente usados
              — e é ele que define o lucro. Os dois raramente batem: as provisões
              só existem no preço, e o preço de compra do material muda a cada
              lote. Falhas reais são registradas à parte na produção.
            </>
          ) : (
            <>
              É o que de fato <strong>saiu do estoque</strong> nesta impressão,
              pelo preço do rolo e do lote realmente usados. Não inclui reserva
              de falha nem custo fixo — essas são provisões do preço, não gasto.
              É este número que vira o custo da peça quando ela for vendida.
            </>
          )}
        </p>
      </div>
    </>
  );
}
