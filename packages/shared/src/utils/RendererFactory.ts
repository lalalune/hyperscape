/**
 * Renderer Factory
 * 
 * Creates WebGPU or WebGL renderers with automatic backend selection.
 * Detects browser capabilities and configures rendering settings.
 */

import THREE from '../extras/three'

// WebGPU modules loaded on demand
let webgpuModulesLoaded = false
// Minimal capability surface for the WebGPU capability checker
let WebGPU: { isAvailable(): Promise<boolean> } | null = null
// Constructor type for the WebGPU renderer. We keep this structural to avoid
// depending on @types/three having WebGPU types available in all environments
type WebGPURendererClass = new (params: { canvas?: HTMLCanvasElement; antialias?: boolean }) => {
  init: () => Promise<void>
  setSize: (w: number, h: number) => void
  setPixelRatio: (r: number) => void
  render: (scene: THREE.Scene, camera: THREE.Camera) => void
  toneMapping: THREE.ToneMapping
  toneMappingExposure: number
  outputColorSpace: THREE.ColorSpace
  domElement: HTMLCanvasElement
  setAnimationLoop?: (cb: ((time: number) => void) | null) => void
  backend?: unknown
}
const WebGPURenderer: WebGPURendererClass | null = null

// Types for WebGPU capabilities
type WebGPUBackendLike = { device?: { features?: Iterable<string> } }
type WebGPURendererWithBackend = { backend?: WebGPUBackendLike }

async function ensureWebGPUModules() {
  if (webgpuModulesLoaded) return { WebGPU, WebGPURenderer }

  webgpuModulesLoaded = true
  const capabilityModules = await import('three/examples/jsm/capabilities/WebGPU.js')
  WebGPU = (capabilityModules as unknown as { default: { isAvailable(): Promise<boolean> } }).default


  return { WebGPU, WebGPURenderer }
}

export type UniversalRenderer = THREE.WebGLRenderer | InstanceType<WebGPURendererClass>

export interface RendererOptions {
  antialias?: boolean
  alpha?: boolean
  powerPreference?: 'high-performance' | 'low-power' | 'default'
  preserveDrawingBuffer?: boolean
  preferWebGPU?: boolean
  canvas?: HTMLCanvasElement
}

export interface RendererCapabilities {
  supportsWebGPU: boolean
  supportsWebGL2: boolean
  preferredBackend: 'webgpu' | 'webgl2'
  maxAnisotropy?: number
}

/**
 * Detect available rendering capabilities
 */
export async function detectRenderingCapabilities(): Promise<RendererCapabilities> {
  await ensureWebGPUModules()

  const supportsWebGPU = WebGPU ? await WebGPU.isAvailable() : false
  const supportsWebGL2 = true // Always available in modern browsers

  return {
    supportsWebGPU,
    supportsWebGL2,
    preferredBackend: supportsWebGPU ? 'webgpu' : 'webgl2',
  }
}

/**
 * Create a universal renderer (WebGPU or WebGL)
 */
export async function createRenderer(options: RendererOptions = {}): Promise<UniversalRenderer> {
  const {
    antialias = true,
    alpha = true,
    powerPreference = 'high-performance',
    preserveDrawingBuffer = false,
    preferWebGPU = true,
    canvas,
  } = options

  const capabilities = await detectRenderingCapabilities()

  // Try WebGPU first if preferred and available
  if (preferWebGPU && capabilities.supportsWebGPU && WebGPURenderer) {

    const renderer = new WebGPURenderer({
      canvas,
      antialias,
      // Note: alpha, preserveDrawingBuffer not needed in WebGPU
      // powerPreference handled differently in WebGPU
    })

    // Wait for WebGPU initialization
    await renderer.init()

    return renderer as UniversalRenderer
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias,
    alpha,
    powerPreference,
    preserveDrawingBuffer,
  })

  return renderer as UniversalRenderer
}

/**
 * Check if renderer is WebGPU
 */
export function isWebGPURenderer(renderer: UniversalRenderer): renderer is InstanceType<WebGPURendererClass> {
  // Structural check: WebGPU renderer exposes an async init()
  return typeof (renderer as { init?: () => Promise<void> }).init === 'function'
}

/**
 * Check if renderer is WebGL
 */
export function isWebGLRenderer(renderer: UniversalRenderer): renderer is THREE.WebGLRenderer {
  return renderer instanceof THREE.WebGLRenderer
}

/**
 * Get renderer backend type
 */
export function getRendererBackend(renderer: UniversalRenderer): 'webgpu' | 'webgl2' {
  return isWebGPURenderer(renderer) ? 'webgpu' : 'webgl2'
}

/**
 * Configure renderer with common settings
 */
