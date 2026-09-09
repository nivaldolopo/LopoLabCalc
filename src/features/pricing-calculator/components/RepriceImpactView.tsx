"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/formatting/currency";
import { tierClass } from "../lib/marginTier";
import type { RepriceImpact } from "../lib/repriceImpact";
import type { ChangeImpact, ChangeCrossing, MarginTier } from "../types";

// [FEAT-12] — o DESENHO do impacto, um só.
//
// Ele aparece em três lugares (a prévia antes de confirmar, o aviso pós-fato e
// a entrada do registro em `/configuracoes`), e nos três diz a mesma coisa. Por
// isso ele aceita as DUAS formas do impacto: a calculada (`RepriceImpact`, com a
// lista inteira) e a GRAVADA (`ChangeImpact`, que guarda resumo e até dez
// movimentos). Normalizar aqui é o que evita duas tabelas que precisam
// concordar — foi assim que o UX-42 nasceu.

const TIER_WORD: Record<MarginTier, string> = {
  bad: "baixa",
  ok: "ok",
  good: "boa",
};

function tierWord(tier: MarginTier | null): string {
  return tier ? TIER_WORD[tier] : "sem faixa";
}

// A forma comum: é o `ChangeImpact` (o recorte gravado). O calculado se converte
// nele sem perder nada do que esta tela mostra.
function normalize(impact: RepriceImpact | ChangeImpact): ChangeImpact {
  if ("items" in impact) {
    return {
      evaluated: impact.evaluated,
      affected: impact.affected,
      up: impact.up,
      down: impact.down,
      avgPct: impact.avgPct,
      top: impact.top.map((item) => ({
        id: item.id,
        name: item.name,
        before: item.before,
        after: item.after,
      })),
      crossings: impact.crossings.map((item) => ({
        id: item.id,
        name: item.name,
        from: item.tierBefore,
        to: item.tierAfter,
      })),
    };
  }
  return impact;
}

function pct(before: number, after: number): string {
  if (before <= 0) return "—";
  return `${(((after - before) / before) * 100).toFixed(1)}%`;
}

function Crossing({ item }: { item: ChangeCrossing }) {
  return (
    <li className="rp-crossing">
      <span className="rp-crossing-name">{item.name || "sem nome"}</span>
      <span className={`rp-tier ${tierClass(item.from)}`}>
        {tierWord(item.from)}
      </span>
      <ArrowRight size={13} aria-hidden="true" />
      <span className={`rp-tier ${tierClass(item.to)}`}>{tierWord(item.to)}</span>
    </li>
  );
}

type RepriceImpactViewProps = {
  impact: RepriceImpact | ChangeImpact;
  // A frase de "nada muda" varia com o momento: antes de confirmar é "nada vai
  // mudar", depois do fato é "nada mudou". Quem sabe o tempo verbal é a tela.
  emptyNote?: string;
};

export function RepriceImpactView({ impact, emptyNote }: RepriceImpactViewProps) {
  const dados = normalize(impact);

  if (dados.affected === 0) {
    return (
      <p className="rp-empty">
        {emptyNote ??
          "Nenhum preço se move com esta alteração."}{" "}
        {dados.evaluated > 0 ? (
          <>
            Os <strong>{dados.evaluated}</strong> produtos do catálogo foram
            conferidos, um a um.
          </>
        ) : (
          <>O catálogo está vazio — não havia o que conferir.</>
        )}
      </p>
    );
  }

  return (
    <div className="rp-impact">
      <div className="rp-stats">
        <div className="rp-stat">
          <span className="rp-stat-label">Produtos afetados</span>
          <span className="rp-stat-value num">
            {dados.affected}
            <span className="rp-stat-of"> de {dados.evaluated}</span>
          </span>
        </div>
        <div className="rp-stat">
          <span className="rp-stat-label">Subiram</span>
          <span className="rp-stat-value num up">
            <ArrowUpRight size={14} aria-hidden="true" />
            {dados.up}
          </span>
        </div>
        <div className="rp-stat">
          <span className="rp-stat-label">Desceram</span>
          <span className="rp-stat-value num down">
            <ArrowDownRight size={14} aria-hidden="true" />
            {dados.down}
          </span>
        </div>
        <div className="rp-stat">
          <span className="rp-stat-label">Variação média</span>
          <span className="rp-stat-value num">
            {dados.avgPct >= 0 ? "+" : ""}
            {dados.avgPct.toFixed(1)}%
          </span>
        </div>
      </div>

      <h3 className="rp-sub">
        Maiores movimentos
        {dados.affected > dados.top.length ? (
          <span className="rp-sub-note">
            {" "}
            — os {dados.top.length} maiores de {dados.affected}
          </span>
        ) : null}
      </h3>
      {/* UX-38/UX-40: abaixo dos ~300px úteis esta fileira vira cartão (receita
          do `.fg-part`), em vez de ganhar rolagem lateral. */}
      <ul className="rp-top">
        {dados.top.map((item) => {
          const delta = item.after - item.before;
          return (
            <li className="rp-row" key={item.id}>
              <span className="rp-name">{item.name || "sem nome"}</span>
              <span className="rp-part">
                <span className="rp-part-label" aria-hidden="true">
                  antes
                </span>
                <span className="num">{formatCurrency(item.before)}</span>
              </span>
              <span className="rp-part">
                <span className="rp-part-label" aria-hidden="true">
                  depois
                </span>
                <span className="num">{formatCurrency(item.after)}</span>
              </span>
              <span className="rp-part">
                <span className="rp-part-label" aria-hidden="true">
                  variação
                </span>
                <span className={`num ${delta > 0 ? "up" : "down"}`}>
                  {delta > 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(delta))} ({pct(item.before, item.after)})
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {dados.crossings.length > 0 ? (
        <>
          {/* A régua da DEC-04 é o segundo número que o dono pediu, ao lado do
              preço: "preço mais quem cruza". Um produto pode subir de preço e
              MESMO ASSIM ficar com margem pior — é o custo fixo, que entra no
              custo total sem entrar no markup. */}
          <h3 className="rp-sub">
            Mudaram de faixa de margem ({dados.crossings.length})
          </h3>
          <ul className="rp-crossings">
            {dados.crossings.map((item) => (
              <Crossing item={item} key={item.id} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
