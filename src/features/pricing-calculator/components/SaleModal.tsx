"use client";

import { useId, useMemo, useState } from "react";
import { Boxes, Plus, Trash2 } from "lucide-react";
import {
  errorMessage,
  guardOnline,
  isOffline,
  mensagemDeFalhaNaGravacao,
  OFFLINE_MESSAGE,
} from "@/lib/errors";
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
  reverseFinishedConsumption,
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
  QuoteRecord,
  ReciboUpsert,
  SaleChannel,
  SalePayload,
  SavedProduct,
  StockFilament,
  StockMove,
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
  finishedMoves?: FinishedMove[];
  // W4: a baixa dos acessórios do conjunto, idem.
  supplyMoves: StockMove[];
  // FEAT-11: as cores escolhidas na venda salva — voltam para a linha para a
  // reedição reaplicar a baixa na MESMA prateleira de onde saiu.
  finishedColors?: FinishedColorEntry[];
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
  // Link para o orçamento de origem (ver a nota em `SaleInput.quoteId`) —
  // compartilhado no recibo, como `customer`/`channel`.
  quoteId?: string;
  quoteNumber?: string;
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
  // FEAT-11: cor ESCOLHIDA à mão para cada parte (chave = subitemId ou
  // `WHOLE_PART_KEY`). Guarda só o que o dono escolheu — o default (cor de maior
  // saldo) é DERIVADO na hora de usar. Sem isso, o modal teria que reescrever o
  // estado quando os acabados chegassem do Firestore.
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
  // Taxas por forma de pagamento (config global) — só leitura aqui; a edição
  // mora em Configurações → Taxas (`PaymentFeesPanel`).
  fees: PaymentFeeSettings;
  // Passo 8: dados vivos para a reconciliação (custo real + baixa por caminho).
  goods: FinishedGood[];
  stock: StockFilament[];
  // 7e/W4: insumos, para a venda do conjunto dar baixa dos acessórios dele.
  supplies: Supply[];
  products: SavedProduct[];
  machines: Machine[];
  fixedCosts: FixedCostSettings;
  energyTariff: number;
  // Histórico de orçamentos, para o seletor "veio de qual orçamento" (link
  // opcional orçamento → venda). Mais recente primeiro é decisão da UI, não
  // deste tipo.
  quotes: QuoteRecord[];
  onClose: () => void;
  // Recebe o plano de escrita atômico completo (vendas + acabados + insumos). O
  // call site liga em `reconcileRecibo`.
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
      {/* Motivo livre ("cliente fidelidade", "sobra de mesa"...) — opcional,
          vive no PRÓPRIO desconto (ver a nota em `Discount.reason`). */}
      <input
        className="field-input discount-reason"
        type="text"
        aria-label="Motivo do desconto"
        placeholder="Motivo (opcional)"
        value={value.reason ?? ""}
        onChange={(event) => onChange({ ...value, reason: event.target.value })}
      />
    </div>
  );
}

let itemSeq = 0;
function itemFromContext(source: SaleModalContext): CestaItem {
  itemSeq += 1;
  return {
    key: `item_${Date.now()}_${itemSeq}`,
    source,
    productName: source.defaultProductName,
    quantity: 1,
    salePrice: round2(source.suggestedPrice),
  };
}

