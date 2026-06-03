/**
 * TreeLODIntegration.ts - Bridges TreeLODSystem with ProcgenTreeInstancer
 *
 * This module provides integration between the new consolidated TreeLODSystem
 * and the existing ProcgenTreeInstancer. It enables gradual migration while
 * maintaining backward compatibility.
 *
 * ## Migration Strategy
 *
 * 1. **Phase 1** (Current): TreeLODSystem runs alongside ProcgenTreeInstancer
 *    - New trees can optionally use TreeLODSystem
 *    - ProcgenTreeInstancer remains the default
 *
 * 2. **Phase 2**: TreeLODSystem becomes default for new trees
 *    - Existing trees continue using ProcgenTreeInstancer
 *    - New registrations route through TreeLODSystem
 *
 * 3. **Phase 3**: Full migration
 *    - ProcgenTreeInstancer deprecated
 *    - TreeLODSystem handles all tree rendering
 *
 * ## Usage
 *
 * ```typescript
 * // Initialize integration
 * const integration = new TreeLODIntegration(world);
 * await integration.init(renderer);
 *
 * // Bake a tree preset (generates LOD data)
 * await integration.bakeTreePreset('oakTree', treeGenerator);
 *
 * // Register trees (routes to appropriate system)
 * integration.registerTree('tree_001', 'oakTree', position, rotation, scale);
 *
 * // Update (calls both systems during migration)
 * integration.update(camera);
 * ```
 *
 * @module TreeLODIntegration
 */

import THREE from "../../../extras/three/three";
import type { World } from "../../../core/World";
import type { Wind } from "./Wind";
import {
  TreeLODOrchestrator,
  type BakedTreePreset,
  type ComputeLeafInstance,
  type TreeRegistration,
} from "./TreeLODSystem";
import {
  createInstancedLeafMaterial,
  createBranchCardMaterial,
  type InstancedLeafMaterial,
  type BranchCardMaterial,
} from "./TreeLODMaterials";
import type {
  BranchCluster,
  BranchClusterGenerator,
  BranchClusterResult,
} from "@hyperforge/procgen";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Integration mode controls routing behavior.
 */
export enum IntegrationMode {
  /** Use legacy ProcgenTreeInstancer only (default during Phase 1) */
  LEGACY_ONLY = "legacy",
  /** Use new TreeLODSystem only */
  NEW_ONLY = "new",
  /** Use both systems (for A/B testing or gradual migration) */
  HYBRID = "hybrid",
  /** Auto-select based on WebGPU capability */
  AUTO = "auto",
}

/**
 * Integration configuration.
 */
export interface TreeLODIntegrationConfig {
  /** Integration mode */
  mode: IntegrationMode;
  /** Enable compute shader leaves (requires WebGPU) */
  useComputeLeaves: boolean;
  /** Enable SpeedTree-style branch cards */
  useBranchCards: boolean;
  /** Threshold distance for new system (trees closer than this use new system in HYBRID mode) */
  hybridThreshold: number;
  /** Enable debug logging */
  debug: boolean;
}

const DEFAULT_CONFIG: TreeLODIntegrationConfig = {
  mode: IntegrationMode.AUTO,
  useComputeLeaves: true,
  useBranchCards: true,
  hybridThreshold: 100,
  debug: false,
};

// ============================================================================
// TREE PRESET CONVERTER
// ============================================================================

/**
 * Converts tree generator output to TreeLODSystem format.
 */
