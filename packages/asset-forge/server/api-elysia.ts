/**
 * Elysia API Server
 * Modern Bun-native backend for AI-powered 3D asset generation
 *
 * Migration from Express to Elysia for:
 * - 22x better performance (2.4M req/s vs 113K req/s)
 * - Native Bun file handling
 * - End-to-end type safety
 * - Built-in file upload support
 */

import "dotenv/config";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { serverTiming } from "@elysiajs/server-timing";
import { rateLimit } from "elysia-rate-limit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Services
import { AssetService } from "./services/AssetService";
import { RetextureService } from "./services/RetextureService";
import { GenerationService } from "./services/GenerationService";
import { ManifestService } from "./services/ManifestService";
import { LODBakingService } from "./services/LODBakingService";
import { VATBakingService } from "./services/VATBakingService";
import { PlacementService } from "./services/PlacementService";

// Middleware
import { errorHandler } from "./middleware/errorHandler";
import { loggingMiddleware } from "./middleware/logging";

// Routes
import { healthRoutes } from "./routes/health";
import { createMaterialRoutes } from "./routes/materials";
import { createRetextureRoutes } from "./routes/retexture";
import { createGenerationRoutes } from "./routes/generation";
import { aiVisionRoutes } from "./routes/ai-vision";
import { createAssetRoutes } from "./routes/assets";
import { createBatchSpritesRoutes } from "./routes/batch-sprites";
import { promptRoutes } from "./routes/prompts";
import { playtesterSwarmRoutes } from "./routes/playtester-swarm";
import { voiceGenerationRoutes } from "./routes/voice-generation";
import { soundEffectsRoutes } from "./routes/sound-effects";
import { contentGenerationRoutes } from "./routes/content-generation";
import { createManifestRoutes } from "./routes/manifests";
import { createLODRoutes } from "./routes/lod";
import { createVATRoutes } from "./routes/vat";
import { createPlacementRoutes } from "./routes/placements";
import { createProcgenRoutes } from "./routes/procgen";
import { ProcgenPresetService } from "./services/ProcgenPresetService";

// Armor Pipeline routes
import { createArmorPipelineRoutes } from "./routes/armor-pipeline";
import { ShellTextureService } from "./services/armor-pipeline/ShellTextureService";

// Tripo Pipeline routes
import { createTripoPipelineRoutes } from "./routes/tripo-pipeline";
import { TripoService } from "./services/armor-pipeline/TripoService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const ASSETS_DIR = path.resolve(
  process.env.ASSET_FORGE_ASSETS_DIR || path.join(ROOT_DIR, "gdd-assets"),
);
const TEMP_IMAGES_DIR = path.resolve(
  process.env.ASSET_FORGE_TEMP_IMAGES_DIR ||
    path.join(ROOT_DIR, "temp-images"),
);
const TEMP_SHELLS_DIR = path.resolve(
  process.env.ASSET_FORGE_TEMP_SHELLS_DIR ||
    path.join(ROOT_DIR, "temp-shells"),
);

// Ensure temp directories exist
await fs.promises.mkdir(TEMP_IMAGES_DIR, { recursive: true });
await fs.promises.mkdir(TEMP_SHELLS_DIR, { recursive: true });
await fs.promises.mkdir(ASSETS_DIR, { recursive: true });

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
};

function setFileHeaders(
  filePath: string,
  set: { headers: Record<string, string> },
) {
  const ext = path.extname(filePath).toLowerCase();
  set.headers["content-type"] =
    CONTENT_TYPES[ext] || "application/octet-stream";
  set.headers["cache-control"] = "public, max-age=3600";
}

async function serveFromDirectory(
  rootDir: string,
  prefix: string,
  pathname: string,
  set: { status?: number; headers: Record<string, string> },
  notFoundMessage = "File not found",
) {
  const relativePath = decodeURIComponent(pathname.slice(prefix.length));
  const safePath = path
    .normalize(relativePath)
    .replace(/^(\.\.(\/|\\|$))+/, "")
    .replace(/^\/+/, "");
  const root = path.resolve(rootDir);
  const resolvedFile = path.resolve(path.join(root, safePath));

  if (!resolvedFile.startsWith(root)) {
    set.status = 403;
    return { error: "Forbidden" };
  }

  const file = Bun.file(resolvedFile);
  if (!(await file.exists())) {
    set.status = 404;
    return { error: notFoundMessage };
  }

  setFileHeaders(resolvedFile, set);
  return file;
}

