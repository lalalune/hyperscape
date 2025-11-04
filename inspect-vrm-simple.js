/**
 * inspect-vrm-simple.js - Parse GLB binary and extract JSON
 */

import { readFile } from 'fs/promises'

function parseGLB(buffer) {
  const magic = buffer.readUInt32LE(0)
  const version = buffer.readUInt32LE(4)
  const length = buffer.readUInt32LE(8)

  if (magic !== 0x46546C67) {
    throw new Error('Not a valid GLB file')
  }

  // Read JSON chunk
  const jsonChunkLength = buffer.readUInt32LE(12)
  const jsonChunkType = buffer.readUInt32LE(16)

  if (jsonChunkType !== 0x4E4F534A) {
    throw new Error('First chunk is not JSON')
  }

  const jsonData = buffer.slice(20, 20 + jsonChunkLength).toString('utf8')
  return JSON.parse(jsonData)
}

async function inspectVRM(filePath) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`Inspecting: ${filePath}`)
  console.log('='.repeat(80))

  const buffer = await readFile(filePath)
  const gltf = parseGLB(buffer)

  // Find VRM extension
  const vrmExt = gltf.extensions?.VRMC_vrm || gltf.extensions?.VRM

  console.log('\n📋 VRM Metadata:')
  if (vrmExt) {
    console.log(`  Spec Version: ${vrmExt.specVersion || 'VRM 0.0'}`)
    console.log(`  Meta Version: ${vrmExt.meta?.metaVersion || 'unknown'}`)
    console.log(`  Name: ${vrmExt.meta?.name || 'unknown'}`)
    console.log(`  Authors: ${vrmExt.meta?.authors?.join(', ') || vrmExt.meta?.author || 'unknown'}`)
  } else {
    console.log('  ⚠️  No VRM extension found')
  }

  // Find Hips node
  console.log('\n🦴 Skeleton Structure:')
  console.log(`  Total nodes: ${gltf.nodes?.length || 0}`)

  // Map humanoid bones
  if (vrmExt?.humanoid) {
    console.log(`\n👤 Humanoid Bones Mapped:`)
    const humanBones = vrmExt.humanoid.humanBones || vrmExt.humanoid.humanBones
    if (humanBones) {
      const boneMap = {}
      if (Array.isArray(humanBones)) {
        // VRM 1.0 format
        humanBones.forEach(bone => {
          if (bone.node !== undefined) {
            boneMap[bone.bone] = bone.node
          }
        })
      } else {
        // VRM 0.0 format
        Object.entries(humanBones).forEach(([boneName, boneData]) => {
          if (boneData.node !== undefined) {
            boneMap[boneName] = boneData.node
          }
        })
      }

      console.log(`  Total humanoid bones: ${Object.keys(boneMap).length}`)

      // Check Hips
      const hipsNodeIndex = boneMap.hips
      if (hipsNodeIndex !== undefined) {
        const hipsNode = gltf.nodes[hipsNodeIndex]
        console.log(`\n🎯 Hips Bone (node ${hipsNodeIndex}):`)
        console.log(`  Name: ${hipsNode.name}`)

        if (hipsNode.translation) {
          console.log(`  Translation: [${hipsNode.translation.map(v => v.toFixed(3)).join(', ')}]`)
        }

        if (hipsNode.rotation) {
          const q = hipsNode.rotation
          const rotMag = Math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2])
          console.log(`  Rotation: [${q.map(v => v.toFixed(3)).join(', ')}]`)
          console.log(`  Rotation Magnitude: ${rotMag.toFixed(3)} ${rotMag < 0.1 ? '✅ T-pose' : '⚠️  Non-T-pose'}`)
        } else {
          console.log(`  Rotation: [0, 0, 0, 1] ✅ Identity (T-pose)`)
        }

        if (hipsNode.scale) {
          console.log(`  Scale: [${hipsNode.scale.map(v => v.toFixed(3)).join(', ')}]`)
        }

        if (hipsNode.matrix) {
          console.log(`  Matrix: [${hipsNode.matrix.slice(0, 4).map(v => v.toFixed(3)).join(', ')}]`)
        }

        // Find parent chain
        console.log(`\n  Parent chain:`)
        let currentIndex = hipsNodeIndex
        let depth = 0
        const visited = new Set()

        while (currentIndex !== undefined && depth < 10 && !visited.has(currentIndex)) {
          visited.add(currentIndex)
          const node = gltf.nodes[currentIndex]
          if (!node) break

          console.log(`  ${'  '.repeat(depth)}[${currentIndex}] ${node.name || 'unnamed'}`)

          if (node.scale && (node.scale[0] !== 1 || node.scale[1] !== 1 || node.scale[2] !== 1)) {
            console.log(`  ${'  '.repeat(depth)}  ⚠️  Scale: [${node.scale.join(', ')}]`)
          }

          // Find parent
          const parentIndex = gltf.nodes.findIndex(n => n.children?.includes(currentIndex))
          if (parentIndex === -1) break
          currentIndex = parentIndex
          depth++
        }
      }

      // Check arm bones
      console.log(`\n💪 Arm Bones:`)
      const leftArmIndex = boneMap.leftUpperArm
      if (leftArmIndex !== undefined) {
        const leftArm = gltf.nodes[leftArmIndex]
        console.log(`  Left Upper Arm (node ${leftArmIndex}): ${leftArm.name}`)
        if (leftArm.rotation) {
          console.log(`    Rotation: [${leftArm.rotation.map(v => v.toFixed(3)).join(', ')}]`)
        }
      }

      const rightArmIndex = boneMap.rightUpperArm
      if (rightArmIndex !== undefined) {
        const rightArm = gltf.nodes[rightArmIndex]
        console.log(`  Right Upper Arm (node ${rightArmIndex}): ${rightArm.name}`)
        if (rightArm.rotation) {
          console.log(`    Rotation: [${rightArm.rotation.map(v => v.toFixed(3)).join(', ')}]`)
        }
      }
    }
  }

  // Check for Armature or root with scale
  console.log(`\n🏗️  Root Nodes:`)
  if (gltf.scenes && gltf.scenes[0]) {
    const rootNodes = gltf.scenes[0].nodes || []
    rootNodes.forEach(nodeIndex => {
      const node = gltf.nodes[nodeIndex]
      console.log(`  [${nodeIndex}] ${node.name || 'unnamed'}`)
      if (node.scale) {
        console.log(`    Scale: [${node.scale.join(', ')}]`)
      }
    })
  }
}

// Run inspection
const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('Usage: node inspect-vrm-simple.js <vrm-file-path> [<another-vrm-file>]')
  process.exit(1)
}

for (const filePath of args) {
  await inspectVRM(filePath)
}
