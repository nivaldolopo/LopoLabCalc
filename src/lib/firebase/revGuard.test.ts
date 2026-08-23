import { describe, expect, it } from "vitest";
import type { DocumentReference, Transaction } from "firebase/firestore";
import { EstoqueDesatualizadoError, lerEConferirRevs } from "./revGuard";

// TD-022 — a trava que impede duas gravações simultâneas de apagarem a baixa
// uma da outra. A transação do Firestore é falsificada aqui: o que se testa é a
// REGRA (versão bate / não bate / documento sumiu), não o SDK.

type Doc = { rev?: number } | null;

function fakeTx(docs: Record<string, Doc>): Transaction {
  return {
    get: async (ref: DocumentReference) => {
      const data = docs[ref.path];
      return {
        exists: () => data !== null && data !== undefined,
        data: () => data ?? undefined,
      };
    },
  } as unknown as Transaction;
}

const ref = (path: string) => ({ path }) as unknown as DocumentReference;

describe("lerEConferirRevs", () => {
  it("versões batendo: devolve a versão atual de cada documento, na ordem", async () => {
    const tx = fakeTx({ "estoque/bege": { rev: 4 }, "insumos/ima": { rev: 0 } });
    const revs = await lerEConferirRevs(tx, [
      { ref: ref("estoque/bege"), esperado: 4, nome: 'A cor "Bege"' },
      { ref: ref("insumos/ima"), esperado: 0, nome: 'O insumo "Ímã"' },
    ]);
    expect(revs).toEqual([4, 0]);
  });

  it("documento que avançou desde o plano: RECUSA, nomeando qual", async () => {
    // É o caso real: outra venda (ou a tela do estoque) gravou no meio.
    const tx = fakeTx({ "estoque/bege": { rev: 5 } });
    await expect(
      lerEConferirRevs(tx, [
        { ref: ref("estoque/bege"), esperado: 4, nome: 'A cor "Bege"' },
      ]),
    ).rejects.toThrow(EstoqueDesatualizadoError);
    await expect(
      lerEConferirRevs(tx, [
        { ref: ref("estoque/bege"), esperado: 4, nome: 'A cor "Bege"' },
      ]),
    ).rejects.toThrow(/Bege/);
  });

  it("documento SEM o campo `rev` vale 0 — os antigos não precisam de migração", async () => {
    const tx = fakeTx({ "estoque/antiga": {} });
    await expect(
      lerEConferirRevs(tx, [
        { ref: ref("estoque/antiga"), esperado: 0, nome: "A cor antiga" },
      ]),
    ).resolves.toEqual([0]);
  });

  it("cor ou insumo que sumiu: RECUSA — o plano os debitou, logo existiam", async () => {
    const tx = fakeTx({ "estoque/apagada": null });
    await expect(
      lerEConferirRevs(tx, [
        { ref: ref("estoque/apagada"), esperado: 2, nome: "A cor apagada" },
      ]),
    ).rejects.toThrow(EstoqueDesatualizadoError);
  });

  it("acabado ainda inexistente é LEGÍTIMO: id determinístico, a 1ª produção cria", async () => {
    const tx = fakeTx({ "acabados/prod1": null });
    await expect(
      lerEConferirRevs(tx, [
        {
          ref: ref("acabados/prod1"),
          esperado: 0,
          nome: "As peças prontas",
          podeNaoExistir: true,
        },
      ]),
    ).resolves.toEqual([0]);
  });

  it("mas acabado que sumiu DEPOIS de o plano vê-lo ainda recusa", async () => {
    // `esperado > 0` diz que o plano leu um doc existente; sumir no meio é a
    // mesma corrida que o resto — e reescrever por cima recriaria camadas que
    // alguém apagou de propósito.
    const tx = fakeTx({ "acabados/prod1": null });
    await expect(
      lerEConferirRevs(tx, [
        {
          ref: ref("acabados/prod1"),
          esperado: 3,
          nome: "As peças prontas",
          podeNaoExistir: true,
        },
      ]),
    ).rejects.toThrow(EstoqueDesatualizadoError);
  });

  it("recusa na PRIMEIRA divergência, mesmo com alvos sãos depois", async () => {
    const tx = fakeTx({
      "estoque/a": { rev: 9 },
      "estoque/b": { rev: 1 },
    });
    await expect(
      lerEConferirRevs(tx, [
        { ref: ref("estoque/a"), esperado: 1, nome: 'A cor "A"' },
        { ref: ref("estoque/b"), esperado: 1, nome: 'A cor "B"' },
      ]),
    ).rejects.toThrow(/"A"/);
  });
});
