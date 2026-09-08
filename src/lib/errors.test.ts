import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EscritaExpiradaError,
  mensagemDeFalhaNaGravacao,
  OFFLINE_MESSAGE,
  OfflineError,
  WRITE_TIMEOUT_SECONDS,
  withWriteTimeout,
  writeTimeoutMessage,
} from "./errors";
import { EstoqueDesatualizadoError } from "./firebase/revGuard";

// AUD-14 [D2]. O defeito medido não foi "a escrita falhou": foi a escrita que
// NUNCA responde. Com Wi-Fi conectado sem internet o `navigator.onLine` fica em
// `true`, o `guardOnline` não dispara e a Promise do Firestore fica pendente
// para sempre — nem resolve, nem rejeita. O que estes testes travam é o
// contrato do socorro: ele desiste no prazo, deixa passar o caminho feliz
// intacto e não mente sobre o que aconteceu com o documento.

afterEach(() => {
  vi.useRealTimers();
});

// Uma Promise que nunca se resolve — o comportamento REAL do SDK offline.
function pendurada<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

describe("withWriteTimeout", () => {
  it("deixa passar o valor de uma escrita que responde", async () => {
    await expect(withWriteTimeout(Promise.resolve("id-novo"))).resolves.toBe(
      "id-novo",
    );
  });

  it("repassa a falha real da escrita, sem trocá-la pela do timeout", async () => {
    const recusa = new Error("Produto desatualizado.");
    await expect(withWriteTimeout(Promise.reject(recusa))).rejects.toThrow(
      "Produto desatualizado.",
    );
  });

  it("não deixa timer pendurado quando a escrita responde", async () => {
    vi.useFakeTimers();
    await withWriteTimeout(Promise.resolve(1));
    // Sem o `clearTimeout`, cada gravação bem-sucedida deixaria o processo
    // acordado por mais 12s.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("desiste da espera quando a escrita nunca responde", async () => {
    vi.useFakeTimers();
    const promessa = withWriteTimeout(pendurada<void>());
    const alcancado = vi.fn();
    promessa.then(alcancado, () => {});

    // Um segundo ANTES do prazo ainda não desistiu: quem responde devagar
    // (rede ruim, mas viva) não pode ser cortado.
    await vi.advanceTimersByTimeAsync((WRITE_TIMEOUT_SECONDS - 1) * 1000);
    expect(alcancado).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    await expect(promessa).rejects.toThrow(
      writeTimeoutMessage(WRITE_TIMEOUT_SECONDS),
    );
  });

  it("respeita o prazo maior da importação em lote", async () => {
    vi.useFakeTimers();
    const promessa = withWriteTimeout(pendurada<void>(), 45);
    const alcancado = vi.fn();
    promessa.then(alcancado, () => {});

    await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_SECONDS * 1000);
    expect(alcancado).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync((45 - WRITE_TIMEOUT_SECONDS) * 1000);
    await expect(promessa).rejects.toThrow(writeTimeoutMessage(45));
  });

  it("a escrita que falha DEPOIS do timeout não vira rejeição solta", async () => {
    vi.useFakeTimers();
    let recusar: (erro: Error) => void = () => {};
    const escrita = new Promise<void>((_, reject) => {
      recusar = reject;
    });
    const promessa = withWriteTimeout(escrita);
    promessa.catch(() => {});

    await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_SECONDS * 1000);
    await expect(promessa).rejects.toThrow("O servidor não respondeu");

    // O `race` já pendurou handler na escrita original: a falha atrasada é
    // absorvida em vez de derrubar o processo com `unhandledRejection`.
    const solta = vi.fn();
    process.on?.("unhandledRejection", solta);
    recusar(new Error("permission-denied"));
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    expect(solta).not.toHaveBeenCalled();
    process.off?.("unhandledRejection", solta);
  });
});

