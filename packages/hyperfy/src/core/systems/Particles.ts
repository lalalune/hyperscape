import { System } from './System'
import * as THREE from '../extras/three'
import CustomShaderMaterial from '../libs/three-custom-shader-material'
import { DEG2RAD } from '../extras/general'
import { uuid } from '../utils'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const e1 = new THREE.Euler(0, 0, 0, 'YXZ')
const arr1: number[] = []
const arr2: number[] = []

const billboardModeInts: Record<string, number> = {
  full: 0,
  y: 1,
  direction: 2,
}

let worker: Worker | null = null
function getWorker() {
  if (!worker) {
    const particlesPath = (window as any).PARTICLES_PATH
    if (!particlesPath || particlesPath === '{particlesPath}') {
      console.warn('[Particles] PARTICLES_PATH not set, using default')
      // Use a default path for development
      worker = new Worker('/particles.js')
    } else {
      worker = new Worker(particlesPath)
    }
  }
  return worker
}

export class Particles extends System {
  worker: Worker | null
  uOrientationFull: { value: THREE.Quaternion }
  uOrientationY: { value: THREE.Quaternion }
  emitters: Map<string, any>
  
  constructor(world: any) {
    super(world)
    this.worker = null
    this.uOrientationFull = { value: new THREE.Quaternion() }
    this.uOrientationY = { value: new THREE.Quaternion() }
    this.emitters = new Map() // id -> emitter
  }

  async init(): Promise<void> {
    this.worker = getWorker()
    this.worker.onmessage = this.onMessage
    this.worker.onerror = this.onError
    
    // Set the initial quaternion value after world is initialized
    if (this.world.rig && this.world.rig.quaternion) {
      this.uOrientationFull.value = this.world.rig.quaternion
    }
  }

  start() {
    this.world.on?.('xrSession', this.onXRSession)
  }

  register(node: any) {
    return createEmitter(this.world, this, node)
  }

  update(delta: number) {
    // Ensure we have a valid quaternion
    const quaternion = this.world.rig?.quaternion || this.uOrientationFull.value;
    if (!quaternion) {
      console.warn('[Particles] No quaternion available for orientation');
      return;
    }
    
    e1.setFromQuaternion(quaternion)
    e1.x = 0
    e1.z = 0
    this.uOrientationY.value.setFromEuler(e1)

    this.emitters.forEach((emitter, id) => {
      if (!emitter || typeof emitter.update !== 'function') {
        console.error(`[Particles] Invalid emitter found:`, id, emitter);
        return;
      }
      try {
        emitter.update(delta)
      } catch (error) {
        console.error(`[Particles] Error updating emitter ${id}:`, error);
        throw error;
      }
    })
  }

  onMessage = (msg: MessageEvent) => {
    const data = msg.data
    // console.log('[Particles] onMessage', data)
    this.emitters.get(data.emitterId)?.onMessage(data)
  }

  onError = (err: ErrorEvent) => {
    console.error('[ParticleSystem]', err)
  }

  onXRSession = (session: any) => {
    const xr = (this.world as any).xr
    this.uOrientationFull.value = session ? xr?.camera.quaternion : this.world.rig.quaternion
  }
}

