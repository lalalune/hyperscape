import type { World } from "../../../core/World";
import THREE from "../../../extras/three/three";
import { System } from "../infrastructure/System";

/**
 * Anchor System
 *
 * - Runs on both the server and client.
 * - Keeps track of anchors for easy access by player entities
 *
 */
export class Anchors extends System {
  private matrices: Map<string, THREE.Matrix4>;

  constructor(world: World) {
    super(world);
    this.matrices = new Map();
  }

  get(id: string): THREE.Matrix4 | undefined {
    return this.matrices.get(id);
  }

  add(id: string, matrix: THREE.Matrix4): void {
    this.matrices.set(id, matrix);
  }

  remove(id: string): void {
    this.matrices.delete(id);
  }

  override destroy(): void {
    this.matrices.clear();
  }
}
