import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve o alias "@/..." (definido no tsconfig) também no Vitest. Sem isto, um
// teste que importa código com `@/lib/...` quebra em "Cannot find package".
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
