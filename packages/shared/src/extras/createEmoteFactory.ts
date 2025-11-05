/**
 * createEmoteFactory.ts - Animation Retargeting Factory
 * 
 * Retargets Mixamo animations to VRM skeletons for character animation.
 * Handles bone name mapping, scaling, and orientation differences.
 * 
 * **Animation Pipeline:**
 * 1. Load Mixamo animation GLB
 * 2. Extract animation clips
 * 3. Filter to only root position and rotations
 * 4. Map Mixamo bone names → VRM bone names
 * 5. Scale animation to match VRM height
 * 6. Generate retargeted AnimationClip
 * 
 * **Why Retargeting?**
 * - Mixamo animations use different skeleton structure than VRM
 * - Bone names differ (e.g., 'mixamorigHips' → 'hips')
 * - Mixamo uses different coordinate space
 * - VRMs have varying heights/proportions
 * 
 * **Height Adaptation:**
 * - Calculates rootToHips distance from VRM
 * - Scales animation by this ratio
 * - Ensures feet stay on ground
 * - Works with any VRM body proportions
 * 
 * **Bone Name Mapping:**
 * Maps ~67 Mixamo bones to VRM standard bones:
 * - Hips, Spine, Chest, Neck, Head
 * - Left/Right Arms, Hands, Fingers
 * - Left/Right Legs, Feet, Toes
 * 
 * **Referenced by:** ClientLoader (loads emote animations)
 */

import THREE from './three'
import type { GLBData } from '../types'

const q1 = new THREE.Quaternion()
const restRotationInverse = new THREE.Quaternion()
const parentRestWorldRotation = new THREE.Quaternion()

/**
 * Create Animation Retargeting Factory
 * 
 * Processes a Mixamo animation GLB and returns a factory for retargeting to VRM skeletons.
 * 
 * @param glb - Loaded animation GLB data
 * @param _url - Animation URL (unused but kept for debugging)
 * @returns Factory object with toClip() method
 */
/**
 * HYBRID APPROACH: Normalized Bones for Automatic A-pose Handling
 *
 * Previously, we manually compensated for A-pose vs T-pose differences with offsets.
 * Now, we use the VRM library's normalized bone system which handles this automatically.
 *
 * How it works:
 * 1. Animation targets normalized bones (Normalized_Hips, etc.)
 * 2. vrm.humanoid.update() propagates normalized → raw bones with inverse bind transforms
 * 3. Works for any VRM bind pose (A-pose, T-pose, etc.) automatically
 *
 * No manual compensation needed!
 */

