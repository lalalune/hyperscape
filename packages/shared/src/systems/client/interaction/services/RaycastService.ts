/**
 * RaycastService
 *
 * Single implementation of entity raycasting for the interaction system.
 * AAA-quality implementation with zero allocations in hot paths.
 *
 * Features:
 * - Raycast from screen position to 3D world
 * - Traverse object hierarchy to find entity root
 * - Return typed RaycastTarget with entity info
 * - Support for all entity types (item, npc, mob, resource, bank, player)
 * - Frame-based caching to avoid duplicate raycasts (same position within 16ms)
 * - Pre-allocated reusable objects for zero GC pressure
 *
 * Performance:
 * - All THREE.js objects pre-allocated at module load
 * - Results cached for 16ms to avoid duplicate raycasts per frame
 * - hasEntityAtPosition() for quick boolean checks without full result
 */

import * as THREE from "three";
import type { World } from "../../../../core/World";
import type {
  RaycastTarget,
  InteractableEntityType,
  EntityFootprint,
} from "../types";
import type { BuildingCollisionService } from "../../../shared/world/BuildingCollisionService";
import { INPUT } from "../constants";
import { stationDataProvider } from "../../../../data/StationDataProvider";
import { resolveFootprint } from "../../../../types/game/resource-processing-types";
import { MobAIState } from "../../../../types/entities/entities";
import { worldToTile } from "../../../shared/movement/TileSystem";

// === PRE-ALLOCATED OBJECTS (zero allocations in hot paths) ===
const _raycaster = new THREE.Raycaster();
// Enable layer 1 for raycaster (entities like mobs, NPCs, items, resources, players are on layer 1)
// Layer 0 is for terrain/minimap-only objects, layer 1 is for main camera objects
_raycaster.layers.enable(1);

// === MOVEMENT RAYCASTER (for click-to-move) ===
// Only hits walkable surfaces: terrain (layer 0) and building floors (layer 2)
// Excludes walls (layer 1) so clicking inside buildings hits floors, not walls
const _movementRaycaster = new THREE.Raycaster();
_movementRaycaster.layers.set(0); // Terrain (layer 0)
_movementRaycaster.layers.enable(2); // Building floors (layer 2)

const _mouse = new THREE.Vector2();
const _worldPos = new THREE.Vector3();
const _terrainResult = new THREE.Vector3();
const _fallbackPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _planeTarget = new THREE.Vector3();

// === CACHE CONFIGURATION ===
const CACHE_DURATION_MS = 16; // ~1 frame at 60fps
const CACHE_POSITION_TOLERANCE = 2; // pixels - consider same position if within this

// === CACHE STATE ===
interface RaycastCache {
  screenX: number;
  screenY: number;
  timestamp: number;
  result: RaycastTarget | null;
  hasEntity: boolean;
}

// === METRICS (optional, for debugging) ===
interface RaycastMetrics {
  cacheHits: number;
  cacheMisses: number;
  totalQueries: number;
}

export class RaycastService {
  // Per-instance cache (allows multiple services if needed)
  private cache: RaycastCache | null = null;

  // Optional metrics for debugging (null = disabled)
  private metrics: RaycastMetrics | null = null;

  constructor(private world: World) {}

  /**
   * Get BuildingCollisionService from TownSystem (if available)
   */
  private getBuildingCollisionService(): BuildingCollisionService | null {
    const townSystem = this.world.getSystem("towns") as {
      getCollisionService?: () => BuildingCollisionService;
    } | null;
    return townSystem?.getCollisionService?.() ?? null;
  }

  // === PUBLIC METRICS API ===

  /**
   * Enable metrics collection for debugging
   *
   * When enabled, tracks cache hits/misses and total queries.
   * Use in dev mode to verify cache sharing is working.
   *
   * @example
   * ```typescript
   * // In browser console:
   * const svc = world.getSystem('interaction').getRaycastService();
   * svc.enableMetrics();
   * // ... do some right-clicks ...
   * console.log(svc.getMetrics());
   * ```
   */
  enableMetrics(): void {
    this.metrics = { cacheHits: 0, cacheMisses: 0, totalQueries: 0 };
  }

  /**
   * Disable metrics collection
   */
  disableMetrics(): void {
    this.metrics = null;
  }

  /**
   * Get current metrics (null if not enabled)
   */
  getMetrics(): Readonly<RaycastMetrics> | null {
    return this.metrics;
  }

