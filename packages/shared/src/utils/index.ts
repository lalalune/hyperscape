/**
 * Shared Utilities
 * Central export point for all utility modules
 */

// Renderer utilities
export {
  createRenderer,
  configureRenderer,
  configureShadowMaps,
  configureXR,
  getMaxAnisotropy,
  isXRPresenting,
  isWebGPURenderer,
  isWebGLRenderer,
  getRendererBackend,
  detectRenderingCapabilities,
  type UniversalRenderer,
  type RendererOptions,
  type RendererCapabilities
} from './RendererFactory';

// Post-processing utilities
export {
  createPostProcessing,
  setBloomEnabled,
  disposePostProcessing,
  type PostProcessingComposer,
  type PostProcessingOptions
} from './PostProcessingFactory';

// Material and mesh optimizations
export {
  createOptimizedInstancedMesh,
  optimizeMaterialForWebGPU,
  getWebGPUCapabilities,
  logWebGPUInfo
} from './RendererFactory';

// Validation utilities
export {
  isNumber,
  isBoolean,
  isString,
  isObject,
  isArray,
  isValidColor,
  isValidUrl,
  validatePosition,
  calculateDistance,
  calculateDistance2D
} from './ValidationUtils';

// System utilities
export {
  getSystem,
  requireSystem,
  hasSystem,
  getWorldNetwork,
  isServer,
  isClient,
  getNetworkSystem,
  getEntitiesSystem,
  getChatSystem,
  getLoaderSystem,
  getGraphicsSystem,
  getStageSystem,
  getCameraSystem,
  getTerrainSystem,
  type NetworkSystem,
  type EntitiesSystem,
  type ChatSystem,
  type LoaderSystem,
  type GraphicsSystem,
  type StageSystem,
  type CameraSystem,
  type TerrainSystem
} from './SystemUtils';

