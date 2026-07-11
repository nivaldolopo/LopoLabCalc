import type {
  CapacitySettings,
  FixedCostSettings,
  Machine,
  ProductInput,
} from "./types";

export const ACCENT = "#FF6B35";

export const DEFAULT_MACHINES: Machine[] = [
  { id: "a1", name: "A1 Combo", price: 5299, lifeHours: 5000, watts: 95 },
  { id: "x2d", name: "X2D Combo", price: 13999, lifeHours: 5000, watts: 150 },
];

export const DEFAULT_FIXED_COSTS: FixedCostSettings = {
  enabled: false,
  rent: 1500,
  other: 0,
  machines: 2,
  hoursDay: 8,
  daysMonth: 26,
  markupOnFixed: false,
};

export const DEFAULT_CAPACITY: CapacitySettings = {
  hoursDay: 20,
  machines: 1,
};

export const DEFAULT_PRODUCT_INPUT: ProductInput = {
  name: "",
  mainStageName: "",
  weightG: 40,
  printHours: 3,
  machineId: "a1",
  filamentPricePerKg: 110,
  energyTariff: 0.8,
  laborMinutes: 10,
  laborRate: 30,
  markup: 3,
  includeFixed: false,
  markupOnFixed: false,
  roundingMode: "exact",
  piecesCount: 1,
  stages: [],
  accessories: [],
  linkModel: "",
  linkCompetitor: "",
  linkFile: "",
  fixedCostPerHour: null,
  combineEnabled: null,
  stage2: null,
};

export const MACHINE_STORAGE_KEY = "calc3d-machines";
export const THEME_STORAGE_KEY = "calc3d-theme";
