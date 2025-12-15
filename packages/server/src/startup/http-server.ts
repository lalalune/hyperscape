/**
 * HTTP Server Module - Fastify setup and static file serving
 *
 * Configures and initializes the Fastify HTTP server with all necessary
 * middleware, static file serving, CORS, WebSocket support, and proper
 * caching headers for production performance.
 *
 * Responsibilities:
 * - Create Fastify instance with logging
 * - Configure CORS for development and production
 * - Set up static file serving (public/, assets/, world/)
 * - Configure proper MIME types and caching headers
 * - Handle index.html for SPA routing
 * - Register multipart and WebSocket plugins
 * - Set up error handlers
 *
 * Usage:
 * ```typescript
 * const fastify = await createHttpServer(config);
 * // Register routes...
 * await fastify.listen({ port: config.port, host: '0.0.0.0' });
 * ```
 */

import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import statics from "@fastify/static";
import fastifyWebSocket from "@fastify/websocket";
import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
  type FastifyReply,
} from "fastify";
import fs from "fs-extra";
import path from "path";
import type { ServerConfig } from "./config.js";
import {
  getGlobalRateLimit,
  isRateLimitEnabled,
} from "../infrastructure/rate-limit/rate-limit-config.js";

/**
 * Create and configure Fastify HTTP server
 *
 * Sets up Fastify with all middleware, static file serving, CORS, WebSocket
 * support, and proper caching headers. Does NOT start the server listening -
 * that's done after routes are registered.
 *
 * @param config - Server configuration
 * @returns Promise resolving to configured Fastify instance
 */
export async function createHttpServer(
  config: ServerConfig,
): Promise<FastifyInstance> {
  console.log("[HTTP] Creating Fastify server...");

  // Create Fastify instance with minimal logging
  const fastify = Fastify({ logger: { level: "error" } });

  // Configure CORS for development and production
  // Standalone: Client 3333, Server 5555
  // Jeju mode: Client 5013, Server 5014
  await fastify.register(cors, {
    origin: [
      "http://localhost:4001", // ElizaOS API
      "http://localhost:3333", // Game Client (standalone)
      "http://localhost:5013", // Game Client (jeju mode)
      "http://localhost:5555", // Game Server (standalone)
      "http://localhost:5014", // Game Server (jeju mode)
      "http://localhost:7777",
      /^https?:\/\/localhost:\d+$/,
      /^https:\/\/.+\.farcaster\.xyz$/,
      /^https:\/\/.+\.warpcast\.com$/,
      /^https:\/\/.+\.privy\.io$/,
      true,
    ],
    credentials: true,
    methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS"],
  });
  console.log("[HTTP] ✅ CORS configured");

  // Configure rate limiting for production security
  if (isRateLimitEnabled()) {
    await fastify.register(rateLimit, getGlobalRateLimit());
    console.log(
      "[HTTP] ✅ Rate limiting enabled (100 requests/min per IP globally)",
    );
  } else {
    console.log("[HTTP] ⚠️  Rate limiting disabled (development mode)");
  }

  // Serve index.html for root path (SPA routing)
  await registerIndexHtmlRoute(fastify, config);

  // Register static file serving (public/, assets/)
  await registerStaticFiles(fastify, config);

  // Register multipart for file uploads
  fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
  });
  console.log("[HTTP] ✅ Multipart registered");

  // Register WebSocket support
  fastify.register(fastifyWebSocket);
  console.log("[HTTP] ✅ WebSocket support registered");

  // Set up error handler
  fastify.setErrorHandler((err, _req, reply) => {
    fastify.log.error(err);
    reply.status(500).send({ error: "Internal server error" });
  });

  console.log("[HTTP] ✅ HTTP server created");
  return fastify;
}

/**
 * Register index.html routes for SPA
 *
 * Serves index.html for both "/" and "/index.html" with no-cache headers
 * to ensure clients always get the latest version.
 *
 * @param fastify - Fastify instance
 * @param config - Server configuration
 * @private
 */
