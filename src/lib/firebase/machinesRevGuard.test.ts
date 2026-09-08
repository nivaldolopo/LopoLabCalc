import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentData } from "firebase/firestore";
import type { Machine } from "@/features/pricing-calculator/types";

// AUD-18 — a trava de concorrência do doc COMPARTILHADO `config/machines`.
//
// ⚠ Por que este arquivo existe: o defeito não estava na matemática da frota
// (que a AUD-17 varreu e achou sã) nem no formulário. Estava no CICLO — ler a
// lista por snapshot, segurar um rascunho enquanto o dono digita, e gravar a
// lista INTEIRA por cima. Duas telas fazendo isso apagam a alteração uma da
// outra, e um teste sobre `persistMachines` isolado passa com o bug dentro:
// sem um segundo escritor não há o que perder.
//
// Medido no app antes da correção: com o fundo da tela já mostrando o nome que
// o outro dispositivo gravou e o rascunho ainda mostrando o antigo, salvar
// apagou a alteração do outro lado, sem aviso em nenhuma das duas telas.

type Store = Map<string, DocumentData>;
const { store } = vi.hoisted(() => ({ store: new Map() as Store }));

vi.mock("./client", () => ({ db: { __fake: true }, auth: {} }));

vi.mock("firebase/firestore", () => {
  type Ref = { path: string; __kind: "doc" };
  const doc = (_base: unknown, ...segments: string[]) => ({
    path: segments.filter(Boolean).join("/"),
    __kind: "doc" as const,
  });
  const snapshot = (path: string) => {
    const data = store.get(path);
    return {
      id: path.split("/").pop() ?? "",
      exists: () => data !== undefined,
      data: () => data,
    };
  };
  return {
    doc,
    onSnapshot: () => () => {},
    // As escritas só entram no store quando o corpo termina SEM lançar — é o
    // que torna "nada foi gravado" verificável.
    runTransaction: async (
      _db: unknown,
      body: (tx: unknown) => Promise<unknown>,
    ) => {
      const pending: (() => void)[] = [];
      const tx = {
        get: async (ref: Ref) => snapshot(ref.path),
        set: (ref: Ref, data: DocumentData) =>
          pending.push(() => void store.set(ref.path, data)),
      };
      const out = await body(tx);
      pending.forEach((write) => write());
      return out;
    },
  };
});

const { persistMachines, proximaRevDeMaquinas, MaquinasDesatualizadasError } =
  await import("./machinesRepository");

const CAMINHO = "config/machines";

function maquina(id: string, name: string, weight = 40): Machine {
  return {
    id,
    name,
    price: 5299,
    lifeHours: 7500,
    watts: 95,
    maintenancePerHour: 0.12,
    weight,
  };
}

const FROTA = [maquina("a1", "A1 Combo"), maquina("x2d", "X2D Combo")];

beforeEach(() => {
  store.clear();
});

describe("proximaRevDeMaquinas", () => {
  it("versão batendo: avança uma", () => {
    expect(proximaRevDeMaquinas(4, 4)).toBe(5);
  });

  it("documento de ANTES da fase (sem rev) vale 0 — grava sem migração", () => {
    // É o caso real do doc que já está no banco: nunca teve o campo. A primeira
    // gravação de cada tela casa com o 0 que o `subscribeMachines` entrega.
    expect(proximaRevDeMaquinas(0, 0)).toBe(1);
  });

  it("servidor adiante do rascunho: RECUSA", () => {
    expect(() => proximaRevDeMaquinas(5, 4)).toThrow(
      MaquinasDesatualizadasError,
    );
  });

  // O conselho é o que separa esta frase da do estoque: aqui não há "refazer
  // sobre o saldo atual", há reabrir o diálogo sobre a lista atual.
  it("a frase manda REABRIR o diálogo, e não refazer sobre saldo", () => {
    try {
      proximaRevDeMaquinas(1, 0);
      throw new Error("deveria ter recusado");
    } catch (err) {
      const frase = (err as Error).message;
      expect(frase).toContain("Nada foi gravado");
      expect(frase).toContain("Gerenciar Máquinas");
      expect(frase).not.toContain("rolo");
    }
  });
});

describe("persistMachines", () => {
  it("primeira gravação (doc ausente) entra com rev 1", async () => {
    await persistMachines(FROTA, 0);
    expect(store.get(CAMINHO)?.rev).toBe(1);
    expect(store.get(CAMINHO)?.items).toHaveLength(2);
  });

  it("gravação em sequência avança a rev a cada save", async () => {
    await persistMachines(FROTA, 0);
    await persistMachines(FROTA, 1);
    expect(store.get(CAMINHO)?.rev).toBe(2);
  });

  // ESTA é a invariante que amarra o cluster, e a que reproduz o defeito
  // medido: a tela B grava, a tela A (rascunho velho) grava por cima.
  it("segunda tela com rascunho velho: RECUSA e o doc fica com o da primeira", async () => {
    // A tela B lê rev 0 e grava o nome novo.
    await persistMachines([maquina("a1", "A1 Mini ZZB")], 0);
    expect(store.get(CAMINHO)?.rev).toBe(1);

    // A tela A abriu ANTES, ainda acha que a versão é 0, e salva outra coisa.
    await expect(
      persistMachines([maquina("a1", "A1 Combo ZZA")], 0),
    ).rejects.toThrow(MaquinasDesatualizadasError);

    // Antes da correção este bloco falhava: o nome da tela B era apagado.
    const gravado = store.get(CAMINHO);
    expect(gravado?.rev).toBe(1);
    expect((gravado?.items as Machine[])[0].name).toBe("A1 Mini ZZB");
  });

  it("recusada, a gravação não deixa NADA pela metade", async () => {
    await persistMachines(FROTA, 0);
    const antes = JSON.stringify(store.get(CAMINHO));
    await expect(persistMachines([maquina("z", "Zebra")], 0)).rejects.toThrow();
    expect(JSON.stringify(store.get(CAMINHO))).toBe(antes);
  });

  // O peso é o campo que reprecifica o catálogo inteiro — o round-trip dele
  // pelo caminho novo é o que o FORM-01 manda conferir campo a campo.
  it("o documento gravado leva os 7 campos da máquina, o peso incluído", async () => {
    await persistMachines([maquina("x2d", "X2D Combo", 40)], 0);
    expect((store.get(CAMINHO)?.items as DocumentData[])[0]).toEqual({
      id: "x2d",
      name: "X2D Combo",
      price: 5299,
      lifeHours: 7500,
      watts: 95,
      maintenancePerHour: 0.12,
      weight: 40,
    });
  });
});
