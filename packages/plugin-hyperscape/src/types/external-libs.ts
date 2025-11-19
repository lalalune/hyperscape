import {
  THREE,
  type PxVec3,
  type PxTransform,
  type PxQuat,
} from "@hyperscape/shared";

// THREE.js Extensions
export interface EnhancedVector3 extends THREE.Vector3 {
  fromPxVec3(pxVec3: PxVec3): this;
  toPxVec3(pxVec3?: PxVec3): PxVec3;
  toPxExtVec3(pxExtVec3?: PxVec3): PxVec3;
  toPxTransform(pxTransform: PxTransform): void;
}

export interface EnhancedQuaternion extends THREE.Quaternion {
  toPxTransform(pxTransform: PxTransform): void;
}

export interface EnhancedMatrix4 extends THREE.Matrix4 {
  toPxTransform(pxTransform: PxTransform): void;
}

export enum PxRigidBodyFlagEnum {
  eENABLE_CCD = 1,
}

export enum PxRigidDynamicLockFlagEnum {
  eLOCK_ANGULAR_X = 1,
  eLOCK_ANGULAR_Y = 2,
  eLOCK_ANGULAR_Z = 4,
}

export enum PxActorFlagEnum {
  eDISABLE_GRAVITY = 1,
  eDISABLE_SIMULATION = 2,
}

export enum PxCombineModeEnum {
  eMAX = 0,
  eMIN = 1,
}

export enum PxForceModeEnum {
  eFORCE = 0,
  eIMPULSE = 1,
}

export interface PxRigidActor {
  setRigidBodyFlag(flag: PxRigidBodyFlagEnum, value: boolean): void;
  setRigidDynamicLockFlag(
    flag: PxRigidDynamicLockFlagEnum,
    value: boolean,
  ): void;
  setActorFlag(flag: PxActorFlagEnum, value: boolean): void;
  getLinearVelocity(): PxVec3;
  setLinearVelocity(velocity: PxVec3): void;
  addForce(force: PxVec3, mode: PxForceModeEnum, autowake?: boolean): void;
  setAngularVelocity(velocity: PxVec3): void;
  getRigidBodyFlags?(): { isSet(flag: PxRigidBodyFlagEnum): boolean };
}

export interface PxRigidStatic extends PxRigidActor {}

export interface PxMaterial {
  setFrictionCombineMode(mode: PxCombineModeEnum): void;
  setRestitutionCombineMode(mode: PxCombineModeEnum): void;
}

export interface PxRigidBodyExt {
  addForceAtPos(
    body: PxRigidActor,
    force: PxVec3,
    pos: PxVec3,
    mode: PxForceModeEnum,
  ): void;
}

export interface PHYSX {
  PxRigidBodyFlagEnum: typeof PxRigidBodyFlagEnum;
  PxRigidDynamicLockFlagEnum: typeof PxRigidDynamicLockFlagEnum;
  PxActorFlagEnum: typeof PxActorFlagEnum;
  PxCombineModeEnum: typeof PxCombineModeEnum;
  PxForceModeEnum: typeof PxForceModeEnum;
  PxRigidStatic: new (...args: unknown[]) => PxRigidStatic;
  PxRigidBodyExt: {
    prototype: PxRigidBodyExt;
  };
}

declare global {
  namespace THREE {
    interface Vector3 extends EnhancedVector3 {}
    interface Quaternion extends EnhancedQuaternion {}
    interface Matrix4 extends EnhancedMatrix4 {}
  }
}

// D3.js types for curve manager
export interface D3Selection<T = Element> {
  data<D>(data: D[], key?: (d: D) => string | number): D3Selection<T>;
  enter(): D3Selection<T>;
  exit(): D3Selection<T>;
  merge(other: D3Selection<T>): D3Selection<T>;
  attr(
    name: string,
    value: string | number | ((d: unknown) => string | number),
  ): D3Selection<T>;
  each(func: (this: T, d: unknown) => void): D3Selection<T>;
  on(
    event: string,
    handler: (event: Event, d: unknown) => void,
  ): D3Selection<T>;
}

// GLTFLoader types
export interface GLTFResult {
  scene: THREE.Group;
  scenes: THREE.Group[];
  animations: THREE.AnimationClip[];
  cameras: THREE.Camera[];
  asset: {
    generator?: string;
    version?: string;
  };
  parser: unknown;
  userData: Record<string, unknown>;
}

// DOM event types for GLTF loader
interface ProgressEvent extends Event {
  loaded: number;
  total: number;
}

interface ErrorEvent extends Event {
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  error?: Error;
}

export interface GLTFLoader {
  load(
    url: string,
    onLoad: (gltf: GLTFResult) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void;
  loadAsync(url: string): Promise<GLTFResult>;
  parse(
    data: ArrayBuffer | string,
    path: string,
    onLoad: (gltf: GLTFResult) => void,
    onError?: (event: ErrorEvent) => void,
  ): void;
}

// Animation Mixer types
export interface AnimationMixer
  extends Omit<THREE.AnimationMixer, "existingAction"> {
  existingAction?:
    | THREE.AnimationAction
    | ((
        clip: THREE.AnimationClip,
        root?: THREE.Object3D | THREE.AnimationObjectGroup,
      ) => THREE.AnimationAction);
}

// Material shader compilation types
export interface ShaderMaterial
  extends Omit<THREE.ShaderMaterial, "onBeforeCompile"> {
  onBeforeCompile?:
    | ((shader: ShaderCompileParameters) => void)
    | ((
        shader: THREE.WebGLProgramParametersWithUniforms,
        renderer: THREE.WebGLRenderer | any,
      ) => void);
}

export interface ShaderCompileParameters {
  vertexShader: string;
  fragmentShader: string;
  uniforms: { [key: string]: THREE.IUniform };
}

export {};
