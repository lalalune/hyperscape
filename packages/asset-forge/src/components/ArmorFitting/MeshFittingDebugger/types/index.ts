import { Box3Helper, BufferGeometry, Euler, Group, Mesh, SkinnedMesh, Vector3 } from 'three'

import { MeshFittingService } from '@/services/fitting/MeshFittingService'

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
    avatarMeshRef: React.MutableRefObject<SkinnedMesh | null>
    armorMeshRef: React.MutableRefObject<Mesh | null>
    helmetMeshRef: React.MutableRefObject<Mesh | null>
    originalArmorGeometryRef: React.MutableRefObject<BufferGeometry | null>
    originalHelmetTransformRef: React.MutableRefObject<{
        position: Vector3
        rotation: Euler
        scale: Vector3
    } | null>
    debugArrowGroupRef: React.MutableRefObject<Group | null>
    headBoundsHelperRef: React.MutableRefObject<Box3Helper | null>
    currentAnimation: 'tpose' | 'walking' | 'running'
    isAnimationPlaying: boolean
    showHeadBounds: boolean
    boundArmorMesh: SkinnedMesh | null
}

export interface AvatarArmorDemoProps {
    onReady: (avatarMesh: SkinnedMesh, armorMesh: Mesh) => void
    showWireframe: boolean
    avatarPath: string
    armorPath: string
    currentAnimation: 'tpose' | 'walking' | 'running'
    isAnimationPlaying: boolean
}

export interface HelmetDemoProps {
    onReady: (avatarMesh: SkinnedMesh, helmetMesh: Mesh) => void
    showWireframe: boolean
    avatarPath: string
    helmetPath: string
    currentAnimation: 'tpose' | 'walking' | 'running'
    isAnimationPlaying: boolean
    showHeadBounds: boolean
    headBoundsHelperRef: React.MutableRefObject<Box3Helper | null>
}

export type ExportType = 'full' | 'minimal' | 'static' | 'debug' | 'scale-fixed'