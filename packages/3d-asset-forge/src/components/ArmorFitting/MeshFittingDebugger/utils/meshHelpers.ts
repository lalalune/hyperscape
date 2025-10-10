import * as THREE from 'three'

/**
 * Dispose of geometry and materials properly
 */
export function disposeMesh(mesh: THREE.Object3D) {
    mesh.traverse((child) => {
        if ('geometry' in child && child.geometry) {
            (child.geometry as THREE.BufferGeometry).dispose()
        }
        if ('material' in child && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach((m: THREE.Material) => m.dispose())
        }
    })
}

/**
 * Find meshes by userData properties
 */
export function findMeshesByUserData(
    scene: THREE.Scene,
    predicate: (userData: any) => boolean
): THREE.Object3D[] {
    const results: THREE.Object3D[] = []
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
    scene: THREE.Scene,
    objects: THREE.Object3D[]
) {
    const uniqueObjects = Array.from(new Set(objects))
    uniqueObjects.forEach(obj => {
        console.log('Removing object:', obj.name || 'unnamed', obj.type)
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
    object: THREE.Object3D,
    refs: (THREE.Object3D | null)[]
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
    skeleton: THREE.Skeleton,
    patterns: string[]
): THREE.Bone[] {
    return skeleton.bones.filter(bone => {
        const boneName = bone.name.toLowerCase()
        return patterns.some(pattern => boneName.includes(pattern))
    })
}

/**
 * Get bone world position safely
 */
export function getBoneWorldPosition(bone: THREE.Bone): THREE.Vector3 {
    bone.updateMatrixWorld(true)
    return bone.getWorldPosition(new THREE.Vector3())
}

/**
 * Find head bone from skeleton
 */
export function findHeadBone(skeleton: THREE.Skeleton): THREE.Bone | null {
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
export function getSkeletonFromMesh(mesh: THREE.SkinnedMesh): THREE.Skeleton | null {
    if (!mesh.skeleton) {
        console.warn('Mesh has no skeleton')
        return null
    }
    return mesh.skeleton
}

/**
 * Update scene matrices recursively
 */
export function updateSceneMatrices(scene: THREE.Scene) {
    scene.updateMatrixWorld(true)
    scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) {
            obj.updateMatrix()
            obj.updateMatrixWorld(true)
        }
    })
}