export function createEmoteFactory(glb: GLBData, _url: string) {
  // console.time('emote-init')

  if (!glb.animations || glb.animations.length === 0) {
    throw new Error('[createEmoteFactory] GLB has no animations');
  }

  const clip = glb.animations[0]

  const scale = (glb.scene as THREE.Scene).children[0].scale.x // armature should be here?

  // no matter what vrm/emote combo we use for some reason avatars
  // levitate roughly 5cm above ground. this is a hack but it works.
  const yOffset = -0.05 / scale

  // we only keep tracks that are:
  // 1. the root position
  // 2. the quaternions
  // scale and other positions are rejected.
  // NOTE: there is a risk that the first position track is not the root but
  // i haven't been able to find one so far.
  let _haveRoot

  clip.tracks = clip.tracks.filter(track => {
    if (track instanceof THREE.VectorKeyframeTrack) {
      const [name, type] = track.name.split('.')
      if (type !== 'position') return
      // we need both root and hip bones
      if (name === 'Root') {
        _haveRoot = true
        return true
      }
      if (name === 'mixamorigHips') {
        return true
      }
      return false
    }
    return true
  })

  // if (!haveRoot) console.warn(`emote missing root bone: ${url}`)

  // fix new mixamo update normalized bones
  // see: https://github.com/pixiv/three-vrm/pull/1032/files
  clip.tracks.forEach(track => {
    const trackSplitted = track.name.split('.')
    const mixamoRigName = trackSplitted[0]
    const mixamoRigNode = glb.scene.getObjectByName(mixamoRigName)
    if (!mixamoRigNode || !mixamoRigNode.parent) {
      console.warn(`Mixamo rig node not found: ${mixamoRigName}`)
      return
    }
    mixamoRigNode.getWorldQuaternion(restRotationInverse).invert()
    mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation)
    if (track instanceof THREE.QuaternionKeyframeTrack) {
      // Retarget rotation of mixamoRig to NormalizedBone.
      for (let i = 0; i < track.values.length; i += 4) {
        const flatQuaternion = track.values.slice(i, i + 4)
        q1.fromArray(flatQuaternion)
        // 親のレスト時ワールド回転 * トラックの回転 * レスト時ワールド回転の逆
        q1.premultiply(parentRestWorldRotation).multiply(restRotationInverse)
        q1.toArray(flatQuaternion)
        flatQuaternion.forEach((v, index) => {
          track.values[index + i] = v
        })
      }
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      if (yOffset) {
        track.values = track.values.map((v, i) => {
          // if this is Y then offset it
          if (i % 3 === 1) {
            return v + yOffset
          }
          return v
        })
      }
    }
  })

  clip.optimize()

  // console.timeEnd('emote-init')

  type EmoteRetargetOptions = {
    rootToHips?: number
    version?: string
    getBoneName?: (name: string) => string
  }

  return {
    toClip(options: EmoteRetargetOptions = {}) {
      const { rootToHips = 1, version = '1', getBoneName = (name: string) => name } = options
      // we're going to resize animation to match vrm height
      const height = rootToHips

      const tracks: THREE.KeyframeTrack[] = []

      // Temp quaternions for A-pose compensation
      const animQuat = new THREE.Quaternion()
      const offsetQuat = new THREE.Quaternion()
      const resultQuat = new THREE.Quaternion()

      clip.tracks.forEach(track => {
        const trackSplitted = track.name.split('.')
        const ogBoneName = trackSplitted[0]
        const vrmBoneName = normalizedBoneNames[ogBoneName]
        // TODO: use vrm.bones[name] not getBoneNode
        const vrmNodeName = getBoneName(vrmBoneName)

        // Debug: Log bone name mapping
        console.log('[AnimationRetargeting] Track:', { ogBoneName, vrmBoneName, vrmNodeName })

        // animations come from mixamo X Bot character
        // and we scale based on height of our VRM.
        // usually this would 0.01 if our VRM was for example the X Bot
        // but since we're applying this to any arbitrary sized VRM we
        // need to scale it by height too.
        // i found that feet-to-hips height scales animations almost perfectly
        // and ensures feet stay on the ground
        const scaler = height * scale

        if (vrmNodeName !== undefined) {
          const propertyName = trackSplitted[1]

          if (track instanceof THREE.QuaternionKeyframeTrack) {
            let values = track.values

            // Apply VRM 0.0 coordinate transformation
            if (version === '0') {
              values = values.map((v, i) => (i % 2 === 0 ? -v : v))
            }

            // No A-pose compensation needed - normalized bones handle this automatically!
            // The VRM library's vrm.humanoid.update() applies the correct inverse bind transforms

            tracks.push(
              new THREE.QuaternionKeyframeTrack(
                `${vrmNodeName}.${propertyName}`,
                track.times,
                values
              )
            )
          } else if (track instanceof THREE.VectorKeyframeTrack) {
            // Debug: Log position values
            if (ogBoneName === 'Root' || ogBoneName === 'mixamorigHips') {
              const first9 = track.values.slice(0, 9)
              console.log('[AnimationRetargeting] Position track:', ogBoneName, vrmNodeName)
              console.log('  First 3 keyframes (x,y,z):',
                `[${first9[0]}, ${first9[1]}, ${first9[2]}]`,
                `[${first9[3]}, ${first9[4]}, ${first9[5]}]`,
                `[${first9[6]}, ${first9[7]}, ${first9[8]}]`
              )
            }

            tracks.push(
              new THREE.VectorKeyframeTrack(
                `${vrmNodeName}.${propertyName}`,
                track.times,
                track.values.map((v, i) => {
                  // Scale position values - model orientation is handled by Y-axis rotation in createVRMFactory
                  return v * scaler
                })
              )
            )
          }
        }
      })

      return new THREE.AnimationClip(
        clip.name, // todo: name variable?
        clip.duration,
        tracks
      )
    },
  }
}

const normalizedBoneNames = {
  // vrm standard
  hips: 'hips',
  spine: 'spine',
  chest: 'chest',
  upperChest: 'upperChest',
  neck: 'neck',
  head: 'head',
  leftShoulder: 'leftShoulder',
  leftUpperArm: 'leftUpperArm',
  leftLowerArm: 'leftLowerArm',
  leftHand: 'leftHand',
  leftThumbProximal: 'leftThumbProximal',
  leftThumbIntermediate: 'leftThumbIntermediate',
  leftThumbDistal: 'leftThumbDistal',
  leftIndexProximal: 'leftIndexProximal',
  leftIndexIntermediate: 'leftIndexIntermediate',
  leftIndexDistal: 'leftIndexDistal',
  leftMiddleProximal: 'leftMiddleProximal',
  leftMiddleIntermediate: 'leftMiddleIntermediate',
  leftMiddleDistal: 'leftMiddleDistal',
  leftRingProximal: 'leftRingProximal',
  leftRingIntermediate: 'leftRingIntermediate',
  leftRingDistal: 'leftRingDistal',
  leftLittleProximal: 'leftLittleProximal',
  leftLittleIntermediate: 'leftLittleIntermediate',
  leftLittleDistal: 'leftLittleDistal',
  rightShoulder: 'rightShoulder',
  rightUpperArm: 'rightUpperArm',
  rightLowerArm: 'rightLowerArm',
  rightHand: 'rightHand',
  rightLittleProximal: 'rightLittleProximal',
  rightLittleIntermediate: 'rightLittleIntermediate',
  rightLittleDistal: 'rightLittleDistal',
  rightRingProximal: 'rightRingProximal',
  rightRingIntermediate: 'rightRingIntermediate',
  rightRingDistal: 'rightRingDistal',
  rightMiddleProximal: 'rightMiddleProximal',
  rightMiddleIntermediate: 'rightMiddleIntermediate',
  rightMiddleDistal: 'rightMiddleDistal',
  rightIndexProximal: 'rightIndexProximal',
  rightIndexIntermediate: 'rightIndexIntermediate',
  rightIndexDistal: 'rightIndexDistal',
  rightThumbProximal: 'rightThumbProximal',
  rightThumbIntermediate: 'rightThumbIntermediate',
  rightThumbDistal: 'rightThumbDistal',
  leftUpperLeg: 'leftUpperLeg',
  leftLowerLeg: 'leftLowerLeg',
  leftFoot: 'leftFoot',
  leftToes: 'leftToes',
  rightUpperLeg: 'rightUpperLeg',
  rightLowerLeg: 'rightLowerLeg',
  rightFoot: 'rightFoot',
  rightToes: 'rightToes',
  // vrm uploaded to mixamo
  // these are latest mixamo bone names
  Hips: 'hips',
  Spine: 'spine',
  Spine1: 'chest',
  Spine2: 'upperChest',
  Neck: 'neck',
  Head: 'head',
  LeftShoulder: 'leftShoulder',
  LeftArm: 'leftUpperArm',
  LeftForeArm: 'leftLowerArm',
  LeftHand: 'leftHand',
  LeftHandThumb1: 'leftThumbProximal',
  LeftHandThumb2: 'leftThumbIntermediate',
  LeftHandThumb3: 'leftThumbDistal',
  LeftHandIndex1: 'leftIndexProximal',
  LeftHandIndex2: 'leftIndexIntermediate',
  LeftHandIndex3: 'leftIndexDistal',
  LeftHandMiddle1: 'leftMiddleProximal',
  LeftHandMiddle2: 'leftMiddleIntermediate',
  LeftHandMiddle3: 'leftMiddleDistal',
  LeftHandRing1: 'leftRingProximal',
  LeftHandRing2: 'leftRingIntermediate',
  LeftHandRing3: 'leftRingDistal',
  LeftHandPinky1: 'leftLittleProximal',
  LeftHandPinky2: 'leftLittleIntermediate',
  LeftHandPinky3: 'leftLittleDistal',
  RightShoulder: 'rightShoulder',
  RightArm: 'rightUpperArm',
  RightForeArm: 'rightLowerArm',
  RightHand: 'rightHand',
  RightHandPinky1: 'rightLittleProximal',
  RightHandPinky2: 'rightLittleIntermediate',
  RightHandPinky3: 'rightLittleDistal',
  RightHandRing1: 'rightRingProximal',
  RightHandRing2: 'rightRingIntermediate',
  RightHandRing3: 'rightRingDistal',
  RightHandMiddle1: 'rightMiddleProximal',
  RightHandMiddle2: 'rightMiddleIntermediate',
  RightHandMiddle3: 'rightMiddleDistal',
  RightHandIndex1: 'rightIndexProximal',
  RightHandIndex2: 'rightIndexIntermediate',
  RightHandIndex3: 'rightIndexDistal',
  RightHandThumb1: 'rightThumbProximal',
  RightHandThumb2: 'rightThumbIntermediate',
  RightHandThumb3: 'rightThumbDistal',
  LeftUpLeg: 'leftUpperLeg',
  LeftLeg: 'leftLowerLeg',
  LeftFoot: 'leftFoot',
  LeftToeBase: 'leftToes',
  RightUpLeg: 'rightUpperLeg',
  RightLeg: 'rightLowerLeg',
  RightFoot: 'rightFoot',
  RightToeBase: 'rightToes',
  // these must be old mixamo names, prefixed with "mixamo"
  mixamorigHips: 'hips',
  mixamorigSpine: 'spine',
  mixamorigSpine1: 'chest',
  mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck',
  mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder',
  mixamorigLeftArm: 'leftUpperArm',
  mixamorigLeftForeArm: 'leftLowerArm',
  mixamorigLeftHand: 'leftHand',
  mixamorigLeftHandThumb1: 'leftThumbProximal',
  mixamorigLeftHandThumb2: 'leftThumbIntermediate',
  mixamorigLeftHandThumb3: 'leftThumbDistal',
  mixamorigLeftHandIndex1: 'leftIndexProximal',
  mixamorigLeftHandIndex2: 'leftIndexIntermediate',
  mixamorigLeftHandIndex3: 'leftIndexDistal',
  mixamorigLeftHandMiddle1: 'leftMiddleProximal',
  mixamorigLeftHandMiddle2: 'leftMiddleIntermediate',
  mixamorigLeftHandMiddle3: 'leftMiddleDistal',
  mixamorigLeftHandRing1: 'leftRingProximal',
  mixamorigLeftHandRing2: 'leftRingIntermediate',
  mixamorigLeftHandRing3: 'leftRingDistal',
  mixamorigLeftHandPinky1: 'leftLittleProximal',
  mixamorigLeftHandPinky2: 'leftLittleIntermediate',
  mixamorigLeftHandPinky3: 'leftLittleDistal',
  mixamorigRightShoulder: 'rightShoulder',
  mixamorigRightArm: 'rightUpperArm',
  mixamorigRightForeArm: 'rightLowerArm',
  mixamorigRightHand: 'rightHand',
  mixamorigRightHandPinky1: 'rightLittleProximal',
  mixamorigRightHandPinky2: 'rightLittleIntermediate',
  mixamorigRightHandPinky3: 'rightLittleDistal',
  mixamorigRightHandRing1: 'rightRingProximal',
  mixamorigRightHandRing2: 'rightRingIntermediate',
  mixamorigRightHandRing3: 'rightRingDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal',
  mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
  mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandIndex1: 'rightIndexProximal',
  mixamorigRightHandIndex2: 'rightIndexIntermediate',
  mixamorigRightHandIndex3: 'rightIndexDistal',
  mixamorigRightHandThumb1: 'rightThumbProximal',
  mixamorigRightHandThumb2: 'rightThumbIntermediate',
  mixamorigRightHandThumb3: 'rightThumbDistal',
  mixamorigLeftUpLeg: 'leftUpperLeg',
  mixamorigLeftLeg: 'leftLowerLeg',
  mixamorigLeftFoot: 'leftFoot',
  mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg',
  mixamorigRightLeg: 'rightLowerLeg',
  mixamorigRightFoot: 'rightFoot',
  mixamorigRightToeBase: 'rightToes',
}
