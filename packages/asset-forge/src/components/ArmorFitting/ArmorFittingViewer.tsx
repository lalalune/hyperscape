import React, { useRef, useImperativeHandle, forwardRef, useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, extend } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

// Extend R3F with Three.js objects
extend({ Group: THREE.Group, Scene: THREE.Scene })

// Type declarations for React Three Fiber JSX elements
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: any
      scene: any
      ambientLight: any
      directionalLight: any
      gridHelper: any
      primitive: any
      mesh: any
      boxGeometry: any
      sphereGeometry: any
      meshStandardMaterial: any
    }
  }
}

import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { MeshFittingService } from '../../services/fitting/MeshFittingService'
import { ArmorFittingService, BodyRegion, CollisionPoint } from '../../services/fitting/ArmorFittingService'

// Type declarations
interface AnimatedGLTF extends GLTF {
  animations: THREE.AnimationClip[]
}

declare global {
  interface Window {
    __visualizationGroup?: THREE.Group
  }
}

// Fitting parameter interfaces
interface ArmorFittingParams {
  iterations: number
  stepSize: number
  targetOffset: number
  sampleRate: number
  smoothingStrength: number
  smoothingRadius: number
  preserveFeatures?: boolean
  featureAngleThreshold?: number
  useImprovedShrinkwrap?: boolean
  preserveOpenings?: boolean
  pushInteriorVertices?: boolean
}

interface HelmetFittingParams {
  method?: 'auto' | 'manual'
  sizeMultiplier?: number
  fitTightness?: number
  verticalOffset?: number
  forwardOffset?: number
  rotation?: { x: number; y: number; z: number }
  attachToHead?: boolean
  showHeadBounds?: boolean
  showCollisionDebug?: boolean
}


// Simplified demo component that handles model loading
interface ModelDemoProps {
  avatarUrl?: string
  armorUrl?: string
  helmetUrl?: string
  showWireframe: boolean
  equipmentSlot: 'Head' | 'Spine2' | 'Pelvis'
  currentAnimation: 'tpose' | 'walking' | 'running'
  isAnimationPlaying: boolean
  onModelsReady: (meshes: {
    avatar: THREE.SkinnedMesh | null
    armor: THREE.Mesh | null
    helmet: THREE.Mesh | null
    helmetGroup?: THREE.Group | null
  }) => void
}

