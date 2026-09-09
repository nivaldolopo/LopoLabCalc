import type {
  FixedCostSettings,
  Machine,
  SavedProduct,
  StockFilament,
  Supply,
} from "../types";
import { calculatePricing } from "./calculatePricing";
import { marginTier, type MarginTier } from "./marginTier";
import { round2 } from "@/lib/number";

/**
 * [FEAT-12] — o IMPACTO de uma mudança global de preço, calculado antes de ela
 * acontecer (a prévia), depois de ela acontecer (o aviso) e guardado por
 * escrito (o registro).
 *
 * O problema que ela resolve: o preço não é dado, é FUNÇÃO. Não existe campo de
 * preço no produto — toda tela chama `calculatePricing` no render. Logo, mexer
 * numa alavanca global (watts, vida útil, manutenção, peso, custo fixo, rolo
 * novo de uma cor, lote novo de um insumo) reprecifica o catálogo INTEIRO, em
 * todos os aparelhos, sem aviso, sem antes/depois e sem desfazer.
 *
 * ⚠ O que NÃO é o problema (dono, 2026-09-08): que o preço acompanhe o insumo.
 * Filamento mais caro DEVE deixar o produto mais caro — falta controle e
 * rastro, não trava. Por isso esta função só MEDE; nenhuma decisão de bloquear
 * mora aqui.
 *
 * Uma função, três superfícies (molde do `fleet.ts`): a prévia do passo de
 * confirmação, o aviso pós-fato e o `impacto` gravado no doc de `alteracoes`.
 * Escrever a conta três vezes é a receita de as três divergirem — foi assim que
 * o UX-42 nasceu.
 */

// O pacote de alavancas contra o qual o catálogo é precificado. É exatamente o
// que o `calculatePricing` consome além do produto — nem mais, nem menos: uma
// alavanca que não estivesse aqui seria uma que a prévia não consegue medir.
//
// ⚠ O `fixedCosts` carrega o `enabled` porque a assinatura pede, mas ele é o
// PISO: cada produto traz o próprio `includeFixed`, aplicado por cima. Quem
// monta o pacote usa a mesma receita do catálogo
// (`{ ...fixedCostRate, enabled: DEFAULT_FIXED_COSTS.enabled }`), senão o
// "antes" da prévia não é o preço que o dono está vendo na vitrine.
//
// ⚠ `stock` e `supplies` vão INTEIROS, com os arquivados: filtrar antes faz
// arquivado passar por removido, e aí o produto cai no preço salvo de fallback
// e a prévia inventa um movimento que não vai acontecer (7c / TD-033).
export type RepriceLevers = {
  machines: Machine[];
  fixedCosts: FixedCostSettings;
  stock: StockFilament[];
  supplies: Supply[];
};

// O movimento de UM produto. Os preços são o `suggestedPrice` — o número da
// etiqueta, já arredondado pelo `roundingMode` do produto —, e não o
// `exactPrice`: mudança que o arredondamento come não move a vitrine e não
// deveria aparecer numa prévia que promete "estes vão mudar".
export type ProductImpact = {
  id: string;
  name: string;
  before: number;
  after: number;
  // `after - before`, em centavos exatos (o `round2` mata o ruído de ponto
  // flutuante que o `roundPrice` deixa passar).
  delta: number;
  // Variação percentual sobre o "antes". `null` quando o "antes" era 0 ou
  // negativo: dividir por ele daria Infinity, e pintar Infinity é pior que não
  // pintar (mesma disciplina do `marginTier`).
  deltaPct: number | null;
  // A margem PRECIFICADA BRUTA, pré-taxa — a mesma régua que o catálogo pinta.
  // É por isso que a prévia não depende do `config/taxas`: a taxa de pagamento
  // move a dica de margem líquida, não a etiqueta.
  marginBefore: number;
  marginAfter: number;
  tierBefore: MarginTier | null;
  tierAfter: MarginTier | null;
  // Mudou de faixa da DEC-04 (ruim/ok/boa). É o segundo número que o dono
  // pediu, ao lado do preço: "preço mais quem cruza".
  crossedTier: boolean;
};

