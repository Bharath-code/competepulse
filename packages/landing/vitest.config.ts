import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // `build.test.ts` shells out to a real `astro build`.
    testTimeout: 120_000,
  },
});
