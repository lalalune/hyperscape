import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'
import * as THREE from 'three'

// override THREE.Vector3 with ours to support _onChange
import { Vector3Enhanced } from './Vector3Enhanced'

// Re-export THREE namespace and all named exports
export * from 'three'
export { THREE }

// Override Vector3 export
export { Vector3Enhanced as Vector3 }

// Explicit exports for commonly used types to fix TypeScript issues
export {
  Mesh, BufferGeometry, Material, Texture, Object3D, Scene, Camera, 
  PerspectiveCamera, OrthographicCamera, WebGLRenderer, Color, 
  Quaternion, Matrix4, Euler, Box3, BufferAttribute, MathUtils,
  AnimationMixer, AnimationAction, Skeleton, SkinnedMesh, CapsuleGeometry,
  BoxGeometry, SphereGeometry, PlaneGeometry, MeshBasicMaterial,
  MeshLambertMaterial, MeshStandardMaterial, DetachedBindMode, BackSide,
  LoopRepeat, LoopOnce, InstancedBufferAttribute
} from 'three'

// Module augmentation for three
declare module 'three' {
  interface InstancedMesh {
    resize(size: number): void
  }
}

// install three-mesh-bvh
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

// utility to resize instanced mesh buffers
THREE.InstancedMesh.prototype.resize = function (size: number) {
  const prevSize = this.instanceMatrix.array.length / 16
  if (size <= prevSize) return
  const array = new Float32Array(size * 16)
  array.set(this.instanceMatrix.array)
  this.instanceMatrix = new THREE.InstancedBufferAttribute(array, 16)
  this.instanceMatrix.needsUpdate = true
}
