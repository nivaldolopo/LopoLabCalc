import type { Transaction, DocumentReference } from "firebase/firestore";

// TD-022 — a trava de concorrência do estoque, num lugar só.
//
// O problema: `writeBatch` é ATÔMICO, mas não é ISOLADO. Ele não relê nada. As
// baixas de filamento, insumo e acabado são calculadas no cliente a partir do
// saldo que a assinatura em tempo real entregou, e gravadas como o array
// `rolls`/`lots`/`skus` INTEIRO. Duas gravações simultâneas sobre a mesma cor
// (duas vendas, ou uma venda e uma produção) leem o mesmo saldo, calculam o
// mesmo resultado e gravam o mesmo array: uma das duas baixas simplesmente não
// aconteceu, e o furo só aparece quando alguém pesa o rolo.
//
// A saída é a mesma do `saveProduct`: um contador `rev` por documento, lido e
// conferido DENTRO de uma transação. Não é merge — se o saldo mudou desde que o
// plano foi calculado, a gravação é RECUSADA inteira. Refazer sobre o saldo novo
// é a única resposta correta: o FIFO pode ter atravessado outro rolo, e aí o
// custo congelado da venda sairia errado.
//
// Três repositórios precisavam disto (`vendas`, `producao` na criação e na
// exclusão), e a conferência escrita três vezes é a receita de divergirem — foi
// exatamente assim que o UX-42 nasceu, com duas implementações que PRECISAVAM
// concordar.

export class EstoqueDesatualizadoError extends Error {
  constructor(public readonly onde: string) {
    super(
      `${onde} mudou enquanto esta tela estava aberta (outra aba, outro ` +
        `dispositivo, ou outro registro salvo no meio). Nada foi gravado — ` +
        `refaça o registro sobre o saldo atual, senão a baixa sairia do rolo ` +
        `errado.`,
    );
    this.name = "EstoqueDesatualizadoError";
  }
}

export type AlvoComRev = {
  ref: DocumentReference;
  // A versão contra a qual o plano foi calculado. As funções puras a preservam
  // de carona no spread (`{...color}`), então ela chega aqui sem plumbing novo.
  esperado: number;
  // Como o documento se chama na frase do erro. Vem com artigo e em CAIXA ALTA
  // inicial, porque abre a frase: `A cor "Bege"`, `O insumo "Ímã"`.
  nome: string;
  // Documento que ainda não existe é legítimo para o ACABADO (id determinístico
  // = productId; a primeira produção o cria) e ilegítimo para cor e insumo, que
  // já tinham de existir para o plano tê-los debitado.
  podeNaoExistir?: boolean;
};

/**
 * Lê os documentos DENTRO da transação, confere cada `rev` e devolve a versão
 * atual de cada um, na mesma ordem. Chame ANTES de qualquer escrita — a
 * transação do Firestore exige toda leitura primeiro.
 *
 * Lança `EstoqueDesatualizadoError` na primeira divergência, e aí nada é
 * gravado: a transação inteira é abortada.
 */
export async function lerEConferirRevs(
  tx: Transaction,
  alvos: AlvoComRev[],
): Promise<number[]> {
  const snaps = await Promise.all(alvos.map((alvo) => tx.get(alvo.ref)));
  return snaps.map((snap, i) => {
    const alvo = alvos[i];
    if (!snap.exists()) {
      if (!alvo.podeNaoExistir) throw new EstoqueDesatualizadoError(alvo.nome);
      // Doc ausente e ausência esperada: a versão é 0, e o plano precisa ter
      // sido calculado sobre a mesma ausência.
      if (alvo.esperado !== 0) throw new EstoqueDesatualizadoError(alvo.nome);
      return 0;
    }
    const atual = Number(snap.data().rev) || 0;
    if (atual !== alvo.esperado) throw new EstoqueDesatualizadoError(alvo.nome);
    return atual;
  });
}
