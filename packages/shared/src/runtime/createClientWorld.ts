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
 * - Uses WebGL/WebGPU for graphics via three.js
 * - PhysX physics runs locally for immediate feedback (validated by server)
 *
 * Systems Registered:
 * 1. Core Systems: ClientRuntime, Stage, ClientNetwork
 * 2. Media: ClientLiveKit (voice), ClientAudio, MusicSystem
 * 3. Rendering: ClientGraphics, Environment, ClientCameraSystem
 * 4. Input: ClientInput (keyboard, mouse, touch, XR)
 * 5. UI: ClientInterface (preferences, UI state)
 * 6. Loading: ClientLoader (asset management)
 * 7. Physics: Physics (PhysX via WASM)
 * 8. Terrain: TerrainSystem (heightmap rendering)
 * 9. Visual Effects: LODs, Nametags, Particles, Wind
 * 10. VR/AR: XR system
 * 11. Actions: ClientActions (executable actions from UI/keybinds)
 * 12. RPG Systems: All game logic systems (shared with server)
 *
 * Browser Integration:
 * - Exposes `window.world` for debugging and testing
 * - Exposes `window.THREE` for console access to three.js
 * - Exposes `window.Hyperscape.CircularSpawnArea` for tests
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

// Core client systems
import { ClientActions } from "../systems/client/ClientActions";
import { ClientAudio } from "../systems/client/ClientAudio";
import { ClientCameraSystem } from "../systems/client/ClientCameraSystem";
import { Environment } from "../systems/shared";
import { ClientGraphics } from "../systems/client/ClientGraphics";
import { ClientInput } from "../systems/client/ClientInput";
import { ClientLiveKit } from "../systems/client/ClientLiveKit";
import { ClientLoader } from "../systems/client/ClientLoader";
import { ClientNetwork } from "../systems/client/ClientNetwork";
import { ClientRuntime } from "../systems/client/ClientRuntime";
import { ClientInterface } from "../systems/client/ClientInterface";
import { MusicSystem } from "../systems/shared";
import { Stage } from "../systems/shared";

import THREE from "../extras/three/three";

// Terrain and physics
import { TerrainSystem } from "../systems/shared";
import { Physics } from "../systems/shared";

// RPG systems are registered via SystemLoader to keep them modular
import { registerSystems } from "../systems/shared";

// Test utilities exposed to browser console
import { CircularSpawnArea } from "../utils/physics/CircularSpawnArea";
import { modelCache } from "../utils/rendering/ModelCache";

import type { StageSystem } from "../types/systems/system-interfaces";
import { LODs } from "../systems/shared";
import { Nametags } from "../systems/client/Nametags";
import { Particles } from "../systems/shared";
import { Wind } from "../systems/shared";
import { XR } from "../systems/client/XR";

/**
 * Window extension for browser testing and debugging.
 * Exposes world instance and THREE.js for console access.
 */
interface WindowWithWorld extends Window {
  world?: World;
  THREE?: typeof THREE;
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
  // CLEAR MODEL CACHE
  // ============================================================================
  // Clear model cache on world creation to prevent stale Hyperscape Nodes
  // from being returned instead of pure THREE.Object3D
  modelCache.resetAndVerify();

  // ============================================================================
  // BROWSER TEST UTILITIES
  // ============================================================================
  // Expose utilities to window immediately (before async RPG systems load)
  // This allows Playwright tests to access constructors synchronously

  if (typeof window !== "undefined") {
    const anyWin = window as unknown as {
      Hyperscape?: Record<string, unknown>;
      world?: World;
    };
    anyWin.Hyperscape = anyWin.Hyperscape || {};
    anyWin.Hyperscape.CircularSpawnArea = CircularSpawnArea;
    anyWin.world = world;
  }

  // ============================================================================
  // CORE CLIENT SYSTEMS
  // ============================================================================
  // Order matters! Systems are initialized in registration order.
  // Dependencies must be registered before systems that depend on them.

  // Lifecycle and networking
  world.register("client-runtime", ClientRuntime); // Client lifecycle, diagnostics
  world.register("stage", Stage); // Three.js scene graph root
  world.register("livekit", ClientLiveKit); // Voice chat client
  world.register("network", ClientNetwork); // WebSocket connection to server
  world.register("loader", ClientLoader); // Asset loading and caching

  // Rendering systems
  world.register("graphics", ClientGraphics); // WebGL/WebGPU renderer
  world.register("environment", Environment); // Lighting, shadows, CSM

  // Audio systems
  world.register("audio", ClientAudio); // 3D spatial audio
  world.register("music", MusicSystem); // Background music player

  // Input and interaction
  world.register("controls", ClientInput); // Keyboard, mouse, touch, XR input
  world.register("actions", ClientActions); // Executable player actions

  // UI and preferences
  world.register("prefs", ClientInterface); // User preferences and UI state

  // Physics (local simulation, validated by server)
  world.register("physics", Physics); // PhysX collision and raycasting

  // Camera
  world.register("client-camera-system", ClientCameraSystem); // Camera controller

  // ============================================================================
  // TERRAIN SYSTEM
  // ============================================================================
  // Renders heightmap-based terrain with LOD

  world.register("terrain", TerrainSystem);

  // ============================================================================
  // VISUAL EFFECTS SYSTEMS
  // ============================================================================
  // These systems enhance visual fidelity and user experience

  world.register("lods", LODs); // Level-of-detail mesh management
  world.register("nametags", Nametags); // Player/NPC name labels
  world.register("particles", Particles); // Particle effects system
  world.register("wind", Wind); // Environmental wind effects
  world.register("xr", XR); // VR/AR support

  // ============================================================================
  // THREE.JS SETUP
  // ============================================================================
  // Expose THREE.js to the stage system after a short delay
  // This ensures stage.scene is ready before we try to access it

  const setupStageWithTHREE = () => {
    const stageSystem = world.stage as StageSystem;
    if (stageSystem && stageSystem.scene) {
      stageSystem.THREE = THREE;
    }
  };

  setTimeout(setupStageWithTHREE, 200);

  // ============================================================================
  // RPG GAME SYSTEMS (ASYNC)
  // ============================================================================
  // RPG systems are loaded asynchronously to avoid blocking world creation.

  (async () => {
    await registerSystems(world);

    // Re-expose utilities after RPG systems load (in case they were cleared)
    const anyWin = window as unknown as {
      Hyperscape?: Record<string, unknown>;
    };
    anyWin.Hyperscape = anyWin.Hyperscape || {};
    anyWin.Hyperscape.CircularSpawnArea = CircularSpawnArea;

    // Update window.world and window.THREE references
    if (typeof window !== "undefined") {
      const windowWithWorld = window as WindowWithWorld;
      windowWithWorld.world = world;

      const stageSystem = world.stage as StageSystem;
      windowWithWorld.THREE = stageSystem.THREE;
    }
  })();

  return world;
}
