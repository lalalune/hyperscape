/**
 * World.ts - Core Game World Container
 * 
 * The World class is the central container for all game systems, entities, and state.
 * It manages the game loop, system lifecycle, and provides a unified API for game features.
 * 
 * Architecture:
 * - Uses Entity Component System (ECS) pattern
 * - Fixed-timestep physics loop (30 FPS) with interpolation
 * - Event-driven inter-system communication via EventBus
 * - Dependency-based system initialization
 * 
 * Lifecycle:
 * 1. Constructor: Creates world, registers core systems
 * 2. init(): Initializes systems in dependency order
 * 3. start(): Starts all systems
 * 4. tick(): Main game loop (called every frame)
 * 5. destroy(): Cleanup when world is destroyed
 * 
 * Used by: createClientWorld(), createServerWorld(), createViewerWorld()
 */

import EventEmitter from 'eventemitter3';
import THREE from './extras/three';
import type { Position3D } from './types/base-types';
import type {
  HyperscapeObject3D
} from './types/three-extensions';
import { ClientLiveKit } from './systems/ClientLiveKit';
import { EventType } from './types/events';



import { Anchors, Anchors as AnchorsSystem } from './systems/Anchors';
import { Chat, Chat as ChatSystem } from './systems/Chat';
import { ClientActions } from './systems/ClientActions';
import { Entities, Entities as EntitiesSystem } from './systems/Entities';
import { EventBus, type EventSubscription } from './systems/EventBus';
import { Events, Events as EventsSystem } from './systems/Events';
import { LODs } from './systems/LODs';
import { Particles } from './systems/Particles';
import { Physics, Physics as PhysicsSystem } from './systems/Physics';
import { Settings, Settings as SettingsSystem } from './systems/Settings';
import { Stage, Stage as StageSystem } from './systems/Stage';
import { System, SystemConstructor } from './systems/System';
import { XR } from './systems/XR';
import { Environment } from './systems/Environment';
import {
  ClientAudio,
  ClientInput,
  ClientGraphics,
  ClientLoader,
  ClientInterface,
  HotReloadable,
  Player,
  RaycastHit,
  WorldOptions,
} from './types';
import type {
  ClientMonitor,
  ServerDB,
} from './types';
import type { ServerRuntime } from './systems/ServerRuntime';

/**
 * NetworkSystem Interface
 * 
 * Common interface for both ClientNetwork and ServerNetwork systems.
 * Allows World to reference network functionality without knowing which implementation is active.
 * 
 * The actual network system (client or server) is registered by create*World() functions.
 */
interface NetworkSystem extends System {
  id?: string;
  isServer?: boolean;
  isClient?: boolean;
  send: (type: string, data: unknown) => void;
  upload?: (file: File) => Promise<unknown>;
  onConnection?: (socket: unknown, query: unknown) => void;
  disconnect?: () => Promise<void>;
}

/**
 * World - Central Game World Container
 * 
 * The core class that manages all game systems, entities, and state.
 * Provides a unified API for accessing game functionality and coordinates
 * the game loop across all systems.
 * 
 * **Key Responsibilities**:
 * - System registration and lifecycle management
 * - Fixed-timestep game loop with physics simulation
 * - Event routing via EventBus for type-safe inter-system communication
 * - Asset URL resolution for both local and CDN assets
 * - Three.js scene graph root (rig and camera)
 * 
 * The World is environment-agnostic and can run on client, server, or headless (testing).
 * 
 * @public
 */
export class World extends EventEmitter {

  // ============================================================================
  // TIME MANAGEMENT
  // ============================================================================
  
  /**
   * Maximum allowed delta time to prevent spiral of death.
   * Caps frame time at 33ms to prevent physics instability.
   */
  maxDeltaTime = 1 / 30;
  
  /**
   * Fixed timestep for physics simulation.
   * Physics runs at exactly 30 FPS for deterministic, stable simulation.
   */
  fixedDeltaTime = 1 / 30;
  
  /** Current frame number (incremented each tick) */
  frame = 0;
  
  /** Current game time in seconds */
  time = 0;
  
  /** Accumulated time for fixed-step physics updates */
  accumulator = 0;
  
  // ============================================================================
  // CORE PROPERTIES
  // ============================================================================
  
  /** Unique identifier for this world instance */
  id: string;
  
  /** Array of all registered systems (initialized in dependency order) */
  systems: System[] = [];
  
  /** Map of system names to system instances for fast lookup */
  systemsByName = new Map<string, System>();
  
  /** Network update rate in seconds (8Hz = 8 updates per second) */
  networkRate = 1 / 8;
  
  /** Base URL for loading assets from CDN (e.g., 'https://cdn.example.com/assets/') */
  assetsUrl!: string;
  
  /** Local directory path for assets (server-side file loading) */
  assetsDir!: string;
  
  /** Set of entities/objects that need update() called every frame */
  hot = new Set<HotReloadable>();
  
  /** Prevents duplicate initialization */
  private _initialized = false;
  
  /** Movement state flag (used by builder/movement systems) */
  moving?: boolean;
  
  // ============================================================================
  // THREE.JS SCENE GRAPH
  // ============================================================================
  
  /** Root object for camera and rendering (parent of camera) */
  rig: HyperscapeObject3D;
  
  /** Main perspective camera for rendering the 3D scene */
  camera: THREE.PerspectiveCamera;
  
  // ============================================================================
  // CORE SYSTEMS (Always present in client and server)
  // ============================================================================
  
