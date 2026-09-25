// S5 (lote 5 da 3a) — as REGRAS do Storage contra o motor de regras de verdade
// (emulador), no mesmo molde do `firestoreRules.emulator.test.ts` (AUD-08). Não
// roda no `pnpm test`; sobe por `pnpm test:rules`, que liga os dois emuladores.
//
// O que se prova: (1) a lista de e-mails é a mesma do app; (2) estranho e
// visitante não leem nem gravam; (3) o autorizado lê, grava e apaga SÓ em
// `impressoes/`; (4) as duas travas próprias do Storage — só imagem, e < 2 MB;
// (5) a sonda tem dentes (um ruleset frouxo deixaria o estranho passar).
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { ALLOWED_EMAILS } from "@/features/pricing-calculator/constants";

const REGRAS_REAIS = readFileSync("storage.rules", "utf8");

const REGRAS_FROUXAS = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{all=**} { allow read, write: if request.auth != null; }
  }
}`;

const CAPA = "impressoes/1214307195/capa.png";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
const IMG = { contentType: "image/png" };

type Token = { email?: string; email_verified?: boolean };
type Storage = ReturnType<ReturnType<RulesTestEnvironment["unauthenticatedContext"]>["storage"]>;

const ESTRANHOS: [string, Token][] = [
  ["verificada, fora da lista", { email: "estranho@gmail.com", email_verified: true }],
  ["autorizado em CAIXA ALTA", { email: "Nivaldo.Lopo@gmail.com", email_verified: true }],
  ["autorizado com sufixo colado", { email: "nivaldo.lopo@gmail.com.evil.com", email_verified: true }],
  ["autorizado, porém email_verified FALSO", { email: "nivaldo.lopo@gmail.com", email_verified: false }],
  ["autorizado, porém SEM a claim email_verified", { email: "nivaldo.lopo@gmail.com" }],
  ["logado sem e-mail (anônimo)", {}],
];

// O `put` do SDK devolve um `UploadTask`, que é "thenable" mas não `Promise` —
// o `assertFails` aceita em runtime, o `tsc` não. Converter aqui mantém as
// sondas legíveis.
function put(s: Storage, path: string, data: Uint8Array, meta: { contentType: string }) {
  return Promise.resolve(s.ref(path).put(data, meta));
}

function operacoes(s: Storage): [string, () => Promise<unknown>][] {
  return [
    ["ler capa existente", () => s.ref(CAPA).getMetadata()],
    ["baixar URL da capa", () => s.ref(CAPA).getDownloadURL()],
    ["gravar capa nova", () => put(s, "impressoes/999/capa.png", PNG, IMG)],
    ["sobrescrever capa", () => put(s, CAPA, PNG, IMG)],
    ["apagar capa", () => s.ref(CAPA).delete()],
  ];
}

// ⚠ Diferente do Firestore, o emulador do Storage tem UM ruleset para todos os
// projetos: subir o ambiente frouxo SOBRESCREVE as regras reais. Medido na 1ª
// rodada — com os dois no `beforeAll`, todo "nega" passou a ser "permite" (34
// falhas). Por isso o frouxo só sobe no ÚLTIMO bloco, depois que o real já foi
// medido, e nunca convive com ele.
let real: RulesTestEnvironment;

async function semear(env: RulesTestEnvironment) {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await put(ctx.storage(), CAPA, PNG, IMG);
  });
}

beforeAll(async () => {
  real = await initializeTestEnvironment({ projectId: "s5-real", storage: { rules: REGRAS_REAIS } });
});
afterAll(async () => {
  await real?.cleanup();
});
beforeEach(async () => {
  await semear(real);
});

const autorizado = (email: string = ALLOWED_EMAILS[0]) =>
  real.authenticatedContext(`uid-${email}`, { email, email_verified: true }).storage();

describe("regras do Storage — quem NÃO passa", () => {
  it("a lista da regra é a mesma do ALLOWED_EMAILS do app", () => {
    const naRegra = [...REGRAS_REAIS.matchAll(/'([^']+@[^']+)'/g)].map((m) => m[1]);
    for (const email of ALLOWED_EMAILS) {
      if (!naRegra.includes(email)) throw new Error(`${email} está no app e NÃO na regra`);
    }
    for (const email of naRegra) {
      if (!ALLOWED_EMAILS.includes(email)) throw new Error(`${email} está na regra e NÃO no app`);
    }
  });

  describe("visitante sem token", () => {
    for (const [nome] of operacoes({} as Storage)) {
      it(`nega ${nome}`, async () => {
        const s = real.unauthenticatedContext().storage();
        await assertFails(operacoes(s).find(([n]) => n === nome)![1]());
      });
    }
  });

  for (const [rotulo, token] of ESTRANHOS) {
    describe(rotulo, () => {
      for (const [nome] of operacoes({} as Storage)) {
        it(`nega ${nome}`, async () => {
          const s = real.authenticatedContext("uid-estranho", token).storage();
          await assertFails(operacoes(s).find(([n]) => n === nome)![1]());
        });
      }
    });
  }
});

describe("regras do Storage — quem passa", () => {
  for (const email of ALLOWED_EMAILS) {
    describe(`${email} (verificado)`, () => {
      for (const [nome] of operacoes({} as Storage)) {
        it(`permite ${nome}`, async () => {
          await assertSucceeds(operacoes(autorizado(email)).find(([n]) => n === nome)![1]());
        });
      }
    });
  }
});

describe("as travas próprias do Storage (valem até pro autorizado)", () => {
  it("fora de impressoes/ não existe — nem gravar, nem ler", async () => {
    const s = autorizado();
    await assertFails(put(s, "outra/pasta/x.png", PNG, IMG));
    await assertFails(put(s, "x.png", PNG, IMG));
    await assertFails(s.ref("outra/pasta/x.png").getMetadata());
  });

  it("subpasta funda dentro de impressoes/ também não", async () => {
    await assertFails(put(autorizado(), "impressoes/1/extra/capa.png", PNG, IMG));
  });

  it("só imagem: PDF/texto é recusado", async () => {
    const s = autorizado();
    await assertFails(put(s, "impressoes/1/capa.png", PNG, { contentType: "application/pdf" }));
    await assertFails(put(s, "impressoes/1/capa.png", PNG, { contentType: "text/plain" }));
  });

  it("2 MB ou mais é recusado; logo abaixo passa", async () => {
    const s = autorizado();
    await assertFails(put(s, "impressoes/1/capa.png", new Uint8Array(2 * 1024 * 1024), IMG));
    await assertSucceeds(put(s, "impressoes/1/capa.png", new Uint8Array(2 * 1024 * 1024 - 1), IMG));
  });
});

describe("a sonda tem dentes (ruleset FROUXO de propósito) — SEMPRE o último bloco", () => {
  let frouxo: RulesTestEnvironment;
  beforeAll(async () => {
    frouxo = await initializeTestEnvironment({ projectId: "s5-frouxo", storage: { rules: REGRAS_FROUXAS } });
    await semear(frouxo);
  });
  afterAll(async () => {
    await frouxo?.cleanup();
  });

  it("o estranho verificado PASSA no frouxo — então o 'nega' acima é a regra, não a fiação", async () => {
    const s = frouxo
      .authenticatedContext("uid-estranho", { email: "estranho@gmail.com", email_verified: true })
      .storage();
    await assertSucceeds(s.ref(CAPA).getMetadata());
    await assertSucceeds(put(s, "impressoes/999/capa.png", PNG, IMG));
  });
});
