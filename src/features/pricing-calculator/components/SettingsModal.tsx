"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Undo2 } from "lucide-react";
import { formatDate } from "@/lib/formatting/date";
import {
  canUndo,
  fixedCostProposal,
  undoLabelOf,
  undoProposal,
  type RepriceProposal,
} from "../lib/changeLog";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useChangeLog } from "../hooks/useChangeLog";
import { useFees } from "../hooks/useFees";
import { useMachines } from "../hooks/useMachines";
import { useQuoteConfig } from "../hooks/useQuoteConfig";
import type { ChangeLever, ChangeRecord } from "../types";
import { BusinessInfoPanel } from "./BusinessInfoPanel";
import { FixedCostRatePanel } from "./FixedCostRatePanel";
import { MachinesSettingsPanel } from "./MachinesSettingsPanel";
import { Modal } from "./Modal";
import { PaymentFeesPanel } from "./PaymentFeesPanel";
import { RepriceGate } from "./RepriceGate";
import { RepriceImpactView } from "./RepriceImpactView";

export type SettingsTab = "maquinas" | "custo-fixo" | "taxas" | "negocio" | "alteracoes";

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "maquinas", label: "Máquinas" },
  { key: "custo-fixo", label: "Custo fixo" },
  { key: "taxas", label: "Taxas" },
  { key: "negocio", label: "Dados do negócio" },
  { key: "alteracoes", label: "Alterações de preço" },
];

const LEVER_WORD: Record<ChangeLever, string> = {
  maquinas: "Frota",
  "custo-fixo": "Custo fixo",
  cor: "Cor",
  insumo: "Insumo",
};

type SettingsModalProps = {
  initialTab: SettingsTab;
  // A entrada que o "ver quais" do aviso pós-fato pediu — já nasce aberta na
  // aba "Alterações de preço".
  entrada: string | null;
  onClose: () => void;
};

/**
 * [FEAT-12] peça 4 — o modal de CONFIGURAÇÕES.
 *
 * ⚠ Era uma PÁGINA (`/configuracoes`), com cada seção de config espalhada por
 * 3 outras telas (modal da calculadora, painel da calculadora, editor da
 * venda, card do orçamento). Frente 2 do plano 2026-09-15 (dono, 2026-09-17):
 * virou UM modal só, com abas — nada mais abre por cima dele, exceto o
 * `RepriceGate` (a confirmação de máquinas/custo fixo), que já empilhava
 * sobre o antigo `MachineManagerModal` e continua empilhando aqui pelo mesmo
 * motivo — é o gate de segurança do FEAT-12, não uma segunda tela de config.
 */
export function SettingsModal({ initialTab, entrada, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const { changes, error: changeLogError } = useChangeLog();
  const { machines, rev, saveMachines } = useMachines();
  const { fixedCostRate, saveFixedCostRate, error: fixedCostError } = useBusinessSettings();
  const { fees, saveFees, error: feesError } = useFees();
  const { business, saveBusiness } = useQuoteConfig();

  // A entrada que veio do aviso pós-fato já nasce aberta.
  const [aberta, setAberta] = useState<string | null>(entrada);
  // A proposta de custo fixo na mesa. `null` = nada pendente.
  const [taxaProposta, setTaxaProposta] = useState<RepriceProposal | null>(null);
  // A proposta de DESFAZER na mesa, com a entrada de origem.
  const [desfazer, setDesfazer] = useState<
    { proposal: RepriceProposal; record: ChangeRecord } | null
  >(null);
  // AUD-18 — a versão é capturada JUNTO da proposta, no mesmo `useState`.
  const [revDoDesfazer, setRevDoDesfazer] = useState(0);

  const entradas = useMemo(
    () => [...changes].sort((a, b) => b.at - a.at),
    [changes],
  );

  async function commitTaxa(rate: typeof fixedCostRate): Promise<string | null> {
    await saveFixedCostRate(rate);
    return null;
  }

  function abrirDesfazer(record: ChangeRecord) {
    const proposal = undoProposal(record, machines, fixedCostRate);
    if (!proposal) return;
    setRevDoDesfazer(rev);
    setDesfazer({ proposal, record });
  }

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

  const tabStrip = (
    <div className="stock-tabs" role="tablist">
      {TABS.map((item) => (
        <button
          key={item.key}
          className={`stock-tab ${tab === item.key ? "active" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === item.key}
          onClick={() => setTab(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <Modal
        title="Configurações"
        onClose={onClose}
        className="settings-modal"
        tabs={tabStrip}
      >
        {tab === "maquinas" ? (
          <MachinesSettingsPanel machines={machines} rev={rev} onSave={saveMachines} />
        ) : null}

        {tab === "custo-fixo" ? (
          <FixedCostRatePanel
            key={`${fixedCostRate.rent}-${fixedCostRate.other}-${fixedCostRate.machines}-${fixedCostRate.hoursDay}-${fixedCostRate.daysMonth}`}
            rate={fixedCostRate}
            onApplyRate={(rate) =>
              setTaxaProposta(fixedCostProposal(fixedCostRate, rate, machines))
            }
            saveError={fixedCostError}
          />
        ) : null}

        {tab === "taxas" ? (
          <PaymentFeesPanel fees={fees} onChange={saveFees} error={feesError} />
        ) : null}

        {tab === "negocio" ? (
          <BusinessInfoPanel
            key={`${business.name}-${business.phone}-${business.instagram}-${business.email}`}
            business={business}
            onSave={saveBusiness}
          />
        ) : null}

        {tab === "alteracoes" ? (
          <div>
            <p className="settings-tab-intro">
              O preço não é um campo guardado — toda tela o recalcula a partir
              das máquinas, do custo fixo e do estoque. Este registro é o
              rastro de cada alteração global: é ele que responde “por que
              este produto está 18% mais caro que semana passada?”.
            </p>
            {changeLogError ? <div className="app-error">{changeLogError}</div> : null}
            {entradas.length === 0 ? (
              <p className="rp-empty">
                Nada registrado ainda. A partir de agora, toda mexida em
                máquina, custo fixo, cor ou insumo que mova preço deixa uma
                linha aqui — com o antes, o depois e quantos produtos ela
                atingiu.
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
                                Esta entrada desfaz uma alteração anterior —
                                desfazer também é mudança global, e deixa o
                                próprio rastro.
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
                            <p className="change-no-undo">
                              Esta alavanca é do estoque, não da configuração —
                              desfazê-la seria apagar o rolo ou o lote
                              cadastrado. Para voltar ao preço antigo, corrija
                              a cotação no Estoque; esta entrada guarda o dia e
                              o valor.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </Modal>

      {taxaProposta && taxaProposta.after.fixedCostRate ? (
        <RepriceGate
          proposal={taxaProposta}
          title="Aplicar o custo fixo"
          confirmLabel="Aplicar ao catálogo"
          onCommit={() => commitTaxa(taxaProposta.after.fixedCostRate!)}
          onCancel={() => setTaxaProposta(null)}
          onDone={() => setTaxaProposta(null)}
        />
      ) : null}

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
    </>
  );
}
