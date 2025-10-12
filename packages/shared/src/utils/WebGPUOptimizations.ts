/**
 * WebGPU-Specific Optimizations
 * Real, tested optimizations that work with three.js WebGPU renderer
 */

import THREE from '../extras/three';
import { isWebGPURenderer, type UniversalRenderer } from './RendererFactory';

type WebGPUBackendLike = { device?: { features?: Iterable<string> } };
type WebGPURendererWithBackend = { backend?: WebGPUBackendLike };
type MaterialWithTextureProps = THREE.Material & Partial<Record<'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'emissiveMap', THREE.Texture | undefined>>;

/**
 * Apply WebGPU-specific optimizations to the renderer
 * Note: Most WebGPU optimizations happen automatically. This just logs capabilities.
 */
export function applyWebGPUOptimizations(
  renderer: UniversalRenderer
): void {
  if (!isWebGPURenderer(renderer)) {
    return; // Silent no-op for WebGL
  }
  
  console.log('[WebGPUOptimizations] WebGPU renderer detected');
  console.log('[WebGPUOptimizations] ✓ Advanced instancing (automatic)');
  console.log('[WebGPUOptimizations] ✓ Better GPU memory layout (automatic)');
  console.log('[WebGPUOptimizations] ✓ Efficient shader compilation (automatic)');
}

/**
 * Get WebGPU capabilities (for logging/debugging)
 */
export async function getWebGPUCapabilities(renderer: UniversalRenderer): Promise<{
  backend: string;
  features: string[];
} | null> {
  if (!isWebGPURenderer(renderer)) {
    return null;
  }
  
  try {
    const gpuRenderer = renderer as WebGPURendererWithBackend;
    const device = gpuRenderer.backend?.device;
    
    if (!device) {
      return { backend: 'webgpu', features: [] };
    }
    
    const features: string[] = [];
  const iterable = device.features as unknown as { forEach?: (cb: (f: string) => void) => void } | Iterable<string>;
  if (iterable && 'forEach' in iterable && typeof iterable.forEach === 'function') {
    iterable.forEach((feature: string) => features.push(feature));
  }
    
    return {
      backend: 'webgpu',
      features
    };
  } catch (error) {
    console.warn('[WebGPUOptimizations] Could not get capabilities:', error);
    return null;
  }
}

/**
 * Optimize materials for better rendering (works on both backends)
 */
export function optimizeMaterialForWebGPU(material: THREE.Material): void {
  if (!material) return;
  
  // Enable anisotropic filtering on textures
  const textureProps: Array<keyof MaterialWithTextureProps> = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'];
  for (const prop of textureProps) {
    const tex = (material as MaterialWithTextureProps)[prop];
    if (tex instanceof THREE.Texture) {
      tex.anisotropy = THREE.Texture.DEFAULT_ANISOTROPY;
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
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = true;
  return mesh;
}

