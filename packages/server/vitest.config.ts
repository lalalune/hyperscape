import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Only include .test.ts files (unit/integration tests)
    // Exclude .spec.ts files (Playwright E2E tests - run with `npm run test:e2e`)
    include: ["**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.spec.ts", // Playwright E2E tests
      "**/tests/e2e/**", // E2E test directory
    ],
    // Timeout for longer-running integration tests
    testTimeout: 30000,
    hookTimeout: 30000,
    // Setup file to mock browser globals (WebGPU, etc.)
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: [
      {
        find: /^@hyperia\/shared\/client$/,
        replacement: path.resolve(__dirname, "../shared/src/index.client.ts"),
      },
      {
        find: /^@hyperia\/shared$/,
        replacement: path.resolve(__dirname, "../shared/src/index.ts"),
      },
      {
        find: /^@hyperia\/shared\/(.*)$/,
        replacement: path.resolve(__dirname, "../shared/src/$1"),
      },
    ],
  },
});
