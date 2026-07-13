import type {
  FixedCostSettings,
  FixedCostSummary,
  Machine,
  MachineUsage,
  PricingResult,
  PrintStage,
  ProductInput,
  StageCost,
} from "../types";
import { DEFAULT_FAILURE_RATE } from "../constants";
import { roundPrice } from "./roundPrice";
import { num } from "@/lib/number";

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
): StageCost {
  const { machine, found } = findMachine(machines, stage.machineId);
  const materialCost =
    (num(stage.weightG) / 1000) *
    num(stage.filamentPricePerKg);
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
): PricingResult {
  const pieces = Math.max(1, num(product.piecesCount) || 1);
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

  const stagesList = normalizeStages(product);
  let stagesMaterial = 0;
  let stagesEnergy = 0;
  let stagesDepreciation = 0;
  let stagesMaintenance = 0;
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
    stagesMaintenance += cost.maintenanceCost;
    stagesLabor += cost.laborCost;
    stagesHours += num(stage.printHours);
    if (cost.machineMissing) anyMachineMissing = true;
    addUsage(cost.machine, num(stage.printHours), cost.depreciationCost);
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
  const markupOnFixed =
    product.markupOnFixed !== undefined
      ? product.markupOnFixed
      : fixedCosts.markupOnFixed;
  // Preço exato (bruto do cálculo) e preço final arredondado para valor de
  // mercado. Todo o resto (margem, lote, catálogo, capacidade) usa o final.
  const exactPrice = markupOnFixed
    ? totalCost * product.markup
    : variableCost * product.markup + fixedCost;
  const suggestedPrice = roundPrice(exactPrice, product.roundingMode ?? "exact");
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
    machineUsage,
    machineMissing: anyMachineMissing,
  };
}
