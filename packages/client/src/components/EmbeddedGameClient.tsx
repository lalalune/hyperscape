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
 * Setup spectator camera to follow agent's character
 */
function setupSpectatorCamera(world: World, config: EmbeddedViewportConfig) {
  console.log(
    "[EmbeddedGameClient] Setting up spectator camera for:",
    config.characterId || config.followEntity,
  );

  const targetEntityId = config.followEntity || config.characterId;

  if (!targetEntityId) {
    console.warn("[EmbeddedGameClient] No entity to follow specified");
    return;
  }

  // Listen for entity spawns to find agent's character
  const handleEntitySpawned = (data: {
    entityId?: string;
    entityType?: string;
    position?: { x: number; y: number; z: number };
    entityData?: Record<string, unknown>;
  }) => {
    if (!data.entityId) return;

    // Get entity manager to fetch full entity data
    const entityManager = world.getSystem("entity-manager");
    if (!entityManager) return;

    const em = entityManager as {
      getEntity?: (id: string) => {
        id: string;
        characterId?: string;
        position?: { x: number; y: number; z: number };
      } | null;
    };

    const entity = em.getEntity?.(data.entityId);
    if (!entity) return;

    // Check if this is the entity we want to follow
    const isTargetEntity =
      entity.id === targetEntityId || entity.characterId === targetEntityId;

    if (isTargetEntity && entity.position) {
      console.log(
        "[EmbeddedGameClient] Found target entity, locking camera:",
        entity.id,
      );

      // Lock camera to this entity's position
      world.emit(EventType.CAMERA_SET_TARGET, {
        target: { position: entity.position },
      });

      // Disable player input controls for spectator mode
      if (config.mode === "spectator") {
        const input = world.getSystem("controls") as {
          disable?: () => void;
        } | null;
        if (input?.disable) {
          input.disable();
          console.log(
            "[EmbeddedGameClient] Player controls disabled (spectator mode)",
          );
        }
      }
    }
  };

  // Subscribe to entity spawned events
  world.on(EventType.ENTITY_SPAWNED, handleEntitySpawned);

  // Also check existing entities (in case character already spawned)
  const checkExistingEntities = () => {
    // Get entity manager (may not be ready immediately)
    const entityManager = world.getSystem("entity-manager");
    if (!entityManager) {
      console.log(
        "[EmbeddedGameClient] Entity manager not ready yet, will wait for ENTITY_SPAWNED event",
      );
      return;
    }

    const em = entityManager as {
      getAllEntities?: () => Map<
        string,
        {
          id: string;
          characterId?: string;
          position?: { x: number; y: number; z: number };
        }
      >;
    };

    if (em.getAllEntities) {
      for (const [, entity] of em.getAllEntities()) {
        const isTargetEntity =
          entity.id === targetEntityId || entity.characterId === targetEntityId;

        if (isTargetEntity && entity.position) {
          // Simulate event data structure
          handleEntitySpawned({
            entityId: entity.id,
            position: entity.position,
          });
          break;
        }
      }
    }
  };

  // Check after a short delay to allow systems to initialize
  setTimeout(checkExistingEntities, 1000);
}

/**
 * Apply quality presets based on embedded config
 */
function applyQualityPresets(world: World, config: EmbeddedViewportConfig) {
  const quality = getQualityPreset();
  console.log(
    `[EmbeddedGameClient] Applying ${config.quality || "medium"} quality preset:`,
    quality,
  );

  // Apply render scale
  const graphics = world.getSystem("graphics") as {
    setRenderScale?: (scale: number) => void;
  } | null;

  if (graphics?.setRenderScale) {
    graphics.setRenderScale(quality.renderScale);
    console.log(
      `[EmbeddedGameClient] Render scale set to ${quality.renderScale}`,
    );
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

    if (!embeddedConfig.authToken) {
      setError("No authentication token provided");
      console.error("[EmbeddedGameClient] Missing authToken in config");
      return;
    }

    console.log("[EmbeddedGameClient] Initializing embedded viewport:", {
      agentId: embeddedConfig.agentId,
      mode: embeddedConfig.mode,
      quality: embeddedConfig.quality,
      wsUrl: embeddedConfig.wsUrl,
    });

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
              <p>Initializing agent view</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Build WebSocket URL with auth token
  const wsUrl = `${config.wsUrl}?authToken=${encodeURIComponent(config.authToken)}`;

  // Setup callback to configure spectator mode
  const handleSetup = (world: World) => {
    console.log("[EmbeddedGameClient] World setup callback");

    // Setup spectator camera
    setupSpectatorCamera(world, config);

    // Apply quality presets
    applyQualityPresets(world, config);

    // Note: UI element hiding would be configured here if needed
    // For now, the embedded viewport uses CSS to hide UI elements via iframe parameters
    if (config.hiddenUI && config.hiddenUI.length > 0) {
      console.log(
        "[EmbeddedGameClient] Requested hidden UI elements:",
        config.hiddenUI,
      );
    }
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