  /**
   * Reset metrics counters to zero
   */
  resetMetrics(): void {
    if (this.metrics) {
      this.metrics.cacheHits = 0;
      this.metrics.cacheMisses = 0;
      this.metrics.totalQueries = 0;
    }
  }

  /**
   * Check if an entity exists at screen position (fast path)
   *
   * Uses cached result if available, avoiding duplicate raycasts.
   * Ideal for systems that only need to know IF there's an entity,
   * not the full details (e.g., ClientCameraSystem).
   *
   * @param screenX - Screen X coordinate
   * @param screenY - Screen Y coordinate
   * @param canvas - The canvas element
   * @returns true if an entity exists at position
   */
  hasEntityAtPosition(
    screenX: number,
    screenY: number,
    canvas: HTMLCanvasElement,
  ): boolean {
    // Track total queries for metrics
    if (this.metrics) this.metrics.totalQueries++;

    // Check cache first
    if (this.isCacheValid(screenX, screenY)) {
      return this.cache!.hasEntity;
    }

    // Perform raycast and cache result (getEntityAtPosition will increment totalQueries again,
    // but we've already done so above - need to avoid double counting)
    // Temporarily disable metrics for the nested call
    const savedMetrics = this.metrics;
    this.metrics = null;
    const result = this.getEntityAtPosition(screenX, screenY, canvas);
    this.metrics = savedMetrics;

    return result !== null;
  }

  /**
   * Get entity at screen position
   *
   * Performs raycast from screen coordinates into the 3D scene
   * and returns the first interactable entity hit.
   *
   * Results are cached for ~16ms to avoid duplicate raycasts
   * when multiple systems query the same position per frame.
   *
   * @param screenX - Screen X coordinate (clientX from mouse event)
   * @param screenY - Screen Y coordinate (clientY from mouse event)
   * @param canvas - The canvas element for coordinate conversion
   * @returns RaycastTarget if an entity was hit, null otherwise
   */
  getEntityAtPosition(
    screenX: number,
    screenY: number,
    canvas: HTMLCanvasElement,
  ): RaycastTarget | null {
    // Track total queries for metrics
    if (this.metrics) this.metrics.totalQueries++;

    // Check cache first - avoid duplicate raycasts per frame
    if (this.isCacheValid(screenX, screenY)) {
      return this.cache!.result;
    }

    const camera = this.world.camera;
    const scene = this.world.stage?.scene;

    if (!camera || !scene) {
      this.updateCache(screenX, screenY, null);
      return null;
    }

    // Convert screen coordinates to normalized device coordinates (-1 to +1)
    const rect = canvas.getBoundingClientRect();
    _mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1;

    // Setup raycaster
    _raycaster.setFromCamera(_mouse, camera);

    // Raycast against all scene objects
    const intersects = _raycaster.intersectObjects(scene.children, true);

    for (const intersect of intersects) {
      // Skip objects beyond max raycast distance
      if (intersect.distance > INPUT.MAX_RAYCAST_DISTANCE) continue;

      // Traverse up the object hierarchy to find entity root
      let obj: THREE.Object3D | null = intersect.object;
      while (obj) {
        const userData = obj.userData;

        // Look for any entity identifier in userData
        const entityId =
          userData?.entityId ||
          userData?.mobId ||
          userData?.resourceId ||
          userData?.itemId;

        if (entityId) {
          const entity = this.world.entities.get(entityId);
          // Skip destroyed entities - they may still be in scene during async cleanup
          if (entity && !entity.destroyed) {
            // Skip dead mobs to allow clicking items underneath (Issue #562)
            if (this.isDeadMob(entity, userData)) {
              break; // Skip dead mob and check next intersection (item underneath)
            }

            // Get entity world position using pre-allocated vector
            obj.getWorldPosition(_worldPos);

            // Determine entity type
            const rawType = entity.type || userData.type || "unknown";
            const entityType = this.getEntityType(rawType);

            // Get footprint for station entities (multi-tile objects)
            const footprint = this.getEntityFootprint(entityType);

            // Build result (object literals are cheap, no THREE objects allocated)
            const result: RaycastTarget = {
              entityId,
              entityType,
              entity,
              name: entity.name || userData.name || "Entity",
              position: {
                x: _worldPos.x,
                y: _worldPos.y,
                z: _worldPos.z,
              },
              hitPoint: {
                x: intersect.point.x,
                y: intersect.point.y,
                z: intersect.point.z,
              },
              distance: intersect.distance,
              footprint,
            };

            this.updateCache(screenX, screenY, result);
            return result;
          }

          // Special handling for fire entities (not in world.entities, managed by ProcessingSystem)
          if (userData.type === "fire" && entityId.startsWith("fire_")) {
            obj.getWorldPosition(_worldPos);

            const result: RaycastTarget = {
              entityId,
              entityType: "fire",
              entity: null, // Fire is not a standard entity
              name: userData.name || "Fire",
              position: {
                x: _worldPos.x,
                y: _worldPos.y,
                z: _worldPos.z,
              },
              hitPoint: {
                x: intersect.point.x,
                y: intersect.point.y,
                z: intersect.point.z,
              },
              distance: intersect.distance,
            };

            this.updateCache(screenX, screenY, result);
            return result;
          }

          // Special handling for forfeit pillars (visual-only, not in world.entities)
          if (
            userData.type === "forfeit_pillar" &&
            entityId.startsWith("forfeit_pillar_")
          ) {
            obj.getWorldPosition(_worldPos);

            const result: RaycastTarget = {
              entityId,
              entityType: "forfeit_pillar",
              entity: null, // Forfeit pillar is not a standard entity
              name: userData.name || "Trapdoor",
              position: {
                x: _worldPos.x,
                y: _worldPos.y,
                z: _worldPos.z,
              },
              hitPoint: {
                x: intersect.point.x,
                y: intersect.point.y,
                z: intersect.point.z,
              },
              distance: intersect.distance,
            };

            this.updateCache(screenX, screenY, result);
            return result;
          }
        }

        obj = obj.parent;
      }
    }

    this.updateCache(screenX, screenY, null);
    return null;
  }

