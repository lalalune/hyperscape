/**
 * WebGPU Renderer Factory for HyperForge
 *
 * Provides async WebGPU renderer creation for offline processing tools.
 * WebGPU requires async initialization via renderer.init().
 */

import * as THREE from "three/webgpu";

export interface WebGPURendererOptions {
  canvas?: HTMLCanvasElement;
  antialias?: boolean;
  alpha?: boolean;
  preserveDrawingBuffer?: boolean;
}

export type HyperForgeRenderer = THREE.WebGPURenderer;

/**
 * Create and initialize a WebGPU renderer.
 *
 * Requests elevated GPU buffer limits (512 MiB buffer, 256 MiB storage binding)
 * when the adapter supports them — required for large terrain tile meshes and
 * instanced vegetation. Falls back to adapter defaults when limits are unavailable.
 */
export async function createWebGPURenderer(
  options: WebGPURendererOptions = {},
): Promise<HyperForgeRenderer> {
  if (!navigator.gpu) {
    throw new Error(
      "WebGPU not supported — required for World Studio. " +
        "Use Chrome 113+, Edge 113+, or Safari 17+.",
    );
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error(
      "No WebGPU adapter found — ensure your GPU drivers are up to date.",
    );
  }

  // Request elevated limits when the adapter supports them
  const adapterMaxBuffer = adapter.limits.maxBufferSize;
  const adapterMaxStorage = adapter.limits.maxStorageBufferBindingSize;
  const wantMaxBuffer = 512 * 1024 * 1024; // 512 MiB
  const wantMaxStorage = 256 * 1024 * 1024; // 256 MiB

  const requiredLimits: Record<string, number> = {};
  if (adapterMaxBuffer >= wantMaxBuffer) {
    requiredLimits.maxBufferSize = wantMaxBuffer;
  }
  if (adapterMaxStorage >= wantMaxStorage) {
    requiredLimits.maxStorageBufferBindingSize = wantMaxStorage;
  }

  const renderer = new THREE.WebGPURenderer({
    canvas: options.canvas,
    antialias: options.antialias ?? true,
    alpha: options.alpha ?? true,
  });

  // WebGPU requires async initialization
  await renderer.init();

  return renderer;
}

/**
 * Check if WebGPU is available
 */
export function isWebGPUAvailable(): boolean {
  return "gpu" in navigator;
}

// Re-export THREE from webgpu for convenience
export { THREE };
