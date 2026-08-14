import { num } from "@/lib/number";
import { normalizeText } from "@/lib/text";
import type { FilamentUsage, StockFilament } from "../types";

// Helpers de filamento por cor (FEAT-02). O modelo unifica mono e multicolor:
// toda etapa/produto tem um array `filaments` (mono = array de 1). `totalG` é o
// campo canônico (já inclui torre + purga); Model/Purga/Torre são detalhe
// opcional que, quando presente, soma para o `totalG`.

// Fonte com cores (produto ou etapa). Aceita o array novo OU os escalares
// legados (`weightG`/`filamentPricePerKg`) para migração só-leitura.
type FilamentSource = {
  filaments?: FilamentUsage[] | null;
  weightG?: number | null;
  filamentPricePerKg?: number | null;
};

// true quando ao menos um campo de detalhe (model/suporte/purga/torre) foi
// informado.
function hasBreakdown(data: Partial<FilamentUsage>): boolean {
  return (
    data.modelG !== undefined ||
    data.supportG !== undefined ||
    data.purgedG !== undefined ||
    data.towerG !== undefined
  );
}

// Peso total (g) de UMA cor: o `totalG` canônico. Fallback para a soma do
// detalhe quando o total não veio (ex.: dado que só trouxe model/suporte/
// purga/torre).
export function filamentTotalG(f: FilamentUsage): number {
  const total = num(f.totalG);
  if (total > 0) return total;
  return num(f.modelG) + num(f.supportG) + num(f.purgedG) + num(f.towerG);
}

// Normaliza UMA cor: garante os campos e mantém `totalG` coerente — quando há
// detalhamento, `totalG` passa a ser a soma model+suporte+purga+torre (o form
// trava assim); sem detalhamento, usa o `totalG` informado.
export function makeFilament(data: Partial<FilamentUsage> = {}): FilamentUsage {
  const detailed = hasBreakdown(data);
  const detailSum =
    num(data.modelG) +
    num(data.supportG) +
    num(data.purgedG) +
    num(data.towerG);
  return {
    ...(data.id ? { id: data.id } : {}),
    filamentId: data.filamentId ?? null,
    colorName: data.colorName ?? "",
    pricePerKg: num(data.pricePerKg),
    totalG: detailed ? detailSum : num(data.totalG),
    modelG: data.modelG,
    supportG: data.supportG,
    purgedG: data.purgedG,
    towerG: data.towerG,
  };
}

// Fonte (produto/etapa) → sempre um array com ≥1 cor. Migra dado legado: o
// `weightG` antigo já é o TOTAL consumido (com torre/purga), então vai direto no
// `totalG`, sem detalhamento fingido.
export function normalizeFilaments(source: FilamentSource): FilamentUsage[] {
  if (source.filaments && source.filaments.length > 0) {
    return source.filaments.map((f) => makeFilament(f));
  }
  return [
    makeFilament({
      totalG: num(source.weightG),
      pricePerKg: num(source.filamentPricePerKg),
    }),
  ];
}

// Peso total (g) de uma lista de cores.
export function filamentsTotalG(filaments: FilamentUsage[]): number {
  return filaments.reduce((sum, f) => sum + filamentTotalG(f), 0);
}

// Custo de material (R$) de uma lista de cores: Σ (peso_total/1000 × preço/kg).
export function filamentsMaterialCost(filaments: FilamentUsage[]): number {
  return filaments.reduce(
    (sum, f) => sum + (filamentTotalG(f) / 1000) * num(f.pricePerKg),
    0,
  );
}

// Junta cores iguais (mesmo spool/cor/preço) somando os pesos. Usado para
// agregar etapa principal + extras num único consumo por cor no resultado e no
// snapshot da venda. `totalG` é somado de forma autoritativa; o detalhe só é
// somado quando presente, para não inventar refugo onde não havia.
export function mergeFilaments(filaments: FilamentUsage[]): FilamentUsage[] {
  const map = new Map<string, FilamentUsage>();
  for (const f of filaments) {
    const key = `${f.filamentId ?? ""}|${(f.colorName ?? "")
      .trim()
      .toLowerCase()}|${num(f.pricePerKg)}`;
    const total = filamentTotalG(f);
    const prev = map.get(key);
    if (prev) {
      prev.totalG += total;
      if (f.modelG !== undefined) prev.modelG = num(prev.modelG) + num(f.modelG);
      if (f.supportG !== undefined)
        prev.supportG = num(prev.supportG) + num(f.supportG);
      if (f.purgedG !== undefined)
        prev.purgedG = num(prev.purgedG) + num(f.purgedG);
      if (f.towerG !== undefined) prev.towerG = num(prev.towerG) + num(f.towerG);
    } else {
      map.set(key, {
        filamentId: f.filamentId ?? null,
        colorName: f.colorName ?? "",
        pricePerKg: num(f.pricePerKg),
        totalG: total,
        modelG: f.modelG,
        supportG: f.supportG,
        purgedG: f.purgedG,
        towerG: f.towerG,
      });
    }
  }
  return Array.from(map.values());
}