  /** Game configuration and metadata (title, description, player limits, etc.) */
  settings!: Settings & {
    public?: boolean;
    playerLimit?: number;
    avatar?: { url: string };
    title?: string;
    desc?: string;
    image?: { url: string };
    model?: { url: string };
    serialize?: () => unknown;
    deserialize?: (data: unknown) => void;
    on?: (event: string, callback: () => void) => void;
  };
  
  /** Manages spatial anchors for XR and positioned objects */
  anchors!: Anchors;
  
  /** Legacy event system (being replaced by EventBus) */
  events!: Events;
  
  /** Chat message system for player communication */
  chat!: Chat & {
    add?: (message: unknown, sync?: boolean) => void;
    clear?: (sync: boolean) => void;
    serialize?: () => unknown;
    messages?: Array<{ id?: string; from: string; body: string; text?: string; timestamp?: number }>;
  };
  
  /** Entity Component System - manages all game entities (players, mobs, items, etc.) */
  entities!: Entities & {
    add?: (data: unknown, local?: boolean) => unknown;
    serialize?: () => unknown;
    getPlayer: (playerId: string) => Player;
    getLocalPlayer: () => Player;
    getPlayers: () => Player[];
    player: Player;
  };
  
  /** PhysX-based physics simulation (collisions, raycasts, character controllers) */
  physics!: Physics;
  
  /** Three.js scene management and rendering pipeline */
  stage!: Stage & {
    scene?: {
      add?: (obj: unknown) => void;
      remove?: (obj: unknown) => void;
    };
    THREE?: typeof THREE;
  };
  
  /** Particle effects system (GPU-accelerated particles) */
  particles?: Particles;
  
  /** Level-of-Detail system for optimizing distant objects */
  lods?: LODs;
  
  // ============================================================================
  // CLIENT-ONLY SYSTEMS (Only present in browser environments)
  // ============================================================================
  
  /** UI system for managing DOM-based user interface */
  ui?: ClientInterface & {
    active?: boolean;
    appendChild?: (element: HTMLElement) => void;
    removeChild?: (element: HTMLElement) => void;
    getBoundingClientRect?: () => DOMRect;
    applyTheme?: (theme: unknown) => void;
  };
  
  /** Asset loader for models, textures, audio, and other resources */
  loader?: ClientLoader;
  
  /** Network system - ClientNetwork on client, ServerNetwork on server */
  network!: NetworkSystem;
  
  /** Environment system (lighting, skybox, fog, shadows) */
  environment?: Environment;
  
  /** Graphics rendering system (WebGL/WebGPU renderer, post-processing) */
  graphics?: ClientGraphics & {
    renderer?: {
      domElement: HTMLCanvasElement;
      render?: (scene: unknown, camera: unknown) => void;
      setSize?: (width: number, height: number) => void;
    };
  };
  
  /** Input handling system (keyboard, mouse, touch, gamepad) */
  controls?: ClientInput;
  
  /** User preferences and settings UI */
  prefs?: ClientInterface;
  
  /** Audio system for spatial and ambient sound */
  audio?: ClientAudio;
  
  /** Music system for background music playback */
  music?: import('./systems/MusicSystem').MusicSystem;
  
  /** Performance monitoring (CPU, memory, FPS) */
  monitor?: ClientMonitor & {
    getStats?: () => Promise<{ currentCPU: number; currentMemory: number; maxMemory: number }>;
  };
  
  /** LiveKit integration for voice chat */
  livekit?: ClientLiveKit & {
    getPlayerOpts?: (id: string) => Promise<unknown>;
    on?: (event: string, callback: (data: unknown) => void) => void;
    setScreenShareTarget?: (targetId: string) => void;
  };
  
  /** Statistics display system */
  stats?: ClientInterface;
  
  // ============================================================================
  // SERVER-ONLY SYSTEMS (Only present in Node.js environments)
  // ============================================================================
  
  /** Database system for persistence (SQLite or PostgreSQL) */
  db?: ServerDB;
  
  /** Server runtime lifecycle and monitoring */
  server?: ServerRuntime;
  
  /** Storage abstraction for file-based data */
  storage?: unknown;
  
  /** PostgreSQL connection pool (when using PostgreSQL backend) */
  pgPool?: unknown;
  
  /** Drizzle ORM database instance (when using Drizzle for queries) */
  drizzleDb?: unknown;
  
  // ============================================================================
  // DYNAMIC SYSTEMS (Added by specific game modes or features)
  // ============================================================================
  
  /** Builder tool system for world editing (client-only) */
  builder?: {
    enabled: boolean;
    mode?: string;
    tool?: string;
  };
  
  /** Player actions system for context-sensitive interactions */
  actions?: ClientActions & {
    btnDown?: boolean;
    execute?: (actionName: string, params?: Record<string, unknown>) => Promise<unknown>;
    getAvailable?: () => string[];
  };
  
  /** XR (VR/AR) system for immersive experiences */
  xr?: XR;
  
  /** Terrain generation and heightmap system */
  terrain?: {
    getHeightAt: (x: number, z: number) => number;
    generate: (params: Record<string, unknown>) => void;
  };

  // ============================================================================
  // EVENT SYSTEM
  // ============================================================================
  
  /** Type-safe event bus for inter-system communication (preferred over EventEmitter) */
  $eventBus: EventBus;
  
  /** Maps event names to their EventBus subscriptions for cleanup */
  __busListenerMap: Map<string, Map<(...args: unknown[]) => void, EventSubscription>> = new Map();
  
  // ============================================================================
  // LEGACY/COMPATIBILITY PROPERTIES
  // ============================================================================
  
