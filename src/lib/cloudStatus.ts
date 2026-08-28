// AUD-15 [E4] — de onde veio o dado que está na tela, e o chip que o conta.
//
// O defeito: o chip do cabeçalho dizia "Sincronizado" com a rede do Firestore
// derrubada (medido com `disableNetwork(db)`, 12 leituras em 18s — conjunto de
// um único valor). O motivo é que o `onSnapshot` ENTREGA quando a rede cai: ele
// serve do cache local e chama o mesmo callback de sucesso. Os hooks liam esse
// callback como prova de vida e faziam `setStatus("synced")`.
//
// `navigator.onLine` NÃO resolve (é o mesmo furo do `guardOnline`, ver
// `errors.ts`): Wi-Fi conectado sem internet o mantém `true`. Quem sabe a
// verdade é o próprio snapshot, no `metadata`.
import type { CloudStatus } from "@/features/pricing-calculator/types";

// ⚠ Sem isto o Firestore NÃO entrega o evento que só muda metadados — e a queda
// da rede é exatamente isso: os documentos continuam iguais, o que muda é a
// ORIGEM deles. Era o que faltava para a tela saber. (A `subscribeSalesPage` já
// pedia, pelo TD-019, e tinha a constante só dela.)
export const COM_METADATA = { includeMetadataChanges: true } as const;

// O mínimo do `SnapshotMetadata` do Firestore. Tipo próprio (e não o do SDK)
// para a função abaixo ser pura e testável sem subir o Firebase; o
// `snapshot.metadata` satisfaz esta forma estruturalmente, então os
// repositórios o repassam cru.
export type SnapshotOrigin = {
  fromCache: boolean;
  hasPendingWrites: boolean;
};

// A ordem importa e é o coração do item:
//
//  • `hasPendingWrites` primeiro — enquanto uma escrita local não voltou do
//    servidor, o snapshot chega com `fromCache: true` mesmo ONLINE (é a
//    compensação de latência). Sem esta linha, todo salvamento faria o chip
//    piscar "Sem conexão", que é a mentira oposta.
//  • `fromCache` sem escrita pendente é o caso do [E4]: dado de cache, servidor
//    inalcançável.
//
// Nenhum dos dois ramos diz "Sincronizado" — o chip só afirma isso quando o
// servidor confirmou o conjunto inteiro.
export function cloudStatusOf(origin: SnapshotOrigin): CloudStatus {
  if (origin.hasPendingWrites) return "pending";
  if (origin.fromCache) return "offline";
  return "synced";
}
