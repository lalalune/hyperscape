import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react() as never],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/game/panels/**/*.{ts,tsx}",
        "src/lib/**/*.{ts,tsx}",
        "src/utils/**/*.{ts,tsx}",
        "src/hooks/**/*.{ts,tsx}",
        "src/auth/**/*.{ts,tsx}",
        "src/game/systems/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.test.{ts,tsx}", "**/index.ts"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    // Timeout for async operations
    testTimeout: 10000,
    // Pool configuration for faster tests
    pool: "forks",
  },
  resolve: {
    alias: {
      // Path alias to match vite.config.ts
      "@": path.resolve(__dirname, "src"),
      // Use actual shared package - per project rules, no mocks allowed
      // Tests should use real Hyperscape instances with Playwright
      "@hyperscape/shared": path.resolve(
        __dirname,
        "../shared/build/framework.client.js",
      ),
    },
  },
});
