/**
 * DistanceSolver - Simple distance-based skinning
 * Each vertex is 100% influenced by its closest bone
 */

import { AutoSkinSolver } from "./AutoSkinSolver";

export class DistanceSolver extends AutoSkinSolver {
  calculateWeights(): { skinIndices: number[]; skinWeights: number[] } {
    const skinIndices: number[] = [];
    const skinWeights: number[] = [];
    const vertexCount = this.getVertexCount();

    for (let i = 0; i < vertexCount; i++) {
      const vertexPos = this.getVertexPosition(i);
      let closestBoneIndex = 0;
      let closestDistance = Infinity;

      this.bones.forEach((bone, boneIndex) => {
        const bonePos = this.getBoneWorldPosition(bone);
        const distance = vertexPos.distanceTo(bonePos);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestBoneIndex = boneIndex;
        }
      });

      // Assign 100% weight to closest bone
      skinIndices.push(closestBoneIndex, 0, 0, 0);
      skinWeights.push(1.0, 0, 0, 0);
    }

    return { skinIndices, skinWeights };
  }
}
