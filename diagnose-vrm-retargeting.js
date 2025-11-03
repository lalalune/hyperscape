/**
 * diagnose-vrm-retargeting.js - Diagnose VRM retargeting differences
 *
 * Loads both human.vrm (VRM 1.0) and avatar1.vrm (VRM 0.0) and checks:
 * - How @pixiv/three-vrm loads them
 * - What metaVersion is detected
 * - How bone name mapping works
 */

import { readFile } from 'fs/promises'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'

async function diagnoseVRM(filePath, label) {
  console.log('\n' + '='.repeat(80))
  console.log(`${label}: ${filePath}`)
  console.log('='.repeat(80))

  const buffer = await readFile(filePath)
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))

  const arraybuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  const gltf = await loader.parseAsync(arraybuffer, '')

  const vrm = gltf.userData.vrm

  console.log('\n📊 VRM Metadata:')
  console.log('  metaVersion:', vrm.meta?.metaVersion)
  console.log('  specVersion:', vrm.meta?.specVersion)
  console.log('  name:', vrm.meta?.name)

  console.log('\n🦴 Humanoid Bones:')
  const humanoid = vrm.humanoid

  // Test a few key bones
  const testBones = ['hips', 'leftUpperArm', 'rightUpperArm', 'head', 'spine']

  testBones.forEach(boneName => {
    try {
      const node = humanoid.getRawBoneNode(boneName)
      if (node) {
        console.log(`  ${boneName.padEnd(15)} → ${node.name}`)
      } else {
        console.log(`  ${boneName.padEnd(15)} → NOT FOUND`)
      }
    } catch (error) {
      console.log(`  ${boneName.padEnd(15)} → ERROR: ${error.message}`)
    }
  })

  console.log('\n🎬 Testing Animation Retargeting Bone Name Mapping:')

  // Simulate what AnimationRetargeting.ts does
  const normalizedBoneNames = {
    mixamorigHips: 'hips',
    mixamorigSpine: 'spine',
    mixamorigLeftArm: 'leftUpperArm',
    mixamorigRightArm: 'rightUpperArm',
    mixamorigHead: 'head',
  }

  const getBoneName = (vrmBoneName) => {
    const node = humanoid?.getRawBoneNode(vrmBoneName)
    return node?.name
  }

  // Test Mixamo bone name lookups
  const mixamoNames = [
    'mixamorig:Hips',
    'mixamorig:LeftArm',
    'mixamorig:RightArm',
    'mixamorig:Head',
    'mixamorig:Spine',
  ]

  mixamoNames.forEach(mixamoName => {
    // Step 1: Remove colon (current code does this)
    const ogBoneName = mixamoName.replace('mixamorig:', 'mixamorig')

    // Step 2: Look up VRM bone name
    const vrmBoneName = normalizedBoneNames[ogBoneName]

    // Step 3: Get actual node name
    const vrmNodeName = getBoneName(vrmBoneName)

    console.log(`  ${mixamoName.padEnd(22)} → ${ogBoneName.padEnd(18)} → ${(vrmBoneName || 'undefined').padEnd(15)} → ${vrmNodeName || 'NOT FOUND'}`)
  })

  console.log('\n✅ Diagnosis complete for ' + label)
}

async function main() {
  console.log('\n' + '█'.repeat(80))
  console.log('VRM RETARGETING DIAGNOSIS')
  console.log('█'.repeat(80))

  try {
    // Diagnose human.vrm (VRM 1.0, not working)
    await diagnoseVRM('packages/asset-forge/gdd-assets/human/human.vrm', '🔴 NOT WORKING - human.vrm (VRM 1.0)')

    // Diagnose avatar1.vrm (VRM 0.0, working)
    await diagnoseVRM('assets/avatar1.vrm', '🟢 WORKING - avatar1.vrm (VRM 0.0)')
  } catch (error) {
    console.error('Error:', error)
  }

  console.log('\n' + '█'.repeat(80))
  console.log('DIAGNOSIS COMPLETE')
  console.log('█'.repeat(80))
}

main().catch(console.error)
