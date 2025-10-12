import EventEmitter from 'eventemitter3';
import THREE from './extras/three';
import type { Position3D } from './types/base-types';
import type {
  HyperscapeObject3D
} from './types/three-extensions';
// MaterialSetupFunction removed - unused import
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
import {
  ClientAudio,
  ClientInput,
  ClientEnvironment,
  ClientGraphics,
  ClientLoader,
  ClientMonitor,
  ClientInterface,
  ServerRuntime,
  HotReloadable,
  Player,
  RaycastHit,
  ServerDB,
  WorldOptions,
} from './types';

// Define a common interface for network systems (both ClientNetwork and ServerNetwork)
interface NetworkSystem extends System {
  id?: string;
  isServer?: boolean;
  isClient?: boolean;
  send: (type: string, data: unknown) => void;
  upload?: (file: File) => Promise<unknown>;
  onConnection?: (socket: unknown, query: unknown) => void;
}

export class World extends EventEmitter {

  // Time management
  maxDeltaTime = 1 / 30; // 0.33333
  fixedDeltaTime = 1 / 30; // 0.03333 - 30 FPS for consistent timing
  frame = 0;
  time = 0;
  accumulator = 0;
  
  // Core properties
  id: string;
  systems: System[] = [];
  systemsByName = new Map<string, System>();
  networkRate = 1 / 8; // 8Hz
  assetsUrl!: string;
  assetsDir!: string;
  hot = new Set<HotReloadable>();
  
  // Initialization guard
  private _initialized = false;
  
  // Builder/movement state
  moving?: boolean;
  
  // Three.js objects
  rig: HyperscapeObject3D;
  camera: THREE.PerspectiveCamera;
  
  // Systems
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
  anchors!: Anchors;
  events!: Events;
  chat!: Chat & {
    add?: (message: unknown, sync?: boolean) => void;
    clear?: (sync: boolean) => void;
    serialize?: () => unknown;
    messages?: Array<{ id?: string; from: string; body: string; text?: string; timestamp?: number }>;
  };
  entities!: Entities & {
    add?: (data: unknown, local?: boolean) => unknown;
    serialize?: () => unknown;
    getPlayer: (playerId: string) => Player;
    getLocalPlayer: () => Player;
    getPlayers: () => Player[];
    player: Player;
  };
  physics!: Physics;
  stage!: Stage & {
    scene?: {
      add?: (obj: unknown) => void;
      remove?: (obj: unknown) => void;
    };
    THREE?: typeof THREE;
  };
  particles?: Particles;
  lods?: LODs;
  
  // Optional client systems
  ui?: ClientInterface & {
    active?: boolean;
    appendChild?: (element: HTMLElement) => void;
    removeChild?: (element: HTMLElement) => void;
    getBoundingClientRect?: () => DOMRect;
    applyTheme?: (theme: unknown) => void;
  };
  loader?: ClientLoader;
  network!: NetworkSystem; // Will be either ClientNetwork or ServerNetwork, set by create*World functions
  environment?: ClientEnvironment;
  graphics?: ClientGraphics & {
    renderer?: {
      domElement: HTMLCanvasElement;
      render?: (scene: unknown, camera: unknown) => void;
      setSize?: (width: number, height: number) => void;
    };
  };
  controls?: ClientInput;
  prefs?: ClientInterface;
  audio?: ClientAudio;
  music?: import('./systems/MusicSystem').MusicSystem;
  monitor?: ClientMonitor & {
    getStats?: () => Promise<{ currentCPU: number; currentMemory: number; maxMemory: number }>;
  };
  livekit?: ClientLiveKit & {
    getPlayerOpts?: (id: string) => Promise<unknown>;
    on?: (event: string, callback: (data: unknown) => void) => void;
    setScreenShareTarget?: (targetId: string) => void;
  };
  stats?: ClientInterface;
  
  // Optional server systems
  db?: ServerDB;
  server?: ServerRuntime;
  storage?: unknown; // Type not fully defined in interface
  
  // Client systems that might be dynamically added  
  builder?: {
    enabled: boolean;
    mode?: string;
    tool?: string;
  };
  actions?: ClientActions & {
    btnDown?: boolean;
    execute?: (actionName: string, params?: Record<string, unknown>) => Promise<unknown>;
    getAvailable?: () => string[];
  };
  xr?: XR;
  terrain?: {
    getHeightAt: (x: number, z: number) => number;
    generate: (params: Record<string, unknown>) => void;
  };

