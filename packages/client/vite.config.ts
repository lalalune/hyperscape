import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from both workspace root and client directory
  const workspaceRoot = path.resolve(__dirname, "../..");
  const clientDir = __dirname;

  // Detect if we're running in the jeju monorepo context
  const isJejuContext = fs.existsSync(
    path.join(workspaceRoot, "jeju-manifest.json"),
  );
  const defaultPort = isJejuContext ? 5009 : 3333;

  // Load from both locations - client dir takes precedence
  const workspaceEnv = loadEnv(mode, workspaceRoot, ["PUBLIC_", "VITE_"]);
  const clientEnv = loadEnv(mode, clientDir, ["PUBLIC_", "VITE_"]);
  const env = { ...workspaceEnv, ...clientEnv };

  console.log("[Vite Config] Loaded env from workspace:", workspaceRoot);
  console.log("[Vite Config] Loaded env from client:", clientDir);
  console.log(
    "[Vite Config] Context:",
    isJejuContext ? "jeju monorepo (port 5009)" : "standalone (port 3333)",
  );
  console.log(
    "[Vite Config] PUBLIC_PRIVY_APP_ID:",
    env.PUBLIC_PRIVY_APP_ID
      ? `${env.PUBLIC_PRIVY_APP_ID.substring(0, 10)}...`
      : "NOT SET",
  );

  return {
    plugins: [
      react(),
      // Watch shared package for changes and trigger full reload
      {
        name: "watch-shared-package",
        configureServer(server) {
          const sharedBuildPath = path.resolve(__dirname, "../shared/build");
          const sharedSrcPath = path.resolve(__dirname, "../shared/src");

          // Watch both build output AND source files
          server.watcher.add(path.join(sharedBuildPath, "**/*.js"));
          server.watcher.add(path.join(sharedSrcPath, "**/*.ts"));
          server.watcher.add(path.join(sharedSrcPath, "**/*.tsx"));

          server.watcher.on("change", (file) => {
            if (
              file.includes("packages/shared/build/") ||
              file.includes("packages/shared/src/")
            ) {
              console.log(
                `\n[Vite] 🔄 Shared package file changed: ${path.basename(file)}`,
              );
              console.log("[Vite] ⚡ Triggering full reload...\n");

              // Clear Vite's module cache for @hyperscape/shared
              const sharedModule =
                server.moduleGraph.getModuleById("@hyperscape/shared");
              if (sharedModule) {
                server.moduleGraph.invalidateModule(sharedModule);
              }

              // Also invalidate all modules that import from shared
              server.moduleGraph.invalidateAll();

              // Trigger full page reload
              server.ws.send({
                type: "full-reload",
                path: "*",
              });
            }
          });

          console.log("[Vite] 👀 Watching shared package:", sharedBuildPath);
        },
      },
      // Plugin to handle Node.js modules in browser
      {
        name: "node-modules-polyfill",
        resolveId(id) {
          // Return false for Node.js built-in modules to prevent them from being resolved
          const nodeModules = [
            "fs",
            "fs-extra",
            "path",
            "node:fs",
            "node:path",
            "graceful-fs",
          ];
          if (nodeModules.includes(id) || id.startsWith("node:")) {
            return { id: `virtual:${id}`, external: false };
          }
        },
        load(id) {
          // Provide empty implementations for Node.js modules
          if (id.startsWith("virtual:")) {
            return "export default {}; export const readFile = () => {}; export const writeFile = () => {};";
          }
        },
      },
    ],

    // Tell Vite to look for .env files in the client directory
    envDir: clientDir,

    // Vite automatically exposes PUBLIC_ prefixed variables via import.meta.env
    envPrefix: "PUBLIC_",

    root: path.resolve(__dirname, "src"),
    publicDir: path.resolve(__dirname, "public"),

    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
      target: "esnext", // Support top-level await
      minify: false, // Disable minification for debugging
      sourcemap: true, // Enable source maps for better debugging
      rollupOptions: {
        input: path.resolve(__dirname, "src/index.html"),
        external: ["fs", "fs-extra", "path", "node:fs", "node:path"],
        output: {
          // Provide empty stubs for Node.js modules
          globals: {
            fs: "{}",
            "fs-extra": "{}",
            path: "{}",
            "node:fs": "{}",
            "node:path": "{}",
          },
        },
        onwarn(warning, warn) {
          // Suppress warnings about PURE annotations in ox library and external modules
          if (
            warning.code === "SOURCEMAP_ERROR" ||
            warning.code === "UNRESOLVED_IMPORT" ||
            (warning.message &&
              warning.message.includes(
                "contains an annotation that Rollup cannot interpret",
              ))
          ) {
            return;
          }
          warn(warning);
        },
      },
      // Mobile optimization
      chunkSizeWarningLimit: 2000, // Increase for large 3D assets
      cssCodeSplit: true, // Split CSS for better caching
    },

    esbuild: {
      target: "esnext", // Support top-level await
    },

    define: {
      global: "globalThis", // Needed for some node polyfills in browser

      // ============================================================================
      // SECURITY: process.env Polyfill for Browser
      // ============================================================================
      // Replace process.env with an empty object to prevent accidental secret exposure
      // This makes shared code's `process.env.X` references return undefined in browser
      //
      // ⚠️  NEVER ADD SECRET VARIABLES HERE ⚠️
      // Secret variables that must NEVER be exposed to client:
      //   - PRIVY_APP_SECRET
      //   - JWT_SECRET
      //   - DATABASE_URL
      //   - POSTGRES_PASSWORD
      //   - LIVEKIT_API_SECRET
      //   - ADMIN_CODE (reveals admin password)
      //
      // Only add PUBLIC_ prefixed variables or safe config values below.
      // ============================================================================
      "process.env": "{}",

      // Safe environment variables (no secrets, only config)
      "process.env.NODE_ENV": JSON.stringify(mode),
      "process.env.DEBUG_RPG": JSON.stringify(env.DEBUG_RPG || ""),
      "process.env.PUBLIC_CDN_URL": JSON.stringify(
        env.PUBLIC_CDN_URL || "http://localhost:5555/assets",
      ),
      "process.env.PUBLIC_STARTER_ITEMS": JSON.stringify(
        env.PUBLIC_STARTER_ITEMS || "",
      ),
      "process.env.TERRAIN_SEED": JSON.stringify(env.TERRAIN_SEED || "0"),
      "process.env.VITEST": "undefined", // Not in browser

      // Note: import.meta.env.PUBLIC_* variables are auto-exposed by Vite (via envPrefix above)
      // We don't need to manually define them here - Vite handles it automatically
    },
    server: {
      port: Number(env.VITE_PORT) || defaultPort,
      open: false,
      host: true,
      // Silence noisy missing source map warnings for vendored libs
      sourcemapIgnoreList(relativeSourcePath, _sourcemapPath) {
        return /src\/libs\/(stats-gl|three-custom-shader-material)\//.test(
          relativeSourcePath,
        );
      },
      fs: {
        // Allow serving files from the shared package
        allow: [".."],
      },
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        // Use client-only build of shared package to avoid Node.js module leakage
        "@hyperscape/shared": path.resolve(
          __dirname,
          "../shared/build/framework.client.js",
        ),
      },
      dedupe: ["three"],
    },

    optimizeDeps: {
      include: ["three", "react", "react-dom"],
      exclude: [
        "@hyperscape/shared", // CRITICAL: Exclude from dep optimization so changes are detected
        "@playwright/test", // Exclude Playwright from optimization
        "fs-extra", // Exclude Node.js modules
        "fs",
        "path",
        "node:fs",
        "node:path",
        "graceful-fs",
      ],
      esbuildOptions: {
        target: "esnext", // Support top-level await
        define: {
          global: "globalThis",
        },
      },
    },
    ssr: {
      noExternal: [],
    },
  };
});
