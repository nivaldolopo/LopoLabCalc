import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Suite SEPARADA: so os testes que precisam do emulador do Firestore no ar
// (AUD-08, regras de seguranca). O `pnpm test` os ignora de proposito — sem
// emulador eles nao sao "vermelho", sao "sem medicao". Sobem por `pnpm test:rules`.
export default defineConfig({
  test: {
    include: ["**/*.emulator.test.ts"],
    // Um worker so: os dois ambientes de regra compartilham o mesmo emulador, e
    // o `clearFirestore` de um pisaria na semeadura do outro.
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
