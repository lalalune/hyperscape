/**
 * system-types.ts - Concrete System Interface Types
 *
 * Strong type definitions for system method signatures.
 * Use these instead of casting to unknown.
 */

import type THREE from "three";
import type { System } from "../systems/System";
import type { Entity } from "../entities/Entity";

/**
 * Terrain System interface
 */
export interface TerrainSystemInterface extends System {
  getHeightAt(x: number, z: number): number;
  getNormalAt(x: number, z: number): THREE.Vector3;
  isReady(): boolean;
  getTileSize(): number;
  isPositionWalkable(
    worldX: number,
    worldZ: number,
  ): { walkable: boolean; reason?: string };
  getBiomeAtPosition(x: number, z: number): string;
  getHeightAtPosition(x: number, z: number): number;
}

/**
 * Camera System interface
 */
export interface CameraSystemInterface extends System {
  setTarget(data: { target: Entity | THREE.Object3D }): void;
  resetCamera?(): void;
}

/**
 * Network System base interface
 */
export interface NetworkSystemInterface extends System {
  id: string | number | null;
  isServer: boolean;
  isClient: boolean;
  send<T = Record<string, unknown>>(method: string, data?: T): void;
  enqueue(socket: unknown, method: string, data: unknown): void;
  onDisconnect(socket: unknown, code?: number | string): void;
}

/**
 * Combat System interface
 */
export interface CombatSystemInterface extends System {
  forceEndCombat(entityId: string): void;
  isInCombat(playerId: string): boolean;
  getCombatTarget(playerId: string): string | null;
}

/**
 * Inventory System interface
 */
export interface InventorySystemInterface extends System {
  getInventoryData(playerId: string): {
    items: Array<{ itemId: string; quantity: number; slot: number }>;
    coins: number;
    maxSlots: number;
  };
  getItemQuantity(playerId: string, itemId: string): number;
  isFull(playerId: string): boolean;
  hasItem(playerId: string, itemId: string, quantity?: number): boolean;
  getCoins(playerId: string): number;
}

/**
 * Equipment System interface
 */
export interface EquipmentSystemInterface extends System {
  getPlayerEquipment(playerId: string):
    | {
        weapon: unknown;
        shield: unknown;
        helmet: unknown;
        body: unknown;
        legs: unknown;
        arrows: unknown;
        totalStats: {
          attack: number;
          strength: number;
          defense: number;
          ranged: number;
          constitution: number;
        };
      }
    | undefined;
  consumeArrow(playerId: string): boolean;
  getArrowCount(playerId: string): number;
}

/**
 * Skills System interface
 */
export interface SkillsSystemInterface extends System {
  grantXP(entityId: string, skill: string, amount: number): void;
  getSkills(
    entityId: string,
  ): Record<string, { level: number; xp: number }> | undefined;
}

/**
 * Resource System interface
 */
export interface ResourceSystemInterface extends System {
  getAllResources(): Array<{
    id: string;
    type: string;
    position: { x: number; y: number; z: number };
    isAvailable: boolean;
    respawnTime?: number;
    lastDepleted?: number;
  }>;
  getResource(resourceId: string):
    | {
        id: string;
        type: string;
        position: { x: number; y: number; z: number };
        isAvailable: boolean;
      }
    | undefined;
}

/**
 * Entity Manager interface
 */
export interface EntityManagerInterface extends System {
  spawnEntity(config: Record<string, unknown>): Promise<Entity | null>;
  getEntity(entityId: string): Entity | null;
  despawnEntity(entityId: string): void;
}

/**
 * Entities System interface
 */
export interface EntitiesSystemInterface extends System {
  items: Map<string, Entity>;
  players: Map<string, unknown>;
  player?: Entity;
  add(data: Record<string, unknown>, local?: boolean): Entity;
  get(id: string): Entity | null;
  remove(id: string): boolean;
  has(id: string): boolean;
  values(): IterableIterator<Entity>;
  getPlayer(id: string): unknown;
  getPlayers(): unknown[];
  getAllPlayers(): unknown[];
  getLocalPlayer(): unknown;
  deserialize(data: unknown[]): Promise<void>;
  serialize(): unknown[];
}

/**
 * Chat System interface
 */
export interface ChatSystemInterface extends System {
  msgs: Array<{
    id: string;
    from: string | null;
    fromId: string | null;
    body: string;
    text?: string;
    createdAt: string;
    timestamp?: number;
  }>;
  add(
    msg: {
      id?: string;
      from: string | null;
      fromId: string | null;
      body: string;
      text?: string;
      createdAt: string;
      timestamp?: number;
    },
    broadcast?: boolean,
  ): void;
  subscribe(callback: (msgs: unknown[]) => void): {
    unsubscribe: () => void;
    active: boolean;
  };
  serialize(): unknown[];
  deserialize(data: unknown): void;
  clear(broadcast?: boolean): void;
}

/**
 * Loader System interface
 */
