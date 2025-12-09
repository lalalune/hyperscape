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
        "src/**/*.test.ts",
        "**/*.d.ts",
        "**/*.config.*",
      ],
    },
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}"],
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
