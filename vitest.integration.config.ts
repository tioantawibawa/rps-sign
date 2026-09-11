import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Integration tests run against a real PostgreSQL database.
 * Provide DATABASE_URL (a disposable test DB) and run `pnpm test:integration`.
 */
export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.itest.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
