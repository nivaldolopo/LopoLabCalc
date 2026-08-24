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