  // Unified typed event bus (public to enable typed access from systems)
  $eventBus: EventBus;
  __busListenerMap: Map<string, Map<(...args: unknown[]) => void, EventSubscription>> = new Map();
  
  // Move app state
  moveApp?: {
    enabled?: boolean;
  };
  
  // Legacy property access patterns
  entity?: {
    id?: string;
    position?: { x: number; y: number; z: number };
    [key: string]: unknown;
  };
  
  // Action registry (added by ActionRegistry system)
  actionRegistry?: {
    getAll(): Array<{ name: string; [key: string]: unknown }>;
    getAvailable(context: Record<string, unknown>): Array<{ name: string; [key: string]: unknown }>;
    execute(name: string, context: Record<string, unknown>, params: Record<string, unknown>): Promise<unknown>;
  };
  
  // API methods (added by SystemLoader) - flattened directly onto world
  rpgSystems?: Record<string, { name: string; [key: string]: unknown }>;
  rpgActions?: Record<string, { name: string; execute: (params: Record<string, unknown>) => Promise<unknown>; [key: string]: unknown }>;
  actionMethods?: Record<string, (...args: unknown[]) => unknown>;
  
  // Player API
  getRPGPlayer?(playerId: string): { id: string; [key: string]: unknown } | undefined;
  savePlayer?(playerId: string, data: Record<string, unknown>): unknown;
  getAllPlayers?(): unknown[];
  healPlayer?(playerId: string, amount: number): unknown;
  damagePlayer?(playerId: string, amount: number): unknown;
  isPlayerAlive?(playerId: string): boolean;
  getPlayerHealth?(playerId: string): { current: number; max: number };
  teleportPlayer?(playerId: string, position: Position3D): unknown;
  
  // Combat API
  startCombat?(attackerId: string, targetId: string): unknown;
  stopCombat?(attackerId: string): unknown;
  canAttack?(attackerId: string, targetId: string): boolean;
  isInCombat?(entityId: string): boolean;
  
  // Skills API
  getSkills?(playerId: string): Record<string, { level: number; xp: number }>;
  getSkillLevel?(playerId: string, skill: string): number;
  getSkillXP?(playerId: string, skill: string): number;
  getCombatLevel?(playerId: string): number;
  getXPToNextLevel?(playerId: string, skill: string): number;
  
  // Inventory API
  getInventory?(playerId: string): Array<{ itemId: string; quantity: number; [key: string]: unknown }>;
  getEquipment?(playerId: string): Record<string, { itemId: string; [key: string]: unknown }>;
  hasItem?(playerId: string, itemId: string | number, quantity?: number): boolean;
  getArrowCount?(playerId: string): number;
  canAddItem?(playerId: string, item: unknown): boolean;
  
  // Movement API
  isPlayerMoving?(playerId: string): boolean;
  getPlayerStamina?(playerId: string): { current: number; max: number; regenerating: boolean };
  movePlayer?(playerId: string, targetPosition: Position3D): unknown;
  
  // Mob API
  getMob?(mobId: string): unknown;
  getAllMobs?(): unknown[];
  getMobsInArea?(center: Position3D, radius: number): unknown[];
  spawnMob?(type: string, position: Position3D): unknown;
  
  // Equipment API
  getPlayerEquipment?(playerId: string): unknown;
  getEquipmentData?(playerId: string): unknown;
  getEquipmentStats?(playerId: string): unknown;
  isItemEquipped?(playerId: string, itemId: number): boolean;
  canEquipItem?(playerId: string, itemId: number): boolean;
  consumeArrow?(playerId: string): unknown;
  
  // Store and Banking API
  getStore?(storeId: string): unknown;
  getAllStores?(): unknown[];
  getStoreLocations?(): unknown[];
  getBankData?(playerId: string, bankId: string): unknown;
  getAllPlayerBanks?(playerId: string): unknown[];
  getBankLocations?(): unknown[];
  
  // Resource API
  getResource?(resourceId: string): unknown;
  getAllResources?(): unknown[];
  getResourcesByType?(type: string): unknown[];
  
