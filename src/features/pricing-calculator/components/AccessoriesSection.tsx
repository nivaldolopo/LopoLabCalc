"use client";

import { ChevronDown, Plus, RefreshCw, Trash2 } from "lucide-react";
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
  // 7e: insumos ATIVOS do estoque. Ligar o acessório a um deles é o que faz a
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

  // Escolher o insumo COPIA nome e preço para o acessório (denormalização
  // deliberada, igual ao `pricePerKg` do filamento): o produto continua se
  // precificando sozinho, sem depender do estoque estar carregado.
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
        <div className="acc-header">
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
          const refill = supply ? catalogUnitPrice(supply) : 0;
          const stale =
            supply !== undefined &&
            refill > 0 &&
            Math.abs(refill - (accessory.unitPrice || 0)) > 0.001;

          return (
          <div className="accessory-block" key={accessory.id}>
            <div className="accessory-row">
              <input
                type="text"
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
              <NumberInput
                min={0}
                step={1}
                value={accessory.qty}
                onChange={(qty) => onUpdateAccessory(accessory.id ?? "", { qty })}
              />
              <NumberInput
                min={0}
                step="0.01"
                value={accessory.unitPrice}
                onChange={(unitPrice) =>
                  onUpdateAccessory(accessory.id ?? "", { unitPrice })
                }
              />
              <button
                className="icon-button danger"
                type="button"
                onClick={() => onRemoveAccessory(accessory.id ?? "")}
                title="Remover acessório"
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
                {supplies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                {orphan ? (
                  <option value={accessory.supplyId ?? ""}>
                    (insumo removido do estoque)
                  </option>
                ) : null}
              </select>
            </label>

            {stale && supply ? (
              <div className="accessory-hint">
                O insumo está a {formatCurrency(refill)}/{supply.unit} agora.
                <button
                  className="link-button"
                  type="button"
                  onClick={() =>
                    onUpdateAccessory(accessory.id ?? "", { unitPrice: refill })
                  }
                >
                  <RefreshCw size={13} /> Atualizar preço
                </button>
              </div>
            ) : null}

            {orphan ? (
              <div className="accessory-hint warn">
                O insumo ligado não está mais no estoque — o custo segue valendo,
                mas a produção não vai dar baixa. Escolha outro ou deixe avulso.
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