  /**
   * Get world position from screen coordinates for click-to-move.
   *
   * Uses the movement raycaster which only hits walkable surfaces:
   * - Terrain (layer 0)
   * - Building floors, stairs, entrance steps (layer 2)
   *
   * Excludes walls (layer 1) so clicking inside buildings hits floors.
   * Uses pre-allocated objects for zero GC pressure.
   *
   * @param screenX - Screen X coordinate
   * @param screenY - Screen Y coordinate
   * @param canvas - The canvas element
   * @returns World position if walkable surface hit, null otherwise
   */
  getTerrainPosition(
    screenX: number,
    screenY: number,
    canvas: HTMLCanvasElement,
  ): THREE.Vector3 | null {
    // Validate inputs
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
      console.error(
        `[RaycastService] getTerrainPosition called with invalid screen coords: (${screenX}, ${screenY})`,
      );
      return null;
    }
    if (!canvas || typeof canvas.getBoundingClientRect !== "function") {
      console.error(
        `[RaycastService] getTerrainPosition called with invalid canvas`,
      );
      return null;
    }

    const camera = this.world.camera;
    const scene = this.world.stage?.scene;

    if (!camera || !scene) return null;

    // Convert screen coordinates to NDC
    const rect = canvas.getBoundingClientRect();
    _mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1;

    // Use movement raycaster (only hits walkable surfaces: terrain + building floors)
    _movementRaycaster.setFromCamera(_mouse, camera);

    // Raycast against scene with layer filtering (0=terrain, 2=building floors)
    const intersects = _movementRaycaster.intersectObjects(
      scene.children,
      true,
    );

    // Two-pass approach: prioritize building floors (layer 2) over terrain
    // This handles the case where terrain mesh wasn't updated after flat zones
    // were registered and may protrude through building floors.
    const collisionService = this.getBuildingCollisionService();
    let terrainHit: THREE.Intersection | null = null;
    const buildingFloorHits: THREE.Intersection[] = [];