describe("writeTimeoutMessage", () => {
  it("diz o prazo e manda CONFERIR, não repetir", () => {
    const frase = writeTimeoutMessage(WRITE_TIMEOUT_SECONDS);
    expect(frase).toContain("12s");
    expect(frase).toContain("NÃO repita");
    expect(frase).toContain("confira");
  });

  // A diferença que importa entre as duas frases do arquivo. O `guardOnline`
  // barra ANTES de qualquer await e por isso pode prometer que nada foi salvo;
  // o timeout NÃO pode — a escrita segue enfileirada no SDK e pode entrar
  // sozinha quando a rede voltar (foi o que a varredura mediu: 97 → 98
  // produtos, atrasado). Prometer "nada foi salvo" aqui seria mentira.
  it("não repete a promessa do guardOnline de que nada foi salvo", () => {
    expect(OFFLINE_MESSAGE).toContain("nada foi salvo ainda");
    expect(writeTimeoutMessage(WRITE_TIMEOUT_SECONDS)).not.toContain(
      "nada foi salvo",
    );
  });
});

// AUD-18 — a frase que a TELA mostra. As invariantes acima moravam no lib e o
// `SaleModal` passava por cima delas: ele colava ". Nada foi salvo — tente de
// novo." em todo erro, inclusive no do timeout, que manda o OPOSTO. Medido na
// tela: "…NÃO repita a ação… confira antes de tentar de novo.. Nada foi salvo —
// tente de novo." — as duas metades se contradizendo numa linha só, com ponto
// duplicado no meio. É o [E8] da AUD-17 de novo: no JSX nenhum teste alcança.
describe("mensagemDeFalhaNaGravacao", () => {
  it("erro sem desfecho próprio ganha o conselho genérico", () => {
    const frase = mensagemDeFalhaNaGravacao(
      new Error("permission-denied."),
      "registrar venda",
    );
    expect(frase).toBe(
      "Erro ao registrar venda: permission-denied. Nada foi salvo — tente de novo.",
    );
  });

  it("erro que não termina em ponto não vira frase grudada", () => {
    const frase = mensagemDeFalhaNaGravacao(
      new Error("deu ruim"),
      "salvar venda",
    );
    expect(frase).toContain("deu ruim. Nada foi salvo");
  });

  it("valor que não é Error cai na frase honesta, sem [object Object]", () => {
    expect(mensagemDeFalhaNaGravacao({ x: 1 }, "registrar venda")).toBe(
      "Erro ao registrar venda: Não foi possível salvar. Nada foi salvo — tente de novo.",
    );
  });

  it("TIMEOUT: não ganha o sufixo que contradiz o próprio conselho", () => {
    const frase = mensagemDeFalhaNaGravacao(
      new EscritaExpiradaError(WRITE_TIMEOUT_SECONDS),
      "registrar venda",
    );
    expect(frase).toContain("NÃO repita");
    expect(frase).not.toContain("tente de novo.");
    expect(frase).not.toContain("Nada foi salvo");
  });

  it("TIMEOUT: sem o ponto duplicado que a tela mostrava", () => {
    const frase = mensagemDeFalhaNaGravacao(
      new EscritaExpiradaError(WRITE_TIMEOUT_SECONDS),
      "registrar venda",
    );
    expect(frase).not.toContain("..");
  });

  it("OFFLINE: a frase do guardOnline já se fecha sozinha", () => {
    const frase = mensagemDeFalhaNaGravacao(new OfflineError(), "salvar venda");
    expect(frase).toContain("nada foi salvo ainda");
    expect(frase).not.toContain("Nada foi salvo — tente de novo");
  });

  it("ESTOQUE desatualizado: mantém só o conselho de refazer sobre o saldo", () => {
    const frase = mensagemDeFalhaNaGravacao(
      new EstoqueDesatualizadoError('A cor "Bege"'),
      "registrar venda",
    );
    expect(frase).toContain("refaça o registro sobre o saldo atual");
    expect(frase).not.toContain("Nada foi salvo — tente de novo");
    expect(frase).not.toContain("..");
  });

  // A que amarra: seja qual for o erro, a tela nunca manda as DUAS coisas.
  it("nenhuma frase manda NÃO repetir e repetir ao mesmo tempo", () => {
    const erros: unknown[] = [
      new Error("qualquer coisa"),
      new OfflineError(),
      new EscritaExpiradaError(WRITE_TIMEOUT_SECONDS),
      new EstoqueDesatualizadoError('A cor "Bege"'),
      "nem Error é",
    ];
    for (const err of erros) {
      const frase = mensagemDeFalhaNaGravacao(err, "registrar venda");
      const proibe = frase.includes("NÃO repita");
      const manda = frase.includes("tente de novo");
      expect(proibe && manda).toBe(false);
    }
  });
});
