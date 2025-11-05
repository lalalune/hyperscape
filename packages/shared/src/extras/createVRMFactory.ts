/**
 * createVRMFactory.ts - VRM Character Avatar Factory
 * 
 * Creates instances of VRM character models with animations, bone access, and performance optimization.
 * VRM is a standard format for 3D humanoid avatars used in VR/AR and games.
 * 
 * **VRM Features:**
 * - Standardized humanoid skeleton (hips, spine, head, limbs)
 * - Expression/blend shapes (happy, sad, blink, etc.)
 * - First-person view setup (hide head in FP mode)
 * - Spring bone physics (hair, clothes)
 * - Metadata (author, usage rights, etc.)
 * 
 * **Factory Pattern:**
 * - One factory per VRM model (shared across multiple instances)
 * - create() method spawns new instances
 * - Instances share skeleton structure but have independent poses
 * - Reduces memory and processing for multiple copies
 * 
 * **Performance Optimizations:**
 * - Distance-based update rate (far avatars update less frequently)
 * - Detached bind mode for skinned meshes
 * - Manual matrix updates only when needed
 * - Shared geometry across instances via SkeletonUtils.clone
 * - BVH raycasting acceleration
 * 
 * **Instance Features:**
 * - setEmote(url): Play animation
 * - move(matrix): Update position/rotation
 * - getBoneTransform(boneName): Get bone matrix
 * - setFirstPerson(bool): Toggle first-person visibility
 * - height, headToHeight: Avatar dimensions
 * 
 * **CSM Shadow Integration:**
 * - Calls setupMaterial() on all materials for shadow support
 * - Sets shadowSide to BackSide to prevent shadow acne
 * 
 * **Referenced by:** Avatar nodes, PlayerLocal, PlayerRemote
 */

import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

import type { GLBData } from '../types'
import type { VRMHooks } from '../types/physics'

/** Degrees to radians conversion */
const DEG2RAD = Math.PI / 180

import { getTextureBytesFromMaterial } from './getTextureBytesFromMaterial'
import { getTrianglesFromGeometry } from './getTrianglesFromGeometry'
import THREE from './three'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()

/** How often to check avatar distance for LOD (seconds) */
const DIST_CHECK_RATE = 1

/** Minimum update rate for close avatars (updates/second) */
const DIST_MIN_RATE = 1 / 5

/** Maximum update rate for far avatars (updates/second) */
const DIST_MAX_RATE = 1 / 25

/** Distance for minimum update rate (meters) */
const DIST_MIN = 30

/** Distance for maximum update rate (meters) */
const DIST_MAX = 60

const material = new THREE.MeshBasicMaterial()

/**
 * Create VRM Avatar Factory
 * 
 * Prepares a VRM model for instancing with animations and optimizations.
 * 
 * @param glb - Loaded VRM GLB data
 * @param setupMaterial - Optional material setup function (for CSM shadows)
 * @returns Factory object with create() method and stats tracking
 */
