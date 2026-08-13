import type {
  CardBrandTier,
  FixedCostSettings,
  Machine,
  PaymentFeeSettings,
  PaymentMethod,
  ProductInput,
  QuoteBusiness,
  SaleChannel,
} from "./types";

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

// Máquinas padrão. Todos os campos abaixo foram AUDITADOS por pesquisa (jul/2026):
//
// • price (depreciação) — preço REAL de tabela no Brasil: A1 Combo R$5.299 (lojas
//   oficiais; ~R$4.769 no Pix) e X2D Combo R$13.999 (3D Fila/GTMax/ML). Batem.
//
// • lifeHours (depreciação: preço ÷ lifeHours = custo/hora) — só a parte ESTRUTURAL/
//   econômica; consumíveis (bico, placa PEI, filtro) entram à parte em
//   maintenancePerHour, então NÃO limitam este número. FDM de consumo dura
//   ~5.000–10.000h antes de revisão maior (profissional >15.000h); peças estruturais
//   das Bambu vão além (motores >10.000h).
//   DEC-02 (dono, 2026-08-13): 7.500h, o MEIO da faixa. O raciocínio acima segue
//   valendo — com os consumíveis cobrados à parte, a vida estrutural deve mesmo ser
//   maior que as 5.000h das calculadoras de referência —, mas as 10.000h anteriores
//   eram o EXTREMO dele, não o centro: deixavam a A1 a R$0,65/h (depreciação +
//   manutenção) contra R$1,06/h da referência, −39%. A 7.500h dá R$0,83/h, e o
//   cenário base (40g/3h/A1) sobe R$35,81 → R$37,45 (+4,6%) isoladamente.
//   ⚠ Este valor só SEMEIA o doc `config/machines`. As máquinas já cadastradas
//   guardam o próprio lifeHours — mudar aqui não mexe nelas (editar em /máquinas).
//
// • watts (energia: horas × watts/1000 × tarifa) — MÉDIA durante a impressão de PLA,
//   NÃO o pico de aquecimento (rótulo do X2D diz 1600W, mas isso é rajada de 3-5 min
//   de mesa/câmara). Média medida real: A1 ~70-95W (câmara aberta, PLA); classe
//   fechada (P1/X2D com câmara DESLIGADA p/ PLA) ~100-150W. Os 95W/150W ficam no
//   TOPO da faixa → levemente conservadores (superestimam pouco a energia; nunca
//   subprecificam). Energia é componente pequeno do custo, então o impacto é de
//   centavos. Câmara aquecida (ABS/PC) puxaria muito mais — não é o caso (quase só PLA).
export const DEFAULT_MACHINES: Machine[] = [
  { id: "a1", name: "A1 Combo", price: 5299, lifeHours: 7500, watts: 95, maintenancePerHour: 0.12 },
  { id: "x2d", name: "X2D Combo", price: 13999, lifeHours: 7500, watts: 150, maintenancePerHour: 0.2 },
];

export const DEFAULT_FIXED_COSTS: FixedCostSettings = {
  enabled: false,
  rent: 1500,
  other: 150,
  machines: 2,
  hoursDay: 20,
  daysMonth: 26,
};

// TD-010 (2026-08-13): o antigo `DEFAULT_CAPACITY` foi REMOVIDO. Ele era o
// literal que fazia a calculadora projetar 1 máquina enquanto o /catalogo e o
// rateio do custo fixo usavam o rate salvo (2) — duas fontes de verdade. Hoje as
// duas páginas derivam a capacidade de `config/negocio` (useBusinessSettings).

// Valores iniciais de um produto novo. weightG/printHours/laborMinutes são só
// placeholders (o usuário informa por produto). Os defaults abaixo foram auditados:
// • filamentPricePerKg 110 — PLA no Brasil (jul/2026) custa R$80–130/kg; premium
//   (Voolt/Slim/3DFila) ~R$105–128. R$110 é o centro do mercado. ✓
// • energyTariff 0,80 R$/kWh — revisado (TD-012, ago/2026): a média nacional
//   residencial projetada pela ANEEL para o fim de 2026 é ~R$0,849/kWh (faixa
//   larga por região), então R$0,80 está um pouco ABAIXO dela — não acima, como
//   dizia o comentário antigo (~R$0,68). O valor FICA: energia é ~1,9% do custo e
//   subir para R$0,95 move o cenário base em ~R$0,13. Ideal segue o mesmo: o
//   usuário põe o valor da PRÓPRIA conta de luz (com ICMS/PIS-COFINS + bandeira).
// • markup 3 (3×) e laborRate 30 R$/h são DECISÕES de negócio, não "fatos" — 2–4× é
//   a faixa típica de markup em impressão 3D; ambos editáveis.
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
  roundingMode: "exact",
  piecesCount: 1,
  stages: [],
  accessories: [],
  sellBySubitems: false,
  subitems: [],
  linkModel: "",
  linkCompetitor: "",
  linkFile: "",
  fixedCostPerHour: null,
  combineEnabled: null,
  stage2: null,
};

export const MACHINE_STORAGE_KEY = "calc3d-machines";
export const THEME_STORAGE_KEY = "calc3d-theme";

// E-mails Google autorizados a acessar o app. A tela de login barra os demais,
// e as Regras do Firestore (no Console) devem repetir esta lista para valer de
// verdade no banco. Tudo em minúsculo — a checagem normaliza o e-mail.
export const ALLOWED_EMAILS = [
  "nivaldo.lopo@gmail.com",
  "lopolab3d@gmail.com",
  "joao.zarbielli@gmail.com",
];

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

// Máximo de parcelas oferecidas no crédito (o dono parcela até 3x). Define o
// tamanho do vetor `credito` de cada bandeira: [à vista, 2x, 3x].
export const MAX_INSTALLMENTS = 3;

// Grupos de bandeira selecionáveis na venda e no editor de taxas.
export const CARD_BRAND_TIERS: { value: CardBrandTier; label: string }[] = [
  { value: "visamaster", label: "Visa / Mastercard" },
  { value: "amexelo", label: "Amex / Elo" },
];

export const DEFAULT_CARD_BRAND_TIER: CardBrandTier = "visamaster";

// Taxas padrão (%) — editáveis no app (doc config/taxas). Valores REAIS da
// maquininha do dono (ago/2026): Pix isento; Visa/Master mais baratas que Amex/Elo;
// crédito sobe a cada parcela. O dono ajusta se a adquirente repactuar.
export const DEFAULT_PAYMENT_FEES: PaymentFeeSettings = {
  pix: 0,
  dinheiro: 0,
  outro: 0,
  card: {
    visamaster: { debito: 1.36, credito: [3.14, 5.38, 6.11] },
    amexelo: { debito: 2.57, credito: [4.9, 6.46, 7.19] },
  },
};

// Orçamento (PDF). Dados do negócio começam com o nome e vazios no contato —
// o usuário preenche uma vez e fica salvo no Firestore (portátil entre aparelhos).
export const DEFAULT_QUOTE_BUSINESS: QuoteBusiness = {
  name: "Lopo Lab",
  phone: "",
  email: "",
  instagram: "",
};

export const DEFAULT_QUOTE_VALIDITY_DAYS = 7;
