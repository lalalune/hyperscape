import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/game/panels/BankPanel/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/index.ts"],
    },
    // Timeout for async operations
    testTimeout: 10000,
    // Pool configuration for faster tests
    pool: "forks",
  },
  resolve: {
    alias: {
      // Mock the shared package with our test mock
      "@hyperscape/shared": path.resolve(
        __dirname,
        "tests/mocks/hyperscape-shared.ts",
      ),
    },
  },
});
