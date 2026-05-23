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
import { staticPlugin } from "@elysiajs/static";
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
import { securityHeaders } from "./middleware/securityHeaders";

// Routes
import { healthRoutes } from "./routes/health";
import { pluginRoutes } from "./routes/plugins";
import { createMaterialRoutes } from "./routes/materials";
import { createRetextureRoutes } from "./routes/retexture";
import { createGenerationRoutes } from "./routes/generation";
import { aiVisionRoutes } from "./routes/ai-vision";
import { createAssetRoutes } from "./routes/assets";
import { createBatchSpritesRoutes } from "./routes/batch-sprites";
import { promptRoutes } from "./routes/prompts";
import { playtesterSwarmRoutes } from "./routes/playtester-swarm";
import { voiceGenerationRoutes } from "./routes/voice-generation";
import { musicRoutes } from "./routes/music";
import { soundEffectsRoutes } from "./routes/sound-effects";
import { contentGenerationRoutes } from "./routes/content-generation";
import { createManifestRoutes } from "./routes/manifests";
import { createLODRoutes } from "./routes/lod";
import { createVATRoutes } from "./routes/vat";
import { createPlacementRoutes } from "./routes/placements";
import { createProcgenRoutes } from "./routes/procgen";
import { ProcgenPresetService } from "./services/ProcgenPresetService";

// World Studio services
import { TeamService } from "./services/TeamService";
import { AuditLogService } from "./services/AuditLogService";
import { WorldProjectService } from "./services/WorldProjectService";
import { PluginRegistryService } from "./services/PluginRegistryService";
import { GameModuleService } from "./services/GameModuleService";
import { ScriptService } from "./services/ScriptService";
import { UILayoutService } from "./services/UILayoutService";

// World data routes
import { worldTreeRoutes } from "./routes/world-trees";
import { worldLayoutRoutes } from "./routes/world-layout";

// World Studio routes
import { createAuthRoutes } from "./routes/auth";
import { createTeamRoutes, createInviteAcceptRoute } from "./routes/teams";
import { createGameRoutes } from "./routes/games";
import { createWorldProjectRoutes } from "./routes/world-projects";
import { createStandaloneRoutes } from "./routes/standalone";
import { createPluginRegistryRoutes } from "./routes/plugin-registry";
import { createAssetPackRoutes } from "./routes/asset-packs";
import { createContentPackRoutes } from "./routes/content-packs";
import { createProjectPackRoutes } from "./routes/project-packs";
import { AssetPackService } from "./services/AssetPackService";
import { ProjectPackService } from "./services/ProjectPackService";
import { createDeploymentRoutes } from "./routes/deployments";
import { createModuleRoutes } from "./routes/modules";
import { createScriptRoutes } from "./routes/scripts";
import { createUILayoutRoutes } from "./routes/ui-layouts";

// Database initialization (auto-Docker when USE_LOCAL_POSTGRES=true)
import { initializeDatabase } from "./db/db";

// Armor Pipeline routes
import { createArmorPipelineRoutes } from "./routes/armor-pipeline";
import { ShellTextureService } from "./services/armor-pipeline/ShellTextureService";

// Tripo Pipeline routes
import { createTripoPipelineRoutes } from "./routes/tripo-pipeline";
import { TripoService } from "./services/armor-pipeline/TripoService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..");

// Ensure temp directories exist
await fs.promises.mkdir(path.join(ROOT_DIR, "temp-images"), {
  recursive: true,
});
await fs.promises.mkdir(path.join(ROOT_DIR, "temp-shells"), {
  recursive: true,
});

// Startup validation — confirm auth env vars are loaded
const _privyId = process.env.PRIVY_APP_ID || process.env.PUBLIC_PRIVY_APP_ID;
const _privySecret = process.env.PRIVY_APP_SECRET;
console.log(
  "[Startup] Auth config: PRIVY_APP_ID=%s PRIVY_APP_SECRET=%s GRANT_DEV_ADMIN=%s",
  _privyId ? `${_privyId.slice(0, 8)}...` : "NOT SET",
  _privySecret ? "SET" : "NOT SET",
  process.env.GRANT_DEV_ADMIN || "not set",
);

// Initialize database before services that depend on it
await initializeDatabase();

// Initialize services
const API_PORT =
  process.env.ASSET_FORGE_API_PORT || process.env.API_PORT || 3401;
const assetService = new AssetService(path.join(ROOT_DIR, "gdd-assets"));
const retextureService = new RetextureService({
  meshyApiKey: process.env.MESHY_API_KEY || "",
  imageServerBaseUrl:
    process.env.IMAGE_SERVER_URL || `http://localhost:${API_PORT}`,
});
const generationService = new GenerationService();

