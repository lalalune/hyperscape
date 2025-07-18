import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import * as THREE_ORIGINAL from 'three';
import * as SkeletonUtilsImport from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Vector3Enhanced } from './Vector3Enhanced';

// Install three-mesh-bvh - skip if classes not available
try {
  if ((THREE_ORIGINAL as any).BufferGeometry) {
    ;(THREE_ORIGINAL as any).BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
    ;(THREE_ORIGINAL as any).BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  }
  if ((THREE_ORIGINAL as any).Mesh) {
    ;(THREE_ORIGINAL as any).Mesh.prototype.raycast = acceleratedRaycast;
  }

  // Add custom resize method to InstancedMesh
  if ((THREE_ORIGINAL as any).InstancedMesh && (THREE_ORIGINAL as any).InstancedBufferAttribute) {
    ;(THREE_ORIGINAL as any).InstancedMesh.prototype.resize = function (size: number) {
      const prevSize = this.instanceMatrix.array.length / 16;
      if (size <= prevSize) {
        return;
      }
      const array = new Float32Array(size * 16);
      array.set(this.instanceMatrix.array);
      this.instanceMatrix = new (THREE_ORIGINAL as any).InstancedBufferAttribute(array, 16);
      this.instanceMatrix.needsUpdate = true;
    };
  }
} catch (e) {
  console.warn('Failed to install three-mesh-bvh extensions:', e);
}

// Create enhanced THREE namespace with Vector3Enhanced
const THREE_ENHANCED = {
  ...THREE_ORIGINAL,
  Vector3: Vector3Enhanced,
};

// Re-export everything from three to preserve types
export * from 'three';

// Override Vector3 export with enhanced version
export { Vector3Enhanced } from './Vector3Enhanced';

// Also export as runtime values to prevent type-only inference
export { Vector3Enhanced as Vector3 } from './Vector3Enhanced';
export const Quaternion = (THREE_ORIGINAL as any).Quaternion;
export const Euler = (THREE_ORIGINAL as any).Euler;
export const Object3D = (THREE_ORIGINAL as any).Object3D;
export const Mesh = (THREE_ORIGINAL as any).Mesh;
export const SphereGeometry = (THREE_ORIGINAL as any).SphereGeometry;
export const MeshBasicMaterial = (THREE_ORIGINAL as any).MeshBasicMaterial;
export const Color = (THREE_ORIGINAL as any).Color;
export const Fog = (THREE_ORIGINAL as any).Fog;
export const Scene = (THREE_ORIGINAL as any).Scene;
export const Group = (THREE_ORIGINAL as any).Group;
export const Camera = (THREE_ORIGINAL as any).Camera;
export const WebGLRenderer = (THREE_ORIGINAL as any).WebGLRenderer;
export const TextureLoader = (THREE_ORIGINAL as any).TextureLoader;
export const InstancedMesh = (THREE_ORIGINAL as any).InstancedMesh;
export const InstancedBufferAttribute = (THREE_ORIGINAL as any).InstancedBufferAttribute;
export const Raycaster = (THREE_ORIGINAL as any).Raycaster;
export const Layers = (THREE_ORIGINAL as any).Layers;
export const Matrix4 = (THREE_ORIGINAL as any).Matrix4;
export const Material = (THREE_ORIGINAL as any).Material;
export const Texture = (THREE_ORIGINAL as any).Texture;
export const BufferGeometry = (THREE_ORIGINAL as any).BufferGeometry;
export const PlaneGeometry = (THREE_ORIGINAL as any).PlaneGeometry;
export const BoxGeometry = (THREE_ORIGINAL as any).BoxGeometry;
export const MeshStandardMaterial = (THREE_ORIGINAL as any).MeshStandardMaterial;
export const PerspectiveCamera = (THREE_ORIGINAL as any).PerspectiveCamera;
export const CanvasTexture = (THREE_ORIGINAL as any).CanvasTexture;
export const DataTexture = (THREE_ORIGINAL as any).DataTexture;
export const VideoTexture = (THREE_ORIGINAL as any).VideoTexture;
export const LinearFilter = (THREE_ORIGINAL as any).LinearFilter;
export const LinearSRGBColorSpace = (THREE_ORIGINAL as any).LinearSRGBColorSpace;
export const SRGBColorSpace = (THREE_ORIGINAL as any).SRGBColorSpace;

