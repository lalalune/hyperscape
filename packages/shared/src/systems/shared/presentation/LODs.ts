import { System } from "../infrastructure/System";
import type { World } from "../../../types";
import type { LODNode } from "../../../types/rendering/nodes";

const BATCH_SIZE = 1000;

/**
 * LOD System
 *
 * - Runs on both the server and client.
 * - Uses a cursor to iterate and switch a maximum of X lods per frame
 *
 */

// LODNode is used across systems; export a shared version from types if needed
// Use shared LODNode type from types/nodes.ts

export class LODs extends System {
  private nodes: LODNode[];
  private cursor: number;

  constructor(world: World) {
    super(world);
    this.nodes = [];
    this.cursor = 0;
  }

  register(node: LODNode): void {
    this.nodes.push(node);
  }

  unregister(node: LODNode): void {
    const idx = this.nodes.indexOf(node);
    if (idx === -1) return;
    this.nodes.splice(idx, 1);

    // Adjust cursor if necessary to prevent out of bounds
    if (this.cursor >= this.nodes.length && this.nodes.length > 0) {
      this.cursor = this.cursor % this.nodes.length;
    }
  }

  override update(_delta: number): void {
    if (this.nodes.length === 0) return;

    // check if lods need to switch (batched over multiple frames)
    const size = Math.min(this.nodes.length, BATCH_SIZE);
    for (let i = 0; i < size; i++) {
      const idx = (this.cursor + i) % this.nodes.length;
      const node = this.nodes[idx];
      if (!node) continue;
      node.check();
    }

    if (size) {
      this.cursor = (this.cursor + size) % this.nodes.length;
    }
  }

  override destroy(): void {
    this.nodes = [];
  }
}
