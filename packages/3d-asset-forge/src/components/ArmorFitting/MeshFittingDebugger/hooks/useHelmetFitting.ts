import * as THREE from 'three'
import { MutableRefObject } from 'react'
import { MeshFittingService } from '../../../../services/fitting/MeshFittingService'
import { ExtendedMesh } from '../../../../types'
import {
    storeWorldTransform,
    applyWorldTransform,
    applyExtremeScaleMaterialFixes,
    getSkeletonFromMesh
} from '../utils'

interface HelmetFittingProps {
    sceneRef: MutableRefObject<THREE.Scene | null>
    avatarMeshRef: MutableRefObject<THREE.SkinnedMesh | null>
    helmetMeshRef: MutableRefObject<ExtendedMesh | null>
    fittingService: MutableRefObject<MeshFittingService>
    
    setIsProcessing: (value: boolean) => void
    setIsHelmetFitted: (value: boolean) => void
    setIsHelmetAttached: (value: boolean) => void
    
    helmetFittingMethod: string
    helmetSizeMultiplier: number
    helmetFitTightness: number
    helmetVerticalOffset: number
    helmetForwardOffset: number
    helmetRotation: { x: number; y: number; z: number }
}

export function useHelmetFitting({
    sceneRef,
    avatarMeshRef,
    helmetMeshRef,
    fittingService,
    setIsProcessing,
    setIsHelmetFitted,
    setIsHelmetAttached,
    helmetFittingMethod,
    helmetSizeMultiplier,
    helmetFitTightness,
    helmetVerticalOffset,
    helmetForwardOffset,
    helmetRotation
}: HelmetFittingProps) {
    
  const performHelmetFitting = async () => {
    console.log('performHelmetFitting called')
    console.log('avatarMeshRef.current:', avatarMeshRef.current)
    console.log('helmetMeshRef.current:', helmetMeshRef.current)
    
    const avatarMesh = avatarMeshRef.current!
    const helmetMesh = helmetMeshRef.current!

    console.log('=== STARTING HELMET FITTING ===')
    logBoneHierarchy(avatarMesh)

    setIsProcessing(true)

    const result = await fittingService.current.fitHelmetToHead(
      helmetMesh,
      avatarMesh,
      {
        method: helmetFittingMethod as 'auto' | 'manual',
        sizeMultiplier: helmetSizeMultiplier,
        fitTightness: helmetFitTightness,
        verticalOffset: helmetVerticalOffset,
        forwardOffset: helmetForwardOffset,
        rotation: new THREE.Euler(
          helmetRotation.x * Math.PI / 180,
          helmetRotation.y * Math.PI / 180,
          helmetRotation.z * Math.PI / 180
        ),
        attachToHead: false,
        showHeadBounds: false,
        showCollisionDebug: false
      }
    )

    console.log('Helmet fitting complete:', result)
    
    // Mark helmet as fitted
    helmetMesh.userData.hasBeenFitted = true
    setIsHelmetFitted(true)
    setIsProcessing(false)
  }

  const attachHelmetToHead = () => {
    const avatarMesh = avatarMeshRef.current!
    const helmetMesh = helmetMeshRef.current!
    const scene = sceneRef.current!

    // Find head bone
    const headInfo = fittingService.current.detectHeadRegion(avatarMesh)
    const headBone = headInfo.headBone!

    // Debug: Log transforms before attachment
    console.log('=== BEFORE ATTACHMENT ===')
    const originalTransform = storeWorldTransform(helmetMesh)
    console.log('Helmet world position:', originalTransform.position)
    console.log('Helmet world scale:', originalTransform.scale)
    console.log('Head bone world scale:', headBone.getWorldScale(new THREE.Vector3()))

    // Check bone scale
    const boneScale = headBone.getWorldScale(new THREE.Vector3())
        
    if (boneScale.x < 0.1) {
      console.log('Bone has extreme scale - applying visibility workaround')

      // Attach with workarounds
      headBone.attach(helmetMesh)

      // Ensure world transform is preserved
      const newTransform = storeWorldTransform(helmetMesh)
      if (newTransform.position.distanceTo(originalTransform.position) > 0.001) {
        console.log('Correcting transform drift for extreme scale case...')
        applyWorldTransform(helmetMesh, originalTransform, headBone)
      }

      // Apply material fixes for extreme scales
      applyExtremeScaleMaterialFixes(helmetMesh)

      // Force matrix updates
      helmetMesh.updateMatrix()
      helmetMesh.updateMatrixWorld(true)

      console.log('Applied extreme scale workarounds')
    } else {
      // Normal attachment process
      console.log('Attaching helmet to head bone...')
      headBone.attach(helmetMesh)
      console.log('Helmet attached to head bone')
    }

    // Debug: Log transforms after attachment
    console.log('=== AFTER ATTACHMENT ===')
    console.log('Helmet world position:', helmetMesh.getWorldPosition(new THREE.Vector3()))
    console.log('Helmet world scale:', helmetMesh.getWorldScale(new THREE.Vector3()))
    console.log('Helmet parent:', helmetMesh.parent?.name || 'none')

    // Update flags
    setIsHelmetAttached(true)
    helmetMesh.userData.isAttached = true
    
    console.log('✅ Helmet successfully attached to head bone:', headBone.name)
    }

  const detachHelmetFromHead = () => {
    const helmetMesh = helmetMeshRef.current!
    const scene = sceneRef.current!

    // Clean up render helper if it exists
    cleanupRenderHelper(helmetMesh)

    // Make original helmet visible again
    helmetMesh.visible = true
    helmetMesh.traverse((child: THREE.Object3D) => {
      child.visible = true
    })

    // Use attach() which preserves world transform
    scene.attach(helmetMesh)

    setIsHelmetAttached(false)
    helmetMesh.userData.isAttached = false
    console.log('Helmet detached from head')
  }

    return {
        performHelmetFitting,
        attachHelmetToHead,
        detachHelmetFromHead
    }
}