// Create the THREE namespace object directly
export const THREE = {
  // Spread all original THREE exports
  ...THREE_ORIGINAL,
  // Override with our enhanced Vector3
  Vector3: Vector3Enhanced,
  Vector3Enhanced,
  // Add SkeletonUtils
  SkeletonUtils: SkeletonUtilsImport,
  // Ensure key missing exports are available
  WebGLRenderer: (THREE_ORIGINAL as any).WebGLRenderer,
  TextureLoader: (THREE_ORIGINAL as any).TextureLoader,
  Raycaster: (THREE_ORIGINAL as any).Raycaster,
  Layers: (THREE_ORIGINAL as any).Layers,
  Matrix4: (THREE_ORIGINAL as any).Matrix4,
  Material: (THREE_ORIGINAL as any).Material,
  Texture: (THREE_ORIGINAL as any).Texture,
  BufferGeometry: (THREE_ORIGINAL as any).BufferGeometry,
  PlaneGeometry: (THREE_ORIGINAL as any).PlaneGeometry,
  BoxGeometry: (THREE_ORIGINAL as any).BoxGeometry,
  MeshStandardMaterial: (THREE_ORIGINAL as any).MeshStandardMaterial,
  PerspectiveCamera: (THREE_ORIGINAL as any).PerspectiveCamera,
  CanvasTexture: (THREE_ORIGINAL as any).CanvasTexture,
  DataTexture: (THREE_ORIGINAL as any).DataTexture,
  VideoTexture: (THREE_ORIGINAL as any).VideoTexture,
  LinearFilter: (THREE_ORIGINAL as any).LinearFilter,
  LinearSRGBColorSpace: (THREE_ORIGINAL as any).LinearSRGBColorSpace,
  SRGBColorSpace: (THREE_ORIGINAL as any).SRGBColorSpace,
  InstancedMesh: (THREE_ORIGINAL as any).InstancedMesh,
  InstancedBufferAttribute: (THREE_ORIGINAL as any).InstancedBufferAttribute,
} as any;

// Also provide a namespace for type usage
export namespace THREE {
  export type Vector3 = InstanceType<typeof Vector3Enhanced>
  export type Vector3Enhanced = InstanceType<typeof Vector3Enhanced>
  export type Vector3Type = InstanceType<typeof Vector3Enhanced>
  // Use imported types from three directly - only the ones that exist
  export type Quaternion = any // Use any to avoid property access issues
  export type QuaternionType = any
  export type Euler = any // Use any to avoid method access issues
  export type EulerType = any
  export type Matrix4 = any // Use any to avoid method access issues
  export type Matrix4Type = any
  export type Object3D = any // Use any to avoid method access issues
  export type Object3DType = any
  // For classes that are not directly exported as types, use any
  export type Mesh = any
  export type MeshType = any
  export type SphereGeometry = any
  export type SphereGeometryType = any
  export type MeshBasicMaterial = any
  export type MeshBasicMaterialType = any
  export type Color = any
  export type ColorType = any
  export type Fog = any
  export type FogType = any
  export type Texture = any
  export type TextureType = any
  export type CanvasTexture = any
  export type CanvasTextureType = any
  export type Material = any
  export type MaterialType = any
  export type Camera = any
  export type CameraType = any
  export type PerspectiveCamera = any
  export type PerspectiveCameraType = any
  export type BufferGeometry = any
  export type PlaneGeometry = any
  export type BoxGeometry = any
  export type MeshStandardMaterial = any
  export type WebGLRenderer = any
  export type InstancedMeshType = any
  export type InstancedBufferAttributeType = any
  export type TextureLoader = any
  export type Scene = any
  export type SceneType = any
  export type Group = any
  export type GroupType = any
  export type Raycaster = any
  export type RaycasterType = any
  export type Layers = any
  export type LayersType = any
  export type InstancedMesh = any
}

// Export the enhanced THREE namespace as default export
export default THREE_ENHANCED;

// Extend THREE types to include our custom methods
declare module 'three' {
  interface InstancedMesh {
    resize(size: number): void
  }
}