    for (const intersect of intersects) {
      const userData = intersect.object.userData;

      // Skip entities - we want terrain/floors only
      if (
        userData?.entityId ||
        userData?.mobId ||
        userData?.resourceId ||
        userData?.itemId
      ) {
        continue;
      }

      // Skip explicitly non-walkable surfaces
      if (userData?.walkable === false) {
        continue;
      }

      // Skip surfaces marked to ignore click-move
      if (userData?.ignoreClickMove) {
        continue;
      }

      // Check if this is a building floor (layer 2) - prioritize these
      // Building floors have userData.walkable: true and are on layer 2
      const isBuildingFloor =
        userData?.type === "batched-building-floors" ||
        userData?.type === "arena-floor" ||
        (userData?.walkable === true &&
          intersect.object.layers.isEnabled(2) &&
          !intersect.object.layers.isEnabled(0));

      if (isBuildingFloor) {
        // Duel arena floors are standalone walkable surfaces, not part of town buildings.
        // Skip the building footprint check for them - otherwise they get incorrectly
        // rejected and the click falls through to the Y=0 plane (target goes underground).
        const isDuelFloor = userData?.type === "arena-floor";
        if (!isDuelFloor && collisionService) {
          const hitTile = worldToTile(intersect.point.x, intersect.point.z);
          const hitInFootprint =
            collisionService.isTileInBuildingAnyFloor(hitTile.x, hitTile.z) !==
            null;
          if (!hitInFootprint) {
            continue;
          }
        }
        buildingFloorHits.push(intersect);
      } else if (!terrainHit) {
        terrainHit = intersect;
      }
    }

    let chosenHit: THREE.Intersection | null = null;

    // Select best building floor hit (closest to player elevation if available)
    // CRITICAL: Reject hits on floors far from the player's current Y.
    // Without this, clicking above a building hits upper floor tiles (layer 2)
    // that are in the same batched mesh, even when the player is on the ground
    // floor. Upper floor ceilings are invisible but the floor tiles above them
    // are still raycastable since all floors share one mesh per town.
    // Threshold: one floor height (~3.4m) to allow stair transitions but reject
    // clicking on floors the player hasn't reached yet.
    const MAX_FLOOR_Y_DIFF = 1.5; // Enough to allow stair climbing (0.75m half-steps), but reject clicking on upper floors (3.4m height)

    let preferredBuildingHit: THREE.Intersection | null = null;
    if (buildingFloorHits.length > 0) {
      const player = this.world.getPlayer();
      const preferredY = player?.position.y;
      if (Number.isFinite(preferredY)) {
        let bestDiff = Infinity;
        for (const hit of buildingFloorHits) {
          const diff = Math.abs(hit.point.y - (preferredY as number));

          // Reject floor hits that are more than one floor above/below the player.
          // This prevents clicking on upper floor tiles when on the ground floor,
          // and clicking on ground floor tiles when on an upper floor.
          if (diff > MAX_FLOOR_Y_DIFF) {
            continue;
          }

          if (diff < bestDiff) {
            bestDiff = diff;
            preferredBuildingHit = hit;
          }
        }
      } else {
        preferredBuildingHit = buildingFloorHits[0] ?? null;
      }
    }

    if (preferredBuildingHit) {
      if (!terrainHit) {
        chosenHit = preferredBuildingHit;
      } else {
        // Prefer building floor only when terrain is inside a building footprint
        let terrainInsideBuilding = false;
        if (collisionService) {
          const terrainTile = worldToTile(
            terrainHit.point.x,
            terrainHit.point.z,
          );
          terrainInsideBuilding =
            collisionService.isTileInBuildingFootprint(
              terrainTile.x,
              terrainTile.z,
            ) !== null;
        }

        if (terrainInsideBuilding) {
          chosenHit = preferredBuildingHit;
        } else {
          // Otherwise choose the closest hit along the ray
          chosenHit =
            preferredBuildingHit.distance <= terrainHit.distance
              ? preferredBuildingHit
              : terrainHit;
        }
      }
    } else if (terrainHit) {
      chosenHit = terrainHit;
    }
    if (chosenHit) {
      _terrainResult.copy(chosenHit.point);

      // Validate result is finite
      if (
        !Number.isFinite(_terrainResult.x) ||
        !Number.isFinite(_terrainResult.z)
      ) {
        console.error(
          `[RaycastService] CRITICAL: Raycast hit returned non-finite position: (${_terrainResult.x}, ${_terrainResult.y}, ${_terrainResult.z})`,
          {
            hitObject: chosenHit.object.name,
            hitType: chosenHit.object.userData?.type,
          },
        );
        return null;
      }

      return _terrainResult;
    }

    // Fallback: intersect with Y=0 plane using pre-allocated objects
    if (_movementRaycaster.ray.intersectPlane(_fallbackPlane, _planeTarget)) {
      _terrainResult.copy(_planeTarget);
      return _terrainResult;
    }

