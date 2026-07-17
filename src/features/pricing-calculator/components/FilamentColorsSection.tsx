"use client";

import { Plus, Trash2 } from "lucide-react";
import { round2 } from "@/lib/number";
import { formatCurrency } from "@/lib/formatting/currency";
import type { FilamentUsage, StockFilament } from "../types";
import { filamentTotalG, makeFilament } from "../lib/filaments";
import { catalogPricePerKg, filamentLabel } from "../lib/stock";
import { NumberInput } from "./NumberInput";

// Lista de filamentos por cor (FEAT-02). Mono = 1 linha (sem toggle). Cada cor
// tem preço/kg e um Total (g); o "detalhar refugo" abre Model/Purga/Torre e, aí,
// o Total passa a ser a soma (travado). É usada na etapa principal (ProductForm)
// e nas etapas extras (ExtraStagesSection).
//
// 7c: a "Cor" virou um dropdown das cores do Estoque (mono e multi). Ligada a uma
// cor, o preço/kg vem VIVO do rolo mais novo (D3) e fica só-leitura; a opção
// "Avulso" volta ao texto livre + preço manual (fallback D3).
type FilamentColorsSectionProps = {
  filaments: FilamentUsage[];
  onChange: (filaments: FilamentUsage[]) => void;
  stock: StockFilament[];
  label?: string;
};

let addSeq = 0;

function isDetailed(f: FilamentUsage): boolean {
  return (
    f.modelG !== undefined ||
    f.supportG !== undefined ||
    f.purgedG !== undefined ||
    f.towerG !== undefined
  );
}

