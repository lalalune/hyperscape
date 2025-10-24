import type {
  Box3Helper, BoxGeometry, BufferGeometry, Color, CylinderGeometry, Face, KeyframeTrack, Line,
  Material, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, MeshStandardMaterial, Object3D, PlaneGeometry,
  SphereGeometry, Vector2, Vector3
} from 'three'

// Three.js geometry types
export type ThreeGeometry = BufferGeometry | BoxGeometry | SphereGeometry | CylinderGeometry | PlaneGeometry

// Three.js material types
export type ThreeMaterial = Material | MeshStandardMaterial | MeshBasicMaterial | MeshPhongMaterial | MeshLambertMaterial

// Three.js object types
export interface ThreeObject3D extends Object3D {
  geometry?: ThreeGeometry
  material?: ThreeMaterial | ThreeMaterial[]
}

// Raycaster intersection type
export interface RaycastIntersection {
  distance: number
  point: Vector3
  face?: Face
  faceIndex?: number
  object: Object3D
  uv?: Vector2
  uv2?: Vector2
  instanceId?: number
}

// GLTF types
export interface GLTFAnimation {
  name: string
  duration: number
  tracks: KeyframeTrack[]
}

export interface GLTFNode {
  name: string
  mesh?: number
  skin?: number
  children?: number[]
  translation?: [number, number, number]
  rotation?: [number, number, number, number]
  scale?: [number, number, number]
}

export interface GLTFSkin {
  name?: string
  joints: number[]
  inverseBindMatrices?: number
}

// Helper types
export interface DebugSpheres {
  handSphere?: Mesh
  gripSphere?: Mesh
  centerSphere?: Mesh
  line?: Line
  wristSphere?: Mesh
}

// Material with color property
export interface MaterialWithColor extends Material {
  color?: Color
}

// Extended mesh types
export interface ExtendedMesh extends Mesh {
  renderHelper?: Object3D | Box3Helper
  updateHelper?: () => void
}

// Geometry with volume tracking
export interface GeometryWithVolume extends BufferGeometry {
  originalVolume?: number
} 