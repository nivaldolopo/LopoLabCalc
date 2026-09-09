import type {
  ChangeImpact,
  ChangeLever,
  ChangeRecord,
  ChangeRecordPayload,
  ChangeState,
  FixedCostRate,
  Machine,
} from "../types";
import type { RepriceImpact } from "./repriceImpact";
import { REPRICE_TOP_LIMIT } from "./repriceImpact";
import { formatCurrency, formatDecimal } from "@/lib/formatting/currency";

/**
 * [FEAT-12] — a REDAÇÃO da mudança e a forma com que ela é gravada.
 *
 * Fica separada do `repriceImpact.ts` de propósito: lá mora a conta do preço,
 * aqui mora o que se diz sobre a alavanca. As duas se encontram só no documento
 * de `alteracoes`, e nenhuma das duas sabe desenhar tela.
 *
 * ⚠ AUD-17 [E3]/[E8] — qual frase mostrar é DECISÃO, e decisão vai para o `lib/`
 * puro. No JSX nenhum teste a alcança, e foi exatamente assim que o
 * `writeTimeoutMessage` acabou contradito por uma string escrita à mão no
 * componente.
 */

// O estado vazio: todo campo `null`. É o piso de qualquer `ChangeState` — o
// Firestore não aceita `undefined`, e um campo esquecido viraria omissão
// silenciosa na leitura do desfazer (AUD-02: campo que o repositório grava é
// obrigatório; `null` é a forma de dizer "não se aplica").
export const EMPTY_CHANGE_STATE: ChangeState = {
  machines: null,
  fixedCostRate: null,
  unitPrice: null,
};

export function machineState(machines: Machine[]): ChangeState {
  return { ...EMPTY_CHANGE_STATE, machines: machines.map((m) => ({ ...m })) };
}

export function fixedCostState(rate: FixedCostRate): ChangeState {
  return { ...EMPTY_CHANGE_STATE, fixedCostRate: { ...rate } };
}

export function priceState(unitPrice: number): ChangeState {
  return { ...EMPTY_CHANGE_STATE, unitPrice };
}

// ---------------------------------------------------------------------------
// A descrição campo a campo
// ---------------------------------------------------------------------------

// Os campos da máquina que MOVEM PREÇO, com o rótulo e a unidade de cada um. O
// `name` fica de fora: renomear não reprecifica nada, e listá-lo encheria a
// prévia de linhas que não explicam movimento nenhum.
const MACHINE_FIELDS: {
  key: keyof Machine;
  label: string;
  unit: string;
}[] = [
  { key: "price", label: "preço", unit: "R$" },
  { key: "lifeHours", label: "vida útil", unit: "h" },
  { key: "watts", label: "consumo", unit: "W" },
  { key: "maintenancePerHour", label: "manutenção", unit: "R$/h" },
  { key: "weight", label: "peso na frota", unit: "%" },
];

const FIXED_COST_FIELDS: {
  key: keyof FixedCostRate;
  label: string;
  unit: string;
}[] = [
  { key: "rent", label: "aluguel", unit: "R$/mês" },
  { key: "other", label: "outros custos", unit: "R$/mês" },
  { key: "machines", label: "máquinas operando", unit: "" },
  { key: "hoursDay", label: "horas/dia", unit: "" },
  { key: "daysMonth", label: "dias/mês", unit: "" },
];

// Dinheiro se escreve como dinheiro, com o denominador colado ("R$ 0,12/h",
// "R$ 1.500,00/mês") — a unidade que começa em "R$" é a marca disso.
//
// Fora do dinheiro, o `formatDecimal` fixa 2 casas e aqui isso vira ruído: a
// vida útil sairia "7.500,00 h" e os dias do mês "26,00". Inteiro se escreve
// inteiro; o resto mantém as duas casas.
function valor(n: number, unit: string): string {
  if (unit.startsWith("R$")) return `${formatCurrency(n)}${unit.slice(2)}`;
  const texto = Number.isInteger(n) ? n.toLocaleString("pt-BR") : formatDecimal(n);
  return unit ? `${texto} ${unit}` : texto;
}

