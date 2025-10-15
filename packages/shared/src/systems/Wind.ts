/**
 * Wind.ts - Environmental Wind Effect System
 * 
 * Provides shader uniforms for animating foliage and particles with wind.
 * Creates realistic swaying motion for trees, grass, and other vegetation.
 * 
 * **How It Works:**
 * - Provides time and strength uniforms to shaders
 * - Materials can read wind uniforms for vertex displacement
 * - Time value increments each frame for animation
 * - Strength controls wind intensity
 * 
 * **Shader Integration:**
 * Custom shaders can access wind uniforms:
 * - uniform float time: Animated time value
 * - uniform float windStrength: Wind strength (0-1)
 * - uniform vec3 windDirection: Wind direction vector
 * - uniform float windFrequency: Oscillation frequency
 * 
 * **Usage:**
 * Wind system is passive - it just provides uniforms.
 * Materials opt-in by reading the uniforms in their shaders.
 * 
 * **Referenced by:** Custom shaders, vegetation materials, particle systems
 */

import THREE from '../extras/three'

import { System } from './System'
import type { World } from '../types'
import type { WindUniforms } from '../types/physics'

/**
 * Wind System - Environmental Wind Effects
 * 
 * Provides animated wind uniforms for shader-based vegetation movement.
 */
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
