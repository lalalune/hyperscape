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
  // we'll update matrix ourselves
  glb.scene.matrixAutoUpdate = false
  glb.scene.matrixWorldAutoUpdate = false
  // remove expressions from scene
  const expressions = glb.scene.children.filter(n => n.type === 'VRMExpression') // prettier-ignore
  for (const node of expressions) node.removeFromParent()
  // remove VRMHumanoidRig
  const vrmHumanoidRigs = glb.scene.children.filter(n => n.name === 'VRMHumanoidRig') // prettier-ignore
  for (const node of vrmHumanoidRigs) node.removeFromParent()
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
  // calculate root to hips
  const humanoid = glb.userData?.vrm?.humanoid;
  const bones = humanoid?._rawHumanBones?.humanBones || {};
  const hipsPosition = v1.setFromMatrixPosition(bones.hips?.node?.matrixWorld || new THREE.Matrix4())
  const rootPosition = v2.set(0, 0, 0) //setFromMatrixPosition(bones.root.node.matrixWorld)
  const rootToHips = hipsPosition.y - rootPosition.y
  // get vrm version
  const vrmData = glb.userData?.vrm;
  const version = vrmData?.meta?.metaVersion
  // convert skinned mesh to detached bind mode
  // this lets us remove root bone from scene and then only perform matrix updates on the whole skeleton
  // when we actually need to  for massive performance
  const skinnedMeshes: THREE.SkinnedMesh[] = []
  glb.scene.traverse(node => {
    if (node instanceof THREE.SkinnedMesh) {
      const skinnedMesh = node;
      skinnedMesh.bindMode = THREE.DetachedBindMode
      skinnedMesh.bindMatrix.copy(skinnedMesh.matrixWorld)
      skinnedMesh.bindMatrixInverse.copy(skinnedMesh.bindMatrix).invert()
      // CRITICAL: Must recalculate inverse matrices after changing bindMode
      if (skinnedMesh.skeleton) {
        skinnedMesh.skeleton.calculateInverses();
      }
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
  // remove root bone from scene
  // const rootBone = glb.scene.getObjectByName('RootBone')
  // rootBone.parent.remove(rootBone)
  // rootBone.updateMatrixWorld(true)

  const skeleton = skinnedMeshes[0].skeleton // should be same across all skinnedMeshes

  // pose arms down
  const normBones = humanoid?._normalizedHumanBones?.humanBones || {};
  const leftArm = normBones.leftUpperArm?.node
  if (leftArm) {
    leftArm.rotation.z = 75 * DEG2RAD
  }
  const rightArm = normBones.rightUpperArm?.node
  if (rightArm) {
    rightArm.rotation.z = -75 * DEG2RAD
  }
  if (humanoid?.update) {
    humanoid.update(0)
  }
  skeleton.update()

  // get height
  let height = 0.5 // minimum
  for (const mesh of skinnedMeshes) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    height = Math.max(height, mesh.geometry.boundingBox!.max.y)
  }

  // this.headToEyes = this.eyePosition.clone().sub(headPos)
  const headPos = normBones.head?.node?.getWorldPosition(v1) || v1.set(0,0,0)
  const headToHeight = height - headPos.y

  const getBoneName = (vrmBoneName: string): string | undefined => {
    if (!humanoid) return undefined
    const node = humanoid.getRawBoneNode?.(vrmBoneName)
    return node?.name
  }

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
    
    const vrm = cloneGLB(glb)
    const _tvrm = vrm.userData?.vrm
    const skinnedMeshes = getSkinnedMeshes(vrm.scene as THREE.Scene)
    const skeleton = skinnedMeshes[0].skeleton
    const rootBone = skeleton.bones[0]
    rootBone.parent?.remove(rootBone)
    rootBone.updateMatrixWorld(true)
    vrm.scene.matrix.copy(matrix)
    vrm.scene.matrixWorld.copy(matrix)
    vrm.scene.matrixAutoUpdate = false
    vrm.scene.matrixWorldAutoUpdate = false
    
    // CRITICAL DEBUG: Add skeleton helper to visualize bones
    const skeletonHelper = new THREE.SkeletonHelper(vrm.scene)
    skeletonHelper.visible = true
    
    if (hooks?.scene) {
      hooks.scene.add(vrm.scene)
      hooks.scene.add(skeletonHelper)
      console.log('%c[VRM] 🦴 Added SkeletonHelper to visualize bones', 'background: #00ff00; color: #000', {
        boneCount: skeleton.bones.length,
        helperVisible: skeletonHelper.visible,
        sceneVisible: vrm.scene.visible,
        scenePosition: vrm.scene.position.toArray()
      })
      
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

    // i have no idea how but the mixer only needs one of the skinned meshes
    // and if i set it to vrm.scene it no longer works with detached bind mode
    const mixer = new THREE.AnimationMixer(skinnedMeshes[0])

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
      
      // Debug logging for first 10 calls
      if (updateCallCount <= 10) {
        console.log(`[VRM] Update #${updateCallCount}: delta=${delta.toFixed(4)}, elapsed=${elapsed.toFixed(4)}, rate=${rate.toFixed(4)}, should=${should}, rateCheck=${rateCheck}, mixer=${!!mixer}`)
      }
      
      if (should) {
        if (mixer) {
          mixer.update(elapsed)
          if (updateCallCount <= 10) {
            console.log(`[VRM] Mixer updated with elapsed=${elapsed.toFixed(4)}`)
          }
          // Log mixer stats every 300 frames (~5 seconds at 60fps)
          if (updateCallCount % 300 === 0) {
            const actions = (mixer as { _actions?: THREE.AnimationAction[] })._actions || [];
            const activeActions = actions.filter(a => a.enabled && a.weight > 0);
            console.log(`%c[VRM] Mixer Status at frame ${updateCallCount}:`, 'background: #ff0000; color: #fff', {
              totalActions: actions.length,
              activeActions: activeActions.length,
              activeNames: activeActions.map(a => a.getClip().name),
              weights: activeActions.map(a => a.weight),
              times: activeActions.map(a => a.time.toFixed(2)),
              skeletonVisible: vrm.scene.visible,
              sceneParent: !!vrm.scene.parent
            });
          }
        }
        skeleton.bones.forEach(bone => bone.updateMatrixWorld())
        
        // Update the skeleton after updating bones
        skeleton.update()
        
        skeleton.update = THREE.Skeleton.prototype.update
        // tvrm.humanoid.update(elapsed)
        elapsed = 0
      } else {
        skeleton.update = noop
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
      console.log(`[VRM] setEmote #${setEmoteCallCount} called with url:`, url, 'currentEmote:', currentEmote?.url)
      
      if (currentEmote?.url === url) {
        console.log(`[VRM] Same emote already playing, skipping`)
        return
      }
      if (currentEmote) {
        console.log(`[VRM] Fading out previous emote:`, currentEmote.url)
        currentEmote.action?.fadeOut(0.15)
        currentEmote = null
      }
      if (!url) {
        console.log(`[VRM] No URL provided, clearing emote`)
        return
      }
      const opts = getQueryParams(url)
      const loop = opts.l !== '0'
      const speed = parseFloat(opts.s || '1')

      if (emotes[url]) {
        console.log(`[VRM] Using cached emote:`, url, 'hasAction:', !!emotes[url].action)
        currentEmote = emotes[url]
        if (currentEmote.action) {
          currentEmote.action.clampWhenFinished = !loop
          currentEmote.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
          currentEmote.action.reset().fadeIn(0.15).play()
          console.log(`[VRM] Playing cached animation:`, url, 'mixer actions:', mixer.clipAction)
        } else {
          console.warn(`[VRM] Cached emote has no action:`, url)
        }
      } else {
        console.log(`[VRM] Loading new emote:`, url)
        const newEmote: EmoteData = {
          url,
          loading: true,
          action: null,
        }
        emotes[url] = newEmote
        currentEmote = newEmote
        type LoaderType = { load: (type: string, url: string) => Promise<{ toClip: (opts: unknown) => THREE.AnimationClip }> };
        (hooks.loader as LoaderType).load('emote', url).then(emo => {
          console.log(`[VRM] Emote loaded:`, url)
          const clip = emo.toClip({
            rootToHips,
            version,
            getBoneName,
          })
          console.log(`[VRM] Clip created:`, clip.name, 'duration:', clip.duration, 'tracks:', clip.tracks.length)
          const action = mixer.clipAction(clip)
          action.timeScale = speed
          newEmote.action = action
          newEmote.loading = false
          // if its still this emote, play it!
          if (currentEmote === newEmote) {
            action.clampWhenFinished = !loop
            action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
            action.play()
            console.log(`[VRM] ✅ Animation playing:`, url, 'enabled:', action.enabled, 'weight:', action.weight, 'time:', action.time)
          } else {
            console.log(`[VRM] Emote changed while loading, not playing:`, url)
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
      console.log(`%c[VRM] wrappedUpdate called with delta=${delta.toFixed(4)}`, 'background: #ff00ff; color: #fff');
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
        vrm.scene.matrix.copy(_matrix)
        vrm.scene.matrixWorld.copy(_matrix)
        vrm.scene.updateMatrixWorld(true) // Force update all children
        if (hooks?.octree && hooks.octree.move) {
          hooks.octree.move(sItem)
        }
      },
      disableRateCheck() {
        console.log('[VRM] disableRateCheck() called, setting rateCheck = false');
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

function cloneGLB(glb: GLBData): GLBData {
  // returns a shallow clone of the gltf but a deep clone of the scene.
  // uses SkeletonUtils.clone which is the same as Object3D.clone except also clones skinned meshes etc
  return { ...glb, scene: SkeletonUtils.clone(glb.scene) as THREE.Scene }
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
