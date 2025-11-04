/**
 * inspect-vrm.js - Inspect VRM file structure
 *
 * Extracts key information from VRM files to compare bind poses and metadata
 */

import { readFile } from 'fs/promises'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import * as THREE from 'three'

async function inspectVRM(filePath) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`Inspecting: ${filePath}`)
  console.log('='.repeat(80))

  try {
    const data = await readFile(filePath)
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))

    const gltf = await new Promise((resolve, reject) => {
      loader.parse(
        data.buffer,
        '',
        (result) => resolve(result),
        (error) => reject(error)
      )
    })

    const vrm = gltf.userData.vrm

    if (!vrm) {
      console.error('❌ No VRM data found')
      return
    }

    console.log('\n📋 VRM Metadata:')
    console.log(`  Version: ${vrm.meta?.metaVersion || 'unknown'}`)
    console.log(`  Name: ${vrm.meta?.name || 'unknown'}`)
    console.log(`  Author: ${vrm.meta?.authors?.[0] || vrm.meta?.author || 'unknown'}`)

    console.log('\n🦴 Humanoid Bones:')
    const humanoid = vrm.humanoid
    const boneNames = humanoid ? Object.keys(humanoid.humanBones) : []
    console.log(`  Total bones: ${boneNames.length}`)

    // Get Hips bone info
    const hipsNode = humanoid?.getRawBoneNode('hips')
    if (hipsNode) {
      console.log('\n🎯 Hips Bone (Critical for animations):')
      console.log(`  Name: ${hipsNode.name}`)
      console.log(`  Local Position: [${hipsNode.position.x.toFixed(3)}, ${hipsNode.position.y.toFixed(3)}, ${hipsNode.position.z.toFixed(3)}]`)
      console.log(`  Local Rotation: [${hipsNode.quaternion.x.toFixed(3)}, ${hipsNode.quaternion.y.toFixed(3)}, ${hipsNode.quaternion.z.toFixed(3)}, ${hipsNode.quaternion.w.toFixed(3)}]`)
      console.log(`  Local Scale: [${hipsNode.scale.x.toFixed(3)}, ${hipsNode.scale.y.toFixed(3)}, ${hipsNode.scale.z.toFixed(3)}]`)

      // Calculate world position
      const worldPos = new THREE.Vector3()
      hipsNode.getWorldPosition(worldPos)
      console.log(`  World Position: [${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)}]`)

      // Calculate rotation magnitude to check if T-pose
      const q = hipsNode.quaternion
      const rotMag = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z)
      console.log(`  Rotation Magnitude: ${rotMag.toFixed(3)} ${rotMag < 0.1 ? '✅ T-pose' : '⚠️  Non-T-pose'}`)
    }

    // Get arm bones
    console.log('\n💪 Arm Bones:')
    const leftArmNode = humanoid?.getRawBoneNode('leftUpperArm')
    if (leftArmNode) {
      console.log(`  Left Upper Arm:`)
      console.log(`    Name: ${leftArmNode.name}`)
      console.log(`    Rotation: [${leftArmNode.quaternion.x.toFixed(3)}, ${leftArmNode.quaternion.y.toFixed(3)}, ${leftArmNode.quaternion.z.toFixed(3)}, ${leftArmNode.quaternion.w.toFixed(3)}]`)
    }

    const rightArmNode = humanoid?.getRawBoneNode('rightUpperArm')
    if (rightArmNode) {
      console.log(`  Right Upper Arm:`)
      console.log(`    Name: ${rightArmNode.name}`)
      console.log(`    Rotation: [${rightArmNode.quaternion.x.toFixed(3)}, ${rightArmNode.quaternion.y.toFixed(3)}, ${rightArmNode.quaternion.z.toFixed(3)}, ${rightArmNode.quaternion.w.toFixed(3)}]`)
    }

    // Check for Armature parent
    console.log('\n🏗️  Scene Hierarchy:')
    let currentNode = hipsNode
    let depth = 0
    while (currentNode && depth < 5) {
      console.log(`${'  '.repeat(depth)}${currentNode.name || 'unnamed'} (${currentNode.type})`)
      if (currentNode.scale.x !== 1 || currentNode.scale.y !== 1 || currentNode.scale.z !== 1) {
        console.log(`${'  '.repeat(depth)}  ⚠️  Scale: [${currentNode.scale.x}, ${currentNode.scale.y}, ${currentNode.scale.z}]`)
      }
      currentNode = currentNode.parent
      depth++
    }

    // Find skinned mesh
    let skinnedMesh = null
    vrm.scene.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh && !skinnedMesh) {
        skinnedMesh = obj
      }
    })

    if (skinnedMesh) {
      console.log('\n🎨 Skinned Mesh:')
      console.log(`  Name: ${skinnedMesh.name}`)
      console.log(`  Bones: ${skinnedMesh.skeleton?.bones.length || 0}`)
      console.log(`  Bind Mode: ${skinnedMesh.bindMode === THREE.AttachedBindMode ? 'AttachedBindMode' : skinnedMesh.bindMode === THREE.DetachedBindMode ? 'DetachedBindMode' : 'Unknown'}`)
    }

  } catch (error) {
    console.error('❌ Error inspecting VRM:', error.message)
  }
}

// Run inspection on both files
const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('Usage: node inspect-vrm.js <vrm-file-path> [<another-vrm-file>]')
  process.exit(1)
}

for (const filePath of args) {
  await inspectVRM(filePath)
}