  /** Move app state (legacy, may be removed) */
  moveApp?: {
    enabled?: boolean;
  };
  
  /** Direct entity property access (legacy, prefer using entities system) */
  entity?: {
    id?: string;
    position?: { x: number; y: number; z: number };
    [key: string]: unknown;
  };
  
  // ============================================================================
  // RPG GAME API (Added by SystemLoader when RPG systems are registered)
  // ============================================================================
  
  /** Action registry for context-based player actions */
  actionRegistry?: {
    getAll(): Array<{ name: string; [key: string]: unknown }>;
    getAvailable(context: Record<string, unknown>): Array<{ name: string; [key: string]: unknown }>;
    execute(name: string, context: Record<string, unknown>, params: Record<string, unknown>): Promise<unknown>;
  };
  
  /** Reference to all registered RPG systems (PlayerSystem, CombatSystem, etc.) */
  rpgSystems?: Record<string, { name: string; [key: string]: unknown }>;
  
  /** All available RPG actions that can be executed */
  rpgActions?: Record<string, { name: string; execute: (params: Record<string, unknown>) => Promise<unknown>; [key: string]: unknown }>;
  
  /** Flattened action methods for direct world.actionName() calls */
  actionMethods?: Record<string, (...args: unknown[]) => unknown>;
  
  // ----------------------------------------------------------------------------
  // Player Management API (added by PlayerSystem)
  // ----------------------------------------------------------------------------
  
  /** Get RPG player data by ID */
  getRPGPlayer?(playerId: string): { id: string; [key: string]: unknown } | undefined;
  
  /** Save player data to database */
  savePlayer?(playerId: string, data: Record<string, unknown>): unknown;
  
  /** Get all active players in the world */
  getAllPlayers?(): unknown[];
  
  /** Heal a player by specified amount */
  healPlayer?(playerId: string, amount: number): unknown;
  
  /** Damage a player by specified amount */
  damagePlayer?(playerId: string, amount: number): unknown;
  
  /** Check if player is alive */
  isPlayerAlive?(playerId: string): boolean;
  
  /** Get player's current and max health */
  getPlayerHealth?(playerId: string): { current: number; max: number };
  
  /** Teleport player to a position */
  teleportPlayer?(playerId: string, position: Position3D): unknown;
  
  // ----------------------------------------------------------------------------
  // Combat API (added by CombatSystem)
  // ----------------------------------------------------------------------------
  
  /** Initiate combat between attacker and target */
  startCombat?(attackerId: string, targetId: string): unknown;
  
  /** End combat for an entity */
  stopCombat?(attackerId: string): unknown;
  
  /** Check if attacker can attack target (range, cooldown, state) */
  canAttack?(attackerId: string, targetId: string): boolean;
  
  /** Check if entity is currently in combat */
  isInCombat?(entityId: string): boolean;
  
  // ----------------------------------------------------------------------------
  // Skills API (added by SkillsSystem)
  // ----------------------------------------------------------------------------
  
  /** Get all skill levels and XP for a player */
  getSkills?(playerId: string): Record<string, { level: number; xp: number }>;
  
  /** Get level for a specific skill */
  getSkillLevel?(playerId: string, skill: string): number;
  
  /** Get XP for a specific skill */
  getSkillXP?(playerId: string, skill: string): number;
  
  /** Get calculated combat level based on combat skills */
  getCombatLevel?(playerId: string): number;
  
  /** Get XP needed to reach next level in a skill */
  getXPToNextLevel?(playerId: string, skill: string): number;
  
  // ----------------------------------------------------------------------------
  // Inventory API (added by InventorySystem)
  // ----------------------------------------------------------------------------
  
  /** Get player's inventory contents */
  getInventory?(playerId: string): Array<{ itemId: string; quantity: number; [key: string]: unknown }>;
  
  /** Get player's equipped items */
  getEquipment?(playerId: string): Record<string, { itemId: string; [key: string]: unknown }>;
  
  /** Check if player has item in inventory */
  hasItem?(playerId: string, itemId: string | number, quantity?: number): boolean;
  
  /** Get count of arrows equipped/in inventory (for ranged combat) */
  getArrowCount?(playerId: string): number;
  
  /** Check if item can be added to player's inventory */
  canAddItem?(playerId: string, item: unknown): boolean;
  
  // ----------------------------------------------------------------------------
  // Movement API (added by movement-related systems)
  // ----------------------------------------------------------------------------
  
  /** Check if player is currently moving */
  isPlayerMoving?(playerId: string): boolean;
  
  /** Get player's stamina (used for running) */
  getPlayerStamina?(playerId: string): { current: number; max: number; regenerating: boolean };
  
  /** Command player to move to target position */
  movePlayer?(playerId: string, targetPosition: Position3D): unknown;
  
  // ----------------------------------------------------------------------------
  // Mob API (added by MobSystem)
  // ----------------------------------------------------------------------------
  
  /** Get mob entity by ID */
  getMob?(mobId: string): unknown;
  
  /** Get all active mobs in the world */
  getAllMobs?(): unknown[];
  
  /** Get mobs within radius of a point */
  getMobsInArea?(center: Position3D, radius: number): unknown[];
  
  /** Spawn a mob at position */
  spawnMob?(type: string, position: Position3D): unknown;
  
  // ----------------------------------------------------------------------------
  // Equipment API (added by EquipmentSystem)
  // ----------------------------------------------------------------------------
  
  /** Get player's current equipment */
  getPlayerEquipment?(playerId: string): unknown;
  
