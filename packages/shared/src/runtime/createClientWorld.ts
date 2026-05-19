/**
 * createClientWorld.ts - Client World Factory
 *
 * Creates and configures a World instance for client-side (browser) execution.
 * This factory function registers all client-specific systems in the correct order
 * to ensure proper dependency resolution and initialization.
 *
 * Architecture:
 * - Client receives authoritative state from server
 * - No client-side prediction or interpolation (server is authoritative)
 * - Client handles rendering, input, audio, and UI
 * - Uses WebGPU for graphics via three.js
 * - PhysX physics runs locally for immediate feedback (validated by server)
 *
 * Systems Registered:
 * 1. Core Systems: ClientRuntime, Stage, ClientNetwork
 * 2. Media: ClientLiveKit (voice), ClientAudio
 * 3. Rendering: ClientGraphics, Environment, ClientCameraSystem
 * 4. Input: ClientInput (keyboard, mouse, touch)
 * 5. UI: ClientInterface (preferences, UI state)
 * 6. Loading: ClientLoader (asset management)
 * 7. Physics: Physics (PhysX via WASM)
 * 8. Terrain: TerrainSystem (heightmap rendering)
 * 9. Visual Effects: LODs, HealthBars, Particles, Wind
 * 10. Actions: ClientActions (executable actions from UI/keybinds)
 * 11. RPG Systems: All game logic systems (shared with server)
 *
 * Browser Integration:
 * - Exposes `window.world` for debugging and testing
 * - Exposes `window.THREE` for console access to three.js
 * - Exposes `window.Hyperia.CircularSpawnArea` for tests
 *
 * Usage:
 * ```typescript
 * const world = createClientWorld();
 * await world.init({
 *   assetsUrl: 'https://cdn.example.com/assets/',
 *   storage: localStorage
 * });
 * // Client is now running and ready to connect to server
 * ```
 *
 * Used by: Client package (packages/client/src/index.tsx)
 * References: World.ts, registerSystems() in SystemLoader.ts
 */

import { World } from "../core/World";
import { FrameBudgetManager } from "../utils/FrameBudgetManager";

// Core client systems
import { ClientActions } from "../systems/client/ClientActions";
import { ClientAudio } from "../systems/client/ClientAudio";
import { ClientCameraSystem } from "../systems/client/ClientCameraSystem";
import { DevStats } from "../systems/client/DevStats";
// PathfindingDebugSystem migrated to @hyperforge/hyperscape (2026-04-25).
// BFSPathDebugSystem + WalkableTileDebugSystem migrated to
// @hyperforge/hyperscape (2026-04-24).
import { Environment } from "../systems/shared";
import { ClientGraphics } from "../systems/client/ClientGraphics";
import { ClientInput } from "../systems/client/ClientInput";
import { ClientLiveKit } from "../systems/client/ClientLiveKit";
import { ClientLoader } from "../systems/client/ClientLoader";
import { ClientNetwork } from "../systems/client/ClientNetwork";
import { ClientRuntime } from "../systems/client/ClientRuntime";
import { ClientInterface } from "../systems/client/ClientInterface";
// MusicSystem migrated to @hyperforge/hyperscape (2026-04-25)
import { Stage } from "../systems/shared";

import * as THREE from "../extras/three/three";

// Terrain, vegetation, grass, towns, roads, POIs, buildings, and physics
import { TerrainSystem } from "../systems/shared";
// TownSystem migrated to @hyperforge/hyperscape (2026-04-25)
// POISystem migrated to @hyperforge/hyperscape (2026-04-25)
// RoadNetworkSystem migrated to @hyperforge/hyperscape (2026-04-25)
// VegetationSystem migrated to @hyperforge/hyperscape (2026-04-25)
// ProceduralGrassSystem migrated to @hyperforge/hyperscape (2026-04-25)
// ProceduralFlowerSystem migrated to @hyperforge/hyperscape (2026-04-25)
// ProceduralDocks migrated to @hyperforge/hyperscape (2026-04-25)
// BuildingRenderingSystem migrated to @hyperforge/hyperscape (2026-04-25)
// ProceduralTownLandmarksSystem migrated to @hyperforge/hyperscape (2026-04-25)
import { Physics } from "../systems/shared";