// Prepara as cores para persistir no Firestore: normaliza, descarta o `id` de
// estado do formulário (mesma disciplina de stages/accessories) e OMITE os
// campos de detalhe ausentes — o Firestore rejeita valores `undefined`.
export function stripFilamentIds(
  filaments: FilamentUsage[] | undefined,
): FilamentUsage[] {
  return (filaments ?? []).map((raw) => {
    const f = makeFilament({ ...raw, id: undefined });
    const clean: FilamentUsage = {
      filamentId: f.filamentId,
      colorName: f.colorName,
      pricePerKg: f.pricePerKg,
      totalG: f.totalG,
    };
    if (f.modelG !== undefined) clean.modelG = num(f.modelG);
    if (f.supportG !== undefined) clean.supportG = num(f.supportG);
    if (f.purgedG !== undefined) clean.purgedG = num(f.purgedG);
    if (f.towerG !== undefined) clean.towerG = num(f.towerG);
    return clean;
  });
}

// D7: congela as cores da VENDA resolvendo material/marca/nome da COR viva do
// Estoque (pelo `filamentId`) — o produto guarda só o id; material vive na cor. É
// o que deixa o histórico agrupar por material sem consultar a cor (que pode ser
// arquivada depois). Avulso (sem `filamentId`) fica sem material, como esperado.
export function freezeFilaments(
  filaments: FilamentUsage[] | undefined,
  stock: Pick<StockFilament, "id" | "material" | "brand" | "colorName">[],
): FilamentUsage[] {
  const byId = new Map(stock.map((color) => [color.id, color]));
  return stripFilamentIds(filaments).map((f) => {
    const color = f.filamentId ? byId.get(f.filamentId) : undefined;
    return {
      ...f,
      ...(color?.colorName ? { colorName: color.colorName } : {}),
      ...(color?.material ? { material: color.material } : {}),
      ...(color?.brand ? { brand: color.brand } : {}),
    };
  });
}

// D7/D8: rótulo de material DERIVADO das cores congeladas — os materiais distintos
// (case-insensitive, preservando a 1ª grafia), juntados por " · ". Multicolor em
// PLA+PETG vira "PLA · PETG". Substitui o antigo campo "Material" de texto livre da
// venda; vazio quando nenhuma cor tem material (avulso).
export function materialsLabel(filaments: FilamentUsage[]): string {
  const seen: string[] = [];
  for (const f of filaments) {
    const material = (f.material ?? "").trim();
    if (material && !seen.some((s) => s.toLowerCase() === material.toLowerCase())) {
      seen.push(material);
    }
  }
  return seen.join(" · ");
}

// ---------------------------------------------------------------------------
// FEAT-11 — a IDENTIDADE DE COR de uma peça impressa.
//
// A cor virou dimensão da SKU do acabado (decisão do dono): o mesmo produto
// impresso em azul e em vermelho são dois saldos, não um. Este é o único lugar
// que decide "que cor é esta peça" — `finishedGoods` só carrega a chave pronta.
//
// A chave é COMPOSTA (decisão do dono): uma peça que troca de filamento no meio
// da impressão é uma variante própria ("Azul + Branco" ≠ "Azul"), não a cor
// dominante. Peça multicolor é um produto diferente na prateleira.
//
// ⚠ Isto é a cor de UMA peça, não de uma submissão inteira: um produto com
// partes (corpo azul + tampa vermelha) resolve a chave POR SUBITEM, a partir das
// cores das etapas daquela parte. Quem faz esse recorte é o chamador.

// Sentinela do que não tem cor identificável: avulso sem nome, submissão sem
// filamento e — Diretriz 7, sem migração — toda camada gravada antes do FEAT-11.
export const NO_COLOR_KEY = "__nocolor__";
export const NO_COLOR_LABEL = "Sem cor";

export type ColorKey = {
  key: string; // estável, comparável, persistido na SKU
  label: string; // exibição ("Azul + Branco")
};

export const NO_COLOR: ColorKey = { key: NO_COLOR_KEY, label: NO_COLOR_LABEL };

// Identidade de UMA cor. Ligada ao Estoque = o `filamentId` (o nome pode ser
// editado depois sem partir o saldo); avulsa = o nome normalizado, com o prefixo
// `livre:` para nunca colidir com um id do Firestore. Sem gramas não conta: uma
// linha zerada não pinta a peça. O slug tira `+` e espaços, que são os
// separadores da chave composta.
function colorIdentity(f: FilamentUsage): ColorKey | null {
  if (filamentTotalG(f) <= 0) return null;
  const name = (f.colorName ?? "").trim();
  if (f.filamentId) return { key: f.filamentId, label: name || "Cor do estoque" };
  if (!name) return null;
  return { key: `livre:${normalizeText(name).replace(/[^a-z0-9]+/g, "-")}`, label: name };
}

/**
 * Cores de uma peça → a chave/rótulo da variante. PURA.
 *
 * Ordem canônica (rótulo normalizado, desempate pela chave): "azul depois
 * branco" e "branco depois azul" são a MESMA prateleira, então a ordem em que as
 * etapas foram cadastradas não pode gerar duas SKUs. Cores repetidas colapsam
 * (duas etapas no mesmo azul = "Azul", não "Azul + Azul").
 */
export function colorKeyOf(filaments: FilamentUsage[]): ColorKey {
  const byKey = new Map<string, ColorKey>();
  for (const f of filaments) {
    const identity = colorIdentity(f);
    if (identity && !byKey.has(identity.key)) byKey.set(identity.key, identity);
  }
  const ordered = Array.from(byKey.values()).sort(
    (a, b) =>
      normalizeText(a.label).localeCompare(normalizeText(b.label)) ||
      a.key.localeCompare(b.key),
  );
  if (ordered.length === 0) return NO_COLOR;
  return {
    key: ordered.map((c) => c.key).join("+"),
    label: ordered.map((c) => c.label).join(" + "),
  };
}
