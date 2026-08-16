// Guarda de escrita + mensagem de erro, compartilhadas por toda tela que grava
// (UX-15). Nasceram copiadas em StockPage/SuppliesTab/ProductionPage, mais uma
// 4ª cópia inline na QuotePage — uma correção de texto tinha 4 lugares para ir.

// Offline o Firestore ENFILEIRA a escrita e a Promise fica pendente para sempre
// (nem resolve, nem rejeita) — o botão travaria em "Salvando..." sem nunca
// terminar. Por isso a checagem vem ANTES de qualquer `await`: falha rápido,
// com aviso, e nada é gravado pela metade.
export function guardOnline() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(
      "Sem conexão com a internet. Reconecte e tente de novo — nada foi salvo ainda.",
    );
  }
}

// O `catch` recebe `unknown`. Erro do Firestore (e o do `guardOnline`) traz
// `message` útil; o resto vira uma frase honesta em vez de "[object Object]".
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Não foi possível salvar.";
}
