"use client";

import { X } from "lucide-react";
import { SearchBox } from "./SearchBox";

export type ProductOption = { id: string; name: string };

// TD-006 Fase 3: barra de filtro das listas que paginam (/vendas, /producao).
// Decidido com o dono ("os dois juntos"): produto + período consultam o BANCO
// (varre o histórico inteiro), e a caixa de nome refina no cliente o que está na
// janela carregada. O pai guarda todo o estado e decide o que é server vs client.
export function HistoryFilterBar({
  products,
  productId,
  onProductId,
  startStr,
  onStart,
  endStr,
  onEnd,
  name,
  onName,
  namePlaceholder = "Refinar por nome…",
  resultCount,
}: {
  products: ProductOption[];
  productId: string;
  onProductId: (value: string) => void;
  startStr: string;
  onStart: (value: string) => void;
  endStr: string;
  onEnd: (value: string) => void;
  name: string;
  onName: (value: string) => void;
  namePlaceholder?: string;
  resultCount?: number;
}) {
  const hasFilter =
    productId !== "" || startStr !== "" || endStr !== "" || name.trim() !== "";

  function clearAll() {
    onProductId("");
    onStart("");
    onEnd("");
    onName("");
  }

  return (
    <div className="history-filter">
      <div className="history-filter-row">
        <select
          className="field-input history-filter-product"
          value={productId}
          onChange={(event) => onProductId(event.target.value)}
          aria-label="Filtrar por produto"
        >
          <option value="">Todos os produtos</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>

        <label className="history-filter-date">
          <span>de</span>
          <input
            className="field-input"
            type="date"
            value={startStr}
            max={endStr || undefined}
            onChange={(event) => onStart(event.target.value)}
          />
        </label>
        <label className="history-filter-date">
          <span>até</span>
          <input
            className="field-input"
            type="date"
            value={endStr}
            min={startStr || undefined}
            onChange={(event) => onEnd(event.target.value)}
          />
        </label>

        {hasFilter ? (
          <button
            type="button"
            className="history-filter-clear"
            onClick={clearAll}
            title="Limpar filtros"
          >
            <X size={14} /> Limpar
          </button>
        ) : null}
      </div>

      <SearchBox
        value={name}
        onChange={onName}
        placeholder={namePlaceholder}
        resultCount={name.trim() ? resultCount : undefined}
      />
    </div>
  );
}
