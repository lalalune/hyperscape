import * as THREE from "three";
import {
  SkinnedMesh,
  Mesh,
  Skeleton,
  Vector3,
  BufferGeometry,
  BufferAttribute,
  Matrix4,
} from "three";

export interface WeightTransferOptions {
  method: "nearest" | "projected" | "inpainted";
  maxInfluences: number;
  smoothingIterations: number;
  normalThreshold: number; // For validating weight transfer
  distanceThreshold: number; // Max distance for weight transfer
}

export interface WeightTransferResult {
  success: boolean;
  transferredVertices: number;
  unreliableVertices: number;
  warnings: string[];
}

export class WeightTransferService {
  /**
   * Transfer skeleton weights from body to armor
   */
  transferWeights(
    bodyMesh: SkinnedMesh,
    armorMesh: Mesh,
    skeleton: Skeleton,
    options: Partial<WeightTransferOptions> = {},
  ): WeightTransferResult {
    const opts: WeightTransferOptions = {
      method: "inpainted",
      maxInfluences: 4,
      smoothingIterations: 3,
      normalThreshold: 0.5,
      distanceThreshold: 0.1,
      ...options,
    };

    const result: WeightTransferResult = {
      success: true,
      transferredVertices: 0,
      unreliableVertices: 0,
      warnings: [],
    };

    // Convert armor to skinned mesh if needed
    const armorSkinned = this.convertToSkinnedMesh(armorMesh, skeleton);

    // Get geometries
    const bodyGeometry = bodyMesh.geometry;
    const armorGeometry = armorSkinned.geometry;

    // Transfer weights based on method
    switch (opts.method) {
      case "nearest":
        this.transferWeightsNearest(
          bodyGeometry,
          armorGeometry,
          bodyMesh.matrixWorld,
          armorSkinned.matrixWorld,
          opts,
          result,
        );
        break;
      case "projected":
        this.transferWeightsProjected(
          bodyGeometry,
          armorGeometry,
          bodyMesh.matrixWorld,
          armorSkinned.matrixWorld,
          opts,
          result,
        );
        break;
      case "inpainted":
        this.transferWeightsInpainted(
          bodyGeometry,
          armorGeometry,
          bodyMesh.matrixWorld,
          armorSkinned.matrixWorld,
          opts,
          result,
        );
        break;
    }

    // Smooth weights
    if (opts.smoothingIterations > 0) {
      this.smoothWeights(armorGeometry, opts.smoothingIterations);
    }

    // Normalize weights
    this.normalizeWeights(armorGeometry);

    // Replace original mesh with skinned version
    if (armorMesh !== armorSkinned) {
      // Create a new SkinnedMesh to replace the regular Mesh
      const newSkinnedMesh = new SkinnedMesh(armorGeometry, armorMesh.material);
      newSkinnedMesh.skeleton = skeleton;
      newSkinnedMesh.bindMatrix.copy(new Matrix4());
      newSkinnedMesh.bindMatrixInverse.copy(new Matrix4());

      // Copy transform from original mesh
      newSkinnedMesh.position.copy(armorMesh.position);
      newSkinnedMesh.rotation.copy(armorMesh.rotation);
      newSkinnedMesh.scale.copy(armorMesh.scale);

      // Replace in parent
      if (armorMesh.parent) {
        const parent = armorMesh.parent;
        parent.remove(armorMesh);
        parent.add(newSkinnedMesh);
      }
    }

    return result;
  }

  /**
   * Convert regular mesh to skinned mesh
   */
  private convertToSkinnedMesh(mesh: Mesh, skeleton: Skeleton): SkinnedMesh {
    if (mesh instanceof SkinnedMesh) {
      return mesh;
    }

    const geometry = mesh.geometry.clone();

    // Add skinning attributes if missing
    if (!geometry.attributes.skinIndex) {
      const numVertices = geometry.attributes.position.count;
      const skinIndices = new Float32Array(numVertices * 4);
      const skinWeights = new Float32Array(numVertices * 4);

      // Initialize with zero weights
      for (let i = 0; i < numVertices; i++) {
        skinIndices[i * 4] = 0;
        skinWeights[i * 4] = 1.0;
      }

      geometry.setAttribute("skinIndex", new BufferAttribute(skinIndices, 4));
      geometry.setAttribute("skinWeight", new BufferAttribute(skinWeights, 4));
    }

    const skinnedMesh = new SkinnedMesh(geometry, mesh.material);
    skinnedMesh.skeleton = skeleton;
    skinnedMesh.position.copy(mesh.position);
    skinnedMesh.rotation.copy(mesh.rotation);
    skinnedMesh.scale.copy(mesh.scale);
    skinnedMesh.updateMatrix();

    return skinnedMesh;
  }

