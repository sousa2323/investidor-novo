import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // "server-only" é um guard de runtime do Next sem efeito nos testes.
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/calculations/**/*.ts", "src/lib/import/**/*.ts"],
    },
  },
});
