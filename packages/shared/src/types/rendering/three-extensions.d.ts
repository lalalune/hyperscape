/**
 * Three.js Type Extensions for WebGPU
 *
 * Augments the Three.js type definitions with WebGPU-specific types
 * and HyperForge engine custom extensions.
 */

import * as THREE from "three";

/**
 * HyperForge engine's extended Object3D type — adds a typed
 * `userData` slot the engine uses to attach metadata to scene
 * graph nodes (entity ids, system tags, etc.) without leaking
 * `unknown` typings to consumers.
 */
export type EngineObject3D = THREE.Object3D & {
  userData: Record<string, unknown>;
};

/**
 * @deprecated Use `EngineObject3D`. The legacy name dates from
 * when the engine self-identified as Hyperia; the engine is now
 * `@hyperforge/shared` and Hyperia is one game built on it.
 * Kept as an alias for one release window.
 */
export type HyperiaObject3D = EngineObject3D;

declare module "three" {
  /**
   * PhysX prototype extensions for Vector3, Quaternion, Matrix4
   * These are added at runtime by PhysicsUtils.installThreeJSExtensions()
   */
  interface Vector3 {
    toPxTransform?(transform: import("../systems/physics").PxTransform): void;
  }

  interface Quaternion {
    toPxTransform?(transform: import("../systems/physics").PxTransform): void;
  }

  interface Matrix4 {
    toPxTransform?(transform: import("../systems/physics").PxTransform): void;
  }

  /**
   * WebGPU Renderer interface
   */
  interface WebGPURenderer {
    init: () => Promise<void>;
    setSize: (w: number, h: number, updateStyle?: boolean) => void;
    setPixelRatio: (r: number) => void;
    render: (scene: Scene, camera: Camera) => void;
    renderAsync: (scene: Scene, camera: Camera) => Promise<void>;
    toneMapping: ToneMapping;
    toneMappingExposure: number;
    outputColorSpace: ColorSpace;
    domElement: HTMLCanvasElement;
    setAnimationLoop: (cb: ((time: number) => void) | null) => void;
    dispose: () => void;
    info: {
      render: { triangles: number; calls: number };
      memory: { geometries: number; textures: number };
    };
    shadowMap: {
      enabled: boolean;
      type: ShadowMapType;
    };
    capabilities: {
      maxAnisotropy: number;
    };
    backend?: {
      device?: GPUDevice;
    };
    outputNode?: unknown;
  }

  /**
   * Extended BufferGeometry with BVH methods
   */
  interface BufferGeometry {
    computeBoundsTree: () => void;
    disposeBoundsTree: () => void;
  }

  /**
   * Extended Mesh with BVH raycast
   */
  interface Mesh {
    raycast: (raycaster: Raycaster, intersects: Intersection[]) => void;
  }

  /**
   * Extended InstancedMesh with resize method
   */
  interface InstancedMesh {
    resize?: (size: number) => void;
  }

  /**
   * Extended Texture with default anisotropy
   */

  namespace Texture {
    let DEFAULT_ANISOTROPY: number;
  }
}

/**
 * TSL Node Material Extensions
 */
declare module "three/webgpu" {
  /**
   * MeshStandardNodeMaterial with custom node properties
   */
  interface MeshStandardNodeMaterial {
    colorNode?: unknown;
    positionNode?: unknown;
    normalNode?: unknown;
    opacityNode?: unknown;
    emissiveNode?: unknown;
    roughnessNode?: unknown;
    metalnessNode?: unknown;
  }

  /**
   * MeshBasicNodeMaterial with custom node properties
   */
  interface MeshBasicNodeMaterial {
    colorNode?: unknown;
    positionNode?: unknown;
    opacityNode?: unknown;
  }
}

/**
 * WebGPU namespace extensions
 */
declare global {
  interface GPUDevice {
    features: GPUSupportedFeatures;
  }
}
