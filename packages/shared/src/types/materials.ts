/**
 * Material system types
 * 
 * These types are used across various systems that work with THREE.js materials,
 * including the Stage system and any rendering-related functionality.
 */

import type THREE from '../extras/three';

/**
 * Type-safe material interfaces for THREE.js materials
 */
export interface MaterialWithColor extends THREE.Material {
  color: THREE.Color;
  needsUpdate: boolean;
}

export interface MaterialWithEmissive extends THREE.Material {
  emissiveIntensity: number;
  needsUpdate: boolean;
}

export interface MaterialWithFog extends THREE.Material {
  fog: boolean;
  needsUpdate: boolean;
}

export interface MaterialWithTexture extends THREE.Material {
  map?: THREE.Texture | null;
  emissiveMap?: THREE.Texture | null;
  normalMap?: THREE.Texture | null;
  bumpMap?: THREE.Texture | null;
  roughnessMap?: THREE.Texture | null;
  metalnessMap?: THREE.Texture | null;
}

export interface MaterialWithShadow extends THREE.Material {
  shadowSide: THREE.Side;
}

/**
 * Options for creating materials
 */
export interface MaterialOptions {
  raw?: THREE.Material;
  unlit?: boolean;
  color?: string | number;
  metalness?: number;
  roughness?: number;
}

/**
 * Proxy interface for material properties
 */
export interface MaterialProxy {
  readonly id: string;
  textureX: number;
  textureY: number;
  color: string;
  emissiveIntensity: number;
  fog: boolean;
  readonly _ref?: unknown;
}

/**
 * Wrapper for material and its proxy
 */
export interface MaterialWrapper {
  raw: THREE.Material;
  proxy: MaterialProxy;
}

/**
 * Options for inserting geometry into the stage
 */
export interface InsertOptions {
  linked?: boolean;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
  node: unknown; // Node type from the node system
  matrix: THREE.Matrix4;
}

/**
 * Handle returned from stage insertions
 */
export interface StageHandle {
  material: MaterialProxy;
  move: (matrix: THREE.Matrix4) => void;
  destroy: () => void;
}

/**
 * Internal stage item representation
 */
export interface StageItem {
  matrix: THREE.Matrix4;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  getEntity: () => unknown;
  node: unknown;
}