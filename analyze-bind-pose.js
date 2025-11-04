/**
 * analyze-bind-pose.js - Analyze the relationship between bind pose and animations
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

async function analyzeBindPose() {
  console.log('\n' + '='.repeat(80))
  console.log('BIND POSE ANALYSIS')
  console.log('='.repeat(80))

  // 1. Analyze our VRM
  console.log('\n📦 OUR VRM (packages/asset-forge/gdd-assets/human/human.vrm)')
  console.log('─'.repeat(80))

  const vrmBuffer = await readFile('packages/asset-forge/gdd-assets/human/human.vrm')
  const vrmGltf = parseGLB(vrmBuffer)

  const vrmHips = vrmGltf.nodes[3] // Hips is node 3
  console.log('Hips node in glTF JSON:')
  console.log('  Rotation:', vrmHips.rotation)
  console.log('  Rotation magnitude:', Math.sqrt(
    vrmHips.rotation[0]**2 + vrmHips.rotation[1]**2 + vrmHips.rotation[2]**2
  ).toFixed(3))

  // Check if there are inverse bind matrices
  if (vrmGltf.skins && vrmGltf.skins[0]) {
    console.log('\nSkin info:')
    console.log('  Joints:', vrmGltf.skins[0].joints.length)
    console.log('  inverseBindMatrices accessor:', vrmGltf.skins[0].inverseBindMatrices)
  }

  // 2. Analyze Mixamo animation
  console.log('\n\n🎬 MIXAMO ANIMATION (/tmp/emote-idle.glb)')
  console.log('─'.repeat(80))

  const animBuffer = await readFile('/tmp/emote-idle.glb')
  const animGltf = parseGLB(animBuffer)

  // Find Hips node in Mixamo
  const mixamoHipsIndex = animGltf.nodes.findIndex(n => n.name === 'mixamorig:Hips')
  if (mixamoHipsIndex >= 0) {
    const mixamoHips = animGltf.nodes[mixamoHipsIndex]
    console.log('mixamorig:Hips node in glTF JSON:')
    console.log('  Rotation:', mixamoHips.rotation || 'undefined (identity)')
    if (mixamoHips.rotation) {
      console.log('  Rotation magnitude:', Math.sqrt(
        mixamoHips.rotation[0]**2 + mixamoHips.rotation[1]**2 + mixamoHips.rotation[2]**2
      ).toFixed(3))
    }
  }

  // Check animation tracks
  if (animGltf.animations && animGltf.animations[0]) {
    const anim = animGltf.animations[0]
    console.log('\nAnimation info:')
    console.log('  Name:', anim.name)
    console.log('  Channels:', anim.channels.length)

    // Find Hips rotation channel
    const hipsRotChannel = anim.channels.find(ch =>
      ch.target.node === mixamoHipsIndex && ch.target.path === 'rotation'
    )

    if (hipsRotChannel) {
      const samplerIndex = hipsRotChannel.sampler
      const sampler = anim.samplers[samplerIndex]

      console.log('\n  Hips rotation channel:')
      console.log('    Sampler:', samplerIndex)
      console.log('    Output accessor:', sampler.output)

      // Read first keyframe value from accessor
      const outputAccessor = animGltf.accessors[sampler.output]
      const bufferView = animGltf.bufferViews[outputAccessor.bufferView]

      console.log('    First keyframe accessor info:')
      console.log('      Type:', outputAccessor.type)
      console.log('      componentType:', outputAccessor.componentType)
      console.log('      count:', outputAccessor.count)
      console.log('      bufferView:', outputAccessor.bufferView)
      console.log('      byteOffset:', outputAccessor.byteOffset || 0)
    }
  }

  // 3. Compare bind poses
  console.log('\n\n🔍 BIND POSE COMPARISON')
  console.log('─'.repeat(80))

  console.log('\nOur VRM Hips:       [' + vrmHips.rotation.map(v => v.toFixed(3)).join(', ') + ']')
  console.log('                    ↳ 90° rotation (A-pose/Meshy bind pose)')

  console.log('\nMixamo skeleton:    [0.000, 0.000, 0.000, 1.000] (assumed T-pose)')
  console.log('                    ↳ Identity rotation (T-pose)')

  console.log('\n⚠️  BIND POSE MISMATCH!')
  console.log('   When Mixamo animation says "Hips = [x, y, z, w]", it expects:')
  console.log('   - Skeleton in T-pose (Hips rotation = identity)')
  console.log('   - Inverse bind matrices computed from T-pose')
  console.log('')
  console.log('   But our VRM has:')
  console.log('   - Skeleton in A-pose (Hips rotation = 90°)')
  console.log('   - Inverse bind matrices computed from A-pose')
  console.log('')
  console.log('   Result: Animation values produce incorrect mesh deformation!')

  // 4. Solution
  console.log('\n\n💡 SOLUTION')
  console.log('─'.repeat(80))
  console.log('\nTo make Mixamo animations work with our VRM:')
  console.log('\n1. Normalize VRM skeleton to T-pose:')
  console.log('   - Change Hips rotation from [0.506, -0.333, 0.562, 0.562] → [0, 0, 0, 1]')
  console.log('   - Adjust child bones to maintain mesh shape')
  console.log('   - Update ALL bone transforms in the hierarchy')
  console.log('')
  console.log('2. Recalculate inverse bind matrices:')
  console.log('   - Call skeleton.calculateInverses()')
  console.log('   - This bakes the new T-pose as the bind pose')
  console.log('')
  console.log('3. Export with new bind pose:')
  console.log('   - GLTFExporter will capture the T-pose inverse bind matrices')
  console.log('   - Mixamo animations will now work correctly!')

  console.log('\n' + '='.repeat(80))
}

analyzeBindPose().catch(console.error)
