import type { StockFilament, Supply } from "../types";

/**
 * A tabela de-para "nome → id" das cores e dos insumos, em TSV.
 *
 * Por que existe: o `filamentId` e o `supplyId` que a planilha da carga em massa
 * precisa escrever são **auto-ids do Firestore** (`addDoc`) — string opaca de 20
 * caracteres que não aparece em lugar nenhum da UI. Sem uma saída, o único
 * caminho é abrir o console do Firebase e copiar documento por documento.
 *
 * TSV e não CSV de propósito: colado no Sheets/Excel ele já cai em colunas
 * separadas, que é o que se faz com esta tabela (um PROCV do lado da planilha).
 * Nada aqui é escrito em arquivo — é texto para a área de transferência.
 *
 * ⚠ `material` e `brand` vão junto porque `colorName` sozinho REPETE: "Laranja"
 * pode existir em PLA Bambu e em PETG Voolt, e é justamente aí que um de-para
 * cego amarra o produto na cor errada (o mesmo risco que o CSV-22 passou a
 * apontar do lado da importação).
 *
 * ⚠ As arquivadas entram, marcadas. Elas continuam tendo id e continuam podendo
 * ser referenciadas; omiti-las faria a cor "sumir" da tabela sem explicação.
 */

const TAB = "\t";

function tsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((cells) => cells.join(TAB)).join("\n");
}

// Célula sem TAB nem quebra de linha — os dois quebrariam a colagem em colunas.
// Nome de cor não costuma trazer nenhum dos dois, mas o campo é texto livre.
function cell(value: string | undefined): string {
  return String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();
}

export function colorIdTable(stock: StockFilament[]): string {
  return tsv(
    ["Cor", "Material", "Marca", "Arquivada", "id"],
    stock.map((color) => [
      cell(color.colorName),
      cell(color.material),
      cell(color.brand),
      color.archived ? "sim" : "nao",
      color.id,
    ]),
  );
}

export function supplyIdTable(supplies: Supply[]): string {
  return tsv(
    ["Insumo", "Unidade", "Arquivado", "id"],
    supplies.map((supply) => [
      cell(supply.name),
      cell(supply.unit),
      supply.archived ? "sim" : "nao",
      supply.id,
    ]),
  );
}
