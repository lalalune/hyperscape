import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

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

  return {
    plugins: [
      react(),
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
      minify: mode === "production" ? "esbuild" : false, // Enable minification in production
      sourcemap: mode !== "production", // Disable source maps in production to save memory
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
      // In development, use game server for CDN if PUBLIC_CDN_URL not set
      // Game server serves manifests at /manifests/ and assets at /assets/
      "process.env.PUBLIC_CDN_URL": JSON.stringify(
        env.PUBLIC_CDN_URL ||
          (mode === "production"
            ? "http://localhost:8080"
            : "http://localhost:5555"),
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
      // In development without PUBLIC_CDN_URL, use game server which serves manifests/assets
      "import.meta.env.PUBLIC_CDN_URL": JSON.stringify(
        env.PUBLIC_CDN_URL ||
          (mode === "production"
            ? "https://assets.hyperscape.club"
            : "http://localhost:5555"),
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
      "import.meta.env.PROD": mode === "production",
    },
    server: {
      port: Number(env.VITE_PORT) || 3333,
      open: false,
      host: true,
      // Security headers for development server
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
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
      alias: {
        "@": path.resolve(__dirname, "src"),
        // Use client-only build of shared package to avoid Node.js module leakage
        "@hyperscape/shared": path.resolve(
          __dirname,
          "../shared/build/framework.client.js",
        ),
        // Ensure buffer polyfill is used consistently
        buffer: "buffer",
      },
      dedupe: ["three", "buffer"],
    },

    optimizeDeps: {
      include: ["three", "react", "react-dom", "buffer"],
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
