export type Machine = {
  id: string;
  name: string;
  price: number;
  lifeHours: number;
  watts: number;
};

export type PrintStage = {
  id?: string;
  name?: string;
  machineId: string;
  weightG: number;
  printHours: number;
  filamentPricePerKg: number;
  energyTariff?: number;
  laborMinutes: number;
  laborRate?: number;
};

export type Accessory = {
  id?: string;
  desc: string;
  qty: number;
  unitPrice: number;
};

export type ProductInput = {
  name: string;
  mainStageName: string;
  weightG: number;
  printHours: number;
  machineId: string;
  filamentPricePerKg: number;
  energyTariff: number;
  laborMinutes: number;
  laborRate: number;
  markup: number;
  includeFixed: boolean;
  markupOnFixed: boolean;
  piecesCount: number;
  stages: PrintStage[];
  accessories: Accessory[];
  linkModel: string;
  linkCompetitor: string;
  linkFile: string;
  fixedCostPerHour?: number | null;
  combineEnabled?: boolean | null;
  stage2?: PrintStage | null;
};

export type SavedProduct = ProductInput & {
  id: string;
  createdAt?: number;
};

export type ProductPayload = ProductInput & {
  createdAt?: number;
};

export type FixedCostSettings = {
  enabled: boolean;
  rent: number;
  other: number;
  machines: number;
  hoursDay: number;
  daysMonth: number;
  markupOnFixed: boolean;
};

export type CapacitySettings = {
  hoursDay: number;
  machines: number;
};

export type StageCost = {
  machine: Machine;
  materialCost: number;
  energyCost: number;
  depreciationCost: number;
  laborCost: number;
};

export type PricingResult = {
  machine: Machine;
  materialCost: number;
  energyCost: number;
  depreciationCost: number;
  laborCost: number;
  accessoriesCost: number;
  fixedCost: number;
  stage2Cost: number;
  stagesCost: number;
  variableCost: number;
  totalCost: number;
  suggestedPrice: number;
  margin: number;
  pieces: number;
  stagesCount: number;
  contributionMargin: number;
};

export type FixedCostSummary = {
  totalFixed: number;
  hoursMonth: number;
  perHour: number;
  perPrint: number;
};

export type CapacityResult = {
  piecesDay: number;
  cyclesDay: number;
  grossDay: number;
  netDay: number;
  piecesMonth: number;
  cyclesMonth: number;
  grossMonth: number;
  netMonth: number;
};

export type CloudStatus = "connecting" | "synced" | "importing" | "error";

export type SortMode =
  | "recent"
  | "oldest"
  | "az"
  | "za"
  | "price-desc"
  | "price-asc";
