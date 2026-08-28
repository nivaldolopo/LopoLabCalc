import { describe, expect, it } from "vitest";
import { cloudStatusOf, COM_METADATA } from "./cloudStatus";

// AUD-15 [E4]. As quatro combinações de `SnapshotMetadata`, com o cenário real
// de cada uma — o valor do teste está em fixar que só UMA delas pode dizer
// "Sincronizado".
describe("cloudStatusOf", () => {
  it("servidor confirmou o conjunto → synced", () => {
    expect(
      cloudStatusOf({ fromCache: false, hasPendingWrites: false }),
    ).toBe("synced");
  });

  it("rede caída, dado servido do cache → offline (o defeito do [E4])", () => {
    expect(cloudStatusOf({ fromCache: true, hasPendingWrites: false })).toBe(
      "offline",
    );
  });

  it("escrita local ainda não confirmada → pending, nunca offline", () => {
    // Online, entre o clique em Salvar e o ack do servidor, o Firestore entrega
    // o doc otimista com `fromCache: true`. Se `fromCache` viesse primeiro, o
    // chip piscaria "Sem conexão" a cada gravação.
    expect(cloudStatusOf({ fromCache: true, hasPendingWrites: true })).toBe(
      "pending",
    );
  });

  it("pendência sem cache (combinação que o SDK não emite) → pending", () => {
    // Defensivo: `hasPendingWrites` sozinho continua significando "o servidor
    // não confirmou", então a resposta honesta não é "synced".
    expect(cloudStatusOf({ fromCache: false, hasPendingWrites: true })).toBe(
      "pending",
    );
  });

  it("a assinatura pede mudança de metadado", () => {
    // Sem isto o evento da queda de rede não chega: os documentos não mudam.
    expect(COM_METADATA.includeMetadataChanges).toBe(true);
  });
});
