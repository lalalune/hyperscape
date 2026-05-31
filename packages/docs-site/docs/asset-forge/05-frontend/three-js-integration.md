# Three.js Integration

This document covers Asset Forge's Three.js integration for 3D visualization, including scene setup, model loading, camera controls, animation, and performance optimization.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Scene Setup](#scene-setup)
3. [GLTFLoader Integration](#gltfloader-integration)
4. [Camera Configuration](#camera-configuration)
5. [OrbitControls](#orbitcontrols)
6. [Lighting Setup](#lighting-setup)
7. [SkinnedMesh Handling](#skinnedmesh-handling)
8. [Animation Support](#animation-support)
9. [Resource Cleanup](#resource-cleanup)
10. [Performance Optimization](#performance-optimization)

---

## Architecture Overview

Asset Forge uses [Three.js r150+](https://threejs.org/) for all 3D rendering, centralized in the `ThreeViewer` component with specialized viewers for specific workflows.

### Component Hierarchy

```
ThreeViewer (shared/ThreeViewer.tsx)
├── Scene Management
├── GLTFLoader
├── Camera & Controls
├── Lighting
├── Animation System
└── Resource Cleanup

Specialized Viewers:
├── ArmorFittingViewer
├── EquipmentViewer
└── AnimationPlayer
```

### Core Libraries

```json
{
  "three": "^0.150.0",
  "three/examples/jsm/controls/OrbitControls": "Camera controls",
  "three/examples/jsm/loaders/GLTFLoader": "GLTF model loading",
  "three/examples/jsm/exporters/GLTFExporter": "Model export",
  "three/examples/jsm/postprocessing/EffectComposer": "Post-processing",
  "three/examples/jsm/postprocessing/SSAOPass": "Ambient occlusion",
  "three/examples/jsm/postprocessing/UnrealBloomPass": "Bloom effect"
}
```

### Import Pattern

```typescript
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js'
```

---

## Scene Setup

### Basic Scene Initialization

```typescript
const setupScene = () => {
  // Create scene
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a1a)
  scene.fog = new THREE.Fog(0x1a1a1a, 10, 50)

  // Create camera
  const camera = new THREE.PerspectiveCamera(
    75,                                    // FOV
    containerWidth / containerHeight,      // Aspect ratio
    0.1,                                   // Near plane
    1000                                   // Far plane
  )
  camera.position.set(1.5, 1.2, 1.5)

  // Create renderer
  const renderer = new WebGPURenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  })
  renderer.setSize(containerWidth, containerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  // Color management
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1

  // Shadow mapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  return { scene, camera, renderer }
}
```

### Grid and Ground Plane

```typescript
const addGridAndGround = (scene: THREE.Scene) => {
  // Grid helper
  const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222)
  scene.add(gridHelper)

  // Ground plane
  const groundGeometry = new THREE.PlaneGeometry(20, 20)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.8,
    metalness: 0.2
  })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0
  ground.receiveShadow = true
  scene.add(ground)

  return { gridHelper, ground }
}
```

### Coordinate System

Three.js uses a right-handed coordinate system:

```
Y (Up)
│
│    Z (Forward)
│   ╱
│  ╱
│ ╱
└─────── X (Right)
```

---

## GLTFLoader Integration

### Model Loading

```typescript
const loadModel = async (
  url: string,
  onProgress?: (progress: number) => void
): Promise<THREE.Group> => {
  const loader = new GLTFLoader()

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        // Success callback
        console.log('Model loaded:', gltf)

        // Extract scene
        const model = gltf.scene

        // Process materials
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true
            child.receiveShadow = true

            // Fix material properties
            if (child.material) {
              child.material.side = THREE.FrontSide
              child.material.needsUpdate = true
            }
          }
        })

        resolve(model)
      },
      (progressEvent) => {
        // Progress callback
        if (progressEvent.lengthComputable && onProgress) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100
          onProgress(progress)
        }
      },
      (error) => {
        // Error callback
        console.error('Model load error:', error)
        reject(error)
      }
    )
  })
}
```

### Usage in Component

```typescript
useEffect(() => {
  if (!modelUrl || !scene) return

  let currentModel: THREE.Group | null = null

  const load = async () => {
    setLoading(true)
    setLoadingProgress(0)

    try {
      const model = await loadModel(modelUrl, (progress) => {
        setLoadingProgress(progress)
      })

      currentModel = model
      scene.add(model)

      // Center model
      const box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      model.position.sub(center)

      // Frame camera
      frameCameraToModel(model, camera, controls)

      // Extract model info
      const info = getModelInfo(model)
      onModelLoad?.(info)

      setLoading(false)
    } catch (error) {
      setModelLoadError(error.message)
      setLoading(false)
    }
  }

  load()

  return () => {
    if (currentModel) {
      scene.remove(currentModel)
      disposeObject(currentModel)
    }
  }
}, [modelUrl, scene])
```

### Model Information Extraction

```typescript
const getModelInfo = (model: THREE.Object3D): ModelInfo => {
  let vertices = 0
  let faces = 0
  const materials = new Set<THREE.Material>()

  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geometry = child.geometry

      if (geometry) {
        if (geometry.index) {
          faces += geometry.index.count / 3
        } else if (geometry.attributes.position) {
          faces += geometry.attributes.position.count / 3
        }

        vertices += geometry.attributes.position?.count || 0
      }

      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => materials.add(m))
        } else {
          materials.add(child.material)
        }
      }
    }
  })

  return {
    vertices,
    faces,
    materials: materials.size
  }
}
```

---

## Camera Configuration

### Perspective Camera Setup

```typescript
const setupCamera = (container: HTMLElement) => {
  const camera = new THREE.PerspectiveCamera(
    75,                                       // Field of view (degrees)
    container.clientWidth / container.clientHeight,  // Aspect ratio
    0.1,                                      // Near clipping plane
    1000                                      // Far clipping plane
  )

  // Initial position
  camera.position.set(1.5, 1.2, 1.5)

  // Look at target
  camera.lookAt(0, 0.8, 0)

  return camera
}
```

### Camera Framing

Auto-frame camera to fit model in view:

```typescript
const frameCameraToModel = (
  model: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls
) => {
  // Calculate bounding box
  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  // Calculate distance needed
  const maxDim = Math.max(size.x, size.y, size.z)
  const fov = camera.fov * (Math.PI / 180)
  let cameraDistance = Math.abs(maxDim / Math.sin(fov / 2))

  // Add padding
  cameraDistance *= 1.2

  // Position camera
  const direction = new THREE.Vector3(0.7, 0.5, 0.7).normalize()
  camera.position.copy(direction.multiplyScalar(cameraDistance).add(center))

  // Update controls target
  controls.target.copy(center)
  controls.update()

  // Update camera
  camera.lookAt(center)
  camera.updateProjectionMatrix()
}
```

### Resize Handling

```typescript
const handleResize = () => {
  if (!container) return

  const width = container.clientWidth
  const height = container.clientHeight

  // Update camera
  camera.aspect = width / height
  camera.updateProjectionMatrix()

  // Update renderer
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  // Update composer if using post-processing
  composer?.setSize(width, height)
}

window.addEventListener('resize', handleResize)
```

---

## OrbitControls

### Basic Setup

```typescript
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const setupControls = (
  camera: THREE.Camera,
  domElement: HTMLElement
) => {
  const controls = new OrbitControls(camera, domElement)

  // Damping (smooth motion)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  // Limits
  controls.minDistance = 0.5
  controls.maxDistance = 20

  controls.minPolarAngle = 0
  controls.maxPolarAngle = Math.PI / 2

  // Pan configuration
  controls.enablePan = true
  controls.panSpeed = 0.8
  controls.screenSpacePanning = true

  // Zoom configuration
  controls.enableZoom = true
  controls.zoomSpeed = 1.0

  // Rotation configuration
  controls.rotateSpeed = 0.5
  controls.autoRotate = false
  controls.autoRotateSpeed = 2.0

  // Target (look-at point)
  controls.target.set(0, 0.8, 0)

  controls.update()

  return controls
}
```

### Auto-Rotate

```typescript
const [autoRotate, setAutoRotate] = useState(false)

useEffect(() => {
  if (!controls) return

  controls.autoRotate = autoRotate
  controls.autoRotateSpeed = 2.0
}, [autoRotate, controls])

// In animation loop
const animate = () => {
  requestAnimationFrame(animate)

  // Update controls (required for damping and auto-rotate)
  controls.update()

  renderer.render(scene, camera)
}
```

### Reset Camera

```typescript
const resetCamera = () => {
  if (!camera || !controls || !model) return

  // Reset to default view
  camera.position.set(1.5, 1.2, 1.5)

  // Reset target
  controls.target.set(0, 0.8, 0)

  // Or re-frame to model
  frameCameraToModel(model, camera, controls)

  controls.update()
}
```

---

## Lighting Setup

### Three-Point Lighting

```typescript
const setupLighting = (scene: THREE.Scene) => {
  // Ambient light (global illumination)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  // Key light (main directional light)
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8)
  keyLight.position.set(5, 5, 5)
  keyLight.castShadow = true

  // Shadow configuration
  keyLight.shadow.camera.near = 0.1
  keyLight.shadow.camera.far = 50
  keyLight.shadow.camera.left = -10
  keyLight.shadow.camera.right = 10
  keyLight.shadow.camera.top = 10
  keyLight.shadow.camera.bottom = -10
  keyLight.shadow.mapSize.width = 2048
  keyLight.shadow.mapSize.height = 2048
  keyLight.shadow.bias = -0.0001

  scene.add(keyLight)

  // Fill light (soften shadows)
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
  fillLight.position.set(-5, 3, -5)
  scene.add(fillLight)

  // Rim light (edge highlighting)
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.2)
  rimLight.position.set(0, 5, -5)
  scene.add(rimLight)

  return { ambientLight, keyLight, fillLight, rimLight }
}
```

### Environment Map

```typescript
const setupEnvironment = async (scene: THREE.Scene) => {
  const loader = new THREE.CubeTextureLoader()
  loader.setPath('/textures/environment/')

  const envMap = await loader.loadAsync([
    'px.png', 'nx.png',
    'py.png', 'ny.png',
    'pz.png', 'nz.png'
  ])

  scene.environment = envMap
  scene.background = envMap

  return envMap
}
```

### Dynamic Lighting

Adjust lighting based on model type:

```typescript
const adjustLightingForAssetType = (type: string) => {
  if (type === 'character') {
    // Softer lighting for characters
    ambientLight.intensity = 0.8
    keyLight.intensity = 0.6
  } else if (type === 'weapon') {
    // Stronger lighting for metallic items
    ambientLight.intensity = 0.5
    keyLight.intensity = 1.0
  }
}
```

---

## SkinnedMesh Handling

### Detecting Skinned Meshes

```typescript
const findSkinnedMeshes = (object: THREE.Object3D): THREE.SkinnedMesh[] => {
  const skinnedMeshes: THREE.SkinnedMesh[] = []

  object.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      skinnedMeshes.push(child)
    }
  })

  return skinnedMeshes
}
```

### Skeleton Visualization

```typescript
const createSkeletonHelper = (skinnedMesh: THREE.SkinnedMesh) => {
  const helper = new THREE.SkeletonHelper(skinnedMesh)
  helper.material.linewidth = 2

  return helper
}

// Toggle skeleton visibility
const toggleSkeleton = () => {
  if (!skinnedMesh || !scene) return

  if (skeletonHelper) {
    scene.remove(skeletonHelper)
    skeletonHelper = null
  } else {
    skeletonHelper = createSkeletonHelper(skinnedMesh)
    scene.add(skeletonHelper)
  }
}
```

### Bone Hierarchy

```typescript
const logBoneStructure = (skinnedMesh: THREE.SkinnedMesh) => {
  const bones = skinnedMesh.skeleton.bones

  const boneHierarchy = bones.map(bone => ({
    name: bone.name,
    parent: bone.parent?.name || 'root',
    position: bone.position.toArray(),
    rotation: bone.rotation.toArray()
  }))

  console.table(boneHierarchy)

  return boneHierarchy
}
```

### Finding Specific Bones

```typescript
const findBoneByName = (
  object: THREE.Object3D,
  boneName: string
): THREE.Bone | null => {
  let foundBone: THREE.Bone | null = null

  object.traverse((child) => {
    if (child instanceof THREE.Bone && child.name === boneName) {
      foundBone = child
    }
  })

  return foundBone
}

// Example: Find hand bones
const leftHand = findBoneByName(model, 'LeftHand')
const rightHand = findBoneByName(model, 'RightHand')
```

---

## Animation Support

### Animation Mixer Setup

```typescript
const setupAnimations = (gltf: GLTF) => {
  const mixer = new THREE.AnimationMixer(gltf.scene)
  const clips = gltf.animations

  // Store clips
  const actions: Record<string, THREE.AnimationAction> = {}

  clips.forEach((clip) => {
    const action = mixer.clipAction(clip)
    actions[clip.name] = action
  })

  return { mixer, clips, actions }
}
```

### Playing Animations

```typescript
const playAnimation = (
  name: string,
  mixer: THREE.AnimationMixer,
  actions: Record<string, THREE.AnimationAction>
) => {
  // Stop current animation
  Object.values(actions).forEach(action => {
    action.stop()
  })

  // Play new animation
  const action = actions[name]
  if (action) {
    action.reset()
    action.play()
  }
}
```

### Animation Loop

```typescript
const clock = new THREE.Clock()

const animate = () => {
  requestAnimationFrame(animate)

  // Update animations
  const delta = clock.getDelta()
  if (mixer) {
    mixer.update(delta)
  }

  // Update controls
  controls.update()

  // Render
  renderer.render(scene, camera)
}
```

### Animation Controls

```typescript
interface AnimationControls {
  play: () => void
  pause: () => void
  stop: () => void
  setTimeScale: (scale: number) => void
  setLoop: (loop: boolean) => void
}

const createAnimationControls = (
  action: THREE.AnimationAction
): AnimationControls => {
  return {
    play: () => {
      action.paused = false
      action.play()
    },
    pause: () => {
      action.paused = true
    },
    stop: () => {
      action.stop()
    },
    setTimeScale: (scale: number) => {
      action.timeScale = scale
    },
    setLoop: (loop: boolean) => {
      action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce
    }
  }
}
```

---

## Resource Cleanup

### Disposing Objects

```typescript
const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    // Dispose geometry
    if (child instanceof THREE.Mesh) {
      if (child.geometry) {
        child.geometry.dispose()
      }

      // Dispose materials
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => disposeMaterial(material))
        } else {
          disposeMaterial(child.material)
        }
      }
    }
  })
}

const disposeMaterial = (material: THREE.Material) => {
  // Dispose textures
  Object.values(material).forEach(value => {
    if (value instanceof THREE.Texture) {
      value.dispose()
    }
  })

  // Dispose material
  material.dispose()
}
```

### Cleanup on Unmount

```typescript
useEffect(() => {
  // Setup...

  return () => {
    // Cancel animation frame
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current)
    }

    // Dispose scene objects
    if (scene) {
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          disposeObject(object)
        }
      })
    }

    // Dispose renderer
    if (renderer) {
      renderer.dispose()
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement)
      }
    }

    // Dispose controls
    if (controls) {
      controls.dispose()
    }
  }
}, [])
```

---

## Performance Optimization

### Level of Detail (LOD)

```typescript
const createLOD = (model: THREE.Object3D) => {
  const lod = new THREE.LOD()

  // High detail (close)
  lod.addLevel(model.clone(), 0)

  // Medium detail
  const mediumDetail = createSimplifiedModel(model, 0.5)
  lod.addLevel(mediumDetail, 5)

  // Low detail (far)
  const lowDetail = createSimplifiedModel(model, 0.25)
  lod.addLevel(lowDetail, 10)

  return lod
}
```

### Frustum Culling

```typescript
// Automatic in Three.js, but can be configured
mesh.frustumCulled = true
```

### Material Optimization

```typescript
const optimizeMaterials = (scene: THREE.Scene) => {
  const materials = new Map<string, THREE.Material>()

  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const material = child.material

      // Share identical materials
      const key = JSON.stringify({
        color: material.color,
        roughness: material.roughness,
        metalness: material.metalness
      })

      if (materials.has(key)) {
        child.material = materials.get(key)!
      } else {
        materials.set(key, material)
      }
    }
  })
}
```

### Geometry Merging

```typescript
const mergeGeometries = (objects: THREE.Mesh[]): THREE.BufferGeometry => {
  const geometries: THREE.BufferGeometry[] = []

  objects.forEach(mesh => {
    const geometry = mesh.geometry.clone()
    geometry.applyMatrix4(mesh.matrixWorld)
    geometries.push(geometry)
  })

  return BufferGeometryUtils.mergeGeometries(geometries)
}
```

### Render on Demand

Instead of continuous rendering:

```typescript
const [needsRender, setNeedsRender] = useState(false)

const render = () => {
  if (!needsRender) return

  renderer.render(scene, camera)
  setNeedsRender(false)
}

// Trigger render on changes
useEffect(() => {
  setNeedsRender(true)
}, [modelUrl, showWireframe, showGroundPlane])

// Animation frame
useEffect(() => {
  let frameId: number

  const animate = () => {
    frameId = requestAnimationFrame(animate)

    // Only render if needed
    if (needsRender || controls.autoRotate) {
      controls.update()
      render()
    }
  }

  animate()

  return () => cancelAnimationFrame(frameId)
}, [needsRender, controls])
```

### Memory Management

```typescript
// Monitor memory usage
const monitorMemory = () => {
  if (renderer.info) {
    console.log('Render info:', {
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles
    })
  }
}

// Call periodically in development
useEffect(() => {
  const interval = setInterval(monitorMemory, 5000)
  return () => clearInterval(interval)
}, [])
```

---

## Post-Processing

### Effect Composer Setup

```typescript
const setupPostProcessing = (
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: WebGPURenderer
) => {
  const composer = new EffectComposer(renderer)

  // Render pass (base)
  const renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)

  // SSAO (ambient occlusion)
  const ssaoPass = new SSAOPass(scene, camera, width, height)
  ssaoPass.kernelRadius = 16
  composer.addPass(ssaoPass)

  // Bloom
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.5,    // strength
    0.4,    // radius
    0.85    // threshold
  )
  composer.addPass(bloomPass)

  return composer
}

// Render with composer
const animate = () => {
  requestAnimationFrame(animate)
  controls.update()
  composer.render()  // Instead of renderer.render()
}
```

---

## Screenshot Capture

```typescript
const takeScreenshot = () => {
  if (!renderer) return

  // Render scene
  renderer.render(scene, camera)

  // Get data URL
  const dataURL = renderer.domElement.toDataURL('image/png')

  // Download
  const link = document.createElement('a')
  link.download = `screenshot_${Date.now()}.png`
  link.href = dataURL
  link.click()
}
```

---

## Model Export

```typescript
const exportModel = async (
  object: THREE.Object3D,
  filename: string
): Promise<void> => {
  const exporter = new GLTFExporter()

  return new Promise((resolve, reject) => {
    exporter.parse(
      object,
      (result) => {
        // Binary export
        if (result instanceof ArrayBuffer) {
          const blob = new Blob([result], { type: 'model/gltf-binary' })
          const url = URL.createObjectURL(blob)

          const link = document.createElement('a')
          link.href = url
          link.download = filename
          link.click()

          URL.revokeObjectURL(url)
          resolve()
        }
        // JSON export
        else {
          const json = JSON.stringify(result)
          const blob = new Blob([json], { type: 'application/json' })
          const url = URL.createObjectURL(blob)

          const link = document.createElement('a')
          link.href = url
          link.download = filename.replace('.glb', '.gltf')
          link.click()

          URL.revokeObjectURL(url)
          resolve()
        }
      },
      (error) => reject(error),
      { binary: true }  // Export as GLB
    )
  })
}
```

---

## Summary

Asset Forge's Three.js integration provides:

- **Robust scene management**: Proper setup and teardown
- **Efficient model loading**: GLTFLoader with progress tracking
- **Flexible camera system**: OrbitControls with auto-framing
- **Professional lighting**: Three-point lighting setup
- **Animation support**: Full skeletal animation playback
- **Resource cleanup**: Proper disposal prevents memory leaks
- **Performance optimization**: LOD, material sharing, render on demand
- **Post-processing**: SSAO and bloom effects

The Three.js architecture enables rich 3D visualization while maintaining performance across all workflows in Asset Forge.
