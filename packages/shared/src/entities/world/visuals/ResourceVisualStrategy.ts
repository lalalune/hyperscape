/**
 * ResourceVisualStrategy — interface, context, and factory for resource visuals.
 *
 * Each resource type (tree, rock, fishing spot, …) gets its own strategy that
 * handles mesh creation, LOD, animation, depletion visuals, and cleanup.
 * ResourceEntity delegates all visual concerns through this interface so it
 * never checks `resourceType` for rendering decisions.
 */

import type THREE from "../../../extras/three/three";
import type { World } from "../../../core/World";
import type { ResourceEntityConfig } from "../../../types/entities";

// ---------------------------------------------------------------------------
// Context — controlled access to entity state (no circular dependency)
// ---------------------------------------------------------------------------

export interface ResourceVisualContext {
  readonly world: World;
  readonly config: ResourceEntityConfig;
  readonly id: string;
  readonly node: THREE.Object3D;
  readonly position: { x: number; y: number; z: number };

  getMesh(): THREE.Object3D | null;
  setMesh(mesh: THREE.Object3D | null): void;

  getLod1Mesh(): THREE.Object3D | undefined;
  setLod1Mesh(mesh: THREE.Object3D | undefined): void;

  getLod2Mesh(): THREE.Object3D | undefined;
  setLod2Mesh(mesh: THREE.Object3D | undefined): void;

  hashString(input: string): number;

  /** Proxy to Entity.initHLOD for impostor support */
  initHLOD(
    modelId: string,
    options: { category: string; atlasSize: number; hemisphere: boolean },
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Strategy interface
// ---------------------------------------------------------------------------

export interface ResourceVisualStrategy {
  createVisual(ctx: ResourceVisualContext): Promise<void>;
  /**
   * @returns true if the strategy handled depletion visuals (instanced stump),
   *          false if ResourceEntity should load an individual depleted model.
   */
  onDepleted(ctx: ResourceVisualContext): Promise<boolean>;
  onRespawn(ctx: ResourceVisualContext): Promise<void>;
  update(ctx: ResourceVisualContext, deltaTime: number): void;
  destroy(ctx: ResourceVisualContext): void;

  /** Return a temporary mesh positioned at this instance for the outline pass. */
  getHighlightMesh?(ctx: ResourceVisualContext): THREE.Object3D | null;
}
