import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from both workspace root and client directory
  const workspaceRoot = path.resolve(__dirname, "../..");
  const clientDir = __dirname;

  // Load from both locations - client dir takes precedence
  const workspaceEnv = loadEnv(mode, workspaceRoot, ["PUBLIC_", "VITE_"]);
  const clientEnv = loadEnv(mode, clientDir, ["PUBLIC_", "VITE_"]);
  const env = { ...workspaceEnv, ...clientEnv };

  console.log("[Vite Config] Build mode:", mode);
  console.log("[Vite Config] Loaded env from:", clientDir);
  if (env.PUBLIC_PRIVY_APP_ID) {
    console.log(
      "[Vite Config] PUBLIC_PRIVY_APP_ID:",
      env.PUBLIC_PRIVY_APP_ID.substring(0, 10) + "...",
    );
  }

  const disableSharedWatch =
    process.env.E2E_DISABLE_SHARED_WATCH === "true" ||
    process.env.PLAYWRIGHT_TEST === "true";
  const isPlaywrightTest = process.env.PLAYWRIGHT_TEST === "true";
  const forceOptimizeDeps =
    isPlaywrightTest || process.env.VITE_FORCE_OPTIMIZE_DEPS === "true";
  const cacheMode = mode.replace(/[^a-z0-9_-]/gi, "_");
  const cacheFlavor = isPlaywrightTest
    ? "playwright"
    : disableSharedWatch
      ? "isolated"
      : "default";
  const viteCacheDir = path.resolve(
    __dirname,
    `node_modules/.vite-${cacheMode}-${cacheFlavor}`,
  );

  const optimizeDepsExclude = [
    "@hyperscape/shared", // CRITICAL: Exclude from dep optimization so changes are detected
    "@playwright/test", // Exclude Playwright from optimization
    "fs-extra", // Exclude Node.js modules
    "fs",
    "path",
    "node:fs",
    "node:path",
    "graceful-fs",
  ];

  // Privy's ESM build pulls Coinbase internals with .cjs files.
  // Explicit optimization guarantees CJS interop and avoids runtime export errors.
  const authOptimizeDeps = [
    "@privy-io/react-auth",
    "@privy-io/react-auth/farcaster",
    "@privy-io/react-auth/solana",
    "@coinbase/wallet-sdk",
  ];

  // When noDiscovery is enabled (e.g. PLAYWRIGHT_TEST), these must be explicit
  // or Vite serves raw web3 ESM that imports CJS bn.js without interop.
  const solanaOptimizeDeps = [
    "@solana/web3.js",
    "@solana/kit",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana-mobile/wallet-standard-mobile",
  ];

  return {
    plugins: [
      react(),
      nodePolyfills({
        // Include only buffer - we'll handle process via define
        include: ["buffer"],
        // Enable globals injection for buffer only
        globals: { global: true, Buffer: true },
        // Disable protocol imports to avoid unresolved shim imports in production
        protocolImports: false,
      }),
      // PWA plugin for installable web app on Saga and Android devices
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "favicon.ico",
          "images/logo.png",
          "images/app-icon-512.png",
        ],
        manifest: {
          name: "Hyperscape",
          short_name: "Hyperscape",
          description: "An AI-native MMORPG built on Solana",
          theme_color: "#1a1a1a",
          background_color: "#000000",
          display: "standalone",
          orientation: "any",
          start_url: "/",
          scope: "/",
          categories: ["games", "entertainment"],
          icons: [
            {
              src: "/images/app-icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/images/app-icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
          screenshots: [
            {
              src: "/images/screenshot-1.png",
              sizes: "1920x1080",
              type: "image/png",
              form_factor: "wide",
            },
          ],
          related_applications: [
            {
              platform: "play",
              url: "https://hyperscape.club",
              id: "com.hyperscape.game",
            },
          ],
        },
        workbox: {
          // Cache game assets for offline play
          globPatterns: ["**/*.{css,html,ico,svg,woff,woff2}"],
          // Don't cache large assets in service worker - they'll use runtime caching
          globIgnores: [
            "**/*.glb",
            "**/*.gltf",
            "**/*.hdr",
            "**/*.png",
            "**/physx-js-webidl*.js",
            "**/index-*.js", // Large main bundle
          ],
          // Increase file size limit (default is 2MB)
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
          runtimeCaching: [
            {
              // Cache JS/CSS files that weren't precached
              urlPattern: /\.(?:js|css)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "hyperscape-code",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Cache images with network-first strategy
              urlPattern: /\.(?:png|jpg|jpeg|gif|webp)$/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "hyperscape-images",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
            {
              urlPattern: /^https:\/\/assets\.hyperscape\.club\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "hyperscape-cdn-assets",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false, // Disable PWA in dev mode
        },
      }),
      // Watch shared package for changes and trigger full reload
      ...(disableSharedWatch
        ? []
        : [
            {
              name: "watch-shared-package",
              configureServer(server: any) {
                const sharedBuildPath = path.resolve(
                  __dirname,
                  "../shared/build",
                );
                // Watch only shared build artifacts used by the client alias.
                // Watching the full shared src tree can flood HMR with events and
                // drive excessive memory growth in long-lived dev sessions.
                const sharedClientBuildFile = path.join(
                  sharedBuildPath,
                  "framework.client.js",
                );
                const sharedFullBuildFile = path.join(
                  sharedBuildPath,
                  "framework.js",
                );
                server.watcher.add(sharedClientBuildFile);
                server.watcher.add(sharedFullBuildFile);

                let reloadTimer: ReturnType<typeof setTimeout> | null = null;
                let pendingFile = "";
                const scheduleReload = (file: string) => {
                  pendingFile = file;
                  if (reloadTimer) {
                    clearTimeout(reloadTimer);
                  }
                  reloadTimer = setTimeout(() => {
                    reloadTimer = null;
                    const basename = path.basename(pendingFile);
                    console.log(
                      `\n[Vite] 🔄 Shared build changed: ${basename}`,
                    );
                    console.log(
                      "[Vite] ⚡ Triggering debounced full reload...\n",
                    );
                    server.ws.send({
                      type: "full-reload",
                      path: "*",
                    });
                  }, 150);
                };

                const onSharedBuildChange = (file: string) => {
                  if (!file.includes("packages/shared/build/")) return;
                  if (!file.endsWith(".js") && !file.endsWith(".mjs")) return;
                  if (
                    !file.includes("framework.client") &&
                    !file.endsWith("framework.js")
                  )
                    return;
                  scheduleReload(file);
                };

                server.watcher.on("change", onSharedBuildChange);
                server.httpServer?.once("close", () => {
                  server.watcher.off("change", onSharedBuildChange);
                  if (reloadTimer) {
                    clearTimeout(reloadTimer);
                    reloadTimer = null;
                  }
                });

                console.log(
                  "[Vite] 👀 Watching shared build artifacts:",
                  sharedBuildPath,
                );
              },
            },
          ]),
      // Plugin to handle Node.js modules in browser was replaced by vite-plugin-node-polyfills
    ],

    // Tell Vite to look for .env files in the client directory
    envDir: clientDir,

    // Vite automatically exposes PUBLIC_ prefixed variables via import.meta.env
    envPrefix: "PUBLIC_",

    root: path.resolve(__dirname, "src"),
    publicDir: path.resolve(__dirname, "public"),
    cacheDir: viteCacheDir,

    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
      target: "esnext", // Support top-level await
      minify: mode === "production" ? "esbuild" : false, // Enable minification in production
      sourcemap: mode !== "production", // Disable source maps in production to save memory
      rollupOptions: {
        input: path.resolve(__dirname, "src/index.html"),
        external: ["fs", "fs-extra", "path", "node:fs", "node:path", "crypto"],
        output: {
          // Provide empty stubs for Node.js modules
          globals: {
            fs: "{}",
            "fs-extra": "{}",
            path: "{}",
            "node:fs": "{}",
            "node:path": "{}",
            crypto: "{}",
          },
          // Manual chunk splitting to reduce memory pressure during build
          manualChunks: {
            "vendor-react": ["react", "react-dom"],
            "vendor-three": ["three"],
            "vendor-ui": ["lucide-react"],
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
      // Provide Buffer global for libraries that expect it (bn.js, crypto)
      Buffer: "globalThis.Buffer",

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
      "process.env.PLAYWRIGHT_TEST": JSON.stringify(
        process.env.PLAYWRIGHT_TEST || "",
      ),
      "process.env.DEBUG_RPG": JSON.stringify(env.DEBUG_RPG || ""),
      // In development, default to local CDN if PUBLIC_CDN_URL is not set.
      "process.env.PUBLIC_CDN_URL": JSON.stringify(
        env.PUBLIC_CDN_URL ||
          (mode === "production"
            ? "https://assets.hyperscape.club"
            : "http://localhost:5555/game-assets"),
      ),
      "process.env.PUBLIC_STARTER_ITEMS": JSON.stringify(
        env.PUBLIC_STARTER_ITEMS || "",
      ),
      "process.env.TERRAIN_SEED": JSON.stringify(env.TERRAIN_SEED || "0"),
      "process.env.VITEST": "undefined", // Not in browser

      // Production API URLs - explicitly defined for production builds
      // These ALWAYS use production URLs when mode is "production", ignoring .env files
      // NOTE: mode is passed from Vite - "production" for `vite build`, "development" for `vite dev`
      // Use environment variables if set, otherwise use defaults
      //
      // Production: Frontend on Cloudflare Pages (hyperscape.club)
      //             Server on Railway (hyperscape-production.up.railway.app)
      "import.meta.env.PUBLIC_API_URL": JSON.stringify(
        env.PUBLIC_API_URL ||
          (mode === "production"
            ? "https://hyperscape-production.up.railway.app"
            : "http://localhost:5555"),
      ),
      "import.meta.env.PUBLIC_WS_URL": JSON.stringify(
        env.PUBLIC_WS_URL ||
          (mode === "production"
            ? "wss://hyperscape-production.up.railway.app/ws"
            : "ws://localhost:5555/ws"),
      ),
      // CDN URL - Cloudflare R2 with custom domain
      // In development without PUBLIC_CDN_URL, use game server's /game-assets/ endpoint.
      "import.meta.env.PUBLIC_CDN_URL": JSON.stringify(
        env.PUBLIC_CDN_URL ||
          (mode === "production"
            ? "https://assets.hyperscape.club"
            : "http://localhost:5555/game-assets"),
      ),
      "import.meta.env.PUBLIC_APP_URL": JSON.stringify(
        env.PUBLIC_APP_URL ||
          (mode === "production"
            ? "https://hyperscape.club"
            : "http://localhost:3333"),
      ),
      "import.meta.env.PUBLIC_ELIZAOS_URL": JSON.stringify(
        env.PUBLIC_ELIZAOS_URL ||
          (mode === "production"
            ? "https://hyperscape-production.up.railway.app"
            : env.PUBLIC_API_URL || "http://localhost:5555"),
      ),
      "import.meta.env.PUBLIC_PRIVY_APP_ID": JSON.stringify(
        env.PUBLIC_PRIVY_APP_ID || "",
      ),
      "import.meta.env.PLAYWRIGHT_TEST": JSON.stringify(
        process.env.PLAYWRIGHT_TEST === "true",
      ),
      "import.meta.env.PROD": mode === "production",
    },
    server: {
      port: Number(env.VITE_PORT) || 3333,
      open: false,
      host: true,
      hmr: disableSharedWatch ? false : undefined,
      // Security headers for development server
      headers: {
        "X-Content-Type-Options": "nosniff",
        ...(mode === "production" ? { "X-Frame-Options": "DENY" } : {}),
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
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
      // IMPORTANT: Use array format for aliases to ensure correct matching order
      // More specific paths (e.g., @hyperscape/procgen/items/dock) must be listed
      // BEFORE less specific ones (e.g., @hyperscape/procgen) to prevent incorrect resolution
      alias: [
        // Fix vite-plugin-node-polyfills shims not being resolved in production build
        // These need to resolve to the actual shim modules in node_modules
        {
          find: "vite-plugin-node-polyfills/shims/process",
          replacement: path.resolve(
            __dirname,
            "node_modules/vite-plugin-node-polyfills/shims/process/dist/index.js",
          ),
        },
        {
          find: "vite-plugin-node-polyfills/shims/buffer",
          replacement: path.resolve(
            __dirname,
            "node_modules/vite-plugin-node-polyfills/shims/buffer/dist/index.js",
          ),
        },
        {
          find: "vite-plugin-node-polyfills/shims/global",
          replacement: path.resolve(
            __dirname,
            "node_modules/vite-plugin-node-polyfills/shims/global/dist/index.js",
          ),
        },
        // Use client-only build of shared package to avoid Node.js module leakage
        {
          find: "@hyperscape/shared",
          replacement: path.resolve(
            __dirname,
            "../shared/build/framework.client.js",
          ),
        },
        // Workspace package aliases (these are kept external in shared's build)
        {
          find: "@hyperscape/decimation",
          replacement: path.resolve(__dirname, "../decimation/dist/index.js"),
        },
        {
          find: "@hyperscape/impostor",
          replacement: path.resolve(__dirname, "../impostors/dist/index.js"),
        },
        // Procgen package aliases - MOST SPECIFIC PATHS FIRST
        {
          find: "@hyperscape/procgen/building/town",
          replacement: path.resolve(
            __dirname,
            "../procgen/dist/building/town/index.js",
          ),
        },
        {
          find: "@hyperscape/procgen/building",
          replacement: path.resolve(
            __dirname,
            "../procgen/dist/building/index.js",
          ),
        },
        {
          find: "@hyperscape/procgen/items/dock",
          replacement: path.resolve(
            __dirname,
            "../procgen/dist/items/dock/index.js",
          ),
        },
        {
          find: "@hyperscape/procgen/items",
          replacement: path.resolve(
            __dirname,
            "../procgen/dist/items/index.js",
          ),
        },
        {
          find: "@hyperscape/procgen/terrain",
          replacement: path.resolve(
            __dirname,
            "../procgen/dist/terrain/index.js",
          ),
        },
        {
          find: "@hyperscape/procgen/vegetation",
          replacement: path.resolve(
            __dirname,
            "../procgen/dist/vegetation/index.js",
          ),
        },
        {
          find: "@hyperscape/procgen/grass",
          replacement: path.resolve(
            __dirname,
            "../procgen/dist/grass/index.js",
          ),
        },
        {
          find: "@hyperscape/procgen/rock",
          replacement: path.resolve(__dirname, "../procgen/dist/rock/index.js"),
        },
        {
          find: "@hyperscape/procgen/plant",
          replacement: path.resolve(
            __dirname,
            "../procgen/dist/plant/index.js",
          ),
        },
        // Base procgen alias LAST
        {
          find: "@hyperscape/procgen",
          replacement: path.resolve(__dirname, "../procgen/dist/index.js"),
        },
        // Generic app-source alias LAST so it doesn't shadow scoped packages.
        { find: "@", replacement: path.resolve(__dirname, "src") },
      ],
      dedupe: ["three", "buffer"],
    },

    optimizeDeps: disableSharedWatch
      ? {
          // In Playwright/E2E mode we disable discovery to avoid mid-test
          // re-optimization/chunk invalidation races.
          noDiscovery: true,
          include: [
            "three",
            "react",
            "react-dom",
            "react-dom/client",
            "buffer",
            "eventemitter3",
            "react-device-detect",
            "delaunator",
            "canonicalize",
            "fetch-retry",
            "three/examples/jsm/exporters/GLTFExporter.js",
            ...authOptimizeDeps,
            ...solanaOptimizeDeps,
          ],
          exclude: optimizeDepsExclude,
          force: forceOptimizeDeps,
        }
      : {
          include: [
            "three",
            "react",
            "react-dom",
            "react-dom/client",
            "eventemitter3",
            "react-device-detect",
            "canonicalize",
            "fetch-retry",
            ...authOptimizeDeps,
            ...solanaOptimizeDeps,
          ],
          exclude: optimizeDepsExclude,
          force: forceOptimizeDeps,
          esbuildOptions: {
            target: "esnext",
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