  /** Get raw equipment data */
  getEquipmentData?(playerId: string): unknown;
  
  /** Get calculated equipment bonuses */
  getEquipmentStats?(playerId: string): unknown;
  
  /** Check if specific item is equipped */
  isItemEquipped?(playerId: string, itemId: number): boolean;
  
  /** Check if player can equip item (level requirements, etc.) */
  canEquipItem?(playerId: string, itemId: number): boolean;
  
  /** Consume one arrow (for ranged attacks) */
  consumeArrow?(playerId: string): unknown;
  
  // ----------------------------------------------------------------------------
  // Store and Banking API (added by StoreSystem and BankingSystem)
  // ----------------------------------------------------------------------------
  
  /** Get store data by ID */
  getStore?(storeId: string): unknown;
  
  /** Get all stores in the world */
  getAllStores?(): unknown[];
  
  /** Get all store locations */
  getStoreLocations?(): unknown[];
  
  /** Get player's bank data for a specific bank */
  getBankData?(playerId: string, bankId: string): unknown;
  
  /** Get all banks accessible to player */
  getAllPlayerBanks?(playerId: string): unknown[];
  
  /** Get all bank locations */
  getBankLocations?(): unknown[];
  
  // ----------------------------------------------------------------------------
  // Resource API (added by ResourceSystem)
  // ----------------------------------------------------------------------------
  
  /** Get resource (tree, fishing spot, etc.) by ID */
  getResource?(resourceId: string): unknown;
  
  /** Get all resources in the world */
  getAllResources?(): unknown[];
  
  /** Get resources of a specific type (e.g., all trees) */
  getResourcesByType?(type: string): unknown[];
  
  // ----------------------------------------------------------------------------
  // Item/Loot API (added by LootSystem and item-related systems)
  // ----------------------------------------------------------------------------
  
  /** Drop item at position (creates ground item entity) */
  dropItem?(item: unknown, position: Position3D, droppedBy?: string): unknown;
  
  /** Get items on ground within range of position */
  getItemsInRange?(position: Position3D, range?: number): unknown[];
  
  /** Get specific ground item by ID */
  getGroundItem?(itemId: string): unknown;
  
  /** Get all ground items */
  getAllGroundItems?(): unknown[];
  
  /** Clear all items from ground */
  clearAllItems?(): unknown;
  
  // ----------------------------------------------------------------------------
  // Testing Utilities (only available in test environments)
  // ----------------------------------------------------------------------------
  
  /** Color detection for visual testing (Playwright tests) */
  colorDetector?: {
    detectColor(x: number, y: number): { r: number; g: number; b: number; a: number };
    getPixels(): Uint8Array;
    registerEntityColor(entityType: string, config: { color: number | string; hex?: string; tolerance?: number }): void;
  };

  /** Test player registry for test isolation */
  _testPlayers?: Map<string, unknown>;
  
  /** Allow material creation in tests */
  _allowMaterial?: boolean;

  /** Asset loader for dynamic model loading */
  assetLoader?: {
    loadModel?: (url: string) => void;
  };

  // ============================================================================
  // SYSTEM ACCESS METHODS
  // ============================================================================
  
  /**
   * Get a system by its registered name with type safety.
   * 
   * Example:
   * ```ts
   * const physics = world.getSystem<Physics>('physics');
   * ```
   * 
   * @param systemKey - The key used when registering the system
   * @returns The system instance or undefined if not found
   */
  getSystem<T extends System = System>(systemKey: string): T | undefined {
    return this.systemsByName.get(systemKey) as T | undefined;
  }

  /**
   * Find a system by name or constructor name.
   * Less efficient than getSystem() but useful when you don't know the exact key.
   * 
   * @param nameOrConstructor - System name or class name to search for
   * @returns The system instance or undefined if not found
   */
  findSystem<T extends System = System>(nameOrConstructor: string): T | undefined {
    const system = this.systems.find((s) => {
      return s.constructor.name === nameOrConstructor || 
             ('name' in s && (s as Record<string, unknown>).name === nameOrConstructor);
    });
    return system as T | undefined;
  }

  /**
   * Check if world is running on server.
   * Determined by the registered network system.
   */
  get isServer(): boolean {
    return this.network?.isServer ?? false;
  }

  /**
   * Check if world is running on client.
   * Determined by the registered network system.
   */
  get isClient(): boolean {
    return this.network?.isClient ?? true;
  }

