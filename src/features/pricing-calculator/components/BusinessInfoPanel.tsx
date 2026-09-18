"use client";

import { useId, useState } from "react";
import type { QuoteBusiness } from "../types";

type BusinessInfoPanelProps = {
  business: QuoteBusiness;
  // TD-029 — devolve a mensagem de erro, ou `null` se deu certo. Os campos
  // gravam ao sair (onBlur), sem esperar — a falha (offline/regras) vira aviso
  // inline em vez de sumir num `void`.
  onSave: (next: QuoteBusiness) => Promise<string | null>;
};

/**
 * A aba "Dados do negócio" do modal de Configurações.
 *
 * ⚠ Era o primeiro card da página `/orcamento` (frente 2, 2026-09-17). O
 * orçamento continua LENDO o valor vivo pra imprimir o cabeçalho do PDF — só a
 * edição saiu de lá pra cá. Rascunho local, como os outros painéis desta
 * casa: quem hospeda remonta por `key` quando o doc muda por baixo.
 */
export function BusinessInfoPanel({ business, onSave }: BusinessInfoPanelProps) {
  const fieldId = useId();
  const [draft, setDraft] = useState<QuoteBusiness>(business);
  const [error, setError] = useState<string | null>(null);

  function update(patch: Partial<QuoteBusiness>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function persist() {
    const failure = await onSave(draft);
    setError(failure);
  }

  return (
    <div>
      <p className="settings-tab-intro">
        Nome, contato e Instagram do negócio — saem no cabeçalho de todo
        orçamento em PDF.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="field-block compact">
        <label className="section-label" htmlFor={`${fieldId}-business`}>
          Nome do negócio
        </label>
        <input
          id={`${fieldId}-business`}
          className="field-input"
          type="text"
          value={draft.name}
          onChange={(event) => update({ name: event.target.value })}
          onBlur={() => void persist()}
          placeholder="Nome do negócio"
        />
      </div>
      <div className="two-col">
        <div className="field-block compact">
          <label className="section-label" htmlFor={`${fieldId}-phone`}>
            Telefone / WhatsApp
          </label>
          <input
            id={`${fieldId}-phone`}
            className="field-input"
            type="text"
            value={draft.phone}
            onChange={(event) => update({ phone: event.target.value })}
            onBlur={() => void persist()}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div className="field-block compact">
          <label className="section-label" htmlFor={`${fieldId}-instagram`}>
            Instagram
          </label>
          <input
            id={`${fieldId}-instagram`}
            className="field-input"
            type="text"
            value={draft.instagram}
            onChange={(event) => update({ instagram: event.target.value })}
            onBlur={() => void persist()}
            placeholder="@lopolab"
          />
        </div>
      </div>
      <div className="field-block compact">
        <label className="section-label" htmlFor={`${fieldId}-email`}>
          E-mail
        </label>
        <input
          id={`${fieldId}-email`}
          className="field-input"
          type="text"
          value={draft.email}
          onChange={(event) => update({ email: event.target.value })}
          onBlur={() => void persist()}
          placeholder="contato@lopolab.com.br"
        />
      </div>
    </div>
  );
}
