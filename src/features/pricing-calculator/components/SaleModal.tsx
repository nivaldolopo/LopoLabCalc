"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Boxes, Plus, Trash2 } from "lucide-react";
import { guardOnline } from "@/lib/errors";
import { formatCurrency } from "@/lib/formatting/currency";
import {
  toDateInput,
  todayInputValue,
  toTimestamp,
} from "@/lib/formatting/date";
import { round2 } from "@/lib/number";
import {
  CARD_BRAND_TIERS,
  DEFAULT_CARD_BRAND_TIER,
  DEFAULT_PAYMENT_METHOD,
  DEFAULT_SALE_CHANNEL,
  MAX_INSTALLMENTS,
  PAYMENT_METHODS,
  SALE_CHANNELS,
} from "../constants";
import { newProductionId } from "@/lib/firebase/productionRepository";
import type { ReciboWrite } from "@/lib/firebase/salesRepository";
import { CostDetail } from "./CostDetail";
import {
  assemblableWholes,
  colorEntriesOf,
  colorRecordOf,
  colorsWithBalance,
  partBalance,
  WHOLE_PART_KEY,
} from "../lib/finishedGoods";
import {
  freezeFilaments,
  materialsLabel,
  NO_COLOR_KEY,
} from "../lib/filaments";
import {
  apportionDiscount,
  discountAmountOf,
  resolveFeeRate,
  saleItemFinancials,
} from "../lib/paymentFees";
import {
  planReciboReconciliation,
  reconcileReciboWrite,
  type OldReciboState,
  type ReconItem,
} from "../lib/saleReconciliation";
import {
  chargedWithFee,
  type SaleModalContext,
} from "../lib/saleContext";
import { marginTierClass, marginTierTitle } from "../lib/marginTier";
import { Modal } from "./Modal";
import { NumberInput } from "./NumberInput";
import type {
  CardBrandTier,
  Discount,
  DiscountKind,
  FinishedColorEntry,
  FinishedGood,
  FinishedMove,
  FixedCostSettings,
  Machine,
  PaymentFeeSettings,
  PaymentMethod,
  ProductionEvent,
  ReciboUpsert,
  SaleChannel,
  SaleItemOrigin,
  SalePayload,
  SavedProduct,
  StockFilament,
  Supply,
} from "../types";

// Um item já salvo de um recibo, para o modo edição. `source` é reconstruído a
// partir do snapshot congelado da venda (custo/preço não mudam ao editar).
export type SaleModalEditItem = {
  id: string;
  source: SaleModalContext;
  productName: string;
  quantity: number;
  salePrice: number;
  createdAt: number;
  // FEAT-09: desconto congelado desta linha (para reabrir a venda sem perder).
  discountKind?: DiscountKind;
  discountInput?: Discount;
  discountAmount?: number;
  // Passo 8: reconciliação da venda salva, para o estorno-e-reaplicação da edição.
  origem?: SaleItemOrigin;
  finishedMoves?: FinishedMove[];
  // FEAT-11: as cores escolhidas na venda salva — voltam para a linha para a
  // reedição reaplicar a baixa na MESMA prateleira de onde saiu.
  finishedColors?: FinishedColorEntry[];
  productionEventIds?: string[];
};

// Recibo existente aberto para edição (campos compartilhados + itens salvos).
export type EditReciboSeed = {
  reciboId: string;
  customer: string;
  saleDate: number;
  paymentMethod: PaymentMethod;
  // Bandeira/parcela do recibo salvo (só em cartão) — restauradas ao reabrir.
  cardBrandTier?: CardBrandTier;
  installments?: number;
  channel: SaleChannel;
  feePassedToCustomer: boolean;
  notes: string;
  items: SaleModalEditItem[];
};

// Um item da cesta: a foto (source) congelada + o que o usuário edita na venda.
// `id`/`createdAt` só existem para itens já salvos (modo edição).
type CestaItem = {
  key: string;
  id?: string;
  createdAt?: number;
  source: SaleModalContext;
  productName: string;
  quantity: number;
  salePrice: number;
  // FEAT-09: desconto DESTA linha (só usado no modo "por item"; no modo "total" o
  // desconto vive em `totalDiscount` e é rateado). Ausente = linha sem desconto.
  discount?: Discount;
  // Passo 8: caminho de reconciliação deste item (default por saldo do acabado).
  origem: SaleItemOrigin;
  // FEAT-11: cor ESCOLHIDA à mão para cada parte (chave = subitemId ou
  // `WHOLE_PART_KEY`). Guarda só o que o dono escolheu — o default (cor de maior
  // saldo) é DERIVADO na hora de usar. Sem isso, o modal teria que reescrever o
  // estado quando os acabados chegassem do Firestore (o mesmo bug assíncrono que
  // o `touchedOrigem` conserta para a origem).
  colors?: Record<string, string>;
};

// FEAT-09: qual modo de desconto está ativo no recibo (XOR — nunca os dois).
type DiscountMode = "none" | "item" | "total";
const ZERO_DISCOUNT: Discount = { mode: "abs", value: 0 };

type SaleModalProps = {
  // Produto que abriu o modal (do card ou do catálogo) — vira o 1º item.
  // null/ausente quando o recibo começa vazio ("Nova venda"): usuário adiciona
  // itens pelo seletor do catálogo.
  seed?: SaleModalContext | null;
  // Recibo já existente aberto para edição. Quando presente, o modal entra em
  // modo edição (grava sobre os mesmos docs em vez de criar um recibo novo).
  editRecibo?: EditReciboSeed | null;
  // Demais produtos do catálogo, para adicionar mais itens ao mesmo recibo.
  catalogItems: SaleModalContext[];
  // Taxas por forma de pagamento (config global) + callback para editá-las ali.
  fees: PaymentFeeSettings;
  onFeesChange?: (fees: PaymentFeeSettings) => void;
  // Passo 8: dados vivos para a reconciliação (custo real + baixa por caminho).
  goods: FinishedGood[];
  stock: StockFilament[];
  // 7e: insumos, para a encomenda dar baixa dos acessórios ligados.
  supplies: Supply[];
  products: SavedProduct[];
  machines: Machine[];
  fixedCosts: FixedCostSettings;
  // Eventos de produção — para resolver os `stockMoves` das encomendas do recibo
  // antigo ao editar (o doc da venda só guarda os `productionEventIds`).
  production: ProductionEvent[];
  onClose: () => void;
  // Recebe o plano de escrita atômico completo (vendas + producao + estoque +
  // acabados). O call site liga em `reconcileRecibo`.
  onConfirm: (write: ReciboWrite) => Promise<void>;
};

// Percentual enxuto (4.5 → "4,5", 2 → "2") para rótulos de taxa.
function formatDecimalPct(value: number): string {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });
}

