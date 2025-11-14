/**
 * window-types.ts - Browser Window Extension Types
 *
 * Type definitions for browser window extensions used across the codebase.
 * Eliminates `unknown` from window property access.
 */

import type { World } from "../World";
import type THREE from "three";

/**
 * Window with world instance for debugging
 */
export interface WindowWithWorld extends Window {
  world?: World;
  THREE?: typeof THREE;
  Hyperscape?: Record<string, unknown>;
  preview?: unknown;
  DEBUG_RPG?: string;
  __lastRaycastTarget?: {
    x: number;
    y: number;
    z: number;
    method: string;
  };
}

/**
 * Window with Hyperscape utilities
 */
export interface WindowWithHyperscape extends Window {
  Hyperscape?: {
    CircularSpawnArea?: new (...args: unknown[]) => unknown;
    [key: string]: unknown;
  };
}

/**
 * Global this with server flags
 */
export interface GlobalWithServerFlag {
  __HYPERSCAPE_SERVER_STARTING__?: boolean;
}

/**
 * Global this with resources
 */
export interface GlobalWithResources {
  EXTERNAL_RESOURCES?: Map<
    string,
    {
      id: string;
      name: string;
      type: string;
      modelPath: string | null;
      harvestSkill: string;
      requiredLevel: number;
      harvestTime: number;
      respawnTime: number;
      harvestYield: Array<{ itemId: string; quantity: number; chance: number }>;
    }
  >;
}

/**
 * Global with PhysX
 */
export interface GlobalWithPhysX {
  PHYSX?: Record<string, unknown>;
}

/**
 * Global with ProgressEvent polyfill
 */
export interface GlobalWithProgressEvent {
  ProgressEvent: new (
    type: string,
    init?: { lengthComputable?: boolean; loaded?: number; total?: number },
  ) => {
    type: string;
    lengthComputable: boolean;
    loaded: number;
    total: number;
  };
}