function campo(label: string, unit: string, de: number, para: number): string {
  return `${label} ${valor(de, unit)} → ${valor(para, unit)}`;
}

/**
 * As linhas de detalhe de uma mudança na FROTA — uma por campo alterado, mais
 * as máquinas adicionadas e removidas.
 *
 * ⚠ A exclusão é a linha mais importante da lista, e é por isso que ela é
 * escrita por extenso: o id salvo em cada produto vira ÓRFÃO e o `resolveFleet`
 * cai na frota inteira. O produto que só rodava naquela máquina passa a ser
 * precificado por outras — e nada na tela do produto diz isso, só o badge.
 */
export function describeMachineChanges(
  antes: Machine[],
  depois: Machine[],
): string[] {
  const linhas: string[] = [];
  const antesPorId = new Map(antes.map((m) => [m.id, m]));
  const depoisPorId = new Map(depois.map((m) => [m.id, m]));

  for (const nova of depois) {
    const velha = antesPorId.get(nova.id);
    const nome = nova.name.trim() || "máquina sem nome";
    if (!velha) {
      linhas.push(`${nome} · adicionada`);
      continue;
    }
    if (velha.name.trim() !== nova.name.trim()) {
      // Renomear não move preço, mas move a LEITURA de todas as outras linhas —
      // sem esta, "A1 Combo · peso 40 → 20 %" fala de um nome que não existia.
      linhas.push(`${velha.name.trim() || "sem nome"} · renomeada para ${nome}`);
    }
    for (const { key, label, unit } of MACHINE_FIELDS) {
      const de = Number(velha[key]) || 0;
      const para = Number(nova[key]) || 0;
      if (de !== para) linhas.push(`${nome} · ${campo(label, unit, de, para)}`);
    }
  }

  for (const velha of antes) {
    if (depoisPorId.has(velha.id)) continue;
    linhas.push(
      `${velha.name.trim() || "máquina sem nome"} · EXCLUÍDA — os produtos que ` +
        `só rodavam nela passam a ser precificados pela frota inteira`,
    );
  }

  return linhas;
}

export function describeFixedCostChanges(
  antes: FixedCostRate,
  depois: FixedCostRate,
): string[] {
  const linhas: string[] = [];
  for (const { key, label, unit } of FIXED_COST_FIELDS) {
    const de = Number(antes[key]) || 0;
    const para = Number(depois[key]) || 0;
    if (de !== para) linhas.push(campo(label, unit, de, para));
  }
  return linhas;
}

/**
 * A frase de UMA linha que abre a entrada. É a mesma na prévia, no aviso
 * acumulado e no registro — escrever três é a receita de as três divergirem.
 *
 * Lista de detalhes vazia devolve `"sem alteração"`, e não uma frase vaga: é o
 * caso do "cancelar não grava" (nada mudou no rascunho) e ele tem de se anunciar.
 */
export function summarizeChange(lever: ChangeLever, details: string[]): string {
  if (details.length === 0) return "sem alteração";
  if (details.length === 1) return details[0];
  const quantos = `${details.length} campos`;
  const onde: Record<ChangeLever, string> = {
    maquinas: "Frota",
    "custo-fixo": "Custo fixo",
    cor: "Cor",
    insumo: "Insumo",
  };
  return `${onde[lever]} · ${quantos} alterados`;
}

// ---------------------------------------------------------------------------
// Do impacto calculado para o impacto GRAVADO
// ---------------------------------------------------------------------------

/**
 * O recorte do `RepriceImpact` que vai para o documento: agregados, até dez
 * maiores movimentos e os cruzamentos de faixa.
 *
 * ⚠ Guarda RESUMO, NUNCA o catálogo. Com 104 produtos afetados, gravar a lista
 * inteira poria ~104 objetos num doc que é escrito a cada rolo novo — e o que
 * responde "por que este produto está 18% mais caro?" é o maior movimento, não
 * a enésima linha.
 */
