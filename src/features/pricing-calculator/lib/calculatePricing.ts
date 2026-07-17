import type {
  Accessory,
  FixedCostSettings,
  FixedCostSummary,
  Machine,
  MachineUsage,
  PricingResult,
  PrintStage,
  ProductInput,
  SaleCostBreakdown,
  StageCost,
  StockFilament,
  Subitem,
  SubitemPrice,
} from "../types";
import { DEFAULT_FAILURE_RATE } from "../constants";
import { roundPrice, type RoundingMode } from "./roundPrice";
import {
  filamentsMaterialCost,
  mergeFilaments,
  normalizeFilaments,
} from "./filaments";
import { catalogPricePerKg } from "./stock";
import { num } from "@/lib/number";
import type { FilamentUsage } from "../types";

// FEAT-01: identidade estável de uma etapa para os `stageKeys` dos subitens. A
// etapa principal é a sentinela "main"; extras usam o próprio id (persistido a
// partir da FEAT-01), com fallback por posição para dado antigo sem id.
export const MAIN_STAGE_KEY = "main";
function stageKeyFor(stage: PrintStage, index: number): string {
  return stage.id ?? `stage_${index}`;
}

// Detalhe por etapa usado no rateio por subitem (FEAT-01): a chave estável, o
// custo já calculado (com preço vivo resolvido) e as horas de impressão.
type StageDetail = { key: string; cost: StageCost; printHours: number };

// 7c — preço VIVO do filamento. Um filamento ligado ao Estoque (`filamentId`)
// tira o preço da COR na hora do cálculo (D3, lado catálogo: rolo mais novo =
// custo de repor), não do valor salvo — igual às máquinas, que guardam só o
// `machineId` e leem os watts vivos. Sem rolo na cor, ou cor removida, cai no
// `pricePerKg` salvo (fallback D3); a cor removida ainda marca `missing` para a
// UI avisar (badge, molde do TD-009).
function resolveFilamentPrices(
  filaments: FilamentUsage[],
  stockById: Map<string, StockFilament>,
): { filaments: FilamentUsage[]; missing: boolean } {
  let missing = false;
  const resolved = filaments.map((f) => {
    if (!f.filamentId) return f; // avulso: mantém o preço digitado
    const color = stockById.get(f.filamentId);
    if (!color) {
      missing = true;
      return f; // cor removida: fallback no preço salvo
    }
    const live = catalogPricePerKg(color);
    return { ...f, pricePerKg: live > 0 ? live : num(f.pricePerKg) };
  });
  return { filaments: resolved, missing };
}

