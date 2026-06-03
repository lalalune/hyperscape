/**
 * Tree Impostor - High-level API for tree-specific impostor generation
 *
 * Wraps @hyperforge/impostor for tree-specific functionality.
 */

import * as THREE from "three";
import {
  OctahedralImpostor,
  OctahedronType,
  type CompatibleRenderer,
  type ImpostorBakeResult,
  type ImpostorInstance,
  type OctahedronTypeValue,
  type TSLImpostorMaterial,
} from "@hyperforge/impostor";
import type { TreeMeshResult } from "../rendering/TreeMesh.js";

/**
 * Bake mode for impostors
 * - 'standard': Regular bake without normals (no dynamic lighting)
 * - 'withNormals': Bake with normals for dynamic lighting (may have color issues)
 * - 'hybrid': Use standard bake for colors + separate normal pass (best of both)
 */
export type BakeMode = "standard" | "withNormals" | "hybrid";

/**
 * Options for tree impostor generation.
 *
 * Grid Size Convention (matching @hyperforge/impostor):
 * - gridSizeX/Y = number of points/cells per axis
 * - 31x31 is the default (matching the demo)
 * - buildOctahedronMesh(gridSize) creates gridSize points
 */
export type TreeImpostorOptions = {
  /** Atlas texture size in pixels (default: 2048) */
  atlasSize?: number;
  /** Horizontal grid divisions (default: 31 to match demo) */
  gridSizeX?: number;
  /** Vertical grid divisions (default: 31 to match demo) */
  gridSizeY?: number;
  /** Octahedron type - HEMI for trees viewed from ground (default) */
  octType?: OctahedronTypeValue;
  /** Alpha test threshold (default: 0.1) */
  alphaTest?: number;
  /** Enable dynamic lighting with normal maps (default: true) */
  enableLighting?: boolean;
  /** Bake mode (default: 'hybrid' when enableLighting is true) */
  bakeMode?: BakeMode;
  /** Use TSL (WebGPU) materials instead of GLSL (WebGL). Set true when using WebGPURenderer. */
  useTSL?: boolean;
};

const DEFAULT_OPTIONS: Required<TreeImpostorOptions> = {
  atlasSize: 2048,
  gridSizeX: 31, // Match demo GRID_SIZE
  gridSizeY: 31, // Match demo GRID_SIZE
  octType: OctahedronType.HEMI, // HEMI for ground-based viewing (demo default)
  alphaTest: 0.1,
  enableLighting: true, // Enable dynamic lighting by default
  bakeMode: "hybrid", // Use hybrid by default for best results
  useTSL: false, // Default to GLSL for backward compatibility
};

/**
 * TreeImpostor - Manages impostor generation for procedural trees.
 *
 * Optimized for trees:
 * - Uses hemisphere mapping (trees are typically viewed from ground level)
 * - Default 31x31 grid matching the demo for high quality
 * - Handles instanced leaf meshes during baking
 * - Supports dynamic lighting via normal atlas
 *
 * Grid Size Convention:
 * - gridSizeX/Y = number of points/cells per axis
 * - 31 is the default (creates 31x31 = 961 view angles)
 * - Lower values (e.g., 16) for faster baking and smaller atlas
 *
 * @example
 * ```typescript
 * const impostor = new TreeImpostor({ atlasSize: 2048, enableLighting: true });
 * impostor.bake(treeMesh, renderer);
 *
 * const impostorMesh = impostor.createInstance();
 * impostorMesh.position.set(100, 0, 50);
 * scene.add(impostorMesh.mesh);
 *
 * // In render loop
 * impostorMesh.update(camera);
 *
 * // Update lighting when sun changes
 * impostorMesh.updateLighting?.({
 *   lightDirection: sunDirection,
 *   lightIntensity: 1.2,
 * });
 * ```
 */
export class TreeImpostor {
  private options: Required<TreeImpostorOptions>;
  private impostor: OctahedralImpostor | null = null;
  private bakeResult: ImpostorBakeResult | null = null;
  private treeSize = 1;
  private treeWidth = 1;
  private treeHeight = 1;
  private heightOffset = 0;