export interface LoaderSystemInterface extends System {
  load(type: string, url: string): Promise<unknown>;
  get(type: string, url: string): unknown;
  preload(type: string, url: string): void;
  execPreload(): void;
  preloader?: Promise<void> | null;
  promises: Map<string, Promise<unknown>>;
  results: Map<string, unknown>;
}

/**
 * Physics System interface
 */
export interface PhysicsSystemInterface extends System {
  scene: unknown;
  physics: {
    createMaterial(
      staticFriction: number,
      dynamicFriction: number,
      restitution: number,
    ): unknown;
    createRigidDynamic(transform: unknown): unknown;
    createRigidStatic(transform: unknown): unknown;
    createShape(
      geometry: unknown,
      material: unknown,
      exclusive?: boolean,
      flags?: unknown,
    ): unknown;
  };
  enabled: boolean;
  timeStep: number;
  gravity: { x: number; y: number; z: number };
  controllers: Map<string, unknown>;
  getMaterial?(
    staticFriction: number,
    dynamicFriction: number,
    restitution: number,
  ): unknown;
  addActor(actor: unknown, handle: unknown): unknown;
  removeActor(actor: unknown): void;
  step(deltaTime: number): void;
}

/**
 * Graphics System interface
 */
export interface GraphicsSystemInterface {
  renderer: {
    domElement: HTMLCanvasElement;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    setPixelRatio(value: number): void;
    setAnimationLoop(callback: ((time: number) => void) | null): void;
    render(scene: THREE.Scene, camera: THREE.Camera): void;
    xr?: {
      getReferenceSpace(): { [key: string]: unknown } | null;
      getFrame(): { [key: string]: unknown };
      setAnimationLoop(
        callback:
          | ((time: number, frame: { [key: string]: unknown }) => void)
          | null,
      ): void;
    };
  };
  maxAnisotropy: number;
  worldToScreenFactor: number;
  on(event: string, handler: (data: Record<string, unknown>) => void): void;
  off(event: string, handler: (data: Record<string, unknown>) => void): void;
}

/**
 * Stage System interface
 */
export interface StageSystemInterface extends System {
  scene: THREE.Scene;
  octree: {
    insert(item: unknown): void;
    remove(item: unknown): void;
    move(item: unknown): void;
  };
  THREE?: typeof THREE;
  raycastPointer(
    position: { x: number; y: number },
    layers?: THREE.Layers,
    min?: number,
    max?: number,
  ): unknown[];
  add(object: unknown): void;
  remove(object: unknown): void;
}

/**
 * LiveKit System interface
 */
export interface LiveKitSystemInterface extends System {
  getPlayerOpts?(userId: string): Promise<unknown>;
  deserialize(data: unknown): void;
}

/**
 * Settings System interface
 */
export interface SettingsSystemInterface {
  model?: string | { url?: string };
  avatar?: { url?: string };
  public?: boolean;
  playerLimit?: number;
  serialize(): Record<string, unknown>;
  deserialize(data: Record<string, unknown>): void;
  set(
    key: string,
    value: string | number | boolean | Record<string, unknown>,
  ): void;
  get(
    key: string,
  ): string | number | boolean | Record<string, unknown> | undefined;
  on(
    event: "change",
    handler: (changes: Record<string, unknown>) => void,
  ): void;
  off(
    event: "change",
    handler: (changes: Record<string, unknown>) => void,
  ): void;
}

/**
 * Prefs System interface
 */
export interface PrefsSystemInterface {
  dpr?: number;
  postprocessing?: boolean;
  bloom?: boolean;
  shadows?: string;
  music?: number;
  sfx?: number;
  voice?: number;
  stats?: boolean;
  on(
    event: "change",
    handler: (
      changes: Record<
        string,
        { prev: string | number | boolean; value: string | number | boolean }
      >,
    ) => void,
  ): void;
  off(
    event: "change",
    handler: (
      changes: Record<
        string,
        { prev: string | number | boolean; value: string | number | boolean }
      >,
    ) => void,
  ): void;
}

/**
 * Audio System interface
 */
export interface AudioSystemInterface extends System {
  ctx: AudioContext;
  ready(callback: () => void): void;
}

/**
 * XR System interface
 */
export interface XRSystemInterface extends System {
  session: XRSession | null;
}

/**
 * Controls System interface
 */
export interface ControlsSystemInterface extends System {
  bind(config: {
    priority: number;
    onTouch?: (touch: {
      id: number;
      position: { x: number; y: number };
    }) => boolean;
    onTouchEnd?: (touch: {
      id: number;
      position: { x: number; y: number };
    }) => boolean;
  }): {
    screen?: { width: number; height: number };
    release(): void;
    [key: string]: unknown;
  };
}

/**
 * Monitor System interface
 */
export interface MonitorSystemInterface extends System {
  getStats?():
    | Promise<{
        currentCPU: number;
        currentMemory: number;
        maxMemory: number;
      }>
    | {
        currentCPU: number;
        currentMemory: number;
        maxMemory: number;
      };
}
