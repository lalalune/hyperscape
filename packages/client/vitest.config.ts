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
        // Game panels and systems
        "src/game/panels/**/*.{ts,tsx}",
        "src/game/systems/**/*.{ts,tsx}",
        "src/game/hud/**/*.{ts,tsx}",
        "src/game/components/**/*.{ts,tsx}",
        // Core libraries and utilities
        "src/lib/**/*.{ts,tsx}",
        "src/utils/**/*.{ts,tsx}",
        "src/hooks/**/*.{ts,tsx}",
        "src/auth/**/*.{ts,tsx}",
        // UI framework components
        "src/ui/components/**/*.{ts,tsx}",
        "src/ui/controls/**/*.{ts,tsx}",
        "src/ui/core/**/*.{ts,tsx}",
        "src/ui/stores/**/*.{ts,tsx}",
        // Type guards and utilities
        "src/types/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/index.ts",
        // Exclude complex visual components that need E2E testing
        "**/CharacterPreview.tsx",
        "**/Minimap.tsx",
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    // Timeout for async operations
    testTimeout: 10000,
    // jsdom + forks trips ERR_REQUIRE_ASYNC_MODULE in CI on newer Vitest.
    // Keep the browser-like environment, but use thread workers instead.
    pool: "threads",
  },
  resolve: {
    alias: {
      // Path alias to match vite.config.ts
      "@": path.resolve(__dirname, "src"),
      // Use actual shared package - per project rules, no mocks allowed
      // Tests should use real Hyperia instances with Playwright
      "@hyperforge/shared": path.resolve(
        __dirname,
        "../shared/build/framework.client.js",
      ),
    },
  },
});