export function SaleModal({
  seed,
  editRecibo,
  catalogItems,
  fees,
  goods,
  stock,
  supplies,
  products,
  machines,
  fixedCosts,
  energyTariff,
  quotes,
  onClose,
  onConfirm,
}: SaleModalProps) {
  const fieldId = useId();
  const isEdit = Boolean(editRecibo);

  // ⚠ Declarado AQUI em cima, e não junto da reconciliação que o consome, porque
  // o `goodsCreditados` logo abaixo também o lê — e o `stockItems`, que é um
  // `useMemo`, roda antes daquele ponto do arquivo: const em zona morta temporal
  // explodiria em ReferenceError.
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
            supplyMoves: editRecibo.items.flatMap((entry) => entry.supplyMoves),
          }
        : null,
    [editRecibo],
  );

  // CSV-34 — o saldo que a TELA mostra tem de ser o mesmo que o aviso usa. O
  // aviso do UX-42 já credita o recibo antigo (é o `oldRecibo` acima, dentro da
  // reconciliação); o rótulo "N disp." continuava lendo o `goods` cru. Editando
  // um recibo de 1 un sobre 1 produzida, o seletor dizia "0 disp." enquanto a
  // quantidade 1 era aceita sem um pio — dois números sobre o mesmo estoque,
  // discordando na mesma tela. Aqui roda o MESMO estorno da gravação
  // (`reverseFinishedConsumption`), sobre uma cópia: nada é gravado.
  const goodsCreditados = useMemo(() => {
    const moves = oldRecibo?.finishedMoves ?? [];
    if (moves.length === 0) return goods;
    const afetados = new Set(moves.map((move) => move.productId));
    // W6: o estorno LANÇA quando a camada drenada sumiu (TD-028). Aqui ele cai
    // no saldo cru — o recado e a trava do botão vêm do `reconError` abaixo,
    // que roda o mesmo estorno; deixar a exceção subir derrubaria o modal.
    try {
      return goods.map((good) =>
        afetados.has(good.productId)
          ? reverseFinishedConsumption(good, moves)
          : good,
      );
    } catch {
      return goods;
    }
  }, [goods, oldRecibo]);

  // Saldo do acabado (a SKU = o subitem) deste item.
  // BUG-05: o INTEIRO de um produto que vende por partes não tem SKU própria — o
  // saldo é quantos conjuntos dá para montar (min das partes), casando com a baixa
  // do `consumeWholeFifo` na reconciliação.
  function balanceForItem(source: SaleModalContext): number {
    const good = goodsCreditados.find((g) => g.productId === source.productId);
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
  function partsOf(item: CestaItem): { key: string; name: string }[] {
    const source = item.source;
    if (source.subitemId) return [{ key: source.subitemId, name: "" }];
    const product = products.find((p) => p.id === source.productId);
    if (product?.sellBySubitems && product.subitems.length > 0) {
      return product.subitems.map((s) => ({
        key: s.id,
        name: s.name || "parte",
      }));
    }
    // W5: produto EXCLUÍDO — a reedição traz as partes no mapa de cores salvo
    // (a mesma regra do `partesDoItem` da reconciliação).
    if (!product) {
      const salvas = Object.keys(item.colors ?? {});
      if (salvas.length > 0 && !salvas.includes(WHOLE_PART_KEY)) {
        return salvas.map((key) => ({ key, name: "" }));
      }
    }
    return [{ key: WHOLE_PART_KEY, name: "" }];
  }

  // As cores em que aquela parte existe hoje (as opções do seletor).
  function colorOptionsOf(source: SaleModalContext, partKey: string) {
    // CSV-34: a mesma prateleira do `balanceForItem` — senão o seletor de cor
    // esconde justamente a cor que o recibo em edição esvaziou.
    const good = goodsCreditados.find((g) => g.productId === source.productId);
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

  // UX-52 — quantas peças existem NA COR escolhida. O "N disp." do seletor de
  // origem é o saldo da peça somando TODAS as cores (FEAT-11, de propósito: a
  // cor decide de onde tirar, não quantas existem), mas o aviso de estouro vem
  // do `consumeFifo`, que drena da cor ESCOLHIDA. Sem este segundo número a tela
  // dizia "8 disp." e "⚠ 4 além do estoque" a 2cm de distância, os dois certos e
  // medindo coisas diferentes.
  // Conjunto multicor: é o MÍNIMO entre as partes, a mesma conta do
  // `assemblableWholes` — o que limita o conjunto é a parte mais escassa.
  function colorBalanceOf(item: CestaItem): number {
    const saldos = partsOf(item).map((part) => {
      const key = colorOf(item, part.key);
      return (
        colorOptionsOf(item.source, part.key).find((c) => c.colorKey === key)
          ?.balance ?? 0
      );
    });
    return saldos.length > 0 ? Math.min(...saldos) : 0;
  }

  // O mapa completo de cores de um item, como a reconciliação espera.
  function colorsOf(item: CestaItem): Record<string, string> {
    const map: Record<string, string> = {};
    for (const part of partsOf(item)) map[part.key] = colorOf(item, part.key);
    return map;
  }

  // Rótulo congelado no recibo: "Azul" na peça única, "Corpo: Azul · Tampa:
  // Vermelho" no conjunto multicor. Vazio quando não há cor a declarar. `colors`
  // é a cor EFETIVA que a reconciliação usou (pode ser a do cadastro, quando a
  // escolha era "sem cor") — o rótulo sai da SKU, que existe mesmo zerada.
  function colorLabelOf(item: CestaItem, colors: Record<string, string>): string {
    const good = goodsCreditados.find((g) => g.productId === item.source.productId);
    const parts = partsOf(item)
      .map((part) => {
        const key = colors[part.key];
        if (!key || key === NO_COLOR_KEY) return null;
        const sku = good?.skus.find(
          (s) =>
            (s.subitemId ?? WHOLE_PART_KEY) === part.key && s.colorKey === key,
        );
        if (!sku?.colorLabel) return null;
        return part.name ? `${part.name}: ${sku.colorLabel}` : sku.colorLabel;
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
        // FEAT-11: a cor salva volta como escolha explícita (não como default),
        // senão reabrir um recibo poderia mudar a prateleira de onde a peça sai.
        ...(entry.finishedColors
          ? { colors: colorRecordOf(entry.finishedColors) }
          : {}),
      }));
    }
    return seed ? [itemFromContext(seed)] : [];
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
  // Link opcional para o orçamento de origem — vazio = venda sem orçamento (o
  // caso comum). `""` é a sentinela de "nenhum" no `<select>`.
  const [quoteId, setQuoteId] = useState(editRecibo?.quoteId ?? "");
  const quotesRecentes = useMemo(
    () => [...quotes].sort((a, b) => b.date - a.date),
    [quotes],
  );
  // V5 (lote 2 da 3a): o orçamento do recibo em edição pode ter sido APAGADO.
  // O `quoteNumber` é denormalizado justamente para sobreviver a isso — e a
  // edição o regravava como `""`, porque só procurava no histórico vivo. O
  // número salvo vale enquanto o link for o mesmo.
  const orcamentoApagado =
    Boolean(editRecibo?.quoteId) &&
    !quotesRecentes.some((q) => q.id === editRecibo?.quoteId);
  function quoteNumberOf(id: string): string {
    const vivo = quotesRecentes.find((q) => q.id === id);
    if (vivo) return vivo.number;
    return id === editRecibo?.quoteId ? (editRecibo.quoteNumber ?? "") : "";
  }
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
  const [saving, setSaving] = useState(false);
  // Aviso inline (validação ou erro de gravação), no lugar do window.alert.
  const [error, setError] = useState<string | null>(null);

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
    const item = itemFromContext(source);
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
    // `balanceForItem` deriva de goodsCreditados/products; catalogItems é a lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogItems, goodsCreditados, products],
  );

  function addFromStock(indexStr: string) {
    const index = Number(indexStr);
    const source = catalogItems[index];
    if (!source) return;
    const item = itemFromContext(source);
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
        // FEAT-11: a cor de cada parte.
        colors: colorsOf(item),
      })),
    // `colorsOf` deriva de goods/products — recomputa quando eles chegam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, goods, products],
  );

  // Reconciliação viva: custo REAL por item (D3) + avisos. Pura, não grava; usa
  // id fixo pois o custo independe do id da camada de acerto.
  //
  // ⚠ W6 (lote 2 da 3a): o estorno do recibo antigo LANÇA quando a camada que
  // ele drenou não existe mais (TD-028, `shiftLayers`). Solto num `useMemo`, isso
  // derrubava o modal inteiro; agora vira recado na tela e trava o botão.
  const { recon, reconError } = useMemo(() => {
    try {
      return {
        recon: planReciboReconciliation(
          reconItems,
          {
            goods,
            colors: stock,
            supplies,
            products,
            machines,
            fixedCosts,
            energyTariff,
            at: toTimestamp(dateStr),
            genId: () => "preview",
          },
          // UX-42: o MESMO estorno que a gravação faz — sem ele o preview simula
          // sobre um saldo que já não existe.
          oldRecibo,
        ),
        reconError: null,
      };
    } catch (err) {
      return { recon: null, reconError: errorMessage(err) };
    }
  }, [reconItems, goods, stock, supplies, products, machines, fixedCosts, energyTariff, dateStr, oldRecibo]);
  const reconByKey = useMemo(
    () => new Map((recon?.items ?? []).map((r) => [r.key, r])),
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
    if (isOffline()) {
      setError(OFFLINE_MESSAGE);
      return;
    }

    setSaving(true);
    try {
      // UX-15: offline a Promise do lote nunca resolve e o botão fica preso em
      // "Salvando…". Dentro do try para o aviso sair pelo canal já existente.
      guardOnline();
      await onConfirm(buildWrite());
      onClose();
    } catch (err) {
      // AUD-18: a frase é DECISÃO e mora no lib. Colar "Nada foi salvo — tente
      // de novo" em todo erro fazia o timeout dizer o oposto de si mesmo.
      setError(
        mensagemDeFalhaNaGravacao(err, `${isEdit ? "salvar" : "registrar"} venda`),
      );
      setSaving(false);
    }
  }

  // O plano de escrita do recibo. ⚠ W6 (lote 2 da 3a): a reconciliação rodava
  // FORA do try, logo depois do `setSaving(true)` — uma exceção do estorno
  // (`shiftLayers`, "camada não existe") travava o botão em "Registrando…" sem
  // mensagem nenhuma. Chamada de dentro do try, ela cai no mesmo aviso de erro.
  function buildWrite(): ReciboWrite {
    const now = Date.now();
    const reciboId =
      editRecibo?.reciboId ?? `r_${now}_${Math.floor(Math.random() * 1000)}`;
    const saleDate = toTimestamp(dateStr);

    // Estorna o recibo antigo e reaplica o novo numa passada só (baixa real, ids
    // definitivos). Devolve o custo real por item + o que gravar.
    const write = reconcileReciboWrite(reconItems, oldRecibo, {
      goods,
      colors: stock,
      supplies,
      products,
      machines,
      fixedCosts,
      energyTariff,
      at: saleDate,
      genId: newProductionId,
    });
    const wByKey = new Map(write.items.map((r) => [r.key, r]));

    const saleUpserts: ReciboUpsert[] = items.map((item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.salePrice) || 0);
      const r = wByKey.get(item.key);
      // COGS = custo real de produção (D3): as camadas drenadas do acabado.
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
        // Link opcional para o orçamento de origem — ver a nota em
        // `SaleInput.quoteId`. `quoteNumber` denormalizado do orçamento vivo
        // (ele não muda depois de emitido, mas o doc pode ser apagado).
        ...(quoteId ? { quoteId, quoteNumber: quoteNumberOf(quoteId) } : {}),
        status: "concluida",
        productId: item.source.productId,
        // FEAT-01: qual subitem foi vendido (só quando é venda de parte). Condi-
        // cional — o Firestore rejeita undefined.
        ...(item.source.subitemId
          ? { subitemId: item.source.subitemId }
          : {}),
        productName: item.productName.trim(),
        // Congelado no momento da venda — ver a nota em `SaleInput.productKind`.
        productKind: item.source.kind,
        printHours: item.source.printHours,
        // [FROTA] Fase 1 — quem imprimiu vem da RECONCILIAÇÃO (das camadas
        // drenadas), não do snapshot do catálogo. Os dois campos são gravados SEMPRE, inclusive vazio/zero —
        // AUD-02: campo que o repositório grava é obrigatório, e lista vazia é a
        // forma de dizer "sem lastro". Item sem resultado (não deveria existir)
        // entra como órfão inteiro, nunca como atribuído por omissão.
        machineUsage: r?.machineUsage ?? [],
        unattributedUnits: r ? r.unattributedUnits : qty,
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
        ...(r && r.finishedMoves.length > 0
          ? { finishedMoves: r.finishedMoves }
          : {}),
        // W4: sempre gravado, inclusive vazio (AUD-02).
        supplyMoves: r?.supplyMoves ?? [],
        // FEAT-11: a cor de onde saiu, congelada — a EFETIVA da reconciliação
        // (`r.colors`), que é a prateleira que o estorno vai honrar. O mapa
        // serve à reedição; o rótulo, ao histórico (a cor pode ser renomeada).
        ...(r && r.finishedMoves.length > 0
          ? {
              // LISTA, não mapa: a parte viraria nome de campo e o Firestore
              // recusa `__whole__` (ver `FinishedColorEntry`).
              finishedColors: colorEntriesOf(r.colors),
              ...(colorLabelOf(item, r.colors)
                ? { finishedColorLabel: colorLabelOf(item, r.colors) }
                : {}),
            }
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

    return {
      saleUpserts,
      saleRemovedIds,
      // 7e/W4: os insumos do conjunto. OBRIGATÓRIO no tipo — ver `ReciboWrite`.
      supplyUpdates: write.supplyUpdates,
      finishedUpdates: write.finishedUpdates,
    };
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
            disabled={saving || items.length === 0 || reconError !== null}
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

      {quotesRecentes.length > 0 || orcamentoApagado ? (
        <div className="field-block compact">
          <label className="section-label" htmlFor={`${fieldId}-quote`}>
            Veio de orçamento <span className="label-hint">(opcional)</span>
          </label>
          <select
            id={`${fieldId}-quote`}
            className="field-input"
            value={quoteId}
            onChange={(event) => setQuoteId(event.target.value)}
          >
            <option value="">Nenhum</option>
            {/* V5: sem esta opção o `<select>` mostrava "Nenhum" com o link
                ainda no estado — a tela dizia uma coisa e a gravação outra. */}
            {orcamentoApagado && editRecibo?.quoteId ? (
              <option value={editRecibo.quoteId}>
                Nº {editRecibo.quoteNumber || "?"} (orçamento apagado)
              </option>
            ) : null}
            {quotesRecentes.map((quote) => (
              <option key={quote.id} value={quote.id}>
                Nº {quote.number}
                {quote.customer ? ` — ${quote.customer}` : ""} —{" "}
                {new Date(quote.date).toLocaleDateString("pt-BR")}
              </option>
            ))}
          </select>
        </div>
      ) : null}

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
      </div>

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
          // UX-52: só aparece quando os dois números DIVERGEM — ou seja, quando
          // a peça existe em mais de uma cor. Com uma cor só eles coincidem e o
          // parêntese seria ruído.
          const colorBal = colorBalanceOf(item);
          const colorNote =
            Math.round(colorBal) === Math.round(balance)
              ? ""
              : ` · ${Math.round(colorBal)} ${
                  partsOf(item).length > 1 ? "nestas cores" : "nesta cor"
                }`;

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
                    aria-label={`Remover o item ${item.productName || "sem nome"}`}
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

              {/* S1 (lote 2 da 3a): aqui havia o seletor acabado × encomenda.
                  Toda venda sai do estoque de acabados; a linha mostra o saldo
                  de onde a peça vai sair. */}
              <div className="cesta-origem">
                <span className="cesta-origem-saldo">
                  {`Estoque de acabados: ${Math.round(balance)} disp.${colorNote}`}
                </span>
                {/* FEAT-06: a composição real vem da reconciliação ao vivo. */}
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
              {partsOf(item).map((part) => {
                const options = colorOptionsOf(item.source, part.key);
                if (options.length < 2) return null;
                return (
                  <div className="cesta-cor" key={part.key}>
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
              })}

              {/* W1: nenhuma peça registrada — a venda abre a camada de ACERTO
                  (custo do cadastro) e o saldo fica negativo até a produção
                  ser registrada. É o recado mais forte, e substitui o genérico. */}
              {r?.acerto ? (
                <div className="cesta-warn strong">
                  ⚠ Nenhuma peça desta registrada na Produção — o saldo fica em
                  −{Math.round(r.finishedShortfall)} e o custo é o do cadastro
                  (estimativa) até você registrar a produção.
                </div>
              ) : r && r.finishedShortfall > 0 ? (
                <div className="cesta-warn strong">
                  ⚠ {Math.round(r.finishedShortfall)} além do estoque de acabados
                  — o saldo fica negativo até você registrar a produção.
                </div>
              ) : null}
              {r?.missingProduct ? (
                <div className="cesta-warn strong">
                  ⚠ Produto fora do catálogo e sem peça registrada — não há
                  custo a usar; esta linha entra com custo R$ 0.
                </div>
              ) : null}
              {r && r.supplyShortfall > 0 ? (
                <div className="cesta-warn">
                  Os acessórios do conjunto passam {Math.round(r.supplyShortfall)}{" "}
                  un do estoque de insumos — o saldo deles fica negativo.
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

      {/* UX-32 — o botão desabilitado DIZ o que falta. Sem isto o dono clicaria
          em "Registrar venda" e nada aconteceria: a caixa âmbar do item está
          longe do rodapé, e num recibo de vários itens ele não saberia qual. */}
      {/* W6: o preview não conseguiu estornar o recibo antigo — o botão trava
          e a tela diz por quê, em vez de o modal cair. */}
      {reconError ? <div className="form-error">{reconError}</div> : null}
      {error ? <div className="form-error">{error}</div> : null}
    </Modal>
  );
}
