import { fillRoundRect } from '../extras/roundRect'
import THREE, { toTHREEVector3 } from '../extras/three'
import CustomShaderMaterial from '../libs/three-custom-shader-material'
import { SystemBase } from './SystemBase'
import type { World } from '../types'
import { EventType } from '../types/events'
import type { NametagHandle as Nametag } from '../types/ui-types'

const _v3_1 = new THREE.Vector3()

/**
 * Nametags System
 *
 * - Runs on the client
 * - Utilizes a single atlas to draw names on, and a single instanced mesh to retain 1 draw call at all times
 * - Provides a hook to register and unregister nametag instances which can be moved around independently
 *
 */

const RES = 2
const NAMETAG_WIDTH = 160 * RES  // Reduced 20% (was 200)
const NAMETAG_HEIGHT = 20 * RES  // Reduced to fix Y-stretch (was 35)
const NAME_FONT_SIZE = 14 * RES  // Slightly smaller (was 16)
const NAME_OUTLINE_SIZE = 3 * RES  // Reduced proportionally (was 4)

const HEALTH_MAX = 100
const HEALTH_HEIGHT = 3 * RES  // Reduced 4x (was 12)
const HEALTH_WIDTH = 50 * RES  // Reduced 2x (was 100)
const HEALTH_BORDER = 1 * RES  // Reduced proportionally (was 1.5)
const HEALTH_BORDER_RADIUS = 10 * RES  // Reduced proportionally (was 20)

const PER_ROW = 8
const PER_COLUMN = 32
const MAX_INSTANCES = PER_ROW * PER_COLUMN

const defaultQuaternion = new THREE.Quaternion(0, 0, 0, 1)
const defaultScale = toTHREEVector3(new THREE.Vector3(1, 1, 1))

export class Nametags extends SystemBase {
  nametags: Nametag[]
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  texture: THREE.CanvasTexture
  uniforms: { uAtlas: { value: THREE.CanvasTexture }; uXR: { value: number }; uOrientation: { value: THREE.Quaternion } }
  material: CustomShaderMaterial
  geometry: THREE.PlaneGeometry
  mesh: THREE.InstancedMesh
  
