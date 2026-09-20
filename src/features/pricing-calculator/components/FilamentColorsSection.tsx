"use client";

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { round2 } from "@/lib/number";
import { normalizeText } from "@/lib/text";
import { formatCurrency } from "@/lib/formatting/currency";
import type { FilamentUsage, StockFilament } from "../types";
import { filamentTotalG, makeFilament } from "../lib/filaments";
import {
  brandCandidates,
  catalogPricePerKg,
  filamentLabel,
  materialOptions,
  maxCandidatePrice,
} from "../lib/stock";
import { NumberInput } from "./NumberInput";

// Lista de filamentos por cor (FEAT-02). Mono = 1 linha (sem toggle). Cada cor
// tem preço/kg e um Total (g); o "detalhar refugo" abre Model/Purga/Torre e, aí,
// o Total passa a ser a soma (travado). É usada na etapa principal (ProductForm)
// e nas etapas extras (ExtraStagesSection).
//
// Item 1 (2026-09-20) — COR virou sugestão, MARCA só se decide na `/producao`.
// "Material" é campo PRÓPRIO e obrigatório (dropdown dos já cadastrados no
// Estoque + digitar novo, D8); "Cor" é texto livre, sempre editável; "Marca
// sugerida" é OPCIONAL — um ponteiro para uma `StockFilament` específica, só
// para o preço do catálogo ter de onde partir e a `/producao` ter uma sugestão
// pronta. Sem marca fixada, o preço vivo usa a MAIOR `pricePerKg` entre as
// marcas ativas de mesma cor+material (`resolveFilamentPrices`).
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
  const fieldId = useId();
  const materialListId = `${fieldId}-materials`;
  const multi = filaments.length > 1;

  const stockById = new Map(stock.map((color) => [color.id, color]));
  const activeColors = stock.filter((color) => !color.archived);
  const materials = materialOptions(stock);

  // Atualiza uma cor mantendo o Total coerente: `makeFilament` recalcula
  // `totalG` = model+purga+torre quando há detalhamento; senão usa o Total dado.
  //
  // Cor/material mudaram por baixo de uma marca fixada? A marca deixa de
  // corresponder e a sugestão é descartada — ela não pode ficar apontando para
  // uma cor/material que o dono não digita mais (a marca é SÓ sugestão, nunca
  // trava o texto livre).
  // ⚠ A checagem compara com a PRÓPRIA cor vinculada (`stock.find`), nunca com
  // `brandCandidates` (que exclui arquivada de propósito): comparar com as
  // candidatas desligava toda marca arquivada no primeiro toque no campo, arquivada
  // nunca aparece lá mesmo quando cor/material continuam idênticos.
  function updateAt(index: number, patch: Partial<FilamentUsage>) {
    onChange(
      filaments.map((f, i) => {
        if (i !== index) return f;
        const merged = { ...makeFilament({ ...f, ...patch }), id: f.id };
        if (
          merged.filamentId &&
          (patch.colorName !== undefined || patch.material !== undefined)
        ) {
          const linked = stock.find((c) => c.id === merged.filamentId);
          const stillMatches =
            linked !== undefined &&
            normalizeText(linked.colorName ?? "") === normalizeText(merged.colorName) &&
            normalizeText(linked.material ?? "") === normalizeText(merged.material);
          if (!stillMatches) merged.filamentId = null;
        }
        return merged;
      }),
    );
  }

  // Escolha da marca sugerida. "" = nenhuma (decide na produção); uma cor do
  // Estoque semeia material/cor/preço — conveniência para quem prefere partir
  // do Estoque em vez de digitar do zero.
  function selectBrand(index: number, value: string) {
    if (!value) {
      updateAt(index, { filamentId: null });
      return;
    }
    const color = stockById.get(value);
    if (!color) return;
    updateAt(index, {
      filamentId: color.id,
      colorName: color.colorName,
      material: color.material,
      pricePerKg: catalogPricePerKg(color),
    });
  }

  function addColor() {
    addSeq += 1;
    const last = filaments[filaments.length - 1];
    onChange([
      ...filaments,
      {
        ...makeFilament({
          pricePerKg: last?.pricePerKg ?? 110,
          material: last?.material ?? "",
          totalG: 0,
        }),
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
              material: item.material,
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
        {/* UX-16: título da seção — não é rótulo de campo nenhum, então NÃO é
            <label> (um <label> sem controle só engana o leitor de tela).
            UX-29: e por ser título de seção, é `<h2>`. */}
        <h2 className="section-label">{label}</h2>
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
      <datalist id={materialListId}>
        {materials.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <div className="filament-list">
        {filaments.map((f, index) => {
          const detailed = isDetailed(f);
          const linkedColor = f.filamentId
            ? stockById.get(f.filamentId)
            : undefined;
          const isLinked = Boolean(f.filamentId);
          const missing = isLinked && !linkedColor; // marca removida do estoque
          const candidates = brandCandidates(stock, f.colorName, f.material);
          const otherColors = activeColors.filter(
            (color) => !candidates.some((c) => c.id === color.id),
          );
          // ⚠ A ramificação é por `f.filamentId` (a INTENÇÃO), não por
          // `linkedColor` (o resultado da busca) — marca FIXADA que sumiu do
          // Estoque é `missing`, e o preço fica no salvo, nunca nas candidatas
          // por coincidência de cor+material (mesmo fallback de
          // `resolveFilamentPrices`/`resolveFilRow`). Só a marca NUNCA fixada
          // (`filamentId` nulo) tenta as candidatas.
          const livePrice = f.filamentId
            ? linkedColor
              ? catalogPricePerKg(linkedColor)
              : 0
            : maxCandidatePrice(candidates);
          // Só-leitura quando há preço vivo (marca fixada com rolo, ou
          // correspondência de cor+material no Estoque). Sem nenhum dos dois, o
          // preço salvo continua editável (fallback D3) — inclusive quando a
          // marca fixada sumiu (o badge acima já avisa).
          const showLivePrice = livePrice > 0;
          const rowId = `${fieldId}-${index}`;
          return (
            <div className="filament-row" key={f.id ?? index}>
              <div className="filament-main">
                <div className="filament-cell">
                  <label className="section-label" htmlFor={`${rowId}-material`}>
                    Material
                  </label>
                  <input
                    id={`${rowId}-material`}
                    className="field-input"
                    type="text"
                    list={materialListId}
                    value={f.material}
                    onChange={(event) =>
                      updateAt(index, { material: event.target.value })
                    }
                    placeholder="PLA, PETG..."
                  />
                </div>
                <div className="filament-cell grow">
                  <label className="section-label" htmlFor={`${rowId}-color`}>
                    Cor
                  </label>
                  <input
                    id={`${rowId}-color`}
                    className="field-input"
                    type="text"
                    value={f.colorName}
                    onChange={(event) =>
                      updateAt(index, { colorName: event.target.value })
                    }
                    placeholder="Preto, Vermelho... (sugestão)"
                  />
                  {missing ? (
                    <div className="filament-missing-badge">
                      ⚠ marca removida do estoque — usando o preço salvo
                    </div>
                  ) : null}
                </div>
                <div className="filament-cell grow">
                  <label className="section-label" htmlFor={`${rowId}-brand`}>
                    Marca sugerida
                  </label>
                  <select
                    id={`${rowId}-brand`}
                    className="field-input"
                    value={f.filamentId ?? ""}
                    onChange={(event) => selectBrand(index, event.target.value)}
                  >
                    <option value="">Nenhuma (decide na produção)</option>
                    {candidates.length > 0 ? (
                      <optgroup label="Cor/material batem">
                        {candidates
                          .slice()
                          .sort((a, b) =>
                            filamentLabel(a).localeCompare(filamentLabel(b), "pt-BR"),
                          )
                          .map((color) => (
                            <option key={color.id} value={color.id}>
                              {filamentLabel(color)}
                            </option>
                          ))}
                      </optgroup>
                    ) : null}
                    {otherColors.length > 0 ? (
                      <optgroup
                        label={
                          candidates.length > 0
                            ? "Outras cores do Estoque"
                            : "Estoque"
                        }
                      >
                        {otherColors
                          .slice()
                          .sort((a, b) =>
                            filamentLabel(a).localeCompare(filamentLabel(b), "pt-BR"),
                          )
                          .map((color) => (
                            <option key={color.id} value={color.id}>
                              {filamentLabel(color)}
                            </option>
                          ))}
                      </optgroup>
                    ) : null}
                    {linkedColor && linkedColor.archived ? (
                      <option value={linkedColor.id}>
                        {filamentLabel(linkedColor)} (arquivada)
                      </option>
                    ) : null}
                    {missing ? (
                      <option value={f.filamentId ?? ""}>
                        ⚠ marca removida do estoque
                      </option>
                    ) : null}
                  </select>
                </div>
                <div className="filament-cell">
                  {/* Com preço vivo o valor é um <div> só-leitura — aí o rótulo
                      não tem campo para apontar (htmlFor undefined = sem atributo). */}
                  <label
                    className="section-label"
                    htmlFor={showLivePrice ? undefined : `${rowId}-price`}
                  >
                    Filamento (R$/kg)
                  </label>
                  {showLivePrice ? (
                    <div
                      className="filament-total-value"
                      title={
                        linkedColor
                          ? "Preço do rolo mais novo (Estoque) — atualiza sozinho"
                          : "Maior preço entre as marcas ativas desta cor+material — atualiza sozinho"
                      }
                    >
                      {formatCurrency(livePrice)}
                    </div>
                  ) : (
                    <NumberInput
                      id={`${rowId}-price`}
                      className="field-input"
                      min={0}
                      value={f.pricePerKg}
                      onChange={(pricePerKg) => updateAt(index, { pricePerKg })}
                    />
                  )}
                </div>
                {detailed ? (
                  <div className="filament-cell">
                    {/* Detalhado, o Total é só-leitura (soma travada) — sem campo
                        para apontar, não é <label>. */}
                    <div className="section-label">Total (g)</div>
                    <div
                      className="filament-total-value"
                      title="Model + Suporte + Purga + Torre"
                    >
                      {round2(filamentTotalG(f))} g
                    </div>
                  </div>
                ) : (
                  <div className="filament-cell">
                    <label className="section-label" htmlFor={`${rowId}-total`}>
                      Total (g)
                    </label>
                    <NumberInput
                      id={`${rowId}-total`}
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
                    aria-label={`Remover a cor ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>

              {detailed ? (
                <>
                  <div className="filament-detail">
                    <div className="filament-cell">
                      <label className="section-label" htmlFor={`${rowId}-model`}>
                        Model (g)
                      </label>
                      <NumberInput
                        id={`${rowId}-model`}
                        className="field-input"
                        min={0}
                        value={f.modelG ?? 0}
                        onChange={(modelG) => updateAt(index, { modelG })}
                      />
                    </div>
                    <div className="filament-cell">
                      <label
                        className="section-label"
                        htmlFor={`${rowId}-support`}
                      >
                        Suporte (g)
                      </label>
                      <NumberInput
                        id={`${rowId}-support`}
                        className="field-input"
                        min={0}
                        value={f.supportG ?? 0}
                        onChange={(supportG) => updateAt(index, { supportG })}
                      />
                    </div>
                    <div className="filament-cell">
                      <label className="section-label" htmlFor={`${rowId}-purge`}>
                        Purga (g)
                      </label>
                      <NumberInput
                        id={`${rowId}-purge`}
                        className="field-input"
                        min={0}
                        value={f.purgedG ?? 0}
                        onChange={(purgedG) => updateAt(index, { purgedG })}
                      />
                    </div>
                    <div className="filament-cell">
                      <label className="section-label" htmlFor={`${rowId}-tower`}>
                        Torre (g)
                      </label>
                      <NumberInput
                        id={`${rowId}-tower`}
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
