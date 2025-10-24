import { Bone, Matrix4, Skeleton, SkinnedMesh, Vector3 } from 'three'

import { cloneGeometryForModification } from '../../utils/three-geometry-sharing'

/**
 * Fixes armature scale issues before export
 */
export class ArmorScaleFixer {
  /**
   * Check if a skeleton has non-uniform scale
   */
  static hasScaleIssues(skeleton: Skeleton): boolean {
    const rootBones = skeleton.bones.filter(b => !b.parent || !(b.parent instanceof Bone))
    
    for (const root of rootBones) {
      const worldScale = new Vector3()
      root.getWorldScale(worldScale)
      
      // Check if scale is not 1.0 (with tolerance)
      const tolerance = 0.001
      if (Math.abs(worldScale.x - 1) > tolerance ||
          Math.abs(worldScale.y - 1) > tolerance ||
          Math.abs(worldScale.z - 1) > tolerance) {
        console.warn(`Root bone "${root.name}" has world scale: ${worldScale.toArray()}`)
        return true
      }
    }
    
    return false
  }
  
  /**
   * Apply/bake the scale into bone positions
   */
  static applySkeletonScale(skinnedMesh: SkinnedMesh): SkinnedMesh {
    console.log('=== APPLYING SKELETON SCALE ===')
    
    const skeleton = skinnedMesh.skeleton
    const rootBones = skeleton.bones.filter(b => !b.parent || !(b.parent instanceof Bone))
    
    // Get the world scale from root
    const worldScale = new Vector3()
    if (rootBones.length > 0) {
      rootBones[0].getWorldScale(worldScale)
      console.log(`Current world scale: ${worldScale.toArray()}`)
    }
    
    // If scale is already 1, nothing to do
    if (Math.abs(worldScale.x - 1) < 0.001) {
      console.log('Scale is already normalized')
      return skinnedMesh
    }
    
    // Clone the mesh and skeleton
    const clonedMesh = skinnedMesh.clone()
    // Clone geometry for modification (applying skeleton scale)
    const clonedGeometry = cloneGeometryForModification(skinnedMesh.geometry, 'skeleton scale fix')
    clonedMesh.geometry = clonedGeometry
    
    // Create new bones with baked scale
    const newBones: Bone[] = []
    const boneMap = new Map<Bone, Bone>()
    
    // First pass: create bones with scaled positions
    skeleton.bones.forEach(oldBone => {
      const newBone = new Bone()
      newBone.name = oldBone.name
      
      // Get world position and convert back to local
      const worldPos = new Vector3()
      oldBone.getWorldPosition(worldPos)
      
      if (oldBone.parent && oldBone.parent instanceof Bone) {
        // Convert world position to local relative to parent
        const parentWorld = new Matrix4()
        oldBone.parent.updateMatrixWorld()
        parentWorld.copy(oldBone.parent.matrixWorld)
        
        const parentInverse = parentWorld.invert()
        worldPos.applyMatrix4(parentInverse)
      }
      
      newBone.position.copy(worldPos)
      newBone.quaternion.copy(oldBone.quaternion)
      newBone.scale.set(1, 1, 1) // Reset scale to 1
      
      newBones.push(newBone)
      boneMap.set(oldBone, newBone)
    })
    
    // Second pass: rebuild hierarchy
    skeleton.bones.forEach((oldBone, idx) => {
      const newBone = newBones[idx]
      if (oldBone.parent && oldBone.parent instanceof Bone) {
        const parentNewBone = boneMap.get(oldBone.parent)
        if (parentNewBone) {
          parentNewBone.add(newBone)
        }
      }
    })
    
    // Scale the geometry to match
    const positions = clonedGeometry.attributes.position
    const scale = worldScale.x // Assuming uniform scale
    
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(
        i,
        positions.getX(i) * scale,
        positions.getY(i) * scale,
        positions.getZ(i) * scale
      )
    }
    positions.needsUpdate = true
    
    // Update bounds
    clonedGeometry.computeBoundingBox()
    clonedGeometry.computeBoundingSphere()
    
    // Create new skeleton and bind
    const newSkeleton = new Skeleton(newBones)
    
    // Scale bind matrix
    const bindMatrix = skinnedMesh.bindMatrix.clone()
    const scaleMatrix = new Matrix4().makeScale(scale, scale, scale)
    bindMatrix.premultiply(scaleMatrix)
    
    clonedMesh.bind(newSkeleton, bindMatrix)
    
    console.log('Scale applied successfully')
    console.log(`Geometry scaled by: ${scale}`)
    console.log(`New bone distances should be ~${19.915 * scale} units`)
    
    return clonedMesh
  }
  
  /**
   * Alternative: Reset parent transforms
   * This removes any transforms from parent objects
   */
  static resetParentTransforms(skinnedMesh: SkinnedMesh): void {
    let parent = skinnedMesh.parent
    
    while (parent) {
      if (parent.scale.x !== 1 || parent.scale.y !== 1 || parent.scale.z !== 1) {
        console.warn(`Parent "${parent.name}" has scale: ${parent.scale.toArray()}`)
        
        // Apply the scale to children positions
        const scaleX = parent.scale.x
        parent.children.forEach(child => {
          child.position.multiplyScalar(scaleX)
        })
        
        // Reset parent scale
        parent.scale.set(1, 1, 1)
      }
      
      parent = parent.parent
    }
  }
}