"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Accessory } from "../types";

type AccessoriesSectionProps = {
  accessories: Accessory[];
  onAddAccessory: () => void;
  onRemoveAccessory: (accessoryId: string) => void;
  onUpdateAccessory: (accessoryId: string, patch: Partial<Accessory>) => void;
};

export function AccessoriesSection({
  accessories,
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
        </div>
        <div className="acc-header">
          <span>Descrição</span>
          <span>Qtd</span>
          <span>R$/un</span>
          <span />
        </div>
        {accessories.map((accessory) => (
          <div className="accessory-row" key={accessory.id}>
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
            <input
              min={0}
              step={1}
              type="number"
              value={accessory.qty}
              onChange={(event) =>
                onUpdateAccessory(accessory.id ?? "", {
                  qty: Number(event.target.value) || 0,
                })
              }
            />
            <input
              min={0}
              step="0.01"
              type="number"
              value={accessory.unitPrice}
              onChange={(event) =>
                onUpdateAccessory(accessory.id ?? "", {
                  unitPrice: Number(event.target.value) || 0,
                })
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
        ))}
        <button className="link-button bordered" type="button" onClick={onAddAccessory}>
          <Plus size={15} />
          Adicionar acessório
        </button>
      </div>
    </div>
  );
}