  // Item Pickup API
  dropItem?(item: unknown, position: Position3D, droppedBy?: string): unknown;
  getItemsInRange?(position: Position3D, range?: number): unknown[];
  getGroundItem?(itemId: string): unknown;
  getAllGroundItems?(): unknown[];
  clearAllItems?(): unknown;
  
  // Test API
  getTestCombatResults?(): unknown;
  getAllTestResults?(): Record<string, unknown>;
  runAllTests?(): unknown;
  getErrorLog?(): unknown;
  
  // Visual Test API
  getVisualTestReport?(): unknown;
  getVisualEntitiesByType?(type: string): unknown[];
  getVisualEntitiesByColor?(color: number): unknown[];
  verifyEntityExists?(entityId: string, expectedType?: string): unknown;
  verifyPlayerAtPosition?(playerId: string, position: Position3D, tolerance?: number): unknown;
  getAllVisualEntities?(): unknown[];
  
  colorDetector?: {
    detectColor(x: number, y: number): { r: number; g: number; b: number; a: number };
    getPixels(): Uint8Array;
    registerEntityColor(entityType: string, config: { color: number | string; hex?: string; tolerance?: number }): void;
  };

  // Test-specific properties
  _testPlayers?: Map<string, unknown>;
  _allowMaterial?: boolean;

  // Asset loading
  assetLoader?: {
    loadModel?: (url: string) => void;
  };

  // Add getSystem method with proper type safety
  getSystem<T extends System = System>(systemKey: string): T | undefined {
    return this.systemsByName.get(systemKey) as T | undefined;
  }
  
  // System lifecycle methods are implemented later in the class

  // Helper method to find systems by name or constructor name
  findSystem<T extends System = System>(nameOrConstructor: string): T | undefined {
    const system = this.systems.find((s) => {
      return s.constructor.name === nameOrConstructor || 
             ('name' in s && (s as Record<string, unknown>).name === nameOrConstructor);
    });
    return system as T | undefined;
  }

  // Helper properties for common access patterns
  get isServer(): boolean {
    return this.network?.isServer ?? false;
  }

  get isClient(): boolean {
    return this.network?.isClient ?? true;
  }

