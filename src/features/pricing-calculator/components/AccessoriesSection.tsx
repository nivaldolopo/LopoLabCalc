"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/formatting/currency";
import { catalogUnitPrice } from "../lib/supplies";
import type { Accessory, Subitem, Supply } from "../types";
import { NumberInput } from "./NumberInput";

type AccessoriesSectionProps = {
  accessories: Accessory[];
  // FEAT-01: subitens vendáveis do produto (vazio quando o modo está desligado).
  // Quando há subitens, cada acessório ganha um seletor para ser atribuído a um
  // subitem (senão fica no nível do produto, rateado).
  subitems: Subitem[];
  // 7e: insumos do estoque, a lista INTEIRA — as ativas viram opção e a
  // arquivada só aparece quando é a que está ligada (espelho do
  // `FilamentColorsSection`). Ligar o acessório a um insumo é o que faz a
  // produção dar baixa por unidade; sem ligação, o acessório é avulso (só custo).
  supplies: Supply[];
  onAddAccessory: () => void;
  onRemoveAccessory: (accessoryId: string) => void;
  onUpdateAccessory: (accessoryId: string, patch: Partial<Accessory>) => void;
};

const AVULSO = "__avulso__";

export function AccessoriesSection({
  accessories,
  subitems,
  supplies,
  onAddAccessory,
  onRemoveAccessory,
  onUpdateAccessory,
}: AccessoriesSectionProps) {
  const [open, setOpen] = useState(false);
  // TD-033: as opções do seletor são as ATIVAS, em ordem — a arquivada só
  // aparece quando é a que já está ligada (bloco abaixo), como a cor arquivada.
  const activeSupplies = supplies
    .filter((supply) => !supply.archived)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  // Escolher o insumo COPIA nome e preço para o acessório (denormalização
  // deliberada, igual ao `pricePerKg` do filamento). ⚠ TD-033: o preço copiado é
  // FALLBACK, não a fonte — quem precifica lê o cadastro na hora do cálculo. Ele
  // só volta a valer se o insumo for removido do Estoque.
  function linkSupply(accessory: Accessory, supplyId: string) {
    if (supplyId === AVULSO) {
      onUpdateAccessory(accessory.id ?? "", { supplyId: null });
      return;
    }
    const supply = supplies.find((item) => item.id === supplyId);
    if (!supply) return;
    onUpdateAccessory(accessory.id ?? "", {
      supplyId: supply.id,
      desc: supply.name,
      unitPrice: catalogUnitPrice(supply),
    });
  }

  return (
    <div className={`collapse-section ${open ? "open" : ""}`}>
      <button
        className="collapse-head"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="collapse-title">
          🧩 Acessórios / itens extras
          {accessories.length > 0 ? (
            <span className="collapse-badge">{accessories.length}</span>
          ) : null}
        </span>
        <ChevronDown className="collapse-chevron" size={14} />
      </button>
      <div className="collapse-body">
        <div className="section-note">
          Componentes que somam ao custo (ex: corrente e argola de chaveiro,
          teclas de teclado). Informe descrição, quantidade e preço unitário.
          A <strong>quantidade é por peça</strong> (não o total da mesa): se cada
          peça leva 1 argola, informe 1 — mesmo imprimindo várias por mesa.
          Ligue o acessório a um <strong>insumo do estoque</strong> para a
          produção dar baixa dele automaticamente.
        </div>
        {/* UX-47: no celular esta faixa some e cada campo carrega o próprio
            rótulo (o `.acc-label` abaixo) — a fileira vira CARTÃO, a mesma
            receita do `.machine-edit-row`. Aqui ela é decorativa: quem nomeia o
            campo para leitor de tela é o `aria-label` de cada input, que existe
            nos dois modos. */}
        <div className="acc-header" aria-hidden="true">
          <span>Descrição</span>
          <span>Qtd/peça</span>
          <span>R$/un</span>
          <span />
        </div>
        {accessories.map((accessory) => {
          const supply = accessory.supplyId
            ? supplies.find((item) => item.id === accessory.supplyId)
            : undefined;
          // Insumo apagado/arquivado depois de ligado: o acessório segue
          // valendo pelo preço congelado, mas o dono precisa saber que a baixa
          // não vai acontecer.
          const orphan = Boolean(accessory.supplyId) && !supply;
          const livePrice = supply ? catalogUnitPrice(supply) : 0;
          // TD-033, espelho do `showLivePrice` do filamento: só-leitura quando há
          // preço vivo (insumo com lote). Insumo sem lote ou removido cai no
          // preço salvo, que permanece editável (fallback D3).
          const showLivePrice = Boolean(supply) && livePrice > 0;

          return (
          <div className="accessory-block" key={accessory.id}>
            {/* UX-16: linha em formato de tabela — o rótulo é o cabeçalho de
                COLUNA (.acc-header), que serve as N linhas e por isso não pode
                ser <label> de nenhuma. Cada campo ganha o próprio `aria-label`;
                antes os três não tinham nome nenhum. */}
            <div className="accessory-row">
              <span className="acc-field acc-field-desc">
                <span className="acc-label" aria-hidden="true">
                  Descrição
                </span>
                <input
                  type="text"
                  aria-label="Descrição do acessório"
                  value={accessory.desc}
                  readOnly={Boolean(supply)}
                  title={supply ? "O nome vem do insumo do estoque" : undefined}
                  onChange={(event) =>
                    onUpdateAccessory(accessory.id ?? "", {
                      desc: event.target.value,
                    })
                  }
                  placeholder="Ex: Argola"
                />
              </span>
              <span className="acc-field">
                <span className="acc-label" aria-hidden="true">
                  Qtd/peça
                </span>
                <NumberInput
                  aria-label="Quantidade por peça"
                  min={0}
                  step={1}
                  value={accessory.qty}
                  onChange={(qty) => onUpdateAccessory(accessory.id ?? "", { qty })}
                />
              </span>
              <span className="acc-field">
                <span className="acc-label" aria-hidden="true">
                  R$/un
                </span>
                {showLivePrice ? (
                  <div
                    className="acc-live-price"
                    title="Preço do lote mais novo (Estoque) — atualiza sozinho"
                  >
                    {formatCurrency(livePrice)}
                  </div>
                ) : (
                  <NumberInput
                    aria-label="Preço unitário (R$)"
                    min={0}
                    step="0.01"
                    value={accessory.unitPrice}
                    onChange={(unitPrice) =>
                      onUpdateAccessory(accessory.id ?? "", { unitPrice })
                    }
                  />
                )}
              </span>
              <button
                className="icon-button danger"
                type="button"
                onClick={() => onRemoveAccessory(accessory.id ?? "")}
                title="Remover acessório"
                aria-label={`Remover o acessório ${accessory.desc || "sem descrição"}`}
              >
                <Trash2 size={16} />
              </button>
            </div>

            <label className="accessory-subitem">
              <span>Insumo:</span>
              <select
                className="field-input"
                value={accessory.supplyId ?? AVULSO}
                onChange={(event) => linkSupply(accessory, event.target.value)}
              >
                <option value={AVULSO}>Avulso (sem baixa no estoque)</option>
                {activeSupplies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                {supply && supply.archived ? (
                  <option value={supply.id}>{supply.name} (arquivado)</option>
                ) : null}
                {orphan ? (
                  <option value={accessory.supplyId ?? ""}>
                    (insumo removido do estoque)
                  </option>
                ) : null}
              </select>
            </label>

            {/* TD-033: aqui ficava o aviso "o insumo está a R$ x agora ·
                Atualizar preço". Ele existia porque o preço era congelado na
                escolha; com o preço VIVO ele mentiria — o custo já está no valor
                do cadastro, e não há nada para atualizar à mão. */}

            {orphan ? (
              <div className="accessory-hint warn">
                O insumo ligado não está mais no estoque — o custo caiu no
                último preço salvo e a produção não vai dar baixa. Escolha outro
                ou deixe avulso.
              </div>
            ) : null}

            {subitems.length > 0 ? (
              <label className="accessory-subitem">
                <span>Vai para:</span>
                <select
                  className="field-input"
                  value={accessory.subitemId ?? ""}
                  onChange={(event) =>
                    onUpdateAccessory(accessory.id ?? "", {
                      subitemId: event.target.value || null,
                    })
                  }
                >
                  <option value="">Produto inteiro (rateado)</option>
                  {subitems.map((subitem, index) => (
                    <option key={subitem.id} value={subitem.id}>
                      {subitem.name?.trim() || `Subitem ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          );
        })}
        <button className="link-button bordered" type="button" onClick={onAddAccessory}>
          <Plus size={15} />
          Adicionar acessório
        </button>
      </div>
    </div>
  );
}
