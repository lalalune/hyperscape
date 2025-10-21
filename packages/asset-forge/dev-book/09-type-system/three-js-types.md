# Three.js and GLTF Types

Asset Forge extensively uses Three.js for 3D rendering and GLTF for asset import/export. This document covers all Three.js geometry types, material types, object types, raycasting types, GLTF export structures, and specialized helper types for 3D operations.

## Three.js Type Architecture

Asset Forge's Three.js type system provides type-safe wrappers around Three.js classes and structures:

```
Three.js Types
├── Geometry Types (ThreeGeometry)
├── Material Types (ThreeMaterial)
├── Object Types (ThreeObject3D)
├── Raycast Types (RaycastIntersection)
├── GLTF Types (GLTFNode, GLTFSkin, etc.)
└── Helper Types (ExtendedMesh, DebugSpheres, etc.)
```

## ThreeGeometry Union Type

The `ThreeGeometry` type represents all supported geometry types:

```typescript
export type ThreeGeometry =
  | THREE.BufferGeometry
  | THREE.BoxGeometry
  | THREE.SphereGeometry
  | THREE.CylinderGeometry
  | THREE.PlaneGeometry
```

### Geometry Type Usage

**BufferGeometry** - Base geometry class for all custom geometries:

```typescript
import * as THREE from 'three'

// Create custom geometry
const geometry = new THREE.BufferGeometry()
const vertices = new Float32Array([
  -1.0, -1.0,  1.0,
   1.0, -1.0,  1.0,
   1.0,  1.0,  1.0,
  -1.0,  1.0,  1.0,
])
geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))

// Type-safe usage
const geo: ThreeGeometry = geometry
```

**BoxGeometry** - Rectangular prism geometry:

```typescript
// Create box for bounding box visualization
const boxGeo = new THREE.BoxGeometry(1.0, 2.0, 0.5)
const boxMesh = new THREE.Mesh(boxGeo, material)

// Common use: Placeholder geometry
function createPlaceholder(width: number, height: number, depth: number): THREE.Mesh {
  const geometry: ThreeGeometry = new THREE.BoxGeometry(width, height, depth)
  const material = new THREE.MeshStandardMaterial({ color: 0x808080 })
  return new THREE.Mesh(geometry, material)
}
```

**SphereGeometry** - Spherical geometry:

```typescript
// Create sphere for debug visualization
const sphereGeo = new THREE.SphereGeometry(0.05, 16, 16)

// Common use: Grip point visualization
function createGripMarker(position: Vector3): THREE.Mesh {
  const geometry: ThreeGeometry = new THREE.SphereGeometry(0.02, 12, 12)
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
  const marker = new THREE.Mesh(geometry, material)
  marker.position.set(position.x, position.y, position.z)
  return marker
}
```

**CylinderGeometry** - Cylindrical geometry:

```typescript
// Create cylinder for weapon handles
const cylinderGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 16)

// Common use: Handle visualization
function createHandleVisualization(length: number, radius: number): THREE.Mesh {
  const geometry: ThreeGeometry = new THREE.CylinderGeometry(
    radius,
    radius,
    length,
    16
  )
  const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 })
  return new THREE.Mesh(geometry, material)
}
```

**PlaneGeometry** - Flat plane geometry:

```typescript
// Create plane for ground visualization
const planeGeo = new THREE.PlaneGeometry(10, 10)

// Common use: Shadow receiver or ground plane
function createGroundPlane(size: number): THREE.Mesh {
  const geometry: ThreeGeometry = new THREE.PlaneGeometry(size, size)
  const material = new THREE.MeshStandardMaterial({
    color: 0x808080,
    side: THREE.DoubleSide
  })
  const plane = new THREE.Mesh(geometry, material)
  plane.rotation.x = -Math.PI / 2 // Rotate to horizontal
  return plane
}
```

### Geometry Manipulation