export function FilamentColorsSection({
  filaments,
  onChange,
  stock,
  label = "🎨 Filamento por cor",
}: FilamentColorsSectionProps) {
  const multi = filaments.length > 1;

  // Cores oferecidas no dropdown: as ativas (arquivada some da escolha, mas um
  // produto que já aponta para uma arquivada segue mostrando-a — ver `selectFor`).
  const stockById = new Map(stock.map((color) => [color.id, color]));
  const activeColors = stock
    .filter((color) => !color.archived)
    .sort((a, b) => filamentLabel(a).localeCompare(filamentLabel(b), "pt-BR"));

  // Atualiza uma cor mantendo o Total coerente: `makeFilament` recalcula
  // `totalG` = model+purga+torre quando há detalhamento; senão usa o Total dado.
  function updateAt(index: number, patch: Partial<FilamentUsage>) {
    onChange(
      filaments.map((f, i) =>
        i === index ? { ...makeFilament({ ...f, ...patch }), id: f.id } : f,
      ),
    );
  }

  // Escolha no dropdown. "" = avulso (mantém nome/preço para o usuário editar);
  // uma cor liga o `filamentId` e semeia nome (rótulo) + preço (rolo mais novo)
  // como fallback — o cálculo usa o preço vivo, isto é só a foto salva.
  function selectColor(index: number, value: string) {
    if (!value) {
      updateAt(index, { filamentId: null });
      return;
    }
    const color = stockById.get(value);
    if (!color) return;
    updateAt(index, {
      filamentId: color.id,
      colorName: filamentLabel(color),
      pricePerKg: catalogPricePerKg(color),
    });
  }

  function addColor() {
    addSeq += 1;
    const last = filaments[filaments.length - 1];
    onChange([
      ...filaments,
      {
        ...makeFilament({ pricePerKg: last?.pricePerKg ?? 110, totalG: 0 }),
        id: `fil_new_${Date.now()}_${addSeq}`,
      },
    ]);
  }

  function removeAt(index: number) {
    if (filaments.length <= 1) return;
    onChange(filaments.filter((_, i) => i !== index));
  }

  // Abre o detalhamento: semeia Model com o total atual (Suporte/Purga/Torre em
  // 0), sem mudar o Total.
  function openDetail(index: number) {
    const f = filaments[index];
    updateAt(index, {
      modelG: filamentTotalG(f),
      supportG: 0,
      purgedG: 0,
      towerG: 0,
    });
  }

  // Fecha o detalhamento: volta a só-Total (limpa Model/Suporte/Purga/Torre),
  // mantendo o peso total já somado.
  function closeDetail(index: number) {
    const total = filamentTotalG(filaments[index]);
    onChange(
      filaments.map((item, i) =>
        i === index
          ? {
              id: item.id,
              filamentId: item.filamentId,
              colorName: item.colorName,
              pricePerKg: item.pricePerKg,
              totalG: total,
            }
          : item,
      ),
    );
  }

  return (
    <div className="field-block">
      <div className="section-head">
        <label className="section-label">{label}</label>
        <button
          className="link-button bordered"
          type="button"
          onClick={addColor}
        >
          <Plus size={15} /> Adicionar cor
        </button>
      </div>
      {multi ? (
        <div className="section-note">
          Multicolor: informe o peso de cada filamento. O Total já inclui o
          suporte e a purga/torre da troca de cor — use &ldquo;detalhar
          refugo&rdquo; para separar.
        </div>
      ) : null}
      <div className="filament-list">
        {filaments.map((f, index) => {
          const detailed = isDetailed(f);
          const linkedColor = f.filamentId
            ? stockById.get(f.filamentId)
            : undefined;
          const isLinked = Boolean(f.filamentId);
          const missing = isLinked && !linkedColor; // cor removida do estoque
          const livePrice = linkedColor ? catalogPricePerKg(linkedColor) : 0;
          // Só-leitura quando há preço vivo (cor com rolo). Cor sem rolo ou
          // removida cai no preço salvo, que permanece editável (fallback D3).
          const showLivePrice = Boolean(linkedColor) && livePrice > 0;
          return (
            <div className="filament-row" key={f.id ?? index}>
              <div className="filament-main">
                <div className="filament-cell grow">
                  <label className="section-label">Cor</label>
                  <select
                    className="field-input"
                    value={f.filamentId ?? ""}
                    onChange={(event) => selectColor(index, event.target.value)}
                  >
                    <option value="">Avulso (fora do estoque)</option>
                    {activeColors.map((color) => (
                      <option key={color.id} value={color.id}>
                        {filamentLabel(color)}
                      </option>
                    ))}
                    {linkedColor && linkedColor.archived ? (
                      <option value={linkedColor.id}>
                        {filamentLabel(linkedColor)} (arquivada)
                      </option>
                    ) : null}
                    {missing ? (
                      <option value={f.filamentId ?? ""}>
                        ⚠ cor removida do estoque
                      </option>
                    ) : null}
                  </select>
                  {!isLinked ? (
                    <input
                      className="field-input filament-freename"
                      type="text"
                      value={f.colorName}
                      onChange={(event) =>
                        updateAt(index, { colorName: event.target.value })
                      }
                      placeholder="Nome da cor (opcional)"
                    />
                  ) : null}
                  {missing ? (
                    <div className="filament-missing-badge">
                      ⚠ cor removida — usando o preço salvo
                    </div>
                  ) : null}
                </div>
                <div className="filament-cell">
                  <label className="section-label">Filamento (R$/kg)</label>
                  {showLivePrice ? (
                    <div
                      className="filament-total-value"
                      title="Preço do rolo mais novo (Estoque) — atualiza sozinho"
                    >
                      {formatCurrency(livePrice)}
                    </div>
                  ) : (
                    <NumberInput
                      className="field-input"
                      min={0}
                      value={f.pricePerKg}
                      onChange={(pricePerKg) => updateAt(index, { pricePerKg })}
                    />
                  )}
                </div>
                {detailed ? (
                  <div className="filament-cell">
                    <label className="section-label">Total (g)</label>
                    <div
                      className="filament-total-value"
                      title="Model + Suporte + Purga + Torre"
                    >
                      {round2(filamentTotalG(f))} g
                    </div>
                  </div>
                ) : (
                  <div className="filament-cell">
                    <label className="section-label">Total (g)</label>
                    <NumberInput
                      className="field-input"
                      min={0}
                      value={f.totalG}
                      onChange={(totalG) => updateAt(index, { totalG })}
                    />
                  </div>
                )}
                {multi ? (
                  <button
                    className="icon-button danger filament-remove"
                    type="button"
                    onClick={() => removeAt(index)}
                    title="Remover cor"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>

              {detailed ? (
                <>
                  <div className="filament-detail">
                    <div className="filament-cell">
                      <label className="section-label">Model (g)</label>
                      <NumberInput
                        className="field-input"
                        min={0}
                        value={f.modelG ?? 0}
                        onChange={(modelG) => updateAt(index, { modelG })}
                      />
                    </div>
                    <div className="filament-cell">
                      <label className="section-label">Suporte (g)</label>
                      <NumberInput
                        className="field-input"
                        min={0}
                        value={f.supportG ?? 0}
                        onChange={(supportG) => updateAt(index, { supportG })}
                      />
                    </div>
                    <div className="filament-cell">
                      <label className="section-label">Purga (g)</label>
                      <NumberInput
                        className="field-input"
                        min={0}
                        value={f.purgedG ?? 0}
                        onChange={(purgedG) => updateAt(index, { purgedG })}
                      />
                    </div>
                    <div className="filament-cell">
                      <label className="section-label">Torre (g)</label>
                      <NumberInput
                        className="field-input"
                        min={0}
                        value={f.towerG ?? 0}
                        onChange={(towerG) => updateAt(index, { towerG })}
                      />
                    </div>
                  </div>
                  <button
                    className="link-button filament-detail-toggle"
                    type="button"
                    onClick={() => closeDetail(index)}
                  >
                    usar só o total
                  </button>
                </>
              ) : (
                <button
                  className="link-button filament-detail-toggle"
                  type="button"
                  onClick={() => openDetail(index)}
                >
                  detalhar refugo (model + suporte + purga + torre)
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
