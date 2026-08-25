// Guarda de escrita + mensagem de erro, compartilhadas por toda tela que grava
// (UX-15). Nasceram copiadas em StockPage/SuppliesTab/ProductionPage, mais uma
// 4ª cópia inline na QuotePage — uma correção de texto tinha 4 lugares para ir.

// A frase, uma vez só. O `SaleModal` precisa do TEXTO sem o `throw` (ele trata o
// offline no meio do fluxo, com `setError` próprio) e repetia a string na mão.
// A `QuotePage` é o caso oposto e legítimo: lá o motivo é OUTRO (o número
// precisa ser reservado no servidor), então ela tem frase própria — o que ela
// reaproveita daqui é o `isOffline`, não o texto (TD-029).
export const OFFLINE_MESSAGE =
  "Sem conexão com a internet. Reconecte e tente de novo — nada foi salvo ainda.";

// Offline o Firestore ENFILEIRA a escrita e a Promise fica pendente para sempre
// (nem resolve, nem rejeita) — o botão travaria em "Salvando..." sem nunca
// terminar. Por isso a checagem vem ANTES de qualquer `await`: falha rápido,
// com aviso, e nada é gravado pela metade.
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function guardOnline() {
  if (isOffline()) {
    throw new Error(OFFLINE_MESSAGE);
  }
}

// O `catch` recebe `unknown`. Erro do Firestore (e o do `guardOnline`) traz
// `message` útil; o resto vira uma frase honesta em vez de "[object Object]".
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Não foi possível salvar.";
}

// AUD-14 [D2] — o `guardOnline` acima só sabe o que o `navigator.onLine` conta,
// e ele conta MAL o caso comum de quiosque: Wi-Fi conectado sem internet
// (portal cativo, DNS que engole) deixa o flag em `true`. Aí nenhuma guarda
// dispara, o SDK do Firestore enfileira a escrita e a Promise fica pendente
// PARA SEMPRE — nem resolve, nem rejeita. Medido na varredura: 4 cliques em
// "Salvar", `saveError` = null, status "Sincronizado", e nada gravado.
//
// O timeout devolve o controle à tela. Ele NÃO cancela a escrita (o SDK não tem
// cancelamento): ela continua na fila e ENTRA sozinha quando a rede voltar —
// foi exatamente o modo 2 da medição, em que o produto apareceu atrasado
// (97 → 98). Por isso a frase manda CONFERIR, e não repetir: repetir grava duas
// vezes. É a diferença entre esta mensagem e a do `guardOnline`, que pode
// prometer "nada foi salvo ainda" porque barra ANTES de qualquer await.
export const WRITE_TIMEOUT_SECONDS = 12;

// A importação em lote (até 500 documentos por commit) tem direito a mais
// tempo: ali a demora pode ser trabalho de verdade, não rede morta.
export const BATCH_TIMEOUT_SECONDS = 45;

export function writeTimeoutMessage(seconds: number): string {
  return (
    `O servidor não respondeu em ${seconds}s — a conexão caiu no meio da ` +
    "gravação. NÃO repita a ação: ela pode entrar sozinha quando a rede " +
    "voltar. Recarregue a página e confira antes de tentar de novo."
  );
}

export function withWriteTimeout<T>(
  promise: Promise<T>,
  seconds: number = WRITE_TIMEOUT_SECONDS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const alarme = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(writeTimeoutMessage(seconds))),
      seconds * 1000,
    );
  });
  // O `race` já pendura handler nos dois lados, então a rejeição perdedora
  // (a do alarme, ou a da escrita que falha tarde demais) não vira
  // `unhandledRejection`. O `finally` limpa o timer para o processo não ficar
  // acordado 12s depois de cada gravação bem-sucedida.
  return Promise.race([promise, alarme]).finally(() => clearTimeout(timer));
}