  /**
   * Transfer weights using nearest point method
   */
  private transferWeightsNearest(
    bodyGeometry: BufferGeometry,
    armorGeometry: BufferGeometry,
    bodyMatrix: Matrix4,
    armorMatrix: Matrix4,
    options: WeightTransferOptions,
    result: WeightTransferResult,
  ): void {
    const bodyPosition = bodyGeometry.attributes.position as BufferAttribute;
    const bodyNormal = bodyGeometry.attributes.normal as BufferAttribute;
    const bodySkinIndex = bodyGeometry.attributes.skinIndex as BufferAttribute;
    const bodySkinWeight = bodyGeometry.attributes
      .skinWeight as BufferAttribute;

    const armorPosition = armorGeometry.attributes.position as BufferAttribute;
    const armorNormal = armorGeometry.attributes.normal as BufferAttribute;
    const armorSkinIndex = armorGeometry.attributes
      .skinIndex as BufferAttribute;
    const armorSkinWeight = armorGeometry.attributes
      .skinWeight as BufferAttribute;

    const _armorInverseMatrix = armorMatrix.clone().invert();

    // For each armor vertex
    for (let i = 0; i < armorPosition.count; i++) {
      const armorVertex = new Vector3(
        armorPosition.getX(i),
        armorPosition.getY(i),
        armorPosition.getZ(i),
      );
      armorVertex.applyMatrix4(armorMatrix);

      const armorNormalVec = new Vector3(
        armorNormal.getX(i),
        armorNormal.getY(i),
        armorNormal.getZ(i),
      );
      armorNormalVec.transformDirection(armorMatrix).normalize();

      // Find nearest body vertex
      let minDistance = Infinity;
      let nearestIndex = -1;
      let bestNormalDot = 0;

      for (let j = 0; j < bodyPosition.count; j++) {
        const bodyVertex = new Vector3(
          bodyPosition.getX(j),
          bodyPosition.getY(j),
          bodyPosition.getZ(j),
        );
        bodyVertex.applyMatrix4(bodyMatrix);

        const distance = armorVertex.distanceTo(bodyVertex);

        if (distance < minDistance) {
          const bodyNormalVec = new Vector3(
            bodyNormal.getX(j),
            bodyNormal.getY(j),
            bodyNormal.getZ(j),
          );
          bodyNormalVec.transformDirection(bodyMatrix).normalize();

          const normalDot = armorNormalVec.dot(bodyNormalVec);

          minDistance = distance;
          nearestIndex = j;
          bestNormalDot = normalDot;
        }
      }

      // Transfer weights if within threshold
      if (nearestIndex !== -1 && minDistance < options.distanceThreshold) {
        // Copy weights
        for (let k = 0; k < 4; k++) {
          armorSkinIndex.setX(
            i * 4 + k,
            bodySkinIndex.getX(nearestIndex * 4 + k),
          );
          armorSkinWeight.setX(
            i * 4 + k,
            bodySkinWeight.getX(nearestIndex * 4 + k),
          );
        }

        result.transferredVertices++;

        // Mark as unreliable if normal mismatch
        if (bestNormalDot < options.normalThreshold) {
          result.unreliableVertices++;
        }
      } else {
        result.unreliableVertices++;
      }
    }

    armorSkinIndex.needsUpdate = true;
    armorSkinWeight.needsUpdate = true;
  }

