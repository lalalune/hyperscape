import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/**/*.test.ts",
        "**/*.d.ts",
        "**/*.config.*",
        "dist/",
        "scripts/",
        "tests/e2e/", // Playwright e2e tests
      ],
    },
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    watchExclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