export function createVRMFactory(glb: GLBData, setupMaterial?: (material: THREE.Material) => void) {
  console.log('[VRMFactory] createVRMFactory called', { hasVRM: !!glb.userData?.vrm })
  // we'll update matrix ourselves
  glb.scene.matrixAutoUpdate = false
  glb.scene.matrixWorldAutoUpdate = false
  // remove expressions from scene
  const expressions = glb.scene.children.filter(n => n.type === 'VRMExpression') // prettier-ignore
  for (const node of expressions) node.removeFromParent()
  // KEEP VRMHumanoidRig - we need normalized bones for A-pose support (Asset Forge approach)
  // const vrmHumanoidRigs = glb.scene.children.filter(n => n.name === 'VRMHumanoidRig') // prettier-ignore
  // for (const node of vrmHumanoidRigs) node.removeFromParent()
  // remove secondary
  const secondaries = glb.scene.children.filter(n => n.name === 'secondary') // prettier-ignore
  for (const node of secondaries) node.removeFromParent()
  // enable shadows
  glb.scene.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true
      obj.receiveShadow = true
    }
  })
  // MMO APPROACH: Use cloning with raw bones for memory efficiency
  const humanoid = glb.userData?.vrm?.humanoid;
  const bones = humanoid?._rawHumanBones?.humanBones || {};
  const normBones = humanoid?._normalizedHumanBones?.humanBones || {};

  // Calculate root to hips offset (needed for animation retargeting)
  const hipsPosition = v1.setFromMatrixPosition(bones.hips?.node?.matrixWorld || new THREE.Matrix4())
  const rootPosition = v2.set(0, 0, 0)
  const rootToHips = hipsPosition.y - rootPosition.y

  // Get VRM version
  const vrmData = glb.userData?.vrm;
  const version = vrmData?.meta?.metaVersion
  // VRM 1.0+ check: version string starts with "1" or higher
  const isVRM1OrHigher = version !== '0' && (!version || (typeof version === 'string' && !version.startsWith('0.')))
  console.log('[VRMFactory] VRM version detected:', { version, isVRM1OrHigher }, '(will apply 180° rotation for VRM 1.0+)')

  // Setup skinned meshes with NORMAL bind mode (for normalized bone compatibility)
  // DetachedBindMode is incompatible with normalized bones in scene graph
  const skinnedMeshes: THREE.SkinnedMesh[] = []
  glb.scene.traverse(node => {
    if (node instanceof THREE.SkinnedMesh) {
      const skinnedMesh = node;
      // Use default bind mode (NormalBindMode) - compatible with normalized bones
      // DetachedBindMode requires bones to be detached, but we keep them in scene for vrm.humanoid.update()
      skinnedMeshes.push(skinnedMesh)
    }
    if (node instanceof THREE.Mesh) {
      const mesh = node;
      // bounds tree
      mesh.geometry.computeBoundsTree()
      // fix csm shadow banding
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => {
          (mat as THREE.Material & { shadowSide: THREE.Side }).shadowSide = THREE.BackSide
        })
      } else {
        (mesh.material as THREE.Material & { shadowSide: THREE.Side }).shadowSide = THREE.BackSide
      }
      // csm material setup
      if (setupMaterial) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => setupMaterial!(mat))
        } else {
          setupMaterial(mesh.material)
        }
      }
    }
  })

  const skeleton = skinnedMeshes[0].skeleton

  // HYBRID APPROACH: Using Asset Forge's normalized bone system for automatic A-pose handling
  // By keeping VRMHumanoidRig and using getNormalizedBoneNode() for bone names,
  // the VRM library's normalized bone abstraction layer handles bind pose compensation automatically
  console.log('[VRMFactory] Using normalized bone system for automatic A-pose handling')

  // Get height from bounding box
  let height = 0.5 // minimum
  for (const mesh of skinnedMeshes) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    height = Math.max(height, mesh.geometry.boundingBox!.max.y)
  }

  // Calculate head to height for camera positioning
  const headPos = normBones.head?.node?.getWorldPosition(v1) || v1.set(0,0,0)
  const headToHeight = height - headPos.y

  const noop = () => {
    // ...
  }

  return {
    create,
    applyStats(stats: { geometries: Set<string>; materials: Set<string>; triangles: number; textureBytes: number }) {
      glb.scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry && !stats.geometries.has(obj.geometry.uuid)) {
            stats.geometries.add(obj.geometry.uuid)
            stats.triangles += getTrianglesFromGeometry(obj.geometry)
          }
          if (obj.material) {
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            materials.forEach(mat => {
              if (!stats.materials.has(mat.uuid)) {
                stats.materials.add(mat.uuid)
                stats.textureBytes += getTextureBytesFromMaterial(mat)
              }
            })
          }
        }
      })
    },
  }

  function create(matrix: THREE.Matrix4, hooks: VRMHooks, node?: { ctx?: { entity?: unknown } }) {

    const nodeWithCtx = node as unknown as { ctx?: { stage?: { scene?: THREE.Scene } } }
    const alternateScene = nodeWithCtx?.ctx?.stage?.scene

    // MMO APPROACH: Clone the VRM for each player instance
    // This is memory efficient - shared geometry/textures, only skeleton is duplicated
    // VRM humanoid is shared (only used for bone lookup, not for animation updates)
    const vrm = cloneGLB(glb)
    const _tvrm = vrm.userData?.vrm

    const skinnedMeshes = getSkinnedMeshes(vrm.scene as THREE.Scene)
    const skeleton = skinnedMeshes[0].skeleton
    const rootBone = skeleton.bones[0]
    // CRITICAL: Keep rootBone in scene graph for normalized bone system to work
    // Detaching breaks normalized bones → raw bone propagation
    // rootBone.parent?.remove(rootBone)  // REMOVED - keep in scene
    rootBone.updateMatrixWorld(true)

    // HYBRID APPROACH: Use NORMALIZED bone names (Asset Forge method)
    // This allows VRM library's automatic bind pose handling to work
    // Normalized bones are cloned with the scene, so each instance has its own
    const getBoneName = (vrmBoneName: string): string | undefined => {
      if (!humanoid) return undefined

      // Get normalized bone node - this handles A-pose automatically
      const normalizedNode = humanoid.getNormalizedBoneNode?.(vrmBoneName as any)
      if (!normalizedNode) {
        console.warn('[VRMFactory.getBoneName] Normalized bone not found:', vrmBoneName)
        return undefined
      }

      // The normalized node name (e.g., "Normalized_Hips")
      const normalizedName = normalizedNode.name

      // Find this normalized node in the CLONED scene
      const clonedNormalizedNode = vrm.scene.getObjectByName(normalizedName)
      if (!clonedNormalizedNode) {
        console.warn('[VRMFactory.getBoneName] Cloned normalized bone not found:', normalizedName)
        return undefined
      }

      // Debug log for hips only
      if (vrmBoneName === 'hips') {
        console.log('[VRMFactory.getBoneName] Found normalized bone:', {
          vrmBoneName,
          normalizedName,
          clonedNodeUUID: clonedNormalizedNode.uuid,
          isInClonedScene: vrm.scene.getObjectByProperty('uuid', clonedNormalizedNode.uuid) !== undefined
        })
      }

      return clonedNormalizedNode.name  // Returns normalized bone name
    }

    // VRM 1.0+ models face +Z by default, but game expects -Z forward
    // Apply 180-degree Y-axis rotation only for VRM 1.0+
    // VRM 0.x models already face the correct direction
    let finalMatrix = matrix
    if (isVRM1OrHigher) {
      console.log('[VRMFactory] Applying 180° rotation for VRM 1.0+ model')
      const rotationMatrix = new THREE.Matrix4().makeRotationY(Math.PI)
      finalMatrix = new THREE.Matrix4().multiplyMatrices(matrix, rotationMatrix)
    }

    vrm.scene.matrix.copy(finalMatrix)
    vrm.scene.matrixWorld.copy(finalMatrix)
    vrm.scene.matrixAutoUpdate = false
    vrm.scene.matrixWorldAutoUpdate = false

    // A-pose compensation is handled automatically by VRM normalized bones
    // Cloned instances have their own normalized bones for independent animation

    if (hooks?.scene) {
      hooks.scene.add(vrm.scene)
    } else if (alternateScene) {
      console.warn('[VRMFactory] WARNING: No scene in hooks, using alternate scene from node.ctx.stage.scene')
      alternateScene.add(vrm.scene)
    } else {
      console.error('[VRMFactory] ERROR: No scene available, VRM will not be visible!')
    }

    const getEntity = () => node?.ctx?.entity

    // spatial capsule
    const cRadius = 0.3
    const sItem: {
      matrix: THREE.Matrix4;
      geometry: THREE.BufferGeometry;
      material: THREE.Material;
      getEntity: () => unknown;
    } = {
      matrix,
      geometry: createCapsule(cRadius, height - cRadius * 2),
      material,
      getEntity,
    };
    if (hooks?.octree) {
      hooks.octree.insert(sItem)
    }

    // debug capsule
    // const foo = new THREE.Mesh(
    //   sItem.geometry,
    //   new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5 })
    // )
    // vrm.scene.add(foo)

    // link back entity for raycasts

    vrm.scene.traverse(o => {
      Object.defineProperty(o, 'getEntity', {
        value: getEntity,
        writable: true,
        enumerable: false,
        configurable: true
      })
    })

    // HYBRID APPROACH: AnimationMixer on vrm.scene (Asset Forge method)
    // Animations target normalized bone names (Normalized_Hips, Normalized_Spine, etc.)
    // VRM library's normalized bone system handles A-pose automatically via vrm.humanoid.update()
    // Each clone has its own vrm.scene with cloned normalized bones
    // CRITICAL: Mixer must be on vrm.scene where normalized bones live
    const mixer = new THREE.AnimationMixer(vrm.scene)

    // IDEA: we should use a global frame "budget" to distribute across avatars
    // https://chatgpt.com/c/4bbd469d-982e-4987-ad30-97e9c5ee6729

    let elapsed = 0
    let rate = 0
    let rateCheckedAt = 999
    let rateCheck = true
    let updateCallCount = 0
    const update = delta => {
      updateCallCount++
      elapsed += delta
      let should = true
      if (rateCheck) {
        // periodically calculate update rate based on distance to camera
        rateCheckedAt += delta
        if (rateCheckedAt >= DIST_CHECK_RATE) {
          const vrmPos = v1.setFromMatrixPosition(vrm.scene.matrix)
          const camPos = v2.setFromMatrixPosition((hooks.camera as THREE.Camera).matrixWorld) // prettier-ignore
          const distance = vrmPos.distanceTo(camPos)
          const clampedDistance = Math.max(distance - DIST_MIN, 0)
          const normalizedDistance = Math.min(clampedDistance / (DIST_MAX - DIST_MIN), 1) // prettier-ignore
          rate = DIST_MAX_RATE + normalizedDistance * (DIST_MIN_RATE - DIST_MAX_RATE) // prettier-ignore
          rateCheckedAt = 0
        }
        should = elapsed >= rate
      }
      
      if (should) {
        // HYBRID APPROACH - Asset Forge animation pipeline:

        // Step 1: Update AnimationMixer (animates normalized bones)
        if (mixer) {
          mixer.update(elapsed)
        }

        // Step 2: CRITICAL - Propagate normalized bone transforms to raw bones
        // This is where the VRM library's automatic A-pose handling happens
        // Without this, normalized bone changes never reach the visible skeleton
        if (_tvrm?.humanoid?.update) {
          _tvrm.humanoid.update(elapsed)
        }

        // Step 3: Update skeleton matrices for skinning
        skeleton.bones.forEach(bone => bone.updateMatrixWorld())
        skeleton.update()

        elapsed = 0
      }
    }
    // world.updater.add(update)
    interface EmoteData {
      url: string
      loading: boolean
      action: THREE.AnimationAction | null
    }
    
    const emotes: { [url: string]: EmoteData } = {
      // [url]: {
      //   url: String
      //   loading: Boolean
      //   action: AnimationAction
      // }
    }
    let currentEmote: EmoteData | null
    let setEmoteCallCount = 0
    const setEmote = url => {
      setEmoteCallCount++
      console.log('[VRMFactory.setEmote] Called:', { url, callCount: setEmoteCallCount })

      if (currentEmote?.url === url) {
        console.log('[VRMFactory.setEmote] Already playing this emote, skipping')
        return
      }
      if (currentEmote) {
        currentEmote.action?.fadeOut(0.15)
        currentEmote = null
      }
      if (!url) {
        console.log('[VRMFactory.setEmote] No URL provided, returning')
        return
      }
      const opts = getQueryParams(url)
      const loop = opts.l !== '0'
      const speed = parseFloat(opts.s || '1')

      console.log('[VRMFactory.setEmote] Checking if emote exists in cache:', { url, exists: !!emotes[url] })
      if (emotes[url]) {
        console.log('[VRMFactory.setEmote] Emote found in cache, playing')
        currentEmote = emotes[url]
        if (currentEmote.action) {
          currentEmote.action.clampWhenFinished = !loop
          currentEmote.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
          currentEmote.action.reset().fadeIn(0.15).play()
          console.log('[VRMFactory.setEmote] Animation action playing')
        } else {
          console.log('[VRMFactory.setEmote] Emote in cache but no action yet (still loading)')
        }
      } else {
        console.log('[VRMFactory.setEmote] Emote not in cache, loading...', { hasLoader: !!hooks.loader })
        const newEmote: EmoteData = {
          url,
          loading: true,
          action: null,
        }
        emotes[url] = newEmote
        currentEmote = newEmote
        console.log('[VRMFactory.setEmote] Calling hooks.loader.load for emote:', url)
        type LoaderType = { load: (type: string, url: string) => Promise<{ toClip: (opts: unknown) => THREE.AnimationClip }> };
        (hooks.loader as LoaderType).load('emote', url).then(emo => {
          console.log('[VRMFactory.setEmote] Emote loaded successfully:', url)
          const clip = emo.toClip({
            rootToHips,
            version,
            getBoneName,
          })
          const action = mixer.clipAction(clip)
          action.timeScale = speed
          newEmote.action = action
          newEmote.loading = false
          // if its still this emote, play it!
          if (currentEmote === newEmote) {
            action.clampWhenFinished = !loop
            action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
            action.play()
          }
        }).catch(err => {
          console.error(`[VRM] Failed to load emote:`, url, err)
        })
      }
    }


    const bonesByName = {}
    const findBone = name => {
      // name is the official vrm bone name eg 'leftHand'
      // actualName is the actual bone name used in the skeleton which may different across vrms
      if (!bonesByName[name]) {
        let actualName = ''
        if (humanoid) {
          const node = humanoid.getRawBoneNode?.(name)
          actualName = node?.name || ''
        }
        bonesByName[name] = skeleton.getBoneByName(actualName)
      }
      return bonesByName[name]
    }

    let firstPersonActive = false
    const setFirstPerson = active => {
      if (firstPersonActive === active) return
      const head = findBone('neck')
      head.scale.setScalar(active ? 0 : 1)
      firstPersonActive = active
    }

    const m1 = new THREE.Matrix4()
    const getBoneTransform = (boneName: string): THREE.Matrix4 | null => {
      const bone = findBone(boneName)
      if (!bone) return null
      // combine the scene's world matrix with the bone's world matrix
      return m1.multiplyMatrices(vrm.scene.matrixWorld, bone.matrixWorld)
    }

    // Create a wrapped update function with logging
    const wrappedUpdate = (delta: number) => {
      update(delta);
    };
    
    return {
      raw: vrm,
      height,
      headToHeight,
      setEmote,
      setFirstPerson,
      update: wrappedUpdate,
      getBoneTransform,
      move(_matrix: THREE.Matrix4) {
        matrix.copy(_matrix)
        // CRITICAL: Also update the VRM scene's transform to follow the player
        // Apply 180-degree Y-axis rotation only for VRM 1.0+ models
        let finalMatrix = _matrix
        if (isVRM1OrHigher) {
          const rotationMatrix = new THREE.Matrix4().makeRotationY(Math.PI)
          finalMatrix = new THREE.Matrix4().multiplyMatrices(_matrix, rotationMatrix)
        }
        vrm.scene.matrix.copy(finalMatrix)
        vrm.scene.matrixWorld.copy(finalMatrix)
        vrm.scene.updateMatrixWorld(true) // Force update all children
        if (hooks?.octree && hooks.octree.move) {
          hooks.octree.move(sItem)
        }
      },
      disableRateCheck() {
        rateCheck = false
      },
      destroy() {
        if (hooks?.scene) {
          hooks.scene.remove(vrm.scene)
        }
        // world.updater.remove(update)
        if (hooks?.octree && hooks.octree.remove) {
          hooks.octree.remove(sItem)
        }
      },
    }
  }
}

