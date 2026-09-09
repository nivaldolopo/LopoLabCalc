"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { errorMessage } from "@/lib/errors";
import { DEFAULT_FIXED_COSTS } from "../constants";
import { toChangeImpact, type RepriceProposal } from "../lib/changeLog";
import {
  computeRepriceImpact,
  type RepriceLevers,
} from "../lib/repriceImpact";
import { useAuth } from "../hooks/useAuth";
import { useChangeLog } from "../hooks/useChangeLog";
import { useProducts } from "../hooks/useProducts";
import { useStock } from "../hooks/useStock";
import { useSupplies } from "../hooks/useSupplies";
import type { FixedCostRate, FixedCostSettings } from "../types";
import { Modal } from "./Modal";
import { RepriceImpactView } from "./RepriceImpactView";

/**
 * [FEAT-12] peça 2 — o PASSO DE CONFIRMAÇÃO de uma mudança global de preço.
 *
 * ⚠ Componente AUTÔNOMO, e não um pedaço colado no `MachineManagerModal`: os
 * painéis de config vão mudar de casa (peça 4 — a `/configuracoes` é a casa
 * futura da coleção `config/`) e acoplar custaria reescrita. O que ele recebe é
 * uma PROPOSTA pura, montada pelo `changeLog.ts`; produtos, estoque e insumos
 * ele busca sozinho, porque são os mesmos dos dois lados da conta.
 *
 * Ele monta os hooks só quando está montado — e ele só é montado quando há uma
 * proposta na mesa. Uma tela que o renderize sempre pagaria três assinaturas de
 * coleção para não mostrar nada.
 *
 * Cancelar NÃO grava: o que está na tela é o rascunho de hoje, e ele continua
 * lá quando o diálogo fecha.
 */

type RepriceGateProps = {
  proposal: RepriceProposal;
  // O título do diálogo. Nomeia a ALAVANCA que o dono está olhando ("Salvar as
  // máquinas", "Desfazer a alteração de 8/9"), não o componente.
  title: string;
  confirmLabel?: string;
  // Grava a ALAVANCA. Devolve a mensagem de erro, ou `null` se deu certo — molde
  // do TD-020: o diálogo não fecha em cima de um save que não aconteceu.
  //
  // ⚠ A ordem é ALAVANCA PRIMEIRO, registro depois. Um rastro sem a mudança
  // correspondente descreveria um preço que nunca existiu.
  onCommit: () => Promise<string | null>;
  onCancel: () => void;
  // Chamado quando a alavanca foi gravada. A tela de origem fecha o próprio
  // modal aqui — mesmo que o RASTRO tenha falhado, porque a mudança aconteceu.
  onDone: () => void;
  // O id da entrada que esta mudança desfaz (peça 6). `null` = original.
  undoOf?: string | null;
};

export function RepriceGate({
  proposal,
  title,
  confirmLabel = "Confirmar e aplicar",
  onCommit,
  onCancel,
  onDone,
  undoOf = null,
}: RepriceGateProps) {
  const { products } = useProducts();
  const { filaments } = useStock();
  const { supplies } = useSupplies();
  const { recordChange } = useChangeLog();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // O `enabled` é o PISO, igual ao catálogo: cada produto traz o próprio
  // `includeFixed`, aplicado por cima pelo `calculatePricing`. Usar outro valor
  // aqui faria o "antes" da prévia divergir do preço que está na vitrine.
  const fixedOf = (rate: FixedCostRate): FixedCostSettings => ({
    ...rate,
    enabled: DEFAULT_FIXED_COSTS.enabled,
  });

  const impact = useMemo(() => {
    // ⚠ `filaments` e `supplies` vão INTEIROS, com os arquivados: filtrar aqui
    // faria arquivado passar por removido, e a prévia inventaria uma queda para
    // o preço de fallback que não vai acontecer (7c / TD-033).
    const antes: RepriceLevers = {
      machines: proposal.machinesBefore,
      fixedCosts: fixedOf(proposal.fixedRateBefore),
      stock: filaments,
      supplies,
    };
    const depois: RepriceLevers = {
      machines: proposal.machinesAfter,
      fixedCosts: fixedOf(proposal.fixedRateAfter),
      stock: filaments,
      supplies,
    };
    return computeRepriceImpact(products, antes, depois);
  }, [products, filaments, supplies, proposal]);

  async function confirmar() {
    setError(null);
    setSaving(true);
    const falha = await onCommit();
    if (falha) {
      // AUD-18: a recusa por `rev` chega por aqui. A prévia é DESCARTADA com o
      // motivo — ela foi calculada contra uma lista que o servidor não tem
      // mais, e mostrá-la ao lado do erro afirmaria um "antes" que já morreu.
      setSaving(false);
      setError(falha);
      return;
    }

    // A alavanca já mudou. Daqui em diante nada pode voltar atrás, então a falha
    // do RASTRO não é a falha da mudança: ela vira aviso, e o diálogo fecha
    // assim mesmo. Dizer "não salvou" aqui seria mentira — e pior que a mentira
    // oposta, porque convidaria o dono a repetir a alteração.
    try {
      await recordChange({
        at: Date.now(),
        by: user?.email ?? "",
        lever: proposal.lever,
        summary: proposal.summary,
        details: proposal.details,
        before: proposal.before,
        after: proposal.after,
        impact: toChangeImpact(impact),
        undoOf,
      });
    } catch (err) {
      console.warn("[FEAT-12] a alteração foi aplicada, mas o registro falhou:", errorMessage(err));
    }
    setSaving(false);
    onDone();
  }

  return (
    <Modal
      title={title}
      sub={
        "O preço não é um campo guardado: toda tela o recalcula. Esta alteração " +
        "vale para o catálogo inteiro e para todos os aparelhos, na hora. " +
        "Confira o que ela move antes de aplicar."
      }
      onClose={onCancel}
      className="reprice-modal"
      footer={
        <>
          <button
            className="btn primary"
            type="button"
            onClick={confirmar}
            disabled={saving}
          >
            {saving ? "Aplicando..." : confirmLabel}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>
            Cancelar
          </button>
        </>
      }
    >
      <h3 className="rp-sub">O que muda</h3>
      {proposal.details.length > 0 ? (
        <ul className="rp-details">
          {proposal.details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="rp-empty">Nenhum campo foi alterado.</p>
      )}

      {/* A exclusão de máquina é a única linha que muda o SIGNIFICADO do
          conjunto salvo em cada produto, e não só um número: o id vira órfão e o
          `resolveFleet` cai na frota inteira, com badge. Ela merece o aviso
          próprio — a lista acima a descreve, esta faixa a destaca. */}
      {proposal.details.some((line) => line.includes("EXCLUÍDA")) ? (
        <div className="rp-warning" role="note">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>
            Excluir uma máquina <strong>não é só tirar um número</strong>: o id
            dela continua salvo em cada produto que a marcava e vira órfão. Esses
            produtos passam a ser precificados pela frota inteira, com o aviso de
            dado órfão no cadastro — e o preço abaixo já conta com isso.
          </span>
        </div>
      ) : null}

      <h3 className="rp-sub">O que isso faz com os preços</h3>
      <RepriceImpactView
        impact={impact}
        emptyNote="Nenhum preço se move com esta alteração."
      />

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