```typescript
function analyzeGeometry(geometry: ThreeGeometry): void {
  if (geometry instanceof THREE.BufferGeometry) {
    const position = geometry.getAttribute('position')
    console.log(`Vertices: ${position.count}`)

    // Compute bounding box
    geometry.computeBoundingBox()
    if (geometry.boundingBox) {
      const size = new THREE.Vector3()
      geometry.boundingBox.getSize(size)
      console.log(`Size: ${size.x} x ${size.y} x ${size.z}`)
    }

    // Compute normals if missing
    if (!geometry.getAttribute('normal')) {
      geometry.computeVertexNormals()
    }
  }
}
```

## ThreeMaterial Union Type

The `ThreeMaterial` type represents all supported material types:

```typescript
export type ThreeMaterial =
  | THREE.Material
  | THREE.MeshStandardMaterial
  | THREE.MeshBasicMaterial
  | THREE.MeshPhongMaterial
  | THREE.MeshLambertMaterial
```

### Material Type Usage

**MeshStandardMaterial** - PBR material (primary material for assets):

```typescript
// Create standard PBR material
const material: ThreeMaterial = new THREE.MeshStandardMaterial({
  color: 0x808080,
  metalness: 0.8,
  roughness: 0.4,
  envMapIntensity: 1.0
})

// With texture maps
const texturedMaterial = new THREE.MeshStandardMaterial({
  map: diffuseTexture,
  normalMap: normalTexture,
  metalnessMap: metallicTexture,
  roughnessMap: roughnessTexture,
  metalness: 1.0,
  roughness: 1.0
})

// Common use: Asset rendering
function createAssetMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.7,
    roughness: 0.3,
    envMapIntensity: 1.0
  })
}
```

**MeshBasicMaterial** - Unlit material (for UI and debug visualization):

```typescript
// Create unlit material
const basicMaterial: ThreeMaterial = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.5
})

// Common use: Debug markers
function createDebugMaterial(color: number, opacity: number = 1.0): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1.0,
    opacity,
    depthTest: false
  })
}
```

**MeshPhongMaterial** - Blinn-Phong shading (legacy support):

```typescript
// Create Phong material
const phongMaterial: ThreeMaterial = new THREE.MeshPhongMaterial({
  color: 0x808080,
  specular: 0x222222,
  shininess: 30
})

// Common use: Fallback for older browsers
function createCompatibleMaterial(color: number): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({
    color,
    specular: 0x111111,
    shininess: 25
  })
}
```

**MeshLambertMaterial** - Diffuse-only material (performance):

```typescript
// Create Lambert material
const lambertMaterial: ThreeMaterial = new THREE.MeshLambertMaterial({
  color: 0x808080
})

// Common use: Low-detail background objects
function createBackgroundMaterial(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color,
    reflectivity: 0.5
  })
}
```

### Material Properties

```typescript
function configureMaterial(material: ThreeMaterial, config: {
  color?: number
  opacity?: number
  transparent?: boolean
  side?: THREE.Side
}): void {
  // Set base properties available on all materials
  if (config.color !== undefined && 'color' in material) {
    (material as THREE.MeshStandardMaterial).color.setHex(config.color)
  }

  if (config.opacity !== undefined) {
    material.opacity = config.opacity
  }

  if (config.transparent !== undefined) {
    material.transparent = config.transparent
  }

  if (config.side !== undefined) {
    material.side = config.side
  }

  material.needsUpdate = true
}
```

## ThreeObject3D Interface

Extended Three.js Object3D interface:

```typescript
export interface ThreeObject3D extends THREE.Object3D {
  geometry?: ThreeGeometry
  material?: ThreeMaterial | ThreeMaterial[]
}
```

### Object3D Usage