function createEmitter(world: any, system: Particles, node: any) {
  const id = uuid()
  const config = node.getConfig()

  const geometry = new THREE.PlaneGeometry(1, 1)

  const aPosition = new THREE.InstancedBufferAttribute(new Float32Array(node._max * 3), 3)
  aPosition.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('aPosition', aPosition)

  const aRotation = new THREE.InstancedBufferAttribute(new Float32Array(node._max * 1), 1)
  aRotation.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('aRotation', aRotation)

  const aDirection = new THREE.InstancedBufferAttribute(new Float32Array(node._max * 3), 3)
  aDirection.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('aDirection', aDirection)

  const aSize = new THREE.InstancedBufferAttribute(new Float32Array(node._max * 1), 1)
  aSize.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('aSize', aSize)

  const aColor = new THREE.InstancedBufferAttribute(new Float32Array(node._max * 3), 3)
  aColor.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('aColor', aColor)

  const aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(node._max * 1), 1)
  aAlpha.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('aAlpha', aAlpha)

  const aEmissive = new THREE.InstancedBufferAttribute(new Float32Array(node._max * 1), 1)
  aEmissive.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('aEmissive', aEmissive)

  const aUV = new THREE.InstancedBufferAttribute(new Float32Array(node._max * 4), 4)
  aUV.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('aUV', aUV)

  // ping-pong buffers
  const next = {
    aPosition: new Float32Array(node._max * 3),
    aRotation: new Float32Array(node._max * 1),
    aDirection: new Float32Array(node._max * 3),
    aSize: new Float32Array(node._max * 1),
    aColor: new Float32Array(node._max * 3),
    aAlpha: new Float32Array(node._max * 1),
    aEmissive: new Float32Array(node._max * 1),
    aUV: new Float32Array(node._max * 4),
  }

  const texture = new THREE.Texture()
  texture.colorSpace = THREE.SRGBColorSpace

  const uniforms = {
    uTexture: { value: texture },
    uBillboard: { value: billboardModeInts[node._billboard as string] || 0 },
    uOrientation: node._billboard === 'full' ? system.uOrientationFull : system.uOrientationY,
  }
  world.loader.load('texture', node._image).then((texture: THREE.Texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    uniforms.uTexture.value = texture
    // console.log(t)
    // texture.image = t.image
    // texture.needsUpdate = true
  })

  const material = new CustomShaderMaterial({
    baseMaterial: node._lit ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial,
    ...(node._lit ? { roughness: 1, metalness: 0 } : {}),
    blending: node._blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
    transparent: true,
    premultipliedAlpha: true,
    color: 'white',
    side: THREE.DoubleSide,
    // side: THREE.FrontSide,
    depthWrite: false,
    depthTest: true,
    uniforms,
    patchMap: {},
    cacheKey: '',
    vertexShader: `
      attribute vec3 aPosition;
      attribute float aRotation;
      attribute vec3 aDirection;
      attribute float aSize;
      attribute vec3 aColor;
      attribute float aAlpha;
      attribute float aEmissive;
      attribute vec4 aUV;  // u0, v0, u1, v1

      uniform float uBillboard;
      uniform vec4 uOrientation;

      varying vec2 vUv;
      varying vec4 vColor;
      varying float vEmissive;

      const float DEG2RAD = ${DEG2RAD};

      mat3 rotationFromDirection(vec3 dir) {
        vec3 n = normalize(dir);              // target normal (+Z after the rotation)
        vec3 up = vec3(0.0, 1.0, 0.0);
        // pick a new 'up' if we are too parallel
        if (abs(dot(n, up)) > 0.99) {
          up = vec3(1.0, 0.0, 0.0);
        } 
        vec3 right = normalize(cross(up, n)); // 1st column
        up = cross(n, right); // 2nd column (already normalised)
        return mat3(
          right,  // column 0
          up,     // column 1
          n       // column 2  ←  billboard normal
        );                   
      }

      vec3 applyQuaternion(vec3 pos, vec4 quat) {
        vec3 qv = vec3(quat.x, quat.y, quat.z);
        vec3 t = 2.0 * cross(qv, pos);
        return pos + quat.w * t + cross(qv, t);
      }

      void main() {
        // vUv = uv;
        // Pass UV coordinates to fragment shader
        // Map plane UV (0-1) to the frame UV rectangle
        vUv = vec2(
          mix(aUV.x, aUV.z, uv.x),
          mix(aUV.y, aUV.w, uv.y)
        );

        // Start with original position
        vec3 newPosition = position;

        // Apply size
        newPosition.xy *= aSize;

        // Apply rotation
        float rot = aRotation * DEG2RAD;
        float cosRot = cos(rot);
        float sinRot = sin(rot);
        newPosition.xy = vec2(
          newPosition.x * cosRot + newPosition.y * sinRot,
          -newPosition.x * sinRot + newPosition.y * cosRot
        );

        // Apply billboard
        if (uBillboard < 0.1) {
          // full
          newPosition = applyQuaternion(newPosition, uOrientation);
        } else if (uBillboard < 1.1) {
          // y
          newPosition = applyQuaternion(newPosition, uOrientation);
        } else {
          // direction 
          newPosition = rotationFromDirection(aDirection) * newPosition;
        }
        
        // Apply particle position
        newPosition += aPosition;
        
        // Set final position
        csm_Position = newPosition;

        // Set color varying for the fragment shader
        vColor = vec4(aColor.rgb, aAlpha);
        vEmissive = aEmissive;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;

      varying vec2 vUv;
      varying vec4 vColor;
      varying float vEmissive;

      void main() {
        vec4 texColor = texture(uTexture, vUv);
        vec4 baseColor = texColor * vColor;
        baseColor.rgb *= vEmissive;
        csm_DiffuseColor = baseColor;
      }
    `,
  })
  const mesh = new THREE.InstancedMesh(geometry, material, node._max) as any
  mesh._node = node
  mesh.count = 0
  mesh.instanceMatrix.needsUpdate = true
  mesh.frustumCulled = false
  mesh.matrixAutoUpdate = false
  mesh.matrixWorldAutoUpdate = false
  world.stage.scene.add(mesh)

  let matrixWorld = node.matrixWorld

  let pending = false
  let skippedDelta = 0

  function send(msg: any, transfers?: Transferable[]) {
    msg.emitterId = id
    if (system.worker) {
      if (transfers) {
        system.worker.postMessage(msg, transfers)
      } else {
        system.worker.postMessage(msg)
      }
    }
  }

  function setEmitting(value: boolean) {
    send({ op: 'emitting', value })
  }

  function onMessage(msg: any) {
    if (msg.op === 'update') {
      const n = msg.n

      // Store current arrays in next before replacing
      next.aPosition = new Float32Array(aPosition.array as unknown as ArrayBuffer)
      next.aRotation = new Float32Array(aRotation.array as unknown as ArrayBuffer)
      next.aDirection = new Float32Array(aDirection.array as unknown as ArrayBuffer)
      next.aSize = new Float32Array(aSize.array as unknown as ArrayBuffer)
      next.aColor = new Float32Array(aColor.array as unknown as ArrayBuffer)
      next.aAlpha = new Float32Array(aAlpha.array as unknown as ArrayBuffer)
      next.aEmissive = new Float32Array(aEmissive.array as unknown as ArrayBuffer)
      next.aUV = new Float32Array(aUV.array as unknown as ArrayBuffer)

      aPosition.array = msg.aPosition as any
      aPosition.addUpdateRange(0, n * 3)
      aPosition.needsUpdate = true
      aRotation.array = msg.aRotation as any
      aRotation.addUpdateRange(0, n * 1)
      aRotation.needsUpdate = true
      aDirection.array = msg.aDirection as any
      aDirection.addUpdateRange(0, n * 3)
      aDirection.needsUpdate = true
      aSize.array = msg.aSize as any
      aSize.addUpdateRange(0, n * 1)
      aSize.needsUpdate = true
      aColor.array = msg.aColor as any
      aColor.addUpdateRange(0, n * 3)
      aColor.needsUpdate = true
      aAlpha.array = msg.aAlpha as any
      aAlpha.addUpdateRange(0, n * 1)
      aAlpha.needsUpdate = true
      aEmissive.array = msg.aEmissive as any
      aEmissive.addUpdateRange(0, n * 1)
      aEmissive.needsUpdate = true
      aUV.array = msg.aUV as any
      aUV.addUpdateRange(0, n * 4)
      aUV.needsUpdate = true

      mesh.count = n
      pending = false
    }
    if (msg.op === 'end') {
      node._onEnd?.()
    }
  }

  function update(delta: number) {
    const camPosition = v1.setFromMatrixPosition(world.camera.matrixWorld)
    const worldPosition = v2.setFromMatrixPosition(matrixWorld)

    // draw emitter back-to-front
    const distance = camPosition.distanceTo(worldPosition)
    mesh.renderOrder = -distance

    if (pending) {
      skippedDelta += delta
    } else {
      delta += skippedDelta
      skippedDelta = 0
      const aPosition = next.aPosition
      const aRotation = next.aRotation
      const aDirection = next.aDirection
      const aSize = next.aSize
      const aColor = next.aColor
      const aAlpha = next.aAlpha
      const aEmissive = next.aEmissive
      const aUV = next.aUV
      pending = true
      // console.log('update', node.matrixWorld.toArray(arr2))
      send(
        {
          op: 'update',
          delta,
          camPosition: camPosition.toArray(arr1),
          matrixWorld: matrixWorld.toArray(arr2),
          aPosition,
          aRotation,
          aDirection,
          aSize,
          aColor,
          aAlpha,
          aEmissive,
          aUV,
        },
        [
          // prettier-ignore
          aPosition.buffer,
          aRotation.buffer,
          aDirection.buffer,
          aSize.buffer,
          aColor.buffer,
          aAlpha.buffer,
          aEmissive.buffer,
          aUV.buffer,
        ]
      )
    }
  }

  function destroy() {
    system.emitters.delete(id)
    if (system.worker) {
      system.worker.postMessage({ op: 'destroy', emitterId: id })
    }
    world.stage.scene.remove(mesh)
    mesh.material.dispose()
    mesh.geometry.dispose()
  }

  const handle = {
    id,
    node,
    send,
    setEmitting,
    onMessage,
    update,
    destroy,
  }
  system.emitters.set(id, handle)
  if (system.worker) {
    system.worker.postMessage({ op: 'create', id, ...config })
  }
  return handle
}
