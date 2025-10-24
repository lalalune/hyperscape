import { Box3, BufferGeometry, Euler, Matrix4, Object3D, Quaternion, Vector3 } from 'three'

import { safeScale, EPSILON } from '@/utils/safe-math'

/**
 * Transform data structure
 */
export interface TransformData {
    position: Vector3
    rotation: Euler
    scale: Vector3
}

/**
 * Store world transform before operations
 */
export function storeWorldTransform(object: Object3D): {
    position: Vector3
    quaternion: Quaternion
    scale: Vector3
} {
    return {
        position: object.getWorldPosition(new Vector3()),
        quaternion: object.getWorldQuaternion(new Quaternion()),
        scale: object.getWorldScale(new Vector3())
    }
}

/**
 * Apply world transform to object
 */
export function applyWorldTransform(
    object: Object3D, 
    worldTransform: { position: Vector3; quaternion: Quaternion; scale: Vector3 },
    parent: Object3D
) {
    const parentInverse = new Matrix4().copy(parent.matrixWorld).invert()
    const worldMatrix = new Matrix4().compose(
        worldTransform.position,
        worldTransform.quaternion,
        worldTransform.scale
    )
    const localMatrix = new Matrix4().multiplyMatrices(parentInverse, worldMatrix)
    
    const localPos = new Vector3()
    const localQuat = new Quaternion()
    const localScale = new Vector3()
    localMatrix.decompose(localPos, localQuat, localScale)
    
    object.position.copy(localPos)
    object.quaternion.copy(localQuat)
    object.scale.copy(localScale)
}

/**
 * Calculate scale ratio between objects
 * CRITICAL: Protected against division by zero
 */
export function calculateScaleRatio(object1: Object3D, object2: Object3D): number {
    const scale1 = new Vector3()
    const scale2 = new Vector3()
    object1.matrixWorld.decompose(new Vector3(), new Quaternion(), scale1)
    object2.matrixWorld.decompose(new Vector3(), new Quaternion(), scale2)

    // CRITICAL FIX: Prevent division by zero which causes NaN propagation
    return safeScale(scale2.x, scale1.x, 1)
}

/**
 * Get geometry bounds with size validation
 */
export function getValidatedBounds(geometry: BufferGeometry): {
    bounds: Box3
    size: Vector3
} | null {
    geometry.computeBoundingBox()
    if (!geometry.boundingBox) return null
    
    const bounds = geometry.boundingBox.clone()
    const size = bounds.getSize(new Vector3())
    
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
        console.warn('Invalid geometry bounds:', size)
        return null
    }
    
    return { bounds, size }
}

/**
 * Calculate target scale for fitting
 * Protected against division by zero
 */
export function calculateFittingScale(
    sourceSize: Vector3,
    targetSize: Vector3,
    scaleFactors: { x: number; y: number; z: number } = { x: 1.16, y: 1.0, z: 2.54 }
): number {
    // Use safe division to prevent division by zero
    const scaleX = safeScale(targetSize.x * scaleFactors.x, sourceSize.x, 1)
    const scaleY = safeScale(targetSize.y * scaleFactors.y, sourceSize.y, 1)
    const scaleZ = safeScale(targetSize.z * scaleFactors.z, sourceSize.z, 1)

    return Math.min(scaleX, scaleY, scaleZ)
}

/**
 * Calculate volume-based scale
 * Protected against division by zero
 */
export function calculateVolumeBasedScale(
    sourceSize: Vector3,
    targetSize: Vector3,
    characterProfile: { scaleBoost: number } = { scaleBoost: 1.0 }
): number {
    const sourceVolume = sourceSize.x * sourceSize.y * sourceSize.z
    const targetVolume = targetSize.x * targetSize.y * targetSize.z

    // Use safe division to prevent division by zero
    const volumeRatio = Math.abs(sourceVolume) > EPSILON
        ? Math.pow(targetVolume / sourceVolume, 1 / 3)
        : 1

    const heightRatio = safeScale(targetSize.y, sourceSize.y, 1)

    // Blend volume and height ratios
    return ((volumeRatio * 0.7) + (heightRatio * 0.3)) * characterProfile.scaleBoost
}