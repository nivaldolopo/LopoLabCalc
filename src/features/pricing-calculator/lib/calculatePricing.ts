import type {
  FixedCostSettings,
  FixedCostSummary,
  Machine,
  PricingResult,
  PrintStage,
  ProductInput,
  StageCost,
} from "../types";

function numberOrZero(value: number | undefined | null): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function findMachine(machines: Machine[], machineId: string): Machine {
  return machines.find((machine) => machine.id === machineId) ?? machines[0];
}

export function normalizeStages(product: ProductInput): PrintStage[] {
  if (product.stages?.length) return product.stages;
  if (product.combineEnabled && product.stage2) return [product.stage2];
  return [];
}

export function calculateFixedCostPerHour(settings: FixedCostSettings): number {
  const totalFixed = numberOrZero(settings.rent) + numberOrZero(settings.other);
  const machinesCount = Math.max(1, numberOrZero(settings.machines) || 1);
  const hoursMonth =
    numberOrZero(settings.hoursDay) *
    numberOrZero(settings.daysMonth) *
    machinesCount;

  return hoursMonth > 0 ? totalFixed / hoursMonth : 0;
}

export function calculateFixedCostSummary(
  settings: FixedCostSettings,
  printHours: number,
): FixedCostSummary {
  const totalFixed = numberOrZero(settings.rent) + numberOrZero(settings.other);
  const machinesCount = Math.max(1, numberOrZero(settings.machines) || 1);
  const hoursMonth =
    numberOrZero(settings.hoursDay) *
    numberOrZero(settings.daysMonth) *
    machinesCount;
  const perHour = hoursMonth > 0 ? totalFixed / hoursMonth : 0;

  return {
    totalFixed,
    hoursMonth,
    perHour,
    perPrint: perHour * numberOrZero(printHours),
  };
}

export function calculateStageCost(
  stage: PrintStage,
  machines: Machine[],
  fallbackEnergyTariff: number,
  fallbackLaborRate: number,
): StageCost {
  const machine = findMachine(machines, stage.machineId);
  const materialCost =
    (numberOrZero(stage.weightG) / 1000) *
    numberOrZero(stage.filamentPricePerKg);
  const energyCost =
    numberOrZero(stage.printHours) *
    (numberOrZero(machine.watts) / 1000) *
    numberOrZero(stage.energyTariff ?? fallbackEnergyTariff);
  const depreciationCost =
    machine.lifeHours > 0
      ? (numberOrZero(machine.price) / machine.lifeHours) *
        numberOrZero(stage.printHours)
      : 0;
  const laborCost =
    (numberOrZero(stage.laborMinutes) / 60) *
    numberOrZero(stage.laborRate ?? fallbackLaborRate);

  return { machine, materialCost, energyCost, depreciationCost, laborCost };
}

export function calculatePricing(
  product: ProductInput,
  machines: Machine[],
  fixedCosts: FixedCostSettings,
): PricingResult {
  const pieces = Math.max(1, numberOrZero(product.piecesCount) || 1);
  const mainStage = calculateStageCost(
    {
      machineId: product.machineId,
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
  );

  const stagesList = normalizeStages(product);
  let stagesMaterial = 0;
  let stagesEnergy = 0;
  let stagesDepreciation = 0;
  let stagesLabor = 0;
  let stagesHours = 0;

  stagesList.forEach((stage) => {
    const cost = calculateStageCost(
      stage,
      machines,
      product.energyTariff,
      product.laborRate,
    );
    stagesMaterial += cost.materialCost;
    stagesEnergy += cost.energyCost;
    stagesDepreciation += cost.depreciationCost;
    stagesLabor += cost.laborCost;
    stagesHours += numberOrZero(stage.printHours);
  });

  // Os custos das etapas extras entram nas MESMAS categorias da etapa principal
  // (filamento -> material, tempo -> energia/desgaste, mão de obra -> labor),
  // em vez de ficarem num balde "Etapas" separado.
  const materialCost = (mainStage.materialCost + stagesMaterial) / pieces;
  const energyCost = (mainStage.energyCost + stagesEnergy) / pieces;
  const depreciationCost =
    (mainStage.depreciationCost + stagesDepreciation) / pieces;
  const laborCost = (mainStage.laborCost + stagesLabor) / pieces;
  // Subtotal informativo: quanto do custo vem das etapas extras (usado no CSV).
  const stagesCost =
    (stagesMaterial + stagesEnergy + stagesDepreciation + stagesLabor) / pieces;

  const accessoriesCost = (product.accessories ?? []).reduce(
    (sum, accessory) =>
      sum +
      numberOrZero(accessory.qty) * numberOrZero(accessory.unitPrice),
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
    (fixedCostPerHour * (numberOrZero(product.printHours) + stagesHours)) /
    pieces;

  const variableCost =
    materialCost + energyCost + depreciationCost + laborCost + accessoriesCost;
  const totalCost = variableCost + fixedCost;
  const markupOnFixed =
    product.markupOnFixed !== undefined
      ? product.markupOnFixed
      : fixedCosts.markupOnFixed;
  const suggestedPrice = markupOnFixed
    ? totalCost * product.markup
    : variableCost * product.markup + fixedCost;
  const contributionPrice = markupOnFixed
    ? variableCost * product.markup
    : suggestedPrice - fixedCost;
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
    laborCost,
    accessoriesCost,
    fixedCost,
    stage2Cost: stagesCost,
    stagesCost,
    variableCost,
    totalCost,
    suggestedPrice,
    margin,
    pieces,
    stagesCount: stagesList.length,
    contributionMargin,
  };
}
