// Type definitions for internal libraries in src/core/libs

// CSM (Cascaded Shadow Maps)
declare module '*/csm/CSM.js' {
  import { Object3D, Vector3, Camera } from 'three';

  export class CSM {
    constructor(data: {
      maxFar?: number
      cascades?: number
      mode?: 'practical' | 'uniform' | 'logarithmic' | 'custom'
      parent?: Object3D
      shadowMapSize?: number
      lightDirection?: Vector3
      camera?: Camera
    })

    fade: boolean;
    helper: any;

    update(): void
    updateFrustums(): void
    remove(): void
    dispose(): void
  }
}

// GLTF Loader
declare module '*/gltfloader/GLTFLoader.js' {
  import { Loader, LoadingManager, Group, Camera, AnimationClip } from 'three';

  export class GLTFLoader extends Loader {
    constructor(manager?: LoadingManager)

    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (error: Error) => void
    ): void

    loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<GLTF>

    parse(
      data: ArrayBuffer | string,
      path: string,
      onLoad: (gltf: GLTF) => void,
      onError?: (error: Error) => void
    ): void

    setDRACOLoader(dracoLoader: any): this
    setKTX2Loader(ktx2Loader: any): this
    setMeshoptDecoder(meshoptDecoder: any): this
  }

  export interface GLTF {
    scene: Group
    scenes: Group[]
    cameras: Camera[]
    animations: AnimationClip[]
    asset: {
      copyright?: string
      generator?: string
      version?: string
      minVersion?: string
      extensions?: any
      extras?: any
    }
    parser: any
    userData: any
  }
}

// Stats GL
declare module '*/stats-gl/index.js' {
  export default class Stats {
    constructor(options?: {
      logsPerSecond?: number
      samplesLog?: number
      samplesGraph?: number
      precision?: number
      minimal?: boolean
      mode?: number
    })

    begin(): void
    end(): void
    update(): void

    dom: HTMLElement;
  }
}

// Three Custom Shader Material
declare module '*/three-custom-shader-material/index.js' {
  import { Material, IUniform } from 'three';

  export default class CustomShaderMaterial extends Material {
    constructor(options: {
      baseMaterial: typeof Material
      vertexShader?: string
      fragmentShader?: string
      uniforms?: { [key: string]: IUniform }
      cacheKey?: () => string
      [key: string]: any
    })
  }
}

// Three VRM
declare module '*/three-vrm/index.js' {
  import { Group, Object3D, Material, Vector3 } from 'three';

  export class VRM {
    scene: Group;
    humanoid: VRMHumanoid;
    expressionManager?: VRMExpressionManager;
    firstPerson?: VRMFirstPerson;
    lookAt?: VRMLookAt;
    meta?: VRMMeta;
    materials?: Material[];
    springBoneManager?: VRMSpringBoneManager;
    nodeConstraintManager?: any;

    update(deltaTime: number): void
  }

  export class VRMHumanoid {
    humanBones: VRMHumanBones;
    restPose: VRMPose;

    getBone(name: VRMHumanBoneName): VRMHumanBone | undefined
    getBoneNode(name: VRMHumanBoneName): Object3D | undefined
    getRawBone(name: VRMHumanBoneName): { node: Object3D } | undefined

    resetPose(): void
    setRawPose(pose: VRMPose): void
    getPose(): VRMPose
    setPose(pose: VRMPose): void
  }

  export interface VRMHumanBones {
    [name: string]: VRMHumanBone
  }

  export interface VRMHumanBone {
    node: Object3D
  }

  export interface VRMPose {
    [boneName: string]: {
      rotation?: [number, number, number, number]
      position?: [number, number, number]
    }
  }

  export type VRMHumanBoneName =
    | 'hips'
    | 'spine'
    | 'chest'
    | 'upperChest'
    | 'neck'
    | 'head'
    | 'leftShoulder'
    | 'leftUpperArm'
    | 'leftLowerArm'
    | 'leftHand'
    | 'rightShoulder'
    | 'rightUpperArm'
    | 'rightLowerArm'
    | 'rightHand'
    | 'leftUpperLeg'
    | 'leftLowerLeg'
    | 'leftFoot'
    | 'leftToes'
    | 'rightUpperLeg'
    | 'rightLowerLeg'
    | 'rightFoot'
    | 'rightToes'

  export class VRMExpressionManager {
    expressions: VRMExpression[];
    expressionMap: { [name: string]: VRMExpression };

    getValue(name: string): number
    setValue(name: string, value: number): void

    update(): void
  }

  export interface VRMExpression {
    expressionName: string
    morphTargetBinds: any[]
    materialColorBinds: any[]
    textureTransformBinds: any[]
    isBinary: boolean
    overrideBlink: string
    overrideLookAt: string
    overrideMouth: string
  }

  export class VRMFirstPerson {
    meshAnnotations: VRMFirstPersonMeshAnnotation[];
  }

  export interface VRMFirstPersonMeshAnnotation {
    firstPersonFlag: string
    node: Object3D
  }

  export class VRMLookAt {
    target?: Object3D;
    autoUpdate: boolean;

    getLookAtWorldDirection(target: Vector3): Vector3
    lookAt(position: Vector3): void
    update(_delta: number): void
    reset(): void
  }

  export interface VRMMeta {
    name?: string
    version?: string
    authors?: string[]
    copyrightInformation?: string
    contactInformation?: string
    references?: string[]
    thirdPartyLicenses?: string
    thumbnailImage?: string
    licenseUrl?: string
    avatarPermission?: string
    allowExcessivelyViolentUsage?: boolean
    allowExcessivelySexualUsage?: boolean
    commercialUsage?: string
    allowPoliticalOrReligiousUsage?: boolean
    allowAntisocialOrHateUsage?: boolean
    creditNotation?: string
    allowRedistribution?: boolean
    modification?: string
    otherLicenseUrl?: string
  }

  export class VRMSpringBoneManager {
    joints: VRMSpringBoneJoint[];
    colliderGroups: VRMSpringBoneColliderGroup[];

    setCenter(root: Object3D | null): void
    update(_delta: number): void
    reset(): void
  }

  export interface VRMSpringBoneJoint {
    bone: Object3D
    radius: number
    stiffness: number
    gravityPower: number
    gravityDir: Vector3
    dragForce: number
    hitRadius: number
  }

  export interface VRMSpringBoneColliderGroup {
    node: Object3D
    colliders: VRMSpringBoneCollider[]
  }

  export interface VRMSpringBoneCollider {
    offset: Vector3
    radius: number
  }

  export class VRMLoaderPlugin {
    constructor(parser: any)
  }

  export class VRMUtils {
    static deepDispose(object3D: Object3D): void
    static removeUnnecessaryVertices(root: Object3D): void
    static removeUnnecessaryJoints(root: Object3D): void
    static rotateVRM0(vrm: VRM): void
  }
}