```typescript
// Create 3D object
function createObject(
  geometry: ThreeGeometry,
  material: ThreeMaterial
): ThreeObject3D {
  const mesh = new THREE.Mesh(geometry, material)
  return mesh as ThreeObject3D
}

// Traverse object hierarchy
function traverseObject(object: ThreeObject3D, callback: (obj: ThreeObject3D) => void): void {
  callback(object)
  object.children.forEach(child => {
    traverseObject(child as ThreeObject3D, callback)
  })
}

// Find meshes in hierarchy
function findMeshes(root: ThreeObject3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []

  root.traverse(node => {
    if (node instanceof THREE.Mesh) {
      meshes.push(node)
    }
  })

  return meshes
}
```

### Object Transformation

```typescript
function transformObject(object: ThreeObject3D, transform: {
  position?: Vector3
  rotation?: Vector3  // Euler angles in radians
  scale?: Vector3 | number
}): void {
  if (transform.position) {
    object.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z
    )
  }

  if (transform.rotation) {
    object.rotation.set(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z
    )
  }

  if (transform.scale) {
    if (typeof transform.scale === 'number') {
      object.scale.setScalar(transform.scale)
    } else {
      object.scale.set(
        transform.scale.x,
        transform.scale.y,
        transform.scale.z
      )
    }
  }
}
```

## RaycastIntersection Interface

Raycasting results for 3D interaction:

```typescript
export interface RaycastIntersection {
  distance: number
  point: THREE.Vector3
  face?: THREE.Face
  faceIndex?: number
  object: THREE.Object3D
  uv?: THREE.Vector2
  uv2?: THREE.Vector2
  instanceId?: number
}
```

### Raycasting Usage

```typescript
function performRaycast(
  camera: THREE.Camera,
  mouse: { x: number; y: number },
  objects: THREE.Object3D[]
): RaycastIntersection[] {
  const raycaster = new THREE.Raycaster()
  const mouseVec = new THREE.Vector2(mouse.x, mouse.y)

  raycaster.setFromCamera(mouseVec, camera)
  const intersections = raycaster.intersectObjects(objects, true)

  return intersections as RaycastIntersection[]
}

// Find closest intersection
function findClosestIntersection(
  intersections: RaycastIntersection[]
): RaycastIntersection | null {
  if (intersections.length === 0) return null

  return intersections.reduce((closest, current) =>
    current.distance < closest.distance ? current : closest
  )
}

// Get intersection point
function getIntersectionPoint(intersection: RaycastIntersection): Vector3 {
  return {
    x: intersection.point.x,
    y: intersection.point.y,
    z: intersection.point.z
  }
}
```

### Interactive Object Selection

```typescript
interface SelectableObject extends ThreeObject3D {
  userData: {
    selectable: boolean
    assetId?: string
    onSelect?: () => void
  }
}

function handleObjectSelection(
  camera: THREE.Camera,
  mouse: { x: number; y: number },
  scene: THREE.Scene
): void {
  const selectableObjects = scene.children.filter(obj =>
    obj.userData?.selectable === true
  )

  const intersections = performRaycast(camera, mouse, selectableObjects)
  const closest = findClosestIntersection(intersections)

  if (closest) {
    const object = closest.object as SelectableObject
    console.log(`Selected object: ${object.userData.assetId}`)

    if (object.userData.onSelect) {
      object.userData.onSelect()
    }
  }
}
```

## GLTF Type System

GLTF types represent the structure of exported GLTF/GLB files.

### GLTFNode Interface

Represents a node in the GLTF scene graph:

```typescript
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
```

**Example - Weapon Node:**

```typescript
const weaponNode: GLTFNode = {
  name: 'Sword_Root',
  mesh: 0,
  translation: [0.0, 0.0, 0.0],
  rotation: [0.0, 0.0, 0.0, 1.0],  // Quaternion
  scale: [1.0, 1.0, 1.0]
}
```

**Example - Character with Skeleton:**

