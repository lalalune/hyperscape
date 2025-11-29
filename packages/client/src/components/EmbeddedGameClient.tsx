/**
 * Embedded Game Client - Spectator Viewport for AI Agents
 *
 * Renders the Hyperscape game in embedded mode for viewing agents play in real-time.
 * Auto-connects with embedded configuration and sets up spectator camera.
 */

import { useEffect, useState } from "react";
import { GameClient } from "../screens/GameClient";
import type { EmbeddedViewportConfig } from "../types/embeddedConfig";
import { getEmbeddedConfig, getQualityPreset } from "../types/embeddedConfig";
import type { World } from "@hyperscape/shared";
import { EventType } from "@hyperscape/shared";

/**
 * Disable all player input controls (spectator mode)
 * This prevents click-to-move, keyboard movement, and all other player input
 */
function disablePlayerControls(world: World) {
  // The input system is named "client-input", not "controls"
  const input = world.getSystem("client-input") as {
    disable?: () => void;
    setEnabled?: (enabled: boolean) => void;
  } | null;

  if (input?.disable) {
    input.disable();
    return true;
  }

  if (input?.setEnabled) {
    input.setEnabled(false);
    return true;
  }

  console.warn(
    "[EmbeddedGameClient] Could not disable controls - client-input system not found or missing disable method",
  );
  return false;
}

/**
 * Setup spectator camera to follow agent's character
 *
 * CRITICAL: For camera following to work, we must pass the ACTUAL entity instance
 * (not a copy) as the camera target. The camera reads target.position every frame,
 * and TileInterpolator updates entity.position as a THREE.Vector3. If we pass a copy,
 * the camera won't see position updates.
 */
function setupSpectatorCamera(world: World, config: EmbeddedViewportConfig) {
  // CRITICAL: Disable player input IMMEDIATELY for spectator mode
  // This prevents click-to-move and all other input
  if (config.mode === "spectator") {
    // Try to disable immediately
    const disabled = disablePlayerControls(world);

    // If not ready yet, retry after systems initialize (with max retries)
    if (!disabled) {
      const MAX_RETRIES = 10;
      let retryCount = 0;

      const retryDisable = () => {
        retryCount++;
        const success = disablePlayerControls(world);
        if (!success && retryCount < MAX_RETRIES) {
          // Retry with increasing delay (100, 200, 300, ... 500ms max)
          setTimeout(retryDisable, Math.min(100 * retryCount, 500));
        } else if (!success) {
          console.warn(
            `[EmbeddedGameClient] Failed to disable controls after ${MAX_RETRIES} retries - spectator mode may not work correctly`,
          );
        }
      };
      setTimeout(retryDisable, 100);
    }
  }

  const targetEntityId = config.followEntity || config.characterId;

  if (!targetEntityId) {
    console.warn("[EmbeddedGameClient] No entity to follow specified");
    return;
  }

  /**
   * Find the ACTUAL entity instance from world.entities
   * This is critical - we need the live entity object, not a copy,
   * so the camera can track position updates from TileInterpolator
   */
  const findLiveEntity = (entityId: string) => {
    // Try world.entities.items first (contains all entity types)
    const fromItems = world.entities?.items?.get(entityId);
    if (fromItems) return fromItems;

    // Try world.entities.players (PlayerRemote instances)
    const fromPlayers = world.entities?.players?.get(entityId);
    if (fromPlayers) return fromPlayers;

    // Try entity-manager as fallback
    const entityManager = world.getSystem("entity-manager") as {
      getEntity?: (id: string) => unknown;
    } | null;
    if (entityManager?.getEntity) {
      return entityManager.getEntity(entityId);
    }

    return null;
  };

  /**
   * Set camera to follow the target entity
   * CRITICAL: Pass the actual entity instance, not a wrapper object!
   */
  const setCameraTarget = (entity: unknown) => {
    if (!entity) return;

    const e = entity as { id?: string; position?: unknown };
    if (!e.position) {
      console.warn(
        `[EmbeddedGameClient] Entity ${e.id} has no position - cannot follow`,
      );
      return;
    }

    console.log(
      `[EmbeddedGameClient] Setting camera to follow entity: ${e.id}`,
    );

    // CRITICAL: Pass the FULL ENTITY as target, not just { position: entity.position }
    // The camera system reads target.position every frame, and we need
    // TileInterpolator's position updates to be reflected automatically
    world.emit(EventType.CAMERA_SET_TARGET, {
      target: entity,
    });

    // Ensure controls are still disabled (belt and suspenders)
    if (config.mode === "spectator") {
      disablePlayerControls(world);
    }
  };

  // Listen for entity spawns to find agent's character
  const handleEntitySpawned = (data: {
    entityId?: string;
    entityType?: string;
    position?: { x: number; y: number; z: number };
    entityData?: Record<string, unknown>;
  }) => {
    if (!data.entityId) return;

    // Check if this is the entity we want to follow
    const isTargetById = data.entityId === targetEntityId;

    // Also check characterId in entity data
    const entityCharacterId = data.entityData?.characterId as
      | string
      | undefined;
    const isTargetByCharacterId = entityCharacterId === targetEntityId;

    if (isTargetById || isTargetByCharacterId) {
      // Find the LIVE entity instance
      const liveEntity = findLiveEntity(data.entityId);
      if (liveEntity) {
        setCameraTarget(liveEntity);
      } else {
        console.warn(
          `[EmbeddedGameClient] Entity spawned but not found in world.entities: ${data.entityId}`,
        );
      }
    }
  };

  // Subscribe to entity spawned events
  world.on(EventType.ENTITY_SPAWNED, handleEntitySpawned);

  // Also check existing entities (in case character already spawned)
  const checkExistingEntities = () => {
    // First, try to find the entity directly by ID
    let targetEntity = findLiveEntity(targetEntityId);

    // If not found by ID, search all entities for matching characterId
    if (!targetEntity && world.entities?.items) {
      for (const [, entity] of world.entities.items) {
        const e = entity as { characterId?: string };
        if (e.characterId === targetEntityId) {
          targetEntity = entity;
          break;
        }
      }
    }

    // Also check players map
    if (!targetEntity && world.entities?.players) {
      for (const [, player] of world.entities.players) {
        const p = player as { id?: string; characterId?: string };
        if (p.id === targetEntityId || p.characterId === targetEntityId) {
          targetEntity = player;
          break;
        }
      }
    }

    if (targetEntity) {
      setCameraTarget(targetEntity);
    } else {
      // Entity not found yet - will be caught by ENTITY_SPAWNED event
      console.log(
        `[EmbeddedGameClient] Target entity ${targetEntityId} not found yet, waiting for spawn...`,
      );
    }
  };

  // Check after a short delay to allow systems to initialize
  setTimeout(checkExistingEntities, 500);

  // Also check periodically in case entity spawns are delayed
  const checkInterval = setInterval(() => {
    // If we already have a camera target, stop checking
    const cameraSystem = world.getSystem("client-camera-system") as {
      target?: unknown;
    } | null;
    if (cameraSystem?.target) {
      clearInterval(checkInterval);
      return;
    }

    checkExistingEntities();
  }, 1000);

  // Stop checking after 10 seconds
  setTimeout(() => clearInterval(checkInterval), 10000);
}