  /**
   * World Constructor
   * 
   * Creates a new World instance and registers core systems.
   * Additional systems (client/server-specific, RPG systems) are registered by create*World() functions.
   * 
   * Core systems registered here:
   * - settings: Game configuration
   * - anchors: Spatial anchor management
   * - events: Legacy event system
   * - chat: Player communication
   * - entities: Entity Component System
   * - physics: PhysX physics simulation
   * - stage: Three.js scene management
   * 
   * Network system is intentionally not registered here - it's added by:
   * - createClientWorld() → ClientNetwork
   * - createServerWorld() → ServerNetwork
   */
  constructor() {
    super();
    
    // Initialize type-safe event bus for inter-system communication
    // Preferred over EventEmitter for new code
    this.$eventBus = new EventBus();

    // Generate unique world ID using timestamp + random string
    this.id = `world_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create Three.js rig (camera parent) for rendering
    this.rig = new THREE.Object3D() as HyperscapeObject3D;
    
    // Create perspective camera with carefully tuned near/far planes:
    // - near (0.2): Slightly smaller than spherecast to prevent clipping
    // - far (1200): Slightly larger than skybox to include all visible geometry
    // This prevents z-fighting without needing expensive logarithmic depth buffers
    this.camera = new THREE.PerspectiveCamera(70, 16/9, 0.2, 1200);
    this.rig.add(this.camera);

    // Register core systems in dependency order
    // These systems are required for both client and server
    this.register('settings', SettingsSystem);
    this.register('anchors', AnchorsSystem);
    this.register('events', EventsSystem);
    this.register('chat', ChatSystem);
    this.register('entities', EntitiesSystem);
    
    // Physics is now supported on both client and server with Node.js-compatible PhysX
    this.register('physics', PhysicsSystem);
    
    this.register('stage', StageSystem);
    
    // Network system is registered separately by createClientWorld() or createServerWorld()
    // This allows World to be environment-agnostic
  }



  // ============================================================================
  // SYSTEM REGISTRATION AND MANAGEMENT
  // ============================================================================
  
  /**
   * Register a system by creating an instance and adding it to the world.
   * 
   * The system is both:
   * 1. Added to the systems array for lifecycle management
   * 2. Dynamically assigned to world[key] for direct access
   * 
   * @param key - Name to register system under (e.g., 'physics')
   * @param SystemClass - System constructor to instantiate
   * @returns The created system instance
   */
  register(key: string, SystemClass: SystemConstructor): System {
    const system = new SystemClass(this);
    this.addSystem(key, system);
    return system;
  }

  /**
   * Add an already-instantiated system to the world.
   * 
   * @param key - Name to register system under
   * @param system - System instance to add
   */
  addSystem(key: string, system: System): void {
    this.systems.push(system);
    this.systemsByName.set(key, system);
    
    // Dynamically assign system to world instance for convenient access
    // Allows: world.physics instead of world.getSystem('physics')
    Object.defineProperty(this, key, {
      value: system,
      writable: true,
      enumerable: true,
      configurable: true
    });
  }

  /**
   * Topologically Sort Systems Based on Dependencies
   * 
   * Ensures systems are initialized in the correct order based on their dependencies.
   * For example, if System B depends on System A, System A will be initialized first.
   * 
   * Throws an error if:
   * - Circular dependencies are detected
   * - A required dependency is not registered
   * 
   * @param systems - Array of systems to sort
   * @returns Systems sorted in dependency order (dependencies first)
   */
  topologicalSort(systems: System[]): System[] {
    const sorted: System[] = [];
    const visited = new Set<System>();
    const visiting = new Set<System>();
    
    const systemToName = new Map<System, string>();
    this.systemsByName.forEach((system, name) => {
      systemToName.set(system, name);
    });

    const visit = (system: System) => {
      if (visited.has(system)) return;
      if (visiting.has(system)) {
        const systemName = systemToName.get(system) || system.constructor.name;
        throw new Error(`Circular dependency detected involving system: ${systemName}`);
      }

      visiting.add(system);
      
      const deps = system.getDependencies();
      if (deps.required) {
        for (const depName of deps.required) {
          const depSystem = this.systemsByName.get(depName);
          if (!depSystem) {
            const systemName = systemToName.get(system) || system.constructor.name;
            throw new Error(`System ${systemName} requires ${depName}, but ${depName} is not registered`);
          }
          visit(depSystem);
        }
      }
      
      visiting.delete(system);
      visited.add(system);
      sorted.push(system);
    };

    for (const system of systems) {
      visit(system);
    }
    
    return sorted;
  }

  /**
   * Initialize World and All Systems
   * 
   * This is the second step in world lifecycle (after constructor).
   * Initializes all registered systems in dependency order and emits progress events.
   * 
   * Process:
   * 1. Set up storage and asset paths from options
   * 2. Topologically sort systems based on dependencies
   * 3. Initialize each system in order, emitting progress events
   * 4. Start all systems after initialization complete
   * 
   * @param options - Configuration including storage, asset paths, etc.
   */
  async init(options: WorldOptions): Promise<void> {
    // Guard against multiple initialization (can happen in hot reload scenarios)
    if (this._initialized) {
      console.warn('[World] init() called multiple times, skipping duplicate initialization');
      return;
    }
    this._initialized = true;
    console.log('[World] Starting initialization...');
    
    // Set up storage and asset paths
    this.storage = options.storage;
    this.assetsDir = options.assetsDir ?? '';
    this.assetsUrl = options.assetsUrl ?? '/assets/';
    
    // Sort systems to respect dependencies
    // Example: PhysicsSystem must be initialized before systems that use physics
    const sortedSystems = this.topologicalSort(this.systems);
    
    const totalSystems = sortedSystems.length;
    let initializedSystems = 0;
    
    // Build reverse lookup map for progress reporting
    const systemNameMap = new Map<System, string>();
    for (const [name, system] of this.systemsByName) {
      systemNameMap.set(system, name);
    }
    
    // Initialize systems one by one, emitting progress for loading screens
    for (const system of sortedSystems) {
      const systemName = systemNameMap.get(system) || 'Unknown System';
      
      // Emit progress before initializing (for loading screen updates)
      this.emit(EventType.ASSETS_LOADING_PROGRESS, {
        progress: Math.floor((initializedSystems / totalSystems) * 100),
        stage: `Initializing ${systemName}...`,
        total: totalSystems,
        current: initializedSystems
      });
      
      await system.init(options);
      initializedSystems++;
    }
    
    // Emit final progress event
    this.emit(EventType.ASSETS_LOADING_PROGRESS, {
      progress: 100,
      stage: 'Starting world...',
      total: totalSystems,
      current: initializedSystems
    });
    
    // Start all systems (transitions from 'initialized' to 'started' state)
    this.start();
  }

  /**
   * Start All Systems
   * 
   * Called after all systems are initialized.
   * Transitions systems from 'initialized' state to 'started' state.
   * Systems can begin their active operations (network connections, timers, etc.)
   */
  start(): void {
    for (const system of this.systems) {
      system.start();
    }
  }

  // ============================================================================
  // GAME LOOP (Fixed Timestep with Interpolation)
  // ============================================================================
  
  /**
   * Main Game Loop - Called Every Frame
   * 
   * Implements a fixed-timestep game loop with interpolation for smooth rendering.
   * This architecture ensures deterministic physics regardless of frame rate.
   * 
   * Loop Structure:
   * 1. preTick(): Pre-frame setup (stats, monitoring)
   * 2. fixedUpdate(): Physics simulation at fixed 30 FPS
   * 3. update(): Frame-rate dependent updates (rendering, input)
   * 4. lateUpdate(): Post-update transformations
   * 5. commit(): Final rendering/network send
   * 6. postTick(): Post-frame cleanup (stats, profiling)
   * 
   * Fixed Timestep Details:
   * - Physics runs at exactly 30 FPS (fixedDeltaTime = 1/30)
   * - Multiple physics steps may run per frame if frame time is long
   * - Interpolation (alpha) smooths visual updates between physics steps
   * 
   * @param time - Current time in milliseconds (from requestAnimationFrame)
   */
  tick = (time: number): void => {
    // Begin performance monitoring
    this.preTick();
    
    // Convert time to seconds and calculate delta
    time /= 1000;
    let delta = time - this.time;
    
    // Clamp delta to prevent spiral of death on lag spikes
    if (delta < 0) delta = 0;
    if (delta > this.maxDeltaTime) {
      delta = this.maxDeltaTime;
    }
    
    // Update frame counter and time
    this.frame++;
    this.time = time;
    this.accumulator += delta;
    
    // Prepare physics (notify systems if fixed step will occur)
    const willFixedStep = this.accumulator >= this.fixedDeltaTime;
    this.preFixedUpdate(willFixedStep);
    
    // Run fixed-timestep physics updates
    // May run 0, 1, or multiple times depending on accumulated time
    while (this.accumulator >= this.fixedDeltaTime) {
      // Update game state at fixed intervals
      this.fixedUpdate(this.fixedDeltaTime);
      // Step physics simulation
      this.postFixedUpdate(this.fixedDeltaTime);
      // Consume fixed timestep from accumulator
      this.accumulator -= this.fixedDeltaTime;
    }
    
    // Calculate interpolation alpha for smooth rendering
    // Alpha = 0 means use previous physics state, 1 means use current state
    const alpha = this.accumulator / this.fixedDeltaTime;
    this.preUpdate(alpha);
    
    // Run frame-rate dependent updates (rendering, input, animations)
    this.update(delta, alpha);
    
    // Clean up transforms after updates
    this.postUpdate(delta);
    
    // Run late updates (camera, UI that depends on transforms)
    this.lateUpdate(delta, alpha);
    
    // Final transform cleanup before rendering
    this.postLateUpdate(delta);
    
    // Commit changes (render on client, send network updates on server)
    this.commit();
    
    // End performance monitoring
    this.postTick();
  }

  /** Pre-tick phase: Initialize performance monitoring */
  private preTick(): void {
    for (const system of this.systems) {
      system.preTick();
    }
  }

  /**
   * Pre-fixed-update phase: Prepare for physics simulation
   * @param willFixedStep - Whether a fixed update will occur this frame
   */
  private preFixedUpdate(willFixedStep: boolean): void {
    for (const system of this.systems) {
      system.preFixedUpdate(willFixedStep);
    }
  }

  /**
   * Fixed update phase: Physics simulation at fixed timestep (30 FPS)
   * @param delta - Fixed timestep delta (always fixedDeltaTime)
   */
  private fixedUpdate(delta: number): void {
    for (const item of Array.from(this.hot)) {
      if (item.fixedUpdate) {
        item.fixedUpdate(delta);
      }
    }
    for (const system of this.systems) {
      system.fixedUpdate(delta);
    }
  }

  /**
   * Post-fixed-update phase: Finalize physics step
   * @param delta - Fixed timestep delta
   */
  private postFixedUpdate(delta: number): void {
    for (const system of this.systems) {
      system.postFixedUpdate(delta);
    }
  }

  /**
   * Pre-update phase: Prepare for visual updates
   * @param alpha - Interpolation factor between physics steps
   */
  private preUpdate(alpha: number): void {
    for (const system of this.systems) {
      system.preUpdate(alpha);
    }
  }

  /**
   * Update phase: Frame-rate dependent updates (rendering, input)
   * @param delta - Time since last frame in seconds
   * @param _alpha - Interpolation factor (unused but provided for consistency)
   */
  private update(delta: number, _alpha: number): void {
    for (const item of Array.from(this.hot)) {
      item.update(delta);
    }
    for (const system of this.systems) {
      system.update(delta);
    }
  }

  /**
   * Post-update phase: Clean transforms after updates
   * @param delta - Time since last frame in seconds
   */
  private postUpdate(delta: number): void {
    for (const system of this.systems) {
      system.postUpdate(delta);
    }
  }

  /**
   * Late update phase: Camera, UI that depends on transforms
   * @param delta - Time since last frame in seconds
   * @param _alpha - Interpolation factor (unused)
   */
  private lateUpdate(delta: number, _alpha: number): void {
    for (const item of Array.from(this.hot)) {
      if (item.lateUpdate) {
        item.lateUpdate(delta);
      }
    }
    for (const system of this.systems) {
      system.lateUpdate(delta);
    }
  }

  /**
   * Post-late-update phase: Final transform cleanup
   * @param delta - Time since last frame in seconds
   */
  private postLateUpdate(delta: number): void {
    for (const item of Array.from(this.hot)) {
      if (item.postLateUpdate) {
        item.postLateUpdate(delta);
      }
    }
    for (const system of this.systems) {
      system.postLateUpdate(delta);
    }
  }

  /** Commit phase: Render on client, send network updates on server */
  private commit(): void {
    for (const system of this.systems) {
      system.commit();
    }
  }

  /** Post-tick phase: Finalize performance monitoring */
  private postTick(): void {
    for (const system of this.systems) {
      system.postTick();
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Setup material for Cascaded Shadow Maps (CSM).
   * Delegates to environment system's CSM implementation.
   * 
   * @param material - Three.js material to configure for CSM
   */
  setupMaterial = (material: THREE.Material): void => {
    this.environment?.csm?.setupMaterial(material);
  }

  /**
   * Register/Unregister HotReloadable Item
   * 
   * Items in the 'hot' set get update() called every frame.
   * Used for entities and objects that need continuous updates (players, mobs, etc.)
   * 
   * @param item - Object with update/fixedUpdate/lateUpdate methods
   * @param hot - true to add to hot set, false to remove
   */
  setHot(item: HotReloadable, hot: boolean): void {
    if (hot) {
      this.hot.add(item);
    } else {
      this.hot.delete(item);
    }
  }

  /**
   * Resolve Asset URL
   * 
   * Converts asset:// URLs to actual URLs based on environment.
   * Supports multiple URL formats for maximum flexibility.
   * 
   * URL Formats:
   * - asset://path → Uses assetsUrl (CDN) or assetsDir (local files)
   * - blob:... → Returns as-is (data URLs)
   * - http(s)://... → Returns as-is (absolute URLs)
   * - //domain/path → Prefixes with https:
   * - /path → Returns as-is (root-relative)
   * - domain/path → Prefixes with https://
   * 
   * @param url - URL to resolve
   * @param allowLocal - If true, prefer assetsDir over assetsUrl (for server)
   * @returns Resolved URL
   */
  resolveURL(url: string, allowLocal?: boolean): string {
    if (!url) return url;
    url = url.trim();
    
    // Blob URLs are already resolved
    if (url.startsWith('blob')) {
      return url;
    }
    
    // asset:// protocol - resolve based on environment
    if (url.startsWith('asset://')) {
      if (this.assetsDir && allowLocal) {
        // Server-side: Use local file path
        const assetsDir = this.assetsDir.endsWith('/') ? this.assetsDir : this.assetsDir + '/';
        return url.replace('asset://', assetsDir);
      } else if (this.assetsUrl) {
        // Client-side: Use CDN URL
        const assetsUrl = this.assetsUrl.endsWith('/') ? this.assetsUrl : this.assetsUrl + '/';
        return url.replace('asset://', assetsUrl);
      } else {
        console.error('resolveURL: no assetsUrl or assetsDir defined');
        return url;
      }
    }
    
    // Absolute URLs with protocol
    if (url.match(/^https?:\/\//i)) {
      return url;
    }
    
    // Protocol-relative URLs
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    
    // Root-relative URLs
    if (url.startsWith('/')) {
      return url;
    }
    
    // Bare domain/path - assume HTTPS
    return `https://${url}`;
  }