const ModelDemo: React.FC<ModelDemoProps> = ({
  avatarUrl,
  armorUrl,
  helmetUrl,
  showWireframe,
  equipmentSlot,
  currentAnimation,
  isAnimationPlaying,
  onModelsReady
}) => {
  const avatarRef = useRef<THREE.Group>(null)
  const armorRef = useRef<THREE.Group>(null)
  const helmetRef = useRef<THREE.Group>(null)
  
  // Track loaded URLs to prevent unnecessary reloads
  const loadedUrlsRef = useRef({
    avatar: '',
    armor: '',
    helmet: ''
  })
  
  // Animation state
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const needsAnimationFile = currentAnimation !== 'tpose'
  
  // Construct animation file path based on the model if animation is needed
  const animationPath = useMemo(() => {
    if (needsAnimationFile && avatarUrl) {
      // Handle API paths (/api/assets/{id}/model)
      const apiMatch = avatarUrl.match(/\/api\/assets\/([^/]+)\/model/)
      if (apiMatch) {
        const assetId = apiMatch[1]
        const animFileName = currentAnimation === 'walking' ? 'anim_walk.glb' : 'anim_run.glb'
        // Use the API endpoint to get animation files
        return `/api/assets/${assetId}/${animFileName}`
      }
      
      // Handle direct gdd-assets paths (for local testing)
      const gddMatch = avatarUrl.match(/gdd-assets\/([^/]+)\//)
      if (gddMatch) {
        const characterName = gddMatch[1]
        const animFileName = currentAnimation === 'walking' ? 'anim_walk.glb' : 'anim_run.glb'
        return `./gdd-assets/${characterName}/${animFileName}`
      }
    }
    return null
  }, [avatarUrl, currentAnimation, needsAnimationFile])
  
  // Load animation file if available
  const [animationGltf, setAnimationGltf] = useState<AnimatedGLTF | null>(null)
  
  useEffect(() => {
    if (!animationPath) {
      setAnimationGltf(null)
      return
    }
    
    const loader = new GLTFLoader()
    
    // Check if the animation file exists
    fetch(animationPath, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          console.log('Loading animation from:', animationPath)
          loader.load(
            animationPath,
            (gltf: GLTF) => {
              console.log('Animation loaded successfully:', animationPath)
              console.log('Animation count:', gltf.animations.length)
              setAnimationGltf(gltf as AnimatedGLTF)
            },
            undefined,
            (error: unknown) => {
              throw new Error(`Failed to load animation file: ${error}`)
            }
          )
        } else {
          console.log(`Animation file not found (404): ${animationPath}`)
          setAnimationGltf(null)
        }
      })
  }, [animationPath])
  
  // Load models when URLs change
  useEffect(() => {
    let avatarMesh: THREE.SkinnedMesh | null = null
    let armorMesh: THREE.Mesh | null = null
    let helmetMesh: THREE.Mesh | null = null
    
    const loadModels = async () => {
      const loader = new GLTFLoader()
      
      // Load avatar only if URL changed
      if (avatarUrl && avatarRef.current && avatarUrl !== loadedUrlsRef.current.avatar) {
        const gltf = await loader.loadAsync(avatarUrl)
        avatarRef.current.clear()
        avatarRef.current.add(gltf.scene)
        loadedUrlsRef.current.avatar = avatarUrl
        
        // Store gltf data on the scene for animation access
        gltf.scene.userData.gltf = gltf
        
        // Find skinned mesh
        gltf.scene.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.SkinnedMesh && !avatarMesh) {
            avatarMesh = child
            avatarMesh.userData.isAvatar = true
          }
        })
        
        console.log('Avatar loaded with animations:', gltf.animations.length)
        if (gltf.animations.length > 0) {
          gltf.animations.forEach((clip: THREE.AnimationClip) => {
            console.log(`- Built-in animation: "${clip.name}" (${clip.duration}s)`)
          })
        }
        
        // Normalize scale
        const bounds = new THREE.Box3().setFromObject(avatarMesh!)
        const height = bounds.getSize(new THREE.Vector3()).y
        const scale = 2 / height // Normalize to 2 units tall
        avatarRef.current!.scale.setScalar(scale)
      } else if (avatarUrl && avatarRef.current) {
        // URL exists but already loaded - find the mesh
        avatarRef.current.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && !avatarMesh) {
            avatarMesh = child
          }
        })
        console.log('Avatar already loaded, reusing existing mesh')
      }
      
      // Clear armor if not in Spine2 mode or no URL
      if (!armorUrl || equipmentSlot !== 'Spine2') {
        if (armorRef.current) {
          armorRef.current.clear()
          loadedUrlsRef.current.armor = ''
          armorRef.current.userData.transformCaptured = false
        }
      }
      // Load armor only if URL changed
      else if (armorUrl && equipmentSlot === 'Spine2' && armorRef.current && armorUrl !== loadedUrlsRef.current.armor) {
        const gltf = await loader.loadAsync(armorUrl)
        armorRef.current.clear()
        armorRef.current.add(gltf.scene)
        loadedUrlsRef.current.armor = armorUrl
        
        // Find mesh
        gltf.scene.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh && !armorMesh) {
            armorMesh = child
            armorMesh.userData.isArmor = true
            armorMesh.userData.isEquipment = true
            armorMesh.userData.equipmentSlot = 'Spine2'
          }
        })
        
        // Match avatar scale
        armorRef.current.scale.copy(avatarRef.current!.scale)
      } else if (armorUrl && equipmentSlot === 'Spine2' && armorRef.current) {
        // URL exists but already loaded - find the mesh
        armorRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh && !armorMesh) {
            armorMesh = child
          }
        })
      }
      
      // Clear helmet if not in Head mode or no URL
      if (!helmetUrl || equipmentSlot !== 'Head') {
        if (helmetRef.current) {
          // Clear transform captured flag before clearing
          helmetRef.current.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData.transformCaptured) {
              child.userData.transformCaptured = false
              child.userData.originalTransform = null
              child.userData.originalParent = null
            }
          })
          helmetRef.current.clear()
          loadedUrlsRef.current.helmet = ''
        }
      }
      // Load helmet only if URL changed
      else if (helmetUrl && equipmentSlot === 'Head' && helmetRef.current && helmetUrl !== loadedUrlsRef.current.helmet) {
        const gltf = await loader.loadAsync(helmetUrl)
        
        // Only clear and reload if the helmet isn't fitted
        const existingHelmet = helmetRef.current.children[0]?.children[0] as THREE.Mesh
        if (!existingHelmet?.userData.hasBeenFitted) {
          helmetRef.current.clear()
          helmetRef.current.add(gltf.scene)
          loadedUrlsRef.current.helmet = helmetUrl
        }
        
        // Find mesh and store the gltf scene reference
        const gltfScene = gltf.scene
        gltfScene.userData.isGltfRoot = true // Mark this as the GLTF root
        
        gltf.scene.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh && !helmetMesh) {
            helmetMesh = child
            helmetMesh.userData.isHelmet = true
            helmetMesh.userData.isEquipment = true
            helmetMesh.userData.equipmentSlot = 'Head'
            helmetMesh.userData.gltfRoot = gltfScene // Store reference to GLTF root
            console.log('Found helmet mesh:', helmetMesh.name || 'unnamed')
            console.log('Helmet parent after loading:', helmetMesh.parent?.name || 'unknown')
          }
        })
        
        // Log the structure
        console.log('Helmet structure after loading:')
        console.log('- helmetRef.current:', helmetRef.current)
        console.log('- gltf.scene:', gltf.scene)
        console.log('- helmetMesh found:', !!helmetMesh)
        
        // Don't scale helmet - let fitting algorithm handle it
        // This matches MeshFittingDebugger behavior
        
        // Store original helmet transform immediately when loaded
        // Match MeshFittingDebugger's approach exactly
        helmetMesh!.updateMatrixWorld(true)
        
        const originalTransform = {
          position: helmetMesh!.position.clone(),
          rotation: helmetMesh!.rotation.clone(),
          scale: helmetMesh!.scale.clone()
        }
        
        // Store the original parent for proper reset
        helmetMesh!.userData.originalParent = helmetMesh!.parent
        helmetMesh!.userData.originalTransform = originalTransform
        helmetMesh!.userData.transformCaptured = true
        
        console.log('Captured original helmet transform:', originalTransform)
        console.log('Original helmet parent:', helmetMesh!.parent?.name || 'scene')
        console.log('Is position at origin?', helmetMesh!.position.length() < 0.001)
      } else if (helmetUrl && equipmentSlot === 'Head' && helmetRef.current) {
        // URL exists but already loaded - find the mesh
        helmetRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh && !helmetMesh) {
            helmetMesh = child
          }
        })
      }
      
      // Notify parent only if we have meshes
      if (avatarMesh || armorMesh || helmetMesh) {
        onModelsReady({ avatar: avatarMesh, armor: armorMesh, helmet: helmetMesh, helmetGroup: helmetRef.current })
      }
    }
    
    loadModels()
  }, [avatarUrl, armorUrl, helmetUrl, equipmentSlot, onModelsReady])
  
  // Apply wireframe
  useEffect(() => {
    if (armorRef.current) {
      armorRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.wireframe = showWireframe
        }
      })
    }
    if (helmetRef.current) {
      helmetRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.wireframe = showWireframe
        }
      })
    }
  }, [showWireframe])
  
  // Handle animation playback
  useEffect(() => {
    if (!avatarRef.current) return
    
    console.log('Animation useEffect triggered:', { currentAnimation, isAnimationPlaying })
    
    // Find the avatar mesh
    let avatarMesh: THREE.SkinnedMesh | null = null
    avatarRef.current.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && !avatarMesh) {
            avatarMesh = child
          }
        })
    
    if (!avatarMesh) {
      console.log('No avatar mesh found')
      return
    }
    
    // Create or recreate mixer for the avatar group (not just the mesh)
    if (mixerRef.current) {
      mixerRef.current.stopAllAction()
      mixerRef.current = null
    }
    
    mixerRef.current = new THREE.AnimationMixer(avatarRef.current)
    const mixer = mixerRef.current
    
    if (isAnimationPlaying && currentAnimation !== 'tpose') {
      // Get animations from loaded GLB
      let animations: THREE.AnimationClip[] = []
      
      // Check if animation file has animations
      if (animationGltf?.animations && animationGltf.animations.length > 0) {
        animations = animationGltf.animations
        console.log(`Using animations from ${currentAnimation} file:`, animations.length)
        } else {
        console.log('No animations found in animation file')
        avatarRef.current.traverse((child) => {
          if (child.userData?.gltf?.animations && child.userData.gltf.animations.length > 0) {
            animations = child.userData.gltf.animations
            console.log('Found animations in child userData:', animations.length)
          }
        })
        
        // Also check the group itself
        const avatarGltf = avatarRef.current.children[0]?.userData?.gltf as AnimatedGLTF | undefined
        if (!animations.length && avatarGltf?.animations) {
          animations = avatarGltf.animations
          console.log('Using animations from base model:', animations.length)
        }
      }
      
      if (animations.length > 0) {
        // Log available animations
        animations.forEach(clip => {
          console.log(`Available animation: "${clip.name}" (duration: ${clip.duration}s)`)
        })
        
        // Find the appropriate animation clip
        let targetClip: THREE.AnimationClip | null = null
        
        if (currentAnimation === 'walking') {
          targetClip = animations.find((clip) => {
            const name = clip.name.toLowerCase()
            return (name.includes('walk') || name.includes('walking')) && 
                   !name.includes('run') && !name.includes('running')
          }) || animations[0]
        } else if (currentAnimation === 'running') {
          targetClip = animations.find((clip) => {
            const name = clip.name.toLowerCase()
            return (name.includes('run') || name.includes('running')) && 
                   !name.includes('walk') && !name.includes('walking')
          }) || animations[0]
        }
        
        if (targetClip) {
          console.log(`Playing animation: "${targetClip.name}"`)
          const action = mixer.clipAction(targetClip, avatarRef.current)
          action.reset()
          action.setLoop(THREE.LoopRepeat, Infinity)
          action.play()
        } else {
          console.log('No suitable animation clip found')
        }
      } else {
        console.log('No animations available for this avatar')
        // Note: Some avatars may not have built-in animations
        // Animation files (anim_walk.glb, anim_run.glb) may need to be added to the asset directory
      }
    }
    
    return () => {
      if (mixer) {
        mixer.stopAllAction()
      }
    }
  }, [currentAnimation, isAnimationPlaying, animationGltf, avatarUrl])
  
  // Animation update loop
  useFrame((state, delta) => {
    if (mixerRef.current && isAnimationPlaying && currentAnimation !== 'tpose') {
      mixerRef.current.update(delta)
    }
  })
  
  return (
    <>
      <group ref={avatarRef} />
      <group ref={armorRef} />
      <group ref={helmetRef} />
    </>
  )
}