    return null;
  }

  /**
   * Clear the raycast cache
   *
   * Call when scene changes significantly (teleport, zone change, etc.)
   */
  clearCache(): void {
    this.cache = null;
  }

  // === PRIVATE METHODS ===

  /**
   * Check if cache is valid for given screen position
   */
  private isCacheValid(screenX: number, screenY: number): boolean {
    if (!this.cache) {
      if (this.metrics) this.metrics.cacheMisses++;
      return false;
    }

    const now = performance.now();
    const age = now - this.cache.timestamp;

    // Cache expired
    if (age > CACHE_DURATION_MS) {
      if (this.metrics) this.metrics.cacheMisses++;
      return false;
    }

    // Position changed significantly
    const dx = Math.abs(screenX - this.cache.screenX);
    const dy = Math.abs(screenY - this.cache.screenY);
    if (dx > CACHE_POSITION_TOLERANCE || dy > CACHE_POSITION_TOLERANCE) {
      if (this.metrics) this.metrics.cacheMisses++;
      return false;
    }

    if (this.metrics) this.metrics.cacheHits++;
    return true;
  }

  /**
   * Update cache with new raycast result
   */
  private updateCache(
    screenX: number,
    screenY: number,
    result: RaycastTarget | null,
  ): void {
    this.cache = {
      screenX,
      screenY,
      timestamp: performance.now(),
      result,
      hasEntity: result !== null,
    };
  }

  /**
   * Map raw entity type string to InteractableEntityType
   */
  private getEntityType(type: string): InteractableEntityType {
    switch (type.toLowerCase()) {
      case "item":
        return "item";
      case "npc":
        return "npc";
      case "mob":
        return "mob";
      case "resource":
        return "resource";
      case "bank":
        return "bank";
      case "player":
        return "player";
      case "corpse":
        return "corpse";
      case "headstone":
        return "headstone";
      case "fire":
        return "fire";
      case "range":
        return "range";
      case "furnace":
        return "furnace";
      case "anvil":
        return "anvil";
      case "altar":
        return "altar";
      case "runecrafting_altar":
        return "runecrafting_altar";
      case "starter_chest":
        return "starter_chest";
      case "forfeit_pillar":
        return "forfeit_pillar";
      default:
        // Default to npc for unknown interactive entities
        return "npc";
    }
  }

  /**
   * Get footprint for station entities (multi-tile objects like furnace, anvil, etc.)
   *
   * Returns footprint dimensions for entities that occupy multiple tiles.
   * This enables classic MMORPG-style interaction where players can interact from
   * any tile adjacent to the entity's footprint, not just the center.
   *
   * @param entityType - The entity type
   * @returns EntityFootprint if entity has a multi-tile footprint, undefined otherwise
   */
  private getEntityFootprint(
    entityType: InteractableEntityType,
  ): EntityFootprint | undefined {
    // Station entities have footprints defined in the station manifest
    if (!stationDataProvider.hasStation(entityType)) {
      return undefined;
    }

    // Get footprint from station data provider
    const footprintSpec = stationDataProvider.getFootprint(entityType);
    const resolved = resolveFootprint(footprintSpec);

    // Only return if it's actually multi-tile (skip 1x1)
    if (resolved.x <= 1 && resolved.z <= 1) {
      return undefined;
    }

    return {
      width: resolved.x,
      depth: resolved.z,
    };
  }

  /**
   * Check if entity is a dead mob that should be skipped during raycasting.
   *
   * Dead mobs keep their raycast hitbox in the scene but shouldn't block
   * interaction with items dropped at their location. This allows players
   * to click through dead mobs to pick up loot.
   *
   * @param entity - The entity to check
   * @param userData - Object3D userData containing type information
   * @returns true if entity is a dead mob that should be skipped
   *
   * @see Issue #562: Dead mob blocks picking up items until it respawns
   */
  private isDeadMob(
    entity: { type?: string },
    userData: { type?: string },
  ): boolean {
    const entityType = entity.type || userData.type;
    if (entityType !== "mob") {
      return false;
    }

    // Type guard: check if entity has mob config properties
    const mobEntity = entity as {
      config?: { aiState?: MobAIState; currentHealth?: number };
    };

    if (!mobEntity.config) {
      return false;
    }

    const { aiState, currentHealth } = mobEntity.config;

    // Mob is dead if aiState is DEAD or health is 0 or below
    return (
      aiState === MobAIState.DEAD ||
      (currentHealth !== undefined && currentHealth <= 0)
    );
  }
}