  /**
   * Transfer weights using surface projection
   */
  private transferWeightsProjected(
    bodyGeometry: BufferGeometry,
    armorGeometry: BufferGeometry,
    bodyMatrix: Matrix4,
    armorMatrix: Matrix4,
    options: WeightTransferOptions,
    result: WeightTransferResult,
  ): void {
    // Similar to nearest but projects along normal
    const raycaster = new THREE.Raycaster();
    const bodyMeshTemp = new THREE.Mesh(bodyGeometry);
    bodyMeshTemp.matrixWorld = bodyMatrix;

    const armorPosition = armorGeometry.attributes.position as BufferAttribute;
    const armorNormal = armorGeometry.attributes.normal as BufferAttribute;
    const armorSkinIndex = armorGeometry.attributes
      .skinIndex as BufferAttribute;
    const armorSkinWeight = armorGeometry.attributes
      .skinWeight as BufferAttribute;

    const bodySkinIndex = bodyGeometry.attributes.skinIndex as BufferAttribute;
    const bodySkinWeight = bodyGeometry.attributes
      .skinWeight as BufferAttribute;

    for (let i = 0; i < armorPosition.count; i++) {
      const armorVertex = new Vector3(
        armorPosition.getX(i),
        armorPosition.getY(i),
        armorPosition.getZ(i),
      );
      armorVertex.applyMatrix4(armorMatrix);

      const armorNormalVec = new Vector3(
        armorNormal.getX(i),
        armorNormal.getY(i),
        armorNormal.getZ(i),
      );
      armorNormalVec.transformDirection(armorMatrix).normalize();

      // Cast ray inward
      raycaster.set(armorVertex, armorNormalVec.clone().negate());
      const intersects = raycaster.intersectObject(bodyMeshTemp, false);

      if (
        intersects.length > 0 &&
        intersects[0].distance < options.distanceThreshold
      ) {
        const face = intersects[0].face!;
        const faceIndices = [face.a, face.b, face.c];

        // Barycentric interpolation of weights
        const barycoord = intersects[0].uv!;
        const w1 = barycoord.x;
        const w2 = barycoord.y;
        const w3 = 1 - w1 - w2;
        const weights = [w1, w2, w3];

        // Interpolate skin weights
        for (let k = 0; k < 4; k++) {
          let interpolatedIndex = 0;
          let interpolatedWeight = 0;

          for (let v = 0; v < 3; v++) {
            const vertexIndex = faceIndices[v];
            interpolatedIndex +=
              weights[v] * bodySkinIndex.getX(vertexIndex * 4 + k);
            interpolatedWeight +=
              weights[v] * bodySkinWeight.getX(vertexIndex * 4 + k);
          }

          armorSkinIndex.setX(i * 4 + k, Math.round(interpolatedIndex));
          armorSkinWeight.setX(i * 4 + k, interpolatedWeight);
        }

        result.transferredVertices++;
      } else {
        result.unreliableVertices++;
      }
    }

    armorSkinIndex.needsUpdate = true;
    armorSkinWeight.needsUpdate = true;
  }

  /**
   * Transfer weights using inpainting method
   */
  private transferWeightsInpainted(
    bodyGeometry: BufferGeometry,
    armorGeometry: BufferGeometry,
    bodyMatrix: Matrix4,
    armorMatrix: Matrix4,
    options: WeightTransferOptions,
    result: WeightTransferResult,
  ): void {
    // First pass: transfer reliable weights
    this.transferWeightsProjected(
      bodyGeometry,
      armorGeometry,
      bodyMatrix,
      armorMatrix,
      options,
      result,
    );

    // Build list of reliable and unreliable vertices
    const reliableVertices = new Set<number>();
    const unreliableVertices = new Set<number>();

    const armorPosition = armorGeometry.attributes.position as BufferAttribute;
    const armorSkinWeight = armorGeometry.attributes
      .skinWeight as BufferAttribute;

    for (let i = 0; i < armorPosition.count; i++) {
      const weight = armorSkinWeight.getX(i * 4);
      if (weight > 0) {
        reliableVertices.add(i);
      } else {
        unreliableVertices.add(i);
      }
    }

    // Inpaint unreliable weights using Laplacian smoothing
    const neighbors = this.buildVertexNeighbors(armorGeometry);

    // Iteratively fill in unreliable weights
    for (let iter = 0; iter < 10; iter++) {
      const toUpdate: Map<number, number[]> = new Map();

      unreliableVertices.forEach((vi) => {
        const viNeighbors = neighbors.get(vi) || [];
        const reliableNeighbors = viNeighbors.filter((n) =>
          reliableVertices.has(n),
        );

        if (reliableNeighbors.length > 0) {
          // Average weights from reliable neighbors
          const avgWeights = new Array(16).fill(0); // 4 bones * 4 attributes

          reliableNeighbors.forEach((ni) => {
            for (let k = 0; k < 4; k++) {
              avgWeights[k * 2] += armorGeometry.attributes.skinIndex.getX(
                ni * 4 + k,
              );
              avgWeights[k * 2 + 1] += armorGeometry.attributes.skinWeight.getX(
                ni * 4 + k,
              );
            }
          });

          // Normalize
          for (let k = 0; k < avgWeights.length; k++) {
            avgWeights[k] /= reliableNeighbors.length;
          }

          toUpdate.set(vi, avgWeights);
        }
      });

      // Apply updates
      toUpdate.forEach((weights, vi) => {
        for (let k = 0; k < 4; k++) {
          armorGeometry.attributes.skinIndex.setX(
            vi * 4 + k,
            Math.round(weights[k * 2]),
          );
          armorGeometry.attributes.skinWeight.setX(
            vi * 4 + k,
            weights[k * 2 + 1],
          );
        }

        unreliableVertices.delete(vi);
        reliableVertices.add(vi);
        result.transferredVertices++;
        result.unreliableVertices--;
      });

      if (toUpdate.size === 0) break;
    }

    armorGeometry.attributes.skinIndex.needsUpdate = true;
    armorGeometry.attributes.skinWeight.needsUpdate = true;
  }

