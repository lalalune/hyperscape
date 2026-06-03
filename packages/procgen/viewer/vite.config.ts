import { defineConfig } from "vite";
import { existsSync } from "fs";
import { resolve } from "path";

const sharedClientBuild = resolve(
  __dirname,
  "../../shared/build/framework.client.js",
);
const sharedClientSource = resolve(
  __dirname,
  "../../shared/src/index.client.ts",
);
const sharedClientEntry = existsSync(sharedClientBuild)
  ? sharedClientBuild
  : sharedClientSource;

export default defineConfig({
  root: resolve(__dirname),
  server: {
    port: 3500,
    open: true,
    fs: {
      allow: [resolve(__dirname, ".."), resolve(__dirname, "../../shared")],
    },
  },
  resolve: {
    alias: {
      "@hyperforge/procgen": resolve(__dirname, "../src"),
      "@hyperforge/impostor": resolve(__dirname, "../../impostors/src"),
      // Prefer built client bundle when available, fall back to source.
      "@hyperforge/shared": sharedClientEntry,
    },
  },
  optimizeDeps: {
    // Exclude yoga-layout from dep optimization to avoid top-level await issues
    exclude: ["yoga-layout"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  esbuild: {
    target: "esnext",
  },
  build: {
    outDir: resolve(__dirname, "../dist-viewer"),
    emptyOutDir: true,
    target: "esnext",
  },
});
