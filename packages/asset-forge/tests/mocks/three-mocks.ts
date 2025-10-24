/**
 * Mock Three.js Objects for Testing
 * Provides mock implementations of Three.js classes
 */

import {
  BufferAttribute,
  BufferGeometry,
  Bone,
  Box3,
  Material,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Scene,
  Skeleton,
  SkinnedMesh,
  Vector3,
  WebGLRenderer
} from 'three'

/**
 * Create a mock BufferGeometry with specified vertex count
 */
export function createMockGeometry(vertexCount: number = 100): BufferGeometry {
  const geometry = new BufferGeometry()

  // Position attribute (3 components per vertex)
  const positions = new Float32Array(vertexCount * 3)
  for (let i = 0; i < vertexCount; i++) {
    positions[i * 3] = Math.random() * 2 - 1     // x
    positions[i * 3 + 1] = Math.random() * 2 - 1 // y
    positions[i * 3 + 2] = Math.random() * 2 - 1 // z
  }
  geometry.setAttribute('position', new BufferAttribute(positions, 3))

  // Normal attribute
  const normals = new Float32Array(vertexCount * 3)
  for (let i = 0; i < vertexCount; i++) {
    normals[i * 3] = 0
    normals[i * 3 + 1] = 0
    normals[i * 3 + 2] = 1
  }
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))

  // UV attribute
  const uvs = new Float32Array(vertexCount * 2)
  for (let i = 0; i < vertexCount; i++) {
    uvs[i * 2] = Math.random()
    uvs[i * 2 + 1] = Math.random()
  }
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))

  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  return geometry
}

/**
 * Create a mock Mesh
 */
export function createMockMesh(name: string = 'test-mesh', vertexCount: number = 100): Mesh {
  const geometry = createMockGeometry(vertexCount)
  const mesh = new Mesh(geometry)
  mesh.name = name
  mesh.updateMatrixWorld(true)
  return mesh
}

/**
 * Create a mock Skeleton with bones
 */
export function createMockSkeleton(boneNames: string[] = ['root', 'spine', 'chest', 'head']): Skeleton {
  const bones: Bone[] = []

  boneNames.forEach((name, index) => {
    const bone = new Bone()
    bone.name = name
    bone.position.set(0, index * 0.3, 0)
    if (index > 0) {
      bones[index - 1].add(bone)
    }
    bones.push(bone)
  })

  return new Skeleton(bones)
}

/**
 * Create a mock SkinnedMesh
 */
export function createMockSkinnedMesh(
  vertexCount: number = 200,
  boneCount: number = 4
): SkinnedMesh {
  const geometry = createMockGeometry(vertexCount)

  // Add skinning attributes
  const skinIndices = new Float32Array(vertexCount * 4)
  const skinWeights = new Float32Array(vertexCount * 4)

  for (let i = 0; i < vertexCount; i++) {
    // Assign each vertex to one bone with full weight
    const boneIndex = i % boneCount
    skinIndices[i * 4] = boneIndex
    skinIndices[i * 4 + 1] = 0
    skinIndices[i * 4 + 2] = 0
    skinIndices[i * 4 + 3] = 0

    skinWeights[i * 4] = 1.0
    skinWeights[i * 4 + 1] = 0
    skinWeights[i * 4 + 2] = 0
    skinWeights[i * 4 + 3] = 0
  }

  geometry.setAttribute('skinIndex', new BufferAttribute(skinIndices, 4))
  geometry.setAttribute('skinWeight', new BufferAttribute(skinWeights, 4))

  const skeleton = createMockSkeleton(['root', 'spine', 'chest', 'head'])
  const mesh = new SkinnedMesh(geometry)
  mesh.bind(skeleton)
  mesh.name = 'test-skinned-mesh'
  mesh.updateMatrixWorld(true)

  return mesh
}

/**
 * Create a mock Scene
 */
export function createMockScene(): Scene {
  const scene = new Scene()
  return scene
}

/**
 * Create a mock WebGLRenderer
 */
export function createMockRenderer(width: number = 512, height: number = 512): WebGLRenderer {
  // Create a canvas element for the renderer
  const canvas = {
    width,
    height,
    getContext: () => ({
      canvas: { width, height },
      drawingBufferWidth: width,
      drawingBufferHeight: height
    }),
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {}
  } as unknown as HTMLCanvasElement

  const renderer = new WebGLRenderer({
    canvas,
    antialias: false
  })

  renderer.setSize(width, height)
  return renderer
}

/**
 * Create a mock camera-ready body mesh (humanoid T-pose)
 */
export function createMockBodyMesh(): Mesh {
  const geometry = new BufferGeometry()

  // Create a simple humanoid shape in T-pose
  const vertices = [
    // Head
    0, 1.7, 0,
    0.1, 1.6, 0.1,
    -0.1, 1.6, 0.1,
    0.1, 1.6, -0.1,
    -0.1, 1.6, -0.1,
    // Torso
    0.2, 1.4, 0,
    -0.2, 1.4, 0,
    0.2, 0.8, 0,
    -0.2, 0.8, 0,
    // Arms (T-pose)
    0.8, 1.4, 0,  // Right arm
    -0.8, 1.4, 0, // Left arm
    // Legs
    0.1, 0.0, 0,  // Right leg
    -0.1, 0.0, 0  // Left leg
  ]

  const positions = new Float32Array(vertices)
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  const mesh = new Mesh(geometry)
  mesh.name = 'body-mesh'
  mesh.updateMatrixWorld(true)

  return mesh
}

/**
 * Create mock armor mesh (chest piece)
 */
export function createMockArmorMesh(): Mesh {
  const geometry = new BufferGeometry()

  // Create armor shape slightly larger than body
  const vertices = [
    0.25, 1.5, 0.1,
    -0.25, 1.5, 0.1,
    0.25, 0.7, 0.1,
    -0.25, 0.7, 0.1,
    0.25, 1.5, -0.1,
    -0.25, 1.5, -0.1,
    0.25, 0.7, -0.1,
    -0.25, 0.7, -0.1
  ]

  const positions = new Float32Array(vertices)
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  const mesh = new Mesh(geometry)
  mesh.name = 'armor-mesh'
  mesh.updateMatrixWorld(true)

  return mesh
}

/**
 * Create a mock GLB buffer for testing
 */
export function createMockGLBBuffer(): ArrayBuffer {
  // Minimal valid GLB structure
  const headerSize = 12
  const jsonChunkSize = 100
  const binChunkSize = 50
  const totalSize = headerSize + 8 + jsonChunkSize + 8 + binChunkSize

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)

  // GLB header
  view.setUint32(0, 0x46546C67, true) // magic: "glTF"
  view.setUint32(4, 2, true)           // version: 2
  view.setUint32(8, totalSize, true)   // length

  // JSON chunk header
  view.setUint32(12, jsonChunkSize, true)      // chunk length
  view.setUint32(16, 0x4E4F534A, true)         // chunk type: "JSON"

  // BIN chunk header
  view.setUint32(12 + 8 + jsonChunkSize, binChunkSize, true) // chunk length
  view.setUint32(12 + 8 + jsonChunkSize + 4, 0x004E4942, true) // chunk type: "BIN"

  return buffer
}