// Scene component similar to debugger
interface SceneProps {
  avatarUrl?: string
  armorUrl?: string
  helmetUrl?: string
  showWireframe: boolean
  equipmentSlot: 'Head' | 'Spine2' | 'Pelvis'
  currentAnimation: 'tpose' | 'walking' | 'running'
  isAnimationPlaying: boolean
  visualizationGroup?: THREE.Group
  onModelsLoaded: (meshes: {
    avatar: THREE.SkinnedMesh | null
    armor: THREE.Mesh | null
    helmet: THREE.Mesh | null
    scene: THREE.Scene
    helmetGroup?: THREE.Group | null
  }) => void
}

const Scene: React.FC<SceneProps> = ({
  avatarUrl,
  armorUrl,
  helmetUrl,
  showWireframe,
  equipmentSlot,
  currentAnimation,
  isAnimationPlaying,
  visualizationGroup,
  onModelsLoaded
}) => {
  const sceneRef = useRef<THREE.Scene>(null!)
  
  useEffect(() => {
    if (sceneRef.current) {
      console.log('Scene initialized')
      

    }
  }, [])
  
  const handleModelsReady = (meshes: {
    avatar: THREE.SkinnedMesh | null
    armor: THREE.Mesh | null
    helmet: THREE.Mesh | null
    helmetGroup?: THREE.Group | null
  }) => {
    console.log('Models ready in scene:', {
      avatar: !!meshes.avatar,
      armor: !!meshes.armor,
      helmet: !!meshes.helmet
    })
    
    onModelsLoaded({
      ...meshes,
      scene: sceneRef.current
    })
  }
  
  return (
    <scene ref={sceneRef}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <OrbitControls />
      
      <ModelDemo
        avatarUrl={avatarUrl}
        armorUrl={armorUrl}
        helmetUrl={helmetUrl}
        showWireframe={showWireframe}
        equipmentSlot={equipmentSlot}
        currentAnimation={currentAnimation}
        isAnimationPlaying={isAnimationPlaying}
        onModelsReady={handleModelsReady}
      />
      
      <gridHelper args={[10, 10]} />
      
      {/* Add visualization group if provided */}
      {visualizationGroup && <primitive object={visualizationGroup} />}
    </scene>
  )
}

// Main viewer component
export interface ArmorFittingViewerRef {
  // Mesh access
  getMeshes: () => {
    avatar: THREE.SkinnedMesh | null
    armor: THREE.Mesh | null
    helmet: THREE.Mesh | null
    scene: THREE.Scene | null
  }
  
  // Fitting operations
  performFitting: (params: ArmorFittingParams) => void
  performHelmetFitting: (params: HelmetFittingParams) => Promise<void>
  attachHelmetToHead: () => void
  detachHelmetFromHead: () => void
  transferWeights: () => void
  
  // Export
  exportFittedModel: () => Promise<ArrayBuffer>
  
  // Transform operations
  resetTransform: () => void
  
  // Clear specific meshes
  clearHelmet: () => void
  clearArmor: () => void
}

interface ArmorFittingViewerProps {
  avatarUrl?: string
  armorUrl?: string
  helmetUrl?: string
  showWireframe: boolean
  equipmentSlot: 'Head' | 'Spine2' | 'Pelvis'
  selectedAvatar?: { name: string } | null
  onModelsLoaded?: () => void
  currentAnimation?: 'tpose' | 'walking' | 'running'
  isAnimationPlaying?: boolean
  visualizationMode?: 'none' | 'regions' | 'collisions' | 'weights'
  selectedBone?: number
  onBodyRegionsDetected?: (regions: Map<string, BodyRegion>) => void
  onCollisionsDetected?: (collisions: CollisionPoint[]) => void
}

export const ArmorFittingViewer = forwardRef<
  ArmorFittingViewerRef,
  ArmorFittingViewerProps
