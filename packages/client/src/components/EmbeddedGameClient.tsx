/**
 * Embedded Game Client - Spectator Viewport for AI Agents
 *
 * Renders the Hyperscape game in embedded mode for viewing agents play in real-time.
 * Auto-connects with embedded configuration and sets up spectator camera.
 */

import { useEffect, useState } from "react";
import { GameClient } from "../screens/GameClient";
import {
  type EmbeddedViewportConfig,
  getEmbeddedConfig,
  getViewportSettings,
  getQualityPreset,
} from "../types/embeddedConfig";
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

  // Wait for entity manager to be ready
  const entityManager = world.getSystem("entity-manager");
  if (!entityManager) {
    console.error("[EmbeddedGameClient] Entity manager not found");
    return;
  }

  // Listen for entity spawns to find agent's character
  const handleEntityAdded = (data: {
    entity: { id: string; characterId?: string };
  }) => {
    const entity = data.entity;

    // Check if this is the entity we want to follow
    const isTargetEntity =
      entity.id === targetEntityId || entity.characterId === targetEntityId;

    if (isTargetEntity) {
      console.log(
        "[EmbeddedGameClient] Found target entity, locking camera:",
        entity.id,
      );

      // Lock camera to this entity
      world.emit(EventType.CAMERA_SET_TARGET, {
        target: entity,
        lock: true, // Lock camera (don't allow user control)
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

  // Subscribe to entity added events
  world.on(EventType.ENTITY_ADDED, handleEntityAdded);

  // Also check existing entities (in case character already spawned)
  const checkExistingEntities = () => {
    const em = entityManager as {
      getAllEntities?: () => Map<string, { id: string; characterId?: string }>;
    };

    if (em.getAllEntities) {
      for (const [, entity] of em.getAllEntities()) {
        const isTargetEntity =
          entity.id === targetEntityId || entity.characterId === targetEntityId;

        if (isTargetEntity) {
          handleEntityAdded({ entity });
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
  }

  // Apply other quality settings
  // Note: These would be implemented in the graphics system
  const qualitySettings = {
    shadows: quality.shadows,
    antialiasing: quality.antialiasing,
    lodDistance: quality.lodDistance,
    maxParticles: quality.maxParticles,
  };

  world.emit(EventType.GRAPHICS_QUALITY_UPDATE, qualitySettings);
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

    // Hide UI elements based on config
    if (config.hiddenUI && config.hiddenUI.length > 0) {
      world.emit(EventType.UI_HIDE_ELEMENTS, {
        elements: config.hiddenUI,
      });
      console.log("[EmbeddedGameClient] Hiding UI elements:", config.hiddenUI);
    }

    // Set target FPS for viewport
    const viewportSettings = getViewportSettings();
    if (viewportSettings) {
      world.emit(EventType.GRAPHICS_SET_TARGET_FPS, {
        fps: viewportSettings.targetFPS,
      });
      console.log(
        `[EmbeddedGameClient] Target FPS set to ${viewportSettings.targetFPS}`,
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
