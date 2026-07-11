import type {
  CapacitySettings,
  FixedCostSettings,
  Machine,
  ProductInput,
} from "./types";

export const ACCENT = "#FF6B35";

// Reserva de falha padrão (%) para produtos sem valor próprio (antigos/importados).
export const DEFAULT_FAILURE_RATE = 5;

// Manutenção padrão (R$/hora) por consumíveis, calibrado com preços REAIS do
// Mercado Livre (jul/2026, cenário genérico/importado): hotend+bico A1 compatível
// R$58-90; placa PEI texturizada 257mm R$68 (China) a ~R$180 (nacional); filtro
// carvão Bambu 3D ~R$40-70/un (vida ~1440h). Com vida útil típica (bico ~1200h,
// placa ~2000-2500h), dá:
//   A1  (aberta, 1 bico):            ~R$0,20/h
//   X2D (fechada, 2 bicos + filtro): ~R$0,40/h
export const DEFAULT_MAINTENANCE_BY_ID: Record<string, number> = {
  a1: 0.2,
  x2d: 0.4,
};
// Fallback para máquina sem valor próprio cujo id não está no mapa acima.
export const DEFAULT_MAINTENANCE_PER_HOUR = 0.5;

export function defaultMaintenanceForId(id: string): number {
  return DEFAULT_MAINTENANCE_BY_ID[id] ?? DEFAULT_MAINTENANCE_PER_HOUR;
}

export const DEFAULT_MACHINES: Machine[] = [
  { id: "a1", name: "A1 Combo", price: 5299, lifeHours: 5000, watts: 95, maintenancePerHour: 0.2 },
  { id: "x2d", name: "X2D Combo", price: 13999, lifeHours: 5000, watts: 150, maintenancePerHour: 0.4 },
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
  failureRate: DEFAULT_FAILURE_RATE,
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