// Tree cache pre-warming for faster world loading.
// Phase 3.5 follow-up — getActiveTreePresets returns the
// host-supplied union of `treePresets` from installed content
// packs; falls back to the engine's hardcoded TREE_PRESETS when
// no host has called setActiveTreePresets().
import {
  prewarmCache as prewarmTreeCache,
  getActiveTreePresets,
} from "../systems/shared/world/ProcgenTreeCache";
import {
  initGLBTreeInstancer,
  destroyGLBTreeInstancer,
} from "../systems/shared/world/GLBTreeInstancer";
import {
  initGLBTreeBatchedInstancer,
  destroyGLBTreeBatchedInstancer,
} from "../systems/shared/world/GLBTreeBatchedInstancer";
import { clearProxyGeometryCache } from "../entities/world/visuals/TreeGLBVisualStrategy";
import {
  initPlaceholderInstancer,
  destroyPlaceholderInstancer,
} from "../systems/shared/world/PlaceholderInstancer";
import {
  initGLBResourceInstancer,
  destroyGLBResourceInstancer,
} from "../systems/shared/world/GLBResourceInstancer";

// PhysX loading - used to defer heavy work until WASM is loaded
import { waitForPhysX } from "../physics/PhysXManager";

// RPG systems are registered via SystemLoader to keep them modular
import { registerSystems } from "../systems/shared";
import {
  HYPERIA_DEFAULT_MANIFEST,
  gameModeRegistry,
  registerAlternateGameModes,
  registerHyperiaGameMode,
} from "../gameMode";
import { ParticleSystem } from "../systems/shared/presentation/ParticleSystem";

// Test utilities exposed to browser console
import { CircularSpawnArea } from "../utils/physics/CircularSpawnArea";
import { modelCache } from "../utils/rendering/ModelCache";

import type { StageSystem } from "../types/systems/system-interfaces";
import { LODs } from "../systems/shared";
// HealthBars migrated to @hyperforge/hyperscape (2026-04-24).
// EquipmentVisualSystem migrated to @hyperforge/hyperscape (2026-04-25).
// ZoneVisualsSystem migrated to @hyperforge/hyperscape (2026-04-24).
// WaterfallVisualsSystem migrated to @hyperforge/hyperscape (2026-04-24).
// BridgeSystem migrated to @hyperforge/hyperscape (2026-04-25)
// ResourceTileDebugSystem migrated to @hyperforge/hyperscape (2026-04-24).
// ZoneDetectionSystem migrated to @hyperforge/hyperscape (2026-04-25).
import { InteractionRouter } from "../systems/client/interaction";
import { Particles } from "../systems/shared";
import { Wind } from "../systems/shared";
// ClientTeleportEffectsSystem migrated to @hyperforge/hyperscape (2026-04-25).
import type { SystemConstructor } from "../systems/shared/infrastructure/System";
import { isStreamingLikeViewport } from "./clientViewportMode";

/**
 * Window extension for browser testing and debugging.
 * Exposes world instance and THREE.js for console access.
 */
interface WindowWithWorld extends Window {
  world?: World;
  THREE?: typeof THREE;
  __HYPERIA_EMBEDDED__?: boolean;
  __HYPERIA_CONFIG__?: {
    mode?: string;
  };
}

function isInitTraceEnabled(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return new URLSearchParams(window.location.search).get("traceInit") === "1";
  } catch {
    return false;
  }
}

function shouldPrewarmTreeCacheForCurrentMode(): boolean {
  // Stream and spectator viewers should prioritize first-frame latency over
  // proactive cache warmup to avoid CPU contention during stream join.
  return !isStreamingLikeViewport();
}