// FEAT-09: campo de desconto (número + alternância R$/%). O `mode` decide o passo
// e como o valor é interpretado no cálculo (valor absoluto ou percentual).
function DiscountInput({
  value,
  onChange,
}: {
  value: Discount;
  onChange: (discount: Discount) => void;
}) {
  return (
    <div className="discount-input">
      <NumberInput
        className="field-input"
        aria-label="Valor do desconto"
        min={0}
        step={value.mode === "pct" ? "0.1" : "0.01"}
        value={value.value}
        onChange={(v) => onChange({ ...value, value: v })}
      />
      <div className="discount-unit-toggle">
        <button
          type="button"
          className={value.mode === "abs" ? "on" : ""}
          onClick={() => onChange({ ...value, mode: "abs" })}
        >
          R$
        </button>
        <button
          type="button"
          className={value.mode === "pct" ? "on" : ""}
          onClick={() => onChange({ ...value, mode: "pct" })}
        >
          %
        </button>
      </div>
    </div>
  );
}

let itemSeq = 0;
function itemFromContext(
  source: SaleModalContext,
  origem: SaleItemOrigin,
): CestaItem {
  itemSeq += 1;
  return {
    key: `item_${Date.now()}_${itemSeq}`,
    source,
    productName: source.defaultProductName,
    quantity: 1,
    salePrice: round2(source.suggestedPrice),
    origem,
  };
}

