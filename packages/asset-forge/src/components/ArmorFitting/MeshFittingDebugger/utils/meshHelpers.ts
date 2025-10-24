import {
  Bone, BufferGeometry, Material, Mesh, Object3D, Scene, Skeleton, SkinnedMesh,
  Vector3
} from 'three'

import { createLogger } from '@/utils/logger'

const logger = createLogger('MeshHelpers')

/**
 * Dispose of geometry and materials properly
 */
export function disposeMesh(mesh: Object3D) {
    mesh.traverse((child) => {
        if ('geometry' in child && child.geometry) {
            (child.geometry as BufferGeometry).dispose()
        }
        if ('material' in child && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach((m: Material) => m.dispose())
        }
    })
}

/**
 * Find meshes by userData properties
 */
export function findMeshesByUserData(
    scene: Scene,
    predicate: (userData: Record<string, unknown>) => boolean
): Object3D[] {
    const results: Object3D[] = []
    scene.traverse((child) => {
        if (predicate(child.userData)) {
            results.push(child)
        }
    })
    return results
}

/**
 * Remove objects from scene with cleanup
 */
export function removeObjectsFromScene(
//     scene: Scene,
    objects: Object3D[]
) {
    const uniqueObjects = Array.from(new Set(objects))
    uniqueObjects.forEach(obj => {
        logger.debug('Removing object', { name: obj.name || 'unnamed', type: obj.type })
        if (obj.parent) {
            obj.parent.remove(obj)
        }
        disposeMesh(obj)
    })
}

/**
 * Check if object contains any of the given refs
 */
export function containsRefs(
    object: Object3D,
    refs: (Object3D | null)[]
): boolean {
    let contains = false
    object.traverse((child) => {
        if (refs.includes(child)) {
            contains = true
        }
    })
    return contains
}

/**
 * Find bones by name patterns
 */
export function findBonesByPattern(
    skeleton: Skeleton,
    patterns: string[]
): Bone[] {
    return skeleton.bones.filter(bone => {
        const boneName = bone.name.toLowerCase()
        return patterns.some(pattern => boneName.includes(pattern))
    })
}

/**
 * Get bone world position safely
 */
export function getBoneWorldPosition(bone: Bone): Vector3 {
    bone.updateMatrixWorld(true)
    return bone.getWorldPosition(new Vector3())
}

/**
 * Find head bone from skeleton
 */
export function findHeadBone(skeleton: Skeleton): Bone | null {
    const headPatterns = ['head', 'bip_head', 'bip01_head', 'mixamorig:head']
    const bones = findBonesByPattern(skeleton, headPatterns)
    
    if (bones.length === 0) return null
    
    // Return the bone with highest Y position (most likely the actual head)
    return bones.reduce((highest, bone) => {
        const boneY = getBoneWorldPosition(bone).y
        const highestY = getBoneWorldPosition(highest).y
        return boneY > highestY ? bone : highest
    })
}

/**
 * Get skeleton from skinned mesh
 */
export function getSkeletonFromMesh(mesh: SkinnedMesh): Skeleton | null {
    if (!mesh.skeleton) {
        logger.warn('Mesh has no skeleton')
        return null
    }
    return mesh.skeleton
}

/**
 * Update scene matrices recursively
 */
export function updateSceneMatrices(scene: Scene) {
    scene.updateMatrixWorld(true)
    scene.traverse((obj) => {
        if (obj instanceof Mesh || obj instanceof SkinnedMesh) {
            obj.updateMatrix()
            obj.updateMatrixWorld(true)
        }
    })
}