export class TreePresetConverter {
  /**
   * Convert leaf data to compute-friendly format.
   *
   * @param leafData - Array of leaf positions, directions, and scales
   * @param baseColor - Base color for leaves (with random variation applied)
   * @param treeCenter - Optional tree center for view-dependent culling.
   *                     If not provided, calculated as average of all leaf positions.
   */
  static convertLeaves(
    leafData: Array<{
      position: THREE.Vector3;
      direction: THREE.Vector3;
      scale: number;
      color?: THREE.Color;
    }>,
    baseColor: THREE.Color = new THREE.Color(0x3d7a3d),
    treeCenter?: THREE.Vector3,
  ): ComputeLeafInstance[] {
    const leaves: ComputeLeafInstance[] = [];

    // Calculate tree center if not provided (average of leaf positions)
    let center = treeCenter;
    if (!center && leafData.length > 0) {
      center = new THREE.Vector3();
      for (const leaf of leafData) {
        center.add(leaf.position);
      }
      center.divideScalar(leafData.length);
    }
    const cx = center?.x ?? 0;
    const cy = center?.y ?? 0;
    const cz = center?.z ?? 0;

    for (let i = 0; i < leafData.length; i++) {
      const leaf = leafData[i];

      // Build transform matrix
      const transform = new THREE.Matrix4();

      // Rotation: face leaf direction
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3()
        .crossVectors(up, leaf.direction)
        .normalize();
      const correctedUp = new THREE.Vector3().crossVectors(
        leaf.direction,
        right,
      );

      transform.makeBasis(right, correctedUp, leaf.direction);
      transform.scale(new THREE.Vector3(leaf.scale, leaf.scale, leaf.scale));
      transform.setPosition(leaf.position);

      // Color with random variation
      const color = leaf.color ?? baseColor.clone();
      const variation = (Math.random() - 0.5) * 0.1;
      color.r += variation;
      color.g += variation;
      color.b += variation;

      // Store tree center in metadata.yzw for view-dependent culling
      // metadata.x = tree index, metadata.yzw = tree center
      leaves.push({
        transform,
        colorFade: new THREE.Vector4(color.r, color.g, color.b, 1.0),
        metadata: new THREE.Vector4(i, cx, cy, cz),
      });
    }

    return leaves;
  }

  /**
   * Convert branch cluster data to TreeLODSystem format.
   */
  static convertClusters(clusterResult: BranchClusterResult): BranchCluster[] {
    return clusterResult.clusters;
  }

  /**
   * Extract trunk geometry from tree mesh group.
   *
   * LOD behavior:
   * - lod0: Full trunk + all branches
   * - lod1: Trunk + primary branches only (depth <= 1)
   * - lod2: Trunk only (depth 0)
   */
  static extractTrunkGeometry(
    group: THREE.Group,
    lod: "lod0" | "lod1" | "lod2",
  ): THREE.BufferGeometry | null {
    // Determine max branch depth based on LOD
    const maxDepth = lod === "lod0" ? Infinity : lod === "lod1" ? 1 : 0;

    const geometries: THREE.BufferGeometry[] = [];

    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const name = child.name.toLowerCase();

      // Check if this is trunk/branch geometry
      const isTrunk = name.includes("trunk") || name.includes("bark");
      const isBranch = name.includes("branch");

      if (!isTrunk && !isBranch) return;

      // Extract depth from name if present (e.g., "Branch_d2" means depth 2)
      let depth = 0;
      if (isBranch) {
        const depthMatch = name.match(/d(\d+)|depth(\d+)|_(\d+)$/);
        if (depthMatch) {
          depth = parseInt(depthMatch[1] || depthMatch[2] || depthMatch[3], 10);
        } else {
          // Default branch depth estimation based on vertex count
          const vertCount = child.geometry.getAttribute("position")?.count ?? 0;
          if (vertCount < 100) depth = 2;
          else if (vertCount < 500) depth = 1;
          else depth = 0;
        }
      }

      // Skip if branch depth exceeds LOD limit
      if (isBranch && depth > maxDepth) return;

      // Clone and add geometry
      const geo = child.geometry.clone();

      // Apply mesh world transform to geometry
      if (!child.matrixWorld.equals(new THREE.Matrix4())) {
        geo.applyMatrix4(child.matrixWorld);
      }

      geometries.push(geo);
    });

    if (geometries.length === 0) {
      return null;
    }

    if (geometries.length === 1) {
      return geometries[0];
    }

    // Merge all geometries
    return TreePresetConverter.mergeGeometries(geometries);
  }

  /**
   * Merge multiple BufferGeometries into one.
   */
  static mergeGeometries(
    geometries: THREE.BufferGeometry[],
  ): THREE.BufferGeometry {
    const mergedPositions: number[] = [];
    const mergedNormals: number[] = [];
    const mergedUvs: number[] = [];
    const mergedIndices: number[] = [];
    let vertexOffset = 0;

    for (const geo of geometries) {
      const positions = geo.getAttribute("position");
      const normals = geo.getAttribute("normal");
      const uvs = geo.getAttribute("uv");
      const indices = geo.getIndex();

      // Add positions
      for (let i = 0; i < positions.count; i++) {
        mergedPositions.push(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i),
        );
      }

      // Add normals
      if (normals) {
        for (let i = 0; i < normals.count; i++) {
          mergedNormals.push(normals.getX(i), normals.getY(i), normals.getZ(i));
        }
      }

      // Add UVs
      if (uvs) {
        for (let i = 0; i < uvs.count; i++) {
          mergedUvs.push(uvs.getX(i), uvs.getY(i));
        }
      }

      // Add indices with offset
      if (indices) {
        for (let i = 0; i < indices.count; i++) {
          mergedIndices.push(indices.getX(i) + vertexOffset);
        }
      } else {
        // Generate indices for non-indexed geometry
        for (let i = 0; i < positions.count; i++) {
          mergedIndices.push(vertexOffset + i);
        }
      }

      vertexOffset += positions.count;
    }

    // Create merged geometry
    const merged = new THREE.BufferGeometry();
    merged.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(mergedPositions, 3),
    );
    if (mergedNormals.length > 0) {
      merged.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(mergedNormals, 3),
      );
    }
    if (mergedUvs.length > 0) {
      merged.setAttribute("uv", new THREE.Float32BufferAttribute(mergedUvs, 2));
    }
    if (mergedIndices.length > 0) {
      merged.setIndex(mergedIndices);
    }

    return merged;
  }

  /**
   * Calculate tree dimensions from mesh group.
   */
  static calculateDimensions(group: THREE.Group): {
    width: number;
    height: number;
    canopyRadius: number;
  } {
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Estimate canopy as top 60% of height, 80% of width
    const canopyRadius = Math.max(size.x, size.z) * 0.4;

    return {
      width: Math.max(size.x, size.z),
      height: size.y,
      canopyRadius,
    };
  }
}

