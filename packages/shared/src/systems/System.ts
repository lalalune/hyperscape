/**
 * System - Base Class for Game Systems
 *
 * All game systems extend this base class to integrate with Hyperscape's ECS architecture.
 * Systems encapsulate specific game functionality (physics, rendering, combat, inventory, etc.)
 * and communicate via events.
 *
 * **Architecture**:
 *
 * **Lifecycle**:
 * 1. **Constructor**: System is instantiated with world reference
 * 2. **init()**: Async initialization (load resources, setup state)
 * 3. **start()**: Start running (all systems initialized at this point)
 * 4. **Update Loop**: Multiple update methods called each frame
 * 5. **destroy()**: Cleanup when system is removed
 *
 * **Dependency System**:
 * Systems can declare dependencies via `getDependencies()`:
 * - **Required**: Must be initialized before this system
 * - **Optional**: Nice to have, but not essential
 *
 * World uses topological sorting to initialize systems in dependency order.
 *
 * **Update Cycle** (called each frame in order):
 * 1. `preTick()` - Pre-frame setup
 * 2. `preFixedUpdate(willStep)` - Before fixed physics step
 * 3. `fixedUpdate(delta)` - Fixed 30 FPS physics/logic update
 * 4. `postFixedUpdate(delta)` - After fixed physics step
 * 5. `preUpdate(alpha)` - Before main update
 * 6. `update(delta)` - Variable framerate update (visual, interpolation)
 * 7. `postUpdate(delta)` - After main update
 * 8. `lateUpdate(delta)` - Camera and final adjustments
 * 9. `postLateUpdate(delta)` - After late update
 * 10. `commit()` - Render frame (graphics systems)
 * 11. `postTick()` - Post-frame cleanup
 *
 * **Event Communication**:
 * Systems extend EventEmitter for local events and use World's EventBus
 * for cross-system communication.
 *
 * **Common Patterns**:
 *
 * **Physics/Logic Systems** (fixedUpdate):
 * ```typescript
 * class PhysicsSystem extends System {
 *   fixedUpdate(delta: number) {
 *     // Deterministic physics at 30 FPS
 *   }
 * }
 * ```
 *
 * **Rendering Systems** (update + commit):
 * ```typescript
 * class GraphicsSystem extends System {
 *   update(delta: number) {
 *     // Update visual state
 *   }
 *   commit() {
 *     // Render frame
 *   }
 * }
 * ```
 *
 * **Camera Systems** (lateUpdate):
 * ```typescript
 * class CameraSystem extends System {
 *   lateUpdate(delta: number) {
 *     // Update camera after all entity movements
 *   }
 * }
 * ```
 *
 * **Examples**:
 * - Physics: Collision detection, character controllers
 * - Graphics: WebGL rendering, post-processing
 * - Entities: Entity lifecycle management
 * - Combat: Damage calculation, attack resolution
 * - Network: Client/server synchronization
 *
 * **Runs on**: Client, Server, or Both (depends on system)
 * **Referenced by**: World.ts (system registration), all system implementations
 *
 * @public
 */

import EventEmitter from "eventemitter3";

import type { WorldOptions } from "../types/index";

import { World } from "../World";

/**
 * System constructor signature
 * All systems must have a constructor that accepts a World instance
 *
 * @public
 */
export interface SystemConstructor {
  new (world: World): System;
}

/**
 * System dependency configuration
 * Defines which systems must be initialized before this system can start
 *
 * @public
 */
export interface SystemDependencies {
  /** Systems that MUST be initialized before this one (initialization will fail if missing) */
  required?: string[];

  /** Systems that SHOULD be initialized if available (initialization continues if missing) */
  optional?: string[];
}

/**
 * System - Base class for all game systems
 *
 * Systems manage specific aspects of the game world (physics, rendering, entities, etc.).
 * Extend this class to create custom systems for your game.
 *
 * @public
 */
export abstract class System extends EventEmitter {
  world: World;
  protected initialized: boolean = false;
  protected started: boolean = false;

  constructor(world: World) {
    super();
    this.world = world;
  }

  /**
   * Declares system dependencies
   *
   * Override this to specify which systems must be initialized before this one.
   * The World will use this to topologically sort systems and initialize them
   * in the correct order.
   *
   * @returns Object with required and optional dependency arrays
   *
   * @example
   * ```typescript
   * getDependencies() {
   *   return {
   *     required: ['physics', 'entities'], // Must exist
   *     optional: ['audio'] // Nice to have
   *   };
   * }
   * ```
   *
   * @public
   */
  getDependencies(): SystemDependencies {
    return {};
  }

  /**
   * Initializes the system with world options
   *
   * Called once when the world is initialized. All required dependencies
   * are guaranteed to be initialized before this is called.
   *
   * Use this for:
   * - Loading resources
   * - Setting up state
   * - Connecting to external services
   * - Creating managed objects
   *
   * @param _options - World initialization options (assetsUrl, storage, etc.)
   *
   * @public
   */
  async init(_options: WorldOptions): Promise<void> {
    // Override in subclasses if needed
    this.initialized = true;
  }

  /**
   * Starts the system
   *
   * Called after ALL systems have been initialized. This is when the system
   * should start running (begin update loops, start timers, etc.).
   *
   * @public
   */
  start(): void {
    // Override in subclasses if needed
    this.started = true;
  }

  /**
   * Checks if system has been initialized
   *
   * @returns true if init() has been called
   *
   * @public
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Checks if system has been started
   *
   * @returns true if start() has been called
   *
   * @public
   */
  isStarted(): boolean {
    return this.started;
  }

  /**
   * Destroys the system and cleans up resources
   *
   * Called when the world is destroyed or the system is removed.
   * Override this to cleanup resources (close connections, clear timers, etc.).
   *
   * @public
   */
  destroy(): void {
    // Override in subclasses if needed
    this.started = false;
    this.initialized = false;
  }

  // Update cycle methods - override as needed in subclasses

  /**
   * Called at the beginning of each frame
   */
  preTick(): void {
    // Override in subclasses if needed
  }

  /**
   * Called before fixed update steps
   */
  preFixedUpdate(_willFixedStep: boolean): void {
    // Override in subclasses if needed
  }

  /**
   * Fixed timestep update for physics and deterministic logic
   */
  fixedUpdate(_delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Called after fixed update steps
   */
  postFixedUpdate(_delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Called before main update with interpolation alpha
   */
  preUpdate(_alpha: number): void {
    // Override in subclasses if needed
  }

  /**
   * Main update loop
   */
  update(_delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Called after main update
   */
  postUpdate(_delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Late update for camera and final adjustments
   */
  lateUpdate(_delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Called after late update
   */
  postLateUpdate(_delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Commit changes (e.g., render on client)
   */
  commit(): void {
    // Override in subclasses if needed
  }

  /**
   * Called at the end of each frame
   */
  postTick(): void {
    // Override in subclasses if needed
  }
}
