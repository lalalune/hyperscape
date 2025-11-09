/**
 * DistanceChildTargetingSolver - Advanced skinning with parent-aware weighting
 * Based on Mesh2Motion's SolverDistanceChildTargeting
 *
 * Features:
 * - Assigns vertices to closest bone
 * - Reassigns to parent bone if direction suggests parent influence
 * - Special handling for hips region
 * - Boundary smoothing between bone influences
 */

import * as THREE from "three";
import { AutoSkinSolver } from "./AutoSkinSolver";

export class DistanceChildTargetingSolver extends AutoSkinSolver {
  private cachedMedianPositions: THREE.Vector3[] = [];

  calculateWeights(): { skinIndices: number[]; skinWeights: number[] } {
    const vertexCount = this.getVertexCount();
    const skinIndices: number[] = [];
    const skinWeights: number[] = [];

    // Cache median bone positions (midpoint between bone and first child)
    this.cachedMedianPositions = this.bones.map((bone) =>
      this.getMedianBonePosition(bone),
    );

    // First pass: assign each vertex to closest bone using median positions
    const assignments: number[] = new Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      const vertexPos = this.getVertexPosition(i);
      let closestBoneIndex = 0;
      let closestDistance = Infinity;

      this.bones.forEach((bone, boneIndex) => {
        const distance = vertexPos.distanceTo(
          this.cachedMedianPositions[boneIndex],
        );
        if (distance < closestDistance) {
          closestDistance = distance;
          closestBoneIndex = boneIndex;
        }
      });

      assignments[i] = closestBoneIndex;
      skinIndices.push(closestBoneIndex, 0, 0, 0);
      skinWeights.push(1.0, 0, 0, 0);
    }

    // Second pass: parent-aware reassignment
    // If a vertex points toward the parent bone more than current bone, reassign to parent
    this.reassignToParentBones(assignments, skinIndices, skinWeights);

    // Third pass: smooth boundaries between different bone influences
    this.smoothBoundaries(skinIndices, skinWeights);

    return { skinIndices, skinWeights };
  }

  private getMedianBonePosition(bone: THREE.Bone): THREE.Vector3 {
    const bonePos = this.getBoneWorldPosition(bone);
    if (bone.children.length === 0) {
      return bonePos.clone();
    }
    // Use midpoint between bone and first child
    const childBone = bone.children[0] as THREE.Bone;
    const childPos = this.getBoneWorldPosition(childBone);
    return new THREE.Vector3().lerpVectors(bonePos, childPos, 0.5);
  }

  private reassignToParentBones(
    assignments: number[],
    skinIndices: number[],
    skinWeights: number[],
  ): void {
    const vertexCount = this.getVertexCount();

    for (let i = 0; i < vertexCount; i++) {
      const vertexPos = this.getVertexPosition(i);
      const currentBoneIndex = assignments[i];
      const currentBone = this.bones[currentBoneIndex];

      // Skip if bone has no parent
      if (!currentBone.parent || !(currentBone.parent instanceof THREE.Bone)) {
        continue;
      }

      const parentBone = currentBone.parent as THREE.Bone;
      const parentBoneIndex = this.bones.indexOf(parentBone);
      if (parentBoneIndex === -1) continue;

      // Calculate direction vectors
      const currentBonePos = this.cachedMedianPositions[currentBoneIndex];
      const parentBonePos = this.cachedMedianPositions[parentBoneIndex];

      const dirToCurrent = new THREE.Vector3()
        .subVectors(vertexPos, currentBonePos)
        .normalize();
      const dirToParent = new THREE.Vector3()
        .subVectors(vertexPos, parentBonePos)
        .normalize();

      // Dot product: if < 0, vectors point in similar direction → vertex is "behind" current bone
      const similarity = dirToCurrent.dot(dirToParent);

      if (similarity < 0.0) {
        // Reassign to parent
        assignments[i] = parentBoneIndex;
        skinIndices[i * 4] = parentBoneIndex;
      }
    }
  }

  private smoothBoundaries(skinIndices: number[], skinWeights: number[]): void {
    const vertexCount = this.getVertexCount();
    const adjacency = this.buildVertexAdjacency();
    const visited = new Set<string>();

    // Build position-to-indices map for finding shared vertices
    const positionMap = new Map<string, number[]>();
    for (let i = 0; i < vertexCount; i++) {
      const pos = this.getVertexPosition(i);
      const key = `${pos.x.toFixed(6)},${pos.y.toFixed(6)},${pos.z.toFixed(6)}`;
      if (!positionMap.has(key)) positionMap.set(key, []);
      positionMap.get(key)!.push(i);
    }

    // Smooth boundaries where adjacent vertices have different bones
    for (let i = 0; i < vertexCount; i++) {
      const offsetA = i * 4;
      const boneA = skinIndices[offsetA];
      const weightA = skinWeights[offsetA];

      // Only process vertices with 100% weight to one bone
      if (weightA !== 1.0) continue;

      for (const j of adjacency[i]) {
        const offsetB = j * 4;
        const boneB = skinIndices[offsetB];
        const weightB = skinWeights[offsetB];

        // Skip if same bone or already blended
        if (boneA === boneB || weightB !== 1.0) continue;

        const key = i < j ? `${i},${j}` : `${j},${i}`;
        if (visited.has(key)) continue;
        visited.add(key);

        // Find shared vertices
        const posA = this.getVertexPosition(i);
        const keyA = `${posA.x.toFixed(6)},${posA.y.toFixed(6)},${posA.z.toFixed(6)}`;
        const sharedA = positionMap.get(keyA) || [i];

        const posB = this.getVertexPosition(j);
        const keyB = `${posB.x.toFixed(6)},${posB.y.toFixed(6)},${posB.z.toFixed(6)}`;
        const sharedB = positionMap.get(keyB) || [j];

        // Blend all shared vertices 50/50
        for (const idx of sharedA) {
          const off = idx * 4;
          skinIndices[off] = boneA;
          skinIndices[off + 1] = boneB;
          skinWeights[off] = 0.5;
          skinWeights[off + 1] = 0.5;
          skinIndices[off + 2] = 0;
          skinIndices[off + 3] = 0;
          skinWeights[off + 2] = 0;
          skinWeights[off + 3] = 0;
        }

        for (const idx of sharedB) {
          const off = idx * 4;
          skinIndices[off] = boneB;
          skinIndices[off + 1] = boneA;
          skinWeights[off] = 0.5;
          skinWeights[off + 1] = 0.5;
          skinIndices[off + 2] = 0;
          skinIndices[off + 3] = 0;
          skinWeights[off + 2] = 0;
          skinWeights[off + 3] = 0;
        }
      }
    }
  }

  private buildVertexAdjacency(): Array<Set<number>> {
    const vertexCount = this.getVertexCount();
    const adjacency: Array<Set<number>> = Array.from(
      { length: vertexCount },
      () => new Set(),
    );

    const index = this.geometry.index;
    if (!index) return adjacency;

    const indices = index.array;
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i];
      const b = indices[i + 1];
      const c = indices[i + 2];

      adjacency[a].add(b);
      adjacency[a].add(c);
      adjacency[b].add(a);
      adjacency[b].add(c);
      adjacency[c].add(a);
      adjacency[c].add(b);
    }

    return adjacency;
  }
}
