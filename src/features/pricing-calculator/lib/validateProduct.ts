import type { FilamentUsage, ProductInput } from "../types";
import { normalizeFilaments } from "./filaments";
import { num } from "@/lib/number";

// Nenhum peso/preço de cor pode ser negativo. `context` posiciona o erro (ex.:
// " da etapa 2"). A UI já trava a digitação, mas CSV/produto legado pode furar.
function filamentError(
  filaments: FilamentUsage[],
  context: string,
): string | null {
  for (const f of filaments) {
    if (num(f.pricePerKg) < 0) {
      return `⚠️ Preço do filamento${context} não pode ser negativo.`;
    }
    if (
      num(f.totalG) < 0 ||
      num(f.modelG) < 0 ||
      num(f.supportG) < 0 ||
      num(f.purgedG) < 0 ||
      num(f.towerG) < 0
    ) {
      return `⚠️ Peso do filamento${context} não pode ser negativo.`;
    }
  }
  return null;
}

export function validateProduct(product: ProductInput): string | null {
  const checks: Array<[number, string]> = [
    [product.printHours, "Tempo de impressão"],
    [product.energyTariff, "Tarifa de energia"],
    [product.laborMinutes, "Mão de obra (min)"],
    [product.laborRate, "Valor-hora"],
  ];

  for (const [value, label] of checks) {
    if (num(value) < 0) return `⚠️ "${label}" não pode ser negativo.`;
  }

  // Cores da etapa principal (FEAT-02) — migra o escalar legado quando preciso.
  const mainFilaments = normalizeFilaments(product);
  const mainError = filamentError(mainFilaments, "");
  if (mainError) return mainError;

  const mainWeight = mainFilaments.reduce(
    (sum, f) => sum + Math.max(0, num(f.totalG)),
    0,
  );
  if (mainWeight === 0 && num(product.printHours) === 0) {
    return "⚠️ Informe pelo menos o peso ou o tempo de impressão.";
  }

  if (product.markup < 1) return "⚠️ O markup deve ser no mínimo 1x.";

  // [FROTA] Fase 2 — pelo menos uma máquina elegível. O CÁLCULO sobrevive ao
  // conjunto vazio (cai na frota inteira e acende o badge de dado órfão, molde
  // TD-009), e é isso que salva os 97 produtos anteriores à fase; o que não pode
  // é o dono SALVAR um produto novo sem dizer onde ele roda, porque aí o preço
  // seria a média de uma frota que ninguém declarou. A importação de CSV não
  // esbarra aqui: célula vazia lá vira a frota inteira, com aviso próprio.
  if ((product.machineIds ?? []).length === 0) {
    return "⚠️ Marque ao menos uma máquina onde o produto pode ser impresso.";
  }

  // AUD-16 [E2] — a taxa de falha nunca foi validada aqui: quem cuidava dela era
  // um clamp escondido no importador (`Math.min(95, Math.max(0, …))`), que
  // mudava o número sem dizer. O domínio é o mesmo que o formulário já pinta no
  // campo (`max={95}`) e o mesmo que a matemática assume (`failureFractionOf`
  // trunca em 0,95 para a reserva `custo/(1−taxa)` não explodir) — só faltava
  // ele existir em um lugar só, para o CSV e o formulário reprovarem igual.
  // Ausente é ausente: `num(undefined)` é 0 e passa, como nas outras checagens.
  const failureRate = num(product.failureRate);
  if (failureRate < 0 || failureRate > 95) {
    return '⚠️ "Taxa de falha" precisa ficar entre 0% e 95%.';
  }

  // CSV-31: peça é CONTAGEM — não existe "1,234 peça". A planilha que escreve
  // `Pecas = "1.234"` já acende o `milhar-ambiguo` (o app não adivinha se era
  // mil duzentos e trinta e quatro ou um vírgula duzentos e trinta e quatro),
  // mas o valor absurdo entrava assim mesmo e o preço caía de 29,71 para 24,08
  // — o custo fixo dividido por 1,234 em vez de por 1234.
  // ⚠ Reprovar em vez de arredondar é a escolha do dono, e é a certa: se a
  // planilha queria dizer 1234, arredondar para 1 troca um número absurdo (que
  // salta aos olhos) por um plausível (que ninguém acha depois).
  if (!Number.isInteger(num(product.piecesCount))) {
    return '⚠️ "Peças por impressão" precisa ser um número inteiro.';
  }

  // Etapas extras: nenhum campo pode ser negativo (tempo/mão de obra e o
  // peso/preço de cada cor). Tarifa e valor-hora não entram: são do produto e
  // já foram checados acima.
  const stages = product.stages ?? [];
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    if (num(stage.printHours) < 0 || num(stage.laborMinutes) < 0) {
      return `⚠️ A etapa ${index + 2} contém valores negativos.`;
    }
    if ((stage.machineIds ?? []).length === 0) {
      return `⚠️ Marque ao menos uma máquina na etapa ${index + 2}.`;
    }
    const stageError = filamentError(
      normalizeFilaments(stage),
      ` da etapa ${index + 2}`,
    );
    if (stageError) return stageError;
  }

  // FEAT-01: subitens vendáveis. Só valida quando o modo está ligado. Cada
  // subitem precisa de nome e ao menos uma etapa; o markup override (se houver)
  // respeita o mínimo de 1x, como o do produto.
  if (product.sellBySubitems) {
    const subitems = product.subitems ?? [];
    if (subitems.length === 0) {
      return "⚠️ Adicione ao menos um subitem ou desligue a venda por subitens.";
    }
    for (let index = 0; index < subitems.length; index += 1) {
      const subitem = subitems[index];
      const label = subitem.name?.trim() || `Subitem ${index + 1}`;
      if (!subitem.name?.trim()) {
        return `⚠️ Dê um nome ao ${label}.`;
      }
      if ((subitem.stageKeys ?? []).length === 0) {
        return `⚠️ "${label}" não tem nenhuma etapa. Marque ao menos uma.`;
      }
      if (subitem.markup !== undefined && subitem.markup < 1) {
        return `⚠️ O markup de "${label}" deve ser no mínimo 1x.`;
      }
    }
  }

  // Acessórios: quantidade e preço unitário não podem ser negativos. A UI já
  // trava a digitação, mas um CSV importado ou produto legado pode furar isso.
  const accessories = product.accessories ?? [];
  for (let index = 0; index < accessories.length; index += 1) {
    const accessory = accessories[index];
    if (accessory.qty < 0 || accessory.unitPrice < 0) {
      const label = accessory.desc?.trim() || `Acessório ${index + 1}`;
      return `⚠️ "${label}" tem quantidade ou preço negativo.`;
    }
  }

  return null;
}
