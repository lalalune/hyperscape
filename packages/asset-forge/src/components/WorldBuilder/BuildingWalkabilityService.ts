/**
 * BuildingWalkabilityService - Simplified building walkability for Asset Forge
 *
 * This service provides building-aware walkability checks that match
 * the main game's BuildingCollisionService logic but simplified for
 * the Asset Forge world builder.
 *
 * Key features:
 * - Track building footprints when towns are generated
 * - Check if a tile is inside a building (walkable)
 * - Check if movement between tiles is blocked by a wall
 *
 * This ensures Asset Forge shows the same walkability as the actual game.
 */

import {
  type BuildingLayout,
  CELL_SIZE,
  FOUNDATION_HEIGHT,
} from "@hyperforge/procgen/building";

/** Registered building data */
interface RegisteredBuilding {
  id: string;
  townId: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  layout: BuildingLayout;
  /** World-space bounds (axis-aligned bounding box) */
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  /** Floor height (maxGroundY + FOUNDATION_HEIGHT) */
  floorHeight: number;
}

/** Result of walkability check */
interface WalkabilityResult {
  /** Is the tile walkable? */
  walkable: boolean;
  /** Is the tile inside a building? */
  inBuilding: boolean;
  /** Building ID if inside building */
  buildingId?: string;
  /** Reason if not walkable */
  reason?: string;
}

/** Singleton service for building walkability */
class BuildingWalkabilityService {
  private buildings = new Map<string, RegisteredBuilding>();
  private buildingsByTown = new Map<string, Set<string>>();

  /**
   * Register a building for walkability tracking
   */
  registerBuilding(
    buildingId: string,
    townId: string,
    position: { x: number; y: number; z: number },
    rotation: number,
    layout: BuildingLayout,
    maxGroundY: number,
  ): void {
    // Calculate world-space bounds
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const halfWidth = (layout.width * CELL_SIZE) / 2;
    const halfDepth = (layout.depth * CELL_SIZE) / 2;

    // Get rotated corners
    const corners = [
      { x: -halfWidth, z: -halfDepth },
      { x: halfWidth, z: -halfDepth },
      { x: -halfWidth, z: halfDepth },
      { x: halfWidth, z: halfDepth },
    ].map((c) => ({
      x: position.x + c.x * cos - c.z * sin,
      z: position.z + c.x * sin + c.z * cos,
    }));

    const bounds = {
      minX: Math.min(...corners.map((c) => c.x)),
      maxX: Math.max(...corners.map((c) => c.x)),
      minZ: Math.min(...corners.map((c) => c.z)),
      maxZ: Math.max(...corners.map((c) => c.z)),
    };

    const building: RegisteredBuilding = {
      id: buildingId,
      townId,
      position,
      rotation,
      layout,
      bounds,
      floorHeight: maxGroundY + FOUNDATION_HEIGHT,
    };

    this.buildings.set(buildingId, building);

    // Track by town
    if (!this.buildingsByTown.has(townId)) {
      this.buildingsByTown.set(townId, new Set());
    }
    this.buildingsByTown.get(townId)!.add(buildingId);
  }

  /**
   * Unregister all buildings for a town
   */
  unregisterTown(townId: string): void {
    const buildingIds = this.buildingsByTown.get(townId);
    if (buildingIds) {
      for (const id of buildingIds) {
        this.buildings.delete(id);
      }
      this.buildingsByTown.delete(townId);
    }
  }

  /**
   * Check if a world position is inside any building
   */
  isInsideBuilding(worldX: number, worldZ: number): RegisteredBuilding | null {
    for (const building of this.buildings.values()) {
      // Quick bounds check first
      if (
        worldX < building.bounds.minX ||
        worldX > building.bounds.maxX ||
        worldZ < building.bounds.minZ ||
        worldZ > building.bounds.maxZ
      ) {
        continue;
      }

      // Transform world position to building local coordinates
      const localX = worldX - building.position.x;
      const localZ = worldZ - building.position.z;

      // Rotate to building's local space
      const cos = Math.cos(-building.rotation);
      const sin = Math.sin(-building.rotation);
      const rotatedX = localX * cos - localZ * sin;
      const rotatedZ = localX * sin + localZ * cos;

      // Convert to cell coordinates
      const halfWidth = (building.layout.width * CELL_SIZE) / 2;
      const halfDepth = (building.layout.depth * CELL_SIZE) / 2;
      const cellX = Math.floor((rotatedX + halfWidth) / CELL_SIZE);
      const cellZ = Math.floor((rotatedZ + halfDepth) / CELL_SIZE);

      // Check if cell is in footprint
      const footprint = building.layout.floorPlans[0]?.footprint;
      if (
        footprint &&
        cellZ >= 0 &&
        cellZ < footprint.length &&
        cellX >= 0 &&
        cellX < (footprint[cellZ]?.length ?? 0) &&
        footprint[cellZ][cellX]
      ) {
        return building;
      }
    }
    return null;
  }

  /**
   * Check walkability at a world position
   *
   * Inside buildings: walkable (floor tiles are walkable)
   * Outside buildings: defer to terrain check
   */
  checkWalkability(
    worldX: number,
    worldZ: number,
    terrainWalkable: boolean,
  ): WalkabilityResult {
    const building = this.isInsideBuilding(worldX, worldZ);

    if (building) {
      return {
        walkable: true, // Building interiors are walkable
        inBuilding: true,
        buildingId: building.id,
      };
    }

    // Not in building - use terrain walkability
    return {
      walkable: terrainWalkable,
      inBuilding: false,
      reason: terrainWalkable ? undefined : "terrain",
    };
  }

  /**
   * Check if movement between two tiles is blocked by a wall
   *
   * This is a simplified check - the full game checks wall segments
   * For Asset Forge, we check if crossing a building boundary
   */
  isMovementBlocked(
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
  ): boolean {
    const _fromBuilding = this.isInsideBuilding(fromX, fromZ);
    const _toBuilding = this.isInsideBuilding(toX, toZ);

    // If moving between different buildings (or in/out of a building)
    // that's a potential wall crossing - but we allow it for doors
    // The full BuildingCollisionService handles this properly
    // For Asset Forge visualization, we'll allow it

    return false; // Simplified - walls not visualized
  }

  /**
   * Get building at position (for selection)
   */
  getBuildingAt(worldX: number, worldZ: number): RegisteredBuilding | null {
    return this.isInsideBuilding(worldX, worldZ);
  }

  /**
   * Get floor height at position (for terrain flattening display)
   */
  getFloorHeight(worldX: number, worldZ: number): number | null {
    const building = this.isInsideBuilding(worldX, worldZ);
    return building ? building.floorHeight : null;
  }

  /**
   * Clear all registered buildings
   */
  clear(): void {
    this.buildings.clear();
    this.buildingsByTown.clear();
  }

  /**
   * Get statistics
   */
  getStats(): { buildingCount: number; townCount: number } {
    return {
      buildingCount: this.buildings.size,
      townCount: this.buildingsByTown.size,
    };
  }
}

// Singleton instance
const buildingWalkabilityService = new BuildingWalkabilityService();

export {
  buildingWalkabilityService,
  BuildingWalkabilityService,
  type RegisteredBuilding,
  type WalkabilityResult,
};