function removeSystem(world: World, key: string): void {
  const existingSystem = world.systemsByName.get(key);
  if (!existingSystem) return;

  world.systems = world.systems.filter((system) => system !== existingSystem);
  world.systemsByName.delete(key);
  delete (world as unknown as Record<string, unknown>)[key];
}

function replaceSystem(
  world: World,
  key: string,
  SystemClass: SystemConstructor,
): void {
  removeSystem(world, key);
  world.register(key, SystemClass);
}

/**
 * Creates and configures a client-side World instance.
 *
 * The client world handles rendering, input, audio, and UI while receiving
 * authoritative game state from the server. It runs physics locally for
 * immediate feedback, but the server validates all actions.
 *
 * @returns A fully configured World instance ready for client initialization
 */
export function createClientWorld() {
  const world = new World();
  // ============================================================================
  // FRAME BUDGET MANAGER
  // ============================================================================
  // Initialize frame budget manager for reducing main thread jank.
  // This tracks frame time and allows deferring heavy work when over budget.
  world.frameBudget = FrameBudgetManager.getInstance({
    targetFrameTime: 16.67, // 60 FPS default
    renderReserve: 4, // Reserve 4ms for GPU work
    useIdleCallbacks: true, // Use requestIdleCallback for deferred work
  });

  // ============================================================================
  // CLEAR MODEL CACHE
  // ============================================================================
  // Clear model cache on world creation to prevent stale Hyperia Nodes
  // from being returned instead of pure THREE.Object3D
  modelCache.resetAndVerify();

  // Clean up any previous instancer state from prior world
  destroyGLBTreeInstancer();
  destroyGLBTreeBatchedInstancer();
  clearProxyGeometryCache();
  destroyPlaceholderInstancer();
  destroyGLBResourceInstancer();

  // ============================================================================
  // BROWSER TEST UTILITIES
  // ============================================================================
  // Expose utilities to window immediately (before async RPG systems load)
  // This allows Playwright tests to access constructors synchronously

  if (typeof window !== "undefined") {
    const anyWin = window as unknown as {
      Hyperia?: Record<string, unknown>;
      world?: World;
    };
    anyWin.Hyperia = anyWin.Hyperia || {};
    anyWin.Hyperia.CircularSpawnArea = CircularSpawnArea;
    anyWin.world = world;
  }

  // ============================================================================
  // CORE CLIENT SYSTEMS
  // ============================================================================
  // Order matters! Systems are initialized in registration order.
  // Dependencies must be registered before systems that depend on them.

  // Lifecycle and networking
  world.register("client-runtime", ClientRuntime); // Client lifecycle, diagnostics
  replaceSystem(world, "stage", Stage); // Three.js scene graph root
  world.register("livekit", ClientLiveKit); // Voice chat client
  world.register("network", ClientNetwork); // WebSocket connection to server
  world.register("loader", ClientLoader); // Asset loading and caching

  // Rendering systems
  world.register("graphics", ClientGraphics); // WebGPU renderer
  world.register("environment", Environment); // Lighting, shadows, CSM

  // Dev tools (only active in dev mode)
  world.register("devStats", DevStats); // FPS counter and performance telemetry
  // "pathfindingDebug" registered by @hyperforge/hyperscape onEnable (client branch).
  // bfsPathDebug + walkableDebug registered by @hyperforge/hyperscape
  // plugin onEnable (client-only branch). Migrated 2026-04-24.

  // Audio systems
  world.register("audio", ClientAudio); // 3D spatial audio
  // "music" registered by @hyperforge/hyperscape plugin onEnable
  // (client-only branch). Migrated 2026-04-25.

  // Input and interaction
  world.register("controls", ClientInput); // Keyboard, mouse, touch input
  world.register("actions", ClientActions); // Executable player actions

  // UI and preferences
  world.register("prefs", ClientInterface); // User preferences and UI state

  // Physics (local simulation, validated by server)
  // Streaming/spectator viewports skip physics entirely — they don't need
  // collision detection and PhysX WASM can crash in the Playwright capture
  // browser. RigidBody/Collider nodes already guard against missing PHYSX.
  if (!isStreamingLikeViewport()) {
    replaceSystem(world, "physics", Physics);
  } else {
    // The World constructor registers a default PhysicsSystem whose init()
    // calls waitForPhysX() with a 120s timeout.  If we leave it registered
    // the entire init chain stalls waiting for PhysX WASM that will never
    // arrive.  Remove it so the init pipeline proceeds immediately.
    removeSystem(world, "physics");
  }

  // Interaction system - handles clicks, raycasting, context menus
  // MUST be registered before ClientCameraSystem which uses its RaycastService
  world.register("interaction", InteractionRouter);

  // Camera
  world.register("client-camera-system", ClientCameraSystem); // Camera controller

  // ============================================================================
  // TERRAIN SYSTEM
  // ============================================================================
  // Renders heightmap-based terrain with LOD

  world.register("terrain", TerrainSystem);
  // "bridges" registered by @hyperforge/hyperscape plugin onEnable
  // cross-cutting branch (migrated 2026-04-25).

  // ============================================================================
  // VEGETATION SYSTEM
  // ============================================================================
  // GPU-instanced vegetation (trees, bushes, grass, rocks, flowers)
  // Must be registered after terrain (listens to TERRAIN_TILE_GENERATED)
  // Must be registered BEFORE towns (listens to TERRAIN_TILE_REGENERATED when
  // flat zones modify terrain heights - grass needs to regenerate)

  // "vegetation" registered by @hyperforge/hyperscape plugin
  // onEnable client-only branch (migrated 2026-04-25).

  // ============================================================================
  // TOWN AND ROAD SYSTEMS
  // ============================================================================
  // Procedural town generation with flatness-based placement
  // Road network connects towns using A* pathfinding with terrain costs
  // Roads are rendered via vertex coloring in the terrain shader
  // NOTE: Towns register flat zones which emit TERRAIN_TILE_REGENERATED events
  // that VegetationSystem receives to regenerate grass at correct heights

  // "towns" registered by @hyperforge/hyperscape plugin onEnable
  // cross-cutting branch (migrated 2026-04-25).
  // "pois" registered by @hyperforge/hyperscape plugin onEnable
  // cross-cutting branch (migrated 2026-04-25).
  // RoadNetworkSystem migrated 2026-04-25; was already commented
  // out here.

  // ============================================================================
  // BUILDING RENDERING SYSTEM
  // ============================================================================
  // Procedural building mesh rendering for towns
  // Must be registered after towns system as it depends on town data
  // "building-rendering" registered by @hyperforge/hyperscape
  // plugin onEnable client-only branch (migrated 2026-04-25).

  // ============================================================================
  // TOWN LANDMARKS SYSTEM
  // ============================================================================
  // Procedural town landmarks (fences, lampposts, wells, signposts)
  // Must be registered after towns and roads as it depends on both
  // TEMPORARILY DISABLED
  // ProceduralTownLandmarksSystem migrated 2026-04-25; was already
  // commented out here.

  // ============================================================================
  // VISUAL EFFECTS SYSTEMS
  // ============================================================================
  // These systems enhance visual fidelity and user experience

  world.register("lods", LODs); // Level-of-detail mesh management
  // Nametags disabled - classic MMORPG pattern: names shown in right-click menu only
  // "healthbars" registered by @hyperforge/hyperscape onEnable (client branch).
  // "equipment-visual" registered by @hyperforge/hyperscape onEnable (client branch).
  // "zone-detection" registered by @hyperforge/hyperscape plugin onEnable (cross-cutting).
  // "zone-visuals" registered by @hyperforge/hyperscape onEnable (client branch).
  // "waterfall-visuals" registered by @hyperforge/hyperscape onEnable (client branch).
  // "resource-tile-debug" registered by @hyperforge/hyperscape onEnable (client branch).
  // It self-no-ops at registration; users opt in via world.resourceTileDebug.setEnabled(true).
  world.register("particles", Particles); // Particle effects system
  world.register("particle", ParticleSystem); // GPU-instanced glow/fire particles
  world.register("wind", Wind); // Environmental wind effects
  // "teleport-effects" registered by @hyperforge/hyperscape onEnable (client branch).

  // ============================================================================
  // GRASS SYSTEM
  // ============================================================================
  // GPU Procedural grass with heightmap sampling
  // TEMPORARILY DISABLED - performance optimization
  // ProceduralGrassSystem migrated 2026-04-25; was already
  // commented out here.

  // ============================================================================
  // FLOWER SYSTEM
  // GPU Procedural flowers using SpriteNodeMaterial
  // ProceduralFlowerSystem migrated to @hyperforge/hyperscape
  // (2026-04-25). Was already disabled here. Load the plugin to
  // re-enable flowers.

  // ============================================================================
  // DOCK SYSTEM
  // ============================================================================
  // "docks" registered by @hyperforge/hyperscape plugin onEnable
  // cross-cutting branch (migrated 2026-04-25).

  // ============================================================================
  // THREE.JS SETUP
  // ============================================================================
  // Expose THREE.js to the stage system after a short delay
  // This ensures stage.scene is ready before we try to access it

  const setupStageWithTHREE = () => {
    const stageSystem = world.stage as unknown as StageSystem;
    if (stageSystem && stageSystem.scene) {
      stageSystem.THREE = THREE as unknown as StageSystem["THREE"];
      initGLBTreeInstancer(stageSystem.scene as unknown as THREE.Scene, world);
      initGLBTreeBatchedInstancer(
        stageSystem.scene as unknown as THREE.Scene,
        world,
      );
      initPlaceholderInstancer(stageSystem.scene as unknown as THREE.Scene);
      initGLBResourceInstancer(
        stageSystem.scene as unknown as THREE.Scene,
        world,
      );
    }
  };

  setTimeout(setupStageWithTHREE, 200);

  // ============================================================================
  // RPG GAME SYSTEMS (ASYNC)
  // ============================================================================
  // RPG systems are loaded asynchronously to avoid blocking world creation.
  // CRITICAL: Create a promise that tracks when registerSystems() completes
  // This ensures DataManager is initialized before world.init() is called

  let systemsLoadedResolve!: () => void;
  const systemsLoadedPromise = new Promise<void>((resolve) => {
    systemsLoadedResolve = resolve;
  });

  // Attach promise to world so GameClient can wait for it
  world.systemsLoadedPromise = systemsLoadedPromise;

  (async () => {
    try {
      const traceInit = isInitTraceEnabled();

      if (traceInit) {
        console.log("[createClientWorld] -> registerSystems");
      }
      await registerSystems(world);
      if (traceInit) {
        console.log("[createClientWorld] <- registerSystems");
      }

      if (shouldPrewarmTreeCacheForCurrentMode()) {
        // Pre-warm procgen tree cache AFTER PhysX is loaded (prevents WASM timeout)
        // Tree generation is CPU-intensive and can block WASM instantiation if run in parallel.
        // By waiting for PhysX first, we ensure critical physics initialization completes
        // before starting the heavy tree pre-warming work.
        // This runs async and doesn't block other init - trees will be ready when needed.
        (async () => {
          try {
            // Wait for PhysX to be loaded first (with generous timeout for retries)
            await waitForPhysX("TreePrewarm", 120000);
            console.log(
              "[createClientWorld] PhysX loaded, starting tree cache pre-warm...",
            );

            // Now safe to run heavy tree generation. Read through
            // the active preset registry so non-Hyperia projects
            // don't pay the cache-allocation cost for Hyperia-only
            // presets and vice versa.
            await prewarmTreeCache([...getActiveTreePresets()]);
          } catch (err) {
            console.warn(
              "[createClientWorld] Tree cache pre-warm failed:",
              err,
            );
          }
        })();
      } else {
        console.log(
          "[createClientWorld] Skipping tree cache pre-warm and PhysX for stream/spectator viewport",
        );
        // CRITICAL: We still need to load PhysX even if we skip tree pre-warming!
        // In stream mode, there is no local player, so PlayerLocal won't trigger the load either.
        // We trigger it here in the background so colliders and static actors can initialize.
        waitForPhysX("StreamInitialization", 120000).catch((err) => {
          console.warn(
            "[createClientWorld] Background PhysX load failed:",
            err,
          );
        });
      }

      // Mob impostor pre-warming disabled — VRM mobs use on-demand baking.

      // CRITICAL: Initialize newly registered systems
      const worldOptions = {
        storage: world.storage,
        assetsUrl: world.assetsUrl,
        assetsDir: world.assetsDir,
      };

      const equipmentSystem = world.getSystem("equipment");
      if (equipmentSystem && !equipmentSystem.isInitialized()) {
        if (traceInit) {
          console.log("[createClientWorld] -> init equipment");
        }
        await equipmentSystem.init(worldOptions);
        if (traceInit) {
          console.log("[createClientWorld] <- init equipment");
        }
      }

      const damageSplatSystem = world.getSystem("damage-splat");
      if (damageSplatSystem && !damageSplatSystem.isInitialized()) {
        if (traceInit) {
          console.log("[createClientWorld] -> init damage-splat");
        }
        await damageSplatSystem.init(worldOptions);
        if (traceInit) {
          console.log("[createClientWorld] <- init damage-splat");
        }
      }

      const duelCountdownSplat = world.getSystem("duel-countdown-splat");
      if (duelCountdownSplat && !duelCountdownSplat.isInitialized()) {
        if (traceInit) {
          console.log("[createClientWorld] -> init duel-countdown-splat");
        }
        await duelCountdownSplat.init(worldOptions);
        if (traceInit) {
          console.log("[createClientWorld] <- init duel-countdown-splat");
        }
      }

      const projectileRenderer = world.getSystem("projectile-renderer");
      if (projectileRenderer && !projectileRenderer.isInitialized()) {
        if (traceInit) {
          console.log("[createClientWorld] -> init projectile-renderer");
        }
        await projectileRenderer.init(worldOptions);
        if (traceInit) {
          console.log("[createClientWorld] <- init projectile-renderer");
        }
      }

      // Re-expose utilities after RPG systems load (in case they were cleared)
      const anyWin = window as unknown as {
        Hyperia?: Record<string, unknown>;
      };
      anyWin.Hyperia = anyWin.Hyperia || {};
      anyWin.Hyperia.CircularSpawnArea = CircularSpawnArea;

      // Update window.world and window.THREE references
      if (typeof window !== "undefined") {
        const windowWithWorld = window as WindowWithWorld;
        windowWithWorld.world = world;

        const stageSystem = world.stage as unknown as StageSystem;
        windowWithWorld.THREE =
          stageSystem.THREE as unknown as typeof windowWithWorld.THREE;
      }
    } catch (error) {
      console.error("[createClientWorld] Error loading RPG systems:", error);
      throw error;
    } finally {
      // Always resolve the promise, even if there was an error
      systemsLoadedResolve();
    }
  })();

  // GameMode stash (Phase 3.1). Read-only metadata — nothing in Hyperia
  // gameplay consults this; PlayerLocal, InteractionRouter, and
  // ClientCameraSystem remain the authoritative path. PIE reads it to
  // decide which controllers to instantiate in the editor viewport.
  // `register` overwrites on duplicate, so multiple createClientWorld
  // calls in one process (tests, HMR) are safe.
  registerHyperiaGameMode(gameModeRegistry);
  registerAlternateGameModes(gameModeRegistry);
  world.gameMode = gameModeRegistry.resolve(HYPERIA_DEFAULT_MANIFEST, {
    world,
    runtime: "client",
  });

  return world;
}