  constructor(world: World) {
    super(world, { name: 'nametags', dependencies: { required: ['stage'], optional: [] }, autoCleanup: true })
    this.nametags = []
    this.canvas = document.createElement('canvas')
    this.canvas.width = NAMETAG_WIDTH * PER_ROW
    this.canvas.height = NAMETAG_HEIGHT * PER_COLUMN

    // DEBUG: show on screen
    // document.body.appendChild(this.canvas)
    // this.canvas.style = `position:absolute;top:0;left:0;z-index:9999;border:1px solid red;transform:scale(${1 / RES});transform-origin:top left;pointer-events:none;`

    this.ctx = this.canvas.getContext('2d')!
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.flipY = false
    this.texture.needsUpdate = true
    this.uniforms = {
      uAtlas: { value: this.texture },
      uXR: { value: 0 },
      // Use camera quaternion which always exists on THREE.PerspectiveCamera
      uOrientation: { value: this.world.camera.quaternion },
    }
    this.material = new CustomShaderMaterial({
      baseMaterial: THREE.MeshBasicMaterial,
      // all nametags are drawn on top of everything
      // this isn't perfect but we should be improve.
      // also note mesh.renderOrder=9999
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: this.uniforms,
      vertexShader: `
        attribute vec2 coords;
        uniform float uXR;
        uniform vec4 uOrientation;
        varying vec2 vUv;

        vec3 applyQuaternion(vec3 pos, vec4 quat) {
          vec3 qv = vec3(quat.x, quat.y, quat.z);
          vec3 t = 2.0 * cross(qv, pos);
          return pos + quat.w * t + cross(qv, t);
        }

        vec4 lookAtQuaternion(vec3 instancePos) {
          vec3 up = vec3(0.0, 1.0, 0.0);
          vec3 forward = normalize(cameraPosition - instancePos);
          
          // Handle degenerate cases
          if(length(forward) < 0.001) {
            return vec4(0.0, 0.0, 0.0, 1.0);
          }
          
          vec3 right = normalize(cross(up, forward));
          up = cross(forward, right);
          
          float m00 = right.x;
          float m01 = right.y;
          float m02 = right.z;
          float m10 = up.x;
          float m11 = up.y;
          float m12 = up.z;
          float m20 = forward.x;
          float m21 = forward.y;
          float m22 = forward.z;
          
          float trace = m00 + m11 + m22;
          vec4 quat;
          
          if(trace > 0.0) {
            float s = 0.5 / sqrt(trace + 1.0);
            quat = vec4(
              (m12 - m21) * s,
              (m20 - m02) * s,
              (m01 - m10) * s,
              0.25 / s
            );
          } else if(m00 > m11 && m00 > m22) {
            float s = 2.0 * sqrt(1.0 + m00 - m11 - m22);
            quat = vec4(
              0.25 * s,
              (m01 + m10) / s,
              (m20 + m02) / s,
              (m12 - m21) / s
            );
          } else if(m11 > m22) {
            float s = 2.0 * sqrt(1.0 + m11 - m00 - m22);
            quat = vec4(
              (m01 + m10) / s,
              0.25 * s,
              (m12 + m21) / s,
              (m20 - m02) / s
            );
          } else {
            float s = 2.0 * sqrt(1.0 + m22 - m00 - m11);
            quat = vec4(
              (m20 + m02) / s,
              (m12 + m21) / s,
              0.25 * s,
              (m01 - m10) / s
            );
          }
          
          return normalize(quat);
        }

        void main() {
          vec3 newPosition = position;
          if (uXR > 0.5) {
            // XR looks at camera
            vec3 instancePos = vec3(
              instanceMatrix[3][0],
              instanceMatrix[3][1],
              instanceMatrix[3][2]
            );
            vec4 lookAtQuat = lookAtQuaternion(instancePos);
            newPosition = applyQuaternion(newPosition, lookAtQuat);
          } else {
            // non-XR matches camera rotation
            newPosition = applyQuaternion(newPosition, uOrientation);
          }
          csm_Position = newPosition;
          
          // use uvs just for this slot
          vec2 atlasUV = uv; // original UVs are 0-1 for the plane
          atlasUV.y = 1.0 - atlasUV.y;
          atlasUV /= vec2(${PER_ROW}, ${PER_COLUMN});
          atlasUV += coords;
          vUv = atlasUV;          
        }
      `,
      fragmentShader: `
        uniform sampler2D uAtlas;
        varying vec2 vUv;
        
        void main() {
          vec4 texColor = texture2D(uAtlas, vUv);
          csm_FragColor = texColor;
        }
      `,
    } as ConstructorParameters<typeof CustomShaderMaterial>[0])
    this.geometry = new THREE.PlaneGeometry(1, NAMETAG_HEIGHT / NAMETAG_WIDTH)
    this.geometry.setAttribute('coords', new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES * 2), 2)) // xy coordinates in atlas
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_INSTANCES)
    this.mesh.renderOrder = 9999
    this.mesh.matrixAutoUpdate = false
    this.mesh.matrixWorldAutoUpdate = false
    this.mesh.frustumCulled = false
    this.mesh.count = 0
  }

  start() {
    this.world.stage.scene.add(this.mesh)
    this.subscribe(EventType.XR_SESSION, (session: XRSession | null) => this.onXRSession(session as unknown))
  }

  add({ name, health }: { name: string; health: number }): Nametag | null {
    const idx = this.nametags.length
    if (idx >= MAX_INSTANCES) {
      console.error('nametags: reached max')
      return null
    }

    // inc instances
    this.mesh.count++
    this.mesh.instanceMatrix.needsUpdate = true
    // set coords
    const row = Math.floor(idx / PER_ROW)
    const col = idx % PER_ROW
    const coords = this.mesh.geometry.attributes.coords as THREE.InstancedBufferAttribute
    coords.setXY(idx, col / PER_ROW, row / PER_COLUMN)
    coords.needsUpdate = true
    // make nametag
    const matrix = new THREE.Matrix4()
    const position = _v3_1.set(0, 0, 0)
    matrix.compose(position, defaultQuaternion, defaultScale)
    const nametag: Nametag = {
      idx,
      name,
      health,
      matrix,
      move: (newMatrix: THREE.Matrix4) => {
        // copy over just position
        matrix.elements[12] = newMatrix.elements[12] // x position
        matrix.elements[13] = newMatrix.elements[13] // y position
        matrix.elements[14] = newMatrix.elements[14] // z position
        this.mesh.setMatrixAt(nametag.idx, matrix)
        this.mesh.instanceMatrix.needsUpdate = true
      },
      setName: (name: string) => {
        if (nametag.name === name) return
        nametag.name = name
        this.draw(nametag)
      },
      setHealth: (health: number) => {
        if (nametag.health === health) return
        nametag.health = health
        this.draw(nametag)
      },
      destroy: () => {
        this.remove(nametag)
      },
    }
    this.nametags[idx] = nametag
    // draw it
    this.draw(nametag)
    return nametag
  }

  remove(nametag: Nametag) {
    if (!this.nametags.includes(nametag)) {
      return console.warn('nametags: attempted to remove non-existent nametag')
    }
    const last = this.nametags[this.nametags.length - 1]
    const isLast = nametag === last
    if (isLast) {
      // this is the last instance in the buffer, pop it off the end
      this.nametags.pop()
      // clear slot
      this.undraw(nametag)
    } else {
      // there are other instances after this one in the buffer...
      // so we move the last one into this slot
      this.undraw(last)
      // move last to this slot
      last.idx = nametag.idx
      this.draw(last)
      // update coords for swapped instance
      const coords = this.mesh.geometry.attributes.coords as THREE.InstancedBufferAttribute
      const row = Math.floor(nametag.idx / PER_ROW)
      const col = nametag.idx % PER_ROW
      coords.setXY(nametag.idx, col / PER_ROW, row / PER_COLUMN)
      coords.needsUpdate = true
      // swap nametag references and update matrix
      this.mesh.setMatrixAt(last.idx, last.matrix)
      this.nametags[last.idx] = last
      this.nametags.pop()
    }
    this.mesh.count--
    this.mesh.instanceMatrix.needsUpdate = true
  }

  private fitText(text: string, maxWidth: number): string {
    // Measure text and truncate if needed
    const metrics = this.ctx.measureText(text);
    if (metrics.width <= maxWidth) {
      return text;
    }
    
    // Truncate and add ellipsis
    let truncated = text;
    while (truncated.length > 0) {
      truncated = truncated.slice(0, -1);
      const testText = truncated + '...';
      const testMetrics = this.ctx.measureText(testText);
      if (testMetrics.width <= maxWidth) {
        return testText;
      }
    }
    return '...';
  }

  draw(nametag: Nametag) {
    const idx = nametag.idx
    const row = Math.floor(idx / PER_ROW)
    const col = idx % PER_ROW
    const x = col * NAMETAG_WIDTH
    const y = row * NAMETAG_HEIGHT
    // clear any previously drawn stuff
    this.ctx.clearRect(x, y, NAMETAG_WIDTH, NAMETAG_HEIGHT)
    // draw background
    // this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    // fillRoundRect(this.ctx, x, y, NAMETAG_WIDTH, NAMETAG_HEIGHT, NAMETAG_BORDER_RADIUS)
    // draw name
    this.ctx.font = `800 ${NAME_FONT_SIZE}px Rubik`
    this.ctx.fillStyle = 'white'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'top'
    this.ctx.lineWidth = NAME_OUTLINE_SIZE
    this.ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    const text = this.fitText(nametag.name, NAMETAG_WIDTH)
    this.ctx.save()
    this.ctx.globalCompositeOperation = 'xor'
    this.ctx.globalAlpha = 1 // Adjust as needed
    this.ctx.strokeText(text, x + NAMETAG_WIDTH / 2, y + 2)
    this.ctx.restore()
    this.ctx.fillText(text, x + NAMETAG_WIDTH / 2, y + 2)
    // draw health
    if (nametag.health < HEALTH_MAX) {
      // bar
      {
        const fillStyle = 'rgba(0, 0, 0, 0.6)'
        const width = HEALTH_WIDTH
        const height = HEALTH_HEIGHT
        const left = x + (NAMETAG_WIDTH - HEALTH_WIDTH) / 2
        const top = y + NAME_FONT_SIZE + 5
        const borderRadius = HEALTH_BORDER_RADIUS
        fillRoundRect(this.ctx, left, top, width, height, borderRadius, fillStyle)
      }
      // health
      {
        const fillStyle = '#229710'
        const maxWidth = HEALTH_WIDTH - HEALTH_BORDER * 2
        const perc = nametag.health / HEALTH_MAX
        const width = maxWidth * perc
        const height = HEALTH_HEIGHT - HEALTH_BORDER * 2
        const left = x + (NAMETAG_WIDTH - HEALTH_WIDTH) / 2 + HEALTH_BORDER
        const top = y + NAME_FONT_SIZE + 5 + HEALTH_BORDER
        const borderRadius = HEALTH_BORDER_RADIUS
        fillRoundRect(this.ctx, left, top, width, height, borderRadius, fillStyle)
      }
    }
    // update texture
    this.texture.needsUpdate = true
  }

  undraw(nametag: Nametag) {
    const idx = nametag.idx
    const row = Math.floor(idx / PER_ROW)
    const col = idx % PER_ROW
    const x = col * NAMETAG_WIDTH
    const y = row * NAMETAG_HEIGHT
    // clear any previously drawn stuff
    this.ctx.clearRect(x, y, NAMETAG_WIDTH, NAMETAG_HEIGHT)
    // update texture
    this.texture.needsUpdate = true
  }

  onXRSession = (session: unknown) => {
    this.uniforms.uXR.value = session ? 1 : 0
  }
}
