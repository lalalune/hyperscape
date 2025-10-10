/**
 * TypeScript definitions for GLTF export structures
 */

export interface GLTFExportResult {
  nodes?: GLTFNode[]
  skins?: GLTFSkin[]
  meshes?: GLTFMesh[]
  materials?: GLTFMaterial[]
  animations?: GLTFAnimation[]
  scenes?: GLTFScene[]
  scene?: number
  asset?: {
    version: string
    generator?: string
  }
}

export interface GLTFNode {
  name?: string
  mesh?: number
  skin?: number
  children?: number[]
  translation?: [number, number, number]
  rotation?: [number, number, number, number]
  scale?: [number, number, number]
  matrix?: number[]
}

export interface GLTFSkin {
  name?: string
  joints: number[]
  inverseBindMatrices?: number
  skeleton?: number
}

export interface GLTFMesh {
  name?: string
  primitives: GLTFPrimitive[]
}

export interface GLTFPrimitive {
  attributes: {
    POSITION: number
    NORMAL?: number
    TEXCOORD_0?: number
    JOINTS_0?: number
    WEIGHTS_0?: number
    [key: string]: number | undefined
  }
  indices?: number
  material?: number
  mode?: number
}

export interface GLTFMaterial {
  name?: string
  pbrMetallicRoughness?: {
    baseColorFactor?: [number, number, number, number]
    metallicFactor?: number
    roughnessFactor?: number
    baseColorTexture?: {
      index: number
      texCoord?: number
    }
  }
  normalTexture?: {
    index: number
    texCoord?: number
    scale?: number
  }
  emissiveFactor?: [number, number, number]
  alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND'
  alphaCutoff?: number
  doubleSided?: boolean
}

export interface GLTFAnimation {
  name?: string
  channels: GLTFAnimationChannel[]
  samplers: GLTFAnimationSampler[]
}

export interface GLTFAnimationChannel {
  sampler: number
  target: {
    node?: number
    path: 'translation' | 'rotation' | 'scale' | 'weights'
  }
}

export interface GLTFAnimationSampler {
  input: number
  interpolation?: 'LINEAR' | 'STEP' | 'CUBICSPLINE'
  output: number
}

export interface GLTFScene {
  name?: string
  nodes?: number[]
}