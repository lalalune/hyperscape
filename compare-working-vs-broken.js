/**
 * compare-working-vs-broken.js - Compare working vs broken VRM
 * 
 * Compares avatar1.vrm (working) with human.vrm (not working) to find differences
 */

import { readFile } from 'fs/promises'

function parseGLB(buffer) {
  const magic = buffer.readUInt32LE(0)
  if (magic !== 0x46546C67) {
    throw new Error('Not a valid GLB file')
  }

  const jsonChunkLength = buffer.readUInt32LE(12)
  const jsonData = buffer.slice(20, 20 + jsonChunkLength).toString('utf8')
  const gltf = JSON.parse(jsonData)

  const binaryChunkStart = 20 + jsonChunkLength + 8
  const binaryData = buffer.slice(binaryChunkStart)

  return { gltf, binaryData }
}

function getAccessorData(gltf, binaryData, accessorIndex) {
  const accessor = gltf.accessors[accessorIndex]
  const bufferView = gltf.bufferViews[accessor.bufferView]

  const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0)
  const componentSize = accessor.componentType === 5126 ? 4 : 2
  const numComponents = {
    'SCALAR': 1,
    'VEC2': 2,
    'VEC3': 3,
    'VEC4': 4,
    'MAT4': 16
  }[accessor.type]

  const values = []
  for (let i = 0; i < accessor.count; i++) {
    const elementOffset = offset + i * componentSize * numComponents
    const element = []
    for (let j = 0; j < numComponents; j++) {
      element.push(binaryData.readFloatLE(elementOffset + j * componentSize))
    }
    values.push(element)
  }

  return values
}

async function analyzeVRM(path, label) {
  console.log('\n' + '='.repeat(80))
  console.log(label)
  console.log('='.repeat(80))

  const buffer = await readFile(path)
  const { gltf, binaryData } = parseGLB(buffer)

  // Find Hips node
  let hipsNode = null
  let hipsIndex = -1
  for (let i = 0; i < gltf.nodes.length; i++) {
    if (gltf.nodes[i].name === 'Hips' || gltf.nodes[i].name === 'hips') {
      hipsNode = gltf.nodes[i]
      hipsIndex = i
      break
    }
  }

  if (!hipsNode) {
    console.log('❌ No Hips node found!')
    return null
  }

  console.log('\n📍 Hips Node:')
  console.log('  Index:', hipsIndex)
  console.log('  Translation:', hipsNode.translation || 'undefined')
  console.log('  Rotation:', hipsNode.rotation || 'undefined')
  console.log('  Scale:', hipsNode.scale || 'undefined')
  console.log('  Matrix:', hipsNode.matrix ? 'YES (matrix mode)' : 'NO (TRS mode)')

  // Find skeleton
  const skin = gltf.skins?.[0]
  if (!skin) {
    console.log('❌ No skin found!')
    return null
  }

  console.log('\n🦴 Skeleton:')
  console.log('  Total joints:', skin.joints.length)
  console.log('  Has inverseBindMatrices:', skin.inverseBindMatrices !== undefined)

  // Get inverse bind matrices
  if (skin.inverseBindMatrices !== undefined) {
    const inverseBindMatrices = getAccessorData(gltf, binaryData, skin.inverseBindMatrices)
    
    // Find Hips in joints
    const hipsJointIndex = skin.joints.indexOf(hipsIndex)
    if (hipsJointIndex >= 0 && hipsJointIndex < inverseBindMatrices.length) {
      const invBindMat = inverseBindMatrices[hipsJointIndex]
      console.log('\n🔗 Hips Inverse Bind Matrix:')
      console.log('  [0-3]:  ', invBindMat.slice(0, 4).map(v => v.toFixed(3)).join(', '))
      console.log('  [4-7]:  ', invBindMat.slice(4, 8).map(v => v.toFixed(3)).join(', '))
      console.log('  [8-11]: ', invBindMat.slice(8, 12).map(v => v.toFixed(3)).join(', '))
      console.log('  [12-15]:', invBindMat.slice(12, 16).map(v => v.toFixed(3)).join(', '))
    }
  }

  // Check VRM extension
  const vrm = gltf.extensions?.VRMC_vrm || gltf.extensions?.VRM
  if (vrm) {
    console.log('\n📦 VRM Extension:')
    console.log('  Version:', vrm.specVersion || 'N/A')
    console.log('  metaVersion:', vrm.meta?.metaVersion || 'undefined')
    
    const humanoid = vrm.humanoid
    if (humanoid) {
      console.log('  Humanoid bones:', Object.keys(humanoid.humanBones || humanoid).length)
    }
  }

  // Find mesh bounding box
  const meshes = gltf.meshes || []
  console.log('\n📏 Mesh Data:')
  console.log('  Total meshes:', meshes.length)
  
  if (meshes.length > 0) {
    const mesh = meshes[0]
    const primitive = mesh.primitives[0]
    
    if (primitive.attributes.POSITION !== undefined) {
      const accessor = gltf.accessors[primitive.attributes.POSITION]
      console.log('  Position accessor:')
      console.log('    Min:', accessor.min?.map(v => v.toFixed(3)).join(', '))
      console.log('    Max:', accessor.max?.map(v => v.toFixed(3)).join(', '))
      
      if (accessor.min && accessor.max) {
        const height = accessor.max[1] - accessor.min[1]
        console.log('    Height:', height.toFixed(3))
      }
    }
  }

  return {
    hipsNode,
    hipsIndex,
    skin,
    vrm
  }
}

async function main() {
  console.log('\n' + '█'.repeat(80))
  console.log('WORKING VS BROKEN VRM COMPARISON')
  console.log('█'.repeat(80))

  const working = await analyzeVRM('assets/avatar1.vrm', '🟢 WORKING: avatar1.vrm')
  const broken = await analyzeVRM('packages/asset-forge/gdd-assets/human/human.vrm', '🔴 BROKEN: human.vrm')

  console.log('\n' + '█'.repeat(80))
  console.log('KEY DIFFERENCES')
  console.log('█'.repeat(80))

  if (working && broken) {
    console.log('\n📍 Hips Translation:')
    console.log('  Working:', working.hipsNode.translation || 'undefined')
    console.log('  Broken: ', broken.hipsNode.translation || 'undefined')

    console.log('\n🔄 Hips Rotation:')
    console.log('  Working:', working.hipsNode.rotation || 'undefined (identity)')
    console.log('  Broken: ', broken.hipsNode.rotation || 'undefined (identity)')

    console.log('\n📐 Node Storage Mode:')
    console.log('  Working:', working.hipsNode.matrix ? 'MATRIX' : 'TRS')
    console.log('  Broken: ', broken.hipsNode.matrix ? 'MATRIX' : 'TRS')
  }

  console.log('\n' + '█'.repeat(80))
  console.log('ANALYSIS COMPLETE')
  console.log('█'.repeat(80))
}

main().catch(console.error)
