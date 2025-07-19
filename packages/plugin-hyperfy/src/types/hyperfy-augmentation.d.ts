// Type augmentations for HyperfyEntity
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

  interface HyperfyWorld {
    player?: any
    colorDetector?: any
    ui?: any
    assetLoader?: any
  }

  interface HyperfyActions {
    getAvailableActions?: () => string[]
  }
}

export {}