async function serveFrontend(
  pathname: string,
  set: { status?: number; headers: Record<string, string> },
) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path
    .normalize(normalizedPath)
    .replace(/^(\.\.(\/|\\|$))+/, "")
    .replace(/^\/+/, "");
  const requestedFile = path.join(DIST_DIR, safePath);
  const distRoot = path.resolve(DIST_DIR);
  const resolvedFile = path.resolve(requestedFile);

  if (resolvedFile.startsWith(distRoot)) {
    const file = Bun.file(resolvedFile);
    if (await file.exists()) {
      setFileHeaders(resolvedFile, set);
      return file;
    }
  }

  const indexFile = Bun.file(path.join(DIST_DIR, "index.html"));
  if (await indexFile.exists()) {
    set.headers["content-type"] = "text/html; charset=utf-8";
    return indexFile;
  }

  set.status = 404;
  return { error: "Asset Forge frontend has not been built" };
}

// Initialize services
const API_PORT =
  process.env.ASSET_FORGE_API_PORT || process.env.API_PORT || 3401;
const assetService = new AssetService(ASSETS_DIR);
const retextureService = new RetextureService({
  meshyApiKey: process.env.MESHY_API_KEY || "",
  imageServerBaseUrl:
    process.env.IMAGE_SERVER_URL || `http://localhost:${API_PORT}`,
});
const generationService = new GenerationService();

// World building services
const PROJECT_ROOT = path.join(ROOT_DIR, "..", "..");
const manifestService = new ManifestService(PROJECT_ROOT);
const lodBakingService = new LODBakingService(PROJECT_ROOT);
const vatBakingService = new VATBakingService(PROJECT_ROOT);
const placementService = new PlacementService(PROJECT_ROOT);
const procgenPresetService = new ProcgenPresetService();

// Armor Pipeline services
const shellTextureService = new ShellTextureService({
  meshyApiKey: process.env.MESHY_API_KEY || "",
  shellDir: TEMP_SHELLS_DIR,
});

// Tripo service
const tripoService = new TripoService({
  tripoApiKey: process.env.TRIPO_API_KEY || "",
});

