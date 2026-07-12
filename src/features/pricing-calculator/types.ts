import type { RoundingMode } from "./lib/roundPrice";

export type { RoundingMode };

export type Machine = {
  id: string;
  name: string;
  price: number;
  lifeHours: number;
  watts: number;
  // Custo de manutenção por hora (bicos, hotend, placa, correias, graxa...).
  // Separado da depreciação (price/lifeHours = compra da máquina).
  maintenancePerHour: number;
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
  // Taxa de falha (%) — reserva embutida no preço para cobrir impressões
  // perdidas (adesão, entupimento, queda de energia...). 0 = sem reserva.
  failureRate: number;
  includeFixed: boolean;
  markupOnFixed: boolean;
  roundingMode: RoundingMode;
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
  maintenanceCost: number;
  laborCost: number;
};

export type PricingResult = {
  machine: Machine;
  materialCost: number;
  energyCost: number;
  depreciationCost: number;
  maintenanceCost: number;
  laborCost: number;
  accessoriesCost: number;
  // Reserva de falha (valor absoluto embutido no custo variável).
  failureReserve: number;
  fixedCost: number;
  stage2Cost: number;
  stagesCost: number;
  variableCost: number;
  totalCost: number;
  suggestedPrice: number;
  exactPrice: number;
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

// ---------------------------------------------------------------------------
// Vendas (histórico) — cada registro é uma FOTO CONGELADA no momento da venda.
// Não referencia o produto vivo: se um valor mudar depois na calculadora, o
// registro da venda continua com o custo/preço que valiam quando foi vendido.
// ---------------------------------------------------------------------------

export type PaymentMethod = "dinheiro" | "pix" | "debito" | "credito" | "outro";

export type SaleChannel = "quiosque" | "online" | "encomenda" | "outro";

// Detalhamento do custo (por unidade), congelado. Guardado inteiro para o
// dashboard futuro (lucro por material, custo por categoria) já nascer pronto.
export type SaleCostBreakdown = {
  material: number;
  energy: number;
  depreciation: number;
  maintenance: number;
  labor: number;
  accessories: number;
  failureReserve: number;
  fixed: number;
};

export type SaleInput = {
  // Agrupa itens de uma mesma compra/recibo. Na fase 1a cada venda tem o seu;
  // a fase 1b (cesta) reaproveita este campo para juntar vários produtos.
  reciboId: string;
  saleDate: number; // timestamp (ms) da venda, editável
  customer: string;
  material: string;
  paymentMethod: PaymentMethod;
  channel: SaleChannel;
  notes: string;
  status: "concluida";
  // Snapshot congelado do produto/precificação:
  productId: string; // referência (informativa) ao produto do catálogo
  productName: string;
  machineId: string;
  machineName: string;
  printHours: number;
  quantity: number;
  suggestedPrice: number; // unitário, o que a calculadora sugeria
  salePrice: number; // unitário, o preço real cobrado (editável no registro)
  unitCost: number; // custo total por peça
  costBreakdown: SaleCostBreakdown; // por unidade
  totalCost: number; // unitCost × quantity
  totalRevenue: number; // salePrice × quantity
  profit: number;
  margin: number;
};

export type SalePayload = SaleInput & { createdAt: number };

export type Sale = SaleInput & { id: string; createdAt: number };

// ---------------------------------------------------------------------------
// Orçamento (item 2) — geração de PDF avulso. Os dados do negócio ficam no
// Firestore (doc config/orcamento), compartilhados entre dispositivos. Cada
// orçamento gerado também é salvo no histórico (coleção `orcamentos`), para ser
// re-baixado idêntico depois; a numeração é derivada desse histórico (sem
// contador separado — o próximo nº é o maior existente + 1).
// ---------------------------------------------------------------------------

export type QuoteBusiness = {
  name: string;
  phone: string; // telefone / WhatsApp
  email: string;
  instagram: string;
};

// Um item do orçamento, congelado no registro do histórico.
export type QuoteItemSnapshot = {
  description: string;
  quantity: number;
  unitPrice: number;
};

// Orçamento salvo no histórico (coleção `orcamentos`). Guarda também os dados do
// negócio no momento da emissão, para o PDF ser re-baixado idêntico depois.
export type QuoteRecordInput = {
  number: string; // número exibido, ex.: "0001"
  numberValue: number; // numérico, para ordenar e calcular o próximo
  customer: string;
  date: number; // timestamp (ms) do orçamento
  validityDays: number;
  items: QuoteItemSnapshot[];
  notes: string;
  business: QuoteBusiness;
  total: number;
};

export type QuoteRecordPayload = QuoteRecordInput & { createdAt: number };

export type QuoteRecord = QuoteRecordInput & { id: string; createdAt: number };
