"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Undo2 } from "lucide-react";
import { formatDate } from "@/lib/formatting/date";
import {
  canUndo,
  energyTariffProposal,
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
import { EnergyTariffPanel } from "./EnergyTariffPanel";
import { FixedCostRatePanel } from "./FixedCostRatePanel";
import { MachinesSettingsPanel } from "./MachinesSettingsPanel";
import { Modal } from "./Modal";
import { PaymentFeesPanel } from "./PaymentFeesPanel";
import { RepriceGate } from "./RepriceGate";
import { RepriceImpactView } from "./RepriceImpactView";

export type SettingsTab =
  | "maquinas"
  | "custo-fixo"
  | "energia"
  | "taxas"
  | "negocio"
  | "alteracoes";

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "maquinas", label: "Máquinas" },
  { key: "custo-fixo", label: "Custo fixo" },
  { key: "energia", label: "Energia" },
  { key: "taxas", label: "Taxas" },
  { key: "negocio", label: "Dados do negócio" },
  { key: "alteracoes", label: "Alterações de preço" },
];

const LEVER_WORD: Record<ChangeLever, string> = {
  maquinas: "Frota",
  "custo-fixo": "Custo fixo",
  energia: "Energia",
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
  const { machines, rev, loaded: machinesLoaded, saveMachines } = useMachines();
  const {
    fixedCostRate,
    saveFixedCostRate,
    energyTariff,
    saveEnergyTariff,
    rev: revNegocio,
    error: negocioError,
  } = useBusinessSettings();
  const { fees, saveFees } = useFees();
  // [V8] O erro do save das taxas mora AQUI, e não no painel: o `setDoc` aplica
  // no cache na hora, o snapshot muda `fees` e o painel remonta pela chave
  // ANTES do save voltar — um erro guardado nele cairia numa instância morta,
  // e a tela mostraria as taxas novas como se tivessem gravado.
  const [feesError, setFeesError] = useState<string | null>(null);
  const { business, saveBusiness } = useQuoteConfig();

  // A entrada que veio do aviso pós-fato já nasce aberta.
  const [aberta, setAberta] = useState<string | null>(entrada);
  // As propostas na mesa. `null` = nada pendente.
  //
  // [W3] Cada uma leva a `rev` do doc de onde o "antes" dela saiu, capturada no
  // MESMO `setState` da proposta (AUD-18): se outra aba gravar enquanto a
  // prévia está aberta, o save é recusado em vez de apagar o valor de lá e
  // deixar um rastro "antes→depois" com o antes errado.
  const [taxaProposta, setTaxaProposta] = useState<
    { proposal: RepriceProposal; rev: number } | null
  >(null);
  const [tarifaProposta, setTarifaProposta] = useState<
    { proposal: RepriceProposal; rev: number } | null
  >(null);
  // A proposta de DESFAZER, com a entrada de origem e as duas versões — o
  // desfazer pode cair em `config/machines` ou em `config/negocio`.
  const [desfazer, setDesfazer] = useState<
    {
      proposal: RepriceProposal;
      record: ChangeRecord;
      revMaquinas: number;
      revNegocio: number;
    } | null
  >(null);

  const entradas = useMemo(
    () => [...changes].sort((a, b) => b.at - a.at),
    [changes],
  );

  // [V1] O `onCommit` do `RepriceGate` devolve o erro do save — e o gate só
  // grava o rastro quando ele volta `null`. Era `await save(); return null`: a
  // gravação que falhava virava entrada em `alteracoes` de uma mudança que não
  // aconteceu, quebrando "alavanca primeiro, rastro depois".
  function abrirDesfazer(record: ChangeRecord) {
    const proposal = undoProposal(record, machines, fixedCostRate, energyTariff);
    if (!proposal) return;
    setDesfazer({ proposal, record, revMaquinas: rev, revNegocio });
  }

  async function commitDesfazer(): Promise<string | null> {
    if (!desfazer) return "Nada a desfazer.";
    const { proposal } = desfazer;
    if (proposal.lever === "maquinas" && proposal.after.machines) {
      return saveMachines(proposal.after.machines, desfazer.revMaquinas);
    }
    if (proposal.lever === "custo-fixo" && proposal.after.fixedCostRate) {
      return saveFixedCostRate(proposal.after.fixedCostRate, desfazer.revNegocio);
    }
    if (proposal.lever === "energia" && proposal.after.energyTariff !== null) {
      return saveEnergyTariff(proposal.after.energyTariff, desfazer.revNegocio);
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
          machinesLoaded ? (
            <MachinesSettingsPanel machines={machines} rev={rev} onSave={saveMachines} />
          ) : (
            <p className="settings-tab-intro">Carregando máquinas…</p>
          )
        ) : null}

        {tab === "custo-fixo" ? (
          <FixedCostRatePanel
            // Só os VALORES na chave, não a `rev`: a tarifa mudada em outra aba
            // adianta a `rev` e apagaria o rascunho do custo fixo. A trava [W3]
            // não precisa dela aqui — a proposta captura valor vivo e `rev` viva
            // no mesmo clique.
            key={`${fixedCostRate.rent}-${fixedCostRate.other}-${fixedCostRate.machines}-${fixedCostRate.hoursDay}-${fixedCostRate.daysMonth}`}
            rate={fixedCostRate}
            onApplyRate={(rate) =>
              setTaxaProposta({
                proposal: fixedCostProposal(fixedCostRate, rate, machines, energyTariff),
                rev: revNegocio,
              })
            }
            saveError={negocioError}
          />
        ) : null}

        {tab === "energia" ? (
          <EnergyTariffPanel
            key={energyTariff}
            tariff={energyTariff}
            onApplyTariff={(tariff) =>
              setTarifaProposta({
                proposal: energyTariffProposal(energyTariff, tariff, machines, fixedCostRate),
                rev: revNegocio,
              })
            }
            saveError={negocioError}
          />
        ) : null}

        {tab === "taxas" ? (
          <PaymentFeesPanel
            // Remonta quando as taxas em vigor mudam (o próprio save, ou outra
            // aba): o rascunho parte sempre do que vale.
            key={JSON.stringify(fees)}
            fees={fees}
            error={feesError}
            onSave={async (next) => {
              setFeesError(null);
              const falha = await saveFees(next);
              setFeesError(falha);
              return falha;
            }}
          />
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

      {taxaProposta && taxaProposta.proposal.after.fixedCostRate ? (
        <RepriceGate
          proposal={taxaProposta.proposal}
          title="Aplicar o custo fixo"
          confirmLabel="Aplicar ao catálogo"
          onCommit={() =>
            saveFixedCostRate(taxaProposta.proposal.after.fixedCostRate!, taxaProposta.rev)
          }
          onCancel={() => setTaxaProposta(null)}
          onDone={() => setTaxaProposta(null)}
        />
      ) : null}

      {tarifaProposta && tarifaProposta.proposal.after.energyTariff !== null ? (
        <RepriceGate
          proposal={tarifaProposta.proposal}
          title="Aplicar a tarifa de energia"
          confirmLabel="Aplicar ao catálogo"
          onCommit={() =>
            saveEnergyTariff(tarifaProposta.proposal.after.energyTariff!, tarifaProposta.rev)
          }
          onCancel={() => setTarifaProposta(null)}
          onDone={() => setTarifaProposta(null)}
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
