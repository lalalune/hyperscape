import THREE from '../extras/three'

import { Node } from './Node'
import type { AudioData, DistanceModelType } from '../types/nodes'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const q1 = new THREE.Quaternion()

const _groups = ['music', 'sfx']
const _distanceModels = ['linear', 'inverse', 'exponential']

const defaults = {
  src: null,
  volume: 1,
  loop: false,
  group: 'music',
  // see: https://medium.com/@kfarr/understanding-web-audio-api-positional-audio-distance-models-for-webxr-e77998afcdff
  spatial: true,
  distanceModel: 'inverse',
  refDistance: 1,
  maxDistance: 40,
  rolloffFactor: 3,
  coneInnerAngle: 360,
  coneOuterAngle: 360,
  coneOuterGain: 0,
}

export class Audio extends Node {
  n: number
  source: AudioBufferSourceNode | null
  gainNode: GainNode | null
  pannerNode: PannerNode | null
  offset: number
  shouldPlay: boolean
  startTime: number | null
  needsRebuild: boolean = false
  _src: string | null = null
  _volume: number = 1
  _loop: boolean = false
  _group: string = 'sfx'
  _spatial: boolean = false
  _distanceModel: DistanceModelType = 'linear'
  _refDistance: number = 1
  _maxDistance: number = 10000
  _rolloffFactor: number = 1
  _coneInnerAngle: number = 360
  _coneOuterAngle: number = 360
  _coneOuterGain: number = 0
  constructor(data: AudioData = {}) {
    super(data)
    this.name = 'audio'

    this.src = data.src ?? null
    this.volume = data.volume ?? 1
    this.loop = data.loop ?? false
    this.group = data.group ?? 'sfx'
    this.spatial = data.spatial ?? true
    this.distanceModel = data.distanceModel ?? 'inverse'
    this.refDistance = data.refDistance ?? 1
    this.maxDistance = data.maxDistance ?? 40
    this.rolloffFactor = data.rolloffFactor ?? 3
    this.coneInnerAngle = data.coneInnerAngle ?? 360
    this.coneOuterAngle = data.coneOuterAngle ?? 360
    this.coneOuterGain = data.coneOuterGain ?? 0

    this.n = 0
    this.source = null
    this.gainNode = null
    this.pannerNode = null

    this.offset = 0
    this.shouldPlay = false
    this.startTime = null
  }

