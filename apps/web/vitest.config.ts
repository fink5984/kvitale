import path from "node:path";
import os from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    env: {
      PGLITE_DIR: path.join(os.tmpdir(), `kvittel-test-${process.pid}-${Date.now()}`),
      KVITTEL_DEMO_MODE: "1",
      APP_URL: "http://localhost:3999",
    },
  },
});
