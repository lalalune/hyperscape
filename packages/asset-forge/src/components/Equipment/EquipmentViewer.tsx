import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { SkeletonHelper } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface Transform {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
}

interface EquipmentViewerProps {
  avatarUrl?: string
  equipmentUrl?: string
  equipmentSlot?: string
  showSkeleton?: boolean
  weaponType?: string
  avatarHeight?: number
  autoScale?: boolean
  scaleOverride?: number
  gripOffset?: { x: number; y: number; z: number }  // Add grip offset from AI detection
  orientationOffset?: { x: number; y: number; z: number }  // Manual orientation adjustment in degrees
  positionOffset?: { x: number; y: number; z: number }  // Manual position adjustment in meters
  isAnimating?: boolean  // Whether to play animations
  animationType?: 'tpose' | 'walking' | 'running'  // Which animation to play
}

export interface EquipmentViewerRef {
  exportEquippedModel: () => Promise<ArrayBuffer>
  exportAlignedEquipment: () => Promise<ArrayBuffer>
  reattachEquipment: () => void
  resetCamera?: () => void
  takeScreenshot?: () => string
  updateEquipmentTransform?: () => void
  updateEquipmentPose?: () => void
  getScene?: () => THREE.Scene | null
  getAvatar?: () => THREE.Object3D | null
  getEquipment?: () => THREE.Object3D | null
  forceRender?: () => void
}

const BONE_MAPPING: Record<string, string[]> = {
  'Hand_R': ['Hand_R', 'mixamorig:RightHand', 'RightHand', 'hand_r', 'Bip01_R_Hand'],
  'Hand_L': ['Hand_L', 'mixamorig:LeftHand', 'LeftHand', 'hand_l', 'Bip01_L_Hand'],
  'Head': ['Head', 'mixamorig:Head', 'head', 'Bip01_Head'],
  'Spine2': ['Spine2', 'Spine02', 'mixamorig:Spine2', 'spine2', 'Bip01_Spine2', 'Chest', 'chest'],
  'Hips': ['Hips', 'mixamorig:Hips', 'hips', 'Bip01_Pelvis']
}

