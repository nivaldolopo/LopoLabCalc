"use client";

import { Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { copyText } from "@/lib/clipboard";
import { errorMessage } from "@/lib/errors";
import { MAIN_STAGE_KEY } from "../lib/calculatePricing";
import { stageKeysOf } from "../lib/printAliases";
import type { ProductInput, SavedPrintAlias } from "../types";
import { useConfirm } from "./ConfirmDialog";

const FONTE_LABEL: Record<SavedPrintAlias["fonte"], string> = {
  codigo: "Código",
  mw: "MakerWorld",
  arquivo: "Arquivo",
};

function aliasLabel(alias: SavedPrintAlias): string {
  return [
    `${FONTE_LABEL[alias.fonte]} ${alias.chave}`,
    alias.variante ? `instância ${alias.variante}` : null,
    alias.plate !== null ? `mesa ${alias.plate}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

type ProductIdentityProps = {
  // Editando um produto salvo (senão é um produto NOVO, sem documento).
  editing: boolean;
  // `null` = produto salvo antes do código existir; `undefined` com `editing`
  // = o documento ainda não chegou pela assinatura.
  codigo: string | null | undefined;
  product: ProductInput;
  aliases: SavedPrintAlias[];
  onRemoveAlias: (aliasId: string) => Promise<void>;
};

// S2/S3 — o que IDENTIFICA o produto fora do app: o código (que o dono cola no
// nome do projeto no Bambu Studio) e os apelidos de impressão já aprendidos.
// Nada aqui é editável pelo formulário: o código nasce no save e os apelidos
// vêm da importação (e, no lote 5, da revisão de impressões). Daqui só se
// copia o código e se desfaz um apelido errado.
export function ProductIdentity({
  editing,
  codigo,
  product,
  aliases,
  onRemoveAlias,
}: ProductIdentityProps) {
  const [aviso, setAviso] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();

  const etapas = stageKeysOf(product.stages);
  function stageLabel(stageKey: string): string {
    if (stageKey === MAIN_STAGE_KEY) {
      return product.mainStageName.trim() || "Etapa principal";
    }
    const index = etapas.indexOf(stageKey);
    if (index < 0) return "⚠ etapa removida";
    return product.stages[index - 1]?.name?.trim() || `Etapa ${index + 1}`;
  }

  async function copiar() {
    if (!codigo) return;
    try {
      await copyText(codigo);
      setAviso(`${codigo} copiado.`);
    } catch (err) {
      setAviso(errorMessage(err));
    }
  }

  async function remover(alias: SavedPrintAlias) {
    const confirmed = await ask({
      title: "Remover este apelido?",
      body: (
        <p>
          <strong>{aliasLabel(alias)}</strong> deixa de reconhecer este
          produto. A próxima impressão dessa origem vai perguntar de novo qual
          é o produto.
        </p>
      ),
      confirmLabel: "Remover apelido",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await onRemoveAlias(alias.id);
      setAviso(null);
    } catch (err) {
      setAviso(errorMessage(err));
    }
  }

  return (
    <div className="product-identity">
      <div className="product-identity-code">
        <span className="section-label">Código</span>
        {codigo ? (
          <>
            <span className="product-identity-value">{codigo}</span>
            <button
              className="icon-label-button"
              type="button"
              onClick={copiar}
              title="Cole no nome do projeto no Bambu Studio (ex.: LL-0042 Quatto face)"
            >
              <Copy size={14} /> Copiar código
            </button>
          </>
        ) : (
          <span className="label-hint">
            {!editing
              ? "gerado ao salvar"
              : codigo === undefined
                ? "carregando…"
                : "sem código (produto anterior ao código)"}
          </span>
        )}
      </div>
      {aviso ? (
        <p className="product-identity-note" role="status">
          {aviso}
        </p>
      ) : null}
      {aliases.length > 0 ? (
        <div className="product-identity-aliases">
          <span className="section-label">
            Apelidos de impressão ({aliases.length})
          </span>
          <ul>
            {aliases.map((alias) => (
              <li key={alias.id}>
                <span className="product-identity-alias">
                  {aliasLabel(alias)} → {stageLabel(alias.stageKey)}
                  {alias.objetosPorUnidade > 1
                    ? ` · ${alias.objetosPorUnidade} objetos/un.`
                    : ""}
                </span>
                <button
                  className="icon-button danger"
                  type="button"
                  onClick={() => remover(alias)}
                  aria-label={`Remover apelido ${aliasLabel(alias)}`}
                  title="Remover apelido"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {dialog}
    </div>
  );
}