>((props, ref) => {
  const { avatarUrl, armorUrl, helmetUrl, showWireframe, equipmentSlot, selectedAvatar } = props
  
  // Mesh references
  const avatarMeshRef = useRef<THREE.SkinnedMesh | null>(null)
  const armorMeshRef = useRef<THREE.Mesh | null>(null)
  const helmetMeshRef = useRef<THREE.Mesh | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  
  // Services
  const genericFittingService = useRef(new MeshFittingService())
  const armorFittingService = useRef(new ArmorFittingService())
  
  // Original geometry storage
  const originalArmorGeometryRef = useRef<THREE.BufferGeometry | null>(null)
  const originalHelmetTransformRef = useRef<{
    position: THREE.Vector3
    rotation: THREE.Euler
    scale: THREE.Vector3
  } | null>(null)
  
  const helmetGroupRef = useRef<THREE.Group | null>(null)
  
  // Visualization state
  const visualizationGroupRef = useRef<THREE.Group>((() => {
    const group = new THREE.Group()
    group.name = 'visualization'
    return group
  })())
  const [bodyRegions, setBodyRegions] = useState<Map<string, BodyRegion> | null>(null)
  const [collisions, setCollisions] = useState<CollisionPoint[] | null>(null)
  const visualizationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastComputedAvatar = useRef<string | null>(null)
  const lastComputedArmor = useRef<string | null>(null)
  
  // Detach helmet function that can be used by both reset and imperative handle
  const detachHelmetFromHeadInternal = () => {
    if (!helmetMeshRef.current) {
      console.error('No helmet to detach')
      return
    }
    
    const scene = sceneRef.current
    if (!scene) return
    
    // Make sure helmet is visible
    helmetMeshRef.current.visible = true
    helmetMeshRef.current.traverse((child) => {
      child.visible = true
    })
    
    // Remove from parent and add back to scene
    if (helmetMeshRef.current.parent) {
      // Use attach() which preserves world transform
      scene.attach(helmetMeshRef.current)
      
      helmetMeshRef.current.userData.isAttached = false
      console.log('Helmet detached from head')
    }
  }
  
  const handleModelsLoaded = (meshes: {
    avatar: THREE.SkinnedMesh | null
    armor: THREE.Mesh | null
    helmet: THREE.Mesh | null
    scene: THREE.Scene
    helmetGroup?: THREE.Group | null
  }) => {
    console.log('=== MODELS LOADED IN VIEWER ===')
    avatarMeshRef.current = meshes.avatar
    armorMeshRef.current = meshes.armor
    helmetMeshRef.current = meshes.helmet
    sceneRef.current = meshes.scene
    helmetGroupRef.current = meshes.helmetGroup || null
    
    // Log mesh details
    if (meshes.helmet) {
      console.log('Helmet mesh details:')
      console.log('- Type:', meshes.helmet.type)
      console.log('- Geometry vertices:', meshes.helmet.geometry?.attributes.position?.count)
      console.log('- Parent:', meshes.helmet.parent?.name || 'unknown')
      
      // Check if this is actually the mesh or a group
      if (meshes.helmet.type !== 'Mesh') {
        console.warn('WARNING: Helmet reference is not a Mesh, it\'s a', meshes.helmet.type)
      }
    }
    
    // Log avatar details
    if (meshes.avatar) {
      console.log('Avatar mesh details:')
      console.log('- Type:', meshes.avatar.type)
      console.log('- Has skeleton:', !!meshes.avatar.skeleton)
      console.log('- Parent:', meshes.avatar.parent?.name || 'unknown')
      
      // Get avatar bounds
      const avatarBounds = new THREE.Box3().setFromObject(meshes.avatar)
      const avatarSize = avatarBounds.getSize(new THREE.Vector3())
      console.log('Avatar bounds:', avatarBounds)
      console.log('Avatar size:', avatarSize)
      console.log('Avatar scale:', meshes.avatar.scale)
      
      // Check parent scale
      if (meshes.avatar.parent) {
        console.log('Avatar parent scale:', meshes.avatar.parent.scale)
      }
    }
    
    // Store original geometry
    if (meshes.armor) {
      originalArmorGeometryRef.current = meshes.armor.geometry.clone()
    }
    
    // Use the original transform that was captured when helmet was loaded
    if (meshes.helmet) {
      if (meshes.helmet.userData.originalTransform) {
        originalHelmetTransformRef.current = meshes.helmet.userData.originalTransform
        console.log('Using original helmet transform from mesh userData:', originalHelmetTransformRef.current)
      } else {
        // Capture it now if not already captured
        originalHelmetTransformRef.current = {
          position: meshes.helmet.position.clone(),
          rotation: meshes.helmet.rotation.clone(),
          scale: meshes.helmet.scale.clone()
        }
        meshes.helmet.userData.originalTransform = originalHelmetTransformRef.current
        meshes.helmet.userData.originalParent = meshes.helmet.parent
        console.log('Captured original helmet transform in handleModelsLoaded:', originalHelmetTransformRef.current)
      }
      
      // Get helmet bounds for debugging
      const helmetBounds = new THREE.Box3().setFromObject(meshes.helmet)
      const helmetSize = helmetBounds.getSize(new THREE.Vector3())
      console.log('Helmet initial bounds:', helmetBounds)
      console.log('Helmet size:', helmetSize)
      
      // Also check parent scale
      if (meshes.helmet.parent) {
        console.log('Helmet parent scale:', meshes.helmet.parent.scale)
      }
    }
    
    // Add visualization group to scene
    if (meshes.scene && visualizationGroupRef.current) {
      meshes.scene.add(visualizationGroupRef.current)
      console.log('Added visualization group to scene')
      // Store globally for Scene component access
      window.__visualizationGroup = visualizationGroupRef.current
    }
    
    // Compute body regions if avatar changed
    if (meshes.avatar && meshes.avatar.skeleton && props.avatarUrl !== lastComputedAvatar.current) {
      console.log('Computing body regions for new avatar...')
      const detectedRegions = armorFittingService.current.computeBodyRegions(meshes.avatar, meshes.avatar.skeleton)
      setBodyRegions(detectedRegions)
      props.onBodyRegionsDetected?.(detectedRegions)
      lastComputedAvatar.current = props.avatarUrl || null
    }
    
    // Compute collisions if either mesh changed
    if (meshes.avatar && meshes.armor && 
        (props.avatarUrl !== lastComputedAvatar.current || props.armorUrl !== lastComputedArmor.current)) {
      console.log('Detecting collisions for current meshes...')
      const detectedCollisions = armorFittingService.current.detectCollisions(meshes.avatar, meshes.armor)
      setCollisions(detectedCollisions)
      props.onCollisionsDetected?.(detectedCollisions)
      lastComputedArmor.current = props.armorUrl || null
      console.log(`Detected ${detectedCollisions.length} collisions`)
    }
    
    props.onModelsLoaded?.()
  }
  
  // Visualization functions
  const clearVisualization = () => {
    visualizationGroupRef.current.clear()
  }
  
  const restoreOriginalMaterials = () => {
    if (avatarMeshRef.current && avatarMeshRef.current.userData.originalMaterial) {
      // Also remove any vertex colors that were added
      if (avatarMeshRef.current.geometry.attributes.color) {
        avatarMeshRef.current.geometry.deleteAttribute('color')
      }
      avatarMeshRef.current.material = avatarMeshRef.current.userData.originalMaterial
      delete avatarMeshRef.current.userData.originalMaterial
    }
  }
  
  const visualizeBodyRegions = () => {
    if (!bodyRegions || bodyRegions.size === 0) {
      console.log('No body regions to visualize')
      return
    }
    
    clearVisualization()
    
    const colors = {
      head: 0xff0000,
      torso: 0x00ff00,
      arms: 0x0000ff,
      legs: 0xffff00,
      hips: 0xff00ff
    }
    
    bodyRegions.forEach((region, name) => {
      const color = colors[name as keyof typeof colors] || 0xffffff
      
      // Create bounding box helper
      const helper = new THREE.Box3Helper(region.boundingBox, new THREE.Color(color))
      visualizationGroupRef.current.add(helper)
    })
    
    console.log('Visualization group children:', visualizationGroupRef.current.children.length)
  }
  
  const visualizeCollisions = () => {
    if (!collisions || collisions.length === 0) {
      console.log('No collisions to visualize')
      return
    }
    
    clearVisualization()
    
    const sphereGeometry = new THREE.SphereGeometry(0.01, 8, 8)
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    
    collisions.forEach(collision => {
      const sphere = new THREE.Mesh(sphereGeometry, material)
      sphere.position.copy(collision.position)
      visualizationGroupRef.current.add(sphere)
      
      // Add line showing push direction
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        collision.position,
        collision.position.clone().add(collision.normal.clone().multiplyScalar(collision.penetrationDepth))
      ])
      const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xff0000 }))
      visualizationGroupRef.current.add(line)
    })
  }
  
  const visualizeWeights = () => {
    if (!avatarMeshRef.current) return
    
    // Check if the mesh is actually skinned
    if (!(avatarMeshRef.current instanceof THREE.SkinnedMesh)) {
      console.warn('Avatar mesh is not a SkinnedMesh, cannot visualize weights')
      return
    }
    
    // Clear any pending visualization
    if (visualizationTimeoutRef.current) {
      clearTimeout(visualizationTimeoutRef.current)
      visualizationTimeoutRef.current = null
    }
    
    // Always restore original material first to avoid conflicts
    restoreOriginalMaterials()
    
    // Small delay to ensure cleanup is complete
    visualizationTimeoutRef.current = setTimeout(() => {
      if (!avatarMeshRef.current) return
      
      // Store original material if not already stored
      if (!avatarMeshRef.current.userData.originalMaterial) {
        avatarMeshRef.current.userData.originalMaterial = avatarMeshRef.current.material
      }
      
      // Create a simple color-based visualization without custom shaders
      const geometry = avatarMeshRef.current.geometry
      if (!geometry.attributes.skinIndex || !geometry.attributes.skinWeight) {
        console.warn('Mesh does not have skinning attributes')
        return
      }
      
      // Create vertex colors based on bone weights
      const colors = new Float32Array(geometry.attributes.position.count * 3)
      const skinIndices = geometry.attributes.skinIndex
      const skinWeights = geometry.attributes.skinWeight
      const selectedBone = props.selectedBone || 0
      
      for (let i = 0; i < geometry.attributes.position.count; i++) {
        let weight = 0
        
        // Check if this vertex is influenced by the selected bone
        for (let j = 0; j < 4; j++) {
          const idx = skinIndices.getComponent(i, j)
          if (Math.abs(idx - selectedBone) < 0.5) {
            weight = skinWeights.getComponent(i, j)
            break
          }
        }
        
        // Convert weight to color (heatmap)
        let r = 0, g = 0, b = 0
        if (weight < 0.25) {
          // Blue to Cyan
          r = 0
          g = weight * 4
          b = 1
        } else if (weight < 0.5) {
          // Cyan to Green
          r = 0
          g = 1
          b = 1 - (weight - 0.25) * 4
        } else if (weight < 0.75) {
          // Green to Yellow
          r = (weight - 0.5) * 4
          g = 1
          b = 0
        } else {
          // Yellow to Red
          r = 1
          g = 1 - (weight - 0.75) * 4
          b = 0
        }
        
        colors[i * 3] = r
        colors[i * 3 + 1] = g
        colors[i * 3 + 2] = b
      }
      
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      
      // Use a simple material with vertex colors
      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide
      })
      
      avatarMeshRef.current.material = material
    }, 50)
  }
  
  // Effect to handle visualization mode changes
  useEffect(() => {
    if (!sceneRef.current) return
    
    // Clear previous visualization
    restoreOriginalMaterials()
    clearVisualization()
    
    // Apply new visualization
    switch (props.visualizationMode) {
      case 'regions':
        visualizeBodyRegions()
        break
      case 'collisions':
        visualizeCollisions()
        break
      case 'weights':
        visualizeWeights()
        break
    }
    
    return () => {
      if (visualizationTimeoutRef.current) {
        clearTimeout(visualizationTimeoutRef.current)
      }
    }
  }, [props.visualizationMode, props.selectedBone, bodyRegions, collisions])
  
  useImperativeHandle(ref, () => ({
    getMeshes: () => ({
      avatar: avatarMeshRef.current,
      armor: armorMeshRef.current,
      helmet: helmetMeshRef.current,
      scene: sceneRef.current
    }),
    
    performFitting: (params: ArmorFittingParams) => {
      const armorMesh = armorMeshRef.current!
      const avatarMesh = avatarMeshRef.current!
      const scene = sceneRef.current!
      
      console.log('=== ARMOR TO TORSO FITTING ===')
      console.log('Performing armor fitting with params:', params)
      
      // Update entire scene before any calculations
      const updateSceneMatrices = (scene: THREE.Scene) => {
        scene.updateMatrixWorld(true)
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) {
            obj.updateMatrix()
            obj.updateMatrixWorld(true)
          }
        })
      }
      updateSceneMatrices(scene)
      console.log('Updated scene matrix world before fitting')
      
      // Detect body regions for visualization
      console.log('Computing body regions...')
      const detectedRegions = armorFittingService.current.computeBodyRegions(avatarMesh, avatarMesh.skeleton!)
      setBodyRegions(detectedRegions)
      props.onBodyRegionsDetected?.(detectedRegions)
      
      // Store parent references
      const avatarParent = avatarMesh.parent
      const armorParent = armorMesh.parent
      
      // Log current state
      console.log('=== PRE-FITTING STATE CHECK ===')
      console.log('Armor scale:', armorMesh.scale.clone())
      console.log('Armor position:', armorMesh.position.clone())
      console.log('Armor parent scale:', armorMesh.parent?.scale.clone())
      console.log('Has been fitted before:', armorMesh.userData.hasBeenFitted)
      
      // Ensure armor starts at scale 1,1,1
      if (armorMesh.scale.x !== 1 || armorMesh.scale.y !== 1 || armorMesh.scale.z !== 1) {
        console.warn('⚠️ Armor scale is not 1,1,1! Resetting scale before fitting.')
        armorMesh.scale.set(1, 1, 1)
        armorMesh.updateMatrixWorld(true)
      }
      
      // Calculate scale ratio between avatar and armor
      const calculateScaleRatio = (avatar: THREE.SkinnedMesh, armor: THREE.Mesh): number => {
        const avatarBounds = new THREE.Box3().setFromObject(avatar)
        const armorBounds = new THREE.Box3().setFromObject(armor)
        const avatarSize = avatarBounds.getSize(new THREE.Vector3())
        const armorSize = armorBounds.getSize(new THREE.Vector3())
        const avgAvatarDim = (avatarSize.x + avatarSize.y + avatarSize.z) / 3
        const avgArmorDim = (armorSize.x + armorSize.y + armorSize.z) / 3
        return avgArmorDim / avgAvatarDim
      }
      
      // Check and normalize scales
      console.log('=== SCALE ANALYSIS ===')
      const scaleRatio = calculateScaleRatio(avatarMesh, armorMesh)
      console.log('Scale ratio (armor/avatar):', scaleRatio)
      
      // Normalize armor scale if needed
      if (Math.abs(scaleRatio - 1.0) > 0.1) {
        console.warn(`SCALE MISMATCH DETECTED: Armor is ${scaleRatio.toFixed(1)}x the size of avatar`)
        const normalizationFactor = 1 / scaleRatio
        armorMesh.scale.multiplyScalar(normalizationFactor)
        armorMesh.updateMatrixWorld(true)
        console.log('Applied normalization factor:', normalizationFactor)
      }
      
      // Calculate torso bounds - matching debugger implementation
      const calculateTorsoBounds = (avatarMesh: THREE.SkinnedMesh) => {
        const avatarBounds = new THREE.Box3().setFromObject(avatarMesh)
        const avatarSize = avatarBounds.getSize(new THREE.Vector3())
        const avatarCenter = avatarBounds.getCenter(new THREE.Vector3())
        
        console.log('Avatar bounds:', avatarBounds)
        console.log('Avatar height:', avatarSize.y)
        
        const skeleton = avatarMesh.skeleton!
        
        // Update transforms
        avatarMesh.updateMatrix()
        avatarMesh.updateMatrixWorld(true)
        skeleton.bones.forEach(bone => {
          bone.updateMatrixWorld(true)
        })
        
        // Use simple proportional calculation
        let torsoTop = 0
        let torsoBottom = 0
        let headY: number | null = null
        let shoulderY: number | null = null
        let chestY: number | null = null
        
        skeleton.bones.forEach(bone => {
          const boneName = bone.name.toLowerCase()
          const bonePos = new THREE.Vector3()
          bone.getWorldPosition(bonePos)
          
          if (boneName.includes('head') && !boneName.includes('end')) {
            if (headY === null || bonePos.y > headY) {
              headY = bonePos.y
            }
          }
          if (boneName.includes('shoulder') || boneName.includes('clavicle')) {
            if (shoulderY === null || bonePos.y > shoulderY) {
              shoulderY = bonePos.y
            }
          }
          if (boneName.includes('spine02') || boneName.includes('chest')) {
            chestY = bonePos.y
          }
        })
        
        // Detect character anatomy type
        let isHunchedCharacter = false
        if (headY !== null && shoulderY !== null) {
          const headShoulderDiff = Math.abs(headY - shoulderY)
          isHunchedCharacter = headShoulderDiff < 0.1
          console.log(`Head Y: ${(headY as number).toFixed(3)}, Shoulder Y: ${(shoulderY as number).toFixed(3)}, Difference: ${headShoulderDiff.toFixed(3)}`)
          if (isHunchedCharacter) {
            console.log('⚠️ Detected hunched character anatomy')
          }
        }
        
        if (isHunchedCharacter && chestY !== null) {
          torsoTop = chestY + 0.05
          torsoBottom = avatarBounds.min.y + avatarSize.y * 0.15
        } else if (shoulderY !== null && !isHunchedCharacter) {
          torsoTop = shoulderY
          torsoBottom = avatarBounds.min.y + avatarSize.y * 0.15
        } else {
          torsoBottom = avatarBounds.min.y + avatarSize.y * 0.15
          torsoTop = avatarBounds.min.y + avatarSize.y * 0.6
        }
        
        const torsoCenter = new THREE.Vector3(
          avatarCenter.x,
          (torsoBottom + torsoTop) / 2,
          avatarCenter.z
        )
        const torsoSize = new THREE.Vector3(
          avatarSize.x * 0.6,
          torsoTop - torsoBottom,
          avatarSize.z * 0.5
        )
        const torsoBounds = new THREE.Box3()
        torsoBounds.setFromCenterAndSize(torsoCenter, torsoSize)
        
        console.log('Torso Y range:', torsoBounds.min.y.toFixed(3), 'to', torsoBounds.max.y.toFixed(3))
        console.log('Torso center:', torsoCenter)
        console.log('Torso size:', torsoSize)
        
        return { torsoCenter, torsoSize, torsoBounds }
      }
      
      const torsoInfo = calculateTorsoBounds(avatarMesh)!
    
      const { torsoCenter, torsoSize } = torsoInfo
      
      // Scale and position armor
      console.log('=== SCALING AND POSITIONING ARMOR ===')
      
      // Get armor bounds
      const armorBounds = new THREE.Box3().setFromObject(armorMesh)
      const armorSize = armorBounds.getSize(new THREE.Vector3())
      const armorCenter = armorBounds.getCenter(new THREE.Vector3())
      
      console.log('Initial armor center:', armorCenter)
      console.log('Initial armor size:', armorSize)
      console.log('Target torso center:', torsoCenter)
      console.log('Target torso size:', torsoSize)
      
      // Calculate volume-based scale
      const calculateVolumeBasedScale = (
        sourceSize: THREE.Vector3, 
        targetSize: THREE.Vector3, 
        characterProfile: { scaleBoost: number } = { scaleBoost: 1.0 }
      ): number => {
        const sourceVolume = sourceSize.x * sourceSize.y * sourceSize.z
        const targetVolume = targetSize.x * targetSize.y * targetSize.z
        const volumeRatio = Math.pow(targetVolume / sourceVolume, 1 / 3)
        const heightRatio = targetSize.y / sourceSize.y
        
        // Blend volume and height ratios
        return ((volumeRatio * 0.7) + (heightRatio * 0.3)) * characterProfile.scaleBoost
      }
      
      // Get character-specific adjustments
      const characterProfile = selectedAvatar?.name?.toLowerCase().includes('goblin') 
        ? { scaleBoost: 0.7 } 
        : { scaleBoost: 1.0 }
      
      // Volume-based scaling
      const improvedFinalScale = Math.max(
        calculateVolumeBasedScale(armorSize, torsoSize, characterProfile),
        0.5 // Minimum scale
      )
      
      console.log('Volume-based scale:', improvedFinalScale.toFixed(3))
      
      // Restore original geometry if previously fitted
      if (originalArmorGeometryRef.current && armorMesh.userData.hasBeenFitted) {
        console.log('Restoring original geometry before scaling')
        armorMesh.geometry.dispose()
        armorMesh.geometry = originalArmorGeometryRef.current.clone()
        armorMesh.geometry.computeVertexNormals()
      }
      
      // Apply scale
      armorMesh.scale.multiplyScalar(improvedFinalScale)
      armorMesh.updateMatrixWorld(true)
      
      // Get new bounds after scaling
      const scaledBounds = new THREE.Box3().setFromObject(armorMesh)
      const scaledCenter = scaledBounds.getCenter(new THREE.Vector3())
      
      // Calculate position offset
      const currentMeshPos = armorMesh.position.clone()
      const geometryOffset = scaledCenter.clone().sub(currentMeshPos)
      const targetMeshPosition = torsoCenter.clone().sub(geometryOffset)
      const centerOffset = targetMeshPosition.clone().sub(currentMeshPos)
      
      // Smart vertical adjustments
      const scaledArmorHeight = scaledBounds.max.y - scaledBounds.min.y
      const armorCenterY = scaledCenter.y + centerOffset.y
      const armorTopY = armorCenterY + scaledArmorHeight / 2
      const armorBottomY = armorCenterY - scaledArmorHeight / 2
      
      let verticalAdjustment = 0
      const torsoTop = torsoCenter.y + torsoSize.y / 2
      const torsoBottom = torsoCenter.y - torsoSize.y / 2
      
      if (armorTopY > torsoTop + 0.1) {
        const overhang = armorTopY - (torsoTop + 0.1)
        verticalAdjustment = -overhang
        console.log('Armor would extend above torso by', overhang.toFixed(3), '- adjusting down')
      } else if (armorBottomY < torsoBottom - 0.05) {
        const underhang = (torsoBottom - 0.05) - armorBottomY
        verticalAdjustment = underhang
        console.log('Armor would extend below torso by', underhang.toFixed(3), '- adjusting up')
      }
      
      centerOffset.y += verticalAdjustment
      
      // Apply position offset
      armorMesh.position.add(centerOffset)
      armorMesh.updateMatrixWorld(true)
      
      console.log('Positioned armor at:', armorMesh.position)
      
      console.log('Applied scale:', improvedFinalScale)
      
      // Apply the fitting using the service
      const shrinkwrapParams = {
        ...params,
        iterations: Math.min(params.iterations, 10),
        stepSize: params.stepSize || 0.1,
        targetOffset: params.targetOffset || 0.01,
        sampleRate: params.sampleRate || 1.0,
        smoothingStrength: params.smoothingStrength || 0.2
      }
      
      console.log('Shrinkwrap parameters:', shrinkwrapParams)
      
      // Perform the fitting
      genericFittingService.current.fitMeshToTarget(armorMesh, avatarMesh, shrinkwrapParams)
      
      console.log('✅ Armor fitting complete!')
      
      // Detect collisions after fitting
      console.log('Detecting collisions...')
      const detectedCollisions = armorFittingService.current.detectCollisions(avatarMesh, armorMesh)
      setCollisions(detectedCollisions)
      props.onCollisionsDetected?.(detectedCollisions)
      console.log(`Detected ${detectedCollisions.length} collisions`)
      
      // Mark armor as fitted
      armorMesh.userData.hasBeenFitted = true
      
      // Ensure armor is visible and properly updated
      armorMesh.visible = true
      armorMesh.updateMatrix()
      armorMesh.updateMatrixWorld(true)
      
      // Force scene update
      scene.updateMatrixWorld(true)
      
      // Ensure meshes are properly attached to their original parents
      if (avatarParent && !avatarMesh.parent) {
        avatarParent.add(avatarMesh)
      }
      if (armorParent && !armorMesh.parent) {
        armorParent.add(armorMesh)
      }
    },
    
    performHelmetFitting: async (params: HelmetFittingParams) => {
      const avatarMesh = avatarMeshRef.current!
      const helmetMesh = helmetMeshRef.current!
      
      console.log('Performing helmet fitting with params:', params)
      
      // Ensure avatar's world matrix is up to date
      avatarMesh.updateMatrixWorld(true)
      helmetMesh.updateMatrixWorld(true)
      
      // Convert rotation to THREE.Euler if needed
      const fittingParams = {
        ...params,
        rotation: params.rotation ? new THREE.Euler(
          params.rotation.x,
          params.rotation.y,
          params.rotation.z
        ) : new THREE.Euler(),
        attachToHead: false,  // Match debugger behavior - manual attachment
        showHeadBounds: false,
        showCollisionDebug: false
      }
      
      // Log helmet state before fitting
      console.log('Helmet before fitting:')
      console.log('- Position:', helmetMesh.position)
      console.log('- Scale:', helmetMesh.scale)
      console.log('- Parent:', helmetMesh.parent?.name || 'unknown')
      
      const result = await genericFittingService.current.fitHelmetToHead(
        helmetMesh,
        avatarMesh,
        fittingParams
      )
      
      console.log('Helmet fitting complete:', result)
      console.log('Helmet after fitting:')
      console.log('- Position:', helmetMesh.position)
      console.log('- Scale:', helmetMesh.scale)
      
      // Mark helmet as fitted
      helmetMesh.userData.hasBeenFitted = true
    },
    
    attachHelmetToHead: () => {
      const avatarMesh = avatarMeshRef.current!
      const helmetMesh = helmetMeshRef.current!
      
      // Use the same head detection method as debugger
      const headInfo = genericFittingService.current.detectHeadRegion(avatarMesh)
      const headBone = headInfo.headBone!
      
      // Store world transform before attachment
      console.log('=== BEFORE ATTACHMENT ===')
      const originalWorldPos = helmetMesh.getWorldPosition(new THREE.Vector3())
      const originalWorldScale = helmetMesh.getWorldScale(new THREE.Vector3())
      console.log('Helmet world position:', originalWorldPos)
      console.log('Helmet world scale:', originalWorldScale)
      
      // Check bone scale
      const boneScale = headBone.getWorldScale(new THREE.Vector3())
      
      if (boneScale.x < 0.1) {
        console.log('Bone has extreme scale - applying visibility workaround')
        
        // Attach with workarounds
        headBone.attach(helmetMesh)
        
        // Apply material fixes for extreme scales
        helmetMesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach(material => {
              const standardMaterial = material as THREE.MeshStandardMaterial
              standardMaterial.side = THREE.DoubleSide
              standardMaterial.depthWrite = true
              standardMaterial.depthTest = true
            })
          }
        })
        
        // Force matrix updates
        helmetMesh.updateMatrix()
        helmetMesh.updateMatrixWorld(true)
        
        console.log('Applied extreme scale workarounds')
      } else {
        // Normal attachment process
        console.log('Attaching helmet to head bone...')
        headBone.attach(helmetMesh)
        console.log('Helmet attached to head bone')
      }
      
      // Debug: Log transforms after attachment
      console.log('=== AFTER ATTACHMENT ===')
      console.log('Helmet world position:', helmetMesh.getWorldPosition(new THREE.Vector3()))
      console.log('Helmet world scale:', helmetMesh.getWorldScale(new THREE.Vector3()))
      console.log('Helmet parent:', helmetMesh.parent?.name || 'none')
      
      // Update flags
      helmetMesh.userData.isAttached = true
      
      console.log('✅ Helmet successfully attached to head bone:', headBone.name)
    },
    
    detachHelmetFromHead: () => {
      detachHelmetFromHeadInternal()
    },
    
    transferWeights: () => {
      const currentArmorMesh = armorMeshRef.current!
      const avatarMesh = avatarMeshRef.current!
      const scene = sceneRef.current!
      
      console.log('=== BINDING ARMOR TO SKELETON ===')
      
      console.log('Current armor mesh:', currentArmorMesh.name, 'Parent:', currentArmorMesh.parent?.name)
      
      // Store the current world transform
      currentArmorMesh.updateMatrixWorld(true)
      const perfectWorldPosition = currentArmorMesh.getWorldPosition(new THREE.Vector3())
      const perfectWorldScale = currentArmorMesh.getWorldScale(new THREE.Vector3())
      
      console.log('=== FITTED ARMOR WORLD TRANSFORM ===')
      console.log('World position:', perfectWorldPosition)
      console.log('World scale:', perfectWorldScale)
      
      // Create the skinned mesh with transform baked into geometry
      const skinnedArmor = armorFittingService.current.bindArmorToSkeleton(
        currentArmorMesh,
        avatarMesh,
        {
          searchRadius: 0.3,
          applyGeometryTransform: true
        }
      )
      
      if (!skinnedArmor) {
        console.error('Failed to create skinned armor')
        return
      }
      
      console.log('Skinned armor created')
      
      // Copy material settings
      if (currentArmorMesh.material) {
        skinnedArmor.material = currentArmorMesh.material
        
        if (skinnedArmor.material instanceof THREE.MeshStandardMaterial && currentArmorMesh.material instanceof THREE.MeshStandardMaterial) {
          skinnedArmor.material.wireframe = currentArmorMesh.material.wireframe
          skinnedArmor.material.transparent = currentArmorMesh.material.transparent
          skinnedArmor.material.opacity = currentArmorMesh.material.opacity
        }
      }
      
      // Remove old mesh first
      const armorParent = currentArmorMesh.parent
      if (armorParent) {
        armorParent.remove(currentArmorMesh)
      } else {
        scene.remove(currentArmorMesh)
      }
      
      // Add skinned armor to the correct parent
      const armature = avatarMesh.parent
      if (armature && (armature.name === 'Armature' || armature.name.toLowerCase().includes('armature'))) {
        console.log('Adding skinned armor to Armature')
        armature.add(skinnedArmor)
      } else {
        console.log('No Armature found, adding to scene')
        scene.add(skinnedArmor)
      }
      
      skinnedArmor.updateMatrixWorld(true)
      
      // Verify position
      const finalWorldPos = skinnedArmor.getWorldPosition(new THREE.Vector3())
      const positionDrift = finalWorldPos.distanceTo(perfectWorldPosition)
      
      if (positionDrift > 0.01) {
        console.warn('⚠️ Skinned armor position drifted from fitted position!')
        console.warn('Expected:', perfectWorldPosition)
        console.warn('Actual:', finalWorldPos)
      } else {
        console.log('✅ Skinned armor maintained perfect position after binding')
      }
      
      // Check for extreme scales
      const armatureScale = skinnedArmor.parent?.getWorldScale(new THREE.Vector3()) || new THREE.Vector3(1, 1, 1)
      if (armatureScale.x < 0.1) {
        console.log('Armature has extreme scale - applying visibility workaround')
        skinnedArmor.frustumCulled = false
        skinnedArmor.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.frustumCulled = false
          }
        })
      }
      
      // Update references
      armorMeshRef.current = skinnedArmor
      skinnedArmor.userData.isBound = true
      skinnedArmor.userData.isArmor = true
      
      // Clean up extra armor meshes
      let armorCount = 0
      scene.traverse((obj) => {
        if (obj.userData.isArmor && obj instanceof THREE.Mesh) {
          armorCount++
          if (obj !== skinnedArmor) {
            console.warn('Found extra armor mesh, removing:', obj.name)
            if (obj.parent) obj.parent.remove(obj)
          }
        }
      })
      console.log('Total armor meshes in scene after binding:', armorCount)
      
      console.log('✅ Armor successfully bound to skeleton!')
      
      // Force scene update
      scene.updateMatrixWorld(true)
    },
    
    exportFittedModel: async () => {
      const meshToExport = equipmentSlot === 'Head' 
        ? helmetMeshRef.current! 
        : armorMeshRef.current!
      
      // Create a temporary scene for export
      const exportScene = new THREE.Scene()
      const meshClone = meshToExport.clone()
      exportScene.add(meshClone)
      
      // Export using GLTFExporter
      const exporter = new GLTFExporter()
      return new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          exportScene,
          (result: ArrayBuffer | { [key: string]: unknown }) => {
            if (result instanceof ArrayBuffer) {
              resolve(result)
            } else {
              // Convert JSON to ArrayBuffer if needed
              const json = JSON.stringify(result)
              const buffer = new TextEncoder().encode(json)
              resolve(buffer.buffer)
            }
          },
          (error: unknown) => {
            reject(error as Error)
          },
          { binary: true }
        )
      })
    },

    resetTransform: () => {
      // Reset helmet transform if in Head mode
      if (equipmentSlot === 'Head' && helmetMeshRef.current) {
        const helmet = helmetMeshRef.current
        
        console.log('=== RESETTING HELMET ===')
        
        // First, always detach if attached
        if (helmet.userData.isAttached || helmet.parent instanceof THREE.Bone) {
          console.log('Detaching helmet from bone')
          detachHelmetFromHeadInternal()
        }
        
        // Force the helmet back to origin
        helmet.position.set(0, 0, 0)
        helmet.rotation.set(0, 0, 0)
        helmet.scale.set(1, 1, 1)
        
        // Find the GLTF root in the helmet group and place helmet there
        if (helmetGroupRef.current) {
          // First ensure the group is at origin
          helmetGroupRef.current.position.set(0, 0, 0)
          helmetGroupRef.current.rotation.set(0, 0, 0)
          helmetGroupRef.current.scale.set(1, 1, 1)
          
          // Find the GLTF scene inside the group
          let gltfRoot: THREE.Object3D | null = null
          helmetGroupRef.current.traverse((child) => {
            if (child.userData.isGltfRoot || (child.type === 'Scene' && !gltfRoot)) {
              gltfRoot = child
            }
          })
          
          // If we found the GLTF root and helmet isn't already its child, move it there
          if (gltfRoot && helmet.parent !== gltfRoot) {
            console.log('Moving helmet back to GLTF root')
            if (helmet.parent) {
              helmet.removeFromParent()
            }
            (gltfRoot as THREE.Object3D).add(helmet)
          }
          
          // Ensure all intermediate groups are also at origin
          helmetGroupRef.current.traverse((child) => {
            if (child instanceof THREE.Group || child.type === 'Scene') {
              child.position.set(0, 0, 0)
              child.rotation.set(0, 0, 0)
              child.scale.set(1, 1, 1)
            }
          })
        }
        
        // Clear fitted flags
        helmet.userData.hasBeenFitted = false
        helmet.userData.isAttached = false
        
        // Force matrix updates on entire hierarchy
        if (helmetGroupRef.current) {
          helmetGroupRef.current.updateMatrix()
          helmetGroupRef.current.updateMatrixWorld(true)
        }
        
        helmet.updateMatrix()
        helmet.updateMatrixWorld(true)
        
        // Log final state
        const worldPos = new THREE.Vector3()
        helmet.getWorldPosition(worldPos)
        console.log('Helmet reset complete')
        console.log('- Local position:', helmet.position)
        console.log('- World position:', worldPos)
        console.log('- Parent:', helmet.parent?.name || helmet.parent?.type || 'none')
        
        console.log('=== HELMET RESET FINISHED ===')
      }
      // Reset armor transform if in Spine2 mode
      else if (equipmentSlot === 'Spine2' && armorMeshRef.current) {
        const armor = armorMeshRef.current
        
        console.log('=== RESETTING ARMOR ===')
        
        // Reset geometry if we have the original
        if (originalArmorGeometryRef.current && armor.userData.hasBeenFitted) {
          console.log('Restoring original armor geometry')
          armor.geometry.dispose()
          armor.geometry = originalArmorGeometryRef.current.clone()
          armor.geometry.computeVertexNormals()
        }
        
        // If armor was bound to skeleton, detach it
        if (armor.parent && armor.parent !== sceneRef.current) {
          console.log('Detaching armor from parent:', armor.parent?.name)
          if (sceneRef.current) {
            sceneRef.current.attach(armor)
          }
        }
        
        // Reset transforms  
        armor.position.set(0, 0, 0)
        armor.rotation.set(0, 0, 0)
        armor.scale.set(1, 1, 1)
        
        // Reset material properties
        armor.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach(material => {
              if (material instanceof THREE.MeshStandardMaterial) {
                material.wireframe = false
                material.opacity = 1
                material.transparent = false
              }
            })
          }
        })
        
        // Clear fitted flag
        armor.userData.hasBeenFitted = false
        armor.userData.isBound = false
        
        // Ensure armor is visible
        armor.visible = true
        armor.updateMatrix()
        armor.updateMatrixWorld(true)
        
        console.log('=== ARMOR RESET FINISHED ===')
      }
    },
    
    clearHelmet: () => {
      console.log('=== CLEARING HELMET ===')
      
      // Clear the helmet group
      if (helmetGroupRef.current) {
        console.log('Clearing helmet group')
        helmetGroupRef.current.clear()
      }
      
      if (helmetMeshRef.current) {
        // First detach if attached to head bone
        if (helmetMeshRef.current.userData.isAttached && helmetMeshRef.current.parent && sceneRef.current) {
          console.log('Detaching helmet before clear')
          // Make sure helmet is visible
          helmetMeshRef.current.visible = true
          helmetMeshRef.current.traverse((child) => {
            child.visible = true
          })
          
          // Use attach() which preserves world transform
          sceneRef.current.attach(helmetMeshRef.current)
          helmetMeshRef.current.userData.isAttached = false
        }
        
        // Remove from scene
        if (helmetMeshRef.current.parent) {
          helmetMeshRef.current.parent.remove(helmetMeshRef.current)
        }
        
        // Dispose geometry and materials
        if (helmetMeshRef.current.geometry) {
          helmetMeshRef.current.geometry.dispose()
        }
        
        helmetMeshRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material]
              materials.forEach(mat => mat.dispose())
            }
          }
        })
        
        // Clear reference
        helmetMeshRef.current = null
        originalHelmetTransformRef.current = null
        
        console.log('Helmet cleared from scene')
      }
      
      // Note: loadedUrlsRef is in ModelDemo scope, will be cleared on next render
    },
    
    clearArmor: () => {
      if (armorMeshRef.current) {
        // Remove from scene
        if (armorMeshRef.current.parent) {
          armorMeshRef.current.parent.remove(armorMeshRef.current)
        }
        
        // Dispose geometry and materials
        if (armorMeshRef.current.geometry) {
          armorMeshRef.current.geometry.dispose()
        }
        
        armorMeshRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material]
              materials.forEach(mat => mat.dispose())
            }
          }
        })
        
        // Clear reference
        armorMeshRef.current = null
        
        console.log('Armor cleared from scene')
      }
    }
  }))
  
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <Scene
          avatarUrl={avatarUrl}
          armorUrl={armorUrl}
          helmetUrl={helmetUrl}
          showWireframe={showWireframe}
          equipmentSlot={equipmentSlot}
          currentAnimation={props.currentAnimation || 'tpose'}
          isAnimationPlaying={props.isAnimationPlaying || false}
          visualizationGroup={visualizationGroupRef.current}
          onModelsLoaded={handleModelsLoaded}
        />
      </Canvas>
    </div>
  )
})