// World building services
const PROJECT_ROOT = path.join(ROOT_DIR, "..", "..");
const GAME_WORLD_ROOT = path.join(ROOT_DIR, "..", "server", "world");
const manifestService = new ManifestService(GAME_WORLD_ROOT);
const lodBakingService = new LODBakingService(PROJECT_ROOT);
const vatBakingService = new VATBakingService(PROJECT_ROOT);
const placementService = new PlacementService(PROJECT_ROOT);
const procgenPresetService = new ProcgenPresetService();

// World Studio services
const teamService = new TeamService();
const auditLogService = new AuditLogService();
const worldProjectService = new WorldProjectService();
const pluginRegistryService = new PluginRegistryService();
const assetPackService = new AssetPackService();
const projectPackService = new ProjectPackService(worldProjectService);
const gameModuleService = new GameModuleService();
const scriptService = new ScriptService();
const uiLayoutService = new UILayoutService();

// Armor Pipeline services
const shellTextureService = new ShellTextureService({
  meshyApiKey: process.env.MESHY_API_KEY || "",
  shellDir: path.join(ROOT_DIR, "temp-shells"),
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
      // Skip rate limiting for read-only data endpoints
      skip: (req) => {
        const path = new URL(req.url).pathname;
        const method = req.method;
        // Always exempt health checks and manifest reads
        if (path === "/api/health" || path.startsWith("/api/manifests"))
          return true;
        // Only skip rate limiting for READ operations on world data
        if (path.startsWith("/api/world/") && method === "GET") return true;
        // Phase 2.3.1 — Standalone Launch endpoints are polled by
        // design (500ms cadence during boot, 5s once stable) so the
        // user sees state transitions promptly. The default 100/min
        // budget caps cleanly under that polling rate.
        if (path.startsWith("/api/standalone")) return true;
        return false;
      },
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
            name: "Music Generation",
            description: "ElevenLabs AI music generation for game soundtracks",
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
          {
            name: "Auth",
            description: "Authentication and user profile",
          },
          {
            name: "Teams",
            description: "Team management, members, and invites",
          },
          {
            name: "Games",
            description: "Game project management within teams",
          },
          {
            name: "World Projects",
            description:
              "World project CRUD, locking, snapshots, and deployments",
          },
          {
            name: "Game Modules",
            description:
              "Custom GameModule definitions — entity types, palettes, markers, and terrain config",
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
  .use(securityHeaders)

  // Global body size limit (10 MB for JSON payloads)
  .onParse({ as: "global" }, async ({ request, contentType }) => {
    if (contentType === "application/json" || contentType === "text/plain") {
      const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB
      const contentLength = request.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
        throw new Error("Request body too large (max 10 MB)");
      }
    }
  })

  // Static file serving - generated assets
  .use(
    staticPlugin({
      assets: path.join(ROOT_DIR, "gdd-assets"),
      prefix: "/gdd-assets",
    }),
  )

  // Static file serving - temp images for Meshy AI (custom handler since plugin is disabled)
  .get("/temp-images/:filename", async ({ params, set }) => {
    const safeName = path.basename(params.filename);
    const filePath = path.join(ROOT_DIR, "temp-images", safeName);

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
    const filePath = path.join(ROOT_DIR, "temp-shells", safeName);
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
  .use(
    staticPlugin({
      assets: path.resolve(ROOT_DIR, "../server/world/assets/models"),
      prefix: "/game-models",
    }),
  )

  // Static file serving - game terrain biome textures (for textured terrain in World Studio)
  .use(
    staticPlugin({
      assets: path.resolve(ROOT_DIR, "../server/world/assets/textures"),
      prefix: "/game-textures",
    }),
  )

  // Static file serving - public assets (emotes, rigs, etc.)
  .use(
    staticPlugin({
      assets: path.join(ROOT_DIR, "public"),
      prefix: "/",
    }),
  )

  // Routes
  .use(healthRoutes)
  .use(pluginRoutes)
  .use(promptRoutes)
  .use(aiVisionRoutes)
  .use(createAssetRoutes(ROOT_DIR, assetService))
  .use(createBatchSpritesRoutes(ROOT_DIR))
  .use(createMaterialRoutes(ROOT_DIR))
  .use(createRetextureRoutes(ROOT_DIR, retextureService))
  .use(createGenerationRoutes(generationService))
  .use(playtesterSwarmRoutes)
  .use(voiceGenerationRoutes)
  .use(musicRoutes)
  .use(soundEffectsRoutes)
  .use(contentGenerationRoutes)
  // World building routes
  .use(createManifestRoutes(manifestService))
  .use(createLODRoutes(lodBakingService, PROJECT_ROOT))
  .use(createVATRoutes(vatBakingService))
  .use(createPlacementRoutes(placementService))
  // World data (trees, towns, roads) — runs actual game generation code
  .use(worldTreeRoutes)
  .use(worldLayoutRoutes)
  // Procgen preset management
  .use(createProcgenRoutes(procgenPresetService))
  // World Studio routes (auth, teams, games, world projects)
  .use(createAuthRoutes(teamService))
  .use(createTeamRoutes(teamService, auditLogService))
  .use(createInviteAcceptRoute(teamService))
  .use(createGameRoutes(teamService, auditLogService, uiLayoutService))
  .use(
    createWorldProjectRoutes(teamService, worldProjectService, auditLogService),
  )
  .use(createStandaloneRoutes(teamService, worldProjectService))
  .use(createPluginRegistryRoutes(pluginRegistryService))
  .use(createAssetPackRoutes(assetPackService, teamService))
  .use(createContentPackRoutes(assetPackService, worldProjectService))
  .use(createProjectPackRoutes(projectPackService, teamService))
  .use(
    createDeploymentRoutes(teamService, worldProjectService, auditLogService),
  )
  .use(createModuleRoutes(teamService, gameModuleService, auditLogService))
  .use(createScriptRoutes(teamService, scriptService, auditLogService))
  .use(createUILayoutRoutes(teamService, uiLayoutService, auditLogService))
  // Armor pipeline (POC-2: shell texturing)
  .use(createArmorPipelineRoutes(shellTextureService))
  // Tripo pipeline (Tripo 3D AI)
  .use(createTripoPipelineRoutes(tripoService))

  // Start server
  .listen(API_PORT);

console.log(`🚀 Elysia API Server running on http://localhost:${API_PORT}`);
console.log(`📊 Health check: http://localhost:${API_PORT}/api/health`);
console.log(`🖼️  Temp images: http://localhost:${API_PORT}/temp-images/`);
console.log(`✨ Performance: 22x faster than Express!`);

// ────────────────────────────────────────────────────────────
// Built-in content pack bootstrap — UE5 "Engine/" content
// pattern: every install of asset-forge ships with a fixed
// catalog of themed content packs that auto-bootstrap into the
// `asset_packs` table on server start. No manual seeder run
// required for first-boot or for picking up new packs added in
// code.
//
// Idempotent — UPSERTs by manifest_id; re-runs replace only
// when the in-code `packVersion` changes. Soft-fails per-pack
// so one broken manifest doesn't block the rest. Async
// fire-and-forget to keep server boot fast; the seed completes
// in the background while the API is already accepting
// requests (route handlers gracefully see an empty catalog
// during the brief seed window).
// ────────────────────────────────────────────────────────────
import("./builtins/content-packs")
  .then(({ upsertBuiltinContentPacks, BUILTIN_CONTENT_PACKS }) => {
    void import("./builtins/project-packs").then(
      ({ upsertBuiltinProjectPacks, BUILTIN_PROJECT_PACKS }) => {
        void import("pg").then(async ({ Pool }) => {
          const url =
            process.env.DATABASE_URL ||
            `postgresql://${process.env.FORGE_POSTGRES_USER || "forge"}:${process.env.FORGE_POSTGRES_PASSWORD || "forge_dev_password"}@localhost:${process.env.FORGE_POSTGRES_PORT || "5489"}/${process.env.FORGE_POSTGRES_DB || "forge"}`;
          const pool = new Pool({ connectionString: url });
          try {
            const contentResult = await upsertBuiltinContentPacks(pool);
            console.log(
              `📦 Built-in content packs: ${contentResult.ok}/${BUILTIN_CONTENT_PACKS.length} ready` +
                (contentResult.failed > 0
                  ? ` (${contentResult.failed} failed)`
                  : ""),
            );
            const projectResult = await upsertBuiltinProjectPacks(pool);
            console.log(
              `🎮 Built-in project packs: ${projectResult.ok}/${BUILTIN_PROJECT_PACKS.length} ready` +
                (projectResult.failed > 0
                  ? ` (${projectResult.failed} failed)`
                  : ""),
            );
          } catch (err) {
            console.warn(
              "📦 Built-in pack bootstrap failed (server still running):",
              err,
            );
          } finally {
            await pool.end();
          }
        });
      },
    );
  })
  .catch((err) => {
    console.warn("📦 Built-in content packs module load failed:", err);
  });

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
    "⚠️  ELEVENLABS_API_KEY not found - voice, music, and sound effects generation will fail",
  );
}

export type App = typeof app;
