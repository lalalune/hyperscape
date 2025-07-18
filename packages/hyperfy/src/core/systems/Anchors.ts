import type { World } from '../../types/index.js';
import { THREE } from '../extras/three.js';
// Using THREE namespace types
import { System } from './System.js';

/**
 * Anchor System
 *
 * - Runs on both the server and client.
 * - Keeps track of anchors for easy access by player entities
 *
 */
export class Anchors extends System {
  private matrices: Map<string, THREE.Matrix4Type>;

  constructor(world: World) {
    super(world);
    this.matrices = new Map();
  }

  get(id: string): THREE.Matrix4Type | undefined {
    return this.matrices.get(id);
  }

  add(id: string, matrix: THREE.Matrix4Type): void {
    this.matrices.set(id, matrix);
  }

  remove(id: string): void {
    this.matrices.delete(id);
  }

  override destroy(): void {
    this.matrices.clear();
  }
}
