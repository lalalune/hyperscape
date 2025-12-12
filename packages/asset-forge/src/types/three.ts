import * as THREE from "three";

// Three.js geometry types
export type ThreeGeometry =
  | THREE.BufferGeometry
  | THREE.BoxGeometry
  | THREE.SphereGeometry
  | THREE.CylinderGeometry
  | THREE.PlaneGeometry;

// Three.js material types
export type ThreeMaterial =
  | THREE.Material
  | THREE.MeshStandardMaterial
  | THREE.MeshBasicMaterial
  | THREE.MeshPhongMaterial
  | THREE.MeshLambertMaterial;

// Three.js object types
export interface ThreeObject3D extends THREE.Object3D {
  geometry?: ThreeGeometry;
  material?: ThreeMaterial | ThreeMaterial[];
}

// Raycaster intersection type
export interface RaycastIntersection {
  distance: number;
  point: THREE.Vector3;
  face?: THREE.Face;
  faceIndex?: number;
  object: THREE.Object3D;
  uv?: THREE.Vector2;
  uv2?: THREE.Vector2;
  instanceId?: number;
}

// GLTF types
export interface GLTFAnimation {
  name: string;
  duration: number;
  tracks: THREE.KeyframeTrack[];
}

export interface GLTFNode {
  name: string;
  mesh?: number;
  skin?: number;
  children?: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
}

export interface GLTFSkin {
  name?: string;
  joints: number[];
  inverseBindMatrices?: number;
}

// Helper types
export interface DebugSpheres {
  handSphere?: THREE.Mesh;
  gripSphere?: THREE.Mesh;
  centerSphere?: THREE.Mesh;
  line?: THREE.Line;
  wristSphere?: THREE.Mesh;
}

// Material with color property
export interface MaterialWithColor extends THREE.Material {
  color?: THREE.Color;
}

// Extended mesh types
export interface ExtendedMesh extends THREE.Mesh {
  renderHelper?: THREE.Object3D | THREE.Box3Helper;
  updateHelper?: () => void;
}

// Geometry with volume tracking
export interface GeometryWithVolume extends THREE.BufferGeometry {
  originalVolume?: number;
}