/**
 * Clone GLB data for multiple instances (HYBRID APPROACH)
 *
 * Uses SkeletonUtils.clone() for efficient cloning:
 * - Shares geometries and textures (memory efficient)
 * - Duplicates skeleton (independent animations)
 * - CLONES VRM humanoid and remaps bone references (for vrm.humanoid.update())
 *
 * This hybrid approach combines:
 * - Asset Forge: normalized bones + vrm.humanoid.update()
 * - Hyperscape: efficient cloning for multiple instances
 */
function cloneGLB(glb: GLBData): GLBData {
  // Deep clone the scene (including skeleton and skinned meshes)
  const clonedScene = SkeletonUtils.clone(glb.scene) as THREE.Scene

  const originalVRM = glb.userData?.vrm

  // If no VRM or no humanoid, just return cloned scene
  if (!originalVRM?.humanoid?.clone) {
    return { ...glb, scene: clonedScene }
  }

  // Clone the VRM humanoid
  const clonedHumanoid = originalVRM.humanoid.clone()

  // CRITICAL: Remap humanoid bone references to cloned scene
  remapHumanoidBonesToClonedScene(clonedHumanoid, clonedScene)

  // Create cloned VRM with remapped humanoid
  const clonedVRM = {
    ...originalVRM,
    scene: clonedScene,
    humanoid: clonedHumanoid
  }

  return {
    ...glb,
    scene: clonedScene,
    userData: { vrm: clonedVRM }
  }
}