export function toChangeImpact(
  impacto: RepriceImpact,
  topLimit: number = REPRICE_TOP_LIMIT,
): ChangeImpact {
  return {
    evaluated: impacto.evaluated,
    affected: impacto.affected,
    up: impacto.up,
    down: impacto.down,
    avgPct: impacto.avgPct,
    top: impacto.top.slice(0, topLimit).map((item) => ({
      id: item.id,
      name: item.name,
      before: item.before,
      after: item.after,
    })),
    crossings: impacto.crossings.map((item) => ({
      id: item.id,
      name: item.name,
      from: item.tierBefore,
      to: item.tierAfter,
    })),
  };
}

// ---------------------------------------------------------------------------
// Peça 6 — o DESFAZER, derivado do registro
// ---------------------------------------------------------------------------

/**
 * Dá para desfazer esta entrada?
 *
 * Só as duas alavancas de "pergunta antes": elas guardam o documento de config
 * INTEIRO no `before`, então o desfazer é gravá-lo de volta. As de "conta
 * depois" não — desfazer um rolo novo seria APAGAR o rolo, que é dado de
 * estoque, não uma alavanca de configuração. Quem quiser o preço velho de uma
 * cor cadastra a cotação certa; o registro serve para achar o dia.
 *
 * E uma entrada que já é o desfazer de outra continua desfazível: desfazer o
 * desfazer é só mais uma mudança global, com o seu próprio rastro.
 */
export function canUndo(record: ChangeRecord): boolean {
  if (record.lever === "maquinas") return record.before.machines !== null;
  if (record.lever === "custo-fixo") return record.before.fixedCostRate !== null;
  return false;
}

/**
 * O rótulo do botão/entrada — o que o desfazer VAI fazer, não o que aconteceu.
 * `null` quando não há desfazer possível, com o motivo do lado de quem chama.
 */
export function undoLabelOf(record: ChangeRecord): string | null {
  if (!canUndo(record)) return null;
  return record.lever === "maquinas"
    ? "Restaurar a frota como estava"
    : "Restaurar o custo fixo como estava";
}

// ---------------------------------------------------------------------------
// A PROPOSTA — o que a prévia recebe para poder existir sem conhecer a tela
// ---------------------------------------------------------------------------

/**
 * Uma mudança de alavanca PROPOSTA, ainda não gravada.
 *
 * As duas alavancas de "pergunta antes" viajam INTEIRAS nos dois lados
 * (`machinesBefore/After`, `fixedRateBefore/After`), mesmo quando só uma delas
 * se moveu: é o que permite ao passo de confirmação precificar os dois cenários
 * sem saber qual alavanca está sendo mexida. O lado que não mudou é o mesmo
 * objeto dos dois lados, e o `computeRepriceImpact` devolve lista vazia.
 *
 * ⚠ O "antes" das máquinas é a lista que a `revDoRascunho` descreve, NUNCA a
 * viva (AUD-18): com a outra aba tendo gravado no meio, a lista viva já é a de
 * quem sobrescreveu, e a prévia mostraria um "antes" que o dono nunca viu.
 * Produtos, estoque e insumos NÃO viajam aqui — eles são os mesmos dos dois
 * lados e quem os tem é a tela.
 */
export type RepriceProposal = {
  lever: ChangeLever;
  details: string[];
  summary: string;
  before: ChangeState;
  after: ChangeState;
  machinesBefore: Machine[];
  machinesAfter: Machine[];
  fixedRateBefore: FixedCostRate;
  fixedRateAfter: FixedCostRate;
};

/** A proposta de mexer na FROTA, com o custo fixo parado dos dois lados. */
export function machinesProposal(
  antes: Machine[],
  depois: Machine[],
  fixedRate: FixedCostRate,
): RepriceProposal {
  const details = describeMachineChanges(antes, depois);
  return {
    lever: "maquinas",
    details,
    summary: summarizeChange("maquinas", details),
    before: machineState(antes),
    after: machineState(depois),
    machinesBefore: antes,
    machinesAfter: depois,
    fixedRateBefore: fixedRate,
    fixedRateAfter: fixedRate,
  };
}

