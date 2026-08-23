import type { ProductInput, ProductPayload } from "../types";
import { stripFilamentIds } from "./filaments";

// O estado do formulário → o DOCUMENTO que vai pro Firestore. Pura e exportada
// de propósito: é o outro lado do `buildLoadedProduct`, e o par só se prova com
// um diff campo a campo do documento (FORM-01 — preço não é canário).
//
// ⚠ Toda chave gravada aqui é uma decisão: o que esta função esquecer vira
// `null`/ausente no save seguinte, sem mover um centavo no preço. Campo novo
// entra AQUI e no `buildLoadedProduct` no mesmo commit.
export function buildProductPayload(
  product: ProductInput,
  includeFixed: boolean,
  includeCreatedAt: boolean,
): ProductPayload {
  // Produtos novos gravam `filaments` (FEAT-02) e não persistem os escalares
  // legados `weightG`/`filamentPricePerKg` — removidos aqui do spread.
  const base = { ...product };
  delete base.weightG;
  delete base.filamentPricePerKg;
  // O `id` do documento é o CAMINHO no Firestore, não um campo dele: o
  // `toSavedProduct` sempre usa o id do doc e nunca lê `data.id`. Ele chega
  // aqui de carona no estado do form (o `loadProduct` espalha o `SavedProduct`
  // inteiro), e gravá-lo criava uma cópia que ninguém lê — e que em "salvar
  // como novo" ficava apontando para o produto ORIGINAL, errada e silenciosa.
  delete (base as { id?: string }).id;
  // TD-022: o `rev` viaja no `SavedProduct` e o `buildLoadedProduct` espalha o
  // objeto inteiro no estado do formulário — se ele sobrevivesse até aqui, o
  // payload gravaria a versão VELHA por cima da nova que a transação acabou de
  // escrever, e o contador andaria para trás. Quem grava o `rev` é o
  // repositório, e só ele.
  delete (base as { rev?: number }).rev;
  return {
    ...base,
    name: product.name.trim(),
    mainStageName: product.mainStageName.trim(),
    includeFixed,
    filaments: stripFilamentIds(product.filaments),
    stages: product.stages.map((stage, index) => ({
      // FEAT-01: persiste o id (chave estável dos subitens); sempre presente
      // no estado do form, com fallback por posição por segurança.
      id: stage.id ?? `stage_${index}`,
      name: stage.name ?? "",
      machineId: stage.machineId,
      printHours: stage.printHours,
      laborMinutes: stage.laborMinutes,
      // Tarifa e valor-hora NÃO se repetem aqui: são do produto. Copiá-los
      // para dentro da etapa criava um override que o formulário não sabia
      // editar e que a produção ignorava.
      filaments: stripFilamentIds(stage.filaments),
    })),
    accessories: product.accessories.map((accessory) => ({
      desc: accessory.desc ?? "",
      qty: accessory.qty || 0,
      unitPrice: accessory.unitPrice || 0,
      // FEAT-01: atribuição a subitem (null = produto, rateado). Firestore não
      // aceita undefined, por isso o ?? null.
      subitemId: accessory.subitemId ?? null,
      // 7e: insumo do estoque (null = avulso, sem baixa na produção).
      supplyId: accessory.supplyId ?? null,
    })),
    // FEAT-01: modo de venda por subitens + os grupos. Limpa `markup` ausente
    // (Firestore rejeita undefined) — ausente = herda o markup do produto.
    sellBySubitems: product.sellBySubitems ?? false,
    subitems: (product.subitems ?? []).map((subitem) => ({
      id: subitem.id,
      name: subitem.name ?? "",
      stageKeys: subitem.stageKeys ?? [],
      ...(subitem.markup !== undefined ? { markup: subitem.markup } : {}),
    })),
    linkModel: product.linkModel.trim(),
    linkCompetitor: product.linkCompetitor.trim(),
    linkFile: product.linkFile.trim(),
    fixedCostPerHour: null,
    combineEnabled: null,
    stage2: null,
    ...(includeCreatedAt ? { createdAt: Date.now() } : {}),
  };
}