  /**
   * Smooth skin weights
   */
  private smoothWeights(geometry: BufferGeometry, iterations: number): void {
    const neighbors = this.buildVertexNeighbors(geometry);
    const skinWeight = geometry.attributes.skinWeight as BufferAttribute;
    const skinIndex = geometry.attributes.skinIndex as BufferAttribute;

    for (let iter = 0; iter < iterations; iter++) {
      const newWeights: number[] = [];

      for (let i = 0; i < skinWeight.count / 4; i++) {
        const viNeighbors = neighbors.get(i) || [];

        if (viNeighbors.length === 0) {
          // Keep original weights
          for (let k = 0; k < 4; k++) {
            newWeights.push(skinIndex.getX(i * 4 + k));
            newWeights.push(skinWeight.getX(i * 4 + k));
          }
          continue;
        }

        // Collect all bone influences from neighbors
        const boneWeights = new Map<number, number>();

        // Add current vertex weights
        for (let k = 0; k < 4; k++) {
          const boneIndex = skinIndex.getX(i * 4 + k);
          const weight = skinWeight.getX(i * 4 + k);
          if (weight > 0) {
            boneWeights.set(
              boneIndex,
              (boneWeights.get(boneIndex) || 0) + weight,
            );
          }
        }

        // Add neighbor weights
        viNeighbors.forEach((ni) => {
          for (let k = 0; k < 4; k++) {
            const boneIndex = skinIndex.getX(ni * 4 + k);
            const weight = skinWeight.getX(ni * 4 + k);
            if (weight > 0) {
              boneWeights.set(
                boneIndex,
                (boneWeights.get(boneIndex) || 0) + weight * 0.5,
              );
            }
          }
        });

        // Sort by weight and keep top 4
        const sortedBones = Array.from(boneWeights.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4);

        // Normalize weights
        const totalWeight = sortedBones.reduce((sum, [_, w]) => sum + w, 0);

        // Store new weights
        for (let k = 0; k < 4; k++) {
          if (k < sortedBones.length) {
            newWeights.push(sortedBones[k][0]);
            newWeights.push(sortedBones[k][1] / totalWeight);
          } else {
            newWeights.push(0);
            newWeights.push(0);
          }
        }
      }

      // Apply new weights
      for (let i = 0; i < skinWeight.count; i++) {
        if (i % 4 < 4) {
          const baseIdx = Math.floor(i / 4) * 8 + (i % 4) * 2;
          skinIndex.setX(i, newWeights[baseIdx]);
          skinWeight.setX(i, newWeights[baseIdx + 1]);
        }
      }
    }

    skinIndex.needsUpdate = true;
    skinWeight.needsUpdate = true;
  }

  /**
   * Normalize skin weights
   */
  private normalizeWeights(geometry: BufferGeometry): void {
    const skinWeight = geometry.attributes.skinWeight as BufferAttribute;

    for (let i = 0; i < skinWeight.count / 4; i++) {
      let totalWeight = 0;

      // Sum weights
      for (let k = 0; k < 4; k++) {
        totalWeight += skinWeight.getX(i * 4 + k);
      }

      // Normalize
      if (totalWeight > 0) {
        for (let k = 0; k < 4; k++) {
          const normalized = skinWeight.getX(i * 4 + k) / totalWeight;
          skinWeight.setX(i * 4 + k, normalized);
        }
      } else {
        // No weights - assign to root bone
        skinWeight.setX(i * 4, 1.0);
      }
    }

    skinWeight.needsUpdate = true;
  }

  /**
   * Build vertex neighbor map
   */
  private buildVertexNeighbors(
    geometry: BufferGeometry,
  ): Map<number, number[]> {
    const neighbors = new Map<number, Set<number>>();
    const index = geometry.index;

    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i);
        const b = index.getX(i + 1);
        const c = index.getX(i + 2);

        if (!neighbors.has(a)) neighbors.set(a, new Set());
        if (!neighbors.has(b)) neighbors.set(b, new Set());
        if (!neighbors.has(c)) neighbors.set(c, new Set());

        neighbors.get(a)!.add(b).add(c);
        neighbors.get(b)!.add(a).add(c);
        neighbors.get(c)!.add(a).add(b);
      }
    }

    const result = new Map<number, number[]>();
    neighbors.forEach((set, key) => {
      result.set(key, Array.from(set));
    });

    return result;
  }
}