// Create Elysia app
const app = new Elysia()
  // Performance monitoring
  .use(serverTiming())

  // Rate limiting - protect against abuse
  .use(
    rateLimit({
      duration: 60000, // 1 minute window
      max: 100, // 100 requests per minute per IP
      errorResponse: new Response(
        JSON.stringify({
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please try again later.",
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        },
      ),
      // Skip rate limiting for health checks
      skip: (req) => new URL(req.url).pathname === "/api/health",
    }),
  )

  // Swagger API documentation
  .use(
    swagger({
      documentation: {
        info: {
          title: "3D Asset Forge API",
          version: "1.0.0",
          description: "AI-powered 3D asset generation and management system",
        },
        tags: [
          { name: "Health", description: "Health check endpoints" },
          { name: "Assets", description: "Asset management endpoints" },
          {
            name: "Projects",
            description: "Project management and organization",
          },
          {
            name: "Users",
            description: "User profile and settings management",
          },
          {
            name: "Material Presets",
            description: "Material preset management",
          },
          {
            name: "Retexturing",
            description: "Asset retexturing and regeneration",
          },
          {
            name: "Generation",
            description: "AI-powered asset generation pipeline",
          },
          { name: "Sprites", description: "Sprite generation and management" },
          { name: "VRM", description: "VRM file upload and processing" },
          {
            name: "AI Vision",
            description: "GPT-5 Vision-powered weapon detection",
          },
          {
            name: "Voice Generation",
            description: "ElevenLabs text-to-speech for NPC dialogue",
          },
          {
            name: "Sound Effects",
            description: "ElevenLabs text-to-sound-effects for game audio",
          },
          {
            name: "Content Generation",
            description: "AI-powered NPC, quest, dialogue, and lore generation",
          },
          {
            name: "Manifests",
            description:
              "Game manifest file management (biomes, NPCs, quests, etc.)",
          },
          {
            name: "LOD Pipeline",
            description:
              "Level of Detail model baking for vegetation and resources",
          },
          {
            name: "VAT Pipeline",
            description: "Vertex Animation Texture baking for animated mobs",
          },
          {
            name: "Placements",
            description:
              "Manual object placement management for world building",
          },
          {
            name: "Procgen",
            description:
              "Procedural generation presets - save seeds + settings, batch generation",
          },
        ],
        components: {
          securitySchemes: {
            BearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description:
                "Privy access token (optional - some endpoints work without auth)",
            },
          },
        },
      },
    }),
  )

  // CORS configuration
  .use(
    cors({
      origin:
        process.env.NODE_ENV === "production"
          ? process.env.FRONTEND_URL || false
          : true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    }),
  )

  // Middleware
  .use(errorHandler)
  .use(loggingMiddleware)

  // Static file serving - generated assets
  .get(
    "/gdd-assets/*",
    async ({ request, set }) =>
      serveFromDirectory(
        ASSETS_DIR,
        "/gdd-assets",
        new URL(request.url).pathname,
        set,
        "Asset not found",
      ),
  )

  // Static file serving - temp images for Meshy AI (custom handler since plugin is disabled)
  .get("/temp-images/:filename", async ({ params, set }) => {
    const safeName = path.basename(params.filename);
    const filePath = path.join(TEMP_IMAGES_DIR, safeName);

    try {
      const file = Bun.file(filePath);
      const exists = await file.exists();

      if (!exists) {
        set.status = 404;
        return { error: "File not found" };
      }

      // Set appropriate content type based on file extension
      const ext = path.extname(safeName).toLowerCase();
      const contentTypes: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
      };

      set.headers["content-type"] =
        contentTypes[ext] || "application/octet-stream";
      set.headers["cache-control"] = "public, max-age=3600";

      return file;
    } catch (error) {
      console.error(`Error serving temp image ${safeName}:`, error);
      set.status = 500;
      return { error: "Internal server error" };
    }
  })

  // Static file serving - temp images for Meshy AI (plugin disabled, using custom handler above)
  // .use(
  //   staticPlugin({
  //     assets: path.join(ROOT_DIR, "temp-images"),
  //     prefix: "/temp-images",
  //   }),
  // )

  // Static file serving - temp shell GLBs (for Meshy AI texturing)
  .get("/temp-shells/:filename", async ({ params, set }) => {
    const safeName = path.basename(params.filename);
    const filePath = path.join(TEMP_SHELLS_DIR, safeName);
    try {
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        set.status = 404;
        return { error: "Shell file not found" };
      }
      set.headers["content-type"] = "model/gltf-binary";
      set.headers["cache-control"] = "public, max-age=3600";
      return file;
    } catch (error) {
      set.status = 500;
      return { error: "Failed to serve shell file" };
    }
  })

  // Static file serving - game model assets (for batch sprite generation)
  .get(
    "/game-models/*",
    async ({ request, set }) =>
      serveFromDirectory(
        path.resolve(ROOT_DIR, "../server/world/assets/models"),
        "/game-models",
        new URL(request.url).pathname,
        set,
        "Game model not found",
      ),
  )

  // Routes
  .use(healthRoutes)
  .use(promptRoutes)
  .use(aiVisionRoutes)
  .use(createAssetRoutes(ROOT_DIR, assetService, lodBakingService))
  .use(createBatchSpritesRoutes(ROOT_DIR))
  .use(createMaterialRoutes(ROOT_DIR))
  .use(createRetextureRoutes(ROOT_DIR, retextureService))
  .use(createGenerationRoutes(generationService))
  .use(playtesterSwarmRoutes)
  .use(voiceGenerationRoutes)
  .use(soundEffectsRoutes)
  .use(contentGenerationRoutes)
  // World building routes
  .use(createManifestRoutes(manifestService))
  .use(createLODRoutes(lodBakingService, PROJECT_ROOT))
  .use(createVATRoutes(vatBakingService))
  .use(createPlacementRoutes(placementService))
  // Procgen preset management
  .use(createProcgenRoutes(procgenPresetService))
  // Armor pipeline (POC-2: shell texturing)
  .use(createArmorPipelineRoutes(shellTextureService))
  // Tripo pipeline (Tripo 3D AI)
  .use(createTripoPipelineRoutes(tripoService))
  // Built Asset Forge frontend. Keep API-like prefixes as JSON 404s instead of
  // returning index.html for typoed endpoints.
  .get("/*", async ({ request, set }) => {
    const pathname = new URL(request.url).pathname;
    const apiPrefixes = [
      "/api",
      "/swagger",
      "/gdd-assets",
      "/temp-images",
      "/temp-shells",
      "/game-models",
    ];

    if (apiPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      set.status = 404;
      return { error: "Not found" };
    }

    return serveFrontend(pathname, set);
  })

  // Start server
  .listen(API_PORT);

console.log(`🚀 Elysia API Server running on http://localhost:${API_PORT}`);
console.log(`📊 Health check: http://localhost:${API_PORT}/api/health`);
console.log(`🖼️  Temp images: http://localhost:${API_PORT}/temp-images/`);
console.log(`✨ Performance: 22x faster than Express!`);

if (!process.env.MESHY_API_KEY) {
  console.warn("⚠️  MESHY_API_KEY not found - Meshy retexturing will fail");
}
if (!process.env.TRIPO_API_KEY) {
  console.warn("⚠️  TRIPO_API_KEY not found - Tripo pipeline will fail");
}
if (!process.env.AI_GATEWAY_API_KEY && !process.env.OPENAI_API_KEY) {
  console.warn(
    "⚠️  AI_GATEWAY_API_KEY or OPENAI_API_KEY required - image generation and prompt enhancement will fail",
  );
}
if (!process.env.ELEVENLABS_API_KEY) {
  console.warn(
    "⚠️  ELEVENLABS_API_KEY not found - voice and sound effects generation will fail",
  );
}

export type App = typeof app;
