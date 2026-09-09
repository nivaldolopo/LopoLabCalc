// AUD-08 — as REGRAS do Firestore contra o motor de regras de verdade
// (emulador). Nao roda no `pnpm test`: precisa do emulador no ar, por isso o
// sufixo `.emulator.test.ts` (excluido no vitest.config.ts). Rode com
// `pnpm test:rules`, que sobe o emulador em volta.
//
// Por que existe: era a unica lacuna que aparecia em TODA lista de "nao cobriu"
// desde a AUD-09. Contra a producao provamos so o estranho SEM token (403 em
// 18/18 sondas, 2026-09-08); o estranho LOGADO exigiria uma 2a conta Google.
// Aqui a identidade e forjada no token, entao da para varrer as oito variacoes
// que uma conta so nunca cobriria — inclusive `email_verified` e caixa alta.
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, updateDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { ALLOWED_EMAILS } from "@/features/pricing-calculator/constants";

// O arquivo versionado, lido cru: o teste mede o que esta no repo, nao uma copia.
const REGRAS_REAIS = readFileSync("firestore.rules", "utf8");

// O ruleset FROUXO existe so para provar que estas assercoes distinguem um
// ruleset do outro. Se a fiacao do emulador quebrar e tudo passar a falhar, o
// bloco "a sonda tem dentes" quebra junto — e a suite para de mentir "barrado".
const REGRAS_FROUXAS = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if request.auth != null; }
  }
}`;

type Token = { email?: string; email_verified?: boolean };

// Toda operacao que o app faz, nas duas pontas (leitura e escrita) e numa
// subcolecao funda — esta ultima prova que o `{document=**}` da rules_version 2
// alcanca qualquer profundidade, e nao so a raiz.
function operacoes(db: Firestore): [string, () => Promise<unknown>][] {
  return [
    ["get products/p1", () => getDoc(doc(db, "products", "p1"))],
    ["list products", () => getDocs(query(collection(db, "products"), limit(1)))],
    ["get config/machines", () => getDoc(doc(db, "config", "machines"))],
    ["get vendas/v1", () => getDoc(doc(db, "vendas", "v1"))],
    ["get subcolecao funda", () => getDoc(doc(db, "products", "p1", "sub", "s1"))],
    ["create products/novo", () => setDoc(doc(db, "products", "novo"), { name: "x" })],
    ["update products/p1", () => updateDoc(doc(db, "products", "p1"), { name: "y" })],
    ["delete products/p1", () => deleteDoc(doc(db, "products", "p1"))],
    // [FEAT-12] — a colecao `alteracoes` (registro de mudanca global de preco).
    // Ela ja cai no `{document=**}` e a sonda "colecao inedita" abaixo prova o
    // curinga; esta existe NOMEADA para a proxima varredura nao ter de deduzir a
    // cobertura de uma colecao que o app de fato escreve.
    ["get alteracoes/a1", () => getDoc(doc(db, "alteracoes", "a1"))],
    ["list alteracoes", () => getDocs(query(collection(db, "alteracoes"), limit(1)))],
    ["create alteracoes/nova", () => setDoc(doc(db, "alteracoes", "nova"), { lever: "maquinas" })],
    ["create em colecao inedita", () => setDoc(doc(db, "colecao_inedita", "x"), { a: 1 })],
  ];
}

// As oito identidades que uma 2a conta Google real NAO cobriria sozinha.
const ESTRANHOS: [string, Token][] = [
  ["a 2a conta Google: verificada, fora da lista", { email: "estranho@gmail.com", email_verified: true }],
  ["autorizado em CAIXA ALTA (regra e sensivel a caixa)", { email: "Nivaldo.Lopo@gmail.com", email_verified: true }],
  ["autorizado com alias +", { email: "nivaldo.lopo+teste@gmail.com", email_verified: true }],
  ["autorizado com sufixo colado", { email: "nivaldo.lopo@gmail.com.evil.com", email_verified: true }],
  ["autorizado com prefixo colado", { email: "x.nivaldo.lopo@gmail.com", email_verified: true }],
  ["autorizado, porem email_verified FALSO", { email: "nivaldo.lopo@gmail.com", email_verified: false }],
  ["autorizado, porem SEM a claim email_verified", { email: "nivaldo.lopo@gmail.com" }],
  ["logado sem e-mail nenhum (anonimo)", {}],
];

async function semear(env: RulesTestEnvironment) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, "products", "p1"), { name: "produto sem dono" });
    await setDoc(doc(db, "config", "machines"), { rev: 1 });
    await setDoc(doc(db, "vendas", "v1"), { total: 10 });
    await setDoc(doc(db, "alteracoes", "a1"), { lever: "maquinas", at: 1 });
    await setDoc(doc(db, "products", "p1", "sub", "s1"), { a: 1 });
  });
}

let real: RulesTestEnvironment;
let frouxo: RulesTestEnvironment;

beforeAll(async () => {
  real = await initializeTestEnvironment({ projectId: "aud08-real", firestore: { rules: REGRAS_REAIS } });
  frouxo = await initializeTestEnvironment({ projectId: "aud08-frouxo", firestore: { rules: REGRAS_FROUXAS } });
});
afterAll(async () => {
  await real?.cleanup();
  await frouxo?.cleanup();
});
beforeEach(async () => {
  await semear(real);
  await semear(frouxo);
});

describe("regras do Firestore — quem NAO passa", () => {
  it("a lista da regra e a mesma do ALLOWED_EMAILS do app", () => {
    for (const email of ALLOWED_EMAILS) {
      if (!REGRAS_REAIS.includes(`'${email}'`)) {
        throw new Error(`${email} esta no ALLOWED_EMAILS e NAO na regra — o app deixa entrar e o banco nega tudo`);
      }
    }
    const naRegra = [...REGRAS_REAIS.matchAll(/'([^']+@[^']+)'/g)].map((m) => m[1]);
    for (const email of naRegra) {
      if (!ALLOWED_EMAILS.includes(email)) {
        throw new Error(`${email} esta na regra e NAO no ALLOWED_EMAILS — o banco libera quem a tela barra`);
      }
    }
  });

  describe("visitante sem token nenhum", () => {
    for (const [nome] of operacoes({} as Firestore)) {
      it(`nega ${nome}`, async () => {
        const db = real.unauthenticatedContext().firestore() as unknown as Firestore;
        const op = operacoes(db).find(([n]) => n === nome)![1];
        await assertFails(op());
      });
    }
  });

  for (const [rotulo, token] of ESTRANHOS) {
    describe(rotulo, () => {
      for (const [nome] of operacoes({} as Firestore)) {
        it(`nega ${nome}`, async () => {
          const db = real.authenticatedContext("uid-estranho", token).firestore() as unknown as Firestore;
          const op = operacoes(db).find(([n]) => n === nome)![1];
          await assertFails(op());
        });
      }
    });
  }
});

describe("regras do Firestore — quem passa", () => {
  for (const email of ALLOWED_EMAILS) {
    describe(`${email} (verificado)`, () => {
      for (const [nome] of operacoes({} as Firestore)) {
        it(`permite ${nome}`, async () => {
          const db = real
            .authenticatedContext(`uid-${email}`, { email, email_verified: true })
            .firestore() as unknown as Firestore;
          const op = operacoes(db).find(([n]) => n === nome)![1];
          await assertSucceeds(op());
        });
      }
    });
  }
});

describe("a sonda tem dentes (ruleset FROUXO de proposito)", () => {
  // Contra um `if request.auth != null` o mesmo estranho ENTRA. Se este bloco
  // parar de passar, o "barrado" dos blocos acima nao vale nada: seria fiacao
  // quebrada, nao regra funcionando.
  for (const [nome] of operacoes({} as Firestore)) {
    it(`o estranho verificado PASSA em ${nome}`, async () => {
      const db = frouxo
        .authenticatedContext("uid-estranho", { email: "estranho@gmail.com", email_verified: true })
        .firestore() as unknown as Firestore;
      const op = operacoes(db).find(([n]) => n === nome)![1];
      await assertSucceeds(op());
    });
  }

  it("e o visitante SEM token continua barrado ate no frouxo", async () => {
    const db = frouxo.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(getDoc(doc(db, "products", "p1")));
  });
});
