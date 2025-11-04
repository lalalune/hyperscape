/**
 * compare-vrm-structure.js - Compare VRM JSON structures
 *
 * Directly parses glTF JSON to compare VRM extensions
 */

import { readFile } from 'fs/promises'

function parseGLB(buffer) {
  const magic = buffer.readUInt32LE(0)
  if (magic !== 0x46546C67) {
    throw new Error('Not a valid GLB file')
  }

  const jsonChunkLength = buffer.readUInt32LE(12)
  const jsonData = buffer.slice(20, 20 + jsonChunkLength).toString('utf8')
  return JSON.parse(jsonData)
}

async function compareVRM(filePath, label) {
  console.log('\n' + '='.repeat(80))
  console.log(`${label}: ${filePath}`)
  console.log('='.repeat(80))

  const buffer = await readFile(filePath)
  const gltf = parseGLB(buffer)

  // Check VRM extensions
  const extensions = gltf.extensions || {}
  const vrm0 = extensions.VRM
  const vrm1 = extensions.VRMC_vrm

  console.log('\n📦 VRM Extensions:')
  console.log('  VRM 0.0 (extensions.VRM):', vrm0 ? 'PRESENT' : 'NOT FOUND')
  console.log('  VRM 1.0 (extensions.VRMC_vrm):', vrm1 ? 'PRESENT' : 'NOT FOUND')

  const vrm = vrm1 || vrm0

  if (vrm) {
    console.log('\n📊 VRM Metadata:')
    console.log('  specVersion:', vrm.specVersion || vrm.exporterVersion || 'N/A')

    if (vrm.meta) {
      console.log('  meta.name:', vrm.meta.name)
      console.log('  meta.version:', vrm.meta.version)
      console.log('  meta.metaVersion:', vrm.meta.metaVersion)
    }

    console.log('\n🦴 Humanoid Bones:')

    let humanBones
    if (vrm1) {
      // VRM 1.0 format - humanBones is an OBJECT in VRM 1.0, not an array
      humanBones = vrm.humanoid?.humanBones || {}
      console.log('  Format: VRM 1.0 (object with {boneName: {node}} entries)')
      console.log(`  Total bones: ${Object.keys(humanBones).length}`)

      // Show a few examples
      Object.entries(humanBones).slice(0, 10).forEach(([boneName, boneData]) => {
        const nodeIndex = typeof boneData === 'object' ? boneData.node : boneData
        const nodeName = gltf.nodes[nodeIndex]?.name || 'unnamed'
        console.log(`    ${boneName.padEnd(20)} → [${nodeIndex}] ${nodeName}`)
      })
    } else {
      // VRM 0.0 format
      humanBones = vrm.humanoid?.humanBones || {}
      console.log('  Format: VRM 0.0 (object with {boneName: {node}} entries)')
      console.log(`  Total bones: ${Object.keys(humanBones).length}`)

      // Show a few examples
      Object.entries(humanBones).slice(0, 10).forEach(([boneName, boneData]) => {
        const nodeIndex = typeof boneData === 'object' ? boneData.node : boneData
        const nodeName = gltf.nodes[nodeIndex]?.name || 'unnamed'
        console.log(`    ${boneName.padEnd(20)} → [${nodeIndex}] ${nodeName}`)
      })
    }

    // Check how @pixiv/three-vrm would interpret metaVersion
    console.log('\n🔍 metaVersion Detection:')
    const detectedMetaVersion = vrm.meta?.metaVersion || (vrm1 ? '1.0' : '0.0')
    console.log(`  vrm.meta?.metaVersion: ${vrm.meta?.metaVersion || 'undefined'}`)
    console.log(`  Default if undefined: ${vrm1 ? '1.0 (has VRMC_vrm)' : '0.0 (has VRM)'}`)
    console.log(`  Final detected version: ${detectedMetaVersion}`)

    console.log('\n⚠️  CRITICAL: AnimationRetargeting.ts uses:')
    console.log('  const version = vrm.meta?.metaVersion || "1.0"')
    console.log(`  So this VRM would be treated as version: ${vrm.meta?.metaVersion || '1.0'}`)

    if (!vrm.meta?.metaVersion && vrm0) {
      console.log('\n❌ BUG DETECTED:')
      console.log('  This is VRM 0.0 but metaVersion is undefined!')
      console.log('  AnimationRetargeting will default to "1.0" and use WRONG transformations!')
      console.log('  This causes broken animations!')
    }
  } else {
    console.log('\n❌ No VRM extension found!')
  }
}

async function main() {
  console.log('\n' + '█'.repeat(80))
  console.log('VRM STRUCTURE COMPARISON')
  console.log('█'.repeat(80))

  try {
    // Compare human.vrm (VRM 1.0, not working)
    await compareVRM('packages/asset-forge/gdd-assets/human/human.vrm', '🔴 NOT WORKING - human.vrm')

    // Compare avatar1.vrm (VRM 0.0, working)
    await compareVRM('assets/avatar1.vrm', '🟢 WORKING - avatar1.vrm')
  } catch (error) {
    console.error('Error:', error)
  }

  console.log('\n' + '█'.repeat(80))
  console.log('COMPARISON COMPLETE')
  console.log('█'.repeat(80))
}

main().catch(console.error)
