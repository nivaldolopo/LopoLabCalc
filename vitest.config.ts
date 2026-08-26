import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve o alias "@/..." (definido no tsconfig) também no Vitest. Sem isto, um
// teste que importa código com `@/lib/...` quebra em "Cannot find package".
export default defineConfig({
  // AUD-15 [E5]: o padrao do Vitest e um worker por CPU — 16 nesta maquina, cada
  // um um processo Node. Com 7,7 GB de RAM o `pnpm test` morria em
  // "memory allocation ... failed" ANTES de rodar um teste sequer (reproduzido
  // na arvore limpa, entao nao e regressao de codigo). A suite inteira e
  // matematica pura e fecha em ~1s de teste: 4 workers sobram, e o comando volta
  // a ser deterministico.
  test: {
    maxWorkers: 4,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