async function registerIndexHtmlRoute(
  fastify: FastifyInstance,
  config: ServerConfig,
): Promise<void> {
  const indexHtmlPath = path.join(config.__dirname, "public", "index.html");

  const serveIndexHtml = async (_req: FastifyRequest, reply: FastifyReply) => {
    const html = await fs.promises.readFile(indexHtmlPath, "utf-8");

    return reply
      .type("text/html; charset=utf-8")
      .header("Cache-Control", "no-cache, no-store, must-revalidate")
      .header("Pragma", "no-cache")
      .header("Expires", "0")
      .send(html);
  };

  fastify.get("/", serveIndexHtml);
  fastify.get("/index.html", serveIndexHtml);
  console.log("[HTTP] ✅ Index.html routes registered");
}

/**
 * Register all static file serving
 *
 * Sets up static file serving for:
 * - Public directory (client app, scripts, CSS)
 * - World assets (/assets/world/)
 * - Legacy assets route (/assets/)
 * - Manual music route (workaround for static issues)
 * - System plugins (if SYSTEMS_PATH is set)
 *
 * @param fastify - Fastify instance
 * @param config - Server configuration
 * @private
 */
async function registerStaticFiles(
  fastify: FastifyInstance,
  config: ServerConfig,
): Promise<void> {
  // Serve public directory with proper caching
  await fastify.register(statics, {
    root: path.join(config.__dirname, "public"),
    prefix: "/",
    decorateReply: false,
    list: false,
    index: false,
    setHeaders: (res, filePath) => {
      setStaticHeaders(res, filePath);
    },
  });
  console.log("[HTTP] ✅ Public directory registered");

  // Register world assets at /assets/world/
  await fastify.register(statics, {
    root: config.assetsDir,
    prefix: "/assets/world/",
    decorateReply: false,
    setHeaders: (res, filePath) => {
      setAssetHeaders(res, filePath);
    },
  });
  console.log(`[HTTP] ✅ Registered /assets/world/ → ${config.assetsDir}`);

  // Manual music route (workaround for static file issues)
  registerMusicRoute(fastify, config);

  // ALSO register as /assets/ for backward compatibility
  await fastify.register(statics, {
    root: config.assetsDir,
    prefix: "/assets/",
    decorateReply: false,
    setHeaders: (res, filePath) => {
      setAssetHeaders(res, filePath);
    },
  });
  console.log(`[HTTP] ✅ Registered /assets/ → ${config.assetsDir}`);

  // Log available assets
  await logAvailableAssets(fastify, config);

  // Register systems static serving if available
  if (config.systemsPath) {
    await fastify.register(statics, {
      root: config.systemsPath,
      prefix: "/dist/",
      decorateReply: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "public, max-age=300");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET");
      },
    });
    console.log(`[HTTP] ✅ Registered /dist/ → ${config.systemsPath}`);
  }
}

/**
 * Set headers for public static files
 *
 * Configures caching and MIME types for scripts, CSS, HTML, and WASM files.
 *
 * @param res - HTTP response object
 * @param filePath - Path to the file being served
 * @private
 */
