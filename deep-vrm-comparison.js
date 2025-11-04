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

async function analyzeVRM(path, label) {
  console.log('\n' + '='.repeat(80))
  console.log(label)
  console.log('='.repeat(80))

  const buffer = await readFile(path)
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))

  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  const gltf = await loader.parseAsync(arrayBuffer, '')
  const vrm = gltf.userData.vrm

  // Find skeleton
  let skeleton = null
  vrm.scene.traverse((obj) => {
    if (obj instanceof THREE.SkinnedMesh && !skeleton) {
      skeleton = obj.skeleton
    }
  })

  if (!skeleton) {
    console.log('❌ No skeleton!')
    return
  }

  console.log('\n🦴 Skeleton Analysis:')
  console.log('  Total bones:', skeleton.bones.length)
  
  // Find Hips
  const hipsBone = skeleton.bones.find(b => b.name === 'Hips' || b.name === 'hips')
  if (!hipsBone) {
    console.log('❌ No Hips bone!')
    return
  }

  const hipsIndex = skeleton.bones.indexOf(hipsBone)
  console.log('\n📍 Hips Bone (#' + hipsIndex + '):')
  console.log('  Name:', hipsBone.name)
  console.log('  Local position:', [hipsBone.position.x.toFixed(3), hipsBone.position.y.toFixed(3), hipsBone.position.z.toFixed(3)])
  console.log('  Local rotation:', [hipsBone.quaternion.x.toFixed(3), hipsBone.quaternion.y.toFixed(3), hipsBone.quaternion.z.toFixed(3), hipsBone.quaternion.w.toFixed(3)])
  
  // Get world position
  const worldPos = new THREE.Vector3()
  hipsBone.getWorldPosition(worldPos)
  console.log('  World position:', [worldPos.x.toFixed(3), worldPos.y.toFixed(3), worldPos.z.toFixed(3)])

  // Get inverse bind matrix
  if (hipsIndex < skeleton.boneInverses.length) {
    const invBind = skeleton.boneInverses[hipsIndex]
    console.log('\n🔗 Hips Inverse Bind Matrix:')
    console.log('  Row 0:', [invBind.elements[0].toFixed(3), invBind.elements[4].toFixed(3), invBind.elements[8].toFixed(3), invBind.elements[12].toFixed(3)])
    console.log('  Row 1:', [invBind.elements[1].toFixed(3), invBind.elements[5].toFixed(3), invBind.elements[9].toFixed(3), invBind.elements[13].toFixed(3)])
    console.log('  Row 2:', [invBind.elements[2].toFixed(3), invBind.elements[6].toFixed(3), invBind.elements[10].toFixed(3), invBind.elements[14].toFixed(3)])
    console.log('  Row 3:', [invBind.elements[3].toFixed(3), invBind.elements[7].toFixed(3), invBind.elements[11].toFixed(3), invBind.elements[15].toFixed(3)])
  }

  return { vrm, skeleton, hipsBone, hipsIndex }
}

async function main() {
  console.log('\n' + '█'.repeat(80))
  console.log('DEEP VRM COMPARISON')
  console.log('█'.repeat(80))

  const working = await analyzeVRM('assets/avatar1.vrm', '🟢 WORKING: avatar1.vrm')
  const broken = await analyzeVRM('packages/asset-forge/gdd-assets/human/human.vrm', '🔴 BROKEN: human.vrm')

  console.log('\n' + '█'.repeat(80))
  console.log('KEY INSIGHT')
  console.log('█'.repeat(80))
  console.log('\nThe inverse bind matrix encodes the bind pose!')
  console.log('If Hips is in A-pose, the inverse bind matrix will reflect that.')
  console.log('Hyperscape applies: vertex_position = bone_matrix * inverse_bind_matrix * vertex')
  console.log('\nFor animations to work, the bone LOCAL rotations must start at the bind pose.')
  console.log('Otherwise the first frame will be wrong.')

  console.log('\n' + '█'.repeat(80))
  console.log('DONE')
  console.log('█'.repeat(80))
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
