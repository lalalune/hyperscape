import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'

import * as THREE from 'three'

// Re-export everything from three
export * from 'three'

// Also export THREE namespace for backward compatibility
export { THREE }

// override THREE.Vector3 with ours to support _onChange
import { Vector3Enhanced } from './Vector3Enhanced'
export { Vector3Enhanced as Vector3 }

// Extend THREE types to include our custom methods
declare module 'three' {
  interface InstancedMesh {
    resize(size: number): void
  }
}

// Declare global THREE namespace extensions
declare global {
  namespace THREE {
    interface Raycaster {
      firstHitOnly?: boolean
    }
    
    // Extend Vector3 to include the missing methods
    interface Vector3 {
      lengthManhattan(): number
      distanceToManhattan(v: Vector3): number
    }
  }
}

// install three-mesh-bvh
;(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree
;(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree
;(THREE.Mesh.prototype as any).raycast = acceleratedRaycast

// utility to resize instanced mesh buffers
THREE.InstancedMesh.prototype.resize = function (size: number) {
  const prevSize = this.instanceMatrix.array.length / 16
  if (size <= prevSize) return
  const array = new Float32Array(size * 16)
  array.set(this.instanceMatrix.array)
  this.instanceMatrix = new THREE.InstancedBufferAttribute(array, 16)
  this.instanceMatrix.needsUpdate = true
}
