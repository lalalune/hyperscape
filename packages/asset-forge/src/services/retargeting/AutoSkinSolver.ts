/**
 * AutoSkinSolver - Base class for automatic skinning algorithms
 * Computes skin weights (vertex-to-bone influences) for binding a mesh to a skeleton
 */

import * as THREE from "three";

export abstract class AutoSkinSolver {
  protected geometry: THREE.BufferGeometry;
  protected bones: THREE.Bone[];

  constructor(geometry: THREE.BufferGeometry, bones: THREE.Bone[]) {
    this.geometry = geometry;
    this.bones = bones;
  }

  /**
   * Calculate skin indices and weights for all vertices
   * Returns [skinIndices, skinWeights] arrays suitable for BufferAttributes
   */
  abstract calculateWeights(): { skinIndices: number[]; skinWeights: number[] };

  protected getVertexCount(): number {
    return this.geometry.attributes.position.count;
  }

  protected getVertexPosition(index: number): THREE.Vector3 {
    return new THREE.Vector3().fromBufferAttribute(
      this.geometry.attributes.position,
      index,
    );
  }

  protected getBoneWorldPosition(bone: THREE.Bone): THREE.Vector3 {
    const pos = new THREE.Vector3();
    bone.getWorldPosition(pos);
    return pos;
  }

  /**
   * Normalize weights so they sum to 1.0
   */
  protected normalizeWeights(weights: number[][]): void {
    for (let i = 0; i < weights.length; i++) {
      const sum = weights[i].reduce((a, b) => a + b, 0);
      if (sum > 0) {
        weights[i] = weights[i].map((w) => w / sum);
      }
    }
  }
}
