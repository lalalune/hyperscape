import THREE from '../extras/three'

import { System } from './System'
import type { World } from '../types'
import type { WindUniforms } from '../types/physics'

export class Wind extends System {
  uniforms: WindUniforms
  
  constructor(world: World) {
    super(world)
    this.uniforms = {
      time: { value: 0 },
      windStrength: { value: 1 }, // 3 nice for pine
      windDirection: { value: new THREE.Vector3(1, 0, 0) },
      windFrequency: { value: 0.5 }, // 0.1 nice for pine
    }
  }

  update(delta: number) {
    this.uniforms.time.value += delta
  }
}