```typescript
const characterRoot: GLTFNode = {
  name: 'Character_Root',
  mesh: 0,
  skin: 0,
  children: [1, 2, 3],  // Bone indices
  translation: [0.0, 0.0, 0.0],
  rotation: [0.0, 0.0, 0.0, 1.0],
  scale: [1.0, 1.0, 1.0]
}

const spineBone: GLTFNode = {
  name: 'Spine',
  children: [4, 5],  // Child bones
  translation: [0.0, 1.0, 0.0],
  rotation: [0.0, 0.0, 0.0, 1.0]
}
```

### GLTFSkin Interface

Represents skeletal skinning data:

```typescript
export interface GLTFSkin {
  name?: string
  joints: number[]
  inverseBindMatrices?: number
  skeleton?: number
}
```

**Example:**

```typescript
const humanoidSkin: GLTFSkin = {
  name: 'Humanoid_Skin',
  joints: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],  // Bone node indices
  inverseBindMatrices: 0,  // Accessor index
  skeleton: 0  // Root bone index
}
```

### GLTFMesh Interface

Represents mesh geometry data:

```typescript
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
```

**Example - Simple Mesh:**

```typescript
const swordMesh: GLTFMesh = {
  name: 'Sword_Mesh',
  primitives: [
    {
      attributes: {
        POSITION: 0,     // Position buffer accessor
        NORMAL: 1,       // Normal buffer accessor
        TEXCOORD_0: 2    // UV buffer accessor
      },
      indices: 3,        // Index buffer accessor
      material: 0        // Material index
    }
  ]
}
```

**Example - Skinned Mesh:**

```typescript
const characterMesh: GLTFMesh = {
  name: 'Character_Mesh',
  primitives: [
    {
      attributes: {
        POSITION: 0,
        NORMAL: 1,
        TEXCOORD_0: 2,
        JOINTS_0: 3,     // Bone indices
        WEIGHTS_0: 4     // Bone weights
      },
      indices: 5,
      material: 0
    }
  ]
}
```

### GLTFMaterial Interface

Represents PBR material properties:

```typescript
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
```

**Example - Metal Material:**

```typescript
const steelMaterial: GLTFMaterial = {
  name: 'Steel_Material',
  pbrMetallicRoughness: {
    baseColorFactor: [0.75, 0.75, 0.75, 1.0],  // RGB + Alpha
    metallicFactor: 0.9,
    roughnessFactor: 0.3,
    baseColorTexture: {
      index: 0,      // Texture index
      texCoord: 0    // UV set
    }
  },
  normalTexture: {
    index: 1,
    scale: 1.0
  },
  doubleSided: false
}
```

**Example - Transparent Material:**

```typescript
const glassMaterial: GLTFMaterial = {
  name: 'Glass_Material',
  pbrMetallicRoughness: {
    baseColorFactor: [1.0, 1.0, 1.0, 0.3],  // Semi-transparent
    metallicFactor: 0.0,
    roughnessFactor: 0.1
  },
  alphaMode: 'BLEND',
  doubleSided: true
}
```

### GLTFAnimation Interface

Represents animation data:

```typescript
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
  input: number   // Time values accessor
  interpolation?: 'LINEAR' | 'STEP' | 'CUBICSPLINE'
  output: number  // Value accessor
}
```

**Example - Walk Animation:**

```typescript
const walkAnimation: GLTFAnimation = {
  name: 'Walk',
  channels: [
    {
      sampler: 0,
      target: {
        node: 1,  // Spine bone
        path: 'rotation'
      }
    },
    {
      sampler: 1,
      target: {
        node: 2,  // Left leg bone
        path: 'rotation'
      }
    },
    {
      sampler: 2,
      target: {
        node: 3,  // Right leg bone
        path: 'rotation'
      }
    }
  ],
  samplers: [
    {
      input: 0,           // Time accessor
      interpolation: 'LINEAR',
      output: 1           // Rotation values accessor
    },
    {
      input: 0,
      interpolation: 'LINEAR',
      output: 2
    },
    {
      input: 0,
      interpolation: 'LINEAR',
      output: 3
    }
  ]
}
```