// Helper functions specific to helmet fitting

function logBoneHierarchy(avatarMesh: THREE.SkinnedMesh) {
    const bones: Array<{ name: string, depth: number, path: string }> = []
    
    const getBonePath = (bone: THREE.Object3D): string => {
        const path: string[] = []
        let current: THREE.Object3D | null = bone
        while (current) {
            path.unshift(current.name || 'unnamed')
            current = current.parent
        }
        return path.join(' > ')
    }

    const collectBones = (obj: THREE.Object3D, depth: number = 0) => {
        if (obj instanceof THREE.Bone) {
            bones.push({
                name: obj.name,
                depth,
                path: getBonePath(obj)
            })
        }
        obj.children.forEach(child => collectBones(child, depth + 1))
    }

    // Check skeleton
    const skeleton = getSkeletonFromMesh(avatarMesh)
    if (skeleton) {
        console.log('Found SkinnedMesh with skeleton containing', skeleton.bones.length, 'bones')
        skeleton.bones.forEach((bone, index) => {
            bones.push({
                name: bone.name || `bone_${index}`,
                depth: 0,
                path: `skeleton.bones[${index}]`
            })
        })
    } else {
        // Fallback to traversal
        collectBones(avatarMesh)
    }

    console.log(`\n=== BONE HIERARCHY (${bones.length} bones) ===`)
    if (bones.length === 0) {
        console.log('No bones found! Checking avatar structure...')
        console.log('Avatar type:', avatarMesh.type)
    } else {
        bones.forEach(({ name, depth, path }) => {
            const indent = '  '.repeat(depth)
            console.log(`${indent}${name || 'unnamed'} (path: ${path})`)
        })
    }
    console.log('================================\n')
}

function cleanupRenderHelper(helmetMesh: ExtendedMesh) {
    const renderHelper = helmetMesh.renderHelper
    if (renderHelper && renderHelper.parent) {
        // Remove helper from scene
        renderHelper.parent.remove(renderHelper)
        if ('geometry' in renderHelper && renderHelper.geometry) {
            (renderHelper.geometry as THREE.BufferGeometry).dispose()
        }
        if ('material' in renderHelper && renderHelper.material) {
            const materials = Array.isArray(renderHelper.material) 
                ? renderHelper.material as THREE.Material[]
                : [renderHelper.material as THREE.Material]
            materials.forEach((mat) => mat.dispose())
        }

        // Clean up references
        delete helmetMesh.renderHelper
        delete helmetMesh.updateHelper
    }
}