function setStaticHeaders(
  res: { setHeader: (k: string, v: string) => void },
  filePath: string,
): void {
  if (filePath.endsWith(".wasm")) {
    res.setHeader("Content-Type", "application/wasm");
    res.setHeader("Cache-Control", "public, max-age=3600");
  } else if (filePath.endsWith(".js")) {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    if (filePath.includes("/assets/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.setHeader("Cache-Control", "public, max-age=300");
    }
  } else if (filePath.endsWith(".css")) {
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    if (filePath.includes("/assets/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.setHeader("Cache-Control", "public, max-age=300");
    }
  } else if (filePath.endsWith(".html")) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  } else {
    res.setHeader("Cache-Control", "public, max-age=300");
  }

  // Security headers for SharedArrayBuffer support
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
}

/**
 * Set headers for asset files
 *
 * Configures aggressive caching and MIME types for models, audio, etc.
 *
 * @param res - HTTP response object
 * @param filePath - Path to the asset being served
 * @private
 */
function setAssetHeaders(
  res: { setHeader: (k: string, v: string) => void },
  filePath: string,
): void {
  // Set MIME types
  if (filePath.endsWith(".mp3")) {
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Accept-Ranges", "bytes");
  } else if (filePath.endsWith(".ogg")) {
    res.setHeader("Content-Type", "audio/ogg");
    res.setHeader("Accept-Ranges", "bytes");
  } else if (filePath.endsWith(".wav")) {
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Accept-Ranges", "bytes");
  } else if (filePath.endsWith(".glb")) {
    res.setHeader("Content-Type", "model/gltf-binary");
  }

  // Aggressive caching for assets (immutable, 1 year)
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Expires", new Date(Date.now() + 31536000000).toUTCString());
}

/**
 * Register manual music route
 *
 * Workaround for static file serving issues with music files.
 * Tries multiple paths to find music files.
 *
 * @param fastify - Fastify instance
 * @param config - Server configuration
 * @private
 */
function registerMusicRoute(
  fastify: FastifyInstance,
  config: ServerConfig,
): void {
  fastify.get(
    "/assets/world/music/:category/:filename",
    async (request, reply) => {
      const { category, filename } = request.params as {
        category: string;
        filename: string;
      };

      // Validate inputs
      if (!/^\w+\.mp3$/.test(filename)) {
        return reply.code(400).send({ error: "Invalid filename" });
      }
      if (
        category !== "normal" &&
        category !== "combat" &&
        category !== "intro"
      ) {
        return reply.code(400).send({ error: "Invalid category" });
      }

      // Try primary path
      const primaryPath = path.join(
        config.assetsDir,
        "audio",
        "music",
        category,
        filename,
      );

      // Try alternate paths
      const pubCandidates = [
        path.join(config.__dirname, "../..", "public", "assets/world"),
        path.join(config.__dirname, "..", "public", "assets/world"),
        path.join(process.cwd(), "public", "assets/world"),
        path.join(
          process.cwd(),
          "packages",
          "hyperscape",
          "public",
          "assets/world",
        ),
      ];

      // Try primary path first
      if (await fs.pathExists(primaryPath)) {
        reply.type("audio/mpeg");
        reply.header("Accept-Ranges", "bytes");
        reply.header("Cache-Control", "public, max-age=31536000, immutable");
        return reply.send(fs.createReadStream(primaryPath));
      }

      // Try alternates
      for (const pubRoot of pubCandidates) {
        const altPath = path.join(
          pubRoot,
          "audio",
          "music",
          category,
          filename,
        );

        if (await fs.pathExists(altPath)) {
          reply.type("audio/mpeg");
          reply.header("Accept-Ranges", "bytes");
          reply.header("Cache-Control", "public, max-age=31536000, immutable");
          return reply.send(fs.createReadStream(altPath));
        }
      }

      return reply.code(404).send({
        error: "Music file not found",
        tried: [
          primaryPath,
          ...pubCandidates.map((r) =>
            path.join(r, "music", category, filename),
          ),
        ],
      });
    },
  );
  console.log("[HTTP] ✅ Manual music route registered");
}

/**
 * Log available assets for debugging
 *
 * @param fastify - Fastify instance
 * @param config - Server configuration
 * @private
 */
async function logAvailableAssets(
  fastify: FastifyInstance,
  config: ServerConfig,
): Promise<void> {
  const toolsDir = path.join(config.assetsDir, "models/tools");
  if (await fs.pathExists(toolsDir)) {
    const toolFiles = await fs.readdir(toolsDir);
    fastify.log.info(`[HTTP] Tools available: ${toolFiles.join(", ")}`);
  }

  const mobsDir = path.join(config.assetsDir, "models/mobs");
  if (await fs.pathExists(mobsDir)) {
    const mobFiles = await fs.readdir(mobsDir);
    fastify.log.info(`[HTTP] Mob models available: ${mobFiles.join(", ")}`);
  }
}
