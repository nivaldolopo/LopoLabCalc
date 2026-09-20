"use client";

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { round2 } from "@/lib/number";
import { formatCurrency } from "@/lib/formatting/currency";
import type { FilamentUsage, StockFilament } from "../types";
import { filamentTotalG, makeFilament } from "../lib/filaments";
import {
  brandCandidates,
  brandOptionsFor,
  catalogPricePerKg,
  colorOptionsForMaterial,
  materialOptions,
  maxCandidatePrice,
  relinkFilament,
} from "../lib/stock";
import { NumberInput } from "./NumberInput";

// Lista de filamentos por cor (FEAT-02). Mono = 1 linha (sem toggle). Cada cor
// tem preço/kg e um Total (g); o "detalhar refugo" abre Model/Purga/Torre e, aí,
// o Total passa a ser a soma (travado). É usada na etapa principal (ProductForm)
// e nas etapas extras (ExtraStagesSection).
//
// Item 1 (2026-09-20) + refinamento no mesmo dia — COR virou sugestão, MARCA só
// se decide na `/producao`, mas os TRÊS campos são texto livre em CASCATA:
// Material filtra as sugestões de Cor, que filtram as de Marca (dropdown via
// `<datalist>`, nunca trava a digitação — cor/marca podem ser algo que ainda
// não está no Estoque). `filamentId` é DERIVADO: bateu com EXATAMENTE uma
// `StockFilament` de mesma material+cor+marca → liga (preço vivo); sem bater
// com nenhuma (ou mais de uma) → a marca digitada fica só RÓTULO, sem link.
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
  const materials = materialOptions(stock);

  // Atualiza uma cor mantendo o Total coerente (`makeFilament`) e o
  // `filamentId` em dia com o que Material/Cor/Marca dizem AGORA.
  // `relinkFilament` (lib/stock.ts) é o ponto ÚNICO da decisão "ainda bate?" —
  // compartilhado com a `/producao`, pra não divergir a mesma regra em dois
  // lugares (foi assim que o bug do code review nasceu da primeira vez).
  function updateAt(
    index: number,
    patch: Partial<Pick<FilamentUsage, "colorName" | "material" | "brand">>,
  ) {
    onChange(
      filaments.map((f, i) => {
        if (i !== index) return f;
        const merged = { ...makeFilament({ ...f, ...patch }), id: f.id };
        if (
          patch.colorName !== undefined ||
          patch.material !== undefined ||
          patch.brand !== undefined
        ) {
          merged.filamentId = relinkFilament(
            stock,
            merged.filamentId,
            merged.material,
            merged.colorName,
            merged.brand ?? "",
          );
          // O preço segue a MESMA regra do cálculo (`resolveFilamentPrices`,
          // que só olha `filamentId` — a marca digitada é só rótulo pra ele):
          // ligou → preço vivo da marca; não ligou (com ou sem marca
          // digitada) → a MAIOR entre as candidatas de cor+material.
          const linked = merged.filamentId
            ? stock.find((c) => c.id === merged.filamentId)
            : undefined;
          if (linked) {
            const live = catalogPricePerKg(linked);
            if (live > 0) merged.pricePerKg = live;
          } else {
            const max = maxCandidatePrice(
              brandCandidates(stock, merged.colorName, merged.material),
            );
            if (max > 0) merged.pricePerKg = max;
          }
        }
        return merged;
      }),
    );
  }

  // Total (g) e preço digitado à mão passam batido pela recomputação do link
  // (não mudam material/cor/marca) — ficam num updater à parte, mais simples.
  function updateField(index: number, patch: Partial<FilamentUsage>) {
    onChange(
      filaments.map((f, i) =>
        i === index ? { ...makeFilament({ ...f, ...patch }), id: f.id } : f,
      ),
    );
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
    updateField(index, {
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
              ...(item.brand ? { brand: item.brand } : {}),
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
          const missing = Boolean(f.filamentId) && !linkedColor; // marca removida do estoque
          // Code review — o antigo <select> tinha uma opção "(arquivada)"
          // própria; virando texto livre, essa informação não tinha mais
          // onde aparecer (arquivada não é removida — `linkedColor` continua
          // achando ela, `missing` fica false, e nada mais avisava).
          const archived = Boolean(linkedColor?.archived);
          // Cascata: cor sugere pelo material já digitado; marca sugere pelos
          // dois. Datalist vazio (nada bate) degrada sozinho a campo de texto
          // simples — é o que deixa o avulso "mais simples" sem um caminho
          // separado pra ele.
          const colorListId = `${fieldId}-${index}-colors`;
          const brandListId = `${fieldId}-${index}-brands`;
          const colorOptions = colorOptionsForMaterial(stock, f.material);
          const brandOptions = brandOptionsFor(stock, f.material, f.colorName);
          const candidates = brandCandidates(stock, f.colorName, f.material);
          const livePrice = f.filamentId
            ? linkedColor
              ? catalogPricePerKg(linkedColor)
              : 0
            : maxCandidatePrice(candidates);
          // Só-leitura quando há preço vivo (marca ligada com rolo, ou
          // correspondência de cor+material no Estoque sem marca fixada). Sem
          // nenhum dos dois — inclusive marca digitada que não bate com nada —
          // o preço salvo continua editável (fallback D3).
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
                    list={colorListId}
                    value={f.colorName}
                    onChange={(event) =>
                      updateAt(index, { colorName: event.target.value })
                    }
                    placeholder="Preto, Vermelho... (sugestão)"
                  />
                  <datalist id={colorListId}>
                    {colorOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                  {missing ? (
                    <div className="filament-missing-badge">
                      ⚠ marca removida do estoque — usando o preço salvo
                    </div>
                  ) : null}
                </div>
                <div className="filament-cell grow">
                  <label className="section-label" htmlFor={`${rowId}-brand`}>
                    Marca
                  </label>
                  <input
                    id={`${rowId}-brand`}
                    className="field-input"
                    type="text"
                    list={brandListId}
                    value={f.brand ?? ""}
                    onChange={(event) =>
                      updateAt(index, { brand: event.target.value })
                    }
                    placeholder="Bambu, Voolt... (opcional)"
                  />
                  <datalist id={brandListId}>
                    {brandOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                  {archived ? (
                    <div className="filament-missing-badge">
                      ⚠ marca arquivada — ainda em uso, mas some das sugestões
                    </div>
                  ) : null}
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
                      onChange={(pricePerKg) => updateField(index, { pricePerKg })}
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
                      onChange={(totalG) => updateField(index, { totalG })}
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
                        onChange={(modelG) => updateField(index, { modelG })}
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
                        onChange={(supportG) => updateField(index, { supportG })}
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
                        onChange={(purgedG) => updateField(index, { purgedG })}
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
                        onChange={(towerG) => updateField(index, { towerG })}
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