  /**
   * Legacy injection method (no longer used).
   * Previously used for app runtime injection, now removed.
   */
  inject(_runtime: unknown): void {
    // No-op: apps system was removed
  }

  /**
   * Get Player by ID
   * 
   * Convenience method that delegates to entities system.
   * If no ID provided, returns the local player.
   * 
   * @param playerId - Optional player ID to fetch
   * @returns Player instance or null if not found
   */
  getPlayer(playerId?: string): Player | null {
    if (playerId) {
      return this.entities.getPlayer(playerId);
    }
    return this.entities.getLocalPlayer();
  }

  /**
   * Get All Players
   * 
   * @returns Array of all player entities in the world
   */
  getPlayers(): Player[] {
    return this.entities?.getPlayers() || [];
  }

  /**
   * Perform Raycast
   * 
   * Casts a ray through the physics world to detect hits.
   * Delegates to physics system.
   * 
   * @param origin - Start position of ray
   * @param direction - Direction vector (should be normalized)
   * @param maxDistance - Maximum distance to check
   * @param layerMask - Bitmask of layers to check
   * @returns Hit information or null if no hit
   */
  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance?: number, layerMask?: number): RaycastHit | null {
    return this.physics?.raycast(origin, direction, maxDistance, layerMask) || null;
  }

  /**
   * Create Layer Mask for Physics Queries
   * 
   * Creates a bitmask for filtering physics raycasts/sweeps by layer.
   * 
   * Example:
   * ```ts
   * const mask = world.createLayerMask('environment', 'player');
   * ```
   * 
   * @param layers - Layer names to include in mask
   * @returns Bitmask for physics queries
   */
  createLayerMask(...layers: string[]): number {
    return this.physics.createLayerMask(...layers);
  }

  /**
   * Get Current Game Time
   * 
   * @returns Time in seconds since world started
   */
  getTime(): number {
    return this.time;
  }

  /**
   * Disconnect Network Connection
   * 
   * Disconnects the network system gracefully before destroying the world.
   * This ensures proper cleanup of WebSocket connections and network resources.
   */
  async disconnect(): Promise<void> {
    console.log('[World] Disconnecting network...')
    
    if (this.network && this.network.disconnect) {
      await this.network.disconnect();
    }
    
    console.log('[World] Network disconnected')
  }

  /**
   * Destroy World and Cleanup
   * 
   * Destroys all systems, clears event listeners, and resets state.
   * After calling destroy(), the world can be re-initialized if needed.
   * 
   * Cleanup process:
   * 1. Destroy all systems (in any order)
   * 2. Clear systems arrays and hot set
   * 3. Unsubscribe all event listeners
   * 4. Reset initialization flag
   */
  destroy(): void {
    console.log('[World] Destroying world...')
    
    // Destroy all systems
    for (const system of this.systems) {
      system.destroy();
    }
    
    // Clear system references
    this.systems = [];
    this.hot.clear();
    
    // Cleanup EventBus subscriptions
    for (const map of this.__busListenerMap.values()) {
      for (const sub of map.values()) {
        sub.unsubscribe();
      }
    }
    this.__busListenerMap.clear();
    
    // Cleanup EventEmitter listeners
    this.removeAllListeners();
    
    // Allow re-initialization
    this._initialized = false;
    console.log('[World] World destroyed')
  }

  // ============================================================================
  // EVENT SYSTEM OVERRIDES (EventEmitter → EventBus Bridge)
  // ============================================================================
  
  /**
   * Subscribe to an event
   * 
   * String events are routed through EventBus for type safety.
   * Symbol events use the original EventEmitter.
   * 
   * @param event - Event name or symbol
   * @param fn - Event handler function
   * @param _context - Optional context (unused, for compatibility)
   * @returns this for chaining
   * 
   * @public
   */
  override on<T extends string | symbol>(
    event: T,
    fn: T extends keyof import('./types/events').EventMap 
      ? (data: import('./types/events').EventMap[T]) => void 
      : (...args: unknown[]) => void,
    _context?: unknown,
  ): this {
    if (typeof event === 'string') {
      let mapForEvent = this.__busListenerMap.get(event);
      if (!mapForEvent) {
        mapForEvent = new Map();
        this.__busListenerMap.set(event, mapForEvent);
      }
      const sub = this.$eventBus.subscribe(event, (evt) => {
        (fn as (data: unknown) => void)(evt.data);
      });
      mapForEvent.set(fn as (...args: unknown[]) => void, sub);
      return this;
    }
    super.on(event, fn as (...args: unknown[]) => void, _context);
    return this;
  }

  /**
   * Unsubscribe from an event
   * 
   * String events unsubscribe from EventBus.
   * Symbol events use the original EventEmitter.
   * 
   * @param event - Event name or symbol
   * @param fn - Event handler function to remove
   * @param _context - Optional context (unused, for compatibility)
   * @param _once - Whether this was a once listener (unused, for compatibility)
   * @returns this for chaining
   * 
   * @public
   */
  override off<T extends string | symbol>(
    event: T,
    fn?: T extends keyof import('./types/events').EventMap 
      ? (data: import('./types/events').EventMap[T]) => void 
      : (...args: unknown[]) => void,
    _context?: unknown,
    _once?: boolean
  ): this {
    if (typeof event === 'string') {
      if (!fn) {
        const mapForEvent = this.__busListenerMap.get(event);
        if (mapForEvent) {
          for (const sub of mapForEvent.values()) {
            sub.unsubscribe();
          }
          this.__busListenerMap.delete(event);
        }
        return this;
      }
      const mapForEvent = this.__busListenerMap.get(event);
      if (mapForEvent) {
        const sub = mapForEvent.get(fn as (...args: unknown[]) => void);
        if (sub) {
          sub.unsubscribe();
          mapForEvent.delete(fn as (...args: unknown[]) => void);
        }
        if (mapForEvent.size === 0) {
          this.__busListenerMap.delete(event);
        }
      }
      return this;
    }
    super.off(event, fn as (...args: unknown[]) => void, _context, _once);
    return this;
  }

  /**
   * Emit an event
   * 
   * String events are emitted through EventBus for type safety.
   * Symbol events use the original EventEmitter.
   * 
   * @param event - Event name or symbol
   * @param args - Event arguments
   * @returns true if event had listeners
   * 
   * @public
   */
  override emit<T extends string | symbol>(
    event: T,
    ...args: T extends keyof import('./types/events').EventMap 
      ? [data: import('./types/events').EventMap[T]]
      : unknown[]
  ): boolean {
    if (typeof event === 'string') {
      const [data] = args;
      this.$eventBus.emitEvent(
        event,
        (data as Record<string, unknown>) ?? {},
        'world',
      );
      return true;
    }
    return super.emit(event, ...args);
  }

  /**
   * Gets the EventBus for advanced event handling
   * 
   * Use this to access type-safe event subscriptions and the request/response pattern.
   * 
   * @returns The world's EventBus instance
   * 
   * @example
   * ```typescript
   * const eventBus = world.getEventBus();
   * eventBus.subscribe(EventType.COMBAT_DAMAGE, (event) => {
   *   console.log('Damage:', event.data.damage);
   * });
   * ```
   * 
   * @public
   */
  getEventBus(): EventBus {
    return this.$eventBus;
  }

  systemsLoadedPromise(): Promise<void> {
    return Promise.resolve();
  }

}