  constructor(options: TreeImpostorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Bake an impostor atlas from a tree mesh.
   * If enableLighting is true (default), also bakes a normal atlas for dynamic lighting.
   *
   * Supports both WebGL and WebGPU renderers natively.
   * IMPORTANT: This is an async method - you must await it before calling createInstance().
   *
   * @param treeMesh - Tree mesh result from TreeGenerator
   * @param renderer - Three.js WebGL or WebGPU renderer
   * @returns This instance for chaining
   */
  async bake(
    treeMesh: TreeMeshResult,
    renderer: CompatibleRenderer,
  ): Promise<this> {
    // Detect if renderer is WebGPU (for logging)
    const isWebGPU =
      (renderer as { isWebGPURenderer?: boolean }).isWebGPURenderer === true;

    // Create impostor system if not exists
    if (!this.impostor) {
      this.impostor = new OctahedralImpostor(renderer);
    }

    const bakeConfig = {
      atlasWidth: this.options.atlasSize,
      atlasHeight: this.options.atlasSize,
      gridSizeX: this.options.gridSizeX,
      gridSizeY: this.options.gridSizeY,
      octType: this.options.octType,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
    };

    // Determine bake mode
    // Use "withNormals" as default for lighting - it uses the blit approach which works with WebGPU
    const bakeMode =
      this.options.bakeMode ??
      (this.options.enableLighting ? "withNormals" : "standard");
    console.log(
      `[TreeImpostor] Baking with mode: ${bakeMode}${isWebGPU ? " (WebGPU)" : " (WebGL)"}`,
    );

    // Bake based on mode - all bake methods are async and must be awaited
    switch (bakeMode) {
      case "hybrid":
        // Hybrid: color bake + separate normal pass (may have WebGPU issues)
        this.bakeResult = await this.impostor.bakeHybrid(
          treeMesh.group,
          bakeConfig,
        );
        break;
      case "withNormals":
        // Blit-based method - works correctly with WebGPU
        this.bakeResult = await this.impostor.bakeWithNormals(
          treeMesh.group,
          bakeConfig,
        );
        break;
      case "standard":
      default:
        // Simple bake without normals
        this.bakeResult = await this.impostor.bake(treeMesh.group, bakeConfig);
        break;
    }

    // Calculate tree dimensions from bounding sphere to match baking scale
    // The baker uses radius * 1.05 margin, so effective diameter = radius * 2 * 1.05
    if (this.bakeResult?.boundingSphere) {
      const sphere = this.bakeResult.boundingSphere;
      // treeSize is the effective diameter used in baking (matches impostor plane size)
      this.treeSize = sphere.radius * 2 * 1.05;

      // For display purposes, also track actual dimensions from bounding box
      if (this.bakeResult.boundingBox) {
        const boxSize = new THREE.Vector3();
        this.bakeResult.boundingBox.getSize(boxSize);
        this.treeWidth = Math.max(boxSize.x, boxSize.z);
        this.treeHeight = boxSize.y;
      } else {
        this.treeWidth = this.treeSize;
        this.treeHeight = this.treeSize;
      }

      // Height offset: distance from ground to sphere center minus half the effective diameter
      // This positions the impostor so the bottom matches the original tree's bottom
      const boxMinY = this.bakeResult.boundingBox
        ? this.bakeResult.boundingBox.min.y
        : sphere.center.y - sphere.radius;
      this.heightOffset = boxMinY;
    } else if (this.bakeResult?.boundingBox) {
      // Fallback: compute sphere from box
      const boxSize = new THREE.Vector3();
      this.bakeResult.boundingBox.getSize(boxSize);
      this.treeWidth = Math.max(boxSize.x, boxSize.z);
      this.treeHeight = boxSize.y;

      const tempSphere = new THREE.Sphere();
      this.bakeResult.boundingBox.getBoundingSphere(tempSphere);
      this.treeSize = tempSphere.radius * 2 * 1.05;

      this.heightOffset = this.bakeResult.boundingBox.min.y;
    }

    return this;
  }

  /**
   * Extended impostor instance with lighting support
   */
  private lastInstance:
    | (ImpostorInstance & {
        updateLighting?: (lighting: Record<string, unknown>) => void;
      })
    | null = null;

  /**
   * Create a single impostor instance for this tree.
   *
   * @param scale - Scale factor (default: 1)
   * @param options - Instance options (useTSL for WebGPU compatibility, debugMode for diagnosis)
   * @returns Impostor instance with mesh, update, and optionally updateLighting functions
   */
  createInstance(
    scale = 1,
    options?: { useTSL?: boolean; debugMode?: 0 | 1 | 2 | 3 | 4 | 5 | 6 },
  ): ImpostorInstance & {
    /** Update lighting uniforms (available when baked with enableLighting: true) */
    updateLighting?: (lighting: {
      lightDirection?: THREE.Vector3;
      lightColor?: THREE.Vector3;
      lightIntensity?: number;
      ambientColor?: THREE.Vector3;
      ambientIntensity?: number;
    }) => void;
  } {
    if (!this.impostor || !this.bakeResult) {
      throw new Error("Must call bake() before creating instances");
    }

    // Merge options - prefer instance-level options, fall back to class options
    const useTSL = options?.useTSL ?? this.options.useTSL;
    const debugMode = options?.debugMode ?? 0;

    // Pass scale and useTSL option - createInstance reads dimensions from bounding box
    const instance = this.impostor.createInstance(this.bakeResult, scale, {
      useTSL,
      debugMode,
    });

    // Position Y so the tree content is at ground level
    // The baking centers the mesh on the bounding sphere center, so the atlas content
    // is centered at the origin. When displaying, we position the plane center at
    // (sphereCenter.y - boundingBox.min.y) to place the tree's bottom at Y=0.
    const sphere = this.bakeResult?.boundingSphere;
    const box = this.bakeResult?.boundingBox;

    if (sphere && box) {
      // Position so tree bottom is at Y=0
      const groundOffset = sphere.center.y - box.min.y;
      instance.mesh.position.y = groundOffset * scale;
    } else if (sphere) {
      // Fallback: use sphere center (assumes bottom was at Y=0)
      instance.mesh.position.y = sphere.center.y * scale;
    }

    // Perform initial update with a default front view direction
    // This ensures the impostor displays content immediately instead of black
    // Use a forward direction (camera at Z+, looking toward origin)
    const defaultCamera = new THREE.PerspectiveCamera();
    defaultCamera.position.set(0, this.treeHeight * 0.5, this.treeSize * 2);
    defaultCamera.lookAt(instance.mesh.position);
    instance.update(defaultCamera);

    this.lastInstance = instance;
    return instance;
  }

  /**
   * Create multiple impostor instances for efficient rendering.
   *
   * @param count - Number of instances
   * @param scale - Scale factor (default: 1)
   * @returns Instanced mesh with helper methods
   */
  createInstancedMesh(count: number, scale = 1) {
    if (!this.impostor || !this.bakeResult) {
      throw new Error("Must call bake() before creating instances");
    }

    const size = this.treeSize * scale;
    return this.impostor.createInstancedMesh(this.bakeResult, count, size);
  }

  /**
   * Update lighting on the last created impostor instance.
   * Convenience method that forwards to instance.updateLighting().
   */
  updateLighting(lighting: {
    lightDirection?: THREE.Vector3;
    lightColor?: THREE.Vector3;
    lightIntensity?: number;
    ambientColor?: THREE.Vector3;
    ambientIntensity?: number;
  }): void {
    if (this.lastInstance?.updateLighting) {
      this.lastInstance.updateLighting(lighting);
    } else if (this.lastInstance?.material) {
      // Direct uniform update via TSL material's updateLighting method
      const tslMaterial = this.lastInstance
        .material as unknown as TSLImpostorMaterial;
      tslMaterial.updateLighting?.(lighting);
    }
  }

  /**
   * Get the tree's calculated size (diameter of bounding sphere).
   * @deprecated Use getTreeDimensions() for more accurate sizing
   */
  getTreeSize(): number {
    return this.treeSize;
  }

  /**
   * Get the tree's actual dimensions (width and height).
   * Width is the larger of X/Z extent, height is Y extent.
   */
  getTreeDimensions(): { width: number; height: number } {
    return {
      width: this.treeWidth,
      height: this.treeHeight,
    };
  }

  /**
   * Get the height offset (distance from ground to tree bottom).
   * Used for proper Y positioning of impostors.
   */
  getHeightOffset(): number {
    return this.heightOffset;
  }

  /**
   * Check if this impostor was baked with lighting support.
   */
  hasLighting(): boolean {
    return this.bakeResult?.normalAtlasTexture != null;
  }

  /**
   * Get the atlas texture for preview/debugging.
   */
  getAtlasTexture(): THREE.Texture | null {
    return this.bakeResult?.atlasTexture ?? null;
  }

  /**
   * Get the bake result for advanced usage.
   */
  getBakeResult(): ImpostorBakeResult | null {
    return this.bakeResult;
  }

  /**
   * Export atlas as data URL for saving.
   */
  exportAtlasAsDataURL(format: "png" | "jpeg" = "png"): string | null {
    if (!this.impostor || !this.bakeResult) return null;
    return this.impostor.exportAtlasAsDataURL(this.bakeResult, format);
  }

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    if (this.bakeResult?.renderTarget) {
      this.bakeResult.renderTarget.dispose();
    }
    this.impostor?.dispose();
    this.impostor = null;
    this.bakeResult = null;
  }
}

/**
 * Convenience function to bake a tree impostor.
 */
export async function bakeTreeImpostor(
  treeMesh: TreeMeshResult,
  renderer: CompatibleRenderer,
  options?: TreeImpostorOptions,
): Promise<TreeImpostor> {
  const impostor = new TreeImpostor(options);
  await impostor.bake(treeMesh, renderer);
  return impostor;
}
