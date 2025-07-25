// Core type definitions used throughout the codebase

import * as THREE from '../core/extras/three.js';
import type { World, Entity, Component, System } from './index';

// Extend existing types with additional properties
declare module './index' {
  interface World {
    // Client-specific properties
    ui?: any;
    loader?: any;
    network?: {
      isClient: boolean;
      isServer: boolean;
      id: string;
      send(type: string, data: any): void;
      upload(file: File): Promise<void>;
    };
    target?: any;

    // Server-specific properties
    db?: any;
    storage?: any;
    server?: any;
    monitor?: any;
    livekit?: any;
    environment?: {
      csm?: {
        setupMaterial(material: THREE.Material): void;
      };
    };
    
    // Additional properties
    rpg?: {
      systems: Record<string, any>;
      actions: Record<string, any>;
    };
    
    // Plugin system
    loadPlugin?: (plugin: any) => Promise<void>;
    registerPlugin?: (plugin: any) => Promise<void>;
    
    // Event emitter method (should already be there but making it explicit)
    emit?: (event: string, data?: any) => boolean | void;
  }
  
  interface Stage extends System {
    scene: THREE.Scene;
    THREE?: typeof THREE;
  }
  
  interface Physics extends System {
    world: any; // PhysX world object
    physics: any; // PhysX physics object
    createCollider?: (shapeData: any) => any;
    updateCollider?: (handle: any, properties: any) => void;
    removeCollider?: (handle: any) => void;
    isColliding?: (handle1: any, handle2: any) => boolean;
    getCollisions?: (handle: any) => any[];
    setLinearVelocity?: (body: any, velocity: THREE.Vector3) => void;
  }
  
  interface Entities extends System {
    player?: Entity; // Local player on client
  }
  
  interface Entity {
    // Additional entity properties
    data?: any;
    root?: THREE.Object3D;
    blueprint?: any;
    isApp?: boolean;
    build?: () => Node;
    modify?: (data: any) => void;
    chat?: (text: string) => void;
    isDead?: boolean;
    on?: (event: string, callback: Function) => void;
    off?: (event: string, callback: Function) => void;
    emit?: (event: string, data?: any) => void;
  }
}

// Three.js extensions
declare module 'three' {
  interface Object3D {
    ctx?: {
      entity?: Entity;
    };
    activate?: (context: { world: World; entity?: Entity }) => void;
    deactivate?: () => void;
    clean?: () => void;
  }
  
  interface Vector3 {
    toPxTransform?: (transform: any) => void;
    toPxVec3?: () => any;
  }
  
  interface Quaternion {
    toPxTransform?: (transform: any) => void;
    toPxQuat?: () => any;
  }
  
  interface Material {
    // needsUpdate is already defined in Three.js types
  }
}

// PhysX type definitions
interface PxTransform {
  p: { x: number; y: number; z: number };
  q: { x: number; y: number; z: number; w: number };
}

interface PxVec3 {
  x: number;
  y: number;
  z: number;
}

interface PxQuat {
  x: number;
  y: number;
  z: number;
  w: number;
}

// Layers type
interface LayersStatic {
  player: {
    group: number;
    mask: number;
  };
  environment: {
    group: number;
    mask: number;
  };
  prop: {
    group: number;
    mask: number;
  };
}

// Global types
declare global {
  interface Window {
    world?: World;
    preview?: any;
    THREE?: typeof THREE;
  }
  
  interface GlobalThis {
    THREE?: typeof THREE;
    PHYSX?: any;
    env?: {
      PLUGIN_PATH?: string;
    };
  }
  
  const world: World;
  // __dirname and __filename are already defined in node types
  const PHYSX: any;
}

// Export Layers type
export const Layers: LayersStatic;

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Entity data types
export interface EntityData {
  id: string;
  name?: string;
  type?: string;
  position?: number[];
  quaternion?: number[];
  scale?: number[];
  blueprint?: string;
  state?: any;
  health?: number;
  avatar?: string;
  sessionAvatar?: string;
  roles?: string[];
  effect?: {
    anchorId?: string;
    snare?: number;
    freeze?: boolean;
    emote?: string;
    turn?: boolean;
    duration?: number;
    cancellable?: boolean;
  };
  emote?: string;
}

// Network data types
export interface NetworkData {
  id: string;
  p?: number[]; // position
  q?: number[]; // quaternion
  e?: string | null; // emote
  t?: boolean; // teleport
  ef?: any; // effect
  name?: string;
  health?: number;
  avatar?: string;
  sessionAvatar?: string;
  roles?: string[];
}

// Touch interface
export interface Touch {
  position?: { x: number; y: number };
  delta?: { x: number; y: number };
}

// Control interface
export interface Control {
  screen?: { width: number; height: number };
  camera?: {
    write: boolean;
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    zoom: number;
  };
  pointer?: {
    locked: boolean;
    delta?: { x: number; y: number };
  };
  scrollDelta?: { value: number };
  space?: { down: boolean; pressed: boolean };
  touchA?: { down: boolean; pressed: boolean };
  keyW: { down: boolean };
  keyS: { down: boolean };
  keyA: { down: boolean };
  keyD: { down: boolean };
  keyC?: { down: boolean };
  arrowUp: { down: boolean };
  arrowDown: { down: boolean };
  arrowLeft: { down: boolean };
  arrowRight: { down: boolean };
  shiftLeft: { down: boolean };
  shiftRight: { down: boolean };
  xrLeftStick?: { value?: { x: number; z: number } };
  xrRightStick?: { value?: { x: number } };
  xrRightBtn1?: { down: boolean; pressed: boolean };
}

// HotReloadable interface
export interface HotReloadable {
  fixedUpdate?(delta: number): void;
  update?(delta: number): void;
  lateUpdate?(delta: number): void;
  postLateUpdate?(delta: number): void;
}

// Create node function return type
export interface Node {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  add(child: Node): void;
  activate(context: { world: World; entity?: Entity }): void;
  deactivate(): void;
  active?: boolean;
  visible?: boolean;
  label?: string;
  value?: string;
  health?: number;
}

// Export layer types
export type { LayersStatic }; 