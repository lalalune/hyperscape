/**
 * ResourceTileDebugSystem
 *
 * Client-side debug visualization for resource tile occupancy.
 * Shows red ground planes for tiles that resources occupy.
 *
 * TILE-BASED-MMORPG-ACCURACY: Resources occupy specific tiles based on their footprint:
 * - standard (1×1): Single tile
 * - large (2×2): Four tiles from anchor (SW corner)
 * - massive (3×3): Nine tiles from anchor
 *
 * Enable/disable via: world.resourceTileDebug.setEnabled(true/false)
 *
 * @see FOOTPRINT_SIZES for tile dimensions
 */

// Migrated 2026-04-24 from `packages/shared/src/systems/client/`
// into `@hyperforge/hyperscape` (7th client-only system migration).
// Pure debug overlay — disabled at registration in createClientWorld
// before the migration; remains opt-in via world.resourceTileDebug
// after. No gameplay impact.
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  FOOTPRINT_SIZES,
  type ResourceFootprint,
  SystemBase,
  THREE,
  TILE_SIZE,
  type TileCoord,
  type World,
  worldToTile,
} from "@hyperforge/shared";

// Debug tile color - bright red for visibility
const DEBUG_TILE_COLOR = 0xff0000; // Red
const DEBUG_TILE_OPACITY = 0.4;

/**
 * Debug tile mesh handle
 */
interface DebugTileHandle {
  mesh: THREE.Mesh;
  resourceId: string;
  tile: TileCoord;
}

export class ResourceTileDebugSystem extends SystemBase {
  private debugTiles: Map<string, DebugTileHandle[]> = new Map();
  private enabled = false;
  private sharedGeometry: THREE.PlaneGeometry | null = null;
  private sharedMaterial: THREE.Material | null = null; // MeshBasicNodeMaterial for WebGPU

