/**
 * Particle system type definitions
 * 
 * Shared types for particle emitters and particle data
 */

import type THREE from '../extras/three';

// Particle message interfaces
export interface ParticleMessageData {
  emitterId: string;
  op?: string;
  n?: number;
  aPosition?: Float32Array;
  aRotation?: Float32Array;
  aDirection?: Float32Array;
  aSize?: Float32Array;
  aColor?: Float32Array;
  aAlpha?: Float32Array;
  aEmissive?: Float32Array;
  aUV?: Float32Array;
  delta?: number;
  camPosition?: number[];
  matrixWorld?: number[];
  value?: boolean;
  [key: string]: unknown;
}

export interface ParticleMessage {
  data: ParticleMessageData;
}

export interface EmitterNode {
  id: string;
  getConfig: () => Record<string, unknown>;
  _max: number;
  _image: string;
  _billboard: string;
  _lit: boolean;
  _blending: string;
  _onEnd: () => void;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
  emitting: boolean;
  matrixWorld: THREE.Matrix4;
}

export interface ParticleEmitter {
  id: string;
  node: EmitterNode;
  isEmitting: boolean;
  update: (delta: number) => void;
  destroy: () => void;
  setEmitting: (value: boolean) => void;
  onMessage: (msg: ParticleMessage) => void;
  send: (msg: Partial<ParticleMessageData>, transfers?: Transferable[]) => void;
}

// Additional particle interfaces from client particles.ts

// Individual particle interface
export interface Particle {
  age: number
  life: number
  direction: THREE.Vector3
  velocity: THREE.Vector3
  distance: number
  speed: number
  finalPosition: THREE.Vector3
  frameTime: number
  uv: number[]
  position: THREE.Vector3
  rotation: number
  startRotation: number
  size: number
  startSize: number
  color: number[]
  startColor: number[]
  alpha: number
  startAlpha: number
  emissive: number
  startEmissive: number
}

// Update data for particle emitters
export interface UpdateData {
  delta: number
  camPosition: number[]
  matrixWorld: number[]
  aPosition: Float32Array
  aRotation: Float32Array
  aDirection: Float32Array
  aSize: Float32Array
  aColor: Float32Array
  aAlpha: Float32Array
  aEmissive: Float32Array
  aUV: Float32Array
}

// Emitter configuration interface
export interface EmitterConfig {
  id: string
  max: number
  duration: number
  rate: number
  emitting: boolean
  bursts: Array<{ time: number; count: number }>
  direction: number
  space: 'world' | 'local'
  timescale: number
  rateOverDistance?: number
  life: string
  speed: string
  size: string
  rotate: string
  color: string
  alpha: string
  emissive: string
  shape: unknown[]
  spritesheet?: [number, number, number, boolean]
  force?: number[]
  velocityLinear?: number[]
  velocityOrbital?: number[]
  velocityRadial?: number
  sizeOverLife?: string
  rotateOverLife?: string
  colorOverLife?: string
  alphaOverLife?: string
  emissiveOverLife?: string
  blending?: string
  loop: boolean
}

// Worker message for particle system
export interface WorkerMessage {
  data: {
    op: string
    id?: string
    emitterId?: string
    value?: boolean
    [key: string]: unknown
  }
}