### GLTFScene Interface

Represents a GLTF scene:

```typescript
export interface GLTFScene {
  name?: string
  nodes?: number[]
}
```

**Example:**

```typescript
const mainScene: GLTFScene = {
  name: 'Main_Scene',
  nodes: [0, 1, 2]  // Root node indices
}
```

### GLTFExportResult Interface

Complete GLTF export structure:

```typescript
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
```

**Example - Complete Export:**

```typescript
const gltfExport: GLTFExportResult = {
  asset: {
    version: '2.0',
    generator: 'Asset Forge Exporter 1.0'
  },
  scenes: [
    {
      name: 'Main_Scene',
      nodes: [0]
    }
  ],
  scene: 0,  // Default scene
  nodes: [
    {
      name: 'Sword_Root',
      mesh: 0,
      translation: [0.0, 0.0, 0.0],
      rotation: [0.0, 0.0, 0.0, 1.0],
      scale: [1.0, 1.0, 1.0]
    }
  ],
  meshes: [
    {
      name: 'Sword_Mesh',
      primitives: [
        {
          attributes: {
            POSITION: 0,
            NORMAL: 1,
            TEXCOORD_0: 2
          },
          indices: 3,
          material: 0
        }
      ]
    }
  ],
  materials: [
    {
      name: 'Steel_Material',
      pbrMetallicRoughness: {
        baseColorFactor: [0.75, 0.75, 0.75, 1.0],
        metallicFactor: 0.9,
        roughnessFactor: 0.3
      }
    }
  ]
}
```

## Helper Types

### ExtendedMesh Type

Extended mesh type with debugging helpers:

```typescript
export interface ExtendedMesh extends THREE.Mesh {
  renderHelper?: THREE.Object3D | THREE.Box3Helper
  updateHelper?: () => void
}
```

**Example:**

```typescript
function createDebugMesh(geometry: ThreeGeometry, material: ThreeMaterial): ExtendedMesh {
  const mesh = new THREE.Mesh(geometry, material) as ExtendedMesh

  // Add bounding box helper
  geometry.computeBoundingBox()
  if (geometry.boundingBox) {
    const boxHelper = new THREE.Box3Helper(
      geometry.boundingBox,
      new THREE.Color(0xff0000)
    )
    mesh.renderHelper = boxHelper

    // Update function
    mesh.updateHelper = () => {
      geometry.computeBoundingBox()
      if (mesh.renderHelper instanceof THREE.Box3Helper && geometry.boundingBox) {
        mesh.renderHelper.box.copy(geometry.boundingBox)
      }
    }
  }

  return mesh
}
```

### MaterialWithColor Type

Material guaranteed to have color property:

```typescript
export interface MaterialWithColor extends THREE.Material {
  color?: THREE.Color
}
```

**Example:**

```typescript
function setMaterialColor(material: MaterialWithColor, color: number): void {
  if (material.color) {
    material.color.setHex(color)
    material.needsUpdate = true
  }
}

function getMaterialColor(material: MaterialWithColor): number | null {
  return material.color ? material.color.getHex() : null
}
```

### DebugSpheres Type

Debug visualization helpers:

```typescript
export interface DebugSpheres {
  handSphere?: THREE.Mesh
  gripSphere?: THREE.Mesh
  centerSphere?: THREE.Mesh
  line?: THREE.Line
  wristSphere?: THREE.Mesh
}
```

**Example:**

