import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentData } from "firebase/firestore";
import type { FixedCostRate } from "@/features/pricing-calculator/types";

// Lote 1 da 3a — [W3] a trava de `rev` do `config/negocio` e [W2] a semeadura
// que não regrava o valor real. Mesmo molde do `machinesRevGuard.test.ts`: o
// defeito é do CICLO (foto → prévia → gravação), e só aparece com um segundo
// escritor.

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
    // As escritas só entram no store quando o corpo termina SEM lançar.
    runTransaction: async (
      _db: unknown,
      body: (tx: unknown) => Promise<unknown>,
    ) => {
      const pending: (() => void)[] = [];
      const tx = {
        get: async (ref: Ref) => snapshot(ref.path),
        set: (ref: Ref, data: DocumentData, opts?: { merge?: boolean }) =>
          pending.push(() =>
            void store.set(
              ref.path,
              opts?.merge ? { ...(store.get(ref.path) ?? {}), ...data } : data,
            ),
          ),
      };
      const out = await body(tx);
      pending.forEach((write) => write());
      return out;
    },
  };
});

const {
  persistEnergyTariff,
  persistFixedCostRate,
  proximaRevDoNegocio,
  seedBusinessSettings,
  NegocioDesatualizadoError,
} = await import("./businessSettingsRepository");

const CAMINHO = "config/negocio";

function taxa(rent: number): FixedCostRate {
  return { rent, other: 0, machines: 3, hoursDay: 10, daysMonth: 26 };
}

beforeEach(() => {
  store.clear();
});

describe("proximaRevDoNegocio", () => {
  it("versão batendo: avança uma", () => {
    expect(proximaRevDoNegocio(2, 2)).toBe(3);
  });

  it("servidor adiante da prévia: RECUSA, com frase que manda revisar de novo", () => {
    expect(() => proximaRevDoNegocio(3, 2)).toThrow(NegocioDesatualizadoError);
    try {
      proximaRevDoNegocio(3, 2);
    } catch (err) {
      expect((err as Error).message).toContain("Nada foi gravado");
    }
  });
});

describe("persistFixedCostRate / persistEnergyTariff", () => {
  it("doc de ANTES do lote (sem rev) grava contra 0, sem migração", async () => {
    store.set(CAMINHO, { fixedCosts: taxa(1000), energyTariff: 0.85 });
    await persistFixedCostRate(taxa(1200), 0);
    expect(store.get(CAMINHO)?.rev).toBe(1);
    expect(store.get(CAMINHO)?.fixedCosts.rent).toBe(1200);
    // merge: a tarifa não é tocada.
    expect(store.get(CAMINHO)?.energyTariff).toBe(0.85);
  });

  // O cenário do W3: A abre a prévia em R0, B aplica R1, A aplica R2.
  it("prévia velha: RECUSA, e o valor da outra aba fica", async () => {
    store.set(CAMINHO, { fixedCosts: taxa(1000), energyTariff: 0.85, rev: 4 });
    await persistFixedCostRate(taxa(1100), 4); // B
    await expect(persistFixedCostRate(taxa(1300), 4)).rejects.toThrow(
      NegocioDesatualizadoError,
    ); // A
    expect(store.get(CAMINHO)?.fixedCosts.rent).toBe(1100);
    expect(store.get(CAMINHO)?.rev).toBe(5);
  });

  // Uma versão só para o doc inteiro: a prévia de energia conta o custo fixo
  // dos dois lados, então mexer no custo fixo invalida a prévia de energia.
  it("mudança de custo fixo invalida a prévia de ENERGIA aberta antes", async () => {
    store.set(CAMINHO, { fixedCosts: taxa(1000), energyTariff: 0.85, rev: 1 });
    await persistFixedCostRate(taxa(1100), 1);
    await expect(persistEnergyTariff(0.9, 1)).rejects.toThrow(
      NegocioDesatualizadoError,
    );
    expect(store.get(CAMINHO)?.energyTariff).toBe(0.85);
  });
});

describe("seedBusinessSettings [W2]", () => {
  it("doc ausente no servidor: semeia os dois campos", async () => {
    expect(await seedBusinessSettings(taxa(0), 0.85)).toBe(true);
    expect(store.get(CAMINHO)).toMatchObject({ energyTariff: 0.85, rev: 1 });
  });

  // O defeito: um "não existe" do CACHE disparava `setDoc(merge)` dos padrões
  // por cima do custo fixo real. A decisão agora é do SERVIDOR.
  it("doc que existe no servidor: não regrava NADA", async () => {
    store.set(CAMINHO, { fixedCosts: taxa(1500), energyTariff: 0.92, rev: 7 });
    const antes = JSON.stringify(store.get(CAMINHO));
    expect(await seedBusinessSettings(taxa(0), 0.85)).toBe(false);
    expect(JSON.stringify(store.get(CAMINHO))).toBe(antes);
  });

  it("doc sem a tarifa: semeia SÓ ela, e o custo fixo fica", async () => {
    store.set(CAMINHO, { fixedCosts: taxa(1500), rev: 2 });
    expect(await seedBusinessSettings(taxa(0), 0.85)).toBe(true);
    expect(store.get(CAMINHO)?.fixedCosts.rent).toBe(1500);
    expect(store.get(CAMINHO)?.energyTariff).toBe(0.85);
    expect(store.get(CAMINHO)?.rev).toBe(3);
  });
});
