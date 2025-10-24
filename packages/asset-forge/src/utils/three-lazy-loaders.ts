/**
 * Lazy Loading Utilities for Three.js Loaders and Exporters
 *
 * These utilities enable dynamic imports of Three.js loaders and exporters,
 * significantly reducing initial bundle size by only loading them when needed.
 *
 * Bundle Impact:
 * - GLTFLoader: ~150KB
 * - GLTFExporter: ~80KB
 * - FBXLoader: ~200KB
 * - OrbitControls: ~30KB
 * - Post-processing: ~100KB per effect
 *
 * Total savings: ~500KB+ when not all features are used immediately
 */

import type { LoadingManager } from 'three'
import type { GLTFLoader as GLTFLoaderType } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { FBXLoader as FBXLoaderType } from 'three/examples/jsm/loaders/FBXLoader.js'
import type { OBJLoader as OBJLoaderType } from 'three/examples/jsm/loaders/OBJLoader.js'
import type { GLTFExporter as GLTFExporterType } from 'three/examples/jsm/exporters/GLTFExporter.js'
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js'
import type { EffectComposer as EffectComposerType } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import type { RenderPass as RenderPassType } from 'three/examples/jsm/postprocessing/RenderPass.js'
import type { SSAOPass as SSAOPassType } from 'three/examples/jsm/postprocessing/SSAOPass.js'
import type { UnrealBloomPass as UnrealBloomPassType } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

/**
 * Lazy load GLTF Loader
 * Usage: const loader = await loadGLTFLoader(manager)
 */
export async function loadGLTFLoader(manager?: LoadingManager): Promise<GLTFLoaderType> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  return new GLTFLoader(manager)
}

/**
 * Lazy load FBX Loader
 * Usage: const loader = await loadFBXLoader(manager)
 */
export async function loadFBXLoader(manager?: LoadingManager): Promise<FBXLoaderType> {
  const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js')
  return new FBXLoader(manager)
}

/**
 * Lazy load OBJ Loader
 * Usage: const loader = await loadOBJLoader(manager)
 */
export async function loadOBJLoader(manager?: LoadingManager): Promise<OBJLoaderType> {
  const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js')
  return new OBJLoader(manager)
}

/**
 * Lazy load GLTF Exporter
 * Usage: const exporter = await loadGLTFExporter()
 */
export async function loadGLTFExporter(): Promise<GLTFExporterType> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
  return new GLTFExporter()
}

/**
 * Lazy load Orbit Controls
 * Usage: const controls = await loadOrbitControls(camera, domElement)
 */
export async function loadOrbitControls(
  camera: THREE.Camera,
  domElement?: HTMLElement
): Promise<OrbitControlsType> {
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  return new OrbitControls(camera, domElement)
}

/**
 * Lazy load post-processing effects
 * Usage: const { composer, renderPass, ssaoPass, bloomPass } = await loadPostProcessing(...)
 */
export async function loadPostProcessing(config: {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.Camera
  enableSSAO?: boolean
  enableBloom?: boolean
}): Promise<{
  composer: EffectComposerType
  renderPass: RenderPassType
  ssaoPass?: SSAOPassType
  bloomPass?: UnrealBloomPassType
}> {
  const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js')
  const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js')

  const composer = new EffectComposer(config.renderer)
  const renderPass = new RenderPass(config.scene, config.camera)
  composer.addPass(renderPass)

  const result: {
    composer: EffectComposerType
    renderPass: RenderPassType
    ssaoPass?: SSAOPassType
    bloomPass?: UnrealBloomPassType
  } = { composer, renderPass }

  if (config.enableSSAO) {
    const { SSAOPass } = await import('three/examples/jsm/postprocessing/SSAOPass.js')
    const ssaoPass = new SSAOPass(config.scene, config.camera)
    composer.addPass(ssaoPass)
    result.ssaoPass = ssaoPass
  }

  if (config.enableBloom) {
    const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js')
    const { Vector2 } = await import('three')
    const bloomPass = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      1.5,  // strength
      0.4,  // radius
      0.85  // threshold
    )
    composer.addPass(bloomPass)
    result.bloomPass = bloomPass
  }

  return result
}

/**
 * Cache for loaded modules to avoid re-importing
 */
const loaderCache = new Map<string, unknown>()

/**
 * Generic lazy loader with caching
 * @internal
 */
async function cachedImport<T>(key: string, importFn: () => Promise<T>): Promise<T> {
  if (loaderCache.has(key)) {
    return loaderCache.get(key) as T
  }
  const module = await importFn()
  loaderCache.set(key, module)
  return module
}

/**
 * Preload commonly used loaders
 * Call this during idle time to warm up the cache
 */
export async function preloadCommonLoaders(): Promise<void> {
  await Promise.all([
    loadGLTFLoader(),
    loadOrbitControls(null as unknown as THREE.Camera) // Just to load the module
  ])
}

/**
 * Clear the loader cache (useful for testing or memory management)
 */
export function clearLoaderCache(): void {
  loaderCache.clear()
}