```typescript
function createDebugSpheres(positions: {
  hand?: Vector3
  grip?: Vector3
  center?: Vector3
  wrist?: Vector3
}): DebugSpheres {
  const sphereGeo = new THREE.SphereGeometry(0.02, 12, 12)
  const debugSpheres: DebugSpheres = {}

  if (positions.hand) {
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    debugSpheres.handSphere = new THREE.Mesh(sphereGeo, material)
    debugSpheres.handSphere.position.set(
      positions.hand.x,
      positions.hand.y,
      positions.hand.z
    )
  }

  if (positions.grip) {
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    debugSpheres.gripSphere = new THREE.Mesh(sphereGeo, material)
    debugSpheres.gripSphere.position.set(
      positions.grip.x,
      positions.grip.y,
      positions.grip.z
    )
  }

  if (positions.center) {
    const material = new THREE.MeshBasicMaterial({ color: 0x0000ff })
    debugSpheres.centerSphere = new THREE.Mesh(sphereGeo, material)
    debugSpheres.centerSphere.position.set(
      positions.center.x,
      positions.center.y,
      positions.center.z
    )
  }

  if (positions.wrist) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 })
    debugSpheres.wristSphere = new THREE.Mesh(sphereGeo, material)
    debugSpheres.wristSphere.position.set(
      positions.wrist.x,
      positions.wrist.y,
      positions.wrist.z
    )
  }

  // Create line connecting points
  if (positions.hand && positions.grip) {
    const points = [
      new THREE.Vector3(positions.hand.x, positions.hand.y, positions.hand.z),
      new THREE.Vector3(positions.grip.x, positions.grip.y, positions.grip.z)
    ]
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff })
    debugSpheres.line = new THREE.Line(lineGeo, lineMat)
  }

  return debugSpheres
}

function addDebugSpheresToScene(spheres: DebugSpheres, scene: THREE.Scene): void {
  if (spheres.handSphere) scene.add(spheres.handSphere)
  if (spheres.gripSphere) scene.add(spheres.gripSphere)
  if (spheres.centerSphere) scene.add(spheres.centerSphere)
  if (spheres.wristSphere) scene.add(spheres.wristSphere)
  if (spheres.line) scene.add(spheres.line)
}

function removeDebugSpheresFromScene(spheres: DebugSpheres, scene: THREE.Scene): void {
  if (spheres.handSphere) scene.remove(spheres.handSphere)
  if (spheres.gripSphere) scene.remove(spheres.gripSphere)
  if (spheres.centerSphere) scene.remove(spheres.centerSphere)
  if (spheres.wristSphere) scene.remove(spheres.wristSphere)
  if (spheres.line) scene.remove(spheres.line)
}
```

### GeometryWithVolume Type

Geometry with volume tracking for shrinkwrap operations:

```typescript
export interface GeometryWithVolume extends THREE.BufferGeometry {
  originalVolume?: number
}
```

**Example:**

```typescript
function calculateGeometryVolume(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position')
  let volume = 0

  // Simple volume calculation using triangles
  for (let i = 0; i < position.count; i += 3) {
    const v1 = new THREE.Vector3().fromBufferAttribute(position, i)
    const v2 = new THREE.Vector3().fromBufferAttribute(position, i + 1)
    const v3 = new THREE.Vector3().fromBufferAttribute(position, i + 2)

    // Cross product volume contribution
    const cross = new THREE.Vector3().crossVectors(v2, v3)
    volume += v1.dot(cross) / 6
  }

  return Math.abs(volume)
}

function preserveVolume(
  geometry: GeometryWithVolume,
  targetRatio: number = 1.0
): void {
  if (!geometry.originalVolume) {
    geometry.originalVolume = calculateGeometryVolume(geometry)
  }

  const currentVolume = calculateGeometryVolume(geometry)
  const volumeRatio = currentVolume / geometry.originalVolume
  const scaleFactor = Math.cbrt(targetRatio / volumeRatio)

  geometry.scale(scaleFactor, scaleFactor, scaleFactor)
}
```

## Common Three.js Patterns

### Loading GLTF Models