export function configureRenderer(
  renderer: UniversalRenderer,
  options: {
    clearColor?: number
    clearAlpha?: number
    pixelRatio?: number
    width?: number
    height?: number
    toneMapping?: THREE.ToneMapping
    toneMappingExposure?: number
    outputColorSpace?: THREE.ColorSpace
  }
): void {
  const {
    clearColor = 0xffffff,
    clearAlpha = 0,
    pixelRatio = 1,
    width,
    height,
    toneMapping = THREE.ACESFilmicToneMapping,
    toneMappingExposure = 1,
    outputColorSpace = THREE.SRGBColorSpace,
  } = options

  // Clear color (WebGL only)
  if (isWebGLRenderer(renderer)) {
    renderer.setClearColor(clearColor, clearAlpha)
  } else if (isWebGPURenderer(renderer)) {
    // WebGPU uses background in scene, not renderer clear color
  }

  // Pixel ratio
  renderer.setPixelRatio(pixelRatio)

  // Size
  if (width && height) {
    renderer.setSize(width, height)
  }

  // Tone mapping (both support this)
  renderer.toneMapping = toneMapping
  renderer.toneMappingExposure = toneMappingExposure

  // Output color space (both support this)
  renderer.outputColorSpace = outputColorSpace

  // WebGPU-specific: Enable sRGB encoding optimizations
  if (isWebGPURenderer(renderer)) {
  }
}

/**
 * Configure shadow maps (WebGL only)
 */
export function configureShadowMaps(
  renderer: UniversalRenderer,
  options: {
    enabled?: boolean
    type?: THREE.ShadowMapType
  } = {}
): void {
  const { enabled = true, type = THREE.PCFSoftShadowMap } = options

  if (isWebGLRenderer(renderer)) {
    renderer.shadowMap.enabled = enabled
    renderer.shadowMap.type = type
  }
  // WebGPU handles shadows automatically per light
}

/**
 * Get max anisotropy (WebGL only)
 */
export function getMaxAnisotropy(renderer: UniversalRenderer): number {
  if (isWebGLRenderer(renderer)) {
    return renderer.capabilities.getMaxAnisotropy()
  }
  // WebGPU has different anisotropy handling
  return 16 // Default reasonable value
}

/**
 * Configure XR support
 */
export function configureXR(
  renderer: UniversalRenderer,
  options: {
    enabled?: boolean
    // eslint-disable-next-line no-undef
    referenceSpaceType?: XRReferenceSpaceType
    foveation?: number
  } = {}
): void {
  const { enabled = true, referenceSpaceType = 'local-floor', foveation = 0 } = options

  if (isWebGLRenderer(renderer) && renderer.xr) {
    renderer.xr.enabled = enabled
    renderer.xr.setReferenceSpaceType(referenceSpaceType)
    renderer.xr.setFoveation(foveation)
  }
  // WebGPU XR support is experimental - handle separately when available
}

/**
 * Check if XR is presenting
 */
export function isXRPresenting(renderer: UniversalRenderer): boolean {
  if (isWebGLRenderer(renderer) && renderer.xr) {
    return renderer.xr.isPresenting ?? false
  }
  return false
}

/**
 * Get WebGPU capabilities for logging and debugging
 */
export async function getWebGPUCapabilities(renderer: UniversalRenderer): Promise<{
  backend: string
  features: string[]
} | null> {
  if (!isWebGPURenderer(renderer)) {
    return null
  }

  const gpuRenderer = renderer as WebGPURendererWithBackend
  const device = gpuRenderer.backend?.device

  if (!device) {
    return { backend: 'webgpu', features: [] }
  }

  const features: string[] = []
  const iterable = device.features as unknown as { forEach?: (cb: (f: string) => void) => void } | Iterable<string>
  if (iterable && 'forEach' in iterable && typeof iterable.forEach === 'function') {
    iterable.forEach((feature: string) => features.push(feature))
  }

  return {
    backend: 'webgpu',
    features,
  }
}

/**
 * Apply WebGPU-specific logging after renderer creation
 * Note: Most WebGPU optimizations happen automatically
 */
export function logWebGPUInfo(renderer: UniversalRenderer): void {
  if (!isWebGPURenderer(renderer)) {
    return
  }

}

/**
 * Optimize materials for better rendering (works on both backends)
 */
export function optimizeMaterialForWebGPU(material: THREE.Material): void {
  if (!material) return

  type MaterialWithTextureProps = THREE.Material &
    Partial<Record<'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'emissiveMap', THREE.Texture | undefined>>

  // Enable anisotropic filtering on textures
  const textureProps: Array<keyof MaterialWithTextureProps> = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'emissiveMap',
  ]
  for (const prop of textureProps) {
    const tex = (material as MaterialWithTextureProps)[prop]
    if (tex instanceof THREE.Texture) {
      tex.anisotropy = THREE.Texture.DEFAULT_ANISOTROPY
    }
  }
}

/**
 * Create optimized instanced mesh (works on both backends)
 */
export function createOptimizedInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, count)
  mesh.frustumCulled = true
  return mesh
}
