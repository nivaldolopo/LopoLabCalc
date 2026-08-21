import { describe, expect, it } from "vitest";
import { createAccessory } from "./usePricingForm";

// O caminho "carregar no formulário" reconstrói cada acessório campo a campo.
// Um campo esquecido aqui não é só exibição errada: o `buildPayload` grava
// `supplyId: accessory.supplyId ?? null` no save seguinte, então o vínculo com
// o insumo MORRE ao abrir e salvar um produto sem tocar em nada — e o preço não
// se move, porque `unitPrice` sobrevive. Silencioso por construção.
describe("createAccessory — o acessório carregado do produto salvo", () => {
  const salvo = {
    desc: "Argola",
    qty: 2,
    unitPrice: 0.43,
    supplyId: "sup_argola",
    subitemId: "sub_topo",
  };

  it("mantém o supplyId — é o que dá baixa do insumo na produção", () => {
    expect(createAccessory(0, salvo).supplyId).toBe("sup_argola");
  });

  it("mantém o subitemId — o custo vai 100% para a parte, não rateado", () => {
    expect(createAccessory(0, salvo).subitemId).toBe("sub_topo");
  });

  it("mantém descrição, quantidade e preço", () => {
    const accessory = createAccessory(0, salvo);
    expect(accessory.desc).toBe("Argola");
    expect(accessory.qty).toBe(2);
    expect(accessory.unitPrice).toBe(0.43);
  });

  it("nasce avulso quando não há dado salvo — `null`, nunca `undefined`", () => {
    const novo = createAccessory(0);
    // O Firestore recusa `undefined`; o modo avulso é `null` explícito.
    expect(novo.supplyId).toBeNull();
    expect(novo.subitemId).toBeNull();
  });
});
