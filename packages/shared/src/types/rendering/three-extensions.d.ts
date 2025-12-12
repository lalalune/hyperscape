import type * as THREE from "three";
import type PhysX from "@hyperscape/physx-js-webidl";

declare module "three" {
  // Vector3 extensions for PhysX integration
  interface Vector3 {
    fromPxVec3?(pxVec3: PhysX.PxVec3): this;
    toPxVec3?(pxVec3?: PhysX.PxVec3): PhysX.PxVec3 | null;
    toPxExtVec3?(pxExtVec3?: PhysX.PxVec3): PhysX.PxVec3 | null;
    toPxTransform?(pxTransform: PhysX.PxTransform): void;
  }

  // Quaternion extensions for PhysX integration
  interface Quaternion {
    toPxTransform?(pxTransform: PhysX.PxTransform): void;
  }

  // Matrix4 extensions for PhysX integration
  interface Matrix4 {
    toPxTransform?(pxTransform: PhysX.PxTransform): void;
  }

  // Euler extensions (do not redeclare built-in onChange/_onChange types)
  interface Euler {}

  // Object3D extensions for Hyperscape (avoid redeclaring userData type)
  interface Object3D {
    activate?(context: { world: unknown; entity: any }): void;
    deactivate?(): void;
    disableRateCheck?(): void;
    active?: boolean;
    getHeadToHeight?(): number;
    height?: number;
    setEmote?(emote: string): void;
    getBoneTransform?(boneName: string): Matrix4 | null;
    label?: string;
    health?: number;
    value?: string;
    updateTransform?(): void;
    // Shadow extensions
    shadow?: {
      camera?: Camera | null;
    };
    _listeners?: { [event: string]: Function[] };
  }

  // Material extensions (avoid redeclaring userData base type)
  interface Material {
    // Dynamic material properties for texture access (index signature augmentation)
    [key: string]: unknown;
  }

  // Mesh extensions (avoid redeclaring userData base type)
  interface Mesh {
    isSkinnedMesh?: boolean;
    morphTargetDictionary?: { [key: string]: number };
    morphTargetInfluences?: number[];
  }

  // SkinnedMesh extensions
  interface SkinnedMesh {}

  // Texture extensions
  interface Texture {}

  // WebGLRenderer extensions
  interface WebGLRenderer {}

  // WebGPU support (when available)
  interface WebGPURenderer {
    setSize(width: number, height: number): void;
    setPixelRatio(ratio: number): void;
    render(scene: THREE.Scene, camera: THREE.Camera): void;
    dispose(): void;
    init(): Promise<void>;
    toneMapping: THREE.ToneMapping;
    toneMappingExposure: number;
    outputColorSpace: THREE.ColorSpace;
    domElement: HTMLCanvasElement;
    setAnimationLoop?(callback: ((time: number) => void) | null): void;
  }

  // Camera extensions
  interface Camera {
    matrixWorldInverse: Matrix4;
    projectionMatrix: Matrix4;
    projectionMatrixInverse: Matrix4;
    matrixWorld: Matrix4;
  }
}

// Additional type definitions for specific THREE.js patterns
export interface HyperscapeObject3D extends THREE.Object3D {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  rotation: THREE.Euler;
  add(...object: THREE.Object3D[]): this;
  remove(...object: THREE.Object3D[]): this;
}

export interface HyperscapeMaterial extends THREE.Material {
  userData: {
    [key: string]: unknown;
    wind?: boolean;
  };
}

export interface HyperscapeMesh extends THREE.Mesh {
  userData: {
    [key: string]: unknown;
    entityId?: string;
    entityType?: string;
  };
}

// UserData interface for resource nodes
export interface ResourceUserData {
  id: string;
  type: string;
  resourceType: string;
  interactable: boolean;
}

// UserData interface for entities
export interface EntityUserData {
  entityId: string;
  entityType: string;
}

// UserData interface for general game objects
export interface GameObjectUserData {
  id: string;
  type?: string;
  [key: string]: unknown;
}

// Common CSS style properties for React components
export interface CSSStyleProperties {
  pointerEvents?: "auto" | "none" | string;
  position?: "relative" | "absolute" | "fixed" | "static" | "sticky" | string;
  alignItems?:
    | "center"
    | "flex-start"
    | "flex-end"
    | "stretch"
    | "baseline"
    | string;
  justifyContent?:
    | "center"
    | "flex-start"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly"
    | string;
  [key: string]: unknown;
}

// Ensure the '../extras/three' wrapper exposes all named exports from 'three' for type checking
// Note: do not redeclare the '../extras/three' module here; it has a concrete
// implementation with both default and named exports. Keeping this file focused
// on augmenting 'three' avoids conflicts with the wrapper's surface.
