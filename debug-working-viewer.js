/**
 * debug-working-viewer.js
 *
 * Paste this into the browser console of a WORKING VRM viewer
 * (like https://vrm-view.vercel.app or https://hub.vroid.com)
 * to extract how they handle animations
 */

(function() {
  console.log('\n' + '='.repeat(80))
  console.log('WORKING VRM VIEWER DEBUG - EXTRACTING ANIMATION SETUP')
  console.log('='.repeat(80))

  // Find all THREE.js scenes in the page
  const scenes = []
  const mixers = []
  let vrm = null

  // Try to find VRM and AnimationMixer in common global locations
  if (window.scene) scenes.push(window.scene)
  if (window.mixer) mixers.push(window.mixer)
  if (window.vrm) vrm = window.vrm

  // Search for THREE objects in window
  console.log('\n🔍 Searching for THREE.js objects in window...')
  for (let key in window) {
    const obj = window[key]
    if (obj && obj.isScene) {
      console.log('  Found Scene:', key)
      scenes.push(obj)
    }
    if (obj && obj.constructor && obj.constructor.name === 'AnimationMixer') {
      console.log('  Found AnimationMixer:', key)
      mixers.push(obj)
    }
    if (obj && obj.scene && obj.humanoid) {
      console.log('  Found VRM:', key)
      vrm = obj
    }
  }

  // If no scenes found, try to intercept renderer render calls
  if (scenes.length === 0) {
    console.log('⚠️  No scene in window globals, trying alternative methods...')

    // Method 1: Hook into THREE.WebGLRenderer.render to capture scene
    if (window.THREE && window.THREE.WebGLRenderer) {
      console.log('🎣 Hooking THREE.WebGLRenderer.render()...')

      const originalRender = window.THREE.WebGLRenderer.prototype.render
      window.THREE.WebGLRenderer.prototype.render = function(scene, camera) {
        if (scene.isScene && !window.__DEBUG_SCENE) {
          window.__DEBUG_SCENE = scene
          console.log('✅ CAPTURED Scene from render()!')

          // Find VRM and SkinnedMesh
          let vrm = null
          let skinnedMesh = null
          scene.traverse((obj) => {
            if (obj.isSkinnedMesh && !skinnedMesh) {
              skinnedMesh = obj
            }
            if (obj.userData && obj.userData.vrm) {
              vrm = obj.userData.vrm
            }
            if (obj.scene && obj.humanoid) {
              vrm = obj
            }
          })

          if (skinnedMesh) {
            console.log('\n📦 SkinnedMesh found:', skinnedMesh.name)
            console.log('  Bones:', skinnedMesh.skeleton.bones.length)
            console.log('  First 10 bone names:')
            skinnedMesh.skeleton.bones.slice(0, 10).forEach((b, i) => {
              console.log(`    ${i}: ${b.name}`)
            })

            // Check hierarchy
            console.log('\n🌳 Hierarchy:')
            const armature = skinnedMesh.parent
            console.log('  SkinnedMesh parent:', armature ? armature.type + ' "' + armature.name + '"' : 'null')

            const firstBone = skinnedMesh.skeleton.bones[0]
            console.log('  First bone parent:', firstBone.parent ? firstBone.parent.type + ' "' + firstBone.parent.name + '"' : 'null')
            console.log('  Bones are children of SkinnedMesh?', skinnedMesh.children.some(c => c.isBone))
            console.log('  Bones are siblings of SkinnedMesh?', armature && armature.children.some(c => c.isBone))

            // Check bone rotations
            const hipsBone = skinnedMesh.skeleton.bones.find(b => b.name === 'Hips' || b.name === 'hips')
            if (hipsBone) {
              console.log('\n🦴 Hips bone:')
              console.log('  Name:', hipsBone.name)
              console.log('  Quaternion:', hipsBone.quaternion.toArray().map(v => v.toFixed(3)))
            }
          }

          if (vrm && vrm.humanoid) {
            console.log('\n🤖 VRM Humanoid found:')
            console.log('  Humanoid bones:', Object.keys(vrm.humanoid.humanBones).length)
            if (vrm.humanoid.normalizedRestPose && vrm.humanoid.normalizedRestPose.hips) {
              const hipsPos = vrm.humanoid.normalizedRestPose.hips.position
              console.log('  normalizedRestPose.hips.position:', hipsPos.map(v => v.toFixed(3)))
            }
          }

          // Also hook AnimationMixer
          if (!window.__DEBUG_MIXER_HOOKED) {
            window.__DEBUG_MIXER_HOOKED = true

            const originalUpdate = window.THREE.AnimationMixer.prototype.update
            window.THREE.AnimationMixer.prototype.update = function(deltaTime) {
              if (!window.__DEBUG_MIXER) {
                window.__DEBUG_MIXER = this
                console.log('\n🎬 CAPTURED AnimationMixer!')
                console.log('  Mixer root:', this._root.type, '"' + this._root.name + '"')
                console.log('  Mixer root === Scene?', this._root.isScene)
                console.log('  Active actions:', this._actions.length)

                if (this._actions.length > 0 && this._actions[0]._clip) {
                  const clip = this._actions[0]._clip
                  console.log('\n  Animation clip:', clip.name)
                  console.log('  Tracks:', clip.tracks.length)
                  console.log('  First 10 track names:')
                  clip.tracks.slice(0, 10).forEach(t => console.log('    -', t.name))
                }
              }
              return originalUpdate.call(this, deltaTime)
            }
            console.log('✅ AnimationMixer hooked!')
          }
        }
        return originalRender.call(this, scene, camera)
      }

      console.log('✅ Hook installed - waiting for next render frame...')
      console.log('💡 The scene will be captured automatically when the viewer renders')
      return
    }

    console.error('❌ Could not find THREE.js or scene!')
    return
  }

  const scene = scenes[0]
  console.log('\n✅ Using scene:', scene.uuid)

  // Find VRM in scene
  if (!vrm) {
    scene.traverse((obj) => {
      if (obj.userData && obj.userData.vrm) {
        vrm = obj.userData.vrm
        console.log('✅ Found VRM in scene.traverse')
      }
      if (obj.isVRM || (obj.scene && obj.humanoid)) {
        vrm = obj
        console.log('✅ Found VRM object in scene')
      }
    })
  }

  // Find SkinnedMesh
  let skinnedMesh = null
  scene.traverse((obj) => {
    if (obj.isSkinnedMesh && !skinnedMesh) {
      skinnedMesh = obj
    }
  })

  if (!skinnedMesh) {
    console.error('❌ No SkinnedMesh found!')
    return
  }

  console.log('\n📦 SkinnedMesh found:', skinnedMesh.name)
  console.log('  Bones:', skinnedMesh.skeleton.bones.length)

  // Analyze hierarchy
  console.log('\n🌳 HIERARCHY STRUCTURE:')
  function printHierarchy(obj, indent = 0) {
    const prefix = '  '.repeat(indent)
    const type = obj.type || obj.constructor.name
    const name = obj.name || 'unnamed'

    let info = `${prefix}${type} "${name}"`

    if (obj.isBone) {
      const q = obj.quaternion
      info += ` | rot:[${q.x.toFixed(3)}, ${q.y.toFixed(3)}, ${q.z.toFixed(3)}, ${q.w.toFixed(3)}]`
    }

    if (obj === skinnedMesh) {
      info += ' ← SKINNED MESH'
    }

    if (obj === skinnedMesh.parent) {
      info += ' ← SKINNED MESH PARENT (Armature?)'
    }

    console.log(info)

    if (indent < 3) { // Limit depth
      obj.children.forEach(child => printHierarchy(child, indent + 1))
    } else if (obj.children.length > 0) {
      console.log(`${prefix}  ... (${obj.children.length} more children)`)
    }
  }

  // Start from SkinnedMesh parent (should be Armature)
  const armature = skinnedMesh.parent
  if (armature) {
    console.log('Starting from SkinnedMesh parent (Armature):')
    printHierarchy(armature)
  } else {
    console.log('Starting from SkinnedMesh (no parent):')
    printHierarchy(skinnedMesh)
  }

  // Find AnimationMixer
  console.log('\n🎬 ANIMATION MIXER:')

  if (mixers.length > 0) {
    const mixer = mixers[0]
    console.log('✅ Found AnimationMixer')
    console.log('  Mixer root:', mixer._root.type, mixer._root.name)
    console.log('  Mixer root === scene?', mixer._root === scene)
    console.log('  Mixer root === armature?', mixer._root === armature)
    console.log('  Mixer root === skinnedMesh?', mixer._root === skinnedMesh)
    console.log('  Mixer root === vrm.scene?', vrm && mixer._root === vrm.scene)

    // Check active actions
    if (mixer._actions && mixer._actions.length > 0) {
      console.log(`\n  Active actions: ${mixer._actions.length}`)
      mixer._actions.forEach((action, i) => {
        if (action._clip) {
          console.log(`\n  Action ${i}: ${action._clip.name}`)
          console.log(`    Tracks: ${action._clip.tracks.length}`)

          // Show first few track names
          const trackSample = action._clip.tracks.slice(0, 10).map(t => t.name)
          console.log(`    Sample tracks:`, trackSample)

          // Show track value types
          const trackTypes = {}
          action._clip.tracks.forEach(t => {
            const type = t.ValueTypeName
            trackTypes[type] = (trackTypes[type] || 0) + 1
          })
          console.log(`    Track types:`, trackTypes)
        }
      })
    }
  } else {
    console.warn('⚠️  No AnimationMixer found in window!')
    console.log('💡 The viewer might create it differently. Try:')
    console.log('   - window.mixer')
    console.log('   - window.viewer.mixer')
    console.log('   - window.app.mixer')
  }

  // Analyze bone names
  console.log('\n🦴 BONE NAMES IN SKELETON:')
  const boneNames = skinnedMesh.skeleton.bones.map((b, i) => `${i}: ${b.name}`)
  console.log(boneNames.slice(0, 20).join('\n'))
  if (boneNames.length > 20) {
    console.log(`... and ${boneNames.length - 20} more`)
  }

  // Check if bones are in skeleton or scene hierarchy
  console.log('\n🔍 BONE LOCATION CHECK:')
  const firstBone = skinnedMesh.skeleton.bones[0]
  console.log('  First bone name:', firstBone.name)
  console.log('  First bone parent:', firstBone.parent ? firstBone.parent.type + ' "' + firstBone.parent.name + '"' : 'null')

  let boneParent = firstBone.parent
  let depth = 0
  while (boneParent && depth < 10) {
    console.log(`    Parent ${depth}: ${boneParent.type} "${boneParent.name}"`)
    if (boneParent === armature) {
      console.log(`      ✅ Armature is ${depth} levels up`)
    }
    if (boneParent === skinnedMesh) {
      console.log(`      ⚠️  SkinnedMesh is ${depth} levels up (UNUSUAL!)`)
    }
    boneParent = boneParent.parent
    depth++
  }

  // Check VRM humanoid
  if (vrm && vrm.humanoid) {
    console.log('\n🤖 VRM HUMANOID:')
    console.log('  VRM found:', !!vrm)
    console.log('  Humanoid found:', !!vrm.humanoid)

    if (vrm.humanoid.humanBones) {
      console.log('  Humanoid bones:', Object.keys(vrm.humanoid.humanBones).length)
      console.log('  Sample humanoid bones:')
      Object.entries(vrm.humanoid.humanBones).slice(0, 5).forEach(([name, bone]) => {
        console.log(`    ${name}: ${bone.node ? bone.node.name : 'N/A'}`)
      })
    }

    if (vrm.humanoid.normalizedRestPose) {
      console.log('\n  normalizedRestPose exists:', !!vrm.humanoid.normalizedRestPose)
      if (vrm.humanoid.normalizedRestPose.hips) {
        const hipsPos = vrm.humanoid.normalizedRestPose.hips.position
        console.log(`    Hips position: [${hipsPos[0].toFixed(3)}, ${hipsPos[1].toFixed(3)}, ${hipsPos[2].toFixed(3)}]`)
      }
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('✅ DEBUG COMPLETE - Check the output above!')
  console.log('='.repeat(80))
})()
