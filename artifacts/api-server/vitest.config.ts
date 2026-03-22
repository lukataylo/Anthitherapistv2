import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      // Deterministic JWT signing key for tests — ensures tokens are
      // reproducible and verifyToken tests don't depend on random state.
      JWT_SECRET: "test-secret-key-do-not-use-in-production",
    },
  },
});
