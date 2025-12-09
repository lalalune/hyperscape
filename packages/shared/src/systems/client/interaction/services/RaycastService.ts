/**
 * RaycastService
 *
 * Single implementation of entity raycasting for the interaction system.
 *
 * This consolidates the raycast logic that was duplicated in the legacy
 * InteractionSystem (called from 3+ places with same logic).
 *
 * Features:
 * - Raycast from screen position to 3D world
 * - Traverse object hierarchy to find entity root
 * - Return typed RaycastTarget with entity info
 * - Support for all entity types (item, npc, mob, resource, bank, player)
 */

import * as THREE from "three";
import type { World } from "../../../../core/World";
import type { RaycastTarget, InteractableEntityType } from "../types";
import { INPUT } from "../constants";

// Pre-allocated objects to avoid per-call allocations
const _raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();

export class RaycastService {
  constructor(private world: World) {}

  /**
   * Get entity at screen position
   *
   * Performs raycast from screen coordinates into the 3D scene
   * and returns the first interactable entity hit.
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
    const camera = this.world.camera;
    const scene = this.world.stage?.scene;

    if (!camera || !scene) return null;

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
          if (entity) {
            // Get entity world position
            const worldPos = new THREE.Vector3();
            obj.getWorldPosition(worldPos);

            // Determine entity type
            const rawType = entity.type || userData.type || "unknown";
            const entityType = this.getEntityType(rawType);

            return {
              entityId,
              entityType,
              entity,
              name: entity.name || userData.name || "Entity",
              position: {
                x: worldPos.x,
                y: worldPos.y,
                z: worldPos.z,
              },
              hitPoint: {
                x: intersect.point.x,
                y: intersect.point.y,
                z: intersect.point.z,
              },
              distance: intersect.distance,
            };
          }
        }

        obj = obj.parent;
      }
    }

    return null;
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
      default:
        // Default to npc for unknown interactive entities
        return "npc";
    }
  }

  /**
   * Raycast to terrain for ground click position
   *
   * Used for click-to-move when not clicking on an entity.
   *
   * @param screenX - Screen X coordinate
   * @param screenY - Screen Y coordinate
   * @param canvas - The canvas element
   * @returns World position if terrain hit, null otherwise
   */
  getTerrainPosition(
    screenX: number,
    screenY: number,
    canvas: HTMLCanvasElement,
  ): THREE.Vector3 | null {
    const camera = this.world.camera;
    const scene = this.world.stage?.scene;

    if (!camera || !scene) return null;

    // Convert screen coordinates to NDC
    const rect = canvas.getBoundingClientRect();
    _mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_mouse, camera);

    // Raycast against scene
    const intersects = _raycaster.intersectObjects(scene.children, true);

    for (const intersect of intersects) {
      // Skip entities - we want terrain only
      const userData = intersect.object.userData;
      if (
        userData?.entityId ||
        userData?.mobId ||
        userData?.resourceId ||
        userData?.itemId
      ) {
        continue;
      }

      // Found terrain
      return intersect.point.clone();
    }

    // Fallback: intersect with Y=0 plane
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    if (_raycaster.ray.intersectPlane(plane, target)) {
      return target;
    }

    return null;
  }
}
