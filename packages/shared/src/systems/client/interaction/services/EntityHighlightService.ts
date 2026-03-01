/**
 * EntityHighlightService
 *
 * Manages RS3-style entity outline highlighting on mouse hover.
 * Maps entity types to highlight colors and drives the post-processing
 * outline pass via the PostProcessingComposer.
 *
 * Color scheme (RS3 defaults):
 * - Yellow: Friendly NPCs
 * - Red: Attackable/hostile mobs
 * - Cyan: Interactable objects, resources, stations
 * - White: Loot (items, corpses, headstones), other players
 */

import * as THREE from "three";
import type { World } from "../../../../core/World";
import type { PostProcessingComposer } from "../../../../utils/rendering/PostProcessingFactory";
import type { RaycastTarget, InteractableEntityType } from "../types";

// Pre-allocated color objects to avoid per-hover allocations
const HIGHLIGHT_COLORS: Record<string, THREE.Color> = {
  // Friendly NPCs — yellow
  npc: new THREE.Color(0xffff00),

  // Attackable/hostile mobs — red
  mob: new THREE.Color(0xff0000),

  // Other players — white
  player: new THREE.Color(0xffffff),

  // Loot — white
  item: new THREE.Color(0xffffff),
  corpse: new THREE.Color(0xffffff),
  headstone: new THREE.Color(0xffffff),

  // Interactable objects — cyan
  resource: new THREE.Color(0x00ffff),
  bank: new THREE.Color(0x00ffff),
  furnace: new THREE.Color(0x00ffff),
  anvil: new THREE.Color(0x00ffff),
  altar: new THREE.Color(0x00ffff),
  runecrafting_altar: new THREE.Color(0x00ffff),
  fire: new THREE.Color(0x00ffff),
  range: new THREE.Color(0x00ffff),
  starter_chest: new THREE.Color(0x00ffff),
  forfeit_pillar: new THREE.Color(0x00ffff),
};

const DEFAULT_COLOR = new THREE.Color(0xffffff);

// Reusable array to avoid allocations when collecting meshes
const _meshBuffer: THREE.Object3D[] = [];

export class EntityHighlightService {
  private currentTargetId: string | null = null;
  private composer: PostProcessingComposer | null = null;
  /** Temporary highlight mesh added to the scene for instanced entities */
  private activeHighlightMesh: THREE.Object3D | null = null;

  constructor(private world: World) {}

  /**
   * Set the composer reference (called when graphics initializes)
   */
  setComposer(composer: PostProcessingComposer | null): void {
    this.composer = composer;
  }

  /**
   * Get the highlight color for a given entity type
   */
  getHighlightColor(entityType: InteractableEntityType): THREE.Color {
    return HIGHLIGHT_COLORS[entityType] ?? DEFAULT_COLOR;
  }

  /**
   * Update the hover target. Pass null to clear.
   * Only updates the outline pass when the target changes.
   */
  setHoverTarget(target: RaycastTarget | null): void {
    const newId = target?.entityId ?? null;
    if (newId === this.currentTargetId) return;

    this.removeActiveHighlightMesh();
    this.currentTargetId = newId;

    if (!this.composer) return;

    if (!target || !target.entity) {
      this.composer.setOutlineObjects([]);
      return;
    }

    // Try instanced highlight path first
    const entity = target.entity as unknown as Record<string, unknown>;
    if (typeof entity.getHighlightRoot === "function") {
      const hlRoot = (entity.getHighlightRoot as () => THREE.Object3D | null)();
      if (hlRoot) {
        this.world.stage?.scene?.add?.(hlRoot);
        this.activeHighlightMesh = hlRoot;
        const meshes = this.collectMeshes(hlRoot);
        if (meshes.length > 0) {
          const color = this.getHighlightColor(target.entityType);
          this.composer.setOutlineColor(color);
          this.composer.setOutlineObjects(meshes);
          return;
        }
      }
    }

    // Fallback: use entity's own scene-graph mesh
    const mesh = target.entity.mesh;
    const node = target.entity.node;
    const root = mesh ?? node;
    if (!root) {
      this.composer.setOutlineObjects([]);
      return;
    }

    const meshes = this.collectMeshes(root);
    if (meshes.length === 0) {
      this.composer.setOutlineObjects([]);
      return;
    }

    const color = this.getHighlightColor(target.entityType);
    this.composer.setOutlineColor(color);
    this.composer.setOutlineObjects(meshes);
  }

  /**
   * Clear the current hover highlight
   */
  clearHover(): void {
    if (this.currentTargetId === null) return;
    this.currentTargetId = null;
    this.removeActiveHighlightMesh();
    if (this.composer) {
      this.composer.setOutlineObjects([]);
    }
  }

  private removeActiveHighlightMesh(): void {
    if (this.activeHighlightMesh) {
      this.world.stage?.scene?.remove?.(this.activeHighlightMesh);
      this.activeHighlightMesh = null;
    }
  }

  /**
   * Collect all Mesh objects from an entity's scene graph node.
   * Uses the visual mesh (not raycast proxies) for accurate outlines.
   */
  private collectMeshes(root: THREE.Object3D): THREE.Object3D[] {
    _meshBuffer.length = 0;

    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        _meshBuffer.push(child);
      }
    });

    // If no child meshes found, use the root itself (e.g. simple geometry)
    if (_meshBuffer.length === 0 && root instanceof THREE.Mesh) {
      _meshBuffer.push(root);
    }

    return _meshBuffer;
  }
}