/** A proposta de mexer no CUSTO FIXO, com a frota parada dos dois lados. */
export function fixedCostProposal(
  antes: FixedCostRate,
  depois: FixedCostRate,
  machines: Machine[],
): RepriceProposal {
  const details = describeFixedCostChanges(antes, depois);
  return {
    lever: "custo-fixo",
    details,
    summary: summarizeChange("custo-fixo", details),
    before: fixedCostState(antes),
    after: fixedCostState(depois),
    machinesBefore: machines,
    machinesAfter: machines,
    fixedRateBefore: antes,
    fixedRateAfter: depois,
  };
}

/**
 * A proposta que DESFAZ uma entrada do registro (peça 6).
 *
 * O `antes` da alavanca já está gravado, então não é preciso guardar cópia
 * nenhuma dos produtos. E o desfazer PASSA PELA MESMA PRÉVIA: desfazer também é
 * mudança global, e um botão que reprecificasse 103 produtos em silêncio seria
 * o problema que este item existe para resolver, de costas.
 *
 * `null` quando a entrada não é desfazível — ou porque a alavanca não guarda
 * estado restaurável (cor/insumo), ou porque o documento chegou sem o `before`
 * (o repositório o descarta quando vem torto, em vez de montar um meio objeto).
 * Quem chama transforma esse `null` em recado, não em botão morto.
 *
 * ⚠ O "estado atual" vem de fora e é o VIVO, não o `after` gravado: entre a
 * mudança e o desfazer pode ter havido outra. Desfazer é "volte para aquele
 * estado", e o que a prévia tem de mostrar é o caminho a partir de onde o preço
 * está AGORA.
 */
export function undoProposal(
  record: ChangeRecord,
  machinesAtuais: Machine[],
  fixedRateAtual: FixedCostRate,
): RepriceProposal | null {
  if (record.lever === "maquinas") {
    const alvo = record.before.machines;
    if (!alvo) return null;
    return machinesProposal(machinesAtuais, alvo, fixedRateAtual);
  }
  if (record.lever === "custo-fixo") {
    const alvo = record.before.fixedCostRate;
    if (!alvo) return null;
    return fixedCostProposal(fixedRateAtual, alvo, machinesAtuais);
  }
  return null;
}

// ---------------------------------------------------------------------------
// As alavancas de "CONTA DEPOIS" — rolo novo de uma cor, lote novo de um insumo
// ---------------------------------------------------------------------------

/**
 * O registro de uma cotação que mudou no estoque.
 *
 * ⚠ Aqui NÃO há prévia, e é decisão: o dono está cadastrando uma compra, não
 * veio decidir preço. Perguntar "confirma reprecificar 21 produtos?" no meio do
 * cadastro de um rolo seria pedir confirmação de algo que ele não escolheu — e
 * o que ele escolheu (pagar mais caro pelo filamento) já aconteceu no mundo.
 * Filamento mais caro DEVE deixar o produto mais caro (dono, 2026-09-08); o que
 * faltava era o rastro e o aviso, não a trava.
 *
 * O `unit` entra na frase porque as duas alavancas medem coisas diferentes:
 * a cor cota em R$/kg, o insumo em R$/unidade.
 */
export function stockChangePayload(params: {
  lever: "cor" | "insumo";
  // O nome já montado ("PLA Basic · Preto · Bambu", "Ímã 6×2mm").
  label: string;
  unit: string;
  priceBefore: number;
  priceAfter: number;
  by: string;
  impact: RepriceImpact;
  at?: number;
}): ChangeRecordPayload {
  const { lever, label, unit, priceBefore, priceAfter, by, impact } = params;
  const linha = `${label} · ${campo("cotação", unit, priceBefore, priceAfter)}`;
  return {
    at: params.at ?? Date.now(),
    by,
    lever,
    summary: linha,
    details: [linha],
    // O `before`/`after` guardam só a cotação: restaurar não é opção (seria
    // apagar o rolo ou o lote, que é dado de estoque), então guardar o documento
    // inteiro do estoque seria peso morto num doc escrito a cada compra.
    before: priceState(priceBefore),
    after: priceState(priceAfter),
    impact: toChangeImpact(impact),
    undoOf: null,
  };
}