export function SaleModal({
  seed,
  editRecibo,
  catalogItems,
  fees,
  onFeesChange,
  goods,
  stock,
  supplies,
  products,
  machines,
  fixedCosts,
  production,
  onClose,
  onConfirm,
}: SaleModalProps) {
  const fieldId = useId();
  const isEdit = Boolean(editRecibo);

  // Saldo do acabado (a SKU = o subitem) deste item, e o caminho default: peça
  // pronta quando há saldo, senão encomenda (decisão do dono — por item).
  // BUG-05: o INTEIRO de um produto que vende por partes não tem SKU própria — o
  // saldo é quantos conjuntos dá para montar (min das partes), casando com a baixa
  // do `consumeWholeFifo` na reconciliação.
  function balanceForItem(source: SaleModalContext): number {
    const good = goods.find((g) => g.productId === source.productId);
    if (!source.subitemId) {
      const product = products.find((p) => p.id === source.productId);
      if (product?.sellBySubitems && product.subitems.length > 0) {
        return assemblableWholes(good, product.subitems.map((s) => s.id));
      }
    }
    // FEAT-11: o saldo da peça soma TODAS as cores — ter 2 azuis e 1 preto são 3
    // peças na prateleira. A cor decide de onde tirar, não quantas existem.
    return partBalance(good, source.subitemId);
  }

  // ---------------------------------------------------------------------------
  // FEAT-11 — a cor de cada peça na baixa do acabado
  // ---------------------------------------------------------------------------

  // As PARTES que uma venda de peça pronta drena: os subitens (venda do conjunto)
  // ou a peça única. Cada uma escolhe a sua cor — um conjunto pode ser corpo azul
  // + tampa vermelha de projeto.
  function partsOf(source: SaleModalContext): { key: string; name: string }[] {
    if (source.subitemId) return [{ key: source.subitemId, name: "" }];
    const product = products.find((p) => p.id === source.productId);
    if (product?.sellBySubitems && product.subitems.length > 0) {
      return product.subitems.map((s) => ({
        key: s.id,
        name: s.name || "parte",
      }));
    }
    return [{ key: WHOLE_PART_KEY, name: "" }];
  }

  // As cores em que aquela parte existe hoje (as opções do seletor).
  function colorOptionsOf(source: SaleModalContext, partKey: string) {
    const good = goods.find((g) => g.productId === source.productId);
    return colorsWithBalance(
      good,
      partKey === WHOLE_PART_KEY ? undefined : partKey,
    );
  }

  // A cor EFETIVA de uma parte: a escolhida à mão, ou o default = maior saldo.
  // Derivada (não guardada) para não depender da ordem em que os acabados chegam.
  function colorOf(item: CestaItem, partKey: string): string {
    const chosen = item.colors?.[partKey];
    if (chosen) return chosen;
    return colorOptionsOf(item.source, partKey)[0]?.colorKey ?? NO_COLOR_KEY;
  }

  // O mapa completo de cores de um item, como a reconciliação espera.
  function colorsOf(item: CestaItem): Record<string, string> {
    const map: Record<string, string> = {};
    for (const part of partsOf(item.source)) map[part.key] = colorOf(item, part.key);
    return map;
  }

  // Rótulo congelado no recibo: "Azul" na peça única, "Corpo: Azul · Tampa:
  // Vermelho" no conjunto multicor. Vazio quando não há cor a declarar.
  function colorLabelOf(item: CestaItem): string {
    const parts = partsOf(item.source)
      .map((part) => {
        const key = colorOf(item, part.key);
        const found = colorOptionsOf(item.source, part.key).find(
          (c) => c.colorKey === key,
        );
        if (!found || found.colorKey === NO_COLOR_KEY) return null;
        return part.name ? `${part.name}: ${found.colorLabel}` : found.colorLabel;
      })
      .filter((label): label is string => Boolean(label));
    // Conjunto inteiro na mesma cor não precisa repetir o nome de cada parte.
    const unicas = new Set(
      parts.map((label) => label.split(": ").pop() ?? label),
    );
    if (parts.length > 1 && unicas.size === 1) return [...unicas][0];
    return parts.join(" · ");
  }

  function setColor(key: string, partKey: string, colorKey: string) {
    setItems((current) =>
      current.map((item) =>
        item.key === key
          ? { ...item, colors: { ...(item.colors ?? {}), [partKey]: colorKey } }
          : item,
      ),
    );
  }
  function defaultOrigin(source: SaleModalContext): SaleItemOrigin {
    return balanceForItem(source) > 0 ? "acabado" : "encomenda";
  }

  const [items, setItems] = useState<CestaItem[]>(() => {
    if (editRecibo) {
      return editRecibo.items.map((entry) => ({
        key: `item_${entry.id}`,
        id: entry.id,
        createdAt: entry.createdAt,
        source: entry.source,
        productName: entry.productName,
        quantity: entry.quantity,
        salePrice: entry.salePrice,
        // FEAT-09: só o desconto POR ITEM volta pra linha; o desconto NO TOTAL é
        // reconstruído em `totalDiscount` abaixo (não fica na linha).
        ...(entry.discountKind === "item" && entry.discountInput
          ? { discount: entry.discountInput }
          : {}),
        origem: entry.origem ?? defaultOrigin(entry.source),
        // FEAT-11: a cor salva volta como escolha explícita (não como default),
        // senão reabrir um recibo poderia mudar a prateleira de onde a peça sai.
        ...(entry.finishedColors
          ? { colors: colorRecordOf(entry.finishedColors) }
          : {}),
      }));
    }
    return seed ? [itemFromContext(seed, defaultOrigin(seed))] : [];
  });
  const [customer, setCustomer] = useState(editRecibo?.customer ?? "");
  const [dateStr, setDateStr] = useState(
    editRecibo ? toDateInput(editRecibo.saleDate) : todayInputValue(),
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    editRecibo?.paymentMethod ?? DEFAULT_PAYMENT_METHOD,
  );
  // Bandeira e parcelas do cartão (só relevantes em débito/crédito). Persistem no
  // estado mesmo fora do cartão, pra não perder a escolha ao alternar o método.
  const [cardBrandTier, setCardBrandTier] = useState<CardBrandTier>(
    editRecibo?.cardBrandTier ?? DEFAULT_CARD_BRAND_TIER,
  );
  const [installments, setInstallments] = useState<number>(
    editRecibo?.installments && editRecibo.installments > 0
      ? editRecibo.installments
      : 1,
  );
  const [channel, setChannel] = useState<SaleChannel>(
    editRecibo?.channel ?? DEFAULT_SALE_CHANNEL,
  );
  // Repassar a taxa ao cliente (infla o preço) ou absorver (desconta da margem).
  const [feePassedToCustomer, setFeePassedToCustomer] = useState(
    editRecibo?.feePassedToCustomer ?? false,
  );
  const [notes, setNotes] = useState(editRecibo?.notes ?? "");
  // FEAT-09: modo de desconto (XOR) + o desconto do modo "total". Reconstruídos do
  // recibo salvo ao editar (o desconto por item já voltou pras linhas acima).
  const [discountMode, setDiscountMode] = useState<DiscountMode>(() => {
    const items = editRecibo?.items ?? [];
    if (items.some((entry) => entry.discountKind === "total")) return "total";
    if (items.some((entry) => entry.discountKind === "item")) return "item";
    return "none";
  });
  const [totalDiscount, setTotalDiscount] = useState<Discount>(() => {
    const totalEntry = editRecibo?.items.find(
      (entry) => entry.discountKind === "total" && entry.discountInput,
    );
    return totalEntry?.discountInput ?? ZERO_DISCOUNT;
  });
  const [addPick, setAddPick] = useState("");
  const [stockPick, setStockPick] = useState("");
  const [showFeesEditor, setShowFeesEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  // Aviso inline (validação ou erro de gravação), no lugar do window.alert.
  const [error, setError] = useState<string | null>(null);

  // O default "acabado" vs "encomenda" depende do saldo do acabado (`goods`), que
  // sobe ASSÍNCRONO: o modal abre com `goods=[]` e a assinatura só chega depois.
  // Sem isto, um item semeado (ex.: "Vender" na aba Produtos) congelaria
  // "encomenda" mesmo havendo estoque. Ao carregar/mudar os acabados, reavalia o
  // default dos itens que o usuário AINDA não mexeu (os tocados ficam no ref);
  // o modo edição preserva o `origem` salvo no recibo.
  const touchedOrigem = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (editRecibo) return;
    setItems((current) =>
      current.map((item) =>
        touchedOrigem.current.has(item.key)
          ? item
          : { ...item, origem: defaultOrigin(item.source) },
      ),
    );
    // `defaultOrigin` deriva de goods/products — recomputa quando eles chegam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goods, products, editRecibo]);

  const feeRatePct = resolveFeeRate(fees, paymentMethod, cardBrandTier, installments);
  const hasFee = feeRatePct > 0;
  // Bandeira só importa em cartão; parcela só no crédito.
  const isCard = paymentMethod === "debito" || paymentMethod === "credito";
  const isCredit = paymentMethod === "credito";

  // Ao mudar a forma de pagamento OU ligar/desligar o repasse, recalcula o preço
  // cobrado de cada item a partir do sugerido (gross-up se repassa; sugerido puro
  // se absorve). Sem taxa, cai no sugerido. Isso reescreve edições manuais de
  // preço — o usuário pode reajustar depois se quiser.
  function repriceItems(passed: boolean, ratePct: number) {
    setItems((current) =>
      current.map((item) => ({
        ...item,
        salePrice: passed
          ? chargedWithFee(item.source, ratePct)
          : round2(item.source.suggestedPrice),
      })),
    );
  }

  function changePaymentMethod(method: PaymentMethod) {
    setPaymentMethod(method);
    if (feePassedToCustomer) {
      repriceItems(true, resolveFeeRate(fees, method, cardBrandTier, installments));
    }
  }

  function changeCardBrandTier(tier: CardBrandTier) {
    setCardBrandTier(tier);
    if (feePassedToCustomer) {
      repriceItems(true, resolveFeeRate(fees, paymentMethod, tier, installments));
    }
  }

  function changeInstallments(next: number) {
    const n = Math.min(Math.max(1, Math.round(next) || 1), MAX_INSTALLMENTS);
    setInstallments(n);
    if (feePassedToCustomer) {
      repriceItems(true, resolveFeeRate(fees, paymentMethod, cardBrandTier, n));
    }
  }

  function toggleFeePassed() {
    const next = !feePassedToCustomer;
    setFeePassedToCustomer(next);
    repriceItems(next, feeRatePct);
  }

  // Editor de taxas — planos (pix/dinheiro/outro) e a matriz de cartão por bandeira.
  function updateFlatFee(key: "pix" | "dinheiro" | "outro", valueStr: string) {
    if (!onFeesChange) return;
    onFeesChange({ ...fees, [key]: Math.max(0, Number(valueStr) || 0) });
  }

  function updateTierDebito(tier: CardBrandTier, valueStr: string) {
    if (!onFeesChange) return;
    const value = Math.max(0, Number(valueStr) || 0);
    onFeesChange({
      ...fees,
      card: { ...fees.card, [tier]: { ...fees.card[tier], debito: value } },
    });
  }

  function updateTierCredito(tier: CardBrandTier, index: number, valueStr: string) {
    if (!onFeesChange) return;
    const value = Math.max(0, Number(valueStr) || 0);
    const credito = fees.card[tier].credito.map((v, i) => (i === index ? value : v));
    onFeesChange({
      ...fees,
      card: { ...fees.card, [tier]: { ...fees.card[tier], credito } },
    });
  }

  function updateItem(key: string, patch: Partial<CestaItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  // Remove um item da cesta — inclusive o último (a cesta pode ficar vazia: o
  // botão de registrar já fica desabilitado e o seletor abaixo repõe). Antes só
  // deixava com 2+ itens, então um item errado sozinho obrigava a reabrir o modal.
  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  function addFromCatalog(indexStr: string) {
    const index = Number(indexStr);
    const source = catalogItems[index];
    if (!source) return;
    const item = itemFromContext(source, defaultOrigin(source));
    // Se o repasse está ligado, o item novo já nasce com o preço inflado e redondo.
    if (feePassedToCustomer && hasFee) {
      item.salePrice = chargedWithFee(source, feeRatePct);
    }
    setItems((current) => [...current, item]);
    setAddPick("");
  }

  // Itens do catálogo QUE TÊM saldo no estoque de acabados (inteiro = conjuntos
  // montáveis; subitem/inteiro-sem-partes = saldo da SKU). É o "o que já tenho
  // pronto" ao lado do catálogo cru — o dono escolhe direto da prateleira.
  const stockItems = useMemo(
    () =>
      catalogItems
        .map((source, index) => ({ source, index, balance: balanceForItem(source) }))
        .filter((entry) => entry.balance > 0),
    // `balanceForItem` deriva de goods/products; catalogItems é a lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogItems, goods, products],
  );

  function addFromStock(indexStr: string) {
    const index = Number(indexStr);
    const source = catalogItems[index];
    if (!source) return;
    // Veio da prateleira → já nasce como peça pronta (acabado), não encomenda. É
    // escolha explícita: marca como "tocado" pra o efeito de default não reverter.
    const item = itemFromContext(source, "acabado");
    touchedOrigem.current.add(item.key);
    if (feePassedToCustomer && hasFee) {
      item.salePrice = chargedWithFee(source, feeRatePct);
    }
    setItems((current) => [...current, item]);
    setStockPick("");
  }

  // Itens no formato da reconciliação (o preview vivo, com id de evento fixo — o
  // custo não depende do id). Recalcula quando itens/estoque/catálogo mudam.
  const reconItems = useMemo<ReconItem[]>(
    () =>
      items.map((item) => ({
        key: item.key,
        productId: item.source.productId,
        ...(item.source.subitemId ? { subitemId: item.source.subitemId } : {}),
        productName: item.productName,
        quantity: Math.max(1, Number(item.quantity) || 1),
        origem: item.origem,
        // FEAT-11: a cor de cada parte (só o caminho `acabado` usa).
        colors: colorsOf(item),
      })),
    // `colorsOf` deriva de goods/products — recomputa quando eles chegam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, goods, products],
  );

  // Estado a estornar do recibo ANTIGO (edição): os `finishedMoves` das vendas
  // salvas + os `stockMoves` dos eventos de encomenda (resolvidos na coleção; um
  // evento já apagado à mão some sem estorno duplo).
  //
  // UX-42: isto vivia DENTRO do salvar. Como o preview não o tinha, ele calculava
  // só o forward e acusava saldo negativo que a gravação não produzia — o que o
  // recibo antigo já havia consumido nunca era creditado de volta na simulação.
  const oldRecibo: OldReciboState | null = useMemo(
    () =>
      editRecibo
        ? {
            finishedMoves: editRecibo.items.flatMap(
              (entry) => entry.finishedMoves ?? [],
            ),
            productionEvents: editRecibo.items
              .flatMap((entry) => entry.productionEventIds ?? [])
              .map((id) => production.find((event) => event.id === id))
              .filter((event): event is ProductionEvent => Boolean(event))
              .map((event) => ({ id: event.id, stockMoves: event.stockMoves })),
          }
        : null,
    [editRecibo, production],
  );

  // Reconciliação viva: custo REAL por item (D3) + avisos, por caminho. Pura, não
  // grava; usa id fixo pois o custo independe do id do evento.
  const recon = useMemo(
    () =>
      planReciboReconciliation(reconItems, {
        goods,
        colors: stock,
        supplies,
        products,
        machines,
        fixedCosts,
        at: toTimestamp(dateStr),
        // Preview: createdAt/genId não afetam o custo exibido (id de evento fixo).
        createdAt: 0,
        genId: () => "preview",
      },
      // UX-42: o MESMO estorno que a gravação faz — sem ele o preview simula
      // sobre um saldo que já não existe.
      oldRecibo),
    [reconItems, goods, stock, supplies, products, machines, fixedCosts, dateStr, oldRecibo],
  );
  const reconByKey = useMemo(
    () => new Map(recon.items.map((r) => [r.key, r])),
    [recon],
  );
  // Custo real por unidade deste item (fallback no snapshot se algo faltar).
  const unitCostOf = (item: CestaItem): number =>
    reconByKey.get(item.key)?.cogsUnit ?? item.source.unitCost;

  // Bruto da linha (preço de tabela × qtd), antes do desconto.
  const grossOf = (item: CestaItem): number =>
    Math.max(0, Number(item.salePrice) || 0) *
    Math.max(1, Number(item.quantity) || 1);

  // FEAT-09: R$ efetivo do desconto por linha. No modo "item" cada linha aplica o
  // seu; no modo "total" o desconto do recibo é rateado proporcional ao bruto de
  // cada linha (soma das fatias = desconto total). "none" → tudo zero.
  const discountByKey = useMemo(() => {
    const map = new Map<string, number>();
    if (discountMode === "item") {
      for (const item of items) {
        map.set(item.key, discountAmountOf(grossOf(item), item.discount));
      }
    } else if (discountMode === "total") {
      const lineGross = items.map(grossOf);
      const grossSum = lineGross.reduce((acc, g) => acc + g, 0);
      const totalR = discountAmountOf(grossSum, totalDiscount);
      const shares = apportionDiscount(lineGross, totalR);
      items.forEach((item, idx) => map.set(item.key, shares[idx] ?? 0));
    }
    return map;
  }, [items, discountMode, totalDiscount]);
  const discountOf = (item: CestaItem): number =>
    discountByKey.get(item.key) ?? 0;

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const fin = saleItemFinancials({
          chargedUnitPrice: item.salePrice,
          quantity: item.quantity,
          unitCost: unitCostOf(item),
          feeRatePct,
          discountAmount: discountOf(item),
        });
        acc.gross += grossOf(item);
        acc.discount += discountOf(item);
        acc.revenue += fin.totalRevenue;
        acc.cost += fin.totalCost;
        acc.fee += fin.feeAmount;
        return acc;
      },
      { gross: 0, discount: 0, revenue: 0, cost: 0, fee: 0 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, feeRatePct, reconByKey, discountByKey]);

  const profit = totals.revenue - totals.cost - totals.fee;
  const margin = totals.revenue > 0 ? (profit / totals.revenue) * 100 : 0;

  async function confirm() {
    if (items.length === 0) {
      setError("Adicione ao menos um produto à venda.");
      return;
    }
    for (const item of items) {
      if (!item.productName.trim()) {
        setError("Dê um nome a todos os produtos da venda.");
        return;
      }
      if (Math.max(0, Number(item.salePrice) || 0) <= 0) {
        setError(`Informe o preço de venda de "${item.productName}".`);
        return;
      }
    }

    setError(null);

    // Offline: o Firestore enfileira a escrita e a Promise fica pendente para
    // sempre (nem resolve, nem rejeita) — o botão travaria em "Registrando...".
    // Bloqueia com aviso claro em vez de pendurar (TD-004).
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(
        "Sem conexão com a internet. Reconecte e tente de novo — nada foi salvo ainda.",
      );
      return;
    }

    setSaving(true);
    const now = Date.now();
    const reciboId =
      editRecibo?.reciboId ?? `r_${now}_${Math.floor(Math.random() * 1000)}`;
    const saleDate = toTimestamp(dateStr);

    // Estorna o recibo antigo e reaplica o novo numa passada só (baixa real, ids
    // de evento definitivos). Devolve o custo real por item + o que gravar.
    const write = reconcileReciboWrite(reconItems, oldRecibo, {
      goods,
      colors: stock,
      supplies,
      products,
      machines,
      fixedCosts,
      at: saleDate,
      createdAt: now,
      genId: newProductionId,
    });
    const wByKey = new Map(write.items.map((r) => [r.key, r]));

    const saleUpserts: ReciboUpsert[] = items.map((item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.salePrice) || 0);
      const r = wByKey.get(item.key);
      // COGS = custo real de produção (D3): camadas do acabado ou FIFO da encomenda.
      const unitCost = r?.cogsUnit ?? item.source.unitCost;
      // FEAT-09: R$ efetivo do desconto desta linha (já rateado no modo total).
      const discountAmount = discountByKey.get(item.key) ?? 0;
      const fin = saleItemFinancials({
        chargedUnitPrice: unitPrice,
        quantity: qty,
        unitCost,
        feeRatePct,
        discountAmount,
      });
      // FEAT-02/D7: congela as cores resolvendo material/marca da cor viva; o
      // "material" da venda passa a ser DERIVADO delas (não mais texto livre).
      const frozenFilaments = freezeFilaments(item.source.filaments, stock);
      const payload: SalePayload = {
        reciboId,
        saleDate,
        customer: customer.trim(),
        material: materialsLabel(frozenFilaments),
        paymentMethod,
        channel,
        notes: notes.trim(),
        status: "concluida",
        productId: item.source.productId,
        // FEAT-01: qual subitem foi vendido (só quando é venda de parte). Condi-
        // cional — o Firestore rejeita undefined.
        ...(item.source.subitemId
          ? { subitemId: item.source.subitemId }
          : {}),
        productName: item.productName.trim(),
        machineId: item.source.machineId,
        machineName: item.source.machineName,
        printHours: item.source.printHours,
        machineUsage: item.source.machineUsage,
        filaments: frozenFilaments,
        quantity: qty,
        suggestedPrice: item.source.suggestedPrice,
        salePrice: unitPrice,
        unitCost,
        // A estimativa que GEROU o preço (snapshot do catálogo do dia da venda).
        costBreakdown: item.source.costBreakdown,
        // FEAT-06: e, ao lado dela, a composição do custo REAL — a que bate com
        // o `unitCost` acima. Até aqui só o total real era gravado, e detalhar a
        // venda caía no snapshot precificado, que não soma o mesmo número.
        // Ausente (sem gravar) quando a peça saiu de camada anterior ao FEAT-06:
        // o `unitCost` continua certo, só não há o que detalhar. Parcial também
        // não grava — meia composição enganaria mais do que nenhuma.
        ...(r?.cogsBreakdown && !r.cogsBreakdownPartial
          ? { realCostBreakdown: r.cogsBreakdown }
          : {}),
        totalCost: fin.totalCost,
        totalRevenue: fin.totalRevenue,
        feeRate: feeRatePct,
        feeAmount: fin.feeAmount,
        feePassedToCustomer,
        // Bandeira/parcela congeladas só em cartão (o Firestore rejeita undefined).
        ...(isCard ? { cardBrandTier } : {}),
        ...(isCredit ? { installments } : {}),
        // FEAT-09: congela o desconto só quando há um efetivo nesta linha (o
        // Firestore rejeita undefined). `discountInput` guarda o que o dono
        // digitou; no modo total é o desconto do recibo inteiro (informativo).
        ...(discountMode !== "none" && discountAmount > 0
          ? {
              discountKind: discountMode,
              discountInput:
                discountMode === "item"
                  ? (item.discount ?? ZERO_DISCOUNT)
                  : totalDiscount,
              discountAmount,
            }
          : {}),
        profit: fin.profit,
        margin: fin.margin,
        // Preserva o createdAt de itens já salvos (mantém a ordem no recibo);
        // itens novos nascem agora.
        createdAt: item.createdAt ?? now,
        // Passo 8 — o rastro da reconciliação (para o estorno futuro).
        origem: item.origem,
        ...(r && r.finishedMoves.length > 0
          ? { finishedMoves: r.finishedMoves }
          : {}),
        // FEAT-11: a cor de onde saiu, congelada — só faz sentido na peça pronta
        // (a encomenda produz na cor do cadastro). O mapa serve à reedição; o
        // rótulo, ao histórico (a cor pode ser renomeada depois).
        ...(item.origem === "acabado" && r && r.finishedMoves.length > 0
          ? {
              // LISTA, não mapa: a parte viraria nome de campo e o Firestore
              // recusa `__whole__` (ver `FinishedColorEntry`).
              finishedColors: colorEntriesOf(colorsOf(item)),
              ...(colorLabelOf(item)
                ? { finishedColorLabel: colorLabelOf(item) }
                : {}),
            }
          : {}),
        ...(r && r.productionEventIds.length > 0
          ? { productionEventIds: r.productionEventIds }
          : {}),
      };
      return { id: item.id, payload };
    });

    // Itens que estavam no recibo original e saíram na edição → apagar.
    const currentIds = new Set(
      items
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id)),
    );
    const saleRemovedIds = editRecibo
      ? editRecibo.items
          .map((entry) => entry.id)
          .filter((id) => !currentIds.has(id))
      : [];

    const reciboWrite: ReciboWrite = {
      saleUpserts,
      saleRemovedIds,
      productionCreates: write.productionCreates,
      productionDeleteIds: write.productionDeleteIds,
      colorUpdates: write.colorUpdates,
      // 7e: os insumos das ENCOMENDAS. O plano já os calculava e o repositório
      // já sabia gravá-los, mas o campo (opcional no tipo, então o TypeScript
      // não reclamava) não vinha até aqui: a venda debitava filamento e deixava
      // o insumo intacto. Pior que ficar parado — apagar depois aquele evento de
      // produção CREDITA os `stockMoves` de volta, inflando o saldo com unidades
      // que nunca saíram.
      supplyUpdates: write.supplyUpdates,
      finishedUpdates: write.finishedUpdates,
    };

    try {
      // UX-15: offline a Promise do lote nunca resolve e o botão fica preso em
      // "Salvando…". Dentro do try para o aviso sair pelo canal já existente.
      guardOnline();
      await onConfirm(reciboWrite);
      onClose();
    } catch (err) {
      setError(
        `Erro ao ${isEdit ? "salvar" : "registrar"} venda: ${(err as Error).message}. Nada foi salvo — tente de novo.`,
      );
      setSaving(false);
    }
  }

  const multiItem = items.length > 1;

  return (
    <Modal
      className="sale-modal"
      title={isEdit ? "Editar venda" : "Registrar venda"}
      sub={
        isEdit
          ? "Ajuste os dados desta venda. O custo permanece congelado no valor do momento da venda; alterar quantidade ou preço recalcula receita e lucro."
          : "Congela uma foto do custo e do preço no momento da venda. Adicione um ou mais produtos ao mesmo recibo. Editar valores na calculadora depois não altera este registro."
      }
      onClose={onClose}
      footer={
        <>
          <button
            className="btn primary"
            type="button"
            onClick={confirm}
            disabled={saving || items.length === 0}
          >
            {saving
              ? isEdit
                ? "Salvando..."
                : "Registrando..."
              : isEdit
                ? multiItem
                  ? `Salvar (${items.length} itens)`
                  : "Salvar alterações"
                : multiItem
                  ? `Registrar venda (${items.length} itens)`
                  : "Registrar venda"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
        </>
      }
    >
      <div className="two-col">
        <div className="field-block compact">
          <label className="section-label" htmlFor={`${fieldId}-customer`}>
            Cliente <span className="label-hint">(opcional)</span>
          </label>
          <input
            id={`${fieldId}-customer`}
            className="field-input"
            type="text"
            value={customer}
            onChange={(event) => setCustomer(event.target.value)}
            placeholder="Nome do cliente"
          />
        </div>
        <div className="field-block compact">
          <label className="section-label" htmlFor={`${fieldId}-date`}>
            Data
          </label>
          <input
            id={`${fieldId}-date`}
            className="field-input"
            type="date"
            value={dateStr}
            onChange={(event) => setDateStr(event.target.value)}
          />
        </div>
      </div>

      <div className="two-col">
        <div className="field-block compact">
          <label className="section-label" htmlFor={`${fieldId}-channel`}>
            Canal
          </label>
          <select
            id={`${fieldId}-channel`}
            className="field-input"
            value={channel}
            onChange={(event) =>
              setChannel(event.target.value as SaleChannel)
            }
          >
            {SALE_CHANNELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field-block compact">
          <label className="section-label" htmlFor={`${fieldId}-payment`}>
            Forma de pagamento
          </label>
          <select
            id={`${fieldId}-payment`}
            className="field-input"
            value={paymentMethod}
            onChange={(event) =>
              changePaymentMethod(event.target.value as PaymentMethod)
            }
          >
            {PAYMENT_METHODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cartão: bandeira (débito e crédito) + parcelas (só crédito). A taxa
          resolvida aparece na descrição do repasse logo abaixo. */}
      {isCard ? (
        <div className="two-col">
          <div className="field-block compact">
            <label className="section-label" htmlFor={`${fieldId}-brand`}>
              Bandeira
            </label>
            <select
              id={`${fieldId}-brand`}
              className="field-input"
              value={cardBrandTier}
              onChange={(event) =>
                changeCardBrandTier(event.target.value as CardBrandTier)
              }
            >
              {CARD_BRAND_TIERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {isCredit ? (
            <div className="field-block compact">
              <label
                className="section-label"
                htmlFor={`${fieldId}-installments`}
              >
                Parcelas
              </label>
              <select
                id={`${fieldId}-installments`}
                className="field-input"
                value={installments}
                onChange={(event) =>
                  changeInstallments(Number(event.target.value))
                }
              >
                {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map(
                  (n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "À vista" : `${n}x`}
                    </option>
                  ),
                )}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`fee-row ${hasFee ? "" : "fee-row-muted"}`}>
        <button
          className="fee-toggle"
          type="button"
          onClick={toggleFeePassed}
          disabled={!hasFee}
          title={
            hasFee
              ? undefined
              : "Sem taxa nesta forma de pagamento (Pix/dinheiro)"
          }
        >
          <span className={`toggle-track ${feePassedToCustomer ? "on" : ""}`}>
            <span className="toggle-thumb" />
          </span>
          <span>
            <span className="fee-toggle-label">
              {feePassedToCustomer
                ? "Repassar a taxa ao cliente"
                : "Absorver a taxa"}
            </span>
            <span className="fee-toggle-desc">
              {hasFee
                ? feePassedToCustomer
                  ? `Preço sobe para cobrir a taxa de ${formatDecimalPct(feeRatePct)}% — você recebe o valor cheio.`
                  : `A taxa de ${formatDecimalPct(feeRatePct)}% desconta da sua margem.`
                : "Pix e dinheiro não têm taxa."}
            </span>
          </span>
        </button>
        {onFeesChange ? (
          <button
            className="fee-edit-link"
            type="button"
            onClick={() => setShowFeesEditor((v) => !v)}
          >
            {showFeesEditor ? "Fechar taxas" : "Ajustar taxas"}
          </button>
        ) : null}
      </div>

      {showFeesEditor && onFeesChange ? (
        <div className="fee-editor">
          <div className="fee-editor-title">Taxas da maquininha (%)</div>
          <div className="fee-editor-grid">
            <div className="fee-editor-item">
              <label htmlFor={`${fieldId}-fee-pix`}>Pix</label>
              <input
                id={`${fieldId}-fee-pix`}
                type="number"
                min={0}
                step="0.1"
                value={fees.pix ?? 0}
                onChange={(event) => updateFlatFee("pix", event.target.value)}
              />
            </div>
            <div className="fee-editor-item">
              <label htmlFor={`${fieldId}-fee-dinheiro`}>Dinheiro</label>
              <input
                id={`${fieldId}-fee-dinheiro`}
                type="number"
                min={0}
                step="0.1"
                value={fees.dinheiro ?? 0}
                onChange={(event) => updateFlatFee("dinheiro", event.target.value)}
              />
            </div>
            <div className="fee-editor-item">
              <label htmlFor={`${fieldId}-fee-outro`}>Outro</label>
              <input
                id={`${fieldId}-fee-outro`}
                type="number"
                min={0}
                step="0.1"
                value={fees.outro ?? 0}
                onChange={(event) => updateFlatFee("outro", event.target.value)}
              />
            </div>
          </div>
          {CARD_BRAND_TIERS.map((tier) => (
            <div className="fee-editor-tier" key={tier.value}>
              <div className="fee-editor-subtitle">{tier.label}</div>
              <div className="fee-editor-grid">
                <div className="fee-editor-item">
                  <label htmlFor={`${fieldId}-fee-${tier.value}-debito`}>
                    Débito
                  </label>
                  <input
                    id={`${fieldId}-fee-${tier.value}-debito`}
                    type="number"
                    min={0}
                    step="0.1"
                    value={fees.card[tier.value].debito ?? 0}
                    onChange={(event) =>
                      updateTierDebito(tier.value, event.target.value)
                    }
                  />
                </div>
                {fees.card[tier.value].credito.map((rate, index) => (
                  <div className="fee-editor-item" key={index}>
                    <label htmlFor={`${fieldId}-fee-${tier.value}-${index}`}>
                      {index === 0 ? "Créd. à vista" : `Créd. ${index + 1}x`}
                    </label>
                    <input
                      id={`${fieldId}-fee-${tier.value}-${index}`}
                      type="number"
                      min={0}
                      step="0.1"
                      value={rate ?? 0}
                      onChange={(event) =>
                        updateTierCredito(tier.value, index, event.target.value)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="fee-editor-hint">
            Use os valores da sua maquininha (variam por bandeira e parcela). Salvo
            na nuvem e compartilhado entre aparelhos.
          </div>
        </div>
      ) : null}

      <div className="section-label cesta-label">
        {items.length > 1
          ? `Itens da venda (${items.length})`
          : "Item da venda"}
      </div>

      <div className="cesta-list">
        {items.length === 0 ? (
          <div className="cesta-empty">
            Nenhum produto ainda. Adicione pelo seletor abaixo.
          </div>
        ) : null}
        {items.map((item) => {
          const qty = Math.max(1, Number(item.quantity) || 1);
          const unitPrice = Math.max(0, Number(item.salePrice) || 0);
          const r = reconByKey.get(item.key);
          const unitCost = unitCostOf(item);
          const itemDiscount = discountOf(item);
          const fin = saleItemFinancials({
            chargedUnitPrice: unitPrice,
            quantity: qty,
            unitCost,
            feeRatePct,
            discountAmount: itemDiscount,
          });
          const itemProfit = fin.profit;
          const priceDelta = unitPrice - item.source.suggestedPrice;
          const balance = balanceForItem(item.source);

          return (
            <div className="cesta-item" key={item.key}>
              <div className="cesta-item-head">
                <input
                  className="field-input"
                  type="text"
                  aria-label="Nome do produto vendido"
                  value={item.productName}
                  onChange={(event) =>
                    updateItem(item.key, { productName: event.target.value })
                  }
                  placeholder="Nome do produto vendido"
                />
                <button
                  className="icon-button danger"
                  type="button"
                  onClick={() => removeItem(item.key)}
                  title="Remover item"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="cesta-item-grid">
                <div className="field-block compact">
                  <label
                    className="section-label"
                    htmlFor={`${fieldId}-${item.key}-qty`}
                  >
                    Qtd
                  </label>
                  <NumberInput
                    id={`${fieldId}-${item.key}-qty`}
                    className="field-input"
                    min={1}
                    value={item.quantity}
                    onChange={(quantity) =>
                      updateItem(item.key, { quantity })
                    }
                  />
                </div>
                <div className="field-block compact">
                  <label
                    className="section-label"
                    htmlFor={`${fieldId}-${item.key}-price`}
                  >
                    Preço unit.
                  </label>
                  <NumberInput
                    id={`${fieldId}-${item.key}-price`}
                    className="field-input"
                    min={0}
                    step="0.01"
                    value={item.salePrice}
                    onChange={(salePrice) =>
                      updateItem(item.key, { salePrice })
                    }
                  />
                </div>
              </div>

              {discountMode === "item" ? (
                <div className="cesta-discount">
                  <span className="cesta-discount-label">Desconto</span>
                  <DiscountInput
                    value={item.discount ?? ZERO_DISCOUNT}
                    onChange={(discount) =>
                      updateItem(item.key, { discount })
                    }
                  />
                  <span className="cesta-discount-eff">
                    {itemDiscount > 0
                      ? `−${formatCurrency(itemDiscount)}`
                      : "—"}
                  </span>
                </div>
              ) : null}

              <div className="cesta-origem">
                <select
                  className="field-input"
                  aria-label="Origem desta peça"
                  value={item.origem}
                  onChange={(event) => {
                    // Escolha manual manda — o efeito de default não a reverte.
                    touchedOrigem.current.add(item.key);
                    updateItem(item.key, {
                      origem: event.target.value as SaleItemOrigin,
                    });
                  }}
                  title="De onde sai esta peça: estoque de acabados (pronta) ou produzida agora (encomenda)."
                >
                  <option value="acabado">
                    Estoque de acabados ({Math.round(balance)} disp.)
                  </option>
                  <option value="encomenda">Sob encomenda (produz agora)</option>
                </select>
                {/* FEAT-06: a composição real vem da reconciliação ao vivo —
                    camadas do acabado ou o evento que a encomenda vai criar. */}
                <CostDetail
                  breakdown={item.source.costBreakdown}
                  real={r?.cogsBreakdownPartial ? undefined : r?.cogsBreakdown}
                  realCogs={unitCost}
                />
              </div>

              {/* FEAT-11: de QUAL cor tirar a peça pronta. Aparece só quando a
                  parte existe em mais de uma cor — com uma cor só (o caso
                  normal) a linha fica igual à de antes. Conjunto multicor tem
                  um seletor por parte: corpo e tampa saem de saldos próprios. */}
              {item.origem === "acabado"
                ? partsOf(item.source).map((part) => {
                    const options = colorOptionsOf(item.source, part.key);
                    if (options.length < 2) return null;
                    return (
                      <div className="cesta-cor" key={part.key}>
                        {/* <span> → <label>: os dois são inline, o CSS não
                            muda nada (só font/cor). */}
                        <label
                          className="cesta-cor-label"
                          htmlFor={`${fieldId}-${item.key}-cor-${part.key}`}
                        >
                          {part.name ? `Cor — ${part.name}` : "Cor"}
                        </label>
                        <select
                          id={`${fieldId}-${item.key}-cor-${part.key}`}
                          className="field-input"
                          value={colorOf(item, part.key)}
                          onChange={(event) =>
                            setColor(item.key, part.key, event.target.value)
                          }
                          title="De qual cor sair esta peça (só as cores com saldo aparecem)."
                        >
                          {options.map((option) => (
                            <option key={option.colorKey} value={option.colorKey}>
                              {option.colorLabel} ({Math.round(option.balance)})
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })
                : null}

              {item.origem === "acabado" && r && r.finishedShortfall > 0 ? (
                <div className="cesta-warn strong">
                  ⚠ {Math.round(r.finishedShortfall)} além do estoque de acabados
                  — o saldo fica negativo.
                </div>
              ) : null}
              {item.origem === "encomenda" && r?.missingProduct ? (
                <div className="cesta-warn strong">
                  ⚠ Produto fora do catálogo — nada a produzir; sem baixa de
                  filamento.
                </div>
              ) : null}
              {item.origem === "encomenda" && r && r.filamentShortfallG > 0 ? (
                <div className="cesta-warn strong">
                  ⚠ Passa {Math.round(r.filamentShortfallG)} g do estoque da cor —
                  saldo negativo (contagem furada?).
                </div>
              ) : null}
              {item.origem === "encomenda" &&
              r &&
              r.crossesRoll &&
              r.filamentShortfallG === 0 ? (
                <div className="cesta-warn">
                  Atravessa o rolo em uso — custo misto (na A1 sem AMS, é troca
                  manual no meio da impressão).
                </div>
              ) : null}

              <div className="cesta-item-foot">
                <span>
                  sugerido: {formatCurrency(item.source.suggestedPrice)}
                  {priceDelta !== 0 ? (
                    <span className={priceDelta < 0 ? "sale-neg" : "sale-pos"}>
                      {" "}
                      ({priceDelta < 0 ? "−" : "+"}
                      {formatCurrency(Math.abs(priceDelta))})
                    </span>
                  ) : null}
                  {itemDiscount > 0 ? (
                    <span className="sale-neg">
                      {" "}
                      · desc −{formatCurrency(itemDiscount)}
                    </span>
                  ) : null}
                </span>
                <span>
                  lucro{" "}
                  {/* UX-20 — EXCEÇÃO DELIBERADA: o pé do item da cesta mostra
                      "sugerido / lucro" e nenhuma %. Sem % companheira, a cor
                      mora no R$ (sub-decisão (c) do dono).
                      ⚠ Este ponto NÃO estava na lista de 3 exceções que o dono
                      enumerou — foi achado ao conferir ponto a ponto se havia
                      % ao lado. Vale a REGRA, não a contagem: quem revisar
                      deve confirmar que é isso mesmo que ele queria. */}
                  <strong className={itemProfit < 0 ? "sale-neg" : "sale-pos"}>
                    {formatCurrency(itemProfit)}
                  </strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {stockItems.length > 0 ? (
        <div className="cesta-add">
          <Boxes size={15} />
          <select
            className="field-input"
            aria-label="Adicionar do estoque de produtos"
            value={stockPick}
            onChange={(event) => addFromStock(event.target.value)}
          >
            <option value="">Adicionar do estoque de produtos…</option>
            {stockItems.map(({ source, index, balance }) => (
              <option
                key={`stock-${source.productId}-${source.subitemId ?? "w"}-${index}`}
                value={index}
              >
                {source.defaultProductName} — {Math.round(balance)} em estoque
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {catalogItems.length > 0 ? (
        <div className="cesta-add">
          <Plus size={15} />
          <select
            className="field-input"
            aria-label="Adicionar outro produto do catálogo"
            value={addPick}
            onChange={(event) => addFromCatalog(event.target.value)}
          >
            <option value="">Adicionar outro produto do catálogo…</option>
            {catalogItems.map((option, index) => (
              <option key={`${option.productId}-${index}`} value={index}>
                {option.defaultProductName} —{" "}
                {formatCurrency(option.suggestedPrice)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="field-block compact">
        <label className="section-label" htmlFor={`${fieldId}-notes`}>
          Observações <span className="label-hint">(opcional)</span>
        </label>
        <textarea
          id={`${fieldId}-notes`}
          className="field-input"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Detalhes da venda, personalização, etc."
        />
      </div>

      <div className="discount-block">
        <div className="discount-modes">
          <span className="discount-modes-label">Desconto</span>
          <div className="discount-mode-toggle">
            {(
              [
                ["none", "Nenhum"],
                ["item", "Por item"],
                ["total", "No total"],
              ] as [DiscountMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={discountMode === mode ? "on" : ""}
                onClick={() => setDiscountMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {discountMode === "item" ? (
          <p className="discount-hint">
            Defina o desconto em cada item acima. Um modo ou outro por venda —
            nunca os dois juntos.
          </p>
        ) : null}
        {discountMode === "total" ? (
          <div className="discount-total">
            <DiscountInput value={totalDiscount} onChange={setTotalDiscount} />
            <span className="discount-total-eff">
              {totals.discount > 0
                ? `−${formatCurrency(totals.discount)} no recibo`
                : "sem desconto"}
            </span>
          </div>
        ) : null}
      </div>

      <div className="sale-summary">
        {totals.discount > 0 ? (
          <>
            <div className="sale-summary-item">
              <span>Subtotal</span>
              <strong className="mono">{formatCurrency(totals.gross)}</strong>
            </div>
            <div className="sale-summary-item">
              <span>Desconto</span>
              <strong className="mono sale-neg">
                −{formatCurrency(totals.discount)}
              </strong>
            </div>
          </>
        ) : null}
        <div className="sale-summary-item">
          <span>Receita</span>
          <strong className="mono">{formatCurrency(totals.revenue)}</strong>
        </div>
        <div className="sale-summary-item">
          <span>Custo</span>
          <strong className="mono">{formatCurrency(totals.cost)}</strong>
        </div>
        {totals.fee > 0 ? (
          <div className="sale-summary-item">
            <span>Taxa ({formatDecimalPct(feeRatePct)}%)</span>
            <strong className="mono sale-neg">
              −{formatCurrency(totals.fee)}
            </strong>
          </div>
        ) : null}
        <div className="sale-summary-item">
          <span>Lucro</span>
          {/* UX-20: a cor mora na % ao lado; no R$ sobra só o `.sale-neg`.
              ⚠ Para isso, a % teve de GANHAR a faixa da DEC-04 aqui — ela era
              a única "(NN%)" do app que saía em `--muted`, sem régua nenhuma
              (o UX-19 passou batido por este ponto). Sem esta linha, tirar o
              verde do R$ apagaria o sinal em vez de mudá-lo de lugar. */}
          <strong className={`mono ${profit < 0 ? "sale-neg" : ""}`}>
            {formatCurrency(profit)}{" "}
            {/* A faixa vai num <span> PRÓPRIO por dentro, nunca junto do
                `.sale-summary-margin`: aquele declara `color` e mora no
                `auth-sale.css`, importado DEPOIS do `base.css` — na mesma
                especificidade o último vence e o muted comeria a faixa. É a
                regra escrita no `base.css`, acima do `.margin-bad`. */}
            <span className="sale-summary-margin">
              (
              <span
                className={marginTierClass(margin)}
                title={marginTierTitle(margin)}
              >
                {margin.toFixed(0)}%
              </span>
              )
            </span>
          </strong>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
    </Modal>
  );
}