/**
 * Apply quality presets based on embedded config
 */
function applyQualityPresets(world: World, config: EmbeddedViewportConfig) {
  const quality = getQualityPreset();

  // Apply render scale
  const graphics = world.getSystem("graphics") as {
    setRenderScale?: (scale: number) => void;
  } | null;

  if (graphics?.setRenderScale) {
    graphics.setRenderScale(quality.renderScale);
  }

  // Note: Other quality settings (shadows, antialiasing, etc.) would be
  // configured through the graphics system directly if needed
}

/**
 * Embedded Game Client Component
 */
export function EmbeddedGameClient() {
  const [config, setConfig] = useState<EmbeddedViewportConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get embedded configuration
    const embeddedConfig = getEmbeddedConfig();

    if (!embeddedConfig) {
      setError("No embedded configuration found");
      console.error(
        "[EmbeddedGameClient] Missing window.__HYPERSCAPE_CONFIG__",
      );
      return;
    }

    // Auth token is REQUIRED for all modes (including spectator)
    // Server verifies the token and checks character ownership for security
    if (!embeddedConfig.authToken) {
      setError("Authentication required - please log in to view this viewport");
      console.error("[EmbeddedGameClient] Missing authToken in config");
      return;
    }

    setConfig(embeddedConfig);
  }, []);

  // Loading state
  if (!config) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          {error ? (
            <>
              <h2>⚠️ Configuration Error</h2>
              <p>{error}</p>
            </>
          ) : (
            <>
              <h2>🎮 Loading Hyperscape Viewport...</h2>
              <p>
                Initializing{" "}
                {config?.mode === "spectator" ? "spectator" : "agent"} view
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Build WebSocket URL with authentication
  // SECURITY: authToken is always required - server verifies identity server-side
  const wsUrl =
    config.mode === "spectator"
      ? `${config.wsUrl}?mode=spectator&authToken=${encodeURIComponent(config.authToken)}&followEntity=${encodeURIComponent(config.followEntity || config.characterId || "")}&characterId=${encodeURIComponent(config.characterId || "")}&privyUserId=${encodeURIComponent(config.privyUserId || "")}`
      : `${config.wsUrl}?authToken=${encodeURIComponent(config.authToken)}`;

  // Setup callback to configure spectator mode
  const handleSetup = (world: World) => {
    // Setup spectator camera
    setupSpectatorCamera(world, config);

    // Apply quality presets
    applyQualityPresets(world, config);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#000",
      }}
    >
      <GameClient wsUrl={wsUrl} onSetup={handleSetup} />
    </div>
  );
}