export type RepriceImpact = {
  // Quantos produtos foram avaliados (o catálogo inteiro), afetados ou não.
  evaluated: number;
  // Só os que MUDARAM de preço, do maior movimento em R$ para o menor.
  items: ProductImpact[];
  affected: number;
  up: number;
  down: number;
  // Média das variações percentuais dos afetados. Produtos com "antes" 0
  // (`deltaPct: null`) ficam de fora dela — entram na contagem, não na média.
  avgPct: number;
  // O recorte que cabe numa tela e num documento: os N maiores movimentos.
  top: ProductImpact[];
  // Quem atravessou a faixa de margem, em qualquer direção.
  crossings: ProductImpact[];
};

// Quantos movimentos o `top` carrega por padrão. Dez é o teto que o doc de
// `alteracoes` guarda (ele guarda RESUMO, nunca o catálogo).
export const REPRICE_TOP_LIMIT = 10;

// Abaixo de meio centavo não há movimento nenhum na etiqueta: é ruído de ponto
// flutuante do `roundPrice` (ver a ressalva do `roundPrice("0.90")`, que devolve
// 48,899999999999998579 em vez de 48,90). Sem este piso, uma prévia de "nada
// mudou" listaria o catálogo inteiro.
const CENTAVO = 0.005;

function priceOf(
  product: SavedProduct,
  levers: RepriceLevers,
): { price: number; margin: number } {
  const result = calculatePricing(
    product,
    levers.machines,
    levers.fixedCosts,
    levers.stock,
    levers.supplies,
  );
  return { price: result.suggestedPrice, margin: result.margin };
}

/**
 * O impacto de trocar o pacote `antes` pelo pacote `depois` sobre um catálogo.
 *
 * PURA e sem I/O: os dois pacotes chegam prontos, e é quem chama que decide o
 * que eles são — o rascunho do modal de máquinas contra a lista que a `rev`
 * descreve (prévia), ou o estado de antes contra o de depois de um rolo novo
 * (aviso pós-fato).
 *
 * "Nada mudou" devolve `items` VAZIO com `evaluated` cheio, e não um objeto
 * vazio: a diferença entre "não mexeu em nada" e "não havia catálogo" é
 * justamente o que a tela precisa dizer.
 */
export function computeRepriceImpact(
  products: SavedProduct[],
  antes: RepriceLevers,
  depois: RepriceLevers,
  topLimit: number = REPRICE_TOP_LIMIT,
): RepriceImpact {
  const items: ProductImpact[] = [];

  for (const product of products) {
    const before = priceOf(product, antes);
    const after = priceOf(product, depois);
    const delta = round2(after.price - before.price);
    if (Math.abs(delta) < CENTAVO) continue;

    const tierBefore = marginTier(before.margin);
    const tierAfter = marginTier(after.margin);
    items.push({
      id: product.id,
      name: product.name ?? "",
      before: before.price,
      after: after.price,
      delta,
      deltaPct: before.price > 0 ? (delta / before.price) * 100 : null,
      marginBefore: before.margin,
      marginAfter: after.margin,
      tierBefore,
      tierAfter,
      // Faixa ausente dos DOIS lados não é cruzamento (é receita 0 nas duas
      // pontas); ausente de UM lado é — o produto entrou ou saiu da régua.
      crossedTier: tierBefore !== tierAfter,
    });
  }

  // Ordem: o maior movimento em REAIS primeiro. O percentual é a leitura mais
  // fácil, mas ele coroa o item barato — 20% de R$2 sobe uma lista que R$50 num
  // produto caro deveria abrir. Empate desempata pelo nome, para a mesma
  // mudança sair sempre na mesma ordem (o doc do registro é comparado a olho).
  items.sort(
    (a, b) =>
      Math.abs(b.delta) - Math.abs(a.delta) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );

  const comPct = items.filter(
    (item): item is ProductImpact & { deltaPct: number } => item.deltaPct !== null,
  );
  const avgPct =
    comPct.length > 0
      ? comPct.reduce((sum, item) => sum + item.deltaPct, 0) / comPct.length
      : 0;

  return {
    evaluated: products.length,
    items,
    affected: items.length,
    up: items.filter((item) => item.delta > 0).length,
    down: items.filter((item) => item.delta < 0).length,
    avgPct,
    top: items.slice(0, Math.max(0, topLimit)),
    crossings: items.filter((item) => item.crossedTier),
  };
}
