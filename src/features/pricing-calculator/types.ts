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

// Um filamento/cor consumido numa impressão (FEAT-02). `totalG` é o campo
// CANÔNICO — é o que vale para custo e para a baixa de estoque (passo 8), e já
// inclui torre + purga (o refugo da troca de cor). Model/Purga/Torre são
// detalhe OPCIONAL: quando preenchidos, o form trava `totalG` = model+purga+torre;
// quando ausentes, o usuário digita só o `totalG`. `filamentId` referencia a COR
// cadastrada no Estoque (`StockFilament.id`, estável — ver D2) ou `null` = cor
// avulsa. `id` só existe no estado do formulário (chave de lista) e é descartado
// ao persistir.
export type FilamentUsage = {
  id?: string;
  filamentId: string | null;
  colorName: string;
  pricePerKg: number;
  totalG: number;
  modelG?: number;
  supportG?: number;
  purgedG?: number;
  towerG?: number;
  // D7: material/marca vivem na COR e no SNAPSHOT — nunca no rolo. Preenchidos
  // automaticamente pela cor escolhida (7c) e congelados na venda (8), por cor.
  // É o que permite agrupar "lucro por material" sem consultar a cor viva (que
  // pode ter sido arquivada) nem parsear texto digitado à mão. Ausentes em cor
  // avulsa e em todo dado anterior à 7c.
  material?: string;
  brand?: string;
};

export type PrintStage = {
  id?: string;
  name?: string;
  machineId: string;
  printHours: number;
  energyTariff?: number;
  laborMinutes: number;
  laborRate?: number;
  // FEAT-02: filamentos por cor (mono = array de 1). Fonte da verdade do custo
  // de material. Ausente em etapas legadas → migrado a partir dos escalares
  // abaixo por `normalizeFilaments`.
  filaments?: FilamentUsage[];
  // LEGADO (só-leitura, migração): antes cada etapa tinha um peso/preço únicos.
  // Produtos novos gravam `filaments` e deixam estes ausentes.
  weightG?: number;
  filamentPricePerKg?: number;
};

export type Accessory = {
  id?: string;
  desc: string;
  qty: number;
  unitPrice: number;
  // 7e: liga o acessório a um insumo do estoque (`Supply.id`). Ligado, a
  // produção dá BAIXA por unidade e o custo entra no `frozenCost`; ausente/null
  // é o modo AVULSO — só custo, sem baixa (mesmo caminho do filamento avulso).
  //
  // `desc` e `unitPrice` continuam aqui, denormalizados a partir do insumo no
  // momento em que ele é escolhido: é o mesmo congelamento que o
  // `FilamentUsage.pricePerKg` já faz, e mantém o `calculatePricing` sem
  // precisar conhecer o estoque.
  supplyId?: string | null;
  // FEAT-01: atribuição opcional a um subitem vendável (`Subitem.id`). Quando
  // preenchido, o custo do acessório vai 100% para aquele subitem; quando ausente
  // (null/undefined), fica no nível do produto e é RATEADO entre os subitens.
  subitemId?: string | null;
};

// FEAT-01: um SUBITEM vendável = um grupo de etapas do produto que pode ser
// cotado/vendido à parte (ex.: "peça base" e "adorno" impressos separadamente).
// `stageKeys` referencia as etapas do grupo pela sua identidade estável: a etapa
// principal é a sentinela `"main"`; as etapas extras usam o próprio `PrintStage.id`
// (persistido a partir da FEAT-01). Etapas fora de qualquer subitem = passos
// internos (entram no custo, não vendem sozinhas). `markup` é um override opcional
// por subitem — ausente = herda o markup do produto (botão discreto no form).
export type Subitem = {
  id: string;
  name: string;
  stageKeys: string[];
  markup?: number;
};

export type ProductInput = {
  name: string;
  mainStageName: string;
  printHours: number;
  machineId: string;
  energyTariff: number;
  // FEAT-02: filamentos por cor da ETAPA PRINCIPAL (mono = array de 1). Fonte da
  // verdade do custo de material. Ausente em produtos legados → migrado a partir
  // dos escalares `weightG`/`filamentPricePerKg` por `normalizeFilaments`.
  filaments?: FilamentUsage[];
  // LEGADO (só-leitura, migração): peso/preço únicos da etapa principal.
  weightG?: number;
  filamentPricePerKg?: number;
  laborMinutes: number;
  laborRate: number;
  markup: number;
  // Taxa de falha (%) — reserva embutida no preço para cobrir impressões
  // perdidas (adesão, entupimento, queda de energia...). 0 = sem reserva.
  failureRate: number;
  includeFixed: boolean;
  roundingMode: RoundingMode;
  piecesCount: number;
  stages: PrintStage[];
  accessories: Accessory[];
  // FEAT-01: quando ON, o produto pode ser vendido por SUBITENS (grupos de
  // etapas), não só inteiro. OFF (default) = comportamento de hoje (só inteiro).
  sellBySubitems: boolean;
  subitems: Subitem[];
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
};