const EquipmentViewer = forwardRef<EquipmentViewerRef, EquipmentViewerProps>((props, ref) => {
  const instanceId = useRef(Math.random().toString(36).substr(2, 9))
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const orbitControlsRef = useRef<OrbitControls | null>(null)
  const avatarRef = useRef<THREE.Object3D | null>(null)
  const equipmentRef = useRef<THREE.Object3D | null>(null)
  const loader = useRef(new GLTFLoader())
  // const exporter = useRef(new GLTFExporter())
  const skeletonHelperRef = useRef<SkeletonHelper | null>(null)
  const equipmentWrapperRef = useRef<THREE.Group | null>(null)
  const animationMixerRef = useRef<THREE.AnimationMixer | null>(null)
  const clockRef = useRef<THREE.Clock | null>(null)
  const currentActionRef = useRef<THREE.AnimationAction | null>(null)
  const animationClipsRef = useRef<THREE.AnimationClip[]>([])
  const isAnimatingRef = useRef(false)
  const isAttachingEquipmentRef = useRef(false)
  const shouldAttachEquipmentRef = useRef(false)
  
  const {
    avatarUrl,
    equipmentUrl,
    equipmentSlot = 'Hand_R',
    showSkeleton = false,
    weaponType = 'sword',
    avatarHeight = 1.83,
    autoScale = true,
    scaleOverride = 1.0,
    gripOffset,
    orientationOffset = { x: 0, y: 0, z: 0 },
    positionOffset = { x: 0, y: 0, z: 0 },
    isAnimating = false,
    animationType = 'tpose'
  } = props
  
  const [isInitialized, setIsInitialized] = useState(false)
  const [debugSpheres, setDebugSpheres] = useState<{
    handSphere?: THREE.Mesh
    gripSphere?: THREE.Mesh
    centerSphere?: THREE.Mesh
    line?: THREE.Line
    wristSphere?: THREE.Mesh
  }>({})
  
  // Initialize Three.js scene
  useEffect(() => {
    console.log(`🔧 EquipmentViewer initializing (instance: ${instanceId.current})`)

    if (!containerRef.current) return

    // Cache stable references for cleanup
    const containerEl = containerRef.current
    const instanceAtMount = instanceId.current

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)
    sceneRef.current = scene
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.set(1.5, 1.2, 1.5)
    camera.lookAt(0, 0.8, 0)
    cameraRef.current = camera
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setClearColor(0x000000, 0) // Transparent background
    renderer.autoClear = true // Ensure buffer is cleared between frames
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    directionalLight.castShadow = true
    scene.add(directionalLight)
    
    // Orbit controls
    const orbitControls = new OrbitControls(camera, renderer.domElement)
    orbitControls.target.set(0, 1, 0)
    orbitControls.update()
    orbitControlsRef.current = orbitControls
    
    // Grid helper
    const gridHelper = new THREE.GridHelper(10, 10)
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
    
    setIsInitialized(true)
    
    let frameCounter = 0
    let animationFrameId: number
    
    // Initialize clock for animations
    clockRef.current = new THREE.Clock()
    
    // Animation loop
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      orbitControls.update()
      
      // Update animation mixer if playing
      if (animationMixerRef.current && isAnimatingRef.current && clockRef.current) {
        const delta = clockRef.current.getDelta()
        
        // Cache equipment wrapper transform before animation update
        let cachedWrapperTransform = null
        if (equipmentWrapperRef.current && equipmentWrapperRef.current.parent) {
          cachedWrapperTransform = {
            parent: equipmentWrapperRef.current.parent,
            position: equipmentWrapperRef.current.position.clone(),
            rotation: equipmentWrapperRef.current.rotation.clone(),
            scale: equipmentWrapperRef.current.scale.clone()
          }
        }
        
        animationMixerRef.current.update(delta)
        
        // Ensure world matrices are updated after animation
        if (avatarRef.current) {
          avatarRef.current.updateMatrixWorld(true)
        }
        
        // Check if wrapper was affected by animation
        if (cachedWrapperTransform && equipmentWrapperRef.current && !equipmentWrapperRef.current.parent) {
          console.warn('⚠️ Equipment wrapper lost parent during animation update, restoring...')
          cachedWrapperTransform.parent.add(equipmentWrapperRef.current)
          equipmentWrapperRef.current.position.copy(cachedWrapperTransform.position)
          equipmentWrapperRef.current.rotation.copy(cachedWrapperTransform.rotation)
          equipmentWrapperRef.current.scale.copy(cachedWrapperTransform.scale)
        }
      }
      
      // Update equipment wrapper position if it exists
      if (equipmentRef.current && equipmentRef.current.parent && equipmentRef.current.parent.name === 'EquipmentWrapper') {
        const wrapper = equipmentRef.current.parent
        const basePos = wrapper.userData.baseHandOffset
        const manualOffset = wrapper.userData.manualPositionOffset || { x: 0, y: 0, z: 0 }
        
        // Only log every 60 frames to avoid spam
        frameCounter++
        if (frameCounter % 600 === 0) {  // Changed from 60 to 600 (about every 10 seconds at 60fps)
          // console.log(`🔄 Animation loop - Wrapper found, Base: (${basePos?.x?.toFixed(3) || '0'}, ${basePos?.y?.toFixed(3) || '0'}, ${basePos?.z?.toFixed(3) || '0'}), Manual: (${manualOffset.x.toFixed(3)}, ${manualOffset.y.toFixed(3)}, ${manualOffset.z.toFixed(3)})`)
        }
        
        // Reapply position if we have valid data
        if (basePos) {
          const boneScale = wrapper.userData.boneScale || 1
          wrapper.position.set(
            (basePos.x + manualOffset.x) / boneScale,
            (basePos.y + manualOffset.y) / boneScale,
            (basePos.z + manualOffset.z) / boneScale
          )
          
          // Update matrix
          wrapper.updateMatrix()
          wrapper.updateMatrixWorld(false)
        }
      }
      
      renderer.render(scene, camera)
    }
    animate()
    
    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    }
    window.addEventListener('resize', handleResize)
    
    return () => {
      console.log(`🧹 EquipmentViewer instance ${instanceAtMount} cleaning up`)
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
      renderer.dispose()
      containerEl?.removeChild(renderer.domElement)
    }
  }, [])
  
  // Function to create a normalized weapon where grip point is at origin
  const createNormalizedWeapon = (originalMesh: THREE.Object3D, gripPoint: THREE.Vector3): THREE.Object3D => {
    // Clone the weapon so we don't modify the original
    const normalizedWeapon = originalMesh.clone()
    
    // The grip point from detection is in a rotated coordinate system
    // During detection, if weapon's longest dimension is Z, it's rotated 90° around X
    // So we need to transform the grip point back to the original weapon space
    const transformedGrip = new THREE.Vector3()
    
    // Check weapon dimensions to determine if it was rotated during detection
    const weaponBox = new THREE.Box3().setFromObject(originalMesh)
    const weaponSize = new THREE.Vector3()
    weaponBox.getSize(weaponSize)
    
    if (weaponSize.z > weaponSize.x && weaponSize.z > weaponSize.y) {
      console.log(`🗡️ Sword detected - Z is longest (${weaponSize.z.toFixed(3)}m)`)
      
      // Get weapon bounds to understand orientation
      const weaponBounds = new THREE.Box3().setFromObject(originalMesh)
      const weaponCenter = new THREE.Vector3()
      weaponBounds.getCenter(weaponCenter)
      console.log(`📍 Weapon center: (${weaponCenter.x.toFixed(3)}, ${weaponCenter.y.toFixed(3)}, ${weaponCenter.z.toFixed(3)})`)
      console.log(`📍 Weapon bounds: min(${weaponBounds.min.z.toFixed(3)}) to max(${weaponBounds.max.z.toFixed(3)}) along Z`)
      
      // The weapon extends from -1 to +1 along Z
      // Handle should be at negative Z (around -1)
      // Blade tip should be at positive Z (around +1)
      
      // During detection:
      // - Weapon rotated 90° around X (Z becomes -Y)
      // - May also be flipped 180° if detected upside down
      // - Grip detected at Y=-0.462 (negative Y in detection view)
      
      // Since grip is at negative Y in detection, and weapon may have been flipped,
      // we need to map this back to the correct position
      transformedGrip.set(
        gripPoint.x,    // X unchanged
        gripPoint.z,    // Detection Z -> Original Y
        -gripPoint.y    // Detection -Y -> Original Z (negate to flip back)
      )
      
      console.log(`🔄 Transformed grip from detection (${gripPoint.x.toFixed(3)}, ${gripPoint.y.toFixed(3)}, ${gripPoint.z.toFixed(3)}) to weapon (${transformedGrip.x.toFixed(3)}, ${transformedGrip.y.toFixed(3)}, ${transformedGrip.z.toFixed(3)})`)
      
      // Validate: grip Z should be negative (handle end)
      if (transformedGrip.z > 0) {
        console.log(`⚠️ Grip Z is positive (${transformedGrip.z.toFixed(3)}), but handle should be at negative Z!`)
        console.log(`🔄 Inverting Z coordinate...`)
        transformedGrip.z = -transformedGrip.z
      }
      
      console.log(`✅ Final grip position: (${transformedGrip.x.toFixed(3)}, ${transformedGrip.y.toFixed(3)}, ${transformedGrip.z.toFixed(3)})`)
    } else {
      // No rotation needed
      transformedGrip.copy(gripPoint)
    }
    
    // Create a group to hold the transformed weapon
    const weaponGroup = new THREE.Group()
    weaponGroup.name = 'NormalizedWeapon'
    weaponGroup.userData.isNormalized = true
    
    // Offset the weapon so the grip point is at origin
    normalizedWeapon.position.set(
      -transformedGrip.x,
      -transformedGrip.y,
      -transformedGrip.z
    )
    
    // Update matrices to ensure proper transformation
    normalizedWeapon.updateMatrix()
    normalizedWeapon.matrixAutoUpdate = true
    
    weaponGroup.add(normalizedWeapon)
    
    console.log(`🔧 Created normalized weapon with grip at origin. Offset: (${-transformedGrip.x.toFixed(3)}, ${-transformedGrip.y.toFixed(3)}, ${-transformedGrip.z.toFixed(3)})`)
    
    // Log the weapon structure
    const box = new THREE.Box3().setFromObject(normalizedWeapon)
    const size = new THREE.Vector3()
    box.getSize(size)
    console.log(`📐 Normalized weapon dimensions: X:${size.x.toFixed(3)}, Y:${size.y.toFixed(3)}, Z:${size.z.toFixed(3)}`)
    console.log(`📍 Weapon bounds after normalization: min(${box.min.x.toFixed(3)}, ${box.min.y.toFixed(3)}, ${box.min.z.toFixed(3)}) max(${box.max.x.toFixed(3)}, ${box.max.y.toFixed(3)}, ${box.max.z.toFixed(3)})`)
    
    // Debug the hierarchy
    console.log(`🌳 Normalized weapon hierarchy:`)
    console.log(`   - ${weaponGroup.name} (Group)`)
    let _depth = 0
    normalizedWeapon.traverse((child) => {
      if (child !== normalizedWeapon) {
        console.log(`     - ${child.name || 'unnamed'} (${child.type})`)
      }
    })
    
    // Verify grip is at origin
    const testGrip = new THREE.Vector3()
    normalizedWeapon.localToWorld(testGrip.copy(transformedGrip))
    testGrip.sub(weaponGroup.getWorldPosition(new THREE.Vector3()))
    console.log(`✅ Grip position after offset: (${testGrip.x.toFixed(3)}, ${testGrip.y.toFixed(3)}, ${testGrip.z.toFixed(3)}) - should be (0,0,0)`)
    
    return weaponGroup
  }
  
  // Get the bone that equipment is attached to (handling wrapper groups)
  const getAttachedBone = (equipment: THREE.Object3D): THREE.Bone | null => {
    let parent = equipment.parent
    while (parent) {
      if (parent instanceof THREE.Bone) {
        return parent
      }
      parent = parent.parent
    }
    return null
  }
  
  // Get the accumulated scale of an object in world space
  const getWorldScale = (object: THREE.Object3D): THREE.Vector3 => {
    const worldScale = new THREE.Vector3()
    object.getWorldScale(worldScale)
    return worldScale
  }
  
  // Helper: estimate avatar height from its bounding box
  const calculateAvatarHeight = (avatar: THREE.Object3D): number => {
    avatar.updateMatrixWorld(true)
    let minY = Infinity
    let maxY = -Infinity
    let foundMesh = false
    avatar.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        foundMesh = true
        const box = new THREE.Box3().setFromObject(child)
        minY = Math.min(minY, box.min.y)
        maxY = Math.max(maxY, box.max.y)
      }
    })
    if (!foundMesh) {
      const box = new THREE.Box3().setFromObject(avatar)
      minY = box.min.y
      maxY = box.max.y
    }
    const height = maxY - minY
    if (height < 0.1 || height > 10) return 1.8
    return height
  }

  // Helper: compute weapon scale relative to avatar height
  const calculateWeaponScale = (
    weapon: THREE.Object3D,
    avatar: THREE.Object3D,
    weaponType: string,
    avatarHeight: number
  ): number => {
    weapon.updateMatrixWorld(true)
    const weaponBox = new THREE.Box3().setFromObject(weapon)
    const weaponSize = new THREE.Vector3()
    weaponBox.getSize(weaponSize)
    const weaponLength = Math.max(weaponSize.x, weaponSize.y, weaponSize.z)
    if (weaponType === 'armor') return 1.0
    let targetProportion = 0.65
    if (weaponType === 'dagger' || weaponType === 'knife') targetProportion = 0.25
    else if (weaponType === 'sword' || weaponType === 'axe') {
      if (avatarHeight < 1.2) targetProportion = 0.72
      else if (avatarHeight > 2.5) targetProportion = 0.55
      else targetProportion = 0.65
    } else if (weaponType === 'spear' || weaponType === 'staff') targetProportion = 1.1
    else if (weaponType === 'bow') targetProportion = 0.8
    const targetWeaponLength = avatarHeight * targetProportion
    const scaleFactor = targetWeaponLength / weaponLength
    return scaleFactor
  }

  // Helper: default orientation based on weapon type
  const calculateWeaponOrientation = (
    _weapon: THREE.Object3D,
    _targetBone: THREE.Bone,
    weaponType: string = 'weapon'
  ): THREE.Euler => {
    if (weaponType === 'sword' || weaponType === 'melee') {
      return new THREE.Euler(Math.PI / 2, Math.PI / 2, 0, 'XYZ')
    }
    return new THREE.Euler(0, 0, 0, 'XYZ')
  }
 
  // Load avatar
  useEffect(() => {
    if (!isInitialized || !avatarUrl || !sceneRef.current) return
    
    const loadAvatar = async () => {
      console.log(`🔄 [${instanceId.current}] Loading avatar from: ${avatarUrl}, isAnimating: ${isAnimating}, animationType: ${animationType}`)
      
      try {
        // Clean up animations first before removing avatar
        if (currentActionRef.current) {
          currentActionRef.current.stop()
          currentActionRef.current = null
        }
        if (animationMixerRef.current) {
          animationMixerRef.current.stopAllAction()
          animationMixerRef.current = null
        }
        animationClipsRef.current = []
        
        // Store equipment state before removing avatar
        const _hadEquipmentAttached = shouldAttachEquipmentRef.current && equipmentRef.current && equipmentRef.current.parent
        
        // Remove existing avatar
        if (avatarRef.current) {
          // Don't remove equipment from scene, just detach from avatar
          if (equipmentRef.current && equipmentRef.current.parent) {
            console.log('📦 Temporarily detaching equipment before avatar reload')
            equipmentRef.current.parent.remove(equipmentRef.current)
          }
          sceneRef.current!.remove(avatarRef.current)
          avatarRef.current = null
        }
        
        // Remove skeleton helper
        if (skeletonHelperRef.current) {
          sceneRef.current!.remove(skeletonHelperRef.current)
          skeletonHelperRef.current = null
        }
        
        // Remove existing debug spheres
        if (debugSpheres.handSphere) {
          sceneRef.current!.remove(debugSpheres.handSphere)
          debugSpheres.handSphere.geometry.dispose()
          ;(debugSpheres.handSphere.material as THREE.Material).dispose()
        }
        if (debugSpheres.gripSphere) {
          sceneRef.current!.remove(debugSpheres.gripSphere)
          debugSpheres.gripSphere.geometry.dispose()
          ;(debugSpheres.gripSphere.material as THREE.Material).dispose()
        }
        setDebugSpheres({})
        
        // Load new avatar
        const gltf = await loader.current.loadAsync(avatarUrl)
        const avatar = gltf.scene
        
        console.log(`📦 Loaded GLTF from ${avatarUrl}`)
        console.log(`   Scene children: ${avatar.children.length}`)
        console.log(`   Animations: ${gltf.animations.length}`)
        if (gltf.animations.length > 0) {
          gltf.animations.forEach((anim, idx) => {
            console.log(`   Animation ${idx}: ${anim.name}, duration: ${anim.duration}s`)
          })
        }
        
        // Set up animations if available
        if (gltf.animations && gltf.animations.length > 0) {
          console.log(`🎬 Found ${gltf.animations.length} animations`)
          
          // Store animation clips
          animationClipsRef.current = gltf.animations
          
          // Create animation mixer for this model
          animationMixerRef.current = new THREE.AnimationMixer(avatar)
          
          // Log all available animations
          console.log('📋 Available animations in loaded model:')
          gltf.animations.forEach((clip, index) => {
            console.log(`   ${index}: "${clip.name}" (${clip.duration.toFixed(2)}s)`)
          })
          
          // Trigger animation playback if needed
          // Use setTimeout to ensure the effect runs after this setup
          setTimeout(() => {
            if (isAnimating && animationType !== 'tpose') {
              console.log(`🎮 Triggering initial animation playback for ${animationType}`)
              // Find the appropriate animation clip
              let clipToPlay = null
              
              if (animationType === 'walking') {
                clipToPlay = gltf.animations.find(clip => 
                  clip.name.toLowerCase().includes('walk') || 
                  clip.name.toLowerCase().includes('walking')
                )
              } else if (animationType === 'running') {
                clipToPlay = gltf.animations.find(clip => 
                  clip.name.toLowerCase().includes('run') || 
                  clip.name.toLowerCase().includes('running') ||
                  clip.name.toLowerCase().includes('sprint') ||
                  clip.name.toLowerCase().includes('jog')
                )
              }
              
              // If no specific clip found, use the first available
              if (!clipToPlay && gltf.animations.length > 0) {
                clipToPlay = gltf.animations[0]
                console.log(`⚠️ No ${animationType} animation found, using: "${clipToPlay.name}"`)
              }
              
              if (clipToPlay && animationMixerRef.current) {
                currentActionRef.current = animationMixerRef.current.clipAction(clipToPlay)
                currentActionRef.current.setLoop(THREE.LoopRepeat, Infinity)
                currentActionRef.current.play()
                console.log(`▶️ Started initial animation: "${clipToPlay.name}"`)
              }
            }
          }, 0)
        } else {
          // Clean up if no animations
          animationClipsRef.current = []
          const mixer = animationMixerRef.current as THREE.AnimationMixer | null
          if (mixer) {
            mixer.stopAllAction()
            animationMixerRef.current = null
          }
          currentActionRef.current = null
        }
        
        // Don't modify the avatar - preserve original mesh
        // Just position it at origin
        avatar.position.set(0, 0, 0)
        
        // Enable shadows
        avatar.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })
        
        avatarRef.current = avatar
        sceneRef.current!.add(avatar)
        
        console.log('✅ Avatar loaded successfully')
        console.log('🦴 Avatar bones:')
        avatar.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            console.log(`   Found SkinnedMesh: ${child.name} with ${child.skeleton.bones.length} bones`)
            child.skeleton.bones.forEach(bone => {
              console.log(`   - ${bone.name}`)
            })
          }
        })
        
        // Update skeleton helper if enabled
        updateSkeletonHelper()
        
        // If equipment should be attached and is loaded, attach it to the new avatar
        if (shouldAttachEquipmentRef.current && equipmentRef.current && equipmentSlot) {
          console.log('🔄 Reattaching equipment to newly loaded avatar...')
          // Small delay to ensure avatar is fully initialized
          setTimeout(() => {
            attachEquipmentToAvatar()
          }, 100)
        }
        
      } catch (error) {
        console.error('Failed to load avatar:', error)
      }
    }
    
    loadAvatar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, avatarUrl])  // Only reload when URL changes, not animation state
  
  // Load equipment
  useEffect(() => {
    if (!isInitialized || !equipmentUrl || !sceneRef.current) return
    
    const loadEquipment = async () => {
      try {
        // Remove ALL existing equipment from scene and bones
        if (sceneRef.current) {
          // Find and remove all equipment wrappers from bones
          if (avatarRef.current) {
            avatarRef.current.traverse((child) => {
              if (child instanceof THREE.Bone) {
                const wrapper = child.getObjectByName('EquipmentWrapper')
                if (wrapper) {
                  child.remove(wrapper)
                }
              }
            })
          }
          
          // Remove any equipment directly in scene
          const toRemove: THREE.Object3D[] = []
          sceneRef.current.traverse((child) => {
            if (child.userData.isEquipment && child !== avatarRef.current) {
              toRemove.push(child)
            }
          })
          toRemove.forEach(obj => obj.removeFromParent())
        }
        
        // Clear equipment reference
        if (equipmentRef.current) {
          // Remove from parent
          if (equipmentRef.current.parent) {
            equipmentRef.current.parent.remove(equipmentRef.current)
          }
          
          // Clear the attachment flag
          shouldAttachEquipmentRef.current = false
          
          // Dispose of geometry and materials
          equipmentRef.current.traverse((child) => {
            if ('geometry' in child && child.geometry) (child.geometry as THREE.BufferGeometry).dispose()
            if ('material' in child && child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material]
              materials.forEach((mat: THREE.Material) => mat.dispose())
            }
          })
        }
        
          equipmentRef.current = null
        equipmentWrapperRef.current = null
        
        // Remove existing debug spheres
        if (debugSpheres.handSphere) {
          sceneRef.current!.remove(debugSpheres.handSphere)
          debugSpheres.handSphere.geometry.dispose()
          ;(debugSpheres.handSphere.material as THREE.Material).dispose()
        }
        if (debugSpheres.gripSphere) {
          sceneRef.current!.remove(debugSpheres.gripSphere)
          debugSpheres.gripSphere.geometry.dispose()
          ;(debugSpheres.gripSphere.material as THREE.Material).dispose()
        }
        setDebugSpheres({})
        
        // Load new equipment
        const gltf = await loader.current.loadAsync(equipmentUrl)
        const loadedEquipment = gltf.scene
        
        // Debug: Check default scale from GLTF
        console.log(`🔍 GLTF scene default scale: (${loadedEquipment.scale.x.toFixed(3)}, ${loadedEquipment.scale.y.toFixed(3)}, ${loadedEquipment.scale.z.toFixed(3)})`)
        
        // Check if there are any scaled children
        let meshCount = 0
        loadedEquipment.traverse((child) => {
          if (child.scale.x !== 1 || child.scale.y !== 1 || child.scale.z !== 1) {
            console.log(`⚠️ Found scaled child "${child.name}": (${child.scale.x.toFixed(3)}, ${child.scale.y.toFixed(3)}, ${child.scale.z.toFixed(3)})`)
          }
          if (child instanceof THREE.Mesh) {
            meshCount++
            const box = new THREE.Box3().setFromObject(child)
            const size = new THREE.Vector3()
            box.getSize(size)
            console.log(`📐 Mesh "${child.name}" size: X:${size.x.toFixed(3)}, Y:${size.y.toFixed(3)}, Z:${size.z.toFixed(3)}`)
          }
        })
        console.log(`🔍 Total meshes found: ${meshCount}`)
        
        // If we have a grip offset, create a normalized weapon where grip is at origin
        let equipment: THREE.Object3D
        if (gripOffset && (gripOffset.x !== 0 || gripOffset.y !== 0 || gripOffset.z !== 0)) {
          const gripVector = new THREE.Vector3(gripOffset.x, gripOffset.y, gripOffset.z)
          console.log(`🎯 Grip offset detected: (${gripOffset.x.toFixed(3)}, ${gripOffset.y.toFixed(3)}, ${gripOffset.z.toFixed(3)})`)
          
          // IMPORTANT: Reset scale on loaded equipment before normalizing
          // This ensures we're working with the original size
          loadedEquipment.scale.set(1, 1, 1)
          loadedEquipment.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.scale.set(1, 1, 1)
            }
          })
          
          equipment = createNormalizedWeapon(loadedEquipment, gripVector)
          equipment.userData.isNormalized = true
          console.log(`✅ Using normalized weapon with grip at origin`)
        } else {
          equipment = loadedEquipment
          equipment.userData.isNormalized = false
          console.log(`✅ Using weapon as-is (no grip offset or already normalized)`)
        }
        
        // Mark as equipment for future cleanup
        equipment.userData.isEquipment = true
        
        // Enable shadows
        equipment.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })
        
        equipmentRef.current = equipment
        
        // Mark that equipment should be attached
        shouldAttachEquipmentRef.current = true
        
        // Apply intelligent scaling if avatar is loaded
        if (avatarRef.current) {
          // Use provided avatar height or calculate from model
          const effectiveHeight = avatarHeight || calculateAvatarHeight(avatarRef.current)
          const autoScaleFactor = autoScale ? calculateWeaponScale(equipment, avatarRef.current, weaponType, effectiveHeight) : 1.0
          const finalScale = scaleOverride * autoScaleFactor
          
          // Store the scale to apply after attachment
          equipment.userData.targetScale = finalScale
          console.log(`Calculated scale: ${finalScale.toFixed(3)} (auto: ${autoScaleFactor.toFixed(3)}, override: ${scaleOverride})`)
          
          // Attach to avatar immediately
            attachEquipmentToAvatar()
          } else {
          // No avatar loaded yet, just apply base scale
          equipment.scale.set(scaleOverride, scaleOverride, scaleOverride)
          }
        
      } catch (error) {
        console.error('Failed to load equipment:', error)
      }
    }
    
    loadEquipment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, equipmentUrl, weaponType, avatarHeight, autoScale, scaleOverride, gripOffset?.x, gripOffset?.y, gripOffset?.z])  // Use individual values to avoid object reference issues
  
  // Update equipment when avatar height or scale changes
  useEffect(() => {
    if (isInitialized && equipmentRef.current && avatarRef.current) {
      // Skip if armor has been fitted by ArmorFittingService
      if (equipmentRef.current.userData.isFitted || weaponType === 'armor') {
        console.log('⚠️ Skipping auto-scale update for fitted/armor equipment')
        return
      }
      
      const effectiveHeight = avatarHeight || calculateAvatarHeight(avatarRef.current)
      const autoScaleFactor = calculateWeaponScale(equipmentRef.current, avatarRef.current, weaponType, effectiveHeight)
      const finalScale = autoScale ? scaleOverride * autoScaleFactor : scaleOverride
      
      // If attached to a bone, compensate for bone scale
      const attachedBone = getAttachedBone(equipmentRef.current)
      if (attachedBone) {
        const boneWorldScale = getWorldScale(attachedBone)
        const compensatedScale = finalScale / boneWorldScale.x
        equipmentRef.current.scale.set(compensatedScale, compensatedScale, compensatedScale)
      } else {
      equipmentRef.current.scale.set(finalScale, finalScale, finalScale)
      }
      
      equipmentRef.current.updateMatrix()
      equipmentRef.current.updateMatrixWorld(true)
    }
  }, [isInitialized, avatarHeight, autoScale, scaleOverride, weaponType])
  
  // Effects that depend on memoized callbacks are placed after their declarations
  const updateEquipmentTransform = () => {
    if (!equipmentRef.current || !avatarRef.current) return
    
    // Check if armor has been fitted - if so, skip everything
    if (equipmentRef.current.userData.isFitted) {
      console.log('🛡️ Skipping transform update - armor has been fitted')
      return
    }
    
    // Calculate scale
    const effectiveHeight = avatarHeight || calculateAvatarHeight(avatarRef.current)
    const autoScaleFactor = calculateWeaponScale(equipmentRef.current, avatarRef.current, weaponType, effectiveHeight)
    const finalScale = autoScale ? scaleOverride * autoScaleFactor : scaleOverride
    
    // Store target scale
    equipmentRef.current.userData.targetScale = finalScale
    
    // If attached to a bone, compensate for bone scale
    const attachedBone = getAttachedBone(equipmentRef.current)
    if (attachedBone) {
      const boneWorldScale = getWorldScale(attachedBone)
      const compensatedScale = finalScale / boneWorldScale.x
      equipmentRef.current.scale.set(compensatedScale, compensatedScale, compensatedScale)
      console.log(`Updated equipment scale to ${compensatedScale.toFixed(3)} (compensated for bone scale ${boneWorldScale.x.toFixed(3)})`)
    } else {
      equipmentRef.current.scale.set(finalScale, finalScale, finalScale)
      console.log(`Updated equipment scale to ${finalScale.toFixed(3)}`)
    }
    
    equipmentRef.current.updateMatrix()
    equipmentRef.current.updateMatrixWorld(true)
  }
  
  // Manual update function for position and rotation
  const updateEquipmentPose = useCallback(() => {
    if (!equipmentRef.current || !avatarRef.current) return
    
    // Skip pose updates for armor - let fitting algorithms handle it
    if (weaponType === 'armor') {
      return
    }
    
    // Find the wrapper - equipment is now always in a wrapper
    let wrapper = equipmentRef.current.parent
    if (!wrapper || wrapper.name !== 'EquipmentWrapper') {
      console.warn('Equipment is not in expected wrapper structure')
      return
    }
    
    const attachedBone = getAttachedBone(equipmentRef.current)
    if (!attachedBone) {
      console.warn('Could not find attached bone')
      return
    }
    
    // Update position
    const avatarHeight = calculateAvatarHeight(avatarRef.current)
    const handOffsetDistance = avatarHeight * 0.045
    const isRightHand = equipmentSlot.includes('_R') || equipmentSlot.includes('Right')
    
    // Get default offsets for weapon type
    const defaultOffsets: Record<string, { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number } }> = {
      sword: {
        position: { 
          x: isRightHand ? 0.076 : -0.076,
          y: 0.077,
          z: 0.028
        },
        rotation: { x: 92, y: 0, z: 0 }
      },
      '2h-sword': {
        position: { 
          x: isRightHand ? 0.076 : -0.076,
          y: 0.077,
          z: 0.028
        },
        rotation: { x: 92, y: 0, z: 0 }
      },
      mace: {
        position: { 
          x: isRightHand ? 0.076 : -0.076,
          y: 0.077,
          z: 0.028
        },
        rotation: { x: 92, y: 0, z: 0 }
      },
      bow: {
        position: { 
          x: isRightHand ? 0.05 : -0.05,
          y: 0.1,
          z: 0
        },
        rotation: { x: 0, y: 90, z: 0 }
      },
      crossbow: {
        position: { 
          x: isRightHand ? 0.076 : -0.076,
          y: 0.05,
          z: 0.05
        },
        rotation: { x: 0, y: 0, z: 0 }
      },
      shield: {
        position: { 
          x: isRightHand ? 0.05 : -0.05,
          y: 0.05,
          z: 0
        },
        rotation: { x: 0, y: 0, z: 0 }
      },
      default: {
        position: { 
          x: isRightHand ? -handOffsetDistance : handOffsetDistance,
          y: 0,
          z: 0
        },
        rotation: { x: 0, y: 0, z: 0 }
      }
    }
    
    const weaponDefaults = defaultOffsets[weaponType] || defaultOffsets.default
    const basePosition = new THREE.Vector3(
      weaponDefaults.position.x,
      weaponDefaults.position.y,
      weaponDefaults.position.z
    )
    
    // Get bone scale to compensate for it
    const boneScale = getWorldScale(attachedBone)
    console.log(`🦴 Bone scale: (${boneScale.x.toFixed(3)}, ${boneScale.y.toFixed(3)}, ${boneScale.z.toFixed(3)})`)
    
    // Update wrapper userData with current offsets
    wrapper.userData.baseHandOffset = basePosition.clone()
    wrapper.userData.manualPositionOffset = positionOffset || { x: 0, y: 0, z: 0 }
    wrapper.userData.manualRotationOffset = orientationOffset || { x: 0, y: 0, z: 0 }
    wrapper.userData.boneScale = boneScale.x // Store bone scale for render loop
    
    // Set wrapper position (relative to bone) - compensate for bone scale
    const compensatedBase = basePosition.clone().divideScalar(boneScale.x)
    wrapper.position.copy(compensatedBase)
    
    if (positionOffset) {
      // Compensate manual offsets for bone scale
      wrapper.position.x += (positionOffset.x || 0) / boneScale.x
      wrapper.position.y += (positionOffset.y || 0) / boneScale.x
      wrapper.position.z += (positionOffset.z || 0) / boneScale.x
    }
    
    console.log(`🎯 Setting wrapper position - Base: (${basePosition.x.toFixed(3)}, ${basePosition.y.toFixed(3)}, ${basePosition.z.toFixed(3)}), Compensated: (${wrapper.position.x.toFixed(3)}, ${wrapper.position.y.toFixed(3)}, ${wrapper.position.z.toFixed(3)}), Bone scale: ${boneScale.x.toFixed(3)}`)
    
    // Show the effect of bone scale compensation
    if (positionOffset && (positionOffset.x || positionOffset.y || positionOffset.z)) {
      console.log(`📊 Bone scale compensation: Manual offset (${(positionOffset.x || 0).toFixed(3)}, ${(positionOffset.y || 0).toFixed(3)}, ${(positionOffset.z || 0).toFixed(3)}) becomes (${((positionOffset.x || 0) / boneScale.x).toFixed(3)}, ${((positionOffset.y || 0) / boneScale.x).toFixed(3)}, ${((positionOffset.z || 0) / boneScale.x).toFixed(3)}) in local space`)
    }
    
    // Get world position to see the actual position
    const worldPos = new THREE.Vector3()
    wrapper.getWorldPosition(worldPos)
    console.log(`🌍 Wrapper world position: (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`)
    
    // Update rotation
    const baseOrientation = calculateWeaponOrientation(equipmentRef.current, attachedBone, weaponType)
    wrapper.rotation.copy(baseOrientation)
    
    // Apply default rotation for weapon type
    const defaultRotation = weaponDefaults.rotation
    wrapper.rotation.x += THREE.MathUtils.degToRad(defaultRotation.x)
    wrapper.rotation.y += THREE.MathUtils.degToRad(defaultRotation.y)
    wrapper.rotation.z += THREE.MathUtils.degToRad(defaultRotation.z)
    
    if (orientationOffset) {
      wrapper.rotation.x += THREE.MathUtils.degToRad(orientationOffset.x)
      wrapper.rotation.y += THREE.MathUtils.degToRad(orientationOffset.y)
      wrapper.rotation.z += THREE.MathUtils.degToRad(orientationOffset.z)
    }
    
    // Force matrix updates
    wrapper.updateMatrix()
    wrapper.updateMatrixWorld(true)
    
    console.log(`🔄 Updated equipment pose - Position: (${wrapper.position.x.toFixed(3)}, ${wrapper.position.y.toFixed(3)}, ${wrapper.position.z.toFixed(3)}), Rotation: (${THREE.MathUtils.radToDeg(wrapper.rotation.x).toFixed(1)}°, ${THREE.MathUtils.radToDeg(wrapper.rotation.y).toFixed(1)}°, ${THREE.MathUtils.radToDeg(wrapper.rotation.z).toFixed(1)}°)`)
  }, [equipmentSlot, orientationOffset, positionOffset, weaponType])
  
  const attachEquipmentToAvatar = useCallback(() => {
    if (!avatarRef.current || !equipmentRef.current || !sceneRef.current) return
    
    // Prevent multiple simultaneous attachment attempts
    if (isAttachingEquipmentRef.current) {
      console.log('⏳ Already attaching equipment, skipping...')
      return
    }
    
    isAttachingEquipmentRef.current = true
    
    // Special handling for armor - position on the target body region
    if (weaponType === 'armor') {
      console.log('🛡️ Handling armor piece - positioning on body region')
      
      // Find the target bone based on equipment slot
      const targetBone = findBone(avatarRef.current, equipmentSlot)
      
      if (targetBone) {
        console.log(`🛡️ Found target bone for armor: ${targetBone.name}`)
        
        // Get bone world position for initial placement
        targetBone.updateMatrixWorld(true)
        const boneWorldPos = new THREE.Vector3()
        targetBone.getWorldPosition(boneWorldPos)
        
        // Position armor at the bone location as a starting point
        equipmentRef.current.position.copy(boneWorldPos)
        
        // Add some offset based on slot type
        if (equipmentSlot === 'Head') {
          equipmentRef.current.position.y += 0.1 // Move helmet up slightly
        } else if (equipmentSlot === 'Spine2') {
          // Chest armor centered on torso
          equipmentRef.current.position.y -= 0.05
        } else if (equipmentSlot === 'Hips') {
          // Leg armor positioned lower
          equipmentRef.current.position.y -= 0.1
        }
        
        console.log(`🛡️ Armor initial position: ${equipmentRef.current.position.x.toFixed(3)}, ${equipmentRef.current.position.y.toFixed(3)}, ${equipmentRef.current.position.z.toFixed(3)}`)
      } else {
        console.log('🛡️ No target bone found, positioning at origin')
        equipmentRef.current.position.set(0, 0, 0)
      }
      
      isAttachingEquipmentRef.current = false
      return
    }
    
    // Non-armor equipment: resolve the target bone by slot and attach
    const targetBone = findBone(avatarRef.current, equipmentSlot)
    if (!targetBone) {
      console.warn(`⚠️ Could not resolve target bone for slot: ${equipmentSlot}`)
      isAttachingEquipmentRef.current = false
      return
    }
    
    // Create or reuse wrapper
    let wrapper = equipmentRef.current.parent
    if (!wrapper || wrapper.name !== 'EquipmentWrapper') {
      wrapper = new THREE.Group()
      wrapper.name = 'EquipmentWrapper'
      targetBone.add(wrapper)
      wrapper.add(equipmentRef.current)
    } else if (wrapper.parent !== targetBone) {
      // Ensure wrapper is parented to the correct bone
      if (wrapper.parent) {
        wrapper.parent.remove(wrapper)
      }
      targetBone.add(wrapper)
    }

    // Initial transform similar to the old working logic
    avatarRef.current.updateMatrixWorld(true)
    targetBone.updateMatrixWorld(true)

    const isRightHand = equipmentSlot.includes('_R') || equipmentSlot.includes('Right')
    const effectiveHeight = avatarHeight || calculateAvatarHeight(avatarRef.current)
    const handOffsetDistance = effectiveHeight * 0.045
    const defaultOffsets: Record<string, { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number } }> = {
      sword: { position: { x: isRightHand ? 0.076 : -0.076, y: 0.077, z: 0.028 }, rotation: { x: 92, y: 0, z: 0 } },
      '2h-sword': { position: { x: isRightHand ? 0.076 : -0.076, y: 0.077, z: 0.028 }, rotation: { x: 92, y: 0, z: 0 } },
      mace: { position: { x: isRightHand ? 0.076 : -0.076, y: 0.077, z: 0.028 }, rotation: { x: 92, y: 0, z: 0 } },
      bow: { position: { x: isRightHand ? 0.05 : -0.05, y: 0.1, z: 0 }, rotation: { x: 0, y: 90, z: 0 } },
      crossbow: { position: { x: isRightHand ? 0.076 : -0.076, y: 0.05, z: 0.05 }, rotation: { x: 0, y: 0, z: 0 } },
      shield: { position: { x: isRightHand ? 0.05 : -0.05, y: 0.05, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      default: { position: { x: isRightHand ? -handOffsetDistance : handOffsetDistance, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    }
    const weaponDefaults = defaultOffsets[weaponType] || defaultOffsets.default

    // Position with bone scale compensation
    const handOffset = new THREE.Vector3(weaponDefaults.position.x, weaponDefaults.position.y, weaponDefaults.position.z)
    const boneScale = getWorldScale(targetBone)
    wrapper.position.copy(handOffset.clone().divideScalar(boneScale.x))

    // Store offsets on wrapper for later pose updates
    wrapper.userData.baseHandOffset = handOffset.clone()
    wrapper.userData.manualPositionOffset = positionOffset || { x: 0, y: 0, z: 0 }
    wrapper.userData.manualRotationOffset = orientationOffset || { x: 0, y: 0, z: 0 }
    wrapper.userData.boneScale = boneScale.x

    // Orientation
    const orientation = calculateWeaponOrientation(equipmentRef.current, targetBone, weaponType)
    wrapper.rotation.copy(orientation)
    wrapper.rotation.x += THREE.MathUtils.degToRad(weaponDefaults.rotation.x)
    wrapper.rotation.y += THREE.MathUtils.degToRad(weaponDefaults.rotation.y)
    wrapper.rotation.z += THREE.MathUtils.degToRad(weaponDefaults.rotation.z)
    if (orientationOffset) {
      wrapper.rotation.x += THREE.MathUtils.degToRad(orientationOffset.x)
      wrapper.rotation.y += THREE.MathUtils.degToRad(orientationOffset.y)
      wrapper.rotation.z += THREE.MathUtils.degToRad(orientationOffset.z)
    }

    // Apply scale after attachment with bone compensation if a target scale was computed
    if (equipmentRef.current.userData.targetScale) {
      const targetScale = equipmentRef.current.userData.targetScale
      const boneWorldScale = getWorldScale(targetBone)
      const compensatedScale = targetScale / boneWorldScale.x
      equipmentRef.current.scale.set(compensatedScale, compensatedScale, compensatedScale)
      equipmentRef.current.updateMatrix()
      equipmentRef.current.updateMatrixWorld(true)
    }
    
    // Ensure correct transform hierarchy
    wrapper.updateMatrixWorld(true)
    equipmentRef.current.updateMatrixWorld(true)
    
    // Finalize by invoking pose update to keep behavior consistent
    updateEquipmentPose()
    
    isAttachingEquipmentRef.current = false
  }, [equipmentSlot, updateEquipmentPose, weaponType, avatarHeight, orientationOffset, positionOffset])
  
  const findBone = (object: THREE.Object3D, boneName: string): THREE.Bone | null => {
    const possibleNames = BONE_MAPPING[boneName] || [boneName]
    let foundBone: THREE.Bone | null = null
    
    // Debug: log all bones found
    const allBones: string[] = []
    
    // Search through all SkinnedMesh objects and their skeletons
    object.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && child.skeleton) {
        child.skeleton.bones.forEach(bone => {
          allBones.push(bone.name)
          
          // Check exact matches first
          if (possibleNames.includes(bone.name)) {
            foundBone = bone
            console.log(`✅ Found matching bone: ${bone.name} for slot ${boneName}`)
          }
          // If no exact match, check partial matches
          else if (!foundBone) {
            for (const possibleName of possibleNames) {
              if (bone.name.toLowerCase().includes(possibleName.toLowerCase()) ||
                  possibleName.toLowerCase().includes(bone.name.toLowerCase())) {
                foundBone = bone
                console.log(`✅ Found partial match bone: ${bone.name} for slot ${boneName}`)
                break
              }
            }
          }
        })
      }
    })
    
    if (!foundBone) {
      console.log(`❌ Could not find bone for slot ${boneName}`)
      console.log(`   Looked for: [${possibleNames.join(', ')}]`)
      console.log(`   Available bones: [${allBones.join(', ')}]`)
    }
    
    return foundBone
  }
  
  const updateSkeletonHelper = useCallback(() => {
    if (!avatarRef.current || !sceneRef.current) return
    
    // Remove existing helper
    if (skeletonHelperRef.current) {
      sceneRef.current.remove(skeletonHelperRef.current)
      skeletonHelperRef.current = null
    }
    
    if (showSkeleton) {
      // Find skinned mesh
      avatarRef.current.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
          const helper = new THREE.SkeletonHelper(child.skeleton.bones[0])
          helper.material = new THREE.LineBasicMaterial({ 
            color: 0x00ff00,
            linewidth: 2,
            depthTest: false,
            depthWrite: false
          })
          sceneRef.current!.add(helper)
          skeletonHelperRef.current = helper
        }
      })
    }
  }, [showSkeleton])

  // Update equipment orientation when manual offset changes
  useEffect(() => {
    if (isInitialized && equipmentRef.current) {
      updateEquipmentPose()
    }
  }, [orientationOffset?.x, orientationOffset?.y, orientationOffset?.z, weaponType, isInitialized, updateEquipmentPose])
  
  // Update equipment position when manual position offset changes
  useEffect(() => {
    if (isInitialized && equipmentRef.current) {
      updateEquipmentPose()
    }
  }, [positionOffset?.x, positionOffset?.y, positionOffset?.z, equipmentSlot, isInitialized, updateEquipmentPose])
  
  // Update skeleton visibility
  useEffect(() => {
    updateSkeletonHelper()
  }, [showSkeleton, updateSkeletonHelper])
  
  // Re-attach equipment when grip offset changes
  useEffect(() => {
    if (isInitialized && equipmentRef.current && avatarRef.current && equipmentSlot) {
      console.log('Grip offset changed, re-attaching equipment...')
      attachEquipmentToAvatar()
    }
  }, [gripOffset?.x, gripOffset?.y, gripOffset?.z, isInitialized, attachEquipmentToAvatar, equipmentSlot])
  
  // Re-attach equipment when slot changes
  useEffect(() => {
    if (isInitialized && equipmentRef.current && avatarRef.current && equipmentSlot) {
      console.log('Equipment slot changed to:', equipmentSlot)
      attachEquipmentToAvatar()
    }
  }, [equipmentSlot, isInitialized, attachEquipmentToAvatar])
  
  // Update animation ref when prop changes
  useEffect(() => {
    isAnimatingRef.current = isAnimating
  }, [isAnimating])
  
  // Initialize animation ref
  useEffect(() => {
    isAnimatingRef.current = isAnimating
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Handle animation state changes
   
  useEffect(() => {
    console.log(`🎬 Animation state changed - isAnimating: ${isAnimating}, animationType: ${animationType}`)
    console.log(`   animationMixerRef: ${!!animationMixerRef.current}, avatarRef: ${!!avatarRef.current}`)
    console.log(`   animationClips: ${animationClipsRef.current.length}`)
    
    if (!animationMixerRef.current || !avatarRef.current) {
      console.log('⚠️ Animation mixer or avatar not ready yet')
      return
    }
    
    // Store equipment parent before stopping animation
    let equipmentParent = null
    let equipmentParentName = null
    let equipmentWrapper = equipmentWrapperRef.current
    
    if (equipmentRef.current && equipmentRef.current.parent) {
      equipmentParent = equipmentRef.current.parent
      equipmentParentName = equipmentRef.current.parent.name
      console.log(`📦 Equipment currently attached to: ${equipmentParentName}`)
      
      // If equipment is in a wrapper, store the wrapper's parent too
      if (equipmentParent.name === 'EquipmentWrapper' && equipmentParent.parent) {
        console.log(`   Wrapper attached to bone: ${equipmentParent.parent.name}`)
      }
    }
    
    // Stop any currently playing animation
    if (currentActionRef.current) {
      currentActionRef.current.stop()
      currentActionRef.current = null
    }
    
    if (isAnimating && animationType !== 'tpose') {
      // Find the appropriate animation clip
      let clipToPlay = null
      
      // Log all available clips with more detail
      console.log('📋 Available animation clips:')
      animationClipsRef.current.forEach((clip, idx) => {
        console.log(`   ${idx}: "${clip.name}" (${clip.duration.toFixed(2)}s, ${clip.tracks.length} tracks)`)
      })
      
      // Check if we have multiple unique animations
      const uniqueAnimations = new Set(animationClipsRef.current.map(clip => clip.uuid))
      console.log(`📊 Unique animations: ${uniqueAnimations.size}`)
      
      // If we only have one animation, inform the user
      if (animationClipsRef.current.length === 1) {
        console.warn(`⚠️ This model only has one animation: "${animationClipsRef.current[0].name}". Walking and running will use the same animation.`)
      }
      
      // First, try to find a clip by name
      if (animationType === 'walking') {
        clipToPlay = animationClipsRef.current.find(clip => {
          const name = clip.name.toLowerCase()
          return name.includes('walk') || 
                 name.includes('walking') ||
                 (name === 'animation' && animationClipsRef.current.length === 1) // Only use generic if it's the only one
        })
        console.log(`🚶 Looking for walking animation, found: ${clipToPlay ? clipToPlay.name : 'none'}`)
      } else if (animationType === 'running') {
        clipToPlay = animationClipsRef.current.find(clip => {
          const name = clip.name.toLowerCase()
          return name.includes('run') || 
                 name.includes('running') ||
                 name.includes('sprint') ||
                 name.includes('jog')
        })
        console.log(`🏃 Looking for running animation, found: ${clipToPlay ? clipToPlay.name : 'none'}`)
        
        // If no running animation found and we have multiple clips, try to find one that's NOT walking
        if (!clipToPlay && animationClipsRef.current.length > 1) {
          clipToPlay = animationClipsRef.current.find(clip => {
            const name = clip.name.toLowerCase()
            return !name.includes('walk') && !name.includes('walking') && name !== 'idle' && name !== 'tpose'
          })
          if (clipToPlay) {
            console.log(`🏃 No running found, using alternative: ${clipToPlay.name}`)
          }
        }
      }
      
      // If no specific clip found, use the first available
      if (!clipToPlay && animationClipsRef.current.length > 0) {
        clipToPlay = animationClipsRef.current[0]
        console.log(`⚠️ No ${animationType} animation found, using first available: "${clipToPlay.name}"`)
      }
      
      if (clipToPlay) {
        // Log if we're playing a different animation type than requested
        const clipName = clipToPlay.name.toLowerCase()
        if (animationType === 'running' && (clipName.includes('walk') || clipName.includes('walking'))) {
          console.warn(`⚠️ Requested running but playing walking animation: "${clipToPlay.name}"`)
        }
        
        currentActionRef.current = animationMixerRef.current.clipAction(clipToPlay)
        currentActionRef.current.setLoop(THREE.LoopRepeat, Infinity)
        currentActionRef.current.play()
        console.log(`▶️ Started animation playback: "${clipToPlay.name}" (${clipToPlay.uuid}) for ${animationType}`)
      } else {
        console.error(`❌ No animation clips available to play`)
      }
    } else {
      console.log(`⏹️ Stopped animation playback (isAnimating: ${isAnimating}, animationType: ${animationType})`)
    }
    
    // Log equipment status after animation change
    if (equipmentRef.current) {
      console.log(`📦 Equipment after animation change:`)
      console.log(`   Has parent: ${!!equipmentRef.current.parent}`)
      console.log(`   Parent name: ${equipmentRef.current.parent?.name || 'none'}`)
      console.log(`   Parent type: ${equipmentRef.current.parent?.type || 'none'}`)
    }
    
    // Ensure equipment stays attached
    if (equipmentWrapper && equipmentWrapper.parent && !equipmentRef.current?.parent) {
      console.log(`⚠️ Equipment detached but wrapper still exists, re-adding to wrapper`)
      equipmentWrapper.add(equipmentRef.current!)
    } else if (equipmentRef.current && equipmentParent && !equipmentRef.current.parent) {
      console.log(`⚠️ Equipment was detached during animation change, reattaching to ${equipmentParentName}...`)
      equipmentParent.add(equipmentRef.current)
    }
    
    // Force update matrices after animation change
    if (avatarRef.current) {
      avatarRef.current.updateMatrixWorld(true)
    }
    
    // Double-check equipment attachment after a short delay
    setTimeout(() => {
      if (equipmentRef.current && avatarRef.current && equipmentSlot) {
        const attachedBone = getAttachedBone(equipmentRef.current)
        if (!attachedBone) {
          console.log('⚠️ Equipment needs to be reattached after animation change')
          console.log('🔧 Reattaching equipment...')
          attachEquipmentToAvatar()
        } else {
          console.log(`✅ Equipment still attached to bone: ${attachedBone.name}`)
          
          // Verify wrapper integrity
          if (equipmentRef.current.parent?.name === 'EquipmentWrapper') {
            const wrapper = equipmentRef.current.parent
            console.log(`   Wrapper position: (${wrapper.position.x.toFixed(3)}, ${wrapper.position.y.toFixed(3)}, ${wrapper.position.z.toFixed(3)})`)
            console.log(`   Wrapper parent: ${wrapper.parent?.name || 'none'}`)
          }
        }
      }
    }, 150) // Slightly longer delay to ensure animation has updated
  }, [isAnimating, animationType, equipmentSlot, attachEquipmentToAvatar])
  
  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    exportEquippedModel: async () => {
      if (!avatarRef.current) return new ArrayBuffer(0)

      // Export the avatar with attached equipment
      const _exporter = new GLTFExporter()
      const gltf = await _exporter.parseAsync(avatarRef.current, {
        binary: true,
        includeCustomExtensions: true
      })
      return gltf as ArrayBuffer
    },
    
    exportAlignedEquipment: async () => {
      if (!equipmentRef.current) return new ArrayBuffer(0)
      const _exporter = new GLTFExporter()
      const gltf = await _exporter.parseAsync(equipmentRef.current, {
        binary: true,
        includeCustomExtensions: true
      })
      return gltf as ArrayBuffer
    },
    
    reattachEquipment: () => {
      if (avatarRef.current && equipmentRef.current && equipmentSlot) {
        console.log('Manually re-attaching equipment')
        attachEquipmentToAvatar()
      }
    },
    
    resetCamera: () => {
      if (cameraRef.current && orbitControlsRef.current) {
        cameraRef.current.position.set(2, 1.5, 2)
        cameraRef.current.lookAt(0, 1, 0)
        orbitControlsRef.current.target.set(0, 1, 0)
        orbitControlsRef.current.update()
      }
    },
    
    takeScreenshot: () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return ''
      
      rendererRef.current.render(sceneRef.current, cameraRef.current)
      return rendererRef.current.domElement.toDataURL('image/png')
    },

    updateEquipmentTransform: () => {
      updateEquipmentTransform()
    },

    updateEquipmentPose: () => {
      updateEquipmentPose()
    },
    
    getScene: () => {
      return sceneRef.current
    },
    
    getAvatar: () => {
      return avatarRef.current
    },
    
    getEquipment: () => {
      return equipmentRef.current
    },
    
    forceRender: () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current)
      }
    }
  }))
  
  // Cleanup function
  const cleanup = useCallback(() => {
    // Clean up animations
    if (currentActionRef.current) {
      currentActionRef.current.stop()
      currentActionRef.current = null
    }
    if (animationMixerRef.current) {
      animationMixerRef.current.stopAllAction()
      animationMixerRef.current = null
    }
    animationClipsRef.current = []
    
    if (avatarRef.current) {
      sceneRef.current?.remove(avatarRef.current)
      avatarRef.current.traverse((child: THREE.Object3D) => {
        if ('geometry' in child && child.geometry) (child.geometry as THREE.BufferGeometry).dispose()
        if ('material' in child && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((mat: THREE.Material) => mat.dispose())
        }
      })
      avatarRef.current = null
    }
    
    if (equipmentRef.current) {
      if (equipmentRef.current.parent) {
        equipmentRef.current.parent.remove(equipmentRef.current)
      }
      equipmentRef.current.traverse((child: THREE.Object3D) => {
        if ('geometry' in child && child.geometry) (child.geometry as THREE.BufferGeometry).dispose()
        if ('material' in child && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((mat: THREE.Material) => mat.dispose())
        }
      })
      equipmentRef.current = null
    }
    
    if (skeletonHelperRef.current) {
      sceneRef.current?.remove(skeletonHelperRef.current)
      skeletonHelperRef.current = null
    }
    
    setDebugSpheres({})
    
    // Reset flags
    shouldAttachEquipmentRef.current = false
    isAttachingEquipmentRef.current = false
  }, [])
  
  // Create debug spheres
  const _createDebugSpheres = (handPosition: THREE.Vector3, gripPosition: THREE.Vector3) => {
    // Remove existing spheres
    if (debugSpheres.handSphere) {
      sceneRef.current?.remove(debugSpheres.handSphere)
      debugSpheres.handSphere.geometry.dispose()
      ;(debugSpheres.handSphere.material as THREE.Material).dispose()
    }
    if (debugSpheres.gripSphere) {
      sceneRef.current?.remove(debugSpheres.gripSphere)
      debugSpheres.gripSphere.geometry.dispose()
      ;(debugSpheres.gripSphere.material as THREE.Material).dispose()
    }
    if (debugSpheres.centerSphere) {
      sceneRef.current?.remove(debugSpheres.centerSphere)
      debugSpheres.centerSphere.geometry.dispose()
      ;(debugSpheres.centerSphere.material as THREE.Material).dispose()
    }
    if (debugSpheres.line) {
      sceneRef.current?.remove(debugSpheres.line)
      debugSpheres.line.geometry.dispose()
      ;(debugSpheres.line.material as THREE.Material).dispose()
    }
    if (debugSpheres.wristSphere) {
      sceneRef.current?.remove(debugSpheres.wristSphere)
      debugSpheres.wristSphere.geometry.dispose()
      ;(debugSpheres.wristSphere.material as THREE.Material).dispose()
    }
    
    // Calculate sphere size based on avatar height
    const avatarHeight = avatarRef.current ? calculateAvatarHeight(avatarRef.current) : 1.8
    const sphereRadius = avatarHeight * 0.03 // 3% of avatar height
    
    // Create hand sphere (blue)
    const handGeometry = new THREE.SphereGeometry(sphereRadius, 16, 16)
    const handMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff })
    const handSphere = new THREE.Mesh(handGeometry, handMaterial)
    handSphere.position.copy(handPosition)
    sceneRef.current?.add(handSphere)
    
    // Create grip sphere (red)
    const gripGeometry = new THREE.SphereGeometry(sphereRadius, 16, 16)
    const gripMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    const gripSphere = new THREE.Mesh(gripGeometry, gripMaterial)
    gripSphere.position.copy(gripPosition)
    sceneRef.current?.add(gripSphere)
    
    // Create weapon center sphere (yellow) - shows where the weapon mesh actually is
    if (equipmentRef.current) {
      const centerGeometry = new THREE.SphereGeometry(sphereRadius * 0.7, 16, 16)
      const centerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 })
      const centerSphere = new THREE.Mesh(centerGeometry, centerMaterial)
      
      // Get the actual weapon mesh center
      const weaponBounds = new THREE.Box3().setFromObject(equipmentRef.current)
      const weaponCenter = new THREE.Vector3()
      weaponBounds.getCenter(weaponCenter)
      
      centerSphere.position.copy(weaponCenter)
      sceneRef.current?.add(centerSphere)
      
      console.log(`🟡 Weapon center (yellow): (${weaponCenter.x.toFixed(3)}, ${weaponCenter.y.toFixed(3)}, ${weaponCenter.z.toFixed(3)})`)
      
      // Add a line from hand to grip
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([handPosition, gripPosition])
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 })
      const line = new THREE.Line(lineGeometry, lineMaterial)
      sceneRef.current?.add(line)
      
      // Add purple sphere to show actual wrist bone position (before hand offset)
      const wristGeometry = new THREE.SphereGeometry(sphereRadius * 0.5, 16, 16)
      const wristMaterial = new THREE.MeshBasicMaterial({ color: 0x9900ff, transparent: true, opacity: 0.7 })
      const wristSphere = new THREE.Mesh(wristGeometry, wristMaterial)
      wristSphere.position.copy(handPosition)
      // Move it back by the hand offset amount to show original wrist position
      const handOffsetDistance = avatarHeight * 0.045
      wristSphere.position.z -= handOffsetDistance
      sceneRef.current?.add(wristSphere)
      
      console.log(`🟣 Wrist bone position (purple): (${wristSphere.position.x.toFixed(3)}, ${wristSphere.position.y.toFixed(3)}, ${wristSphere.position.z.toFixed(3)})`)
      
      setDebugSpheres({ handSphere, gripSphere, centerSphere, line, wristSphere })
    } else {
      setDebugSpheres({ handSphere, gripSphere })
    }
    
    // Calculate distance
    const distance = handPosition.distanceTo(gripPosition)
    console.log(`🎯 Distance between hand (blue) and grip (red): ${distance.toFixed(3)}m`)
    console.log(`  Hand position: (${handPosition.x.toFixed(3)}, ${handPosition.y.toFixed(3)}, ${handPosition.z.toFixed(3)})`)
    console.log(`  Grip position: (${gripPosition.x.toFixed(3)}, ${gripPosition.y.toFixed(3)}, ${gripPosition.z.toFixed(3)})`)
    console.log(`  Sphere radius: ${sphereRadius.toFixed(3)}m`)
  }
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])
  
  return <div ref={containerRef} className="w-full h-full equipment-viewer-container" data-instance-id={instanceId.current} />
})

EquipmentViewer.displayName = 'EquipmentViewer'

export default EquipmentViewer