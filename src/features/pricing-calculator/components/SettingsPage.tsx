"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Undo2 } from "lucide-react";
import { formatDate } from "@/lib/formatting/date";
import { canUndo, undoLabelOf, undoProposal, type RepriceProposal } from "../lib/changeLog";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useChangeLog } from "../hooks/useChangeLog";
import { useMachines } from "../hooks/useMachines";
import { useTheme } from "../hooks/useTheme";
import type { ChangeLever, ChangeRecord } from "../types";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { PageIntro } from "./PageIntro";
import { RepriceGate } from "./RepriceGate";
import { RepriceImpactView } from "./RepriceImpactView";

/**
 * [FEAT-12] peça 4 — a página de CONFIGURAÇÕES.
 *
 * Ela nasce só com o REGISTRO de alterações de preço, mas é a casa futura da
 * coleção `config/`, hoje espalhada por quatro telas: `config/machines` (modal
 * da calculadora), `config/negocio` (painel da calculadora), `config/taxas`
 * (modal da venda) e `config/orcamento` (página Orçamento). **Mover não é deste
 * item** — registrar o destino é o que justifica o passo de confirmação
 * (`RepriceGate`) ter nascido desacoplado do `MachineManagerModal`.
 *
 * ⚠ Ela entra pelo ⚙ discreto do cabeçalho, SEPARADA das abas de conteúdo
 * (dono, 2026-09-08): não é destino diário, e seria a 8ª aba numa linha de 7.
 */

const LEVER_WORD: Record<ChangeLever, string> = {
  maquinas: "Frota",
  "custo-fixo": "Custo fixo",
  cor: "Cor",
  insumo: "Insumo",
};

// O que o registro responde, escrito na tela para não virar folclore: é a
// pergunta que hoje não tem resposta por porta nenhuma.
const INTRO =
  "O preço não é um campo guardado — toda tela o recalcula a partir das " +
  "máquinas, do custo fixo e do estoque. Este registro é o rastro de cada " +
  "alteração global: é ele que responde “por que este produto está 18% mais " +
  "caro que semana passada?”.";

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { changes, status, error } = useChangeLog();
  const { machines, rev, saveMachines } = useMachines();
  const { fixedCostRate, saveFixedCostRate } = useBusinessSettings();
  const params = useSearchParams();
  // A entrada que o "ver quais" do aviso pediu já nasce aberta.
  const alvo = params.get("entrada");
  const [aberta, setAberta] = useState<string | null>(alvo);
  // A proposta de DESFAZER na mesa, com a entrada de origem — o `undoOf` do
  // rastro novo sai dela.
  const [desfazer, setDesfazer] = useState<
    { proposal: RepriceProposal; record: ChangeRecord } | null
  >(null);
  // AUD-18 — a versão é capturada JUNTO da proposta, no mesmo `useState`: ler a
  // `rev` corrente na hora de gravar deixa a trava passar quando outra aba
  // gravou no meio.
  const [revDoDesfazer, setRevDoDesfazer] = useState(0);

  const entradas = useMemo(
    () => [...changes].sort((a, b) => b.at - a.at),
    [changes],
  );

  function abrirDesfazer(record: ChangeRecord) {
    const proposal = undoProposal(record, machines, fixedCostRate);
    if (!proposal) return;
    setRevDoDesfazer(rev);
    setDesfazer({ proposal, record });
  }

  // Grava a alavanca do desfazer. Devolve a mensagem de erro, ou `null` — é o
  // contrato do `RepriceGate` (molde do TD-020).
  async function commitDesfazer(): Promise<string | null> {
    if (!desfazer) return "Nada a desfazer.";
    const { proposal } = desfazer;
    if (proposal.lever === "maquinas" && proposal.after.machines) {
      return saveMachines(proposal.after.machines, revDoDesfazer);
    }
    if (proposal.lever === "custo-fixo" && proposal.after.fixedCostRate) {
      await saveFixedCostRate(proposal.after.fixedCostRate);
      return null;
    }
    return "Esta alteração não pode ser desfeita.";
  }

  return (
    <main className="wrap" id="conteudo">
      <PageHeader
        title="Configurações"
        meta="Registro de alterações de preço — Lopo Lab"
        status={status}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <NavBar />
      <PageIntro>{INTRO}</PageIntro>

      {error ? <div className="app-error">{error}</div> : null}

      <section className="card settings-card">
        <h2>Alterações de preço</h2>
        {entradas.length === 0 ? (
          <p className="rp-empty">
            Nada registrado ainda. A partir de agora, toda mexida em máquina,
            custo fixo, cor ou insumo que mova preço deixa uma linha aqui — com
            o antes, o depois e quantos produtos ela atingiu.
          </p>
        ) : (
          <ul className="change-list">
            {entradas.map((record) => {
              const aberto = aberta === record.id;
              const desfazivel = canUndo(record);
              return (
                <li className="change-entry" key={record.id}>
                  <button
                    className="change-head"
                    type="button"
                    aria-expanded={aberto}
                    onClick={() => setAberta(aberto ? null : record.id)}
                  >
                    {aberto ? (
                      <ChevronDown size={15} aria-hidden="true" />
                    ) : (
                      <ChevronRight size={15} aria-hidden="true" />
                    )}
                    <span className="change-lever">{LEVER_WORD[record.lever]}</span>
                    <span className="change-summary">{record.summary}</span>
                    <span className="change-affected num">
                      {record.impact.affected} de {record.impact.evaluated}
                    </span>
                    <span className="change-when">{formatDate(record.at)}</span>
                  </button>

                  {aberto ? (
                    <div className="change-body">
                      <p className="change-by">
                        {record.by ? <>Por {record.by}. </> : null}
                        {record.undoOf ? (
                          <em>
                            Esta entrada desfaz uma alteração anterior — desfazer
                            também é mudança global, e deixa o próprio rastro.
                          </em>
                        ) : null}
                      </p>

                      {record.details.length > 0 ? (
                        <ul className="rp-details">
                          {record.details.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      ) : null}

                      <RepriceImpactView
                        impact={record.impact}
                        emptyNote="Nenhum preço se moveu com esta alteração."
                      />

                      {desfazivel ? (
                        <button
                          className="btn btn-secondary change-undo"
                          type="button"
                          onClick={() => abrirDesfazer(record)}
                        >
                          <Undo2 size={15} aria-hidden="true" />
                          {undoLabelOf(record)}
                        </button>
                      ) : (
                        // Cor e insumo não se desfazem daqui de propósito:
                        // desfazer um lote novo seria APAGAR o lote, que é dado
                        // de estoque, não uma alavanca de configuração.
                        <p className="change-no-undo">
                          Esta alavanca é do estoque, não da configuração —
                          desfazê-la seria apagar o rolo ou o lote cadastrado.
                          Para voltar ao preço antigo, corrija a cotação no
                          Estoque; esta entrada guarda o dia e o valor.
                        </p>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {desfazer ? (
        <RepriceGate
          proposal={desfazer.proposal}
          title="Desfazer esta alteração"
          confirmLabel="Desfazer e aplicar"
          undoOf={desfazer.record.id}
          onCommit={commitDesfazer}
          onCancel={() => setDesfazer(null)}
          onDone={() => setDesfazer(null)}
        />
      ) : null}
    </main>
  );
}
