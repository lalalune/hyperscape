import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  sourcemap: true,
  clean: true,
  format: ["esm"],
  dts: false,
  external: ["@elizaos/core", "@ai-sdk/openai", "ai", "js-tiktoken"],
});