function findMachine(
  machines: Machine[],
  machineId: string,
): { machine: Machine; found: boolean } {
  const match = machines.find((machine) => machine.id === machineId);
  if (match) return { machine: match, found: true };
  // Dado órfão: o produto aponta para uma máquina que não existe mais. Mantemos
  // o fallback (1ª máquina) para não quebrar o preço, mas sinalizamos — antes
  // isso caía em silêncio e mascarava o erro (TD-009).
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[pricing] máquina "${machineId}" não encontrada; usando ` +
        `"${machines[0]?.name ?? "—"}" como fallback.`,
    );
  }
  return { machine: machines[0], found: false };
}

export function normalizeStages(product: ProductInput): PrintStage[] {
  if (product.stages?.length) return product.stages;
  // LEGADO: produtos antigos guardavam a 2ª etapa em combineEnabled/stage2 antes
  // do array `stages`. Migração só-leitura — produtos novos nunca chegam aqui.
  if (product.combineEnabled && product.stage2) return [product.stage2];
  return [];
}

export function calculateFixedCostPerHour(settings: FixedCostSettings): number {
  const totalFixed = num(settings.rent) + num(settings.other);
  const machinesCount = Math.max(1, num(settings.machines) || 1);
  const hoursMonth =
    num(settings.hoursDay) *
    num(settings.daysMonth) *
    machinesCount;

  return hoursMonth > 0 ? totalFixed / hoursMonth : 0;
}

export function calculateFixedCostSummary(
  settings: FixedCostSettings,
  printHours: number,
): FixedCostSummary {
  const totalFixed = num(settings.rent) + num(settings.other);
  const machinesCount = Math.max(1, num(settings.machines) || 1);
  const hoursMonth =
    num(settings.hoursDay) *
    num(settings.daysMonth) *
    machinesCount;
  const perHour = hoursMonth > 0 ? totalFixed / hoursMonth : 0;

  return {
    totalFixed,
    hoursMonth,
    perHour,
    perPrint: perHour * num(printHours),
  };
}

export function calculateStageCost(
  stage: PrintStage,
  machines: Machine[],
  fallbackEnergyTariff: number,
  fallbackLaborRate: number,
  stockById: Map<string, StockFilament> = new Map(),
): StageCost {
  const { machine, found } = findMachine(machines, stage.machineId);
  // FEAT-02: material = soma por cor (peso total × preço/kg). Migra o escalar
  // legado (weightG/filamentPricePerKg) para uma cor única quando `filaments`
  // não existe. 7c: resolve o preço vivo (rolo mais novo) das cores ligadas.
  const { filaments, missing: filamentMissing } = resolveFilamentPrices(
    normalizeFilaments(stage),
    stockById,
  );
  const materialCost = filamentsMaterialCost(filaments);
  const energyCost =
    num(stage.printHours) *
    (num(machine.watts) / 1000) *
    num(stage.energyTariff ?? fallbackEnergyTariff);
  const depreciationCost =
    machine.lifeHours > 0
      ? (num(machine.price) / machine.lifeHours) *
        num(stage.printHours)
      : 0;
  const maintenanceCost =
    num(stage.printHours) * num(machine.maintenancePerHour);
  const laborCost =
    (num(stage.laborMinutes) / 60) *
    num(stage.laborRate ?? fallbackLaborRate);

  return {
    machine,
    machineMissing: !found,
    filaments,
    filamentMissing,
    materialCost,
    energyCost,
    depreciationCost,
    maintenanceCost,
    laborCost,
  };
}

export function calculatePricing(
  product: ProductInput,
  machines: Machine[],
  fixedCosts: FixedCostSettings,
  stock: StockFilament[] = [],
): PricingResult {
  const pieces = Math.max(1, num(product.piecesCount) || 1);
  // 7c: índice cor→doc para resolver o preço vivo (D3). Vazio = nada ligado ao
  // Estoque (chamadas legadas/testes), e todo filamento cai no preço salvo.
  const stockById = new Map(stock.map((color) => [color.id, color]));
  const mainStage = calculateStageCost(
    {
      machineId: product.machineId,
      filaments: product.filaments,
      weightG: product.weightG,
      printHours: product.printHours,
      filamentPricePerKg: product.filamentPricePerKg,
      energyTariff: product.energyTariff,
      laborMinutes: product.laborMinutes,
      laborRate: product.laborRate,
    },
    machines,
    product.energyTariff,
    product.laborRate,
    stockById,
  );

  // Repartição de uso por máquina (agregada por máquina, somando as etapas que
  // caem na mesma impressora). Vira `machineUsage` no resultado, dividido por
  // peça. É o que permite ao ROI atribuir horas/vida/lucro à máquina certa.
  const usageMap = new Map<string, MachineUsage>();
  function addUsage(machine: Machine, hours: number, depreciation: number) {
    const prev = usageMap.get(machine.id);
    if (prev) {
      prev.hours += hours;
      prev.depreciation += depreciation;
    } else {
      usageMap.set(machine.id, {
        machineId: machine.id,
        machineName: machine.name,
        hours,
        depreciation,
      });
    }
  }
  addUsage(
    mainStage.machine,
    num(product.printHours),
    mainStage.depreciationCost,
  );

  let anyMachineMissing = mainStage.machineMissing;
  let anyFilamentMissing = mainStage.filamentMissing;

  // FEAT-02: acumula o consumo por cor de todas as etapas (principal + extras)
  // para agregar num único array por cor no resultado (pesos por impressão).
  const allFilaments: FilamentUsage[] = [...mainStage.filaments];

  // FEAT-01: detalhe por etapa (com a chave estável) para o rateio por subitem.
  // A principal entra como "main"; as extras entram no loop abaixo.
  const stageDetails: StageDetail[] = [
    { key: MAIN_STAGE_KEY, cost: mainStage, printHours: num(product.printHours) },
  ];

  const stagesList = normalizeStages(product);
  let stagesMaterial = 0;
  let stagesEnergy = 0;
  let stagesDepreciation = 0;
  let stagesMaintenance = 0;
  let stagesLabor = 0;
  let stagesHours = 0;

  stagesList.forEach((stage, index) => {
    const cost = calculateStageCost(
      stage,
      machines,
      product.energyTariff,
      product.laborRate,
      stockById,
    );
    stagesMaterial += cost.materialCost;
    stagesEnergy += cost.energyCost;
    stagesDepreciation += cost.depreciationCost;
    stagesMaintenance += cost.maintenanceCost;
    stagesLabor += cost.laborCost;
    stagesHours += num(stage.printHours);
    if (cost.machineMissing) anyMachineMissing = true;
    if (cost.filamentMissing) anyFilamentMissing = true;
    allFilaments.push(...cost.filaments);
    addUsage(cost.machine, num(stage.printHours), cost.depreciationCost);
    stageDetails.push({
      key: stageKeyFor(stage, index),
      cost,
      printHours: num(stage.printHours),
    });
  });

  const machineUsage: MachineUsage[] = Array.from(usageMap.values()).map(
    (usage) => ({
      ...usage,
      hours: usage.hours / pieces,
      depreciation: usage.depreciation / pieces,
    }),
  );

  // Os custos das etapas extras entram nas MESMAS categorias da etapa principal
  // (filamento -> material, tempo -> energia/desgaste/manutenção, mão de obra ->
  // labor), em vez de ficarem num balde "Etapas" separado.
  const materialCost = (mainStage.materialCost + stagesMaterial) / pieces;
  const energyCost = (mainStage.energyCost + stagesEnergy) / pieces;
  const depreciationCost =
    (mainStage.depreciationCost + stagesDepreciation) / pieces;
  const maintenanceCost =
    (mainStage.maintenanceCost + stagesMaintenance) / pieces;
  const laborCost = (mainStage.laborCost + stagesLabor) / pieces;
  // Subtotal informativo: quanto do custo vem das etapas extras (usado no CSV).
  const stagesCost =
    (stagesMaterial +
      stagesEnergy +
      stagesDepreciation +
      stagesMaintenance +
      stagesLabor) /
    pieces;

  const accessoriesCost = (product.accessories ?? []).reduce(
    (sum, accessory) =>
      sum +
      num(accessory.qty) * num(accessory.unitPrice),
    0,
  );

  let includeFixed = fixedCosts.enabled;
  if (product.includeFixed !== undefined && product.includeFixed !== null) {
    includeFixed = product.includeFixed;
  } else if (
    product.fixedCostPerHour !== undefined &&
    product.fixedCostPerHour !== null
  ) {
    includeFixed = product.fixedCostPerHour > 0;
  }

  const fixedCostPerHour = includeFixed
    ? calculateFixedCostPerHour(fixedCosts)
    : 0;
  const fixedCost =
    (fixedCostPerHour * (num(product.printHours) + stagesHours)) /
    pieces;

  // Custo de impressão (o que se perde numa falha). Acessórios ficam de fora:
  // ímãs/parafusos são montados depois e não se perdem se a peça falha.
  const printingCost =
    materialCost + energyCost + depreciationCost + maintenanceCost + laborCost;
  // Reserva de falha: infla o custo para que as peças boas cubram as perdidas.
  // custo por peça boa = custo / (1 - taxa). Clamp em 95% para não explodir.
  const failureRatePct = num(product.failureRate ?? DEFAULT_FAILURE_RATE);
  const failureFraction = Math.min(0.95, Math.max(0, failureRatePct / 100));
  const failureReserve =
    failureFraction > 0
      ? printingCost * (failureFraction / (1 - failureFraction))
      : 0;

  const variableCost = printingCost + failureReserve + accessoriesCost;
  const totalCost = variableCost + fixedCost;
  const roundingMode = product.roundingMode ?? "exact";

  // DEC-01: markup NUNCA incide sobre o custo fixo — o fixo é só repassado
  // (variableCost × markup + fixedCost). O antigo toggle "aplicar markup sobre
  // o fixo" foi removido; se algum produto no Firestore ainda tiver o campo
  // `markupOnFixed`, é lixo inofensivo (ignorado aqui).
  // Preço exato (bruto do cálculo) e preço final arredondado para valor de
  // mercado. Todo o resto (margem, lote, catálogo, capacidade) usa o final.
  let exactPrice = variableCost * product.markup + fixedCost;
  let suggestedPrice = roundPrice(exactPrice, roundingMode);

  // FEAT-01: rateio ADITIVO por subitem. Só quando o produto tem subitens
  // válidos; nesse caso o preço do INTEIRO passa a ser a SOMA dos subitens
  // (soma das partes = inteiro, exato — decisão do dono). Sem subitens, o preço
  // segue a fórmula de hoje acima.
  let subitems: SubitemPrice[] | undefined;
  if (product.sellBySubitems && product.subitems?.length) {
    const priced = computeSubitems(
      product.subitems,
      stageDetails,
      product.accessories ?? [],
      {
        pieces,
        productMarkup: product.markup,
        roundingMode,
        failureReserve,
        fixedCost,
        accessoriesCost,
      },
    );
    if (priced) {
      subitems = priced.subitems;
      exactPrice = priced.exactPrice;
      suggestedPrice = priced.suggestedPrice;
    }
  }

  // NOTA (DEC-01, pendência): sem markup no fixo, `contributionPrice` desconta o
  // fixo → `contributionMargin` fica = suggestedPrice − totalCost, ou seja o
  // LUCRO por peça, não a margem de contribuição clássica (preço − custo
  // variável). Nome impróprio, mantido idêntico ao comportamento anterior de
  // propósito (opção A). Corrigir a semântica mudaria o ponto de equilíbrio
  // (opção B, adiada). Ver DEC-01 no CLAUDE.md.
  const contributionPrice = suggestedPrice - fixedCost;
  const contributionMargin = contributionPrice - variableCost;
  const margin =
    suggestedPrice > 0
      ? ((suggestedPrice - totalCost) / suggestedPrice) * 100
      : 0;

  return {
    machine: mainStage.machine,
    materialCost,
    energyCost,
    depreciationCost,
    maintenanceCost,
    laborCost,
    accessoriesCost,
    failureReserve,
    fixedCost,
    stagesCost,
    variableCost,
    totalCost,
    suggestedPrice,
    exactPrice,
    margin,
    pieces,
    stagesCount: stagesList.length,
    contributionMargin,
    filaments: mergeFilaments(allFilaments),
    machineUsage,
    machineMissing: anyMachineMissing,
    filamentMissing: anyFilamentMissing,
    subitems,
  };
}

// Ruído de ponto flutuante ao comparar o peso-base do rateio com zero.
const SUBITEM_EPSILON = 1e-9;

// Categorias de custo (por unidade) de um grupo de etapas.
type StageCat = {
  material: number;
  energy: number;
  depreciation: number;
  maintenance: number;
  labor: number;
};

function zeroCat(): StageCat {
  return { material: 0, energy: 0, depreciation: 0, maintenance: 0, labor: 0 };
}

// Acumula UMA etapa (custo bruto) numa categoria, já dividindo por peça — mesma
// base per-unit do produto inteiro.
function addStageToCat(cat: StageCat, cost: StageCost, pieces: number): void {
  cat.material += cost.materialCost / pieces;
  cat.energy += cost.energyCost / pieces;
  cat.depreciation += cost.depreciationCost / pieces;
  cat.maintenance += cost.maintenanceCost / pieces;
  cat.labor += cost.laborCost / pieces;
}

function catPrinting(cat: StageCat): number {
  return cat.material + cat.energy + cat.depreciation + cat.maintenance + cat.labor;
}

type SubitemInputs = {
  pieces: number;
  productMarkup: number;
  roundingMode: RoundingMode;
  failureReserve: number; // por unidade
  fixedCost: number; // por unidade
  accessoriesCost: number; // total (não dividido por peça — como no inteiro)
};

// FEAT-01 — o miolo do rateio ADITIVO. Reparte os custos entre os subitens de
// modo que Σ subitens = inteiro (exato). Peso de cada subitem = seu custo de
// impressão próprio; passos internos, reserva de falha, custo fixo e acessórios
// não atribuídos são rateados por esse peso; acessório atribuído vai 100% no seu
// subitem. Markup por subitem (override) ou o do produto. O fixo NÃO leva markup
// (DEC-01). Devolve os subitens já precificados e a soma (novo preço do inteiro).
function computeSubitems(
  subitemConfigs: Subitem[],
  stageDetails: StageDetail[],
  accessories: Accessory[],
  inputs: SubitemInputs,
): { subitems: SubitemPrice[]; exactPrice: number; suggestedPrice: number } | null {
  const {
    pieces,
    productMarkup,
    roundingMode,
    failureReserve,
    fixedCost,
    accessoriesCost,
  } = inputs;

  const detailByKey = new Map(stageDetails.map((d) => [d.key, d]));

  // Chaves cobertas por algum subitem → o resto de stageDetails é passo interno.
  const assignedKeys = new Set<string>();
  for (const sub of subitemConfigs) {
    for (const key of sub.stageKeys ?? []) assignedKeys.add(key);
  }

  // Passos internos (per unit), rateados depois por peso.
  const internal = zeroCat();
  for (const d of stageDetails) {
    if (!assignedKeys.has(d.key)) addStageToCat(internal, d.cost, pieces);
  }

  // Agrega cada subitem: categorias próprias, horas, cores e uso por máquina.
  const parts = subitemConfigs.map((config) => {
    const own = zeroCat();
    const filaments: FilamentUsage[] = [];
    const usage = new Map<string, MachineUsage>();
    let printHours = 0;
    for (const key of config.stageKeys ?? []) {
      const d = detailByKey.get(key);
      if (!d) continue;
      addStageToCat(own, d.cost, pieces);
      printHours += d.printHours;
      filaments.push(...d.cost.filaments);
      const hours = d.printHours / pieces;
      const depreciation = d.cost.depreciationCost / pieces;
      const prev = usage.get(d.cost.machine.id);
      if (prev) {
        prev.hours += hours;
        prev.depreciation += depreciation;
      } else {
        usage.set(d.cost.machine.id, {
          machineId: d.cost.machine.id,
          machineName: d.cost.machine.name,
          hours,
          depreciation,
        });
      }
    }
    return { config, own, printHours, filaments, usage };
  });

  // Peso = custo de impressão próprio. Guarda contra divisão por zero (tudo
  // interno / sem custo de impressão) → pesos iguais.
  const printingByPart = parts.map((p) => catPrinting(p.own));
  const weightBase = printingByPart.reduce((sum, v) => sum + v, 0);
  const weights =
    weightBase > SUBITEM_EPSILON
      ? printingByPart.map((v) => v / weightBase)
      : parts.map(() => 1 / parts.length);

  // Acessórios atribuídos (100% no subitem) vs. o resto (rateado por peso).
  const assignedByPart = parts.map((p) =>
    accessories
      .filter((a) => a.subitemId && a.subitemId === p.config.id)
      .reduce((sum, a) => sum + num(a.qty) * num(a.unitPrice), 0),
  );
  const assignedTotal = assignedByPart.reduce((sum, v) => sum + v, 0);
  const unassignedAcc = accessoriesCost - assignedTotal;

  const subitems: SubitemPrice[] = parts.map((p, i) => {
    const w = weights[i];
    const material = p.own.material + w * internal.material;
    const energy = p.own.energy + w * internal.energy;
    const depreciation = p.own.depreciation + w * internal.depreciation;
    const maintenance = p.own.maintenance + w * internal.maintenance;
    const labor = p.own.labor + w * internal.labor;
    const failure = w * failureReserve;
    const accessoriesShare = assignedByPart[i] + w * unassignedAcc;
    const fixed = w * fixedCost;
    const varCost =
      material + energy + depreciation + maintenance + labor + failure + accessoriesShare;
    const markup = p.config.markup ?? productMarkup;
    const exactPrice = varCost * markup + fixed; // fixo sem markup (DEC-01)
    const price = roundPrice(exactPrice, roundingMode);
    const costBreakdown: SaleCostBreakdown = {
      material,
      energy,
      depreciation,
      maintenance,
      labor,
      accessories: accessoriesShare,
      failureReserve: failure,
      fixed,
    };
    return {
      id: p.config.id,
      name: p.config.name,
      price,
      exactPrice,
      cost: varCost + fixed,
      markup,
      printHours: p.printHours,
      filaments: mergeFilaments(p.filaments),
      machineUsage: Array.from(p.usage.values()),
      costBreakdown,
    };
  });

  return {
    subitems,
    exactPrice: subitems.reduce((sum, s) => sum + s.exactPrice, 0),
    suggestedPrice: subitems.reduce((sum, s) => sum + s.price, 0),
  };
}
