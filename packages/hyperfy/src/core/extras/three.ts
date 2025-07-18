import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import * as THREE from 'three';
import * as SkeletonUtilsImport from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Vector3Enhanced } from './Vector3Enhanced';

// Extend BufferGeometry prototype with three-mesh-bvh methods
(THREE as any).BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
(THREE as any).BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

// Override raycast with accelerated version
(THREE as any).Mesh.prototype.raycast = acceleratedRaycast;

// Add custom resize method to InstancedMesh
(THREE as any).InstancedMesh.prototype.resize = function (size: number) {
  const prevSize = this.instanceMatrix.array.length / 16;
  if (size <= prevSize) {
    return;
  }
  const array = new Float32Array(size * 16);
  array.set(this.instanceMatrix.array);
  this.instanceMatrix = new (THREE as any).InstancedBufferAttribute(array, 16);
  this.instanceMatrix.needsUpdate = true;
};

// Re-export everything from three
export * from 'three';

// Override Vector3 with enhanced version
export { Vector3Enhanced as Vector3 } from './Vector3Enhanced';

// Export SkeletonUtils
export const SkeletonUtils = SkeletonUtilsImport;

// Create and export the enhanced THREE namespace
const THREE_ENHANCED = Object.assign({}, THREE, {
  Vector3: Vector3Enhanced,
  SkeletonUtils: SkeletonUtilsImport
});

export default THREE_ENHANCED;

// Also export as THREE for compatibility
export { THREE_ENHANCED as THREE };
