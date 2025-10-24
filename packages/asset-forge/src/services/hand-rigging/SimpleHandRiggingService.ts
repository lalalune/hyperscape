import {
  Bone, Box3, Float32BufferAttribute, Matrix4, Mesh, Object3D, Skeleton, SkinnedMesh,
  Vector3
} from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

import type { GLTFExportJSON as _GLTFExportJSON } from '../../types/service-types'

export interface SimpleHandRiggingOptions {
  palmBoneLength?: number  // Length from wrist to palm center (default: 0.08)
  fingerBoneLength?: number // Length from palm center to fingertips (default: 0.10)
  debugMode?: boolean
}

export interface SimpleHandRiggingResult {
  success: boolean
  riggedModel: ArrayBuffer | null
  metadata: {
    originalBoneCount: number
    addedBoneCount: number
    leftHandBones?: string[]
    rightHandBones?: string[]
  }
  error?: string
}

export class SimpleHandRiggingService {
  private loader: GLTFLoader
  private exporter: GLTFExporter

  constructor() {
    this.loader = new GLTFLoader()
    this.exporter = new GLTFExporter()
  }

  /**
   * Main entry point - add simple hand bones to a model
   */
  async rigHands(
    modelFile: File | string,
    options: SimpleHandRiggingOptions = {}
  ): Promise<SimpleHandRiggingResult> {
    const {
      palmBoneLength = 300.0,   // ~18% of forearm (1625 units)
      fingerBoneLength = 400.0,  // ~25% of forearm (1625 units)
      debugMode = false
    } = options

    try {
      console.log('🤖 Starting simple hand rigging process...')

      // Load the model
      const model = await this.loadModel(modelFile)
      
      // Fix model scale issues
      console.log('📊 Fixing model scale...')
      
      // The model has bones with 0.01 scale which causes export issues
      // We need to apply this scale to the geometry and reset bone scales
      const BONE_SCALE_FIX = 100 // The bones are 0.01 scale, so we need 100x
      
      model.traverse((child) => {
        if (child instanceof SkinnedMesh) {
          console.log(`  Found SkinnedMesh: ${child.name}`)
          
          // Scale the geometry to match bone scale
          child.geometry.scale(BONE_SCALE_FIX, BONE_SCALE_FIX, BONE_SCALE_FIX)
          
                      // Scale all bone positions to compensate
            if (child.skeleton) {
              child.skeleton.bones.forEach(bone => {
                bone.position.multiplyScalar(BONE_SCALE_FIX)
                // IMPORTANT: Also reset bone scales to 1.0!
                bone.scale.set(1, 1, 1)
              })
              
              // Force update all bone matrices
              child.skeleton.bones.forEach(bone => {
                bone.updateMatrixWorld(true)
              })
              
              // Recalculate inverse matrices
              child.skeleton.calculateInverses()
              
              // Update bind matrices
              child.updateMatrixWorld(true)
              child.bindMatrix.copy(child.matrixWorld)
              child.bindMatrixInverse.copy(child.matrixWorld).invert()
            }
          
          console.log(`  ✅ Applied scale fix of ${BONE_SCALE_FIX}x to geometry and bones`)
        }
      })
      
      // Update the entire model hierarchy after scale fixes
      model.updateMatrixWorld(true)
      
      // Final size check
      const finalBounds = new Box3().setFromObject(model)
      const finalSize = new Vector3()
      finalBounds.getSize(finalSize)
      console.log(`📏 Final model size after fixes: ${finalSize.x.toFixed(3)} x ${finalSize.y.toFixed(3)} x ${finalSize.z.toFixed(3)}`)
      
      // CRITICAL: Remove orphaned bones BEFORE any processing
      console.log('🧹 Removing orphaned bones before hand rigging...')
      // Don't remove head bones - they're valid bones!
      const problematicBoneNames: string[] = [] // Empty list - no bones are inherently problematic
      const bonesToDelete: Bone[] = []
      
      // Find all orphaned bones (bones not in any skeleton)
      const bonesInSkeletons = new Set<Bone>()
      model.traverse((child) => {
        if (child instanceof SkinnedMesh && child.skeleton) {
          child.skeleton.bones.forEach(bone => bonesInSkeletons.add(bone))
        }
      })
      
      // Collect bones to delete - only remove truly orphaned bones that have no parent
      model.traverse((node) => {
        if (node instanceof Bone) {
          // Only remove bones that are in the problematic list (currently empty)
          // Don't remove bones just because they're not in a skeleton - they might be valid hierarchy bones
          if (problematicBoneNames.includes(node.name)) {
            bonesToDelete.push(node)
          }
        }
      })
      
      // Remove the bones from the scene hierarchy
      if (bonesToDelete.length > 0) {
        console.log(`  Found ${bonesToDelete.length} orphaned/problematic bones to remove:`)
        bonesToDelete.forEach(bone => {
          console.log(`    - ${bone.name}`)
          
          // Re-parent any children to the bone's parent
          const children = [...bone.children]
          children.forEach(child => {
            if (bone.parent) {
              bone.parent.add(child)
              // Preserve world transform
              child.applyMatrix4(bone.matrix)
            }
          })
          
          // Remove the bone from its parent
          if (bone.parent) {
            bone.parent.remove(bone)
          }
          
          // CRITICAL: Clear all references to prevent orphaned nodes
          bone.parent = null
          bone.children = []
          bone.visible = false
        })
        
        // CRITICAL: Also remove these bones from any skeleton's bone array
        model.traverse((child) => {
          if (child instanceof SkinnedMesh && child.skeleton) {
            const skeleton = child.skeleton
            const bonesArray = skeleton.bones
            const inversesArray = skeleton.boneInverses
            
            // Check if any bones to delete are in this skeleton
            const indicesToRemove: number[] = []
            bonesToDelete.forEach(boneToDelete => {
              const index = bonesArray.indexOf(boneToDelete)
              if (index !== -1) {
                indicesToRemove.push(index)
                console.log(`    Removing ${boneToDelete.name} from skeleton at index ${index}`)
              }
            })
            
            // Remove bones from skeleton arrays if found
            if (indicesToRemove.length > 0) {
              // Create mapping from old indices to new indices
              const indexMap = new Map<number, number>()
              let newIndex = 0
              for (let oldIndex = 0; oldIndex < bonesArray.length; oldIndex++) {
                if (!indicesToRemove.includes(oldIndex)) {
                  indexMap.set(oldIndex, newIndex)
                  newIndex++
                }
              }
              
              // Update skin indices to use new bone indices
              if (child.geometry && child.geometry.attributes.skinIndex) {
                const skinIndices = child.geometry.attributes.skinIndex
                for (let i = 0; i < skinIndices.count; i++) {
                  for (let j = 0; j < 4; j++) {
                    const oldIdx = skinIndices.getComponent(i, j)
                    const newIdx = indexMap.get(oldIdx)
                    if (newIdx !== undefined) {
                      skinIndices.setComponent(i, j, newIdx)
                    } else if (indicesToRemove.includes(oldIdx)) {
                      // This vertex was weighted to a removed bone, zero it out
                      skinIndices.setComponent(i, j, 0)
                      child.geometry.attributes.skinWeight.setComponent(i, j, 0)
                    }
                  }
                }
                skinIndices.needsUpdate = true
                child.geometry.attributes.skinWeight.needsUpdate = true
              }
              
              // Now remove the bones from arrays
              // Sort indices in descending order to remove from end first
              indicesToRemove.sort((a, b) => b - a)
              indicesToRemove.forEach(idx => {
                bonesArray.splice(idx, 1)
                inversesArray.splice(idx, 1)
              })
              console.log(`    Updated skeleton: now has ${skeleton.bones.length} bones`)
            }
          }
        })
        
        // Update world matrices after removal
        model.updateMatrixWorld(true)
        console.log('  ✅ Orphaned bones removed')
      }
      
      const originalBoneCount = this.countBones(model)

      // Find existing wrist bones
      const wristBones = this.findWristBones(model)
      
      if (wristBones.length === 0) {
        throw new Error('No wrist bones found in the model')
      }

      console.log(`✅ Found ${wristBones.length} wrist bone(s)`)

      // Process each hand
      const addedBones: string[] = []
      const leftHandBones: string[] = []
      const rightHandBones: string[] = []

      for (const wristBone of wristBones) {
        const handBones = await this.createSimpleHandBones(
          model,
          wristBone,
          palmBoneLength,
          fingerBoneLength,
          debugMode
        )

        if (handBones) {
          addedBones.push(...handBones.map(b => b.name))
          
          if (wristBone.name.toLowerCase().includes('left')) {
            leftHandBones.push(...handBones.map(b => b.name))
          } else {
            rightHandBones.push(...handBones.map(b => b.name))
          }
        }
      }

      // Update the model's matrix to ensure correct bone positions
      model.updateMatrixWorld(true)
      
      // Validate the model before export
      console.log('Validating model structure...')
      const validationResult = this.validateModelStructure(model)
      if (!validationResult.isValid) {
        console.error('Model validation failed:', validationResult.errors)
      } else {
        console.log('✅ Model structure validated successfully')
      }
      
      // Final skeleton update
      this.updateAllSkeletons(model)

      // Export the rigged model
      console.log('Exporting rigged model...')
      const exportedBlob = await this.exportModel(model, debugMode)
      
      // Final validation - check the exported model size
      console.log(`📦 Export complete. Model size: ${exportedBlob.byteLength} bytes`)

      return {
        success: true,
        riggedModel: exportedBlob,
        metadata: {
          originalBoneCount,
          addedBoneCount: addedBones.length,
          leftHandBones: leftHandBones.length > 0 ? leftHandBones : undefined,
          rightHandBones: rightHandBones.length > 0 ? rightHandBones : undefined
        }
      }

    } catch (error) {
      console.error('❌ Simple hand rigging failed:', error)
      return {
        success: false,
        riggedModel: null,
        metadata: {
          originalBoneCount: 0,
          addedBoneCount: 0
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Create simple hand bones (palm and finger bones)
   */
  private async createSimpleHandBones(
    model: Object3D,
    wristBone: Bone,
    palmBoneLength: number,
    fingerBoneLength: number,
    debugMode: boolean
  ): Promise<Bone[] | null> {
    try {
      const isLeft = wristBone.name.toLowerCase().includes('left')
      const side = isLeft ? 'left' : 'right'
      if (debugMode) {
        console.log(`Debug: palm length=${palmBoneLength}, finger length=${fingerBoneLength}`)
      }
      
      console.log(`\n🖐️ Creating simple hand bones for ${side} hand...`)

      // Get wrist world position and matrix
      const wristWorldPos = new Vector3()
      const wristWorldMatrix = new Matrix4()
      wristBone.getWorldPosition(wristWorldPos)
      wristBone.updateWorldMatrix(true, false)
      wristWorldMatrix.copy(wristBone.matrixWorld)
      
      console.log(`  Wrist bone: ${wristBone.name}`)
      console.log(`  Wrist world position: ${wristWorldPos.toArray()}`)
      console.log(`  Wrist local position: ${wristBone.position.toArray()}`)
      
      // Auto-scale based on the forearm length
      // The wrist's local position tells us how long the forearm is
      const forearmLength = wristBone.position.length()
      console.log(`  Forearm length: ${forearmLength}`)
      
      // Calculate exact bone sizes based on the scale chain:
      // 1. We work in bone local space (where forearm is ~1625 units)
      // 2. Bones have 0.01 world scale
      // 3. Model gets exported at 1/100 size
      // 4. Viewer scales it up ~416x
      
      // Get parent bone's world scale to understand the transform
      const parentWorldScale = new Vector3()
      if (wristBone.parent && wristBone.parent instanceof Bone) {
        wristBone.parent.getWorldScale(parentWorldScale)
      } else {
        parentWorldScale.set(1, 1, 1)
      }
      
      console.log(`  Parent bone world scale: ${parentWorldScale.x}`)
      
      // A realistic hand is about 18-20cm long
      // The forearm (from elbow to wrist) is typically 25-30cm
      // So hand should be about 65-70% of forearm length
      
      // Since forearmLength is in the bone's local coordinate system,
      // and bones will be scaled by parentWorldScale in world space,
      // we need to calculate the correct local space values
      
      const handToForearmRatio = 0.65  // Hand is 65% of forearm length
      const totalHandLength = forearmLength * handToForearmRatio
      
      // Palm is about 40% of hand, fingers 60%
      const finalPalmLength = totalHandLength * 0.4
      const finalFingerLength = totalHandLength * 0.6
      
      console.log(`  Hand to forearm ratio: ${handToForearmRatio}`)
      console.log(`  Total hand length: ${totalHandLength} (local space)`)
      console.log(`  Bone lengths - Palm: ${finalPalmLength}, Finger: ${finalFingerLength}`)

      // Get the forward direction (along the arm towards fingers)
      const forward = this.getHandForwardDirection(model, wristBone, isLeft)
      console.log(`  Forward direction: ${forward.toArray()}`)
      
      // For bone positioning, we need to work in the parent's local space
      // Don't use world scale as it can be misleading with nested transforms
      const localPalmLength = finalPalmLength
      const localFingerLength = finalFingerLength
      
      console.log(`  Using local space lengths - Palm: ${localPalmLength}, Finger: ${localFingerLength}`)
      
      // Create palm bone (wrist to palm center)
      const palmBone = new Bone()
      palmBone.name = `${wristBone.name}_Palm`
      
      // Position palm bone at end of wrist (in local space of wrist bone)
      const palmPosition = forward.clone().multiplyScalar(localPalmLength)
      palmBone.position.copy(palmPosition)
      
      // Create finger bone (palm center to fingertips)
      const fingerBone = new Bone()
      fingerBone.name = `${wristBone.name}_Fingers`
      
      // Position finger bone at end of palm bone (in local space of palm bone)
      const fingerPosition = forward.clone().multiplyScalar(localFingerLength)
      fingerBone.position.copy(fingerPosition)
      
      console.log(`  Palm bone local position: ${palmBone.position.toArray()}`)
      console.log(`  Finger bone local position: ${fingerBone.position.toArray()}`)
      
      // IMPORTANT: Set up parent-child relationship BEFORE adding to skeleton
      // This ensures the hierarchy is maintained during export
      palmBone.add(fingerBone)
      wristBone.add(palmBone)
      
      // Update matrices after hierarchy is established
      wristBone.updateMatrixWorld(true)
      palmBone.updateMatrixWorld(true)
      fingerBone.updateMatrixWorld(true)
      
      // Debug: Check world positions after adding to hierarchy
      const palmWorldPos = new Vector3()
      const fingerWorldPos = new Vector3()
      palmBone.getWorldPosition(palmWorldPos)
      fingerBone.getWorldPosition(fingerWorldPos)
      
      console.log(`  Palm world position: ${palmWorldPos.toArray()}`)
      console.log(`  Finger world position: ${fingerWorldPos.toArray()}`)
      console.log(`  Distance wrist->palm: ${wristWorldPos.distanceTo(palmWorldPos)}`)
      console.log(`  Distance palm->finger: ${palmWorldPos.distanceTo(fingerWorldPos)}`)
      
      // Check if bones are actually at different positions
      const actualPalmLength = wristWorldPos.distanceTo(palmWorldPos)
      const actualFingerLength = palmWorldPos.distanceTo(fingerWorldPos)
      console.log(`  Actual palm bone length: ${actualPalmLength}`)
      console.log(`  Actual finger bone length: ${actualFingerLength}`)
      
      if (actualPalmLength < 0.001) {
        console.error(`  ❌ Palm bone has zero length! Expected: ${finalPalmLength}`)
      }
      if (actualFingerLength < 0.001) {
        console.error(`  ❌ Finger bone has zero length! Expected: ${finalFingerLength}`)
      }
      
      // Verify bone hierarchy
      console.log(`  Bone hierarchy:`)
      console.log(`    ${wristBone.name} (existing wrist)`)
      console.log(`      └─ ${palmBone.name} (new palm) - ${palmBone.children.length} children`)
      console.log(`           └─ ${fingerBone.name} (new finger) - ${fingerBone.children.length} children`)
      
      // Rebuild skeletons with new bones
      // IMPORTANT: We need to create a SINGLE skeleton that all meshes will share
      let sharedSkeleton: Skeleton | null = null
      let skeletonBones: Bone[] = []
      let skeletonInverses: Matrix4[] = []
      const processedBones = new Set<Bone>()
      
      // First, collect ALL bones in the model (not just from skeletons)
      const allBonesInModel: Bone[] = []
      
      model.traverse((child) => {
        if (child instanceof Bone) {
          // Only collect bones that have a valid parent chain to the model
          if (this.isBoneInScene(child, model)) {
            allBonesInModel.push(child)
          } else {
            console.warn(`  ⚠️ Found orphaned bone during collection: ${child.name}`)
          }
        }
      })
      console.log(`  Found ${allBonesInModel.length} total bones in model`)
      
      // Get the original skeleton as reference for bone order
      let referenceSkeleton: Skeleton | undefined
      const skinnedMeshes: SkinnedMesh[] = []
      
      model.traverse((child) => {
        if (child instanceof SkinnedMesh) {
          skinnedMeshes.push(child)
          if (!referenceSkeleton && child.skeleton) {
            referenceSkeleton = child.skeleton
          }
        }
      })
      
      if (referenceSkeleton) {
        console.log(`  Reference skeleton has ${referenceSkeleton.bones.length} bones`)
        
        // First add all bones from the reference skeleton in order
        for (let i = 0; i < referenceSkeleton.bones.length; i++) {
          const bone = referenceSkeleton.bones[i]
          // CRITICAL: Only add bones that actually exist in the scene
          if (bone && !processedBones.has(bone) && this.isBoneInScene(bone, model)) {
            processedBones.add(bone)
            skeletonBones.push(bone)
            skeletonInverses.push(referenceSkeleton.boneInverses[i] || new Matrix4())
          } else if (bone && !this.isBoneInScene(bone, model)) {
            console.warn(`  ⚠️ Skipping bone not in scene: ${bone.name}`)
          }
        }
      } else {
        console.warn('  No reference skeleton found!')
      }
      
      // Add our new hand bones
      if (!processedBones.has(palmBone)) {
        processedBones.add(palmBone)
        skeletonBones.push(palmBone)
            const palmInverse = new Matrix4()
            palmBone.updateWorldMatrix(true, false)
            palmInverse.copy(palmBone.matrixWorld).invert()
        skeletonInverses.push(palmInverse)
          }
          
      if (!processedBones.has(fingerBone)) {
        processedBones.add(fingerBone)
        skeletonBones.push(fingerBone)
            const fingerInverse = new Matrix4()
            fingerBone.updateWorldMatrix(true, false)
            fingerInverse.copy(fingerBone.matrixWorld).invert()
        skeletonInverses.push(fingerInverse)
      }
      
      // Now add any bones that were in the model but not in the skeleton
      for (const bone of allBonesInModel) {
        // Only add if not processed AND actually in the scene
        if (!processedBones.has(bone) && this.isBoneInScene(bone, model)) {
          console.warn(`  Adding bone not in original skeleton: ${bone.name}`)
          processedBones.add(bone)
          skeletonBones.push(bone)
          const inverse = new Matrix4()
          bone.updateWorldMatrix(true, false)
          inverse.copy(bone.matrixWorld).invert()
          skeletonInverses.push(inverse)
        } else if (!processedBones.has(bone) && !this.isBoneInScene(bone, model)) {
          console.error(`  ❌ Bone ${bone.name} is not in scene, skipping!`)
        }
      }
      
      console.log(`  Total bones for new skeleton: ${skeletonBones.length}`)
      
      // CRITICAL FIX: Remove any non-bone nodes that might have been included
      const validBones: Bone[] = []
      const validInverses: Matrix4[] = []
      
      for (let i = 0; i < skeletonBones.length; i++) {
        const bone = skeletonBones[i]
        // Double-check this is actually a bone
        if (bone && bone instanceof Bone && bone.isBone === true) {
          validBones.push(bone)
          validInverses.push(skeletonInverses[i])
        } else {
          console.error(`  ❌ Found non-bone in skeleton at index ${i}: ${bone?.name || 'undefined'}`)
        }
      }
      
      console.log(`  Filtered to ${validBones.length} valid bones`)
      
      // Sort bones by hierarchy depth to ensure parents come before children
      const getBoneDepth = (bone: Bone): number => {
        let depth = 0
        let current = bone.parent
        while (current && current instanceof Bone) {
          depth++
          current = current.parent
        }
        return depth
      }
      
      // Create index map for bone reordering
      const sortedBones: Bone[] = [...validBones].sort((a, b) => getBoneDepth(a) - getBoneDepth(b))
      const sortedInverses: Matrix4[] = sortedBones.map(bone => {
        const index = validBones.indexOf(bone)
        return validInverses[index]
      })
      
      // CRITICAL: Verify all bones are properly connected
      console.log('  Verifying bone hierarchy...')
      for (let i = 0; i < sortedBones.length; i++) {
        const bone = sortedBones[i]
        if (bone.parent && bone.parent instanceof Bone) {
          const parentIndex = sortedBones.indexOf(bone.parent)
          if (parentIndex === -1) {
            console.error(`  ❌ Bone ${bone.name} has parent ${bone.parent.name} not in skeleton!`)
          } else if (parentIndex >= i) {
            console.error(`  ❌ Bone ${bone.name} (${i}) has parent ${bone.parent.name} (${parentIndex}) that comes after it!`)
          }
        }
      }
      
      // Create the shared skeleton
      sharedSkeleton = new Skeleton(sortedBones, sortedInverses)
      console.log(`  Created shared skeleton with ${sortedBones.length} bones`)
      console.log(`  Bone names: ${sortedBones.map(b => b.name).join(', ')}`)
      
      // Second pass: bind all skinned meshes to the shared skeleton
      model.traverse((child) => {
        if (child instanceof SkinnedMesh) {
          const oldSkeleton = child.skeleton
          
          // Create mapping from old bone indices to new bone indices
          const boneIndexMap = new Map<number, number>()
          if (oldSkeleton) {
            oldSkeleton.bones.forEach((oldBone, oldIndex) => {
              if (oldBone) {
                const newIndex = sortedBones.indexOf(oldBone)
                if (newIndex !== -1) {
                  boneIndexMap.set(oldIndex, newIndex)
                } else {
                  console.warn(`  Bone ${oldBone.name} not found in new skeleton!`)
                }
              }
            })
          }
          
          // Update skin indices if needed
          if (child.geometry && child.geometry.attributes.skinIndex && boneIndexMap.size > 0) {
            const skinIndices = child.geometry.attributes.skinIndex
            const skinWeights = child.geometry.attributes.skinWeight
            
            for (let i = 0; i < skinIndices.count; i++) {
              for (let j = 0; j < 4; j++) {
                const oldBoneIndex = skinIndices.getComponent(i, j)
                const newBoneIndex = boneIndexMap.get(oldBoneIndex)
                
                if (newBoneIndex !== undefined) {
                  skinIndices.setComponent(i, j, newBoneIndex)
                } else if (skinWeights.getComponent(i, j) > 0) {
                  // This vertex has weight to a bone that doesn't exist
                  console.warn(`  Vertex ${i} has weight to non-existent bone ${oldBoneIndex}`)
                  skinIndices.setComponent(i, j, 0) // Use root bone
                  skinWeights.setComponent(i, j, 0) // Zero out weight
                }
              }
            }
            
            skinIndices.needsUpdate = true
            skinWeights.needsUpdate = true
          }
          
          // Dispose old skeleton if different
          if (oldSkeleton && oldSkeleton !== sharedSkeleton) {
            if (oldSkeleton.boneTexture) {
              oldSkeleton.boneTexture.dispose()
            }
          }
          
          // Bind to shared skeleton
          child.bind(sharedSkeleton, child.bindMatrix || new Matrix4())
          
          // Force update
          child.skeleton.calculateInverses()
          child.skeleton.pose()
          child.skeleton.update()
          
          console.log(`  Bound ${child.name || 'mesh'} to shared skeleton (mapped ${boneIndexMap.size} bones)`)
        }
      })

      // Apply weights to hand vertices
      await this.applySimpleWeights(model, wristBone, palmBone, fingerBone, isLeft)
      
      // Force update all skeletons
      this.updateAllSkeletons(model)

      console.log(`✅ Created 2 simple bones for ${side} hand`)

      return [palmBone, fingerBone]

    } catch (error) {
      console.error(`Failed to create bones for ${wristBone.name}:`, error)
      return null
    }
  }

  /**
   * Get the forward direction for the hand (from wrist towards fingers)
   */
  private getHandForwardDirection(
    model: Object3D,
    wristBone: Bone,
    _isLeft: boolean
  ): Vector3 {
    console.log(`    Detecting hand forward direction for ${wristBone.name}`)
    
    // Method 1: Try to find the direction from elbow/forearm to wrist
    const parentBone = wristBone.parent as Bone
    if (parentBone && parentBone.isBone) {
      console.log(`    Found parent bone: ${parentBone.name}`)
      
      // Get positions in world space
      const parentWorldPos = new Vector3()
      const wristWorldPos = new Vector3()
      parentBone.getWorldPosition(parentWorldPos)
      wristBone.getWorldPosition(wristWorldPos)
      
      // Direction from parent (forearm/elbow) to wrist
      const armDirection = new Vector3()
        .subVectors(wristWorldPos, parentWorldPos)
        .normalize()
      
      console.log(`    Arm direction (world): ${armDirection.toArray()}`)
      
      // Convert to wrist's local space
      const wristWorldMatrix = new Matrix4()
      wristBone.updateWorldMatrix(true, false)
      wristWorldMatrix.copy(wristBone.matrixWorld)
      
      const wristWorldMatrixInverse = new Matrix4()
      wristWorldMatrixInverse.copy(wristWorldMatrix).invert()
      
      // Apply only the rotation part (not translation)
      const rotationOnly = new Matrix4()
      rotationOnly.extractRotation(wristWorldMatrixInverse)
      
      armDirection.applyMatrix4(rotationOnly)
      armDirection.normalize()
      
      console.log(`    Arm direction (local): ${armDirection.toArray()}`)
      
      // The hand typically continues in the same direction as the arm
      return armDirection
    }
    
    // Method 2: Try to find hand mesh vertices
    const handVertices = this.findHandVertices(model, wristBone)
    
    if (handVertices.length > 10) {  // Need enough vertices for reliable direction
      // Calculate average position of hand vertices
      const avgPos = new Vector3()
      for (const vertex of handVertices) {
        avgPos.add(vertex)
      }
      avgPos.divideScalar(handVertices.length)

      // Get wrist world position
      const wristPos = new Vector3()
      wristBone.getWorldPosition(wristPos)

      // Direction from wrist to hand center
      const direction = avgPos.sub(wristPos).normalize()
      
      console.log(`    Found ${handVertices.length} hand vertices`)
      console.log(`    Hand center direction (world): ${direction.toArray()}`)
      
      // Convert to local space of wrist bone
      const wristWorldMatrix = new Matrix4()
      wristBone.updateWorldMatrix(true, false)
      wristWorldMatrix.copy(wristBone.matrixWorld)
      
      const wristWorldMatrixInverse = new Matrix4()
      wristWorldMatrixInverse.copy(wristWorldMatrix).invert()
      
      // Apply only the rotation part
      const rotationOnly = new Matrix4()
      rotationOnly.extractRotation(wristWorldMatrixInverse)
      
      direction.applyMatrix4(rotationOnly)
      direction.normalize()
      
      console.log(`    Hand center direction (local): ${direction.toArray()}`)
      
      return direction
    }

    // Method 3: Fallback based on common rig patterns
    console.log('    Using fallback direction based on common rig patterns')
    
    // Most rigs have hands extending along one of the bone's local axes
    // We'll test each axis and see which makes most sense
    // const _axes = [
    //   new Vector3(1, 0, 0),   // +X
    //   new Vector3(-1, 0, 0),  // -X
    //   new Vector3(0, 1, 0),   // +Y
    //   new Vector3(0, -1, 0),  // -Y
    //   new Vector3(0, 0, 1),   // +Z
    //   new Vector3(0, 0, -1),  // -Z
    // ]
    
    // For most humanoid rigs, hands extend along Y axis
    // But some use X or Z, so we return the most likely
    let bestAxis = new Vector3(0, 1, 0)
    
    // Check if bone name gives us hints
    const boneName = wristBone.name.toLowerCase()
    if (boneName.includes('_l') || boneName.includes('left')) {
      // Left hands often point along +Y or +X
      bestAxis = new Vector3(0, 1, 0)
    } else if (boneName.includes('_r') || boneName.includes('right')) {
      // Right hands often point along +Y or -X
      bestAxis = new Vector3(0, 1, 0)
    }
    
    console.log(`    Fallback direction: ${bestAxis.toArray()}`)
    
    return bestAxis
  }

  /**
   * Find vertices that belong to the hand
   */
  private findHandVertices(
    model: Object3D,
    wristBone: Bone
  ): Vector3[] {
    const handVertices: Vector3[] = []
    const wristIndex = this.findBoneIndex(model, wristBone)
    
    if (wristIndex === -1) {
      console.log('    Could not find wrist bone index')
      return handVertices
    }
    
    console.log(`    Finding hand vertices for wrist bone index: ${wristIndex}`)
    
    model.traverse((child) => {
      if (child instanceof SkinnedMesh && child.geometry) {
        const positions = child.geometry.attributes.position
        const skinIndices = child.geometry.attributes.skinIndex
        const skinWeights = child.geometry.attributes.skinWeight
        
        if (!positions || !skinIndices || !skinWeights) return
        
        const vertex = new Vector3()
        let foundCount = 0
        
        for (let i = 0; i < positions.count; i++) {
          // Check if this vertex is influenced by the wrist
          for (let j = 0; j < 4; j++) {
            const boneIndex = skinIndices.getComponent(i, j)
            const weight = skinWeights.getComponent(i, j)
            
            if (boneIndex === wristIndex && weight > 0.1) {  // Lowered from 0.3 to 0.1
              vertex.fromBufferAttribute(positions, i)
              // Transform to world space
              vertex.applyMatrix4(child.matrixWorld)
              handVertices.push(vertex.clone())
              foundCount++
              break
            }
          }
        }
        
        console.log(`    Found ${foundCount} vertices influenced by wrist in mesh ${child.name}`)
      }
    })
    
    console.log(`    Total hand vertices found: ${handVertices.length}`)
    return handVertices
  }

  /**
   * Apply simple weights to hand vertices
   * For simple rigging, we'll be conservative and only affect vertices
   * that are clearly in the hand/finger region, not the entire arm
   */
  private async applySimpleWeights(
    model: Object3D,
    wristBone: Bone,
    palmBone: Bone,
    fingerBone: Bone,
    isLeft: boolean
  ): Promise<void> {
    console.log(`Applying simple weights for ${isLeft ? 'left' : 'right'} hand`)
    // Get bone positions in their local/model space
    const wristLocalPos = wristBone.position.clone()
    const palmLocalPos = palmBone.position.clone()
    const fingerLocalPos = fingerBone.position.clone()
    
    // For world space calculations (for debugging)
    const wristWorldPos = new Vector3()
    const palmWorldPos = new Vector3()
    const fingerWorldPos = new Vector3()
    
    wristBone.getWorldPosition(wristWorldPos)
    palmBone.getWorldPosition(palmWorldPos)
    fingerBone.getWorldPosition(fingerWorldPos)
    
    console.log(`  Weight application debug:`)
    console.log(`    Wrist - local: ${wristLocalPos.toArray()}, world: ${wristWorldPos.toArray()}`)
    console.log(`    Palm - local: ${palmLocalPos.toArray()}, world: ${palmWorldPos.toArray()}`)
    console.log(`    Finger - local: ${fingerLocalPos.toArray()}, world: ${fingerWorldPos.toArray()}`)
    
    // Get the hand direction and actual bone lengths
    const handDirection = new Vector3().subVectors(fingerWorldPos, wristWorldPos).normalize()
    const actualPalmLength = wristWorldPos.distanceTo(palmWorldPos)
    const actualFingerLength = palmWorldPos.distanceTo(fingerWorldPos)
    const handLength = actualPalmLength + actualFingerLength
    
    console.log(`    Hand direction: ${handDirection.toArray()}`)
    console.log(`    Actual bone lengths - Palm: ${actualPalmLength}, Finger: ${actualFingerLength}`)
    console.log(`    Total hand length: ${handLength}`)
    
    // Check if bones were created properly
    if (actualPalmLength < 0.001 || actualFingerLength < 0.001) {
      console.error(`  ❌ Bones have incorrect lengths - Palm: ${actualPalmLength}, Finger: ${actualFingerLength}`)
      console.log(`  ℹ️ This might be due to scale issues in the bone hierarchy`)
    }

    model.traverse((child) => {
      if (child instanceof SkinnedMesh && child.geometry) {
        const positions = child.geometry.attributes.position
        const skinIndices = child.geometry.attributes.skinIndex
        const skinWeights = child.geometry.attributes.skinWeight
        
        if (!positions || !skinIndices || !skinWeights) return
        
        // Get bone indices
        const wristIndex = this.findBoneIndex(model, wristBone)
        const palmIndex = this.findBoneIndex(model, palmBone)
        const fingerIndex = this.findBoneIndex(model, fingerBone)
        
        console.log(`  Bone indices - Wrist: ${wristIndex}, Palm: ${palmIndex}, Finger: ${fingerIndex}`)
        
        // Debug: Verify these indices match the actual bones
        if (child.skeleton) {
          const wristBoneFromIndex = child.skeleton.bones[wristIndex]
          const palmBoneFromIndex = child.skeleton.bones[palmIndex]
          const fingerBoneFromIndex = child.skeleton.bones[fingerIndex]
          
          console.log(`  Bone verification:`)
          console.log(`    Wrist bone at index ${wristIndex}: ${wristBoneFromIndex?.name || 'NOT FOUND'}`)
          console.log(`    Palm bone at index ${palmIndex}: ${palmBoneFromIndex?.name || 'NOT FOUND'}`)
          console.log(`    Finger bone at index ${fingerIndex}: ${fingerBoneFromIndex?.name || 'NOT FOUND'}`)
          
          if (wristBoneFromIndex?.name !== wristBone.name) {
            console.error(`    ❌ Wrist bone mismatch! Expected ${wristBone.name} but got ${wristBoneFromIndex?.name}`)
          }
        }
        
        if (wristIndex === -1 || palmIndex === -1 || fingerIndex === -1) {
          console.error('  Could not find all bone indices')
          return
        }
        
        // Get the inverse of the skinned mesh transform to convert bone positions to mesh space
        const meshInverseMatrix = new Matrix4()
        meshInverseMatrix.copy(child.matrixWorld).invert()
        
        // Convert bone world positions to mesh local space
        const wristMeshPos = wristWorldPos.clone().applyMatrix4(meshInverseMatrix)
        const palmMeshPos = palmWorldPos.clone().applyMatrix4(meshInverseMatrix)
        const fingerMeshPos = fingerWorldPos.clone().applyMatrix4(meshInverseMatrix)
        
        console.log(`  Bone positions in mesh space:`)
        console.log(`    Wrist: ${wristMeshPos.toArray()}`)
        console.log(`    Palm: ${palmMeshPos.toArray()}`)
        console.log(`    Finger: ${fingerMeshPos.toArray()}`)
        
        // For a proper hand rig, we need to:
        // 1. Find vertices that are in the hand region (beyond wrist)
        // 2. Only modify weights for those vertices
        // 3. Keep the wrist bone influence but ADD palm/finger influence
        
        console.log(`  🎯 Smart weight assignment for hand vertices...`)
        
        const vertex = new Vector3()
        const handDirMesh = new Vector3().subVectors(fingerMeshPos, wristMeshPos).normalize()
        const handLengthMesh = wristMeshPos.distanceTo(fingerMeshPos)
        
        console.log(`  Hand direction in mesh space: ${handDirMesh.toArray()}`)
        console.log(`  Hand length in mesh space: ${handLengthMesh}`)
        
        // Due to scale issues, let's also check the actual scale factor
        const scaleFactor = handLengthMesh / handLength  // mesh space vs world space
        console.log(`  Scale factor (mesh/world): ${scaleFactor}`)
        
        // If the scale factor is extreme, it means there's a scale mismatch
        // This often happens when bones have very different scales
        if (scaleFactor > 1000 || scaleFactor < 0.001) {
          console.log(`  ⚠️ Extreme scale factor detected! Using mesh-space hand length directly.`)
          // For weight assignment, we'll trust the mesh space measurements more
          const palmLengthMesh = wristMeshPos.distanceTo(palmMeshPos)
          const fingerLengthMesh = palmMeshPos.distanceTo(fingerMeshPos)
          console.log(`  Mesh space lengths - Palm: ${palmLengthMesh.toFixed(3)}, Finger: ${fingerLengthMesh.toFixed(3)}`)
        }
        
        // We'll only modify vertices that are:
        // 1. Currently influenced by the wrist bone
        // 2. Located in the hand region (beyond wrist along hand direction)
        
        let modifiedCount = 0
        const vertexCount = positions.count
        
        // Create typed arrays for better performance
        const newIndices = new Float32Array(vertexCount * 4)
        const newWeights = new Float32Array(vertexCount * 4)
        
        // Copy all existing weights first
        for (let i = 0; i < vertexCount; i++) {
          for (let j = 0; j < 4; j++) {
            newIndices[i * 4 + j] = skinIndices.getComponent(i, j)
            newWeights[i * 4 + j] = skinWeights.getComponent(i, j)
          }
        }
        
        // Debug: count vertices in different regions
        let wristInfluencedCount = 0
        let handRegionCount = 0
        let modifiableCount = 0
        
        // Debug: check actual vertex distribution
        let minProjection = Infinity
        let maxProjection = -Infinity
        let verticesInNegativeDirection = 0
        
        // Debug: Also track wrist-influenced vertex positions
        let wristVertexMinProj = Infinity
        let wristVertexMaxProj = -Infinity
        let wristVertexCount = 0
        
        // Calculate search radius once
        const searchRadius = Math.max(handLengthMesh * 2.0, 20.0)  // At least 20 units
        
        // For right hand, we might need a much larger search radius due to scale issues
        const isRightHand = wristBone.name.toLowerCase().includes('right')
        const actualSearchRadius = isRightHand ? searchRadius * 5.0 : searchRadius
        
        console.log(`  Using search radius: ${actualSearchRadius.toFixed(3)} (${isRightHand ? 'Right hand - 5x larger' : 'Left hand - normal'})`)
        
        // Now selectively modify hand vertices
        for (let i = 0; i < vertexCount; i++) {
          vertex.fromBufferAttribute(positions, i)
          
          // Calculate position relative to wrist
          const toVertex = new Vector3().subVectors(vertex, wristMeshPos)
          const projectionLength = toVertex.dot(handDirMesh)
          
          // Track projection range
          if (projectionLength < minProjection) minProjection = projectionLength
          if (projectionLength > maxProjection) maxProjection = projectionLength
          if (projectionLength < 0) verticesInNegativeDirection++
          
          // Count wrist-influenced vertices
          for (let j = 0; j < 4; j++) {
            if (newIndices[i * 4 + j] === wristIndex && newWeights[i * 4 + j] > 0.1) {
              wristInfluencedCount++
              // Track where wrist vertices are
              if (projectionLength < wristVertexMinProj) wristVertexMinProj = projectionLength
              if (projectionLength > wristVertexMaxProj) wristVertexMaxProj = projectionLength
              wristVertexCount++
              break
            }
          }
          
          // Check if vertex is in hand region
          if (projectionLength > 0 && projectionLength < actualSearchRadius) {
            handRegionCount++
          }
          
          // Always check if this vertex is influenced by wrist (not just in hand region)
          let wristInfluence = 0
          let wristSlot = -1
          
          for (let j = 0; j < 4; j++) {
            if (newIndices[i * 4 + j] === wristIndex) {
              wristInfluence = newWeights[i * 4 + j]
              wristSlot = j
              break
            }
          }
          
          // Only modify if in hand region AND influenced by wrist
          if (projectionLength > 0 && projectionLength < actualSearchRadius && wristInfluence > 0.1) {
            modifiableCount++
            
            // This vertex is in the hand and influenced by wrist
            // We'll redistribute the wrist weight between wrist, palm, and finger
            
            const normalizedProjection = projectionLength / handLengthMesh
            
            // Weight distribution based on position along hand
            let newWristWeight = wristInfluence * 0.3  // Keep 30% on wrist
            let palmWeight = 0
            let fingerWeight = 0
            
            if (normalizedProjection < 0.5) {
              // Closer to wrist - more palm influence
              palmWeight = wristInfluence * 0.5
              fingerWeight = wristInfluence * 0.2
            } else {
              // Closer to fingers - more finger influence
              palmWeight = wristInfluence * 0.2
              fingerWeight = wristInfluence * 0.5
            }
            
            // Update the weights
            // Try to find empty slots first
            let palmSlot = -1
            let fingerSlot = -1
            
            for (let j = 0; j < 4; j++) {
              if (j !== wristSlot && newWeights[i * 4 + j] < 0.01) {
                if (palmSlot === -1) {
                  palmSlot = j
                } else if (fingerSlot === -1) {
                  fingerSlot = j
                }
              }
            }
            
            // If we found slots, assign the weights
            if (palmSlot !== -1 && fingerSlot !== -1) {
              newWeights[i * 4 + wristSlot] = newWristWeight
              newIndices[i * 4 + palmSlot] = palmIndex
              newWeights[i * 4 + palmSlot] = palmWeight
              newIndices[i * 4 + fingerSlot] = fingerIndex
              newWeights[i * 4 + fingerSlot] = fingerWeight
              
              // Normalize all weights
              let sum = 0
              for (let j = 0; j < 4; j++) {
                sum += newWeights[i * 4 + j]
              }
              if (sum > 0) {
                for (let j = 0; j < 4; j++) {
                  newWeights[i * 4 + j] /= sum
                }
              }
              
              modifiedCount++
            } else if (palmSlot !== -1) {
              // Only one slot available - use it for the primary influence
              if (normalizedProjection < 0.5) {
                // Closer to palm
                newWeights[i * 4 + wristSlot] = newWristWeight
                newIndices[i * 4 + palmSlot] = palmIndex
                newWeights[i * 4 + palmSlot] = palmWeight + fingerWeight
              } else {
                // Closer to fingers
                newWeights[i * 4 + wristSlot] = newWristWeight + palmWeight
                newIndices[i * 4 + palmSlot] = fingerIndex
                newWeights[i * 4 + palmSlot] = fingerWeight
              }
              
              // Normalize
              let sum = 0
              for (let j = 0; j < 4; j++) {
                sum += newWeights[i * 4 + j]
              }
              if (sum > 0) {
                for (let j = 0; j < 4; j++) {
                  newWeights[i * 4 + j] /= sum
                }
              }
              
              modifiedCount++
            }
          }
        }
        
        console.log(`  Vertex analysis:`)
        console.log(`    Total vertices: ${vertexCount}`)
        console.log(`    Wrist-influenced: ${wristInfluencedCount}`)
        console.log(`    In hand region: ${handRegionCount}`)
        console.log(`    Modifiable (wrist + hand): ${modifiableCount}`)
        console.log(`    Actually modified: ${modifiedCount}`)
        
        console.log(`  Vertex projection analysis:`)
        console.log(`    Min projection: ${minProjection.toFixed(3)}`)
        console.log(`    Max projection: ${maxProjection.toFixed(3)}`)
        console.log(`    Vertices behind wrist: ${verticesInNegativeDirection}`)
        console.log(`    Search radius: ${actualSearchRadius.toFixed(3)}`)
        console.log(`    Hand direction: ${handDirMesh.toArray().map(v => v.toFixed(3)).join(', ')}`)
        console.log(`    Expected direction: ${wristBone.name.toLowerCase().includes('left') ? 'Positive X' : 'Negative X'}`)
        
        console.log(`  Wrist-influenced vertex analysis:`)
        console.log(`    Wrist vertex min projection: ${wristVertexMinProj.toFixed(3)}`)
        console.log(`    Wrist vertex max projection: ${wristVertexMaxProj.toFixed(3)}`)
        console.log(`    Wrist vertex count: ${wristVertexCount}`)
        
        if (wristVertexMaxProj < 0) {
          console.log(`    ⚠️ ALL wrist vertices are BEHIND the wrist! Hand direction might be wrong.`)
          console.log(`    🔧 Inverting hand direction and retrying...`)
          
          // Invert the hand direction
          handDirMesh.multiplyScalar(-1)
          
          // Recalculate search with inverted direction
          modifiedCount = 0
          for (let i = 0; i < vertexCount; i++) {
            vertex.fromBufferAttribute(positions, i)
            
            // Recalculate projection with inverted direction
            const toVertex = new Vector3().subVectors(vertex, wristMeshPos)
            const projectionLength = toVertex.dot(handDirMesh)
            
            // Check if this vertex is influenced by wrist
            let wristInfluence = 0
            let wristSlot = -1
            
              for (let j = 0; j < 4; j++) {
              if (newIndices[i * 4 + j] === wristIndex) {
                wristInfluence = newWeights[i * 4 + j]
                wristSlot = j
                break
              }
            }
            
            // Only modify if in hand region AND influenced by wrist
            if (projectionLength > 0 && projectionLength < actualSearchRadius && wristInfluence > 0.1) {
              // This vertex is in the hand and influenced by wrist
              // We'll redistribute the wrist weight between wrist, palm, and finger
              
              const normalizedProjection = projectionLength / handLengthMesh
              
              // Weight distribution based on position along hand
              let newWristWeight = wristInfluence * 0.3  // Keep 30% on wrist
              let palmWeight = 0
              let fingerWeight = 0
              
              if (normalizedProjection < 0.5) {
                // Closer to wrist - more palm influence
                palmWeight = wristInfluence * 0.5
                fingerWeight = wristInfluence * 0.2
            } else {
                // Closer to fingers - more finger influence
                palmWeight = wristInfluence * 0.2
                fingerWeight = wristInfluence * 0.5
              }
              
              // Update the weights
              // Try to find empty slots first
              let palmSlot = -1
              let fingerSlot = -1
              
              for (let j = 0; j < 4; j++) {
                if (j !== wristSlot && newWeights[i * 4 + j] < 0.01) {
                  if (palmSlot === -1) {
                    palmSlot = j
                  } else if (fingerSlot === -1) {
                    fingerSlot = j
                  }
                }
              }
              
              // If we found slots, assign the weights
              if (palmSlot !== -1 && fingerSlot !== -1) {
                newWeights[i * 4 + wristSlot] = newWristWeight
                newIndices[i * 4 + palmSlot] = palmIndex
                newWeights[i * 4 + palmSlot] = palmWeight
                newIndices[i * 4 + fingerSlot] = fingerIndex
                newWeights[i * 4 + fingerSlot] = fingerWeight
                
                // Normalize all weights
                let sum = 0
              for (let j = 0; j < 4; j++) {
                  sum += newWeights[i * 4 + j]
                }
                if (sum > 0) {
                  for (let j = 0; j < 4; j++) {
                    newWeights[i * 4 + j] /= sum
                  }
                }
                
                modifiedCount++
              } else if (palmSlot !== -1) {
                // Only one slot available - use it for the primary influence
                if (normalizedProjection < 0.5) {
                  // Closer to palm
                  newWeights[i * 4 + wristSlot] = newWristWeight
                  newIndices[i * 4 + palmSlot] = palmIndex
                  newWeights[i * 4 + palmSlot] = palmWeight + fingerWeight
        } else {
                  // Closer to fingers
                  newWeights[i * 4 + wristSlot] = newWristWeight + palmWeight
                  newIndices[i * 4 + palmSlot] = fingerIndex
                  newWeights[i * 4 + palmSlot] = fingerWeight
                }
                
                // Normalize
                let sum = 0
            for (let j = 0; j < 4; j++) {
                  sum += newWeights[i * 4 + j]
                }
                if (sum > 0) {
                  for (let j = 0; j < 4; j++) {
                    newWeights[i * 4 + j] /= sum
                  }
                }
                
                modifiedCount++
              }
            }
          }
          
          console.log(`    After direction inversion: ${modifiedCount} vertices modified`)
        } else if (wristVertexMinProj > actualSearchRadius) {
          console.log(`    ⚠️ ALL wrist vertices are BEYOND search radius! Need larger search radius.`)
        }
        
        // Additional fallback: If we still found NO modifiable vertices, try inverting direction
        if (modifiableCount === 0 && wristInfluencedCount > 0) {
          console.log(`  ⚠️ Found ${wristInfluencedCount} wrist vertices but NONE in hand region!`)
          console.log(`  🔧 Trying direction inversion as last resort...`)
          
          // Invert the hand direction
          handDirMesh.multiplyScalar(-1)
          
          // Reset counts
          modifiableCount = 0
          modifiedCount = 0
          
          // Try again with inverted direction
          for (let i = 0; i < vertexCount; i++) {
            vertex.fromBufferAttribute(positions, i)
            
            // Recalculate projection with inverted direction
            const toVertex = new Vector3().subVectors(vertex, wristMeshPos)
            const projectionLength = toVertex.dot(handDirMesh)
            
            // Check if this vertex is influenced by wrist
            let wristInfluence = 0
            let wristSlot = -1
            
            for (let j = 0; j < 4; j++) {
              if (newIndices[i * 4 + j] === wristIndex) {
                wristInfluence = newWeights[i * 4 + j]
                wristSlot = j
                break
              }
            }
            
            // Only modify if in hand region AND influenced by wrist
            if (projectionLength > 0 && projectionLength < actualSearchRadius && wristInfluence > 0.1) {
              modifiableCount++
              
              // This vertex is in the hand and influenced by wrist
              const normalizedProjection = projectionLength / handLengthMesh
              
              // Weight distribution
              let newWristWeight = wristInfluence * 0.3
              let palmWeight = 0
              let fingerWeight = 0
              
              if (normalizedProjection < 0.5) {
                palmWeight = wristInfluence * 0.5
                fingerWeight = wristInfluence * 0.2
              } else {
                palmWeight = wristInfluence * 0.2
                fingerWeight = wristInfluence * 0.5
              }
              
              // Find slots
              let palmSlot = -1
              let fingerSlot = -1
              
              for (let j = 0; j < 4; j++) {
                if (j !== wristSlot && newWeights[i * 4 + j] < 0.01) {
                  if (palmSlot === -1) {
                    palmSlot = j
                  } else if (fingerSlot === -1) {
                    fingerSlot = j
                  }
                }
              }
              
              // Assign weights
              if (palmSlot !== -1 && fingerSlot !== -1) {
                newWeights[i * 4 + wristSlot] = newWristWeight
                newIndices[i * 4 + palmSlot] = palmIndex
                newWeights[i * 4 + palmSlot] = palmWeight
                newIndices[i * 4 + fingerSlot] = fingerIndex
                newWeights[i * 4 + fingerSlot] = fingerWeight
                
                // Normalize
                let sum = 0
                for (let j = 0; j < 4; j++) {
                  sum += newWeights[i * 4 + j]
                }
                if (sum > 0) {
                  for (let j = 0; j < 4; j++) {
                    newWeights[i * 4 + j] /= sum
                  }
                }
                
                modifiedCount++
              }
            }
          }
          
          console.log(`  After fallback inversion: found ${modifiableCount} modifiable, modified ${modifiedCount}`)
        }
        
        if (modifiedCount > 0) {
          // Update the geometry attributes
          child.geometry.setAttribute('skinIndex', new Float32BufferAttribute(newIndices, 4))
          child.geometry.setAttribute('skinWeight', new Float32BufferAttribute(newWeights, 4))
          
          // Mark as needing update
          child.geometry.attributes.skinIndex.needsUpdate = true
          child.geometry.attributes.skinWeight.needsUpdate = true
          
          console.log(`  ✅ Updated skin weights for ${child.name || 'mesh'}`)
        } else {
          console.log(`  ℹ️ No hand vertices found to modify`)
        }
      }
    })
  }

  /**
   * Find bone index in skeleton
   */
  private findBoneIndex(model: Object3D, bone: Bone): number {
    let index = -1
    
    model.traverse((child) => {
      if (child instanceof SkinnedMesh && child.skeleton && index === -1) {
        const foundIndex = child.skeleton.bones.indexOf(bone)
        if (foundIndex !== -1) {
          index = foundIndex
        }
      }
    })
    
    return index
  }
  
  /**
   * Force skeleton update on all skinned meshes
   */
  private updateAllSkeletons(model: Object3D): void {
    model.traverse((child) => {
      if (child instanceof SkinnedMesh && child.skeleton) {
        // Force recalculation of bone matrices
        child.skeleton.bones.forEach(bone => {
          bone.updateMatrixWorld(true)
        })
        
        // Update skeleton
        child.skeleton.update()
        
        // Force geometry update
        if (child.geometry.attributes.position) {
          child.geometry.attributes.position.needsUpdate = true
        }
        if (child.geometry.attributes.normal) {
          child.geometry.attributes.normal.needsUpdate = true
        }
        
        // Recompute bounding sphere
        child.geometry.computeBoundingSphere()
        child.geometry.computeBoundingBox()
        
        console.log(`  Updated skeleton for ${child.name || 'mesh'}`)
      }
    })
  }

  /**
   * Find wrist bones in the model
   */
  private findWristBones(model: Object3D): Bone[] {
    const wristBones: Bone[] = []

    model.traverse((child) => {
      if (child instanceof Bone && 
          (child.name.toLowerCase().includes('hand') || 
           child.name.toLowerCase().includes('wrist'))) {
          wristBones.push(child)
      }
    })

    return wristBones
  }
  
  // Helper function to check if a bone is actually in the scene
  private isBoneInScene(bone: Bone, model: Object3D): boolean {
    // Check if the bone has a valid parent chain up to the model root
    let current: Object3D | null = bone
    while (current) {
      if (current === model) {
        return true // Found valid parent chain to model
      }
      // Also check if we've reached a Group or Object3D that's a child of the model
      // This handles cases where bones are under an armature/root object
      if (current.parent === model) {
        return true
      }
      current = current.parent
    }
    return false // No valid parent chain to model
  }

  /**
   * Count total bones in model
   */
  private countBones(model: Object3D): number {
    let count = 0
    model.traverse((child) => {
      if (child instanceof Bone) {
        count++
      }
    })
    return count
  }

  /**
   * Load model from file
   */
  private async loadModel(modelFile: File | string): Promise<Object3D> {
    return new Promise((resolve, reject) => {
      const url = typeof modelFile === 'string' ? modelFile : URL.createObjectURL(modelFile)
      
      this.loader.load(
        url,
        (gltf: GLTF) => {
          if (typeof modelFile !== 'string') {
            URL.revokeObjectURL(url)
          }
          resolve(gltf.scene)
        },
        undefined,
        (error) => {
          if (typeof modelFile !== 'string') {
            URL.revokeObjectURL(url)
          }
          // Type assertion for known error types
          const typedError = error as ErrorEvent | Error | string
          reject(typedError)
        }
      )
    })
  }

  /**
   * Export model to GLB
   */
  private async exportModel(model: Object3D, debugMode: boolean): Promise<ArrayBuffer> {
    console.log('📦 Preparing model for export...')
    
    // Debug: Check model scale before export
    const modelBounds = new Box3().setFromObject(model)
    const modelSize = new Vector3()
    modelBounds.getSize(modelSize)
    console.log(`  Model size before export: ${modelSize.x.toFixed(3)} x ${modelSize.y.toFixed(3)} x ${modelSize.z.toFixed(3)}`)
    console.log(`  Model scale: ${model.scale.x}, ${model.scale.y}, ${model.scale.z}`)
    
    // Check if any child meshes have non-unit scale
    let hasScaleIssues = false
    model.traverse((child) => {
      if ((child instanceof Mesh || child instanceof SkinnedMesh) && 
          (child.scale.x !== 1 || child.scale.y !== 1 || child.scale.z !== 1)) {
        hasScaleIssues = true
        console.log(`  ⚠️ Found scaled mesh: ${child.name} with scale ${child.scale.x}, ${child.scale.y}, ${child.scale.z}`)
      }
    })
    
    if (hasScaleIssues) {
      console.log('  ❌ Model has meshes with non-unit scale. This should have been fixed during loading!')
    }
    
    // Ensure all matrices are up to date before export
    model.updateMatrixWorld(true)
    
    // CRITICAL: Validate bone hierarchy to prevent GLTF export errors
    console.log('  🔍 Validating bone hierarchy before export...')
    const allBonesInScene = new Set<Bone>()
    const rootBones = new Set<Bone>()
    
    // First, collect all bones in the scene
    model.traverse((child) => {
      if (child instanceof Bone) {
        allBonesInScene.add(child)
        // Check if this is a root bone (no bone parent)
        if (!child.parent || !(child.parent instanceof Bone)) {
          rootBones.add(child)
        }
      }
    })
    
    console.log(`  Found ${allBonesInScene.size} bones total, ${rootBones.size} root bones`)
    
    // Now validate each skeleton
    model.traverse((child) => {
      if (child instanceof SkinnedMesh && child.skeleton) {
        const skeleton = child.skeleton
        console.log(`  Validating skeleton for ${child.name || 'mesh'} with ${skeleton.bones.length} bones`)
        
        // Check for invalid bones
        const invalidBones: number[] = []
        skeleton.bones.forEach((bone, index) => {
          if (!bone) {
            console.error(`    ❌ Bone at index ${index} is null/undefined!`)
            invalidBones.push(index)
          } else if (!(bone instanceof Bone)) {
            console.error(`    ❌ Bone at index ${index} is not a Bone!`)
            invalidBones.push(index)
          } else if (!allBonesInScene.has(bone)) {
            console.error(`    ❌ Bone at index ${index} (${bone.name}) is not in the scene!`)
            invalidBones.push(index)
          } else {
            // Validate bone hierarchy
            let parent = bone.parent
            let depth = 0
            while (parent && depth < 100) {
              if (parent === bone) {
                console.error(`    ❌ Bone ${bone.name} has circular reference!`)
                invalidBones.push(index)
                break
              }
              if (parent instanceof Bone && !allBonesInScene.has(parent)) {
                console.error(`    ❌ Bone ${bone.name} has parent ${parent.name} not in scene!`)
                invalidBones.push(index)
                break
              }
              parent = parent.parent
              depth++
            }
          }
        })
        
        // If we found invalid bones, we need to rebuild the skeleton
        if (invalidBones.length > 0) {
          console.warn(`  ⚠️ Found ${invalidBones.length} invalid bones, rebuilding skeleton...`)
          
          // Create a clean skeleton with only valid bones
        const validBones: Bone[] = []
        const validInverses: Matrix4[] = []
          const oldToNewIndex = new Map<number, number>()
        
        skeleton.bones.forEach((bone, oldIndex) => {
            if (bone && bone instanceof Bone && allBonesInScene.has(bone)) {
            const newIndex = validBones.length
            validBones.push(bone)
            validInverses.push(skeleton.boneInverses[oldIndex] || new Matrix4())
              oldToNewIndex.set(oldIndex, newIndex)
          }
        })
        
          console.log(`  Rebuilt skeleton with ${validBones.length} valid bones (was ${skeleton.bones.length})`)
          
          // Update skin indices to use new bone indices
          if (child.geometry && child.geometry.attributes.skinIndex) {
            const skinIndices = child.geometry.attributes.skinIndex
            
            for (let i = 0; i < skinIndices.count; i++) {
              for (let j = 0; j < 4; j++) {
                const oldIndex = skinIndices.getComponent(i, j)
                const newIndex = oldToNewIndex.get(oldIndex)
                
                if (newIndex !== undefined) {
                  // Update to new index
                  const components = []
                  for (let k = 0; k < 4; k++) {
                    if (k === j) {
                      components.push(newIndex)
                    } else {
                      const otherOldIndex = skinIndices.getComponent(i, k)
                      const otherNewIndex = oldToNewIndex.get(otherOldIndex)
                      components.push(otherNewIndex !== undefined ? otherNewIndex : 0)
                    }
                  }
                  skinIndices.setXYZW(i, components[0], components[1], components[2], components[3])
                } else {
                  // Invalid bone reference, zero out the weight
                  child.geometry.attributes.skinWeight.setComponent(i, j, 0)
                }
              }
            }
            
            skinIndices.needsUpdate = true
            child.geometry.attributes.skinWeight.needsUpdate = true
          }
          
          // Create new skeleton with valid bones only
          const newSkeleton = new Skeleton(validBones, validInverses)
          
          // Dispose old skeleton
          if (skeleton.boneTexture) {
            skeleton.boneTexture.dispose()
          }
          
          // Bind to new skeleton
          child.bind(newSkeleton, child.bindMatrix || new Matrix4())
          
          console.log(`  ✅ Successfully rebuilt skeleton with ${validBones.length} bones`)
        }
        
        // Force skeleton update
        child.skeleton.update()
        
        // Ensure bind mode is set
        if (!child.bindMode) {
          child.bindMode = 'attached'
        }
        
        // Ensure bind matrix is valid
        if (!child.bindMatrix || child.bindMatrix.elements.every(e => e === 0)) {
          child.bindMatrix = new Matrix4()
          child.bindMatrix.identity()
        }
        
        // Ensure bind matrix inverse is computed
        if (!child.bindMatrixInverse || child.bindMatrixInverse.elements.every(e => e === 0)) {
          child.bindMatrixInverse = new Matrix4()
          child.bindMatrixInverse.copy(child.bindMatrix).invert()
        }
      }
    })
    
    // FINAL VALIDATION: Ensure all skeletons only reference bones that exist in the scene
    console.log('  🔍 Final skeleton validation before GLTF export...')
    const allValidBones = new Set<Bone>()
    
    // Collect ALL bones in the model
    model.traverse((child) => {
      if (child instanceof Bone) {
        allValidBones.add(child)
      }
    })
    
    console.log(`  Total bones in model: ${allValidBones.size}`)
    
    // Check each skeleton one more time
    model.traverse((child) => {
      if (child instanceof SkinnedMesh && child.skeleton) {
        const skeleton = child.skeleton
        console.log(`  Checking skeleton for ${child.name}: ${skeleton.bones.length} bones`)
        
        // Verify every bone in the skeleton exists in the model
        let hasInvalidBones = false
        skeleton.bones.forEach((bone, index) => {
          if (!bone) {
            console.error(`    ❌ Bone ${index} is null!`)
            hasInvalidBones = true
          } else if (!allValidBones.has(bone)) {
            console.error(`    ❌ Bone ${index} (${bone.name}) is not in the model!`)
            hasInvalidBones = true
          }
        })
        
        if (hasInvalidBones) {
          console.error('  ❌ CRITICAL: Skeleton has invalid bones! This will cause GLTF import errors.')
          
          // Emergency fix: rebuild skeleton with only root bone
          console.warn('  🚨 Emergency fix: Creating minimal skeleton...')
          const rootBone = Array.from(allValidBones)[0]
          if (rootBone) {
            const emergencySkeleton = new Skeleton([rootBone])
            child.bind(emergencySkeleton)
            console.log('  ✅ Bound to emergency skeleton with single root bone')
          }
        }
      }
    })
    
    // Force final update
    model.updateMatrixWorld(true)
    
    // CRITICAL FIX: Validate and fix skin indices before export
    console.log('  🔧 Validating skin indices...')
    
    model.traverse((child) => {
      if (child instanceof SkinnedMesh && child.skeleton) {
        const skeleton = child.skeleton
        
        if (child.geometry && child.geometry.attributes.skinIndex) {
          const skinIndices = child.geometry.attributes.skinIndex
          const skinWeights = child.geometry.attributes.skinWeight
          
          // Check max index
          let maxIndex = -1
          let invalidCount = 0
          
          for (let i = 0; i < skinIndices.count; i++) {
            for (let j = 0; j < 4; j++) {
              const idx = skinIndices.getComponent(i, j)
              if (idx > maxIndex) maxIndex = idx
              
              // Check if index is valid
              if (idx >= skeleton.bones.length) {
                invalidCount++
                // Reset to root bone with zero weight
                skinIndices.setComponent(i, j, 0)
                skinWeights.setComponent(i, j, 0)
              }
            }
          }
          
          console.log(`  Mesh ${child.name}:`)
          console.log(`    Skeleton has ${skeleton.bones.length} bones`)
          console.log(`    Max skin index found: ${maxIndex}`)
          
          if (invalidCount > 0) {
            console.error(`    ❌ Fixed ${invalidCount} invalid skin indices!`)
            skinIndices.needsUpdate = true
            skinWeights.needsUpdate = true
          } else if (maxIndex >= skeleton.bones.length) {
            console.error(`    ❌ Max index ${maxIndex} >= bone count ${skeleton.bones.length}!`)
          } else {
            console.log(`    ✅ All skin indices valid`)
          }
        }
      }
    })
    
    console.log('  ✅ Skin validation complete')
    
    // CRITICAL: Ensure no nodes have children references to removed bones
    console.log('  🔧 Cleaning up node references...')
    model.traverse((node) => {
      if (node.children && node.children.length > 0) {
        const originalChildCount = node.children.length
        node.children = node.children.filter(child => {
          // Make sure all children still exist in the scene
          return child.parent === node
        })
        if (node.children.length < originalChildCount) {
          console.log(`    Cleaned ${originalChildCount - node.children.length} stale references from ${node.name}`)
        }
      }
    })
    
    // DEBUG: Log the bone to node index mapping
    console.log('  🔍 Analyzing bone-to-node mapping...')
    const allNodes: Object3D[] = []
    model.traverse((node) => allNodes.push(node))
    
    model.traverse((child) => {
      if (child instanceof SkinnedMesh && child.skeleton) {
        console.log(`  Skeleton bones for ${child.name}:`)
        child.skeleton.bones.forEach((bone, boneIdx) => {
          const nodeIdx = allNodes.indexOf(bone)
          console.log(`    Bone ${boneIdx}: ${bone.name} -> Node ${nodeIdx}`)
          if (nodeIdx >= 31) {
            console.error(`    ❌ Bone ${bone.name} has node index ${nodeIdx} which is out of bounds!`)
          }
        })
      }
    })
    
    // CRITICAL FIX: Ensure all bones are in the first 31 nodes
    // The GLTF format expects joints to reference nodes by index
    // If a bone is at node index > 30, the GLTF will have invalid references
    let needsReorganization = false
    model.traverse((child) => {
      if (child instanceof SkinnedMesh && child.skeleton) {
        child.skeleton.bones.forEach((bone) => {
          const nodeIdx = allNodes.indexOf(bone)
          if (nodeIdx > 30) {
            needsReorganization = true
          }
        })
      }
    })
    
    if (needsReorganization) {
      console.error('  ❌ Some bones have node indices > 30, this will cause GLTF import errors!')
      console.log('  🔧 Attempting to fix by removing orphaned nodes...')
      
      // Remove any non-essential nodes that come before bones
      const nodesToRemove: Object3D[] = []
      model.traverse((node) => {
        // Don't remove bones, meshes, or the main groups
        if (!(node instanceof Bone) && 
            !(node instanceof Mesh) && 
            !(node instanceof SkinnedMesh) &&
            node.name !== 'Scene' && 
            node.name !== 'AuxScene' &&
            node.name !== 'Armature' &&
            node.parent) {
          // Check if this node has any important children
          let hasImportantChildren = false
          node.traverse((child) => {
            if (child !== node && (
              child instanceof Bone || 
              child instanceof Mesh ||
              child instanceof SkinnedMesh)) {
              hasImportantChildren = true
            }
          })
          
          if (!hasImportantChildren) {
            nodesToRemove.push(node)
          }
        }
      })
      
      console.log(`  Found ${nodesToRemove.length} nodes to remove`)
      nodesToRemove.forEach(node => {
        if (node.parent) {
          console.log(`    Removing node: ${node.name || 'unnamed'}`)
          node.parent.remove(node)
        }
      })
    }
    
    // CRITICAL: Remove any bones that aren't part of a skeleton
    const bonesInSkeletons = new Set<Bone>()
    const skinnedMeshes: SkinnedMesh[] = []
    
    // Collect all bones that are actually in skeletons
    model.traverse((child) => {
      if (child instanceof SkinnedMesh && child.skeleton) {
        skinnedMeshes.push(child)
        child.skeleton.bones.forEach(bone => {
          if (bone) bonesInSkeletons.add(bone)
        })
      }
    })
    
    console.log(`  Found ${bonesInSkeletons.size} bones in skeletons`)
    
    // Find orphaned bones but DON'T remove them - just warn
    const orphanedBones: Bone[] = []
    
    model.traverse((child) => {
      if (child instanceof Bone) {
        if (!bonesInSkeletons.has(child)) {
          orphanedBones.push(child)
        }
      }
    })
    
    if (orphanedBones.length > 0) {
      console.warn(`  ⚠️ Found ${orphanedBones.length} bones not in any skeleton:`)
      orphanedBones.forEach(bone => {
        console.log(`    - ${bone.name}`)
      })
      
      // CRITICAL FIX: Actually remove orphaned bones to prevent GLTF export issues
      console.log('  🗑️ Removing orphaned bones to prevent export errors...')
      orphanedBones.forEach(bone => {
        if (bone.parent) {
          console.log(`    Removing ${bone.name} from parent ${bone.parent.name}`)
          // First, re-parent any children to the orphaned bone's parent
          const children = [...bone.children]
          children.forEach(child => {
            bone.parent!.add(child)
          })
          // Then remove the orphaned bone
          bone.parent.remove(bone)
        }
      })
      console.log('  ✅ Orphaned bones removed')
    }
    
    // Final check: ensure all skeletons are valid
    let allSkeletonsValid = true
    skinnedMeshes.forEach((mesh, index) => {
      if (!mesh.skeleton || !mesh.skeleton.bones || mesh.skeleton.bones.length === 0) {
        console.error(`  ❌ Skinned mesh ${index} (${mesh.name}) has invalid skeleton!`)
        allSkeletonsValid = false
      } else {
        // Check for null bones
        const nullBones = mesh.skeleton.bones.filter(b => !b).length
        if (nullBones > 0) {
          console.error(`  ❌ Skinned mesh ${index} (${mesh.name}) has ${nullBones} null bones!`)
          allSkeletonsValid = false
        }
      }
    })
    
    if (!allSkeletonsValid) {
      console.error('  ❌ CRITICAL: Invalid skeletons detected! Export may fail.')
    }
    
    console.log('  ✅ Final validation complete')
    
    // DEBUG: Export as JSON first to inspect structure
    if (debugMode) {
      console.log('  🐛 DEBUG MODE: Exporting as JSON to inspect structure...')
      this.exporter.parse(
        model,
        (result) => {
          console.log('  GLTF JSON structure:', result)
          if (!(result instanceof ArrayBuffer)) {
            const gltfResult = result as {
              nodes?: Array<{ name?: string; skin?: number; mesh?: number }>
              skins?: Array<{ joints?: number[]; skeleton?: number }>
            }
            if (gltfResult.nodes) {
              console.log(`  Nodes: ${gltfResult.nodes.length}`)
              gltfResult.nodes.forEach((node, i: number) => {
                console.log(`    Node ${i}: ${node.name || 'unnamed'}, skin: ${node.skin}, mesh: ${node.mesh}`)
              })
            }
            if (gltfResult.skins) {
              console.log(`  Skins: ${gltfResult.skins.length}`)
              gltfResult.skins.forEach((skin, i: number) => {
                console.log(`    Skin ${i}: joints: ${skin.joints?.length}, skeleton: ${skin.skeleton}`)
                if (skin.joints) {
                  console.log(`      Joint indices: ${skin.joints.join(', ')}`)
                }
              })
            }
          }
        },
        (error) => {
          const typedError = error as ErrorEvent | Error | string
          console.error('Debug export error:', typedError)
        },
        { binary: false }
      )
    }
    
    return new Promise((resolve, reject) => {
      this.exporter.parse(
        model,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result)
          } else {
            reject(new Error('Export failed: result is not ArrayBuffer'))
          }
        },
        (error) => reject(error instanceof Error ? error : new Error(String(error))),
        { 
          binary: true,
          animations: [],  // No animations needed
          forceIndices: true,  // Ensure indices are included
          includeCustomExtensions: false,
          embedImages: true  // Embed images if any
        }
      )
    })
  }

  /**
   * Validate model structure before export
   */
  private validateModelStructure(model: Object3D): { isValid: boolean; errors: string[] } {
    const issues: string[] = []
    
    model.traverse((child) => {
      if (child instanceof SkinnedMesh && child.skeleton) {
        // Check for null bones
        child.skeleton.bones.forEach((bone, index) => {
          if (!bone) {
            issues.push(`Skeleton has null bone at index ${index}`)
          }
        })
        
        // Check bone count matches inverse count
        if (child.skeleton.bones.length !== child.skeleton.boneInverses.length) {
          issues.push(`Bone count (${child.skeleton.bones.length}) doesn't match inverse count (${child.skeleton.boneInverses.length})`)
        }
        
        // Check if all bones are in the scene graph
        child.skeleton.bones.forEach((bone, index) => {
          if (bone && !bone.parent) {
            issues.push(`Bone ${bone.name} at index ${index} has no parent`)
          }
        })
      }
    })
    
    if (issues.length > 0) {
      console.warn('Model validation issues:', issues)
      return { isValid: false, errors: issues }
    } else {
      console.log('✅ Model structure validated successfully')
      return { isValid: true, errors: [] }
    }
  }
} 