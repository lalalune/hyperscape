/**
 * useThreeCleanup - React hook for Three.js resource cleanup
 *
 * Ensures proper disposal of Three.js objects (geometries, materials, textures)
 * when React components unmount.
 *
 * Features:
 * - Automatic cleanup on unmount
 * - Tracks registered resources
 * - Uses ThreeResourceManager for deep cleanup
 * - Prevents memory leaks in GPU resources
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useRef } from "react";
import { ThreeResourceManager } from "@/lib/ThreeResourceManager";
import { THREE } from "@hyperforge/shared";

/** Resource types that can be tracked */
type ThreeResource = THREE.Object3D;

/**
 * Hook for managing Three.js resource lifecycle
 *
 * @example
 * ```tsx
 * function MyThreeComponent() {
 *   const { register, cleanup } = useThreeCleanup();
 *
 *   useEffect(() => {
 *     const geometry = new THREE.BoxGeometry();
 *     const material = new THREE.MeshBasicMaterial();
 *     const mesh = new THREE.Mesh(geometry, material);
 *
 *     // Register resources for automatic cleanup
 *     register(geometry, material, mesh);
 *
 *     scene.add(mesh);
 *
 *     return () => {
 *       scene.remove(mesh);
 *       // cleanup() called automatically on unmount
 *     };
 *   }, [register]);
 *
 *   return null;
 * }
 * ```
 */
export function useThreeCleanup() {
  const resourcesRef = useRef<Set<ThreeResource>>(new Set());

  /**
   * Register resources for cleanup
   */
  const register = useCallback((...resources: ThreeResource[]) => {
    for (const resource of resources) {
      resourcesRef.current.add(resource);
    }
  }, []);

  /**
   * Unregister resources (if manually disposing)
   */
  const unregister = useCallback((...resources: ThreeResource[]) => {
    for (const resource of resources) {
      resourcesRef.current.delete(resource);
    }
  }, []);

  /**
   * Dispose a single resource
   */
  const dispose = useCallback((resource: ThreeResource) => {
    ThreeResourceManager.disposeObject(resource);
    resourcesRef.current.delete(resource);
  }, []);

  /**
   * Cleanup all registered resources
   */
  const cleanup = useCallback(() => {
    for (const resource of resourcesRef.current) {
      ThreeResourceManager.disposeObject(resource);
    }
    resourcesRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    register,
    unregister,
    dispose,
    cleanup,
    getResourceCount: () => resourcesRef.current.size,
  };
}

/**
 * Hook for tracking memory usage of Three.js resources
 *
 * @param renderer - Optional renderer to query memory info from
 */
export function useThreeMemoryMonitor(renderer?: {
  info: {
    memory: { geometries: number; textures: number };
    programs?: unknown[];
  };
}) {
  const getMemoryInfo = useCallback(() => {
    return ThreeResourceManager.getMemoryInfo(renderer);
  }, [renderer]);

  const logMemoryInfo = useCallback(() => {
    const info = getMemoryInfo();
    console.debug("[Three.js Memory]", info);
  }, [getMemoryInfo]);

  return {
    getMemoryInfo,
    logMemoryInfo,
  };
}

export default useThreeCleanup;
