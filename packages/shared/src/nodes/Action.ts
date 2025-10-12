import THREE from '../extras/three'

import { Node } from './Node'
import type { ActionsSystem } from '../types/system-interfaces'
import type { ActionData } from '../types/nodes'

const defaults = {
  label: 'Interact',
  distance: 3,
  duration: 0.5,
  onStart: () => {},
  onTrigger: () => {},
  onCancel: () => {},
}

export class Action extends Node {
  worldPos: THREE.Vector3
  progress: number
  _label!: string
  _distance!: number
  _duration!: number
  _onStart!: () => void
  _onTrigger!: () => void
  _onCancel!: () => void
  constructor(data: ActionData = {}) {
    super(data)
    this.name = 'action'

    this.label = data.label !== undefined ? data.label : 'Interact'
    this.distance = data.distance ?? 3
    this.duration = data.duration ?? 0.5
    this.onStart = data.onStart
    this.onTrigger = data.onTrigger
    this.onCancel = data.onCancel

    this.worldPos = new THREE.Vector3()
    this.progress = 0
  }

  mount() {
    // Register with actions system
    const actionsSystem = this.ctx!.findSystem!('actions') as ActionsSystem;
    if (actionsSystem) {
      actionsSystem.register(this);
    }
    this.worldPos.setFromMatrixPosition(this.matrixWorld)
  }

  commit(didMove) {
    if (didMove) {
      this.worldPos.setFromMatrixPosition(this.matrixWorld)
    }
  }

  unmount() {
    // Unregister with actions system
    const actionsSystem = this.ctx!.findSystem!('actions') as ActionsSystem;
    if (actionsSystem) {
      actionsSystem.unregister(this.id);
    }
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._label = source._label
    this._distance = source._distance
    this._duration = source._duration
    this._onStart = source._onStart
    this._onTrigger = source._onTrigger
    this._onCancel = source._onCancel
    return this
  }

  get label() {
    return this._label
  }

  set label(value: string | number | undefined) {
    this._label = value !== undefined ? String(value) : defaults.label
  }

  get distance() {
    return this._distance
  }

  set distance(value: number | undefined) {
    this._distance = value ?? defaults.distance
  }

  get duration() {
    return this._duration
  }

  set duration(value: number | undefined) {
    this._duration = value ?? defaults.duration
  }

  get onStart() {
    return this._onStart
  }

  set onStart(value: (() => void) | undefined) {
    this._onStart = value ?? defaults.onStart
  }

  get onTrigger() {
    return this._onTrigger
  }

  set onTrigger(value: (() => void) | undefined) {
    this._onTrigger = value ?? defaults.onTrigger
  }

  get onCancel() {
    return this._onCancel
  }

  set onCancel(value: (() => void) | undefined) {
    this._onCancel = value ?? defaults.onCancel
  }

  getProxy() {
    const self = this
    if (!this.proxy) {
      let proxy = {
        get label() {
          return self.label
        },
        set label(value) {
          self.label = value
        },
        get distance() {
          return self.distance
        },
        set distance(value) {
          self.distance = value
        },
        get duration() {
          return self.duration
        },
        set duration(value) {
          self.duration = value
        },
        get onStart() {
          return self.onStart
        },
        set onStart(value) {
          self.onStart = value
        },
        get onTrigger() {
          return self.onTrigger
        },
        set onTrigger(value) {
          self.onTrigger = value
        },
        get onCancel() {
          return self.onCancel
        },
        set onCancel(value) {
          self.onCancel = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}
