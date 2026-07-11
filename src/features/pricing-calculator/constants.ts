import type {
  CapacitySettings,
  FixedCostSettings,
  Machine,
  PaymentMethod,
  ProductInput,
  SaleChannel,
} from "./types";

export const ACCENT = "#FF6B35";

// Reserva de falha padrão (%) para produtos sem valor próprio (antigos/importados).
// Baseado em benchmarks reais: <5% = "excelente", 5-10% = hobbyista típico; Bambu
// bem calibrada ~2%; operador experiente <5% (muitas vezes <1% em peças simples).
// Caso aqui (Bambu + PLA + experiente): 3% central, com pequena folga p/ modelos
// complexos/suporte. Editável por produto. O número exato só sai medindo o próprio
// (peças falhas ÷ total).
export const DEFAULT_FAILURE_RATE = 3;

// Manutenção padrão (R$/hora) por consumíveis. Preços REAIS do Mercado Livre e
// vida útil de relatos REAIS do fórum Bambu (uso PLA/ABS, NÃO-abrasivo):
//   - bico/hotend A1 compatível R$58-90; relatos de 1000-1400h+ ainda ok → uso 2000h
//   - placa PEI texturizada 257mm ~R$150; relatos de 1500-5000h → uso 3000h (dupla face)
//   - filtro carvão (só X2D, fechada) ~R$60, vida 1440h (spec Bambu)
// Resulta: A1 ~R$0,12/h; X2D (2 bicos + filtro) ~R$0,20/h. Inclui pequena folga p/
// imprevistos (bico entupido, placa riscada em crash). Abrasivo (fibra de carbono)
// encurtaria muito a vida do bico — não é o caso aqui.
export const DEFAULT_MAINTENANCE_BY_ID: Record<string, number> = {
  a1: 0.12,
  x2d: 0.2,
};
// Fallback para máquina sem valor próprio cujo id não está no mapa acima.
export const DEFAULT_MAINTENANCE_PER_HOUR = 0.5;

export function defaultMaintenanceForId(id: string): number {
  return DEFAULT_MAINTENANCE_BY_ID[id] ?? DEFAULT_MAINTENANCE_PER_HOUR;
}

export const DEFAULT_MACHINES: Machine[] = [
  { id: "a1", name: "A1 Combo", price: 5299, lifeHours: 5000, watts: 95, maintenancePerHour: 0.12 },
  { id: "x2d", name: "X2D Combo", price: 13999, lifeHours: 5000, watts: 150, maintenancePerHour: 0.2 },
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

// Opções de forma de pagamento e canal usadas no registro de venda.
export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "debito", label: "Cartão de débito" },
  { value: "credito", label: "Cartão de crédito" },
  { value: "outro", label: "Outro" },
];

export const SALE_CHANNELS: { value: SaleChannel; label: string }[] = [
  { value: "quiosque", label: "Quiosque" },
  { value: "online", label: "Online" },
  { value: "encomenda", label: "Encomenda" },
  { value: "outro", label: "Outro" },
];

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = "pix";
export const DEFAULT_SALE_CHANNEL: SaleChannel = "quiosque";