```typescript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

async function loadGLTFModel(url: string): Promise<THREE.Group> {
  const loader = new GLTFLoader()

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        resolve(gltf.scene)
      },
      (progress) => {
        console.log(`Loading: ${(progress.loaded / progress.total * 100).toFixed(2)}%`)
      },
      (error) => {
        reject(error)
      }
    )
  })
}

// Usage
const model = await loadGLTFModel('/models/sword.glb')
scene.add(model)
```

### Material Cloning

```typescript
function cloneMaterial(material: ThreeMaterial): ThreeMaterial {
  return material.clone()
}

function cloneMaterialWithColor(
  material: MaterialWithColor,
  newColor: number
): MaterialWithColor {
  const cloned = material.clone() as MaterialWithColor
  if (cloned.color) {
    cloned.color.setHex(newColor)
  }
  return cloned
}
```

### Geometry Operations

```typescript
function mergeGeometries(geometries: ThreeGeometry[]): THREE.BufferGeometry {
  const bufferGeometries = geometries.filter(
    g => g instanceof THREE.BufferGeometry
  ) as THREE.BufferGeometry[]

  return THREE.BufferGeometryUtils.mergeGeometries(bufferGeometries)
}

function centerGeometry(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox()
  if (geometry.boundingBox) {
    const center = new THREE.Vector3()
    geometry.boundingBox.getCenter(center)
    geometry.translate(-center.x, -center.y, -center.z)
  }
}

function scaleGeometry(
  geometry: THREE.BufferGeometry,
  scale: number | Vector3
): void {
  if (typeof scale === 'number') {
    geometry.scale(scale, scale, scale)
  } else {
    geometry.scale(scale.x, scale.y, scale.z)
  }
}
```

### Scene Hierarchy Operations

```typescript
function findObjectByName(root: THREE.Object3D, name: string): THREE.Object3D | null {
  return root.getObjectByName(name) || null
}

function findObjectsByType<T extends THREE.Object3D>(
  root: THREE.Object3D,
  type: new (...args: any[]) => T
): T[] {
  const objects: T[] = []

  root.traverse(obj => {
    if (obj instanceof type) {
      objects.push(obj)
    }
  })

  return objects
}

function getMeshes(root: THREE.Object3D): THREE.Mesh[] {
  return findObjectsByType(root, THREE.Mesh)
}

function getBones(root: THREE.Object3D): THREE.Bone[] {
  return findObjectsByType(root, THREE.Bone)
}
```

### Bounding Box Operations

```typescript
function computeSceneBoundingBox(scene: THREE.Scene): THREE.Box3 {
  const box = new THREE.Box3()

  scene.traverse(obj => {
    if (obj instanceof THREE.Mesh && obj.geometry) {
      obj.geometry.computeBoundingBox()
      if (obj.geometry.boundingBox) {
        const worldBox = obj.geometry.boundingBox.clone()
        worldBox.applyMatrix4(obj.matrixWorld)
        box.union(worldBox)
      }
    }
  })

  return box
}

function getBoundingBoxSize(box: THREE.Box3): Vector3 {
  const size = new THREE.Vector3()
  box.getSize(size)
  return { x: size.x, y: size.y, z: size.z }
}

function getBoundingBoxCenter(box: THREE.Box3): Vector3 {
  const center = new THREE.Vector3()
  box.getCenter(center)
  return { x: center.x, y: center.y, z: center.z }
}
```

## Summary

The Asset Forge Three.js and GLTF type system provides:

- **Comprehensive geometry types** covering all Three.js geometry classes
- **Material type unions** for type-safe material operations
- **Extended object types** with custom properties
- **Raycasting types** for 3D interaction
- **Complete GLTF export structures** for asset serialization
- **GLTF animation support** with channels and samplers
- **Helper types** for debugging and visualization
- **Volume tracking** for mesh operations
- **Common patterns** for 3D operations

This type architecture ensures type safety across all 3D rendering, asset loading, GLTF export, and interactive 3D operations, enabling robust 3D asset management and visualization throughout the Asset Forge system.
