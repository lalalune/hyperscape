import * as THREE from 'three'
import { MeshFittingService } from '../../../../services/fitting/MeshFittingService'

export interface MeshFittingDebuggerProps {
    onClose: () => void
}

export interface SceneProps {
    fittingService: React.MutableRefObject<MeshFittingService>
    isProcessing: boolean
    showWireframe: boolean
    viewMode: 'sphereCube' | 'avatarArmor' | 'helmetFitting'
    selectedAvatarPath: string
    selectedArmorPath: string
    selectedHelmetPath: string
    avatarMeshRef: React.MutableRefObject<THREE.SkinnedMesh | null>
    armorMeshRef: React.MutableRefObject<THREE.Mesh | null>
    helmetMeshRef: React.MutableRefObject<THREE.Mesh | null>
    originalArmorGeometryRef: React.MutableRefObject<THREE.BufferGeometry | null>
    originalHelmetTransformRef: React.MutableRefObject<{
        position: THREE.Vector3
        rotation: THREE.Euler
        scale: THREE.Vector3
    } | null>
    debugArrowGroupRef: React.MutableRefObject<THREE.Group | null>
    headBoundsHelperRef: React.MutableRefObject<THREE.Box3Helper | null>
    currentAnimation: 'tpose' | 'walking' | 'running'
    isAnimationPlaying: boolean
    showHeadBounds: boolean
    boundArmorMesh: THREE.SkinnedMesh | null
}

export interface AvatarArmorDemoProps {
    onReady: (avatarMesh: THREE.SkinnedMesh, armorMesh: THREE.Mesh) => void
    showWireframe: boolean
    avatarPath: string
    armorPath: string
    currentAnimation: 'tpose' | 'walking' | 'running'
    isAnimationPlaying: boolean
}

export interface HelmetDemoProps {
    onReady: (avatarMesh: THREE.SkinnedMesh, helmetMesh: THREE.Mesh) => void
    showWireframe: boolean
    avatarPath: string
    helmetPath: string
    currentAnimation: 'tpose' | 'walking' | 'running'
    isAnimationPlaying: boolean
    showHeadBounds: boolean
    headBoundsHelperRef: React.MutableRefObject<THREE.Box3Helper | null>
}

export type ExportType = 'full' | 'minimal' | 'static' | 'debug' | 'scale-fixed'