/**
 * Remap VRM humanoid bone references to cloned scene
 *
 * After SkeletonUtils.clone(), bones are cloned but VRM humanoid still references
 * original bones. This function updates the humanoid's internal bone references
 * to point to the cloned bones instead.
 */
function remapHumanoidBonesToClonedScene(
  humanoid: any,
  clonedScene: THREE.Scene
): void {
  // Build map of cloned bones by name
  const clonedBonesByName = new Map<string, THREE.Bone>()
  const clonedObjectsByName = new Map<string, THREE.Object3D>()

  clonedScene.traverse(obj => {
    if (obj instanceof THREE.Bone) {
      clonedBonesByName.set(obj.name, obj)
    }
    // Also track all objects for normalized bones
    if (obj.name) {
      clonedObjectsByName.set(obj.name, obj)
    }
  })

  // Remap raw human bones (actual skeleton bones)
  const rawBones = humanoid._rawHumanBones
  if (rawBones?.humanBones) {
    Object.values(rawBones.humanBones).forEach((boneData: any) => {
      if (boneData?.node) {
        const boneName = boneData.node.name
        const clonedBone = clonedBonesByName.get(boneName)
        if (clonedBone) {
          boneData.node = clonedBone
        } else {
          console.warn('[remapHumanoid] Raw bone not found in cloned scene:', boneName)
        }
      }
    })
  }

  // Remap normalized human bones (VRMHumanoidRig nodes)
  const normBones = humanoid._normalizedHumanBones
  if (normBones?.humanBones) {
    Object.values(normBones.humanBones).forEach((boneData: any) => {
      if (boneData?.node) {
        const nodeName = boneData.node.name
        const clonedNode = clonedObjectsByName.get(nodeName)
        if (clonedNode) {
          boneData.node = clonedNode
        } else {
          console.warn('[remapHumanoid] Normalized bone not found in cloned scene:', nodeName)
        }
      }
    })
  }

  console.log('[remapHumanoid] Remapped humanoid bones to cloned scene')
}

function getSkinnedMeshes(scene: THREE.Scene): THREE.SkinnedMesh[] {
  const meshes: THREE.SkinnedMesh[] = []
  scene.traverse(o => {
    if (o instanceof THREE.SkinnedMesh) {
      meshes.push(o)
    }
  })
  return meshes
}

function createCapsule(radius: number, height: number): THREE.BufferGeometry {
  const fullHeight = radius + height + radius
  const geometry = new THREE.CapsuleGeometry(radius, height)
  geometry.translate(0, fullHeight / 2, 0)
  return geometry
}

const queryParams = {}
function getQueryParams(url: string): Record<string, string> {
  if (!queryParams[url]) {
    const urlObj = new URL(url)
    const params = {}
    for (const [key, value] of urlObj.searchParams.entries()) {
      params[key] = value
    }
    queryParams[url] = params
  }
  return queryParams[url]
}
