/**
 * Type-safe utilities for accessing world systems
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 * Replaces unsafe (world as unknown as any)['system-name'] patterns
 */

import type { World, System, Entity, EntityData } from "../types";
import type THREE from "../extras/three";
import type { PxTransform } from "../types/physics";

/**
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 * Type-safe system getter that replaces (world as unknown as any)['system-name']
 */
export function getSystem<T extends System = System>(
  world: World,
  systemKey: string,
): T | null {
  if (!world) {
    throw new Error("World is required");
  }

  // Try the getSystem method if available
  return world.getSystem<T>(systemKey) || null;
}

/**
 * Type-safe system getter with error throwing for required systems
 */
export function requireSystem<T extends System = System>(
  world: World,
  systemKey: string,
): T {
  const system = getSystem<T>(world, systemKey);
  if (!system) {
    throw new Error(`Required system '${systemKey}' not found in world`);
  }
  return system;
}

/**
 * Check if a system exists without accessing it
 */
export function hasSystem(world: World, systemKey: string): boolean {
  return getSystem(world, systemKey) !== null;
}

/**
 * Type-safe access to world network
 */
export function getWorldNetwork(
  world: World,
): { send: (type: string, data: unknown) => void } | null {
  if (!world || !world.network) {
    return null;
  }
  return world.network;
}

/**
 * Type-safe check for server/client context
 */
export function isServer(world: World): boolean {
  return world.isServer === true || world.network.isServer === true;
}

/**
 * Type-safe check for client context
 */
export function isClient(world: World): boolean {
  return world.isClient === true || world.network.isClient === true;
}

/**
 * network utilities for ClientBuilder
 */
export interface NetworkSystem extends System {
  id?: string;
  upload?: (file: File | Blob) => Promise<void>;
  maxUploadSize?: number;
}

export function getNetworkSystem(world: World): NetworkSystem | null {
  const network = getWorldNetwork(world);
  return network as unknown as NetworkSystem | null;
}

/**
 * Entities system interface
 */
export interface EntitiesSystem extends System {
  add: (data: EntityData, local?: boolean) => Entity | null;
  get: (entityId: string) => Entity | null;
}

export function getEntitiesSystem(world: World): EntitiesSystem | null {
  return getSystem<EntitiesSystem>(world, "entities");
}

/**
 * Chat system interface
 */
export interface ChatSystem extends System {
  add: (message: {
    id?: string;
    from: string;
    body: string;
    text?: string;
    timestamp?: number;
  }) => void;
}

export function getChatSystem(world: World): ChatSystem | null {
  return getSystem<ChatSystem>(world, "chat");
}

/**
 * Loader system interface
 */
export interface LoaderSystem extends System {
  insert: (type: string, url: string, data: File) => void;
}

export function getLoaderSystem(world: World): LoaderSystem | null {
  return getSystem<LoaderSystem>(world, "loader");
}

/**
 * Graphics system interface
 */
export interface GraphicsSystem extends System {
  renderer?: THREE.WebGLRenderer | unknown; // Support both WebGL and WebGPU
  isWebGPU?: boolean;
}

export function getGraphicsSystem(world: World): GraphicsSystem | null {
  return getSystem<GraphicsSystem>(world, "graphics");
}

/**
 * Stage system interface
 */
export interface StageSystem extends System {
  raycastPointer: (position: { x: number; y: number }) => Entity[];
  scene: THREE.Scene;
}

export function getStageSystem(world: World): StageSystem | null {
  return getSystem<StageSystem>(world, "stage");
}

/**
 * Camera system interface for PlayerLocal
 */
export interface CameraSystem extends System {
  setTarget: (data: { target: Entity | THREE.Object3D }) => void;
}

export function getCameraSystem(world: World): CameraSystem | null {
  // Camera system registration key: 'client-camera-system'
  return getSystem<CameraSystem>(world, "client-camera-system");
}

/**
 * Terrain system interface
 */
export interface TerrainSystem extends System {
  getHeightAt: (x: number, z: number) => number;
  query?: (position: { x: number; y: number; z: number }) => {
    height: number;
    normal: { x: number; y: number; z: number };
  };
}

export function getTerrainSystem(world: World): TerrainSystem | null {
  return getSystem<TerrainSystem>(world, "terrain");
}

/**
 * PhysX Transform interfaces
 */
export interface PhysXTransformable {
  toPxTransform: (transform: PxTransform) => void;
}