  constructor(world: World) {
    super(world, {
      name: "resource-tile-debug",
      dependencies: {
        required: ["stage"],
        optional: ["terrain"],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Create shared geometry and material for performance
    this.sharedGeometry = new THREE.PlaneGeometry(
      TILE_SIZE * 0.95,
      TILE_SIZE * 0.95,
    );
    // Use MeshBasicNodeMaterial for WebGPU compatibility
    const mat = new MeshBasicNodeMaterial();
    mat.color = new THREE.Color(DEBUG_TILE_COLOR);
    mat.transparent = true;
    mat.opacity = DEBUG_TILE_OPACITY;
    mat.side = THREE.DoubleSide;
    mat.depthWrite = false;
    this.sharedMaterial = mat;

    // Subscribe to resource spawn events
    this.subscribe(
      "resource:spawned",
      (data: {
        resourceId: string;
        position: { x: number; y: number; z: number };
        footprint?: ResourceFootprint;
      }) => {
        if (this.enabled) {
          this.addResourceTiles(
            data.resourceId,
            data.position,
            data.footprint || "standard",
          );
        }
      },
    );

    // Subscribe to resource removed events
    this.subscribe("resource:removed", (data: { resourceId: string }) => {
      this.removeResourceTiles(data.resourceId);
    });

    console.log(
      "[ResourceTileDebugSystem] Initialized - use setEnabled(true) to show debug tiles",
    );
  }

  start(): void {
    // Scan existing resources if debug is enabled
    if (this.enabled) {
      this.scanExistingResources();
    }
  }

  /**
   * Enable or disable debug tile visualization
   */
  public setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      console.log(
        `[ResourceTileDebugSystem] Already ${enabled ? "enabled" : "disabled"}`,
      );
      return;
    }

    this.enabled = enabled;
    console.log(
      `[ResourceTileDebugSystem] Debug tiles ${enabled ? "ENABLED" : "DISABLED"}`,
    );
    console.log(
      `[ResourceTileDebugSystem] world.stage?.scene exists: ${!!this.world.stage?.scene}`,
    );
    console.log(
      `[ResourceTileDebugSystem] world.entities exists: ${!!this.world.entities}`,
    );
    console.log(
      `[ResourceTileDebugSystem] sharedGeometry exists: ${!!this.sharedGeometry}`,
    );
    console.log(
      `[ResourceTileDebugSystem] sharedMaterial exists: ${!!this.sharedMaterial}`,
    );

    if (enabled) {
      this.scanExistingResources();
    } else {
      this.clearAllTiles();
    }
  }

  /**
   * Check if debug visualization is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Toggle debug visualization
   */
  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /**
   * Scan all existing resource entities and create debug tiles
   */
  private scanExistingResources(): void {
    // Access the entities system
    const entitiesSystem = this.world.entities as {
      items?: Map<string, unknown>;
      values?: () => IterableIterator<unknown>;
    } | null;

    if (!entitiesSystem) {
      console.warn("[ResourceTileDebugSystem] No entities system found");
      return;
    }

    // Try to get all entities from the items map
    const items = entitiesSystem.items;
    if (!items) {
      console.warn("[ResourceTileDebugSystem] No items map in entities system");
      return;
    }

    console.log(`[ResourceTileDebugSystem] Scanning ${items.size} entities...`);

    let count = 0;
    let resourceCount = 0;

    for (const [entityId, entity] of items) {
      // Check if this is a resource entity by checking type property
      const entityAny = entity as {
        type?: string;
        id: string;
        position?: { x: number; y: number; z: number };
        config?: {
          footprint?: ResourceFootprint;
          resourceType?: string;
        };
      };

      // Debug: log entity types we find
      if (count < 10) {
        console.log(
          `[ResourceTileDebugSystem] Entity ${entityId}: type="${entityAny.type}", hasPosition=${!!entityAny.position}`,
        );
      }
      count++;

      if (entityAny.type === "resource" && entityAny.position) {
        const footprint = entityAny.config?.footprint || "standard";
        const pos = entityAny.position;
        console.log(
          `[ResourceTileDebugSystem] Found resource: ${entityId} at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}), footprint=${footprint}`,
        );
        this.addResourceTiles(entityAny.id, entityAny.position, footprint);
        resourceCount++;
      }
    }

    console.log(
      `[ResourceTileDebugSystem] Created debug tiles for ${resourceCount} resources (scanned ${count} total entities)`,
    );
  }

  /**
   * Add debug tiles for a resource
   */
  private addResourceTiles(
    resourceId: string,
    position: { x: number; y: number; z: number },
    footprint: ResourceFootprint,
  ): void {
    // Skip if already exists
    if (this.debugTiles.has(resourceId)) {
      console.log(
        `[ResourceTileDebugSystem] Skipping ${resourceId} - already has debug tiles`,
      );
      return;
    }

    // Check if we have scene access
    if (!this.world.stage?.scene) {
      console.warn(
        `[ResourceTileDebugSystem] No scene available for ${resourceId}`,
      );
      return;
    }

    // Check shared resources
    if (!this.sharedGeometry || !this.sharedMaterial) {
      console.warn(
        `[ResourceTileDebugSystem] Shared geometry/material not initialized`,
      );
      return;
    }

    // Get footprint size
    const size = FOOTPRINT_SIZES[footprint];
    const anchorTile = worldToTile(position.x, position.z);

    console.log(
      `[ResourceTileDebugSystem] Creating ${size.x}x${size.z} debug tiles for ${resourceId} at anchor tile (${anchorTile.x}, ${anchorTile.z})`,
    );

    // Get terrain system for height lookups
    const terrain = this.world.getSystem("terrain") as {
      getHeightAt?: (x: number, z: number) => number;
    } | null;

    const handles: DebugTileHandle[] = [];

    // Create a mesh for each occupied tile
    for (let dx = 0; dx < size.x; dx++) {
      for (let dz = 0; dz < size.z; dz++) {
        const tile: TileCoord = {
          x: anchorTile.x + dx,
          z: anchorTile.z + dz,
        };

        // Calculate world position (tile center)
        const worldX = (tile.x + 0.5) * TILE_SIZE;
        const worldZ = (tile.z + 0.5) * TILE_SIZE;

        // Get terrain height at this tile
        let terrainY = position.y;
        if (terrain?.getHeightAt) {
          const height = terrain.getHeightAt(worldX, worldZ);
          if (Number.isFinite(height)) {
            terrainY = height;
          }
        }

        // Create mesh (use shared geometry/material for performance)
        const mesh = new THREE.Mesh(this.sharedGeometry, this.sharedMaterial);

        mesh.rotation.x = -Math.PI / 2; // Lay flat
        mesh.position.set(worldX, terrainY + 0.15, worldZ); // Slightly above terrain (0.15 to match zone visuals)
        mesh.renderOrder = 998; // Render just below zone visuals
        mesh.name = `resource-debug-${resourceId}-${tile.x}-${tile.z}`;

        // Mark as non-interactive
        mesh.userData.ignoreClickMove = true;
        mesh.userData.debugTile = true;
        mesh.userData.resourceId = resourceId;

        // Add to scene
        this.world.stage.scene.add(mesh);

        console.log(
          `[ResourceTileDebugSystem] Added tile mesh at (${worldX.toFixed(1)}, ${terrainY.toFixed(1)}, ${worldZ.toFixed(1)})`,
        );

        handles.push({ mesh, resourceId, tile });
      }
    }

    this.debugTiles.set(resourceId, handles);
    console.log(
      `[ResourceTileDebugSystem] ✅ Created ${handles.length} debug tiles for ${resourceId}`,
    );
  }

  /**
   * Remove debug tiles for a resource
   */
  private removeResourceTiles(resourceId: string): void {
    const handles = this.debugTiles.get(resourceId);
    if (!handles) return;

    for (const handle of handles) {
      this.world.stage?.scene.remove(handle.mesh);
      // Don't dispose geometry/material - they're shared
    }

    this.debugTiles.delete(resourceId);
  }

  /**
   * Clear all debug tiles
   */
  private clearAllTiles(): void {
    for (const [resourceId] of this.debugTiles) {
      this.removeResourceTiles(resourceId);
    }
    this.debugTiles.clear();
  }

  /**
   * Refresh all debug tiles (useful after teleport or area change)
   */
  public refresh(): void {
    this.clearAllTiles();
    if (this.enabled) {
      this.scanExistingResources();
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clearAllTiles();

    // Dispose shared resources
    if (this.sharedGeometry) {
      this.sharedGeometry.dispose();
      this.sharedGeometry = null;
    }
    if (this.sharedMaterial) {
      this.sharedMaterial.dispose();
      this.sharedMaterial = null;
    }

    super.destroy();
  }
}
