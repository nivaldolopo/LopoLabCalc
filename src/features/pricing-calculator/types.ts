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
  // LEGADO: hoje sempre gravados como null. Só são LIDOS para migrar produtos
  // antigos no Firestore (fixedCostPerHour → includeFixed; combineEnabled/stage2
  // → array de etapas, em normalizeStages). Não usar em código novo.
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

// Parte GLOBAL do custo fixo (a "taxa": aluguel/outros/máquinas/horas/dias),
// persistida por negócio no doc `config/negocio` (TD-001). Fica de fora os dois
// toggles `enabled`/`markupOnFixed` do `FixedCostSettings` — esses são POR
// PRODUTO (gravados em `includeFixed`/`markupOnFixed` de cada produto).
export type FixedCostRate = Pick<
  FixedCostSettings,
  "rent" | "other" | "machines" | "hoursDay" | "daysMonth"
>;

export type CapacitySettings = {
  hoursDay: number;
  machines: number;
};

export type StageCost = {
  machine: Machine;
  // true quando o machineId da etapa não existe na lista de máquinas e o
  // cálculo caiu no fallback (1ª máquina). Sinaliza dado órfão em vez de
  // mascarar em silêncio (ver TD-009).
  machineMissing: boolean;
  materialCost: number;
  energyCost: number;
  depreciationCost: number;
  maintenanceCost: number;
  laborCost: number;
};

// Repartição do uso de impressora de um produto (valores POR UNIDADE). Uma
// entrada por máquina que participou (etapa principal + etapas extras, somadas
// por máquina). É o que permite atribuir horas, vida útil e lucro à impressora
// certa quando um produto usa mais de uma máquina em partes diferentes.
export type MachineUsage = {
  machineId: string;
  machineName: string;
  hours: number; // horas de impressão nesta máquina (por unidade)
  depreciation: number; // depreciação embutida desta máquina (R$, por unidade)
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
  stagesCost: number;
  variableCost: number;
  totalCost: number;
  suggestedPrice: number;
  exactPrice: number;
  margin: number;
  pieces: number;
  stagesCount: number;
  contributionMargin: number;
  // Repartição por máquina (por unidade), para atribuir horas/vida/lucro à
  // impressora certa quando o produto usa mais de uma.
  machineUsage: MachineUsage[];
  // true quando alguma etapa (principal ou extra) referencia uma máquina que
  // não existe e o cálculo caiu no fallback. A UI usa isso para avisar em vez
  // de mascarar o dado órfão (TD-009). Opcional: ausente em snapshots antigos.
  machineMissing?: boolean;
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
  // Se o custo fixo entrou no totalCost (toggle ligado). Define se o "líquido"
  // é lucro de verdade ("Lucro") ou apenas contribuição ("Contribuição").
  fixedIncluded: boolean;
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

// Taxa (%) cobrada por forma de pagamento (maquininha/gateway). Ex.: crédito
// come ~4,5%, Pix/dinheiro 0%. Config global, guardada em `config/taxas`.
export type PaymentFeeSettings = Record<PaymentMethod, number>;

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
  machineId: string; // máquina PRINCIPAL (informativa/compat)
  machineName: string;
  printHours: number; // horas TOTAIS (principal + etapas), por unidade
  // Repartição por máquina (por unidade). Presente nas vendas novas; ausente
  // nas antigas (o ROI cai no fallback: tudo na máquina principal acima).
  machineUsage?: MachineUsage[];
  quantity: number;
  suggestedPrice: number; // unitário, o que a calculadora sugeria
  salePrice: number; // unitário, o preço real cobrado ao cliente (editável)
  unitCost: number; // custo total por peça
  costBreakdown: SaleCostBreakdown; // por unidade
  totalCost: number; // unitCost × quantity
  totalRevenue: number; // salePrice × quantity (o que o cliente paga)
  // Taxa da forma de pagamento congelada no momento da venda. `feeRate` é o
  // percentual (ex.: 4.5); `feeAmount` é o valor absoluto descontado (R$) no
  // total do item; `feePassedToCustomer` indica se o preço já foi inflado para
  // repassar a taxa ao cliente (true) ou se você a absorveu (false).
  feeRate: number;
  feeAmount: number;
  feePassedToCustomer: boolean;
  profit: number; // LÍQUIDO da taxa: totalRevenue − totalCost − feeAmount
  margin: number; // profit / totalRevenue (%)
};

export type SalePayload = SaleInput & { createdAt: number };

export type Sale = SaleInput & { id: string; createdAt: number };

// Upsert de um item de recibo: sem `id` = criar um doc novo; com `id` = atualizar
// o doc existente. Usado ao gravar/editar um recibo inteiro de uma vez (batch).
export type ReciboUpsert = { id?: string; payload: SalePayload };

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
