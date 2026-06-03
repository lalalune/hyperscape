import path from "path";
import { createRequire } from "module";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const require = createRequire(import.meta.url);
  const env = loadEnv(mode, process.cwd(), "");
  const uiPort = Number(env.ASSET_FORGE_PORT) || 3400;
  const apiPort = Number(env.ASSET_FORGE_API_PORT) || 3401;
  const threeRoot = path.dirname(path.dirname(require.resolve("three")));

  return {
    plugins: [react()],
    // Define process.env for pre-built packages that use it (e.g., MovementUtils.ts)
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
      "process.env.GAME_MODE": JSON.stringify(env.GAME_MODE || ""),
    },
    build: {
      target: "esnext", // Support top-level await
      chunkSizeWarningLimit: 9000, // Asset tooling intentionally ships large WebGPU/PhysX chunks
    },
    resolve: {
      dedupe: ["react", "react-dom", "react/jsx-runtime", "three"],
      alias: {
        "@": path.resolve(__dirname, "src"),
        react: path.resolve(__dirname, "../../node_modules/react"),
        "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
        "react/jsx-runtime": path.resolve(
          __dirname,
          "../../node_modules/react/jsx-runtime",
        ),
        // Three.js WebGPU module
        "three/webgpu": path.resolve(threeRoot, "build/three.webgpu.js"),
        "three/tsl": path.resolve(threeRoot, "build/three.tsl.js"),
        // Three.js addons (examples/jsm)
        "three/addons": path.resolve(threeRoot, "examples/jsm"),
        // Ensure single Three.js instance across all packages
        three: threeRoot,
        // Use client-only build of shared to exclude server-side modules (fs-extra, etc.)
        "@hyperforge/shared": path.resolve(
          __dirname,
          "../shared/build/framework.client.js",
        ),
        // Workspace package aliases
        "@hyperforge/decimation": path.resolve(
          __dirname,
          "../decimation/dist/index.js",
        ),
        "@hyperforge/impostor": path.resolve(
          __dirname,
          "../impostors/dist/index.js",
        ),
        // Procgen package aliases for terrain, vegetation, etc.
        // NOTE: More specific paths must come BEFORE less specific paths
        "@hyperforge/procgen/terrain": path.resolve(
          __dirname,
          "../procgen/dist/terrain/index.js",
        ),
        "@hyperforge/procgen/vegetation": path.resolve(
          __dirname,
          "../procgen/dist/vegetation/index.js",
        ),
        "@hyperforge/procgen/grass": path.resolve(
          __dirname,
          "../procgen/dist/grass/index.js",
        ),
        "@hyperforge/procgen/building/viewer": path.resolve(
          __dirname,
          "../procgen/src/building/viewer/index.ts",
        ),
        "@hyperforge/procgen/building/town": path.resolve(
          __dirname,
          "../procgen/dist/building/town/index.js",
        ),
        "@hyperforge/procgen/building": path.resolve(
          __dirname,
          "../procgen/dist/building/index.js",
        ),
        "@hyperforge/procgen/rock": path.resolve(
          __dirname,
          "../procgen/dist/rock/index.js",
        ),
        "@hyperforge/procgen/plant": path.resolve(
          __dirname,
          "../procgen/dist/plant/index.js",
        ),
        "@hyperforge/procgen/items/dock": path.resolve(
          __dirname,
          "../procgen/dist/items/dock/index.js",
        ),
        "@hyperforge/procgen/items": path.resolve(
          __dirname,
          "../procgen/dist/items/index.js",
        ),
        "@hyperforge/procgen": path.resolve(
          __dirname,
          "../procgen/dist/index.js",
        ),
      },
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "three",
        "@react-three/fiber",
        "@react-three/drei",
      ],
      // Exclude Node.js-only modules that shouldn't be bundled for browser
      exclude: ["fs-extra", "graceful-fs", "better-sqlite3", "knex"],
      esbuildOptions: {
        target: "esnext", // Support top-level await in dependencies like yoga-layout
        resolveExtensions: [".mjs", ".js", ".jsx", ".json", ".ts", ".tsx"],
      },
    },
    server: {
      port: uiPort,
      // Allow Vite to serve files from workspace packages (procgen, shared, etc.)
      fs: {
        allow: [
          // Allow the monorepo root and all packages
          path.resolve(__dirname, "../.."),
        ],
      },
      proxy: {
        "/api": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
        "/assets": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
        "/game-models": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
        "/game-assets": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
