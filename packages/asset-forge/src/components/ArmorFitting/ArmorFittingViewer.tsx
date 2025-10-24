import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import React, { useRef, useImperativeHandle, forwardRef, useEffect, useMemo, useState } from 'react'
import {
  AnimationClip, AnimationMixer, Bone, Box3, Box3Helper, BufferAttribute, BufferGeometry, Color,
  DoubleSide, Euler, Group, Line, LineBasicMaterial, LoopRepeat, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, Scene as ThreeScene, SkinnedMesh, SphereGeometry, Texture, Vector3
} from 'three'
// import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'


import { ArmorFittingService, BodyRegion, CollisionPoint } from '../../services/fitting/ArmorFittingService'
import { MeshFittingService } from '../../services/fitting/MeshFittingService'
import { createLogger } from '../../utils/logger'
// import { WeightTransferService } from '../../services/fitting/WeightTransferService'
import { notify } from '../../utils/notify'
import { cloneGeometryForModification } from '../../utils/three-geometry-sharing'

import { useArmorExport } from '@/hooks/useArmorExport'
import { apiFetch } from '@/utils/api'

const logger = createLogger('ArmorFittingViewer')

// Type declarations
interface AnimatedGLTF extends GLTF {
  animations: AnimationClip[]
}

declare global {
  interface Window {
    __visualizationGroup?: Group
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
    avatar: SkinnedMesh | null
    armor: Mesh | null
    helmet: Mesh | null
    helmetGroup?: Group | null
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
  const avatarRef = useRef<Group>(null)
  const armorRef = useRef<Group>(null)
  const helmetRef = useRef<Group>(null)
  
  // Track loaded URLs to prevent unnecessary reloads
  const loadedUrlsRef = useRef({
    avatar: '',
    armor: '',
    helmet: ''
  })
  
  // Animation state
  const mixerRef = useRef<AnimationMixer | null>(null)
  const needsAnimationFile = currentAnimation !== 'tpose'
  
  // Construct animation file path based on the model if animation is needed
  const animationPath = useMemo(() => {
    if (needsAnimationFile && avatarUrl) {
      // Handle API paths (/api/assets/{id}/model)
      const apiMatch = avatarUrl.match(new RegExp('^/api/assets/([^/]+)/model'))
      if (apiMatch) {
        const assetId = apiMatch[1]
        const animFileName = currentAnimation === 'walking' ? 'anim_walk.glb' : 'anim_run.glb'
        // Use the API endpoint to get animation files
        return `/api/assets/${assetId}/${animFileName}`
      }
      
      // Handle direct gdd-assets paths (for local testing)
      const gddMatch = avatarUrl.match(new RegExp('gdd-assets/([^/]+)/'))
      if (gddMatch) {
        const characterName = gddMatch[1]
        const animFileName = currentAnimation === 'walking' ? 'anim_walk.glb' : 'anim_run.glb'
        return `./gdd-assets/${characterName}/${animFileName}`
      }
    }
    return null
  }, [avatarUrl, currentAnimation, needsAnimationFile])
  
  // Load animation file if available - with error handling
  const [animationGltf, setAnimationGltf] = useState<AnimatedGLTF | null>(null)
  
  useEffect(() => {
    if (!animationPath) {
      setAnimationGltf(null)
      return
    }

    // Try to load the animation file silently
    const loader = new GLTFLoader()

    // First check if the animation file exists by attempting a HEAD request
    apiFetch(animationPath, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          // File exists, load it
          logger.debug('Loading animation from:', animationPath)
          loader.load(
            animationPath,
            (gltf: GLTF) => {
              logger.debug('Animation loaded successfully:', animationPath)
              logger.debug('Animation count:', gltf.animations.length)
              setAnimationGltf(gltf as AnimatedGLTF)
            },
            (_progress: ProgressEvent) => {
              // Progress callback
            },
            (error: unknown) => {
              logger.error('Failed to load animation file:', error)
              setAnimationGltf(null)
            }
          )
        } else {
          // File doesn't exist - this is expected for many assets
          logger.debug(`Animation file not found (404): ${animationPath} - will use built-in animations if available`)
          setAnimationGltf(null)
        }
      })
      .catch(() => {
        // Network error or other issue
        logger.debug(`Could not check animation file: ${animationPath}`)
        setAnimationGltf(null)
      })

    // Cleanup function to dispose of the previous animation GLTF
    return () => {
      if (animationGltf) {
        animationGltf.scene.traverse((object) => {
          if (object instanceof Mesh || object instanceof SkinnedMesh) {
            if (object.geometry) {
              object.geometry.dispose()
            }
            if (object.material) {
              const materials = Array.isArray(object.material) ? object.material : [object.material]
              materials.forEach(mat => {
                // Dispose all textures
                Object.values(mat).forEach(value => {
                  if (value && value instanceof Texture) {
                    value.dispose()
                  }
                })
                mat.dispose()
              })
            }
          }
        })
      }
    }
  }, [animationPath, animationGltf])
  
  // Load models when URLs change
  useEffect(() => {
    let avatarMesh: SkinnedMesh | null = null
    let armorMesh: Mesh | null = null
    let helmetMesh: Mesh | null = null
    
    const loadModels = async () => {
      const loader = new GLTFLoader()
      
      // Load avatar only if URL changed
      if (avatarUrl && avatarRef.current && avatarUrl !== loadedUrlsRef.current.avatar) {
        try {
          const gltf = await loader.loadAsync(avatarUrl)
          avatarRef.current.clear()
          avatarRef.current.add(gltf.scene)
          loadedUrlsRef.current.avatar = avatarUrl
          
          // Store gltf data on the scene for animation access
          gltf.scene.userData.gltf = gltf
          
          // Find skinned mesh
          gltf.scene.traverse((child: Object3D) => {
            if (child instanceof SkinnedMesh && !avatarMesh) {
              avatarMesh = child
              avatarMesh.userData.isAvatar = true
            }
          })
          
          logger.debug('Avatar loaded with animations:', gltf.animations.length)
          if (gltf.animations.length > 0) {
            gltf.animations.forEach((clip: AnimationClip) => {
              logger.debug(`- Built-in animation: "${clip.name}" (${clip.duration}s)`)
            })
          }
          
          // Normalize scale
          if (avatarMesh) {
            const bounds = new Box3().setFromObject(avatarMesh)
            const height = bounds.getSize(new Vector3()).y
            const scale = 2 / height // Normalize to 2 units tall
            avatarRef.current.scale.setScalar(scale)
          }
        } catch (error) {
          logger.error('Failed to load avatar:', error)
        }
      } else if (avatarUrl && avatarRef.current) {
        // URL exists but already loaded - find the mesh
        avatarRef.current.traverse((child) => {
          if (child instanceof SkinnedMesh && !avatarMesh) {
            avatarMesh = child
          }
        })
        logger.debug('Avatar already loaded, reusing existing mesh')
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
        try {
          const gltf = await loader.loadAsync(armorUrl)
          armorRef.current.clear()
          armorRef.current.add(gltf.scene)
          loadedUrlsRef.current.armor = armorUrl
          
          // Find mesh
          gltf.scene.traverse((child: Object3D) => {
            if (child instanceof Mesh && !armorMesh) {
              armorMesh = child
              armorMesh.userData.isArmor = true
              armorMesh.userData.isEquipment = true
              armorMesh.userData.equipmentSlot = 'Spine2'
            }
          })
          
          // Match avatar scale
          if (avatarRef.current) {
            armorRef.current.scale.copy(avatarRef.current.scale)
          }
          

        } catch (error) {
          logger.error('Failed to load armor:', error)
        }
      } else if (armorUrl && equipmentSlot === 'Spine2' && armorRef.current) {
        // URL exists but already loaded - find the mesh
        armorRef.current.traverse((child) => {
          if (child instanceof Mesh && !armorMesh) {
            armorMesh = child
          }
        })
      }
      
      // Clear helmet if not in Head mode or no URL
      if (!helmetUrl || equipmentSlot !== 'Head') {
        if (helmetRef.current) {
          // Clear transform captured flag before clearing
          helmetRef.current.traverse((child) => {
            if (child instanceof Mesh && child.userData.transformCaptured) {
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
        try {
          const gltf = await loader.loadAsync(helmetUrl)
          
          // Only clear and reload if the helmet isn't fitted
          const existingHelmet = helmetRef.current.children[0]?.children[0] as Mesh
          if (!existingHelmet?.userData.hasBeenFitted) {
            helmetRef.current.clear()
            helmetRef.current.add(gltf.scene)
            loadedUrlsRef.current.helmet = helmetUrl
          }
          
          // Find mesh and store the gltf scene reference
          const gltfScene = gltf.scene
          gltfScene.userData.isGltfRoot = true // Mark this as the GLTF root
          
          gltf.scene.traverse((child: Object3D) => {
            if (child instanceof Mesh && !helmetMesh) {
              helmetMesh = child
              helmetMesh.userData.isHelmet = true
              helmetMesh.userData.isEquipment = true
              helmetMesh.userData.equipmentSlot = 'Head'
              helmetMesh.userData.gltfRoot = gltfScene // Store reference to GLTF root
              logger.debug('Found helmet mesh:', helmetMesh.name || 'unnamed')
              logger.debug('Helmet parent after loading:', helmetMesh.parent?.name || 'unknown')
            }
          })
          
          // Log the structure
          logger.debug('Helmet structure after loading:')
          logger.debug('- helmetRef.current:', helmetRef.current)
          logger.debug('- gltf.scene:', gltf.scene)
          logger.debug('- helmetMesh found:', !!helmetMesh)
          
          // Don't scale helmet - let fitting algorithm handle it
          // This matches MeshFittingDebugger behavior
          
                      // Store original helmet transform immediately when loaded
            // Match MeshFittingDebugger's approach exactly
            if (helmetMesh && !helmetMesh.userData.transformCaptured) {
              // Make sure the helmet's world matrix is updated
              helmetMesh.updateMatrixWorld(true)
              
              const originalTransform = {
                position: helmetMesh.position.clone(),
                rotation: helmetMesh.rotation.clone(),
                scale: helmetMesh.scale.clone()
              }
              
              // Store the original parent for proper reset
              helmetMesh.userData.originalParent = helmetMesh.parent
              helmetMesh.userData.originalTransform = originalTransform
              helmetMesh.userData.transformCaptured = true
              
              logger.debug('Captured original helmet transform:', originalTransform)
              logger.debug('Original helmet parent:', helmetMesh.parent?.name || 'scene')
              logger.debug('Is position at origin?', helmetMesh.position.length() < 0.001)
            }
        } catch (error) {
          logger.error('Failed to load helmet:', error)
        }
      } else if (helmetUrl && equipmentSlot === 'Head' && helmetRef.current) {
        // URL exists but already loaded - find the mesh
        helmetRef.current.traverse((child) => {
          if (child instanceof Mesh && !helmetMesh) {
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
        if (child instanceof Mesh) {
          child.material.wireframe = showWireframe
        }
      })
    }
    if (helmetRef.current) {
      helmetRef.current.traverse((child) => {
        if (child instanceof Mesh) {
          child.material.wireframe = showWireframe
        }
      })
    }
  }, [showWireframe])
  
  // Handle animation playback
  useEffect(() => {
    if (!avatarRef.current) return
    
    logger.debug('Animation useEffect triggered:', { currentAnimation, isAnimationPlaying })
    
    // Find the avatar mesh
    let avatarMesh: SkinnedMesh | null = null
    avatarRef.current.traverse((child) => {
          if (child instanceof SkinnedMesh && !avatarMesh) {
            avatarMesh = child
          }
        })
    
    if (!avatarMesh) {
      logger.debug('No avatar mesh found')
      return
    }
    
    // Create or recreate mixer for the avatar group (not just the mesh)
    if (mixerRef.current) {
      mixerRef.current.stopAllAction()
      mixerRef.current = null
    }
    
    mixerRef.current = new AnimationMixer(avatarRef.current)
    const mixer = mixerRef.current
    
    if (isAnimationPlaying && currentAnimation !== 'tpose') {
      // Get animations from loaded GLB
      let animations: AnimationClip[] = []
      
      // Check if animation file has animations
      if (animationGltf?.animations && animationGltf.animations.length > 0) {
        animations = animationGltf.animations
        logger.debug(`Using animations from ${currentAnimation} file:`, animations.length)
        } else {
        logger.debug('No animations found in animation file')
        // Try to get from base model as fallback
        avatarRef.current.traverse((child) => {
          if (child.userData?.gltf?.animations && child.userData.gltf.animations.length > 0) {
            animations = child.userData.gltf.animations
            logger.debug('Found animations in child userData:', animations.length)
          }
        })
        
        // Also check the group itself
        const avatarGltf = avatarRef.current.children[0]?.userData?.gltf as AnimatedGLTF | undefined
        if (!animations.length && avatarGltf?.animations) {
          animations = avatarGltf.animations
          logger.debug('Using animations from base model:', animations.length)
        }
      }
      
      if (animations.length > 0) {
        // Log available animations
        animations.forEach(clip => {
          logger.debug(`Available animation: "${clip.name}" (duration: ${clip.duration}s)`)
        })
        
        // Find the appropriate animation clip
        let targetClip: AnimationClip | null = null
        
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
          logger.debug(`Playing animation: "${targetClip.name}"`)
          const action = mixer.clipAction(targetClip, avatarRef.current)
          action.reset()
          action.setLoop(LoopRepeat, Infinity)
          action.play()
        } else {
          logger.debug('No suitable animation clip found')
        }
      } else {
        logger.debug('No animations available for this avatar')
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
  useFrame((_state, delta) => {
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
  visualizationGroup?: Group
  onModelsLoaded: (meshes: {
    avatar: SkinnedMesh | null
    armor: Mesh | null
    helmet: Mesh | null
    scene: ThreeScene
    helmetGroup?: Group | null
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
  const sceneRef = useRef<ThreeScene>(null!)
  
  useEffect(() => {
    if (sceneRef.current) {
      logger.debug('Scene initialized')
      

    }
  }, [])
  
  const handleModelsReady = (meshes: {
    avatar: SkinnedMesh | null
    armor: Mesh | null
    helmet: Mesh | null
    helmetGroup?: Group | null
  }) => {
    logger.debug('Models ready in scene:', {
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
    avatar: SkinnedMesh | null
    armor: Mesh | null
    helmet: Mesh | null
    scene: ThreeScene | null
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

export const ArmorFittingViewer = React.memo(forwardRef<
  ArmorFittingViewerRef,
  ArmorFittingViewerProps
>((props, ref) => {
  const { avatarUrl, armorUrl, helmetUrl, showWireframe, equipmentSlot, selectedAvatar } = props
  
  // Mesh references
  const avatarMeshRef = useRef<SkinnedMesh | null>(null)
  const armorMeshRef = useRef<Mesh | null>(null)
  const helmetMeshRef = useRef<Mesh | null>(null)
  const sceneRef = useRef<ThreeScene | null>(null)
  
  // Services
  const genericFittingService = useRef(new MeshFittingService())
  const armorFittingService = useRef(new ArmorFittingService())
  // const weightTransferService = useRef(new WeightTransferService())
  
  // Original geometry storage
  const originalArmorGeometryRef = useRef<BufferGeometry | null>(null)
  const originalHelmetTransformRef = useRef<{
    position: Vector3
    rotation: Euler
    scale: Vector3
  } | null>(null)
  
  const helmetGroupRef = useRef<Group | null>(null)
  
  // Export helper
  const { exportFittedModel: exportFittedModelHook } = useArmorExport({
    sceneRef,
    equipmentSlot,
    helmetMeshRef,
    armorMeshRef
  })
  
  // Visualization state
  const visualizationGroupRef = useRef<Group>((() => {
    const group = new Group()
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
      logger.error('No helmet to detach')
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
      logger.debug('Helmet detached from head')
    }
  }
  
  const handleModelsLoaded = (meshes: {
    avatar: SkinnedMesh | null
    armor: Mesh | null
    helmet: Mesh | null
    scene: ThreeScene
    helmetGroup?: Group | null
  }) => {
    logger.debug('=== MODELS LOADED IN VIEWER ===')
    avatarMeshRef.current = meshes.avatar
    armorMeshRef.current = meshes.armor
    helmetMeshRef.current = meshes.helmet
    sceneRef.current = meshes.scene
    helmetGroupRef.current = meshes.helmetGroup || null
    
    // Log mesh details
    if (meshes.helmet) {
      logger.debug('Helmet mesh details:')
      logger.debug('- Type:', meshes.helmet.type)
      logger.debug('- Geometry vertices:', meshes.helmet.geometry?.attributes.position?.count)
      logger.debug('- Parent:', meshes.helmet.parent?.name || 'unknown')
      
      // Check if this is actually the mesh or a group
      if (meshes.helmet.type !== 'Mesh') {
        logger.warn('WARNING: Helmet reference is not a Mesh, it\'s a', meshes.helmet.type)
      }
    }
    
    // Log avatar details
    if (meshes.avatar) {
      logger.debug('Avatar mesh details:')
      logger.debug('- Type:', meshes.avatar.type)
      logger.debug('- Has skeleton:', !!meshes.avatar.skeleton)
      logger.debug('- Parent:', meshes.avatar.parent?.name || 'unknown')
      
      // Get avatar bounds
      const avatarBounds = new Box3().setFromObject(meshes.avatar)
      const avatarSize = avatarBounds.getSize(new Vector3())
      logger.debug(`Avatar bounds: min(${avatarBounds.min.x.toFixed(3)}, ${avatarBounds.min.y.toFixed(3)}, ${avatarBounds.min.z.toFixed(3)}) max(${avatarBounds.max.x.toFixed(3)}, ${avatarBounds.max.y.toFixed(3)}, ${avatarBounds.max.z.toFixed(3)})`)
      logger.debug(`Avatar size: ${avatarSize.x.toFixed(3)}, ${avatarSize.y.toFixed(3)}, ${avatarSize.z.toFixed(3)}`)
      logger.debug(`Avatar scale: ${meshes.avatar.scale.x.toFixed(3)}, ${meshes.avatar.scale.y.toFixed(3)}, ${meshes.avatar.scale.z.toFixed(3)}`)

      // Check parent scale
      if (meshes.avatar.parent) {
        logger.debug(`Avatar parent scale: ${meshes.avatar.parent.scale.x.toFixed(3)}, ${meshes.avatar.parent.scale.y.toFixed(3)}, ${meshes.avatar.parent.scale.z.toFixed(3)}`)
      }
    }
    
    // Store original geometry (for reset functionality)
    if (meshes.armor) {
      originalArmorGeometryRef.current = cloneGeometryForModification(
        meshes.armor.geometry,
        'backup original armor'
      )
    }
    
    // Use the original transform that was captured when helmet was loaded
    if (meshes.helmet) {
      if (meshes.helmet.userData.originalTransform) {
        originalHelmetTransformRef.current = meshes.helmet.userData.originalTransform
        logger.debug('Using original helmet transform from mesh userData:', originalHelmetTransformRef.current)
      } else {
        // Capture it now if not already captured
        originalHelmetTransformRef.current = {
          position: meshes.helmet.position.clone(),
          rotation: meshes.helmet.rotation.clone(),
          scale: meshes.helmet.scale.clone()
        }
        meshes.helmet.userData.originalTransform = originalHelmetTransformRef.current
        meshes.helmet.userData.originalParent = meshes.helmet.parent
        logger.debug('Captured original helmet transform in handleModelsLoaded:', originalHelmetTransformRef.current)
      }
      
      // Get helmet bounds for debugging
      const helmetBounds = new Box3().setFromObject(meshes.helmet)
      const helmetSize = helmetBounds.getSize(new Vector3())
      logger.debug(`Helmet initial bounds: min(${helmetBounds.min.x.toFixed(3)}, ${helmetBounds.min.y.toFixed(3)}, ${helmetBounds.min.z.toFixed(3)}) max(${helmetBounds.max.x.toFixed(3)}, ${helmetBounds.max.y.toFixed(3)}, ${helmetBounds.max.z.toFixed(3)})`)
      logger.debug(`Helmet size: ${helmetSize.x.toFixed(3)}, ${helmetSize.y.toFixed(3)}, ${helmetSize.z.toFixed(3)}`)

      // Also check parent scale
      if (meshes.helmet.parent) {
        logger.debug(`Helmet parent scale: ${meshes.helmet.parent.scale.x.toFixed(3)}, ${meshes.helmet.parent.scale.y.toFixed(3)}, ${meshes.helmet.parent.scale.z.toFixed(3)}`)
      }
    }
    
    // Add visualization group to scene
    if (meshes.scene && visualizationGroupRef.current) {
      meshes.scene.add(visualizationGroupRef.current)
      logger.debug('Added visualization group to scene')
      // Store globally for Scene component access
      window.__visualizationGroup = visualizationGroupRef.current
    }
    
    // Compute body regions if avatar changed
    if (meshes.avatar && meshes.avatar.skeleton && props.avatarUrl !== lastComputedAvatar.current) {
      logger.debug('Computing body regions for new avatar...')
      const detectedRegions = armorFittingService.current.computeBodyRegions(meshes.avatar, meshes.avatar.skeleton)
      setBodyRegions(detectedRegions)
      props.onBodyRegionsDetected?.(detectedRegions)
      lastComputedAvatar.current = props.avatarUrl || null
    }
    
    // Compute collisions if either mesh changed
    if (meshes.avatar && meshes.armor && 
        (props.avatarUrl !== lastComputedAvatar.current || props.armorUrl !== lastComputedArmor.current)) {
      logger.debug('Detecting collisions for current meshes...')
      const detectedCollisions = armorFittingService.current.detectCollisions(meshes.avatar, meshes.armor)
      setCollisions(detectedCollisions)
      props.onCollisionsDetected?.(detectedCollisions)
      lastComputedArmor.current = props.armorUrl || null
      logger.debug(`Detected ${detectedCollisions.length} collisions`)
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
      logger.debug('No body regions to visualize')
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
      const helper = new Box3Helper(region.boundingBox, new Color(color))
      visualizationGroupRef.current.add(helper)
    })
    
    logger.debug('Visualization group children:', visualizationGroupRef.current.children.length)
  }
  
  const visualizeCollisions = () => {
    if (!collisions || collisions.length === 0) {
      logger.debug('No collisions to visualize')
      return
    }
    
    clearVisualization()
    
    const sphereGeometry = new SphereGeometry(0.01, 8, 8)
    const material = new MeshBasicMaterial({ color: 0xff0000 })
    
    collisions.forEach(collision => {
      const sphere = new Mesh(sphereGeometry, material)
      sphere.position.copy(collision.position)
      visualizationGroupRef.current.add(sphere)
      
      // Add line showing push direction
      const lineGeometry = new BufferGeometry().setFromPoints([
        collision.position,
        collision.position.clone().add(collision.normal.clone().multiplyScalar(collision.penetrationDepth))
      ])
      const line = new Line(lineGeometry, new LineBasicMaterial({ color: 0xff0000 }))
      visualizationGroupRef.current.add(line)
    })
  }
  
  const visualizeWeights = () => {
    if (!avatarMeshRef.current) return
    
    // Check if the mesh is actually skinned
    if (!(avatarMeshRef.current instanceof SkinnedMesh)) {
      logger.warn('Avatar mesh is not a SkinnedMesh, cannot visualize weights')
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
        logger.warn('Mesh does not have skinning attributes')
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
      
      geometry.setAttribute('color', new BufferAttribute(colors, 3))
      
      // Use a simple material with vertex colors
      const material = new MeshBasicMaterial({
        vertexColors: true,
        side: DoubleSide
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visualizationMode, props.selectedBone, bodyRegions, collisions])
  
  useImperativeHandle(ref, () => ({
    getMeshes: () => ({
      avatar: avatarMeshRef.current,
      armor: armorMeshRef.current,
      helmet: helmetMeshRef.current,
      scene: sceneRef.current
    }),
    
    performFitting: (params: ArmorFittingParams) => {
      if (!avatarMeshRef.current || !armorMeshRef.current || !sceneRef.current) {
        logger.error('Avatar, armor, or scene not available')
      return
    }
    
      const armorMesh = armorMeshRef.current
      const avatarMesh = avatarMeshRef.current
      const scene = sceneRef.current
      
      logger.debug('=== ARMOR TO TORSO FITTING ===')
      logger.debug('Performing armor fitting with params:', params)
      
      // Update entire scene before any calculations
      const updateSceneMatrices = (scene: ThreeScene) => {
        scene.updateMatrixWorld(true)
        scene.traverse((obj) => {
          if (obj instanceof Mesh || obj instanceof SkinnedMesh) {
            obj.updateMatrix()
            obj.updateMatrixWorld(true)
          }
        })
      }
      updateSceneMatrices(scene)
      logger.debug('Updated scene matrix world before fitting')
      
      // Detect body regions for visualization
      logger.debug('Computing body regions...')
      if (avatarMesh.skeleton) {
        const detectedRegions = armorFittingService.current.computeBodyRegions(avatarMesh, avatarMesh.skeleton)
        setBodyRegions(detectedRegions)
        props.onBodyRegionsDetected?.(detectedRegions)
      } else {
        logger.warn('Avatar mesh has no skeleton, cannot compute body regions')
      }
      
      // Store parent references
      const avatarParent = avatarMesh.parent
      const armorParent = armorMesh.parent
      
      // Log current state
      logger.debug('=== PRE-FITTING STATE CHECK ===')
      logger.debug(`Armor scale: ${armorMesh.scale.x.toFixed(3)}, ${armorMesh.scale.y.toFixed(3)}, ${armorMesh.scale.z.toFixed(3)}`)
      logger.debug(`Armor position: ${armorMesh.position.x.toFixed(3)}, ${armorMesh.position.y.toFixed(3)}, ${armorMesh.position.z.toFixed(3)}`)
      logger.debug(`Armor parent scale: ${armorMesh.parent?.scale.x.toFixed(3)}, ${armorMesh.parent?.scale.y.toFixed(3)}, ${armorMesh.parent?.scale.z.toFixed(3)}`)
      logger.debug(`Has been fitted before: ${armorMesh.userData.hasBeenFitted}`)
      
      // Ensure armor starts at scale 1,1,1
      if (armorMesh.scale.x !== 1 || armorMesh.scale.y !== 1 || armorMesh.scale.z !== 1) {
        logger.warn('⚠️ Armor scale is not 1,1,1! Resetting scale before fitting.')
        armorMesh.scale.set(1, 1, 1)
        armorMesh.updateMatrixWorld(true)
      }
      
      // Calculate scale ratio between avatar and armor
      const calculateScaleRatio = (avatar: SkinnedMesh, armor: Mesh): number => {
        const avatarBounds = new Box3().setFromObject(avatar)
        const armorBounds = new Box3().setFromObject(armor)
        const avatarSize = avatarBounds.getSize(new Vector3())
        const armorSize = armorBounds.getSize(new Vector3())
        const avgAvatarDim = (avatarSize.x + avatarSize.y + avatarSize.z) / 3
        const avgArmorDim = (armorSize.x + armorSize.y + armorSize.z) / 3
        return avgArmorDim / avgAvatarDim
      }
      
      // Check and normalize scales
      logger.debug('=== SCALE ANALYSIS ===')
      const scaleRatio = calculateScaleRatio(avatarMesh, armorMesh)
      logger.debug('Scale ratio (armor/avatar):', scaleRatio)
      
      // Normalize armor scale if needed
      if (Math.abs(scaleRatio - 1.0) > 0.1) {
        logger.warn(`SCALE MISMATCH DETECTED: Armor is ${scaleRatio.toFixed(1)}x the size of avatar`)
        const normalizationFactor = 1 / scaleRatio
        armorMesh.scale.multiplyScalar(normalizationFactor)
        armorMesh.updateMatrixWorld(true)
        logger.debug('Applied normalization factor:', normalizationFactor)
      }
      
      // Calculate torso bounds - matching debugger implementation
      const calculateTorsoBounds = (avatarMesh: SkinnedMesh) => {
        const avatarBounds = new Box3().setFromObject(avatarMesh)
        const avatarSize = avatarBounds.getSize(new Vector3())
        const avatarCenter = avatarBounds.getCenter(new Vector3())

        logger.debug(`Avatar bounds: min(${avatarBounds.min.x.toFixed(3)}, ${avatarBounds.min.y.toFixed(3)}, ${avatarBounds.min.z.toFixed(3)}) max(${avatarBounds.max.x.toFixed(3)}, ${avatarBounds.max.y.toFixed(3)}, ${avatarBounds.max.z.toFixed(3)})`)
        logger.debug(`Avatar height: ${avatarSize.y.toFixed(3)}`)
        
        const skeleton = avatarMesh.skeleton
        if (!skeleton) {
          logger.error('Avatar has no skeleton!')
          return null
        }
        
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
          const bonePos = new Vector3()
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
          logger.debug(`Head Y: ${(headY as number).toFixed(3)}, Shoulder Y: ${(shoulderY as number).toFixed(3)}, Difference: ${headShoulderDiff.toFixed(3)}`)
          if (isHunchedCharacter) {
            logger.debug('⚠️ Detected hunched character anatomy')
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
        
        const torsoCenter = new Vector3(
          avatarCenter.x,
          (torsoBottom + torsoTop) / 2,
          avatarCenter.z
        )
        const torsoSize = new Vector3(
          avatarSize.x * 0.6,
          torsoTop - torsoBottom,
          avatarSize.z * 0.5
        )
        const torsoBounds = new Box3()
        torsoBounds.setFromCenterAndSize(torsoCenter, torsoSize)
        
        logger.debug(`Torso Y range: ${torsoBounds.min.y.toFixed(3)} to ${torsoBounds.max.y.toFixed(3)}`)
        logger.debug(`Torso center: ${torsoCenter.x.toFixed(3)}, ${torsoCenter.y.toFixed(3)}, ${torsoCenter.z.toFixed(3)}`)
        logger.debug(`Torso size: ${torsoSize.x.toFixed(3)}, ${torsoSize.y.toFixed(3)}, ${torsoSize.z.toFixed(3)}`)
        
        return { torsoCenter, torsoSize, torsoBounds }
      }
      
      const torsoInfo = calculateTorsoBounds(avatarMesh)
      if (!torsoInfo) {
        logger.error('Could not calculate torso bounds')
      return
    }
    
      const { torsoCenter, torsoSize } = torsoInfo
      
      // Scale and position armor
      logger.debug('=== SCALING AND POSITIONING ARMOR ===')
      
      // Get armor bounds
      const armorBounds = new Box3().setFromObject(armorMesh)
      const armorSize = armorBounds.getSize(new Vector3())
      const armorCenter = armorBounds.getCenter(new Vector3())

      logger.debug(`Initial armor center: ${armorCenter.x.toFixed(3)}, ${armorCenter.y.toFixed(3)}, ${armorCenter.z.toFixed(3)}`)
      logger.debug(`Initial armor size: ${armorSize.x.toFixed(3)}, ${armorSize.y.toFixed(3)}, ${armorSize.z.toFixed(3)}`)
      logger.debug(`Target torso center: ${torsoCenter.x.toFixed(3)}, ${torsoCenter.y.toFixed(3)}, ${torsoCenter.z.toFixed(3)}`)
      logger.debug(`Target torso size: ${torsoSize.x.toFixed(3)}, ${torsoSize.y.toFixed(3)}, ${torsoSize.z.toFixed(3)}`)
      
      // Calculate volume-based scale
      const calculateVolumeBasedScale = (
        sourceSize: Vector3, 
        targetSize: Vector3, 
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
      
      logger.debug('Volume-based scale:', improvedFinalScale.toFixed(3))
      
      // Restore original geometry if previously fitted
      if (originalArmorGeometryRef.current && armorMesh.userData.hasBeenFitted) {
        logger.debug('Restoring original geometry before scaling')
        armorMesh.geometry.dispose()
        armorMesh.geometry = originalArmorGeometryRef.current.clone()
        armorMesh.geometry.computeVertexNormals()
      }
      
      // Apply scale
      armorMesh.scale.multiplyScalar(improvedFinalScale)
      armorMesh.updateMatrixWorld(true)
      
      // Get new bounds after scaling
      const scaledBounds = new Box3().setFromObject(armorMesh)
      const scaledCenter = scaledBounds.getCenter(new Vector3())
      
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
        logger.debug(`Armor would extend above torso by ${overhang.toFixed(3)} - adjusting down`)
      } else if (armorBottomY < torsoBottom - 0.05) {
        const underhang = (torsoBottom - 0.05) - armorBottomY
        verticalAdjustment = underhang
        logger.debug(`Armor would extend below torso by ${underhang.toFixed(3)} - adjusting up`)
      }
      
      centerOffset.y += verticalAdjustment
      
      // Apply position offset
      armorMesh.position.add(centerOffset)
      armorMesh.updateMatrixWorld(true)
      
      logger.debug('Positioned armor at:', armorMesh.position)
      
      logger.debug('Applied scale:', improvedFinalScale)
      
      // Apply the fitting using the service
      try {
        const shrinkwrapParams = {
          ...params,
          iterations: Math.min(params.iterations, 10),
          stepSize: params.stepSize || 0.1,
          targetOffset: params.targetOffset || 0.01,
          sampleRate: params.sampleRate || 1.0,
          smoothingStrength: params.smoothingStrength || 0.2
        }
        
        logger.debug('Shrinkwrap parameters:', shrinkwrapParams)
        
        // Perform the fitting
        genericFittingService.current.fitMeshToTarget(armorMesh, avatarMesh, shrinkwrapParams)
        
        logger.debug('✅ Armor fitting complete!')
        
        // Detect collisions after fitting
        logger.debug('Detecting collisions...')
        const detectedCollisions = armorFittingService.current.detectCollisions(avatarMesh, armorMesh)
        setCollisions(detectedCollisions)
        props.onCollisionsDetected?.(detectedCollisions)
        logger.debug(`Detected ${detectedCollisions.length} collisions`)
        
        // Mark armor as fitted
        armorMesh.userData.hasBeenFitted = true
        
        // Ensure armor is visible and properly updated
        armorMesh.visible = true
        armorMesh.updateMatrix()
      armorMesh.updateMatrixWorld(true)
      
        // Force scene update
        scene.updateMatrixWorld(true)
        
      } catch (error) {
        logger.error('Armor fitting failed:', error)
      } finally {
        // Ensure meshes are properly attached to their original parents
        if (avatarParent && !avatarMesh.parent) {
          avatarParent.add(avatarMesh)
        }
        if (armorParent && !armorMesh.parent) {
          armorParent.add(armorMesh)
        }
      }
    },
    
    performHelmetFitting: async (params: HelmetFittingParams) => {
      if (!avatarMeshRef.current || !helmetMeshRef.current) {
        logger.error('Avatar or helmet mesh not available')
        return
      }
      
      logger.debug('Performing helmet fitting with params:', params)
      
      // Ensure avatar's world matrix is up to date
      avatarMeshRef.current.updateMatrixWorld(true)
      helmetMeshRef.current.updateMatrixWorld(true)
      
      // Convert rotation to Euler if needed
      const fittingParams = {
        ...params,
        rotation: params.rotation ? new Euler(
          params.rotation.x,
          params.rotation.y,
          params.rotation.z
        ) : new Euler(),
        attachToHead: false,  // Match debugger behavior - manual attachment
        showHeadBounds: false,
        showCollisionDebug: false
      }
      
      try {
        // Log helmet state before fitting
        logger.debug('Helmet before fitting:')
        logger.debug('- Position:', helmetMeshRef.current.position)
        logger.debug('- Scale:', helmetMeshRef.current.scale)
        logger.debug('- Parent:', helmetMeshRef.current.parent?.name || 'unknown')
        
        const result = await genericFittingService.current.fitHelmetToHead(
          helmetMeshRef.current,
          avatarMeshRef.current,
          fittingParams
        )
        
        logger.debug('Helmet fitting complete:', result)
        logger.debug('Helmet after fitting:')
        logger.debug('- Position:', helmetMeshRef.current.position)
        logger.debug('- Scale:', helmetMeshRef.current.scale)
        
        // Mark helmet as fitted
        helmetMeshRef.current.userData.hasBeenFitted = true
      } catch (error) {
        logger.error('Helmet fitting failed:', error)
      }
    },
    
    attachHelmetToHead: () => {
      if (!avatarMeshRef.current || !helmetMeshRef.current) {
        logger.error('Avatar or helmet mesh not loaded')
        return
      }
      
      // Use the same head detection method as debugger
      const headInfo = genericFittingService.current.detectHeadRegion(avatarMeshRef.current)
      
      if (!headInfo.headBone) {
        logger.error('No head bone found - attaching to avatar root instead')
        
        const message = `No head bone found in the model. The system looked for common head bone names but couldn't find any.\n\n` +
          `You can either:\n` +
          `1. Attach the helmet to the avatar root (it won't follow head animations)\n` +
          `2. Cancel and manually parent the helmet in your 3D software\n\n` +
          `Would you like to attach to the avatar root?`
        
        if (confirm(message)) {
          const avatarRoot = avatarMeshRef.current.parent || avatarMeshRef.current
          avatarRoot.attach(helmetMeshRef.current)
          logger.debug('Helmet attached to avatar root')
          notify.info('Helmet attached to avatar root. Note: It will follow body movement but not specific head animations.')
        }
        return
      }
      
      // Store world transform before attachment
      logger.debug('=== BEFORE ATTACHMENT ===')
      const originalWorldPos = helmetMeshRef.current.getWorldPosition(new Vector3())
      const originalWorldScale = helmetMeshRef.current.getWorldScale(new Vector3())
      logger.debug('Helmet world position:', originalWorldPos)
      logger.debug('Helmet world scale:', originalWorldScale)
      
      // Check bone scale
      const boneScale = headInfo.headBone.getWorldScale(new Vector3())
      
      if (boneScale.x < 0.1) {
        logger.debug('Bone has extreme scale - applying visibility workaround')
        
        // Attach with workarounds
        headInfo.headBone.attach(helmetMeshRef.current)
        
        // Apply material fixes for extreme scales
        helmetMeshRef.current.traverse((child) => {
          if (child instanceof Mesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach(material => {
              if (material instanceof MeshStandardMaterial) {
                material.side = DoubleSide
                material.depthWrite = true
                material.depthTest = true
              }
            })
          }
        })
        
        // Force matrix updates
        helmetMeshRef.current.updateMatrix()
        helmetMeshRef.current.updateMatrixWorld(true)
        
        logger.debug('Applied extreme scale workarounds')
      } else {
        // Normal attachment process
        logger.debug('Attaching helmet to head bone...')
        headInfo.headBone.attach(helmetMeshRef.current)
        logger.debug('Helmet attached to head bone')
      }
      
      // Debug: Log transforms after attachment
      logger.debug('=== AFTER ATTACHMENT ===')
      logger.debug('Helmet world position:', helmetMeshRef.current.getWorldPosition(new Vector3()))
      logger.debug('Helmet world scale:', helmetMeshRef.current.getWorldScale(new Vector3()))
      logger.debug('Helmet parent:', helmetMeshRef.current.parent?.name || 'none')
      
      // Update flags
      helmetMeshRef.current.userData.isAttached = true
      
      logger.debug('✅ Helmet successfully attached to head bone:', headInfo.headBone.name)
    },
    
    detachHelmetFromHead: () => {
      detachHelmetFromHeadInternal()
    },
    
    transferWeights: () => {
      if (!avatarMeshRef.current || !armorMeshRef.current || !sceneRef.current) {
        logger.error('Scene, avatar, or armor not available for binding')
        return
      }
      
      logger.debug('=== BINDING ARMOR TO SKELETON ===')
      
      const currentArmorMesh = armorMeshRef.current
      const avatarMesh = avatarMeshRef.current
      const scene = sceneRef.current
      
      logger.debug(`Current armor mesh: ${currentArmorMesh.name} Parent: ${currentArmorMesh.parent?.name}`)
      
      // Store the current world transform
      currentArmorMesh.updateMatrixWorld(true)
      const perfectWorldPosition = currentArmorMesh.getWorldPosition(new Vector3())
//       const _perfectWorldQuaternion = currentArmorMesh.getWorldQuaternion(new Quaternion())
      const perfectWorldScale = currentArmorMesh.getWorldScale(new Vector3())
      
      logger.debug('=== FITTED ARMOR WORLD TRANSFORM ===')
      logger.debug('World position:', perfectWorldPosition)
      logger.debug('World scale:', perfectWorldScale)
      
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
        logger.error('Failed to create skinned armor')
        return
      }
      
      logger.debug('Skinned armor created')
      
      // Copy material settings
      if (currentArmorMesh.material) {
        skinnedArmor.material = currentArmorMesh.material
        
        if (skinnedArmor.material instanceof MeshStandardMaterial && currentArmorMesh.material instanceof MeshStandardMaterial) {
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
        logger.debug('Adding skinned armor to Armature')
        armature.add(skinnedArmor)
      } else {
        logger.debug('No Armature found, adding to scene')
        scene.add(skinnedArmor)
      }
      
      skinnedArmor.updateMatrixWorld(true)
      
      // Verify position
      const finalWorldPos = skinnedArmor.getWorldPosition(new Vector3())
      const positionDrift = finalWorldPos.distanceTo(perfectWorldPosition)
      
      if (positionDrift > 0.01) {
        logger.warn('⚠️ Skinned armor position drifted from fitted position!')
        logger.warn('Expected:', perfectWorldPosition)
        logger.warn('Actual:', finalWorldPos)
      } else {
        logger.debug('✅ Skinned armor maintained perfect position after binding')
      }
      
      // Check for extreme scales
      const armatureScale = skinnedArmor.parent?.getWorldScale(new Vector3()) || new Vector3(1, 1, 1)
      if (armatureScale.x < 0.1) {
        logger.debug('Armature has extreme scale - applying visibility workaround')
        skinnedArmor.frustumCulled = false
        skinnedArmor.traverse((child) => {
          if (child instanceof Mesh) {
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
        if (obj.userData.isArmor && obj instanceof Mesh) {
          armorCount++
          if (obj !== skinnedArmor) {
            logger.warn('Found extra armor mesh, removing:', obj.name)
            if (obj.parent) obj.parent.remove(obj)
          }
        }
      })
      logger.debug('Total armor meshes in scene after binding:', armorCount)
      
      logger.debug('✅ Armor successfully bound to skeleton!')
      
      // Force scene update
      scene.updateMatrixWorld(true)
    },
    
    exportFittedModel: async () => {
      return await exportFittedModelHook()
    },

    resetTransform: () => {
      // Reset helmet transform if in Head mode
      if (equipmentSlot === 'Head' && helmetMeshRef.current) {
        const helmet = helmetMeshRef.current
        
        logger.debug('=== RESETTING HELMET ===')
        
        // First, always detach if attached
        if (helmet.userData.isAttached || helmet.parent instanceof Bone) {
          logger.debug('Detaching helmet from bone')
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
          let gltfRoot: Object3D | null = null
          helmetGroupRef.current.traverse((child) => {
            if (child.userData.isGltfRoot || (child.type === 'Scene' && !gltfRoot)) {
              gltfRoot = child
            }
          })
          
          // If we found the GLTF root and helmet isn't already its child, move it there
          if (gltfRoot && helmet.parent !== gltfRoot) {
            logger.debug('Moving helmet back to GLTF root')
            if (helmet.parent) {
              helmet.removeFromParent()
            }
            (gltfRoot as Object3D).add(helmet)
          }
          
          // Ensure all intermediate groups are also at origin
          helmetGroupRef.current.traverse((child) => {
            if (child instanceof Group || child.type === 'Scene') {
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
        const worldPos = new Vector3()
        helmet.getWorldPosition(worldPos)
        logger.debug('Helmet reset complete')
        logger.debug('- Local position:', helmet.position)
        logger.debug('- World position:', worldPos)
        logger.debug('- Parent:', helmet.parent?.name || helmet.parent?.type || 'none')
        
        logger.debug('=== HELMET RESET FINISHED ===')
      }
      // Reset armor transform if in Spine2 mode
      else if (equipmentSlot === 'Spine2' && armorMeshRef.current) {
        const armor = armorMeshRef.current
        
        logger.debug('=== RESETTING ARMOR ===')
        
        // Reset geometry if we have the original
        if (originalArmorGeometryRef.current && armor.userData.hasBeenFitted) {
          logger.debug('Restoring original armor geometry')
          armor.geometry.dispose()
          armor.geometry = originalArmorGeometryRef.current.clone()
          armor.geometry.computeVertexNormals()
        }
        
        // If armor was bound to skeleton, detach it
        if (armor.parent && armor.parent !== sceneRef.current) {
          logger.debug('Detaching armor from parent:', armor.parent?.name)
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
          if (child instanceof Mesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach(material => {
              if (material instanceof MeshStandardMaterial) {
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
        
        logger.debug('=== ARMOR RESET FINISHED ===')
      }
    },
    
    clearHelmet: () => {
      logger.debug('=== CLEARING HELMET ===')
      
      // Clear the helmet group
      if (helmetGroupRef.current) {
        logger.debug('Clearing helmet group')
        helmetGroupRef.current.clear()
      }
      
      if (helmetMeshRef.current) {
        // First detach if attached to head bone
        if (helmetMeshRef.current.userData.isAttached && helmetMeshRef.current.parent && sceneRef.current) {
          logger.debug('Detaching helmet before clear')
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
          if (child instanceof Mesh) {
            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material]
              materials.forEach(mat => mat.dispose())
            }
          }
        })
        
        // Clear reference
        helmetMeshRef.current = null
        originalHelmetTransformRef.current = null
        
        logger.debug('Helmet cleared from scene')
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
          if (child instanceof Mesh) {
            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material]
              materials.forEach(mat => mat.dispose())
            }
          }
        })
        
        // Clear reference
        armorMeshRef.current = null
        
        logger.debug('Armor cleared from scene')
      }
    }
  }))
  
  return (
    <div style={{ width: '100%', height: '100%' }}>
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
}), (prevProps, nextProps) => {
  // Custom comparison function - return true if props are equal (skip re-render)
  return (
    prevProps.avatarUrl === nextProps.avatarUrl &&
    prevProps.armorUrl === nextProps.armorUrl &&
    prevProps.helmetUrl === nextProps.helmetUrl &&
    prevProps.equipmentSlot === nextProps.equipmentSlot &&
    prevProps.showWireframe === nextProps.showWireframe &&
    prevProps.currentAnimation === nextProps.currentAnimation &&
    prevProps.isAnimationPlaying === nextProps.isAnimationPlaying &&
    prevProps.visualizationMode === nextProps.visualizationMode &&
    prevProps.selectedBone === nextProps.selectedBone
  )
})