// Parte GLOBAL do custo fixo (a "taxa": aluguel/outros/máquinas/horas/dias),
// persistida por negócio no doc `config/negocio` (TD-001). Fica de fora o
// toggle `enabled` do `FixedCostSettings` — esse é POR PRODUTO (gravado em
// `includeFixed` de cada produto).
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
  // Filamentos por cor desta etapa, normalizados (legado migrado). Usado para
  // agregar o consumo por cor no resultado do produto. Com preço VIVO resolvido
  // (7c): quando a cor está ligada ao Estoque, `pricePerKg` já é o do rolo mais
  // novo (D3, catálogo), não o valor salvo.
  filaments: FilamentUsage[];
  // true quando algum filamento aponta para uma COR (`filamentId`) que não existe
  // mais no Estoque e o cálculo caiu no preço salvo de fallback (D3). Molde do
  // `machineMissing`/TD-009: sinaliza dado órfão em vez de mascarar.
  filamentMissing: boolean;
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

// FEAT-01: preço/custo de UM subitem vendável, resultado do rateio ADITIVO
// (Σ subitens = inteiro). Todos os valores monetários são POR UNIDADE (mesma base
// do produto inteiro), exceto `filaments` (pesos por impressão, não divididos por
// peça — é o que a baixa do passo 8 vai deduzir). O rateio distribui passos
// internos, reserva de falha, custo fixo e acessórios não atribuídos pelo peso
// (custo de impressão) de cada subitem; acessório atribuído vai 100% no subitem.
export type SubitemPrice = {
  id: string;
  name: string;
  price: number; // arredondado (roundingMode do produto)
  exactPrice: number; // antes do arredondamento
  cost: number; // custo total por unidade (variável + fixo)
  markup: number; // markup EFETIVO (override do subitem ou o do produto)
  printHours: number; // horas das etapas do subitem (total, como o inteiro)
  filaments: FilamentUsage[]; // cores das etapas do subitem (pesos por impressão)
  machineUsage: MachineUsage[]; // por unidade
  costBreakdown: SaleCostBreakdown; // por unidade, para o snapshot da venda
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
  // FEAT-02: consumo de filamento por cor do produto inteiro (etapa principal +
  // extras), agregado por cor. Pesos POR IMPRESSÃO (o que o spool perde de fato,
  // incluindo torre/purga) — não divididos por peça. mono vs multicolor =
  // `filaments.length`. Alimenta o card informativo e o snapshot congelado da
  // venda; a baixa de estoque (passo 8) consome estes pesos.
  filaments: FilamentUsage[];
  // Repartição por máquina (por unidade), para atribuir horas/vida/lucro à
  // impressora certa quando o produto usa mais de uma.
  machineUsage: MachineUsage[];
  // true quando alguma etapa (principal ou extra) referencia uma máquina que
  // não existe e o cálculo caiu no fallback. A UI usa isso para avisar em vez
  // de mascarar o dado órfão (TD-009). Opcional: ausente em snapshots antigos.
  machineMissing?: boolean;
  // true quando algum filamento aponta para uma COR removida do Estoque (7c). A
  // UI avisa com badge, no mesmo molde do `machineMissing`. Opcional: ausente em
  // snapshots antigos e quando não há nada ligado ao Estoque.
  filamentMissing?: boolean;
  // FEAT-01: preço por subitem (rateio aditivo). Presente só quando o produto tem
  // `sellBySubitems` ligado com subitens válidos; nesse caso `suggestedPrice`/
  // `exactPrice` acima passam a ser a SOMA dos subitens (o inteiro = Σ partes).
  subitems?: SubitemPrice[];
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

// FEAT-06 — composição do custo REAL GASTO, congelada no momento da impressão.
// Espelha `ProductionCostBreakdown` (lib/production) SEM o `total`: ele é
// derivável (`sumFrozen`) e ter dois campos que precisam bater é convite a drift.
// NÃO tem `failureReserve`/`fixed` — são provisões de PREÇO, não gasto; quem as
// carrega é o `SaleCostBreakdown` acima. E o campo é `supplies` (não
// `accessories`): aqui é o que de fato saiu do estoque de insumos via FIFO.
// Invariante: Σ dos 6 campos === o total congelado (`frozenCost`/`unitCost`).
export type FrozenCostBreakdown = {
  material: number;
  energy: number;
  depreciation: number;
  maintenance: number;
  labor: number;
  supplies: number;
};

// Passo 8: origem de reconciliação de UM item vendido. `acabado` = peça pronta,
// decrementa o Estoque de Produtos (FEAT-05) via `consumeFifo` SEM rebaixar
// filamento (o insumo já saiu na produção). `encomenda` = feita sob demanda, cria
// evento(s) de produção (deduz filamento FIFO + horas) que a venda referencia.
export type SaleItemOrigin = "acabado" | "encomenda";

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
  // FEAT-01: qual SUBITEM foi vendido (`Subitem.id`), quando a venda é de uma
  // parte e não do produto inteiro. Ausente = venda do produto inteiro (ou item
  // livre). Informativo aqui; vira a SKU do estoque de acabados no FEAT-05.
  subitemId?: string;
  productName: string;
  machineId: string; // máquina PRINCIPAL (informativa/compat)
  machineName: string;
  printHours: number; // horas TOTAIS (principal + etapas), por unidade
  // Repartição por máquina (por unidade). Presente nas vendas novas; ausente
  // nas antigas (o ROI cai no fallback: tudo na máquina principal acima).
  machineUsage?: MachineUsage[];
  // FEAT-02: consumo de filamento por cor CONGELADO no momento da venda (pesos
  // por impressão, incluindo torre/purga). Presente nas vendas novas; ausente
  // nas antigas (tratadas como monocolor pelo `costBreakdown.material`). É o que
  // a baixa de estoque (passo 8) vai deduzir do spool.
  filaments?: FilamentUsage[];
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
  // Passo 8 — reconciliação. Ausentes nas vendas anteriores ao recurso (não
  // reconciliam nada; o `toSale` as trata como legado). `origem` decide o caminho.
  origem?: SaleItemOrigin;
  // Caminho `acabado`: as camadas drenadas do Estoque de Produtos, para o estorno
  // devolver exatamente o que saiu (editar/excluir o recibo). Espelha o papel do
  // `stockMoves` do filamento, no acabado.
  finishedMoves?: FinishedMove[];
  // Caminho `encomenda`: o(s) evento(s) de produção criados junto da venda (a
  // baixa de filamento + horas mora neles). O estorno apaga-os e reverte o rolo.
  productionEventIds?: string[];
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

// ---------------------------------------------------------------------------
// Estoque (item 3) — modelo híbrido COR + ROLOS (D2). O produto aponta para a
// COR (id estável); os ROLOS vivem dentro dela e são consumidos do mais antigo
// para o mais novo (FIFO), cada um com o preço real pago. Rolo zerado NÃO é
// removido: fica como histórico de compra. A matemática pura vive em
// `lib/stock.ts`; a coleção é `estoque` (um doc por cor).
// ---------------------------------------------------------------------------

// Uma compra: um rolo físico. O preço é o REAL pago neste rolo — é daqui que
// sai tanto o custo de repor (rolo mais novo) quanto o custo real da venda
// (FIFO), os dois preços do D3.
export type FilamentRoll = {
  id: string;
  purchaseDate: number;
  initialG: number; // 1000 normalmente
  remainingG: number; // drena FIFO; o excedente vira NEGATIVO no rolo mais novo (D4)
  pricePerKg: number;
  note?: string; // NF/fornecedor
};

// D6: rastro da contagem de inventário. Contar o rolo e corrigir o saldo não é
// editar `remainingG` na mão — passa por `adjustRoll`, que anexa um destes.
// Guarda `beforeG` E `afterG` porque o delta se deriva mas o inverso não: um
// rastro que só dissesse "−70 g" perderia qual era o furo.
export type StockAdjustment = {
  id: string;
  at: number; // quando a contagem foi feita
  rollId: string; // qual rolo foi contado
  beforeG: number; // o que o sistema achava que tinha (pode ser NEGATIVO — D4)
  afterG: number; // o que foi contado de verdade
  reason: string; // "contagem", "sobrou no bico", "rolo veio com menos"...
};

// A COR — é o que o produto aponta (`FilamentUsage.filamentId`). SEM campo de
// nome: o nome exibido ("PLA Basic · Preto · Bambu") é DERIVADO de
// material+brand+colorName (D8), o que permite agrupar por material sem parsear
// texto. `archived` = "parei de usar essa cor" (raro); NÃO é "o rolo acabou".
export type StockFilamentInput = {
  material: string;
  brand: string;
  colorName: string;
  colorHex?: string;
  minG: number; // alerta de estoque mínimo (0 = sem alerta)
  archived: boolean;
  rolls: FilamentRoll[]; // saldo = Σ remainingG
  adjustments: StockAdjustment[]; // D6
};

export type StockFilamentPayload = StockFilamentInput & { createdAt: number };

export type StockFilament = StockFilamentInput & {
  id: string;
  createdAt: number;
};

// O que a VENDA grava sobre o que deduziu — é de onde o estorno lê (editar um
// recibo de 3 → 2 unidades tem que devolver exatamente o que saiu, por rolo,
// inclusive rolo já zerado/arquivado). Nasce GENÉRICO (`kind`) já aqui, sem uso
// na 7a, para os insumos (7e) não forçarem migração de vendas já gravadas (D1).
// `stockId` é o doc de origem (a cor, ou o insumo na 7e): sem ele o estorno teria
// que varrer todas as cores procurando o `rollId`.
export type StockMove = {
  itemId: string; // item da venda que consumiu (id opaco para o estoque)
  kind: "filament" | "supply";
  stockId: string; // doc da cor (`estoque`) ou do insumo (`insumos`)
  rollId: string; // o rolo — ou o LOTE do insumo (7e), que reusa o mesmo campo
  qty: number; // gramas (filamento) ou unidades (insumo)
};

// Uma fatia do consumo FIFO: quanto saiu de UM rolo, e a que preço. `pricePerKg`
// e `cost` são o preço real daquele rolo — é o que a SaleModal mostra para
// explicar o custo misto (D3: "100 g × R$90 + 50 g × R$110"). O passo 8
// acrescenta `itemId`/`kind` e grava o `StockMove`.
export type ConsumptionMove = {
  stockId: string;
  rollId: string;
  qty: number;
  pricePerKg: number;
  cost: number;
};

// Contrato dos TRÊS consumidores do FIFO: o aviso no form (7c), o custo real da
// venda (8) e a baixa (8). `crossesRoll` = vai atravessar para o próximo rolo
// (D5 informativo: na A1 sem AMS isso é troca manual no meio da impressão);
// `shortfallG` = passou do estoque total da cor (D5 forte / o negativo do D4).
export type ConsumptionResult = {
  moves: ConsumptionMove[];
  cost: number;
  crossesRoll: boolean;
  shortfallG: number;
};

// ---------------------------------------------------------------------------
// Estoque de INSUMOS (7e) — ímã, argola, parafuso, embalagem: tudo que soma ao
// custo sem ser filamento nem hora de máquina. Gêmeo do estoque de filamento
// (mesmo FIFO por lote, de `lib/fifo.ts`), com duas diferenças de vocabulário:
// a unidade é CONTAGEM (não gramas) e o preço é POR UNIDADE (não por kg). Vive
// em coleção própria (`insumos`) — misturar com `estoque` obrigaria um
// discriminador em toda leitura de cor. Matemática pura em `lib/supplies.ts`.
// ---------------------------------------------------------------------------

// Uma compra: um lote com preço real pago. Mesma dupla do D3 que os rolos —
// lote mais novo = custo de repor (catálogo), FIFO = custo real (COGS).
export type SupplyLot = {
  id: string;
  purchaseDate: number;
  initialQty: number;
  remainingQty: number; // drena FIFO; o excedente vira NEGATIVO no lote mais novo (D4)
  unitPrice: number; // R$ por unidade
  note?: string; // NF/fornecedor
};

// D6 para insumo: contagem física com rastro (nunca editar `remainingQty` na
// mão). Guarda `before` E `after` pelo mesmo motivo do `StockAdjustment`.
export type SupplyAdjustment = {
  id: string;
  at: number;
  lotId: string;
  before: number;
  after: number;
  reason: string;
};

// O INSUMO — é o que o acessório do produto aponta (`Accessory.supplyId`).
// Diferente da cor (D8), aqui o nome é um campo mesmo: "ímã 6×2mm" não se deriva
// de atributos. `unit` é rótulo livre ("un", "par", "m") só para a tela.
export type SupplyInput = {
  name: string;
  unit: string;
  minQty: number; // alerta de estoque mínimo (0 = sem alerta)
  archived: boolean;
  lots: SupplyLot[]; // saldo = Σ remainingQty
  adjustments: SupplyAdjustment[];
};

export type SupplyPayload = SupplyInput & { createdAt: number };

export type Supply = SupplyInput & {
  id: string;
  createdAt: number;
};

// Espelho do `ConsumptionMove` em unidades. `cost` é qty × unitPrice (sem a
// divisão por 1000 do filamento).
export type SupplyConsumptionMove = {
  stockId: string;
  lotId: string;
  qty: number;
  unitPrice: number;
  cost: number;
};

// O insumo CONSUMIDO por um evento de produção, congelado (gêmeo do
// `FilamentUsage`). Sem `supplyId` é o acessório AVULSO: entra no custo, mas não
// tem de onde dar baixa — mesmo caminho da cor avulsa.
export type SupplyUsage = {
  supplyId?: string | null;
  name: string;
  qty: number; // unidades TOTAIS do evento
  unitPrice: number; // R$/unidade resolvido no momento (FIFO real ou congelado)
};

export type SupplyConsumptionResult = {
  moves: SupplyConsumptionMove[];
  cost: number;
  crossesLot: boolean;
  shortfall: number; // unidades que passaram do saldo total (D4/D5)
};

// ---------------------------------------------------------------------------
// Produção (FEAT-04) — o evento que gasta filamento + hora. É a PRIMITIVA DE
// BAIXA: toda impressão rodada é registrada aqui, independente de virar venda —
// inclusive teste/falha/brinde, que nunca geram receita e por isso NÃO poderiam
// ter a baixa presa à venda (senão nunca deduziriam, e o estoque físico mentiria).
// A venda (passo 8) deixa de ser o ponto de baixa e vira reconciliação. Coleção
// `producao`; a baixa entra no MESMO `writeBatch` do evento (atômica), reusando
// o FIFO de `lib/stock.ts`. Granularidade = subitem (FEAT-01).
// ---------------------------------------------------------------------------

// Desfecho da impressão (campo obrigatório do evento). Só `estoque` alimenta o
// estoque de acabados (FEAT-05); `encomenda` sai direto para a venda; teste/
// falha/brinde deduzem insumo+hora mas NÃO produzem unidade vendável; `historico`
// é backfill avulso (dado real ≠ reserva de falha do pricing — não misturar).
export type ProductionOutcome =
  | "estoque"
  | "encomenda"
  | "teste"
  | "falha"
  | "brinde"
  | "historico";

// Modo de consumo. `real` deduz dos rolos atuais (FIFO, D3) e grava `stockMoves`
// para o estorno (04c); `historico` são gramas soltas (backfill do histórico das
// máquinas) — NÃO toca rolo nem gera `stockMoves`, e o custo sai do `pricePerKg`
// congelado (mesmo fallback do "Avulso").
export type ProductionMode = "real" | "historico";

// Um evento de produção CONGELADO no momento da impressão (foto, como a venda):
// não referencia o produto vivo. `frozenCost` é o custo de produção do dia
// (material FIFO + energia + depreciação + manutenção + labor); a parcela de
// material sai do FIFO (`planProduction`), o resto do pricing no momento (04b).
export type ProductionInput = {
  at: number; // timestamp (ms) da impressão, editável
  outcome: ProductionOutcome;
  mode: ProductionMode;
  // Referências informativas ao catálogo (a SKU é o subitem do FEAT-01). Ausentes
  // em impressão avulsa/histórica sem produto cadastrado.
  productId?: string;
  subitemId?: string;
  productName: string;
  // Máquina da impressão (04b escolhe uma). 04c lê estas horas para o ROI —
  // migrando a fonte das horas da venda para a produção (casa com TD-003).
  machineId: string;
  machineName: string;
  printHours: number;
  // Cores consumidas, CONGELADAS: pesos por impressão (incluindo torre/purga) e
  // material/marca por cor (D7). `pricePerKg` = o resolvido no momento (custo
  // misto FIFO no modo real; avulso no historico).
  filaments: FilamentUsage[];
  // 7e: insumos consumidos, CONGELADOS (espelha `filaments`). `qty` é o TOTAL do
  // evento (já × peças × placas), não por peça. Ausente em evento antigo e em
  // produto sem acessório.
  supplies?: SupplyUsage[];
  frozenCost: number;
  // FEAT-06: a COMPOSIÇÃO do `frozenCost`, congelada junto. Sem ela o número é
  // irreconstituível depois: material e insumos até sairiam dos arrays acima, mas
  // energia/desgaste/manutenção teriam que ser recalculados da máquina VIVA
  // (editar watts faria os componentes pararem de somar o total gravado) e a mão
  // de obra não está gravada em lugar nenhum do evento. Ausente em evento
  // anterior ao FEAT-06 — a UI cai no total sem detalhe (Diretriz 7, sem migração).
  frozenBreakdown?: FrozenCostBreakdown;
  // O que a baixa deduziu, por rolo — de onde o estorno (04c) lê, exatamente como
  // o `stockMoves` da venda. Vazio no modo historico/avulso (nada foi deduzido).
  // `itemId` = o id do próprio evento (a produção é a unidade que consumiu).
  stockMoves: StockMove[];
  notes?: string;
};

export type ProductionPayload = ProductionInput & { createdAt: number };

export type ProductionEvent = ProductionInput & {
  id: string;
  createdAt: number;
};

// ---------------------------------------------------------------------------
// Estoque de Produtos / acabados (FEAT-05) — a peça JÁ IMPRESSA e ainda não
// vendida, parada na loja. Diferente do estoque de INSUMOS (filamento): aqui a
// unidade é o produto pronto. Encher = produção com desfecho `estoque` (FEAT-04)
// empilha uma camada com o custo CONGELADO da impressão; drenar = venda (passo 8
// — ainda NÃO nesta fase). A SKU é o SUBITEM vendável (FEAT-01): produto com
// subitens guarda saldo por subitem e o "inteiro disponível" é DERIVADO (min das
// partes); produto sem subitens tem uma SKU única (o inteiro). Coleção `acabados`,
// um doc por PRODUTO (id do doc = productId): poucas SKUs por produto, cabem no
// doc e a escrita da baixa da produção fica atômica.
// ---------------------------------------------------------------------------

// Uma CAMADA de produção. Espelha o FilamentRoll, invertido: a produção EMPILHA
// (como a compra de rolo), a venda CONSOME (passo 8). `qty` é o saldo RESTANTE da
// camada (começa = produzido). `unitCost` é o custo de produção congelado por
// unidade — é daqui que sai o COGS da venda, NÃO do preço do dia da venda.
// `sourceEventId` amarra a camada ao evento de produção que a criou: é por ele que
// excluir a produção estorna exatamente esta camada (round-trip, igual aos
// `stockMoves` dos rolos).
export type FinishedLayer = {
  id: string;
  at: number; // quando foi produzida (= evento.at)
  qty: number;
  unitCost: number;
  sourceEventId: string;
};

// Uma SKU do acabado = uma unidade vendável. `subitemId` ausente = o produto
// INTEIRO (produto sem subitens). Saldo = Σ qty das camadas; pode ficar NEGATIVO
// quando a venda drenar mais do que há (D4, mesma política do filamento) — só
// passa a acontecer no passo 8. `name` é o rótulo congelado (subitem ou produto).
export type FinishedSku = {
  subitemId?: string;
  name: string;
  layers: FinishedLayer[];
};

export type FinishedGoodInput = {
  productId: string; // referência ao produto do catálogo (a SKU é o subitem)
  productName: string; // nome do produto congelado (exibição)
  skus: FinishedSku[];
};

export type FinishedGoodPayload = FinishedGoodInput & { createdAt: number };

// O doc do acabado. `id` = `productId` (um doc por produto, id DETERMINÍSTICO — a
// baixa da produção acha o doc do produto sem query).
export type FinishedGood = FinishedGoodInput & { id: string; createdAt: number };

// Uma fatia do consumo FIFO do acabado (passo 8): quanto saiu de UMA camada e a
// que custo congelado. Molde do `ConsumptionMove` do filamento; o passo 8
// acrescenta o que precisar para gravar/estornar a baixa.
export type FinishedMove = {
  productId: string;
  subitemId?: string;
  layerId: string;
  qty: number;
  unitCost: number; // custo congelado da camada consumida
  cost: number; // qty × unitCost (COGS desta fatia)
};

// Resultado de consumir uma SKU (passo 8). `cost` é o COGS total (Σ camadas ×
// custo congelado); `shortfall` = unidades além do saldo (D4 — o negativo do
// acabado, permitido com aviso, nunca truncado).
export type FinishedConsumptionResult = {
  moves: FinishedMove[];
  cost: number;
  shortfall: number;
};
