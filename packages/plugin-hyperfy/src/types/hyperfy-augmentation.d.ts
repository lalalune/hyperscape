// Type definitions for Hyperfy objects
import type { HyperfyEntity } from './index'

declare module './index' {
  interface HyperfyEntity {
    root?: any
    base?: any
    ctx?: any
    _label?: string
    isApp?: boolean
    destroy?: () => void
  }
}

export interface HyperfyWorld {
  player?: any
  colorDetector?: any
  ui?: any
  assetLoader?: any
}

export interface HyperfyActions {
  getAvailableActions?: () => string[]
}