  constructor() {
    super();
    // Initialize unified EventBus
    this.$eventBus = new EventBus();

    // Generate unique world ID
    this.id = `world_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.rig = new THREE.Object3D() as HyperscapeObject3D;
    // NOTE: camera near is slightly smaller than spherecast. far is slightly more than skybox.
    // this gives us minimal z-fighting without needing logarithmic depth buffers
    // Initialize with default aspect ratio of 16:9 (will be updated by graphics system)
    this.camera = new THREE.PerspectiveCamera(70, 16/9, 0.2, 1200);
    this.rig.add(this.camera);

    // Register core systems
    this.register('settings', SettingsSystem);
    this.register('anchors', AnchorsSystem);
    this.register('events', EventsSystem);
    this.register('chat', ChatSystem);
    this.register('entities', EntitiesSystem);
    
    // Register Physics system on both client and server - now supported with Node.js-compatible PhysX
    this.register('physics', PhysicsSystem);
    
    this.register('stage', StageSystem);
    
    // Note: network system will be registered by createClientWorld or createServerWorld
  }



  register(key: string, SystemClass: SystemConstructor): System {
    const system = new SystemClass(this);
    this.addSystem(key, system);
    return system;
  }

  addSystem(key: string, system: System): void {
    this.systems.push(system);
    this.systemsByName.set(key, system);
    // Dynamically assign system to world instance with type safety
    Object.defineProperty(this, key, {
      value: system,
      writable: true,
      enumerable: true,
      configurable: true
    });
  }

  /**
   * Topologically sort systems based on their dependencies
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

  async init(options: WorldOptions): Promise<void> {
    // Guard against multiple initialization
    if (this._initialized) {
      console.warn('[World] init() called multiple times, skipping duplicate initialization');
      return;
    }
    this._initialized = true;
    console.log('[World] Starting initialization...');
    
    this.storage = options.storage;
    this.assetsDir = options.assetsDir ?? '';
    this.assetsUrl = options.assetsUrl ?? '/assets/';
    
    // Sort systems based on dependencies
    const sortedSystems = this.topologicalSort(this.systems);
    
    const totalSystems = sortedSystems.length;
    let initializedSystems = 0;
    
    // Create a reverse lookup for system names
    const systemNameMap = new Map<System, string>();
    for (const [name, system] of this.systemsByName) {
      systemNameMap.set(system, name);
    }
    
    // Initialize systems in dependency order with progress tracking
    for (const system of sortedSystems) {
      const systemName = systemNameMap.get(system) || 'Unknown System';
      
      // Emit progress before initializing
      this.emit(EventType.ASSETS_LOADING_PROGRESS, {
        progress: Math.floor((initializedSystems / totalSystems) * 100),
        stage: `Initializing ${systemName}...`,
        total: totalSystems,
        current: initializedSystems
      });
      
      await system.init(options);
      initializedSystems++;
    }
    
    // Emit final progress
    this.emit(EventType.ASSETS_LOADING_PROGRESS, {
      progress: 100,
      stage: 'Starting world...',
      total: totalSystems,
      current: initializedSystems
    });
    
    this.start();
  }

  start(): void {
    for (const system of this.systems) {
      system.start();
    }
  }

  tick = (time: number): void => {
    // begin any stats/performance monitors
    this.preTick();
    
    // update time, delta, frame and accumulator
    time /= 1000;
    let delta = time - this.time;
    if (delta < 0) delta = 0;
    if (delta > this.maxDeltaTime) {
      delta = this.maxDeltaTime;
    }
    
    this.frame++;
    this.time = time;
    this.accumulator += delta;
    
    // prepare physics
    const willFixedStep = this.accumulator >= this.fixedDeltaTime;
    this.preFixedUpdate(willFixedStep);
    
    // run as many fixed updates as we can for this ticks delta
    while (this.accumulator >= this.fixedDeltaTime) {
      // run all fixed updates
      this.fixedUpdate(this.fixedDeltaTime);
      // step physics
      this.postFixedUpdate(this.fixedDeltaTime);
      // decrement accumulator
      this.accumulator -= this.fixedDeltaTime;
    }
    
    // interpolate physics for remaining delta time
    const alpha = this.accumulator / this.fixedDeltaTime;
    this.preUpdate(alpha);
    
    // run all updates
    this.update(delta, alpha);
    
    // run post updates, eg cleaning all node matrices
    this.postUpdate(delta);
    
    // run all late updates
    this.lateUpdate(delta, alpha);
    
    // run post late updates, eg cleaning all node matrices
    this.postLateUpdate(delta);
    
    // commit all changes, eg render on the client
    this.commit();
    
    // end any stats/performance monitors
    this.postTick();
  }

  private preTick(): void {
    for (const system of this.systems) {
      system.preTick();
    }
  }

  private preFixedUpdate(willFixedStep: boolean): void {
    for (const system of this.systems) {
      system.preFixedUpdate(willFixedStep);
    }
  }

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

  private postFixedUpdate(delta: number): void {
    for (const system of this.systems) {
      system.postFixedUpdate(delta);
    }
  }

  private preUpdate(alpha: number): void {
    for (const system of this.systems) {
      system.preUpdate(alpha);
    }
  }

  private update(delta: number, _alpha: number): void {
    for (const item of Array.from(this.hot)) {
      if (item.update) {
        item.update(delta);
      }
    }
    for (const system of this.systems) {
      try {
        system.update(delta);
      } catch (_error) {
        console.error(`[World] Error in system update:`, system.constructor.name, _error);
        throw _error;
      }
    }
  }

  private postUpdate(delta: number): void {
    for (const system of this.systems) {
      system.postUpdate(delta);
    }
  }

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

  private commit(): void {
    for (const system of this.systems) {
      system.commit();
    }
  }

  private postTick(): void {
    for (const system of this.systems) {
      system.postTick();
    }
  }

  setupMaterial = (material: THREE.Material): void => {
    // @ts-ignore - CSM is added by environment system
    this.environment?.csm?.setupMaterial(material);
  }

  setHot(item: HotReloadable, hot: boolean): void {
    if (hot) {
      this.hot.add(item);
    } else {
      this.hot.delete(item);
    }
  }

  resolveURL(url: string, allowLocal?: boolean): string {
    if (!url) return url;
    url = url.trim();
    
    if (url.startsWith('blob')) {
      return url;
    }
    
    if (url.startsWith('asset://')) {
      if (this.assetsDir && allowLocal) {
        // Ensure assetsDir has trailing slash for proper URL construction
        const assetsDir = this.assetsDir.endsWith('/') ? this.assetsDir : this.assetsDir + '/';
        return url.replace('asset://', assetsDir);
      } else if (this.assetsUrl) {
        // Ensure assetsUrl has trailing slash for proper URL construction
        const assetsUrl = this.assetsUrl.endsWith('/') ? this.assetsUrl : this.assetsUrl + '/';
        return url.replace('asset://', assetsUrl);
      } else {
        console.error('resolveURL: no assetsUrl or assetsDir defined');
        return url;
      }
    }
    
    if (url.match(/^https?:\/\//i)) {
      return url;
    }
    
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    
    if (url.startsWith('/')) {
      return url;
    }
    
    return `https://${url}`;
  }