// ============================================================================
// TREE LOD INTEGRATION
// ============================================================================

/**
 * TreeLODIntegration - Main integration class.
 *
 * Manages communication between TreeLODSystem and existing systems.
 */
export class TreeLODIntegration {
  private world: World;
  private config: TreeLODIntegrationConfig;
  private orchestrator: TreeLODOrchestrator;
  private isInitialized = false;
  private hasWebGPU = false;

  // Materials
  private leafMaterial: InstancedLeafMaterial | null = null;
  private cardMaterials: Map<string, BranchCardMaterial> = new Map();

  // Wind reference
  private wind: Wind | null = null;
  private windTime = 0;

  // Statistics
  private stats = {
    newSystemTrees: 0,
    legacyTrees: 0,
    totalLeaves: 0,
    totalCards: 0,
  };

  constructor(world: World, config: Partial<TreeLODIntegrationConfig> = {}) {
    this.world = world;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.orchestrator = new TreeLODOrchestrator(world);
  }

  /**
   * Initialize integration.
   */
  async init(renderer: THREE.WebGPURenderer): Promise<boolean> {
    if (this.isInitialized) return true;

    // Check WebGPU capability
    this.hasWebGPU = !!(renderer as unknown as { isWebGPURenderer?: boolean })
      ?.isWebGPURenderer;

    // Determine effective mode
    let effectiveMode = this.config.mode;
    if (effectiveMode === IntegrationMode.AUTO) {
      effectiveMode = this.hasWebGPU
        ? IntegrationMode.NEW_ONLY
        : IntegrationMode.LEGACY_ONLY;
    }

    if (this.config.debug) {
      console.log(
        `[TreeLODIntegration] Mode: ${effectiveMode}, WebGPU: ${this.hasWebGPU}`,
      );
    }

    // Initialize orchestrator if using new system
    if (
      effectiveMode === IntegrationMode.NEW_ONLY ||
      effectiveMode === IntegrationMode.HYBRID
    ) {
      await this.orchestrator.init(renderer);
    }

    // Create shared materials
    this.leafMaterial = createInstancedLeafMaterial();

    this.isInitialized = true;
    console.log(`[TreeLODIntegration] Initialized (mode: ${effectiveMode})`);
    return true;
  }

  /**
   * Set wind reference for animation.
   */
  setWind(wind: Wind): void {
    this.wind = wind;
    this.orchestrator.setWind(wind);
  }