  async mount() {
    // ...
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.needsRebuild = false
      if (this.source) {
        this.pause()
        this.play()
      }
      return
    }
    if (didMove) {
      this.updatePannerPosition()
    }
  }

  unmount() {
    this.stop()
  }

  updatePannerPosition() {
    if (!this.pannerNode) return
    const audio = this.ctx?.audio
    if (!audio) return
    const pos = v1.setFromMatrixPosition(this.matrixWorld)
    const qua = q1.setFromRotationMatrix(this.matrixWorld)
    const dir = v2.set(0, 0, -1).applyQuaternion(qua)
    if (this.pannerNode.positionX) {
      const endTime = audio.ctx.currentTime + audio.lastDelta
      this.pannerNode.positionX.linearRampToValueAtTime(pos.x, endTime)
      this.pannerNode.positionY.linearRampToValueAtTime(pos.y, endTime)
      this.pannerNode.positionZ.linearRampToValueAtTime(pos.z, endTime)
      this.pannerNode.orientationX.linearRampToValueAtTime(dir.x, endTime)
      this.pannerNode.orientationY.linearRampToValueAtTime(dir.y, endTime)
      this.pannerNode.orientationZ.linearRampToValueAtTime(dir.z, endTime)
    } else {
      this.pannerNode.setPosition(pos.x, pos.y, pos.z)
      this.pannerNode.setOrientation(dir.x, dir.y, dir.z)
    }
  }

  copy(source: Audio, recursive: boolean) {
    super.copy(source, recursive)
    this._src = source._src
    this._volume = source._volume
    this._loop = source._loop
    this._group = source._group
    this._spatial = source._spatial
    this._distanceModel = source._distanceModel
    this._refDistance = source._refDistance
    this._maxDistance = source._maxDistance
    this._rolloffFactor = source._rolloffFactor
    this._coneInnerAngle = source._coneInnerAngle
    this._coneOuterAngle = source._coneOuterAngle
    this._coneOuterGain = source._coneOuterGain
    return this
  }

  get src() {
    return this._src
  }

  set src(value: string | null) {
    if (!value) value = defaults.src

    this._src = value || null
    this.needsRebuild = true
    this.setDirty()
  }

  get volume() {
    return this._volume
  }

  set volume(value: number) {
    if (!value && value !== 0) value = defaults.volume

    this._volume = value
    if (this.gainNode) {
      this.gainNode.gain.value = this._volume
    }
  }

  get loop() {
    return this._loop
  }

  set loop(value: boolean) {
    if (value === undefined || value === null) value = defaults.loop

    this._loop = value
    this.needsRebuild = true
    this.setDirty()
  }

  get group() {
    return this._group
  }

  set group(value: string) {
    if (!value) value = defaults.group

    this._group = value
    this.needsRebuild = true
    this.setDirty()
  }

  get spatial() {
    return this._spatial
  }

  set spatial(value: boolean) {
    if (value === undefined || value === null) value = defaults.spatial

    this._spatial = value
    this.needsRebuild = true
    this.setDirty()
  }

  get distanceModel() {
    return this._distanceModel
  }

  set distanceModel(value: string) {
    if (!value) value = defaults.distanceModel

    this._distanceModel = value as DistanceModelType
    if (this.pannerNode) {
      this.pannerNode.distanceModel = this._distanceModel
    }
  }

  get refDistance() {
    return this._refDistance
  }

  set refDistance(value: number) {
    if (!value && value !== 0) value = defaults.refDistance

    this._refDistance = value
    if (this.pannerNode) {
      this.pannerNode.refDistance = this._refDistance
    }
  }

  get maxDistance() {
    return this._maxDistance
  }

  set maxDistance(value: number) {
    if (!value && value !== 0) value = defaults.maxDistance

    this._maxDistance = value
    if (this.pannerNode) {
      this.pannerNode.maxDistance = this._maxDistance
    }
  }

  get rolloffFactor() {
    return this._rolloffFactor
  }

  set rolloffFactor(value: number) {
    if (!value && value !== 0) value = defaults.rolloffFactor

    this._rolloffFactor = value
    if (this.pannerNode) {
      this.pannerNode.rolloffFactor = this._rolloffFactor
    }
  }

  get coneInnerAngle() {
    return this._coneInnerAngle
  }

  set coneInnerAngle(value: number) {
    if (!value && value !== 0) value = defaults.coneInnerAngle

    this._coneInnerAngle = value
    if (this.pannerNode) {
      this.pannerNode.coneInnerAngle = this._coneInnerAngle
    }
  }

  get coneOuterAngle() {
    return this._coneOuterAngle
  }

  set coneOuterAngle(value: number) {
    if (!value && value !== 0) value = defaults.coneOuterAngle

    this._coneOuterAngle = value
    if (this.pannerNode) {
      this.pannerNode.coneOuterAngle = this._coneOuterAngle
    }
  }

  get coneOuterGain() {
    return this._coneOuterGain
  }

  set coneOuterGain(value: number) {
    if (!value && value !== 0) value = defaults.coneOuterGain

    this._coneOuterGain = value
    if (this.pannerNode) {
      this.pannerNode.coneOuterGain = this._coneOuterGain
    }
  }

  get currentTime() {
    const audio = this.ctx?.audio
    if (!audio) {
      return 0
    }
    if (this.source && this.startTime !== null) {
      return audio.ctx.currentTime - this.startTime
    }
    return this.offset
  }

  set currentTime(time) {

    const offset = Math.max(0, time)
    if (this.source) {
      this.stop()
      this.offset = offset
      this.play()
    } else {
      this.offset = offset
    }
  }

  get isPlaying() {
    return !!this.source
  }

  async play(restartIfPlaying = false) {
    if (!this.ctx) return // not mounted
    const loader = this.ctx?.loader
    const audio = this.ctx?.audio
    if (!audio) return
    if (!this._src) return
    if (restartIfPlaying) this.stop()
    if (this.source) return
    const n = ++this.n
    let buffer
    try {
      buffer = loader!.get('audio', this._src)
      if (!buffer) buffer = await loader!.load('audio', this._src)
    } catch (err) {
      console.error(err)
      return
    }
    if (n !== this.n) return

    this.source = audio.ctx.createBufferSource()
    if (this.source) {
      this.source.buffer = buffer
      this.source.loop = this._loop
    }

    this.gainNode = audio.ctx.createGain()
    if (this.gainNode) {
      this.gainNode.gain.value = this._volume
    }

    if (this._spatial) {
      this.pannerNode = audio.ctx.createPanner()
      if (this.pannerNode) {
        this.pannerNode.panningModel = 'HRTF'
        this.pannerNode.distanceModel = this._distanceModel
        this.pannerNode.refDistance = this._refDistance
        this.pannerNode.maxDistance = this._maxDistance
        this.pannerNode.rolloffFactor = this._rolloffFactor
        this.pannerNode.coneInnerAngle = this._coneInnerAngle
        this.pannerNode.coneOuterAngle = this._coneOuterAngle
        this.pannerNode.coneOuterGain = this._coneOuterGain
      }
      if (this.source && this.gainNode) {
        this.source.connect(this.gainNode)
      }
      if (this.gainNode && this.pannerNode) {
        this.gainNode.connect(this.pannerNode)
      }
      if (this.pannerNode) {
        this.pannerNode.connect(audio.groupGains![this._group])
      }
      this.updatePannerPosition()
    } else {
      if (this.source && this.gainNode) {
        this.source.connect(this.gainNode)
      }
      if (this.gainNode) {
        this.gainNode.connect(audio.groupGains![this._group])
      }
    }

    audio.ready(() => {
      if (n !== this.n) return
      this.startTime = audio.ctx.currentTime - this.offset
      if (this.source) {
        this.source.start(0, this.offset)
        if (!this._loop) {
          this.source.onended = () => this.stop()
        }
      }
    })
  }

  pause() {
    const audio = this.ctx?.audio
    if (!audio) return
    if (this.source && this.startTime !== null) {
      this.n++
      this.offset = audio.ctx.currentTime - this.startTime
      this.source.onended = null
      this.source.stop()
      this.source = null
      this.gainNode?.disconnect()
      this.gainNode = null
      this.pannerNode?.disconnect()
      this.pannerNode = null
    }
  }

  stop() {
    const audio = this.ctx?.audio
    if (!audio) return
    this.n++
    this.offset = 0
    if (this.source) {
      this.source.onended = null
      this.source?.stop()
      this.source = null
      this.gainNode?.disconnect()
      this.gainNode = null
      this.pannerNode?.disconnect()
      this.pannerNode = null
    }
  }

  setPlaybackRate(rate) {
    const audio = this.ctx?.audio
    if (!audio) return
    const endTime = audio.ctx.currentTime + audio.lastDelta
    this.source?.playbackRate.linearRampToValueAtTime(rate, endTime)
  }

  getProxy() {
    const self = this
    if (!this.proxy) {
      let proxy = {
        get src() {
          return self.src
        },
        set src(value) {
          self.src = value
        },
        get volume() {
          return self.volume
        },
        set volume(value) {
          self.volume = value
        },
        get loop() {
          return self.loop
        },
        set loop(value) {
          self.loop = value
        },
        get group() {
          return self.group
        },
        set group(value) {
          self.group = value
        },
        get spatial() {
          return self.spatial
        },
        set spatial(value) {
          self.spatial = value
        },
        get distanceModel() {
          return self.distanceModel
        },
        set distanceModel(value) {
          self.distanceModel = value
        },
        get refDistance() {
          return self.refDistance
        },
        set refDistance(value) {
          self.refDistance = value
        },
        get maxDistance() {
          return self.maxDistance
        },
        set maxDistance(value) {
          self.maxDistance = value
        },
        get rolloffFactor() {
          return self.rolloffFactor
        },
        set rolloffFactor(value) {
          self.rolloffFactor = value
        },
        get coneInnerAngle() {
          return self.coneInnerAngle
        },
        set coneInnerAngle(value) {
          self.coneInnerAngle = value
        },
        get coneOuterAngle() {
          return self.coneOuterAngle
        },
        set coneOuterAngle(value) {
          self.coneOuterAngle = value
        },
        get coneOuterGain() {
          return self.coneOuterGain
        },
        set coneOuterGain(value) {
          self.coneOuterGain = value
        },
        get currentTime() {
          return self.currentTime
        },
        set currentTime(value) {
          self.currentTime = value
        },
        get isPlaying() {
          return self.isPlaying
        },
        play(restartIfPlaying) {
          self.play(restartIfPlaying)
        },
        pause() {
          self.pause()
        },
        stop() {
          self.stop()
        },
        setPlaybackRate(rate) {
          self.setPlaybackRate(rate)
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}


