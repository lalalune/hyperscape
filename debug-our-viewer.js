/**
 * debug-our-viewer.js
 *
 * Paste this into the browser console of OUR VRM test viewer
 * (localhost:3004) to see how WE handle animations
 */

(function() {
  console.log('\n' + '='.repeat(80))
  console.log('OUR VRM VIEWER DEBUG - CURRENT ANIMATION SETUP')
  console.log('='.repeat(80))

  // Our VRMTestViewer uses a canvas element
  const canvas = document.querySelector('canvas')
  if (!canvas) {
    console.error('❌ No canvas found!')
    return
  }

  console.log('✅ Canvas found')

  // Try to access THREE.js scene from React DevTools or global scope
  // The VRMTestViewer component stores scene/mixer in closure, so we need to inspect the DOM

  // Alternative: Search all properties on window and canvas
  let scene = null
  let mixer = null
  let vrm = null

  // Check common locations
  if (window.__THREE_DEVTOOLS__) {
    console.log('THREE DevTools available')
    // THREE DevTools stores references
  }

  // Since our viewer uses closures, let's try to hook into the animation loop
  console.log('\n🎯 ATTEMPTING TO INTERCEPT ANIMATION LOOP...')
  console.log('This script will try to log when animations update')

  // Override AnimationMixer.update to log calls
  if (window.THREE && window.THREE.AnimationMixer) {
    const originalUpdate = window.THREE.AnimationMixer.prototype.update

    window.THREE.AnimationMixer.prototype.update = function(deltaTime) {
      if (!window.__DEBUG_MIXER) {
        window.__DEBUG_MIXER = this
        console.log('\n🎬 INTERCEPTED AnimationMixer!')
        console.log('  Mixer root:', this._root.type, this._root.name)
        console.log('  Mixer root constructor:', this._root.constructor.name)
        console.log('  Active actions:', this._actions.length)

        if (this._actions.length > 0) {
          const action = this._actions[0]
          if (action._clip) {
            console.log('\n  First active clip:', action._clip.name)
            console.log('  Tracks:', action._clip.tracks.length)
            console.log('  Track names (first 10):')
            action._clip.tracks.slice(0, 10).forEach(t => {
              console.log('    -', t.name)
            })
          }
        }

        // Find SkinnedMesh
        let skinnedMesh = null
        this._root.traverse((obj) => {
          if (obj.isSkinnedMesh && !skinnedMesh) {
            skinnedMesh = obj
          }
        })

        if (skinnedMesh) {
          console.log('\n📦 Found SkinnedMesh:', skinnedMesh.name)
          console.log('  Bones:', skinnedMesh.skeleton.bones.length)
          console.log('  Bone names (first 10):')
          skinnedMesh.skeleton.bones.slice(0, 10).forEach((b, i) => {
            console.log(`    ${i}: ${b.name}`)
          })

          // Check hierarchy
          console.log('\n🌳 HIERARCHY:')
          console.log('  SkinnedMesh parent:', skinnedMesh.parent ? skinnedMesh.parent.type + ' "' + skinnedMesh.parent.name + '"' : 'null')

          const firstBone = skinnedMesh.skeleton.bones[0]
          console.log('  First bone parent:', firstBone.parent ? firstBone.parent.type + ' "' + firstBone.parent.name + '"' : 'null')

          // Check if bones are children of SkinnedMesh
          const boneInMeshChildren = skinnedMesh.children.some(c => c.isBone)
          console.log('  Bones are children of SkinnedMesh?', boneInMeshChildren)

          // Check if bones are siblings of SkinnedMesh
          const boneInParentChildren = skinnedMesh.parent && skinnedMesh.parent.children.some(c => c.isBone)
          console.log('  Bones are siblings of SkinnedMesh?', boneInParentChildren)

          // Check bone quaternions
          const hipsBone = skinnedMesh.skeleton.bones.find(b => b.name === 'Hips')
          if (hipsBone) {
            console.log('\n🦴 Hips bone state:')
            console.log('  Position:', hipsBone.position.toArray().map(v => v.toFixed(3)))
            console.log('  Quaternion:', hipsBone.quaternion.toArray().map(v => v.toFixed(3)))
            console.log('  Scale:', hipsBone.scale.toArray().map(v => v.toFixed(3)))
          }
        }

        // Check PropertyBinding to see if tracks can find their targets
        console.log('\n🔗 CHECKING PROPERTY BINDINGS:')
        if (this._actions.length > 0 && this._actions[0]._clip) {
          const clip = this._actions[0]._clip
          const sampleTrack = clip.tracks.find(t => t.name.includes('Hips'))

          if (sampleTrack) {
            console.log('  Sample track:', sampleTrack.name)

            // Try to manually parse the track
            try {
              const binding = window.THREE.PropertyBinding.create(this._root, sampleTrack.name)
              console.log('  Binding created successfully:', !!binding)
              console.log('  Binding path:', binding.path)
              console.log('  Binding node:', binding.node ? binding.node.type + ' "' + binding.node.name + '"' : 'null')
            } catch (e) {
              console.error('  ❌ Binding failed:', e.message)
            }
          }
        }
      }

      return originalUpdate.call(this, deltaTime)
    }

    console.log('✅ AnimationMixer.update() hooked - waiting for animation to play...')
    console.log('💡 Play an animation in the viewer to see debug output')
  }

  console.log('\n' + '='.repeat(80))
  console.log('🎯 INSTRUCTIONS:')
  console.log('1. Load a VRM in the viewer')
  console.log('2. Play an animation')
  console.log('3. Check the console output above')
  console.log('='.repeat(80))
})()