  /**
   * Bake a tree preset using the new LOD system.
   *
   * This generates:
   * - Branch cards for LOD1/LOD2
   * - Leaf templates for compute instancing
   * - Trunk geometries for each LOD level
   */
  async bakeTreePreset(
    presetName: string,
    treeGenerator: {
      generate(seed: number): {
        group: THREE.Group;
        leaves?: Array<{
          position: THREE.Vector3;
          direction: THREE.Vector3;
          scale: number;
          color?: THREE.Color;
        }>;
        stems?: unknown[];
      };
    },
    branchClusterGenerator?: BranchClusterGenerator,
  ): Promise<BakedTreePreset | null> {
    if (!this.isInitialized) {
      console.warn("[TreeLODIntegration] Not initialized");
      return null;
    }

    // Generate base tree
    const result = treeGenerator.generate(12345);

    // Extract trunk geometries
    const trunkLOD0 = TreePresetConverter.extractTrunkGeometry(
      result.group,
      "lod0",
    );
    const trunkLOD1 = TreePresetConverter.extractTrunkGeometry(
      result.group,
      "lod1",
    );
    const trunkLOD2 = TreePresetConverter.extractTrunkGeometry(
      result.group,
      "lod2",
    );

    // Convert leaves
    const leaves = result.leaves
      ? TreePresetConverter.convertLeaves(result.leaves)
      : [];

    // Generate branch clusters if generator provided
    let clusters: BranchCluster[] = [];
    if (branchClusterGenerator && result.leaves && result.stems) {
      const clusterResult = branchClusterGenerator.generateClusters(
        result.leaves as unknown as Parameters<
          typeof branchClusterGenerator.generateClusters
        >[0],
        result.stems as unknown as Parameters<
          typeof branchClusterGenerator.generateClusters
        >[1],
        {} as Parameters<typeof branchClusterGenerator.generateClusters>[2],
      );
      clusters = TreePresetConverter.convertClusters(clusterResult);
    }

    // Calculate dimensions
    const dimensions = TreePresetConverter.calculateDimensions(result.group);

    // Bake through orchestrator
    const preset = await this.orchestrator.bakePreset(
      presetName,
      clusters,
      leaves,
      {
        lod0: trunkLOD0 ?? new THREE.BufferGeometry(),
        lod1: trunkLOD1 ?? trunkLOD0 ?? new THREE.BufferGeometry(),
        lod2: trunkLOD2 ?? trunkLOD1 ?? trunkLOD0 ?? new THREE.BufferGeometry(),
      },
      dimensions,
    );

    // Create card material for this preset if we have an atlas
    if (preset.cardAtlas) {
      const cardMat = createBranchCardMaterial(preset.cardAtlas);
      this.cardMaterials.set(presetName, cardMat);
    }

    if (this.config.debug) {
      console.log(
        `[TreeLODIntegration] Baked preset "${presetName}": ` +
          `${leaves.length} leaves, ${clusters.length} cards`,
      );
    }

    return preset;
  }

  /**
   * Register a tree instance.
   */
  registerTree(
    id: string,
    preset: string,
    position: THREE.Vector3,
    rotation: number,
    scale: number,
  ): TreeRegistration | null {
    return this.orchestrator.registerTree(
      id,
      preset,
      position,
      rotation,
      scale,
    );
  }

  /**
   * Unregister a tree instance.
   */
  unregisterTree(id: string): void {
    this.orchestrator.unregisterTree(id);
  }

  /**
   * Update LOD system.
   */
  update(camera: THREE.PerspectiveCamera): void {
    if (!this.isInitialized) return;

    // Update wind time
    this.windTime += 0.016;

    // Update leaf material wind
    if (this.leafMaterial && this.wind) {
      this.leafMaterial.updateWind(
        this.windTime,
        this.wind.getStrength(),
        this.wind.getDirection(),
      );
    }

    // Update card materials wind
    for (const cardMat of this.cardMaterials.values()) {
      if (this.wind) {
        cardMat.updateWind(
          this.windTime,
          this.wind.getStrength(),
          this.wind.getDirection(),
        );
      }
    }

    // Update orchestrator
    this.orchestrator.update(camera);

    // Update stats
    const orchStats = this.orchestrator.getStats();
    this.stats.newSystemTrees = orchStats.totalTrees;
    this.stats.totalLeaves = orchStats.totalLeaves;
  }

  /**
   * Get statistics.
   */
  getStats(): typeof this.stats & {
    byLOD: {
      lod0: number;
      lod1: number;
      lod2: number;
      impostor: number;
      culled: number;
    };
  } {
    return {
      ...this.stats,
      byLOD: this.orchestrator.getStats().byLOD,
    };
  }

  /**
   * Get current configuration.
   */
  getConfig(): TreeLODIntegrationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  setConfig(config: Partial<TreeLODIntegrationConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.config.debug) {
      console.log("[TreeLODIntegration] Config updated:", this.config);
    }
  }

  /**
   * Check if WebGPU is available.
   */
  isWebGPUAvailable(): boolean {
    return this.hasWebGPU;
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    this.orchestrator.dispose();
    this.leafMaterial?.dispose();
    for (const mat of this.cardMaterials.values()) {
      mat.dispose();
    }
    this.cardMaterials.clear();
    this.isInitialized = false;
  }
}
