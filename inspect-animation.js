/**
 * inspect-animation.js - Inspect animation GLB to see bone names
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

async function inspectAnimation(filePath) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`Inspecting: ${filePath}`)
  console.log('='.repeat(80))

  const buffer = await readFile(filePath)
  const gltf = parseGLB(buffer)

  // List all node names
  console.log('\n🦴 All Nodes:')
  if (gltf.nodes) {
    gltf.nodes.forEach((node, index) => {
      console.log(`  [${index}] ${node.name}`)
    })
  }

  // List all animation tracks
  console.log('\n🎬 Animations:')
  if (gltf.animations && gltf.animations.length > 0) {
    gltf.animations.forEach((anim, index) => {
      console.log(`\n  Animation ${index}: ${anim.name || 'unnamed'}`)
      console.log(`  Channels: ${anim.channels?.length || 0}`)

      if (anim.channels) {
        // Group channels by target node
        const nodeChannels = new Map()

        anim.channels.forEach(channel => {
          const nodeIndex = channel.target?.node
          const path = channel.target?.path

          if (nodeIndex !== undefined) {
            if (!nodeChannels.has(nodeIndex)) {
              nodeChannels.set(nodeIndex, [])
            }
            nodeChannels.get(nodeIndex).push(path)
          }
        })

        console.log(`\n  Animated Nodes:`)
        for (const [nodeIndex, paths] of nodeChannels.entries()) {
          const nodeName = gltf.nodes[nodeIndex]?.name || 'unnamed'
          console.log(`    [${nodeIndex}] ${nodeName}: ${paths.join(', ')}`)
        }
      }
    })
  } else {
    console.log('  No animations found')
  }

  // Check armature scale
  if (gltf.scenes && gltf.scenes[0]) {
    const rootNodes = gltf.scenes[0].nodes || []
    console.log(`\n🏗️  Scene Root Nodes:`)
    rootNodes.forEach(nodeIndex => {
      const node = gltf.nodes[nodeIndex]
      console.log(`  [${nodeIndex}] ${node.name}`)
      if (node.scale) {
        console.log(`    Scale: [${node.scale.join(', ')}]`)
      }
    })
  }
}

// Run inspection
const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('Usage: node inspect-animation.js <glb-file-path>')
  process.exit(1)
}

for (const filePath of args) {
  await inspectAnimation(filePath)
}