  inject(_runtime: unknown): void {
    // This method is no longer needed as apps property is removed
    // this.apps.inject(runtime);
  }

  // Helper methods for common access patterns
  getPlayer(playerId?: string): Player | null {
    if (playerId) {
      return this.entities.getPlayer(playerId);
    }
    // If no playerId provided, try to get local player
    return this.entities.getLocalPlayer();
  }

  getPlayers(): Player[] {
    return this.entities?.getPlayers() || [];
  }

  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance?: number, layerMask?: number): RaycastHit | null {
    return this.physics?.raycast(origin, direction, maxDistance, layerMask) || null;
  }

  createLayerMask(...layers: string[]): number {
    // Delegate to physics system - assume it exists
    return this.physics.createLayerMask(...layers);
  }

  getTime(): number {
    return this.time;
  }

  destroy(): void {
    console.log('[World] Destroying world...')
    for (const system of this.systems) {
      system.destroy();
    }
    
    this.systems = [];
    this.hot.clear();
    // Cleanup bus subscriptions
    for (const map of this.__busListenerMap.values()) {
      for (const sub of map.values()) {
        sub.unsubscribe();
      }
    }
    this.__busListenerMap.clear();
    this.removeAllListeners();
    
    // Reset initialization flag so world can be re-initialized if needed
    this._initialized = false;
    console.log('[World] World destroyed')
  }


} 

// Expose typed EventBus helpers on World prototype while preserving existing API
declare module './World' {}

// Override EventEmitter methods to bridge to EventBus for string events
// Note: We avoid double-calling by not registering string events with the base EventEmitter
// and by emitting string events only through the EventBus.
// This preserves existing world.on/world.emit usage while migrating to the new pattern.
World.prototype.on = function on<T extends string | symbol>(
  this: World,
  event: T,
  fn: (...args: unknown[]) => void,
  _context?: unknown,
) {
  if (typeof event === 'string') {
    let mapForEvent = this.__busListenerMap.get(event);
    if (!mapForEvent) {
      mapForEvent = new Map();
      this.__busListenerMap.set(event, mapForEvent);
    }
    const sub = this.$eventBus.subscribe(event, (evt) => {
      try {
        fn(evt.data);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Error in EventBus handler for '${event}':`, err);
      }
    });
    mapForEvent.set(fn, sub);
    return this;
  }
  EventEmitter.prototype.on.call(this, event, fn, _context);
  return this;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
World.prototype.off = function off<T extends string | symbol>(
  this: World,
  event: T,
  fn?: (...args: unknown[]) => void,
  _context?: unknown,
  _once?: boolean
) {
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
      const sub = mapForEvent.get(fn);
      if (sub) {
        sub.unsubscribe();
        mapForEvent.delete(fn);
      }
      if (mapForEvent.size === 0) {
        this.__busListenerMap.delete(event);
      }
    }
    return this;
  }
  EventEmitter.prototype.off.call(this, event, fn, _context, _once);
  return this;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
World.prototype.emit = function emit<T extends string | symbol>(
  this: World,
  event: T,
  ...args: unknown[]
) {
  if (typeof event === 'string') {
    const [data] = args;
    this.$eventBus.emitEvent(
      event,
      (data as Record<string, unknown>) ?? {},
      'world',
    );
    return true;
  }
  return EventEmitter.prototype.emit.call(this, event, ...args);
};

// Provide a typed accessor to the event bus
// eslint-disable-next-line no-redeclare
export interface World {
  getEventBus(): EventBus;
}

World.prototype.getEventBus = function getEventBus(this: World): EventBus {
  return this.$eventBus;
};