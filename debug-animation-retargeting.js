/**
 * debug-animation-retargeting.js - Visual debugging for animation retargeting
 *
 * This script:
 * 1. Loads the VRM and animation
 * 2. Extracts bind pose quaternions
 * 3. Applies compensation
 * 4. Compares with what online viewers do
 */

import { readFile } from 'fs/promises'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'

// Polyfill for Node.js
global.self = global

// Polyfill for ProgressEvent
class ProgressEvent extends Event {
  constructor(type, options = {}) {
    super(type)
    this.lengthComputable = options.lengthComputable || false
    this.loaded = options.loaded || 0
    this.total = options.total || 0
  }
}
global.ProgressEvent = ProgressEvent

async function debugRetargeting() {
  console.log('\n' + '█'.repeat(80))
  console.log('VRM ANIMATION RETARGETING DEBUG')
  console.log('█'.repeat(80))

  // Load VRM
  console.log('\n📦 Loading VRM: packages/asset-forge/gdd-assets/human/human.vrm')
  const vrmBuffer = await readFile('packages/asset-forge/gdd-assets/human/human.vrm')
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))

  const vrmArrayBuffer = vrmBuffer.buffer.slice(vrmBuffer.byteOffset, vrmBuffer.byteOffset + vrmBuffer.byteLength)
  const gltf = await loader.parseAsync(vrmArrayBuffer, '')
  const vrm = gltf.userData.vrm

  console.log('✅ VRM loaded')
  console.log('  metaVersion:', vrm.meta?.metaVersion)
  console.log('  Bones:', vrm.humanoid ? Object.keys(vrm.humanoid).length : 'N/A')

  // Find skeleton
  let skeleton = null
  vrm.scene.traverse((obj) => {
    if (obj instanceof THREE.SkinnedMesh && obj.skeleton && !skeleton) {
      skeleton = obj.skeleton
    }
  })

  if (!skeleton) {
    console.error('❌ No skeleton found!')
    return
  }

  console.log('✅ Skeleton found with', skeleton.bones.length, 'bones')

  // Extract bind pose from inverse bind matrices
  console.log('\n🦴 Extracting bind pose quaternions from inverse bind matrices:')
  const bindPoseQuats = new Map()
  const tempMatrix = new THREE.Matrix4()
  const tempQuat = new THREE.Quaternion()
  const tempPos = new THREE.Vector3()
  const tempScale = new THREE.Vector3()

  skeleton.bones.forEach((bone, index) => {
    if (index < skeleton.boneInverses.length) {
      // Invert the inverse bind matrix to get bind pose matrix
      tempMatrix.copy(skeleton.boneInverses[index]).invert()
      tempMatrix.decompose(tempPos, tempQuat, tempScale)
      bindPoseQuats.set(bone.name, {
        quat: tempQuat.clone(),
        pos: tempPos.clone()
      })

      if (bone.name === 'Hips' || bone.name.includes('Arm')) {
        const angle = 2 * Math.acos(Math.abs(tempQuat.w))
        console.log(`  ${bone.name.padEnd(15)} quat: [${tempQuat.x.toFixed(3)}, ${tempQuat.y.toFixed(3)}, ${tempQuat.z.toFixed(3)}, ${tempQuat.w.toFixed(3)}] angle: ${(angle * 180 / Math.PI).toFixed(1)}°`)
      }
    }
  })

  // Load animation
  console.log('\n🎬 Loading animation: public/emotes/emote-idle.glb')
  const animBuffer = await readFile('public/emotes/emote-idle.glb')
  const animArrayBuffer = animBuffer.buffer.slice(animBuffer.byteOffset, animBuffer.byteOffset + animBuffer.byteLength)
  const animGltf = await loader.parseAsync(animArrayBuffer, '')

  if (!animGltf.animations || animGltf.animations.length === 0) {
    console.error('❌ No animations found!')
    return
  }

  const clip = animGltf.animations[0]
  console.log('✅ Animation loaded:', clip.name)
  console.log('  Duration:', clip.duration, 'seconds')
  console.log('  Tracks:', clip.tracks.length)

  // Find Hips quaternion track
  const hipsQuatTrack = clip.tracks.find(t =>
    t.name === 'mixamorigHips.quaternion' && t instanceof THREE.QuaternionKeyframeTrack
  )

  if (!hipsQuatTrack) {
    console.error('❌ No Hips quaternion track found!')
    return
  }

  console.log('\n📊 Hips animation quaternions (first 3 keyframes):')
  for (let i = 0; i < Math.min(3, hipsQuatTrack.times.length); i++) {
    const offset = i * 4
    const quat = hipsQuatTrack.values.slice(offset, offset + 4)
    console.log(`  Frame ${i} (t=${hipsQuatTrack.times[i].toFixed(2)}s): [${quat.map(v => v.toFixed(3)).join(', ')}]`)
  }

  // Apply compensation
  console.log('\n🔧 Applying A-pose compensation:')
  const hipsBindPose = bindPoseQuats.get('Hips')
  if (!hipsBindPose) {
    console.error('❌ No Hips bind pose found!')
    return
  }

  console.log(`  Hips bind pose quat: [${hipsBindPose.quat.x.toFixed(3)}, ${hipsBindPose.quat.y.toFixed(3)}, ${hipsBindPose.quat.z.toFixed(3)}, ${hipsBindPose.quat.w.toFixed(3)}]`)

  const bindInv = hipsBindPose.quat.clone().invert()
  console.log(`  Hips bind inverse:   [${bindInv.x.toFixed(3)}, ${bindInv.y.toFixed(3)}, ${bindInv.z.toFixed(3)}, ${bindInv.w.toFixed(3)}]`)

  console.log('\n📊 Compensated quaternions:')
  const animQuat = new THREE.Quaternion()
  const compensated = new THREE.Quaternion()

  for (let i = 0; i < Math.min(3, hipsQuatTrack.times.length); i++) {
    const offset = i * 4
    animQuat.fromArray(hipsQuatTrack.values, offset)

    // Apply: compensated = bindInv * anim
    compensated.multiplyQuaternions(bindInv, animQuat)

    console.log(`  Frame ${i}:`)
    console.log(`    Original:    [${animQuat.x.toFixed(3)}, ${animQuat.y.toFixed(3)}, ${animQuat.z.toFixed(3)}, ${animQuat.w.toFixed(3)}]`)
    console.log(`    Compensated: [${compensated.x.toFixed(3)}, ${compensated.y.toFixed(3)}, ${compensated.z.toFixed(3)}, ${compensated.w.toFixed(3)}]`)

    // Check magnitude
    const compAngle = 2 * Math.acos(Math.abs(compensated.w))
    console.log(`    Rotation angle: ${(compAngle * 180 / Math.PI).toFixed(1)}°`)
  }

  // Compare with what the bone's current rotation is
  const hipsBone = skeleton.bones.find(b => b.name === 'Hips')
  if (hipsBone) {
    console.log('\n🔍 Current Hips bone rotation in scene:')
    console.log(`  quaternion: [${hipsBone.quaternion.x.toFixed(3)}, ${hipsBone.quaternion.y.toFixed(3)}, ${hipsBone.quaternion.z.toFixed(3)}, ${hipsBone.quaternion.w.toFixed(3)}]`)

    const angle = 2 * Math.acos(Math.abs(hipsBone.quaternion.w))
    console.log(`  Rotation angle: ${(angle * 180 / Math.PI).toFixed(1)}°`)
  }

  console.log('\n' + '█'.repeat(80))
  console.log('DEBUG COMPLETE')
  console.log('█'.repeat(80))
}

debugRetargeting().catch(console.error)
