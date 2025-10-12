import type { SkyHandle } from '../types'
import type { SkyData } from '../types/nodes'
import { isNumber, isString } from '../utils/ValidationUtils'
import { Node } from './Node'
import { getMountedContext } from './NodeContext'

const defaults = {
  bg: null,
  hdr: null,
  sunDirection: null,
  sunIntensity: null,
  sunColor: null,
  fogNear: null,
  fogFar: null,
  fogColor: null,
}

export class Sky extends Node {
  handle: SkyHandle | null = null
  needsRebuild: boolean = false
  _bg: string | null = defaults.bg
  _hdr: string | null = defaults.hdr
  _sunDirection: [number, number, number] | null = defaults.sunDirection
  _sunIntensity: number | null = defaults.sunIntensity
  _sunColor: string | null = defaults.sunColor
  _fogNear: number | null = defaults.fogNear
  _fogFar: number | null = defaults.fogFar
  _fogColor: string | null = defaults.fogColor

  constructor(data: SkyData = {}) {
    super(data)
    this.name = 'sky'

    this.bg = data.bg
    this.hdr = data.hdr
    this.sunDirection = data.sunDirection
    this.sunIntensity = data.sunIntensity
    this.sunColor = data.sunColor
    this.fogNear = data.fogNear
    this.fogFar = data.fogFar
    this.fogColor = data.fogColor
  }

  mount() {
    this.needsRebuild = false
    const ctx = getMountedContext(this)
    
    this.handle = ctx.stage.setSky({
      bg: this._bg,
      hdr: this._hdr,
      sunDirection: this._sunDirection,
      sunIntensity: this._sunIntensity,
      sunColor: this._sunColor,
      fogNear: this._fogNear,
      fogFar: this._fogFar,
      fogColor: this._fogColor,
    })
  }

  commit(_didMove: boolean) {
    if (this.needsRebuild) {
      this.unmount()
      this.mount()
      return
    }
  }

  unmount() {
    this.handle?.destroy()
    this.handle = null
  }

  copy(source: Sky, recursive: boolean) {
    super.copy(source, recursive)
    this._bg = source._bg
    this._hdr = source._hdr
    this._sunDirection = source._sunDirection
    this._sunIntensity = source._sunIntensity
    this._sunColor = source._sunColor
    this._fogNear = source._fogNear
    this._fogFar = source._fogFar
    this._fogColor = source._fogColor
    return this
  }

  get bg() {
    return this._bg
  }

  set bg(value: string | null | undefined) {
    if (value === undefined) value = defaults.bg
    if (value !== null && !isString(value)) {
      throw new Error('[sky] bg not a string')
    }
    if (this._bg === value) return
    this._bg = value
    this.needsRebuild = true
    this.setDirty()
  }

  get hdr() {
    return this._hdr
  }

  set hdr(value: string | null | undefined) {
    if (value === undefined) value = defaults.hdr
    if (value !== null && !isString(value)) {
      throw new Error('[sky] hdr not a string')
    }
    if (this._hdr === value) return
    this._hdr = value
    this.needsRebuild = true
    this.setDirty()
  }

  get sunDirection() {
    return this._sunDirection
  }

  set sunDirection(value: [number, number, number] | null | undefined) {
    if (value === undefined) value = defaults.sunDirection
    if (value !== null && (!Array.isArray(value) || value.length !== 3)) {
      throw new Error('[sky] sunDirection must be an array [x, y, z]')
    }
    if (this._sunDirection === value) return
    this._sunDirection = value
    this.needsRebuild = true
    this.setDirty()
  }

  get sunIntensity() {
    return this._sunIntensity
  }

  set sunIntensity(value: number | null | undefined) {
    if (value === undefined) value = defaults.sunIntensity
    if (value !== null && !isNumber(value)) {
      throw new Error('[sky] sunIntensity not a number')
    }
    if (this._sunIntensity === value) return
    this._sunIntensity = value
    this.needsRebuild = true
    this.setDirty()
  }

  get sunColor() {
    return this._sunColor
  }

  set sunColor(value: string | null | undefined) {
    if (value === undefined) value = defaults.sunColor
    if (value !== null && !isString(value)) {
      throw new Error('[sky] sunColor not a string')
    }
    if (this._sunColor === value) return
    this._sunColor = value
    this.needsRebuild = true
    this.setDirty()
  }

  get fogNear() {
    return this._fogNear
  }

  set fogNear(value: number | null | undefined) {
    if (value === undefined) value = defaults.fogNear
    if (value !== null && !isNumber(value)) {
      throw new Error('[sky] fogNear not a number')
    }
    if (this._fogNear === value) return
    this._fogNear = value
    this.needsRebuild = true
    this.setDirty()
  }

  get fogFar() {
    return this._fogFar
  }

  set fogFar(value: number | null | undefined) {
    if (value === undefined) value = defaults.fogFar
    if (value !== null && !isNumber(value)) {
      throw new Error('[sky] fogFar not a number')
    }
    if (this._fogFar === value) return
    this._fogFar = value
    this.needsRebuild = true
    this.setDirty()
  }

  get fogColor() {
    return this._fogColor
  }

  set fogColor(value: string | null | undefined) {
    if (value === undefined) value = defaults.fogColor
    if (value !== null && !isString(value)) {
      throw new Error('[sky] fogColor not a string')
    }
    if (this._fogColor === value) return
    this._fogColor = value
    this.needsRebuild = true
    this.setDirty()
  }

  getProxy() {
    const self = this
    if (!this.proxy) {
      let proxy = {
        get bg() {
          return self.bg
        },
        set bg(value) {
          self.bg = value
        },
        get hdr() {
          return self.hdr
        },
        set hdr(value) {
          self.hdr = value
        },
        get sunDirection() {
          return self.sunDirection
        },
        set sunDirection(value) {
          self.sunDirection = value
        },
        get sunIntensity() {
          return self.sunIntensity
        },
        set sunIntensity(value) {
          self.sunIntensity = value
        },
        get sunColor() {
          return self.sunColor
        },
        set sunColor(value) {
          self.sunColor = value
        },
        get fogNear() {
          return self.fogNear
        },
        set fogNear(value) {
          self.fogNear = value
        },
        get fogFar() {
          return self.fogFar
        },
        set fogFar(value) {
          self.fogFar = value
        },
        get fogColor() {
          return self.fogColor
        },
        set fogColor(value) {
          self.fogColor = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}