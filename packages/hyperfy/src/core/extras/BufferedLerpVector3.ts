import * as THREE from './three.js'

export class BufferedLerpVector3 {
  value: THREE.Vector3
  rate: number
  previous: THREE.Vector3
  current: THREE.Vector3
  time: number
  snapToken: null
  buffer: Array<{ value: THREE.Vector3; time: number }>
  maxBufferSize: number
  constructor(value: THREE.Vector3, rate: number) {
    this.value = value
    this.rate = rate // receive rate eg 1/5 for 5hz
    this.previous = new THREE.Vector3().copy(this.value)
    this.current = new THREE.Vector3().copy(this.value)
    this.time = 0
    this.snapToken = null
    this.buffer = []
    this.maxBufferSize = 10
  }

  push(value, snapToken = null) {
    if (this.snapToken !== snapToken) {
      this.snapToken = snapToken
      this.previous.copy(value)
      this.current.copy(value)
      this.value.copy(value)
      this.buffer = []
    } else {
      this.buffer.push({
        value: new THREE.Vector3().copy(value),
        time: performance.now()
      })
      
      // Limit buffer size
      if (this.buffer.length > this.maxBufferSize) {
        this.buffer.shift()
      }
      
      this.previous.copy(this.current)
      this.current.copy(value)
    }
    this.time = 0
  }

  pushArray(value, snapToken = null) {
    const vec = new THREE.Vector3().fromArray(value)
    this.push(vec, snapToken)
  }

  update(delta) {
    this.time += delta
    let alpha = this.time / this.rate
    if (alpha > 1) alpha = 1
    
    // Use buffer for smoother interpolation if available
    if (this.buffer.length > 1) {
      const now = performance.now()
      const recent = this.buffer.filter(item => now - item.time < this.rate * 1000)
      
      if (recent.length > 0) {
        const target = recent[recent.length - 1].value
        this.value.lerpVectors(this.previous, target, alpha)
      } else {
        this.value.lerpVectors(this.previous, this.current, alpha)
      }
    } else {
      this.value.lerpVectors(this.previous, this.current, alpha)
    }
    
    return this
  }

  snap() {
    this.previous.copy(this.current)
    this.value.copy(this.current)
    this.time = 0
    this.buffer = []
  }

  clear() {
    this.previous.copy(this.value)
    this.current.copy(this.value)
    this.time = 0
    this.buffer = []
  }
}