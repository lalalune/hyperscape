/**
 * Universal Renderer Factory
 * Creates WebGPU or WebGL renderers with feature detection and fallback
 */

import THREE from '../extras/three';

// WebGPU modules loaded on demand
let webgpuModulesLoaded = false;
// Minimal capability surface for the WebGPU capability checker
let WebGPU: { isAvailable(): Promise<boolean> } | null = null;
// Constructor type for the WebGPU renderer. We keep this structural to avoid
// depending on @types/three having WebGPU types available in all environments
type WebGPURendererClass = new (params: { canvas?: HTMLCanvasElement; antialias?: boolean }) => {
  init: () => Promise<void>;
  setSize: (w: number, h: number) => void;
  setPixelRatio: (r: number) => void;
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
  outputColorSpace: THREE.ColorSpace;
  domElement: HTMLCanvasElement;
  setAnimationLoop?: (cb: ((time: number) => void) | null) => void;
  backend?: unknown;
};
let WebGPURenderer: WebGPURendererClass | null = null;

async function ensureWebGPUModules() {
  if (webgpuModulesLoaded) return { WebGPU, WebGPURenderer };
  
  webgpuModulesLoaded = true;
  
  try {
    // Import WebGPU modules - dynamic import allows graceful fallback at runtime
    // @ts-ignore - Module may not exist, handled by catch
    const webgpuModules = await import('three/webgpu');
    WebGPURenderer = (webgpuModules as unknown as { WebGPURenderer: WebGPURendererClass }).WebGPURenderer;

    // @ts-ignore - Module may not exist, handled by catch
    const capabilityModules = await import('three/examples/jsm/capabilities/WebGPU.js');
    WebGPU = (capabilityModules as unknown as { default: { isAvailable(): Promise<boolean> } }).default;

    console.log('[RendererFactory] WebGPU modules loaded successfully');
  } catch (_error) {
    console.log('[RendererFactory] WebGPU not available - will use WebGL');
    WebGPU = null;
    WebGPURenderer = null;
  }
  
  return { WebGPU, WebGPURenderer };
}

export type UniversalRenderer = THREE.WebGLRenderer | InstanceType<WebGPURendererClass>;

export interface RendererOptions {
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: 'high-performance' | 'low-power' | 'default';
  preserveDrawingBuffer?: boolean;
  preferWebGPU?: boolean;
  canvas?: HTMLCanvasElement;
}

export interface RendererCapabilities {
  supportsWebGPU: boolean;
  supportsWebGL2: boolean;
  preferredBackend: 'webgpu' | 'webgl2';
  maxAnisotropy?: number;
}

/**
 * Detect available rendering capabilities
 */
export async function detectRenderingCapabilities(): Promise<RendererCapabilities> {
  await ensureWebGPUModules();
  
  const supportsWebGPU = WebGPU ? await WebGPU.isAvailable() : false;
  const supportsWebGL2 = true; // Always available in modern browsers
  
  return {
    supportsWebGPU,
    supportsWebGL2,
    preferredBackend: supportsWebGPU ? 'webgpu' : 'webgl2'
  };
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
    canvas
  } = options;

  const capabilities = await detectRenderingCapabilities();
  
  // Try WebGPU first if preferred and available
  if (preferWebGPU && capabilities.supportsWebGPU && WebGPURenderer) {
    try {
      console.log('[RendererFactory] Creating WebGPU renderer');
      
      const renderer = new WebGPURenderer({
        canvas,
        antialias,
        // Note: alpha, preserveDrawingBuffer not needed in WebGPU
        // powerPreference handled differently in WebGPU
      });
      
      // Wait for WebGPU initialization
      await renderer.init();
      
      console.log('[RendererFactory] ✅ WebGPU renderer created and initialized');
      return renderer as UniversalRenderer;
    } catch (error) {
      console.warn('[RendererFactory] WebGPU renderer creation failed, falling back to WebGL:', error);
    }
  }
  
  // Fallback to WebGL
  console.log('[RendererFactory] Creating WebGL renderer');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias,
    alpha,
    powerPreference,
    preserveDrawingBuffer
  });
  
  console.log('[RendererFactory] ✅ WebGL renderer created successfully');
  return renderer as UniversalRenderer;
}

