// vitest.config.ts
import { defineConfig } from "file:///Users/shawwalters/eliza-workspace/hyperia/node_modules/.bun/vitest@2.1.9+2068e9765e9324f4/node_modules/vitest/dist/config.js";
import react from "file:///Users/shawwalters/eliza-workspace/hyperia/node_modules/.bun/@vitejs+plugin-react@5.1.4+aefedb91d1a84aeb/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import { fileURLToPath } from "url";
var __vite_injected_original_import_meta_url = "file:///Users/shawwalters/eliza-workspace/hyperia/packages/client/vitest.config.ts";
var __dirname = path.dirname(fileURLToPath(__vite_injected_original_import_meta_url));
var vitest_config_default = defineConfig({
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
        "src/types/**/*.{ts,tsx}"
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/index.ts",
        // Exclude complex visual components that need E2E testing
        "**/CharacterPreview.tsx",
        "**/Minimap.tsx"
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80
      }
    },
    // Timeout for async operations
    testTimeout: 1e4,
    // Pool configuration for faster tests
    pool: "forks"
  },
  resolve: {
    alias: {
      // Path alias to match vite.config.ts
      "@": path.resolve(__dirname, "src"),
      // Use actual shared package - per project rules, no mocks allowed
      // Tests should use real Hyperia instances with Playwright
      "@hyperforge/shared": path.resolve(
        __dirname,
        "../shared/build/framework.client.js"
      )
    }
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy9zaGF3d2FsdGVycy9lbGl6YS13b3Jrc3BhY2UvaHlwZXJzY2FwZS9wYWNrYWdlcy9jbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9zaGF3d2FsdGVycy9lbGl6YS13b3Jrc3BhY2UvaHlwZXJzY2FwZS9wYWNrYWdlcy9jbGllbnQvdml0ZXN0LmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvc2hhd3dhbHRlcnMvZWxpemEtd29ya3NwYWNlL2h5cGVyc2NhcGUvcGFja2FnZXMvY2xpZW50L3ZpdGVzdC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZXN0L2NvbmZpZ1wiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tIFwidXJsXCI7XG5cbmNvbnN0IF9fZGlybmFtZSA9IHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKSBhcyBuZXZlcl0sXG4gIHRlc3Q6IHtcbiAgICBnbG9iYWxzOiB0cnVlLFxuICAgIGVudmlyb25tZW50OiBcImpzZG9tXCIsXG4gICAgc2V0dXBGaWxlczogW1wiLi90ZXN0cy9zZXR1cC50c1wiXSxcbiAgICBpbmNsdWRlOiBbXCJ0ZXN0cy8qKi8qLnRlc3Que3RzLHRzeH1cIl0sXG4gICAgZXhjbHVkZTogW1wiKiovbm9kZV9tb2R1bGVzLyoqXCIsIFwiKiovZGlzdC8qKlwiXSxcbiAgICBjb3ZlcmFnZToge1xuICAgICAgcHJvdmlkZXI6IFwidjhcIixcbiAgICAgIHJlcG9ydGVyOiBbXCJ0ZXh0XCIsIFwianNvblwiLCBcImh0bWxcIl0sXG4gICAgICBpbmNsdWRlOiBbXG4gICAgICAgIC8vIEdhbWUgcGFuZWxzIGFuZCBzeXN0ZW1zXG4gICAgICAgIFwic3JjL2dhbWUvcGFuZWxzLyoqLyoue3RzLHRzeH1cIixcbiAgICAgICAgXCJzcmMvZ2FtZS9zeXN0ZW1zLyoqLyoue3RzLHRzeH1cIixcbiAgICAgICAgXCJzcmMvZ2FtZS9odWQvKiovKi57dHMsdHN4fVwiLFxuICAgICAgICBcInNyYy9nYW1lL2NvbXBvbmVudHMvKiovKi57dHMsdHN4fVwiLFxuICAgICAgICAvLyBDb3JlIGxpYnJhcmllcyBhbmQgdXRpbGl0aWVzXG4gICAgICAgIFwic3JjL2xpYi8qKi8qLnt0cyx0c3h9XCIsXG4gICAgICAgIFwic3JjL3V0aWxzLyoqLyoue3RzLHRzeH1cIixcbiAgICAgICAgXCJzcmMvaG9va3MvKiovKi57dHMsdHN4fVwiLFxuICAgICAgICBcInNyYy9hdXRoLyoqLyoue3RzLHRzeH1cIixcbiAgICAgICAgLy8gVUkgZnJhbWV3b3JrIGNvbXBvbmVudHNcbiAgICAgICAgXCJzcmMvdWkvY29tcG9uZW50cy8qKi8qLnt0cyx0c3h9XCIsXG4gICAgICAgIFwic3JjL3VpL2NvbnRyb2xzLyoqLyoue3RzLHRzeH1cIixcbiAgICAgICAgXCJzcmMvdWkvY29yZS8qKi8qLnt0cyx0c3h9XCIsXG4gICAgICAgIFwic3JjL3VpL3N0b3Jlcy8qKi8qLnt0cyx0c3h9XCIsXG4gICAgICAgIC8vIFR5cGUgZ3VhcmRzIGFuZCB1dGlsaXRpZXNcbiAgICAgICAgXCJzcmMvdHlwZXMvKiovKi57dHMsdHN4fVwiLFxuICAgICAgXSxcbiAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgXCIqKi8qLnRlc3Que3RzLHRzeH1cIixcbiAgICAgICAgXCIqKi9pbmRleC50c1wiLFxuICAgICAgICAvLyBFeGNsdWRlIGNvbXBsZXggdmlzdWFsIGNvbXBvbmVudHMgdGhhdCBuZWVkIEUyRSB0ZXN0aW5nXG4gICAgICAgIFwiKiovQ2hhcmFjdGVyUHJldmlldy50c3hcIixcbiAgICAgICAgXCIqKi9NaW5pbWFwLnRzeFwiLFxuICAgICAgXSxcbiAgICAgIHRocmVzaG9sZHM6IHtcbiAgICAgICAgc3RhdGVtZW50czogODAsXG4gICAgICAgIGJyYW5jaGVzOiA3NSxcbiAgICAgICAgZnVuY3Rpb25zOiA4MCxcbiAgICAgICAgbGluZXM6IDgwLFxuICAgICAgfSxcbiAgICB9LFxuICAgIC8vIFRpbWVvdXQgZm9yIGFzeW5jIG9wZXJhdGlvbnNcbiAgICB0ZXN0VGltZW91dDogMTAwMDAsXG4gICAgLy8gUG9vbCBjb25maWd1cmF0aW9uIGZvciBmYXN0ZXIgdGVzdHNcbiAgICBwb29sOiBcImZvcmtzXCIsXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgLy8gUGF0aCBhbGlhcyB0byBtYXRjaCB2aXRlLmNvbmZpZy50c1xuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwic3JjXCIpLFxuICAgICAgLy8gVXNlIGFjdHVhbCBzaGFyZWQgcGFja2FnZSAtIHBlciBwcm9qZWN0IHJ1bGVzLCBubyBtb2NrcyBhbGxvd2VkXG4gICAgICAvLyBUZXN0cyBzaG91bGQgdXNlIHJlYWwgSHlwZXJzY2FwZSBpbnN0YW5jZXMgd2l0aCBQbGF5d3JpZ2h0XG4gICAgICBcIkBoeXBlcnNjYXBlL3NoYXJlZFwiOiBwYXRoLnJlc29sdmUoXG4gICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgXCIuLi9zaGFyZWQvYnVpbGQvZnJhbWV3b3JrLmNsaWVudC5qc1wiLFxuICAgICAgKSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTZXLFNBQVMsb0JBQW9CO0FBQzFZLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyxxQkFBcUI7QUFIc00sSUFBTSwyQ0FBMkM7QUFLclIsSUFBTSxZQUFZLEtBQUssUUFBUSxjQUFjLHdDQUFlLENBQUM7QUFFN0QsSUFBTyx3QkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBVTtBQUFBLEVBQzFCLE1BQU07QUFBQSxJQUNKLFNBQVM7QUFBQSxJQUNULGFBQWE7QUFBQSxJQUNiLFlBQVksQ0FBQyxrQkFBa0I7QUFBQSxJQUMvQixTQUFTLENBQUMsMEJBQTBCO0FBQUEsSUFDcEMsU0FBUyxDQUFDLHNCQUFzQixZQUFZO0FBQUEsSUFDNUMsVUFBVTtBQUFBLE1BQ1IsVUFBVTtBQUFBLE1BQ1YsVUFBVSxDQUFDLFFBQVEsUUFBUSxNQUFNO0FBQUEsTUFDakMsU0FBUztBQUFBO0FBQUEsUUFFUDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBO0FBQUEsUUFFQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBO0FBQUEsUUFFQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBO0FBQUEsUUFFQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFNBQVM7QUFBQSxRQUNQO0FBQUEsUUFDQTtBQUFBO0FBQUEsUUFFQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSxZQUFZO0FBQUEsUUFDVixZQUFZO0FBQUEsUUFDWixVQUFVO0FBQUEsUUFDVixXQUFXO0FBQUEsUUFDWCxPQUFPO0FBQUEsTUFDVDtBQUFBLElBQ0Y7QUFBQTtBQUFBLElBRUEsYUFBYTtBQUFBO0FBQUEsSUFFYixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBO0FBQUEsTUFFTCxLQUFLLEtBQUssUUFBUSxXQUFXLEtBQUs7QUFBQTtBQUFBO0FBQUEsTUFHbEMsc0JBQXNCLEtBQUs7QUFBQSxRQUN6QjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
