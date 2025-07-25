/**
 * Hyperfy World Entity Types
 * These types represent entities as they exist in the Hyperfy world runtime
 */

import * as THREE from 'three'

export interface HyperfyWorldEntity {
  id: string
  type: string
  name?: string
  data?: any
  root?: THREE.Object3D
  base?: THREE.Object3D
  blueprint?: any
  isApp?: boolean
  isPlayer?: boolean
  position?: { x: number; y: number; z: number }
  rotation?: { x: number; y: number; z: number; w: number }
  scale?: { x: number; y: number; z: number }
  modify?: (changes: any) => void
  destroy?: (broadcast?: boolean) => void
  components?: any[]
}

export interface HyperfyWorldPlayer extends HyperfyWorldEntity {
  isPlayer: true
  data: any & {
    id: string
    name: string
    roles?: string[]
  }
  base: THREE.Object3D
  connection?: any
  input?: any
  stats?: any
  avatar?: any
  setName?: (name: string) => void
  spawn?: (position: any) => void
  respawn?: () => void
  damage?: (amount: number, source?: HyperfyWorldEntity) => void
  heal?: (amount: number) => void
}

export interface HyperfyWorldControls {
  goto: (x: number, z: number) => Promise<boolean>
  followEntity: (entity: HyperfyWorldEntity) => Promise<boolean>
  stopAllActions: () => void
  stopNavigation: () => void
  stopRotation: () => void
  rotateTo: (target: { x: number; y: number; z: number }) => Promise<boolean>
  startRandomWalk: () => void
  stopRandomWalk: () => void
  getIsNavigating: () => boolean
  getIsWalkingRandomly: () => boolean
  setKey: (key: string, pressed: boolean) => void
}

export interface HyperfyWorld {
  entities: {
    items: Map<string, HyperfyWorldEntity>
    players: Map<string, HyperfyWorldPlayer>
    player?: HyperfyWorldPlayer
    getPlayer: (id?: string) => HyperfyWorldPlayer | null
    add: (entity: any) => void
    remove: (id: string) => void
  }
  controls?: HyperfyWorldControls
  network?: {
    id: string
    send: (event: string, data: any) => void
    upload: (data: any) => Promise<boolean>
    disconnect: () => void
    maxUploadSize: number
  }
  chat?: {
    msgs: any[]
    listeners: any[]
    add: (msg: any, broadcast?: boolean) => void
    subscribe: (callback: Function) => () => void
  }
  content?: {
    getBundle: (type: string) => any
  }
  voice?: any
  physics?: any
  environment?: any
} 