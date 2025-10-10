import * as THREE from 'three'

/**
 * Transform data structure
 */
export interface TransformData {
    position: THREE.Vector3
    rotation: THREE.Euler
    scale: THREE.Vector3
}

/**
 * Store world transform before operations
 */
export function storeWorldTransform(object: THREE.Object3D): {
    position: THREE.Vector3
    quaternion: THREE.Quaternion
    scale: THREE.Vector3
} {
    return {
        position: object.getWorldPosition(new THREE.Vector3()),
        quaternion: object.getWorldQuaternion(new THREE.Quaternion()),
        scale: object.getWorldScale(new THREE.Vector3())
    }
}

/**
 * Apply world transform to object
 */
export function applyWorldTransform(
    object: THREE.Object3D, 
    worldTransform: { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 },
    parent: THREE.Object3D
) {
    const parentInverse = new THREE.Matrix4().copy(parent.matrixWorld).invert()
    const worldMatrix = new THREE.Matrix4().compose(
        worldTransform.position,
        worldTransform.quaternion,
        worldTransform.scale
    )
    const localMatrix = new THREE.Matrix4().multiplyMatrices(parentInverse, worldMatrix)
    
    const localPos = new THREE.Vector3()
    const localQuat = new THREE.Quaternion()
    const localScale = new THREE.Vector3()
    localMatrix.decompose(localPos, localQuat, localScale)
    
    object.position.copy(localPos)
    object.quaternion.copy(localQuat)
    object.scale.copy(localScale)
}

/**
 * Calculate scale ratio between objects
 */
export function calculateScaleRatio(object1: THREE.Object3D, object2: THREE.Object3D): number {
    const scale1 = new THREE.Vector3()
    const scale2 = new THREE.Vector3()
    object1.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale1)
    object2.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale2)
    return scale2.x / scale1.x
}

/**
 * Get geometry bounds with size validation
 */
export function getValidatedBounds(geometry: THREE.BufferGeometry): {
    bounds: THREE.Box3
    size: THREE.Vector3
} | null {
    geometry.computeBoundingBox()
    if (!geometry.boundingBox) return null
    
    const bounds = geometry.boundingBox.clone()
    const size = bounds.getSize(new THREE.Vector3())
    
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
        console.warn('Invalid geometry bounds:', size)
        return null
    }
    
    return { bounds, size }
}

/**
 * Calculate target scale for fitting
 */
export function calculateFittingScale(
    sourceSize: THREE.Vector3,
    targetSize: THREE.Vector3,
    scaleFactors: { x: number; y: number; z: number } = { x: 1.16, y: 1.0, z: 2.54 }
): number {
    return Math.min(
        targetSize.x * scaleFactors.x / sourceSize.x,
        targetSize.y * scaleFactors.y / sourceSize.y,
        targetSize.z * scaleFactors.z / sourceSize.z
    )
}

/**
 * Calculate volume-based scale
 */
export function calculateVolumeBasedScale(
    sourceSize: THREE.Vector3,
    targetSize: THREE.Vector3,
    characterProfile: { scaleBoost: number } = { scaleBoost: 1.0 }
): number {
    const sourceVolume = sourceSize.x * sourceSize.y * sourceSize.z
    const targetVolume = targetSize.x * targetSize.y * targetSize.z
    const volumeRatio = Math.pow(targetVolume / sourceVolume, 1 / 3)
    const heightRatio = targetSize.y / sourceSize.y
    
    // Blend volume and height ratios
    return ((volumeRatio * 0.7) + (heightRatio * 0.3)) * characterProfile.scaleBoost
}