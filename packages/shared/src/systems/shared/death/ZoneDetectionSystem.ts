/**
 * ZoneDetectionSystem
 *
 * Single source of truth for zone type detection.
 * Determines if a position is in safe area, wilderness, or PvP zone.
 * Caches results for performance.
 */

import { SystemBase } from "../infrastructure/SystemBase";
import type { World } from "../../../core/World";
import { getZoneByPosition } from "../../../data/world-structure";
import { ALL_WORLD_AREAS } from "../../../data/world-areas";
import type { ZoneType, ZoneProperties } from "../../../types/death";
import { ZoneType as ZoneTypeEnum } from "../../../types/death";

export class ZoneDetectionSystem extends SystemBase {
  // Cache zone lookups (key: "x,z", value: ZoneProperties)
  private zoneCache = new Map<string, ZoneProperties>();
  private readonly CACHE_GRID_SIZE = 10; // Cache in 10x10 chunks

  constructor(world: World) {
    super(world, {
      name: "zone-detection",
      dependencies: {
        required: [],
        optional: [],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Pre-warm cache for known areas
    this.prewarmCache();
  }

  /**
   * Check if position is in wilderness
   */
  isWilderness(position: { x: number; z: number }): boolean {
    const props = this.getZoneProperties(position);
    return props.isWilderness;
  }

  /**
   * Check if position is in safe zone
   */
  isSafeZone(position: { x: number; z: number }): boolean {
    const props = this.getZoneProperties(position);
    return props.isSafe;
  }

  /**
   * Check if PvP is enabled at position
   */
  isPvPEnabled(position: { x: number; z: number }): boolean {
    const props = this.getZoneProperties(position);
    return props.isPvPEnabled;
  }

  /**
   * Get zone type enum
   */
  getZoneType(position: { x: number; z: number }): ZoneType {
    const props = this.getZoneProperties(position);
    return props.type;
  }

  /**
   * Get complete zone properties (cached)
   */
  getZoneProperties(position: { x: number; z: number }): ZoneProperties {
    // Check cache first
    const cacheKey = this.getCacheKey(position.x, position.z);
    const cached = this.zoneCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Lookup zone
    const props = this.lookupZoneProperties(position);

    // Cache result
    this.zoneCache.set(cacheKey, props);

    return props;
  }

  /**
   * Actual zone lookup logic
   */
  private lookupZoneProperties(position: {
    x: number;
    z: number;
  }): ZoneProperties {
    for (const areaId in ALL_WORLD_AREAS) {
      const area = ALL_WORLD_AREAS[areaId];
      if (area.bounds) {
        const { minX, maxX, minZ, maxZ } = area.bounds;
        if (
          position.x >= minX &&
          position.x <= maxX &&
          position.z >= minZ &&
          position.z <= maxZ
        ) {
          const isSafe = area.safeZone === true;
          const isPvP = (area as { pvpEnabled?: boolean }).pvpEnabled === true;
          const isWild = !isSafe || isPvP;

          let type: ZoneType;
          if (isPvP) {
            type = ZoneTypeEnum.PVP_ZONE;
          } else if (isSafe) {
            type = ZoneTypeEnum.SAFE_AREA;
          } else {
            type = ZoneTypeEnum.WILDERNESS;
          }

          return {
            type,
            isSafe,
            isPvPEnabled: isPvP,
            isWilderness: isWild,
            name: area.name,
            difficultyLevel: area.difficultyLevel,
          };
        }
      }
    }

    const zone = getZoneByPosition(position);
    if (zone) {
      const zoneData = zone as { safeZone?: boolean; pvpEnabled?: boolean };
      const isSafe = zoneData.safeZone === true || zone.isTown === true;
      const isPvP = zoneData.pvpEnabled === true;
      const isWild = !isSafe || isPvP;

      let type: ZoneType;
      if (isPvP) {
        type = ZoneTypeEnum.PVP_ZONE;
      } else if (isSafe) {
        type = ZoneTypeEnum.SAFE_AREA;
      } else {
        type = ZoneTypeEnum.WILDERNESS;
      }

      return {
        type,
        isSafe,
        isPvPEnabled: isPvP,
        isWilderness: isWild,
        name: zone.name || "Unknown Zone",
        difficultyLevel: zone.difficultyLevel || 0,
      };
    }

    // Default: Unknown areas are safe (conservative approach)
    return {
      type: ZoneTypeEnum.SAFE_AREA,
      isSafe: true,
      isPvPEnabled: false,
      isWilderness: false,
      name: "Unknown",
      difficultyLevel: 0,
    };
  }

  /**
   * Generate cache key for position (quantized to grid)
   */
  private getCacheKey(x: number, z: number): string {
    const gridX = Math.floor(x / this.CACHE_GRID_SIZE);
    const gridZ = Math.floor(z / this.CACHE_GRID_SIZE);
    return `${gridX},${gridZ}`;
  }

  /**
   * Pre-warm cache for known safe zones
   */
  private prewarmCache(): void {
    for (const areaId in ALL_WORLD_AREAS) {
      const area = ALL_WORLD_AREAS[areaId];
      if (area.safeZone && area.bounds) {
        const centerX = (area.bounds.minX + area.bounds.maxX) / 2;
        const centerZ = (area.bounds.minZ + area.bounds.maxZ) / 2;
        this.getZoneProperties({ x: centerX, z: centerZ });
      }
    }
  }

  /**
   * Clear zone cache (for testing or dynamic zone changes)
   */
  clearCache(): void {
    this.zoneCache.clear();
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(_dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}
