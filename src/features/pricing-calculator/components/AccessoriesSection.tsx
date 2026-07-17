"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Accessory, Subitem } from "../types";
import { NumberInput } from "./NumberInput";

type AccessoriesSectionProps = {
  accessories: Accessory[];
  // FEAT-01: subitens vendáveis do produto (vazio quando o modo está desligado).
  // Quando há subitens, cada acessório ganha um seletor para ser atribuído a um
  // subitem (senão fica no nível do produto, rateado).
  subitems: Subitem[];
  onAddAccessory: () => void;
  onRemoveAccessory: (accessoryId: string) => void;
  onUpdateAccessory: (accessoryId: string, patch: Partial<Accessory>) => void;
};

export function AccessoriesSection({
  accessories,
  subitems,
  onAddAccessory,
  onRemoveAccessory,
  onUpdateAccessory,
}: AccessoriesSectionProps) {
  const [open, setOpen] = useState(false);

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
        </div>
        <div className="acc-header">
          <span>Descrição</span>
          <span>Qtd/peça</span>
          <span>R$/un</span>
          <span />
        </div>
        {accessories.map((accessory) => (
          <div className="accessory-block" key={accessory.id}>
            <div className="accessory-row">
              <input
                type="text"
                value={accessory.desc}
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
        ))}
        <button className="link-button bordered" type="button" onClick={onAddAccessory}>
          <Plus size={15} />
          Adicionar acessório
        </button>
      </div>
    </div>
  );
}