/**
 * Check if renderer is WebGPU
 */
export function isWebGPURenderer(renderer: UniversalRenderer): renderer is InstanceType<WebGPURendererClass> {
  // Structural check: WebGPU renderer exposes an async init()
  return typeof (renderer as { init?: () => Promise<void> }).init === 'function';
}

/**
 * Check if renderer is WebGL
 */
export function isWebGLRenderer(renderer: UniversalRenderer): renderer is THREE.WebGLRenderer {
  return renderer instanceof THREE.WebGLRenderer;
}

/**
 * Get renderer backend type
 */
export function getRendererBackend(renderer: UniversalRenderer): 'webgpu' | 'webgl2' {
  return isWebGPURenderer(renderer) ? 'webgpu' : 'webgl2';
}

/**
 * Configure renderer with common settings
 */
export function configureRenderer(
  renderer: UniversalRenderer,
  options: {
    clearColor?: number;
    clearAlpha?: number;
    pixelRatio?: number;
    width?: number;
    height?: number;
    toneMapping?: THREE.ToneMapping;
    toneMappingExposure?: number;
    outputColorSpace?: THREE.ColorSpace;
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
    outputColorSpace = THREE.SRGBColorSpace
  } = options;

  // Clear color (WebGL only)
  if (isWebGLRenderer(renderer)) {
    renderer.setClearColor(clearColor, clearAlpha);
  } else if (isWebGPURenderer(renderer)) {
    // WebGPU uses background in scene, not renderer clear color
    console.log('[RendererFactory] WebGPU renderer - clear color should be set on scene.background');
  }
  
  // Pixel ratio
  renderer.setPixelRatio(pixelRatio);
  
  // Size
  if (width && height) {
    renderer.setSize(width, height);
  }
  
  // Tone mapping (both support this)
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = toneMappingExposure;
  
  // Output color space (both support this)
  renderer.outputColorSpace = outputColorSpace;
  
  // WebGPU-specific: Enable sRGB encoding optimizations
  if (isWebGPURenderer(renderer)) {
    console.log('[RendererFactory] WebGPU optimizations: sRGB encoding, linear workflow');
  }
}

/**
 * Configure shadow maps (WebGL only)
 */
export function configureShadowMaps(
  renderer: UniversalRenderer,
  options: {
    enabled?: boolean;
    type?: THREE.ShadowMapType;
  } = {}
): void {
  const { enabled = true, type = THREE.PCFSoftShadowMap } = options;
  
  if (isWebGLRenderer(renderer)) {
    renderer.shadowMap.enabled = enabled;
    renderer.shadowMap.type = type;
  }
  // WebGPU handles shadows automatically per light
}

/**
 * Get max anisotropy (WebGL only)
 */
export function getMaxAnisotropy(renderer: UniversalRenderer): number {
  if (isWebGLRenderer(renderer)) {
    return renderer.capabilities.getMaxAnisotropy();
  }
  // WebGPU has different anisotropy handling
  return 16; // Default reasonable value
}

/**
 * Configure XR support
 */
export function configureXR(
  renderer: UniversalRenderer,
  options: {
    enabled?: boolean;
    // eslint-disable-next-line no-undef
    referenceSpaceType?: XRReferenceSpaceType;
    foveation?: number;
  } = {}
): void {
  const {
    enabled = true,
    referenceSpaceType = 'local-floor',
    foveation = 0
  } = options;
  
  if (isWebGLRenderer(renderer) && renderer.xr) {
    renderer.xr.enabled = enabled;
    renderer.xr.setReferenceSpaceType(referenceSpaceType);
    renderer.xr.setFoveation(foveation);
  }
  // WebGPU XR support is experimental - handle separately when available
}

/**
 * Check if XR is presenting
 */
export function isXRPresenting(renderer: UniversalRenderer): boolean {
  if (isWebGLRenderer(renderer) && renderer.xr) {
    return renderer.xr.isPresenting ?? false;
  }
  return false;
}

