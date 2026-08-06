import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@competepulse/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@competepulse/agent": fileURLToPath(new URL("../agent/src/index.ts", import.meta.url)),
    },
  },
});
