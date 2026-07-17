"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatting/currency";
import type { ProductInput, Subitem, SubitemPrice } from "../types";

type SubitemsSectionProps = {
  product: ProductInput;
  // Preços vivos por subitem (result.subitems), para mostrar o valor de cada um.
  subitemPrices?: SubitemPrice[];
  onToggle: (on: boolean) => void;
  onAddSubitem: () => void;
  onRemoveSubitem: (subitemId: string) => void;
  onUpdateSubitem: (subitemId: string, patch: Partial<Subitem>) => void;
  onToggleStage: (subitemId: string, stageKey: string, include: boolean) => void;
};

// Lista as etapas do produto como opções estáveis: principal ("main") + extras
// (pela sua identidade/id), com um rótulo amigável.
function stageOptions(product: ProductInput): { key: string; label: string }[] {
  return [
    { key: "main", label: product.mainStageName?.trim() || "Etapa principal" },
    ...product.stages.map((stage, index) => ({
      key: stage.id ?? `stage_${index}`,
      label: stage.name?.trim() || `Etapa ${index + 2}`,
    })),
  ];
}

export function SubitemsSection({
  product,
  subitemPrices,
  onToggle,
  onAddSubitem,
  onRemoveSubitem,
  onUpdateSubitem,
  onToggleStage,
}: SubitemsSectionProps) {
  // Sliders de markup abertos (além dos que já têm override salvo).
  const [markupOpen, setMarkupOpen] = useState<Set<string>>(new Set());
  const on = product.sellBySubitems;
  const options = stageOptions(product);
  const priceById = new Map((subitemPrices ?? []).map((s) => [s.id, s]));

  // Etapas fora de qualquer subitem = passos internos.
  const assigned = new Set(product.subitems.flatMap((s) => s.stageKeys));
  const internal = options.filter((o) => !assigned.has(o.key));

  function markupShown(subitem: Subitem): boolean {
    return subitem.markup !== undefined || markupOpen.has(subitem.id);
  }

  function openMarkup(subitemId: string) {
    setMarkupOpen((current) => new Set(current).add(subitemId));
  }

  return (
    <div className="field-block">
      <div className="fc-title subitems-head">
        <span>🧩 Vender por subitens</span>
        <button
          className="toggle-wrap"
          type="button"
          onClick={() => onToggle(!on)}
        >
          <span>
            <span className="toggle-label">{on ? "Ligado" : "Desligado"}</span>
            <span className="toggle-desc">
              {on
                ? "O produto pode ser cotado/vendido por partes (grupos de etapas)."
                : "Só vende o produto inteiro (comportamento padrão)."}
            </span>
          </span>
          <span className={`toggle-track ${on ? "on" : ""}`}>
            <span className="toggle-thumb" />
          </span>
        </button>
      </div>

      {on ? (
        <div className="subitems-body">
          <div className="section-note">
            Agrupe as etapas em subitens vendáveis à parte. Etapas fora de qualquer
            subitem são passos internos: entram no custo, mas não vendem sozinhas.
          </div>

          {product.subitems.map((subitem, index) => {
            const priced = priceById.get(subitem.id);
            return (
              <div className="stage-card subitem-card" key={subitem.id}>
                <div className="stage-card-head">
                  <span className="stage-card-title">Subitem {index + 1}</span>
                  <div className="subitem-head-side">
                    {priced ? (
                      <span className="subitem-price mono sg">
                        {formatCurrency(priced.price)}
                      </span>
                    ) : null}
                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={() => onRemoveSubitem(subitem.id)}
                      title="Remover subitem"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="field-block compact">
                  <label className="section-label">Nome do subitem</label>
                  <input
                    className="field-input"
                    type="text"
                    value={subitem.name}
                    onChange={(event) =>
                      onUpdateSubitem(subitem.id, { name: event.target.value })
                    }
                    placeholder="Ex: Peça base"
                  />
                </div>

                <div className="field-block compact">
                  <label className="section-label">Etapas deste subitem</label>
                  <div className="subitem-stages">
                    {options.map((option) => {
                      const checked = subitem.stageKeys.includes(option.key);
                      return (
                        <label className="subitem-stage-check" key={option.key}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              onToggleStage(
                                subitem.id,
                                option.key,
                                event.target.checked,
                              )
                            }
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {markupShown(subitem) ? (
                  <div className="field-block compact subitem-markup">
                    <label className="section-label markup-header">
                      <span>📈 Markup deste subitem</span>
                      <span className="markup-value">
                        {(subitem.markup ?? product.markup).toFixed(1)}x
                      </span>
                    </label>
                    <input
                      max={6}
                      min={1.5}
                      step={0.1}
                      type="range"
                      value={subitem.markup ?? product.markup}
                      onChange={(event) =>
                        onUpdateSubitem(subitem.id, {
                          markup: Number(event.target.value),
                        })
                      }
                    />
                    <button
                      className="link-button subitem-markup-reset"
                      type="button"
                      onClick={() => {
                        onUpdateSubitem(subitem.id, { markup: undefined });
                        setMarkupOpen((current) => {
                          const next = new Set(current);
                          next.delete(subitem.id);
                          return next;
                        });
                      }}
                    >
                      Usar o markup do produto ({product.markup.toFixed(1)}x)
                    </button>
                  </div>
                ) : (
                  <button
                    className="link-button subitem-markup-open"
                    type="button"
                    onClick={() => openMarkup(subitem.id)}
                  >
                    Personalizar markup
                  </button>
                )}
              </div>
            );
          })}

          <button
            className="link-button bordered"
            type="button"
            onClick={onAddSubitem}
          >
            <Plus size={15} />
            Adicionar subitem
          </button>

          {internal.length > 0 ? (
            <div className="section-note subitem-internal">
              Passos internos (não vendem sozinhos):{" "}
              {internal.map((o) => o.label).join(", ")}.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
