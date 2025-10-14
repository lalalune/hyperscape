#!/usr/bin/env bun

import { rmSync, existsSync } from "fs";
import { join } from "path";

const outDir = join(import.meta.dir, "dist");

// Clean output directory
if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("🏗️  Building plugin-vercel-ai-gateway...");

// Build with Bun's bundler
const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  format: "esm",
  sourcemap: "external",
  target: "node",
  external: ["@elizaos/core", "@ai-sdk/openai", "ai", "js-tiktoken"],
});

if (!result.success) {
  console.error("❌ Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`✅ Built ${result.outputs.length} file(s)`);
