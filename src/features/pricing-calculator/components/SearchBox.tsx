"use client";

import { Search, X } from "lucide-react";

// Campo de busca compartilhado das listas (UX-05). Controlado pelo pai — ele
// guarda o termo e filtra; aqui só o visual + o botão de limpar. Reusado pelo
// catálogo e pelas 3 abas do estoque para o mesmo desenho em todo lugar.
export function SearchBox({
  value,
  onChange,
  placeholder = "Buscar...",
  resultCount,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  // Nº de resultados do termo atual — vira um hint discreto ("3 encontrados").
  // Só aparece quando há busca ativa.
  resultCount?: number;
}) {
  const active = value.trim().length > 0;
  return (
    <div className="search-box">
      <Search size={15} className="search-box-icon" aria-hidden="true" />
      <input
        type="search"
        className="search-box-input"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
      />
      {active ? (
        <>
          {resultCount !== undefined ? (
            <span className="search-box-count">{resultCount}</span>
          ) : null}
          <button
            type="button"
            className="search-box-clear"
            onClick={() => onChange("")}
            title="Limpar busca"
            aria-label="Limpar busca"
          >
            <X size={14} />
          </button>
        </>
      ) : null}
    </div>
  );
}
