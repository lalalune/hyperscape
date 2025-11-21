/**
 * Spectator Mode Utilities
 *
 * Utilities for setting up and managing spectator camera mode in embedded viewports.
 * Handles camera locking, input disabling, and entity following.
 */

import type { World } from "@hyperscape/shared";
import { EventType } from "@hyperscape/shared";

/**
 * Options for spectator camera setup
 */
export interface SpectatorModeOptions {
  /** Entity ID to follow */
  targetEntityId: string;
  /** Lock camera (disable user control) */
  lockCamera?: boolean;
  /** Disable player movement controls */
  disableControls?: boolean;
  /** Camera distance from target */
  cameraDistance?: number;
  /** Camera height offset */
  cameraHeight?: number;
}

/**
 * Setup spectator camera to follow a specific entity
 *
 * @param world - The game world instance
 * @param options - Spectator mode configuration
 * @returns Cleanup function to remove event listeners
 */
export function setupSpectatorMode(
  world: World,
  options: SpectatorModeOptions,
): () => void {
  const {
    targetEntityId,
    lockCamera = true,
    disableControls = true,
    cameraDistance,
    cameraHeight,
  } = options;

  console.log("[SpectatorMode] Setting up spectator mode:", {
    targetEntityId,
    lockCamera,
    disableControls,
  });

  // Disable player controls if requested
  if (disableControls) {
    disablePlayerControls(world);
  }

  // Track if we've found and locked to the target
  let isLocked = false;

  // Handler for entity spawned events
  const handleEntitySpawned = (...args: unknown[]) => {
    if (isLocked) return;

    const data = args[0] as {
      entityId?: string;
      entityData?: { characterId?: string };
    };

    if (!data.entityId) return;

    // Get entity manager to fetch full entity data
    const entityManager = world.getSystem("entity-manager");
    if (!entityManager) return;

    const em = entityManager as {
      getEntity?: (id: string) => {
        id: string;
        characterId?: string;
        node?: { position: unknown };
      } | null;
    };

    const entity = em.getEntity?.(data.entityId);
    if (!entity) return;

    const isTargetEntity =
      entity.id === targetEntityId || entity.characterId === targetEntityId;

    if (isTargetEntity && entity.node) {
      console.log(
        "[SpectatorMode] Found target entity, locking camera:",
        entity.id,
      );

      // Lock camera to this entity
      lockCameraToEntity(world, entity, {
        lock: lockCamera,
        distance: cameraDistance,
        height: cameraHeight,
      });

      isLocked = true;
    }
  };

  // Subscribe to entity spawned events
  world.on(EventType.ENTITY_SPAWNED, handleEntitySpawned);

  // Check existing entities
  setTimeout(() => {
    if (!isLocked) {
      checkExistingEntities(world, targetEntityId, {
        lock: lockCamera,
        distance: cameraDistance,
        height: cameraHeight,
      });
    }
  }, 1000);

  // Return cleanup function
  return () => {
    world.off(EventType.ENTITY_SPAWNED, handleEntitySpawned);
    console.log("[SpectatorMode] Spectator mode cleaned up");
  };
}

/**
 * Lock camera to a specific entity
 */
function lockCameraToEntity(
  world: World,
  entity: { id: string; node?: { position: unknown } },
  options: { lock?: boolean; distance?: number; height?: number },
) {
  const cameraSystem = world.getSystem("client-camera-system") as {
    setTarget?: (target: unknown, lock?: boolean) => void;
    setDistance?: (distance: number) => void;
    setHeight?: (height: number) => void;
  } | null;

  if (!cameraSystem) {
    console.warn("[SpectatorMode] Camera system not found");
    return;
  }

  // Set camera target
  if (cameraSystem.setTarget) {
    cameraSystem.setTarget(entity, options.lock);
  } else {
    // Fallback to event emission
    // Entity has node.position, but CAMERA_SET_TARGET expects target.position
    const target = entity.node?.position
      ? {
          position: entity.node.position as { x: number; y: number; z: number },
        }
      : (entity as unknown as {
          position: { x: number; y: number; z: number };
        });

    world.emit(EventType.CAMERA_SET_TARGET, { target });
  }

  // Set camera distance if specified
  if (options.distance !== undefined && cameraSystem.setDistance) {
    cameraSystem.setDistance(options.distance);
  }

  // Set camera height if specified
  if (options.height !== undefined && cameraSystem.setHeight) {
    cameraSystem.setHeight(options.height);
  }

  console.log("[SpectatorMode] Camera locked to entity:", entity.id);
}

/**
 * Check existing entities for the target
 */
function checkExistingEntities(
  world: World,
  targetEntityId: string,
  cameraOptions: { lock?: boolean; distance?: number; height?: number },
) {
  const entityManager = world.getSystem("entity-manager") as {
    getAllEntities?: () => Map<
      string,
      { id: string; characterId?: string; node?: { position: unknown } }
    >;
  } | null;

  if (!entityManager?.getAllEntities) {
    console.warn("[SpectatorMode] Entity manager not available");
    return;
  }

  for (const [, entity] of entityManager.getAllEntities()) {
    const isTargetEntity =
      entity.id === targetEntityId || entity.characterId === targetEntityId;

    if (isTargetEntity && entity.node) {
      lockCameraToEntity(world, entity, cameraOptions);
      break;
    }
  }
}

/**
 * Disable player movement and interaction controls
 */
export function disablePlayerControls(world: World) {
  const input = world.getSystem("controls") as {
    disable?: () => void;
    setEnabled?: (enabled: boolean) => void;
  } | null;

  if (!input) {
    console.warn("[SpectatorMode] Controls system not found");
    return;
  }

  // Try method 1: disable()
  if (input.disable) {
    input.disable();
    console.log("[SpectatorMode] Player controls disabled via disable()");
    return;
  }

  // Try method 2: setEnabled(false)
  if (input.setEnabled) {
    input.setEnabled(false);
    console.log(
      "[SpectatorMode] Player controls disabled via setEnabled(false)",
    );
    return;
  }

  console.warn(
    "[SpectatorMode] Could not disable controls - no disable method found",
  );
}

/**
 * Enable player controls (undo spectator mode)
 */
export function enablePlayerControls(world: World) {
  const input = world.getSystem("controls") as {
    enable?: () => void;
    setEnabled?: (enabled: boolean) => void;
  } | null;

  if (!input) {
    console.warn("[SpectatorMode] Controls system not found");
    return;
  }

  // Try method 1: enable()
  if (input.enable) {
    input.enable();
    console.log("[SpectatorMode] Player controls enabled via enable()");
    return;
  }

  // Try method 2: setEnabled(true)
  if (input.setEnabled) {
    input.setEnabled(true);
    console.log("[SpectatorMode] Player controls enabled via setEnabled(true)");
    return;
  }

  console.warn(
    "[SpectatorMode] Could not enable controls - no enable method found",
  );
}

/**
 * Hide UI elements for cleaner spectator view
 */
export function hideUIElements(world: World, elements: string[]) {
  world.emit(EventType.UI_HIDE_ELEMENTS, { elements });
  console.log("[SpectatorMode] Hiding UI elements:", elements);
}

/**
 * Show previously hidden UI elements
 */
export function showUIElements(world: World, elements: string[]) {
  world.emit(EventType.UI_SHOW_ELEMENTS, { elements });
  console.log("[SpectatorMode] Showing UI elements:", elements);
}
