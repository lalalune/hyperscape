/**
 * Death Screen Component
 *
 * Shows when the player dies in-game.
 * Displays death info, countdown timer for item despawn, and respawn button.
 *
 * @packageDocumentation
 */

import React, { useEffect, useState } from "react";
import { useThemeStore } from "@/ui";
import type { ClientWorld } from "@/types";

/**
 * Death screen data
 */
export interface DeathScreenData {
  message: string;
  killedBy: string;
  respawnTime: number;
}

interface DeathScreenProps {
  data: DeathScreenData;
  world: ClientWorld;
}

/**
 * Death screen overlay component
 */
export function DeathScreen({
  data,
  world,
}: DeathScreenProps): React.ReactElement {
  const theme = useThemeStore((s) => s.theme);
  // Track respawn state to prevent button spam
  const [isRespawning, setIsRespawning] = useState(false);
  // Track if respawn request timed out
  const [respawnTimedOut, setRespawnTimedOut] = useState(false);
  // Death countdown timer - seconds until items despawn
  const [countdown, setCountdown] = useState<number>(
    Math.max(0, Math.floor((data.respawnTime - Date.now()) / 1000)),
  );

  // Timeout handler - re-enable button if server doesn't respond
  const RESPAWN_TIMEOUT_MS = 10000; // 10 seconds

  useEffect(() => {
    if (!isRespawning) return;

    const timeoutId = setTimeout(() => {
      console.warn("[DeathScreen] Respawn request timed out after 10 seconds");
      setIsRespawning(false);
      setRespawnTimedOut(true);
    }, RESPAWN_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [isRespawning]);

  // Update countdown every second
  useEffect(() => {
    const intervalId = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((data.respawnTime - Date.now()) / 1000),
      );
      setCountdown(remaining);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [data.respawnTime]);

  // Format countdown as mm:ss
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleRespawn = (): void => {
    // Prevent multiple clicks
    if (isRespawning) return;

    // Clear timeout state on retry
    setRespawnTimedOut(false);

    // Send respawn request to server via network
    const network = world.network as {
      send?: (packet: string, data: unknown) => void;
    };

    if (!network) {
      console.error("[DeathScreen] Network object is null/undefined!");
      return;
    }

    if (!network.send) {
      console.error("[DeathScreen] Network.send method doesn't exist!");
      return;
    }

    // Disable button immediately to prevent spam
    setIsRespawning(true);

    try {
      network.send("requestRespawn", {
        playerId: world.entities?.player?.id,
      });
    } catch (err) {
      console.error("[DeathScreen] Error sending packet:", err);
      // Re-enable button on error so user can retry
      setIsRespawning(false);
    }
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-auto z-[10000]"
      style={{ backgroundColor: theme.colors.background.overlay }}
    >
      <div
        className="flex flex-col items-center gap-6 max-w-md p-8 rounded-2xl backdrop-blur-md"
        style={{
          backgroundColor: theme.colors.background.secondary,
          border: `2px solid ${theme.colors.state.danger}`,
        }}
      >
        <div
          className="text-4xl font-bold"
          style={{ color: theme.colors.state.danger }}
        >
          Oh dear, you are dead!
        </div>
        <div
          className="text-center space-y-2"
          style={{ color: theme.colors.text.primary }}
        >
          <p className="text-lg">
            Killed by:{" "}
            <span style={{ color: theme.colors.state.danger }}>
              {data.killedBy}
            </span>
          </p>
          <p className="text-base opacity-90">
            You have lost your items at the death location.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 mt-4">
          <button
            onClick={handleRespawn}
            disabled={isRespawning}
            className="px-8 py-3 text-lg font-bold rounded-lg transition-colors border-2"
            style={{
              backgroundColor: isRespawning
                ? theme.colors.text.disabled
                : theme.colors.state.info,
              borderColor: isRespawning
                ? theme.colors.text.disabled
                : theme.colors.state.info,
              color: theme.colors.text.primary,
              cursor: isRespawning ? "not-allowed" : "pointer",
              opacity: isRespawning ? 0.6 : 1,
            }}
          >
            {isRespawning ? "Respawning..." : "Click here to respawn"}
          </button>
          {respawnTimedOut && (
            <div
              className="text-sm text-center max-w-sm"
              style={{ color: theme.colors.state.warning }}
            >
              Respawn request timed out. Please try again.
            </div>
          )}
          {/* Death countdown timer */}
          <div className="text-sm text-center max-w-sm">
            {countdown > 0 ? (
              <>
                <span style={{ color: theme.colors.text.muted }}>
                  Your items have been dropped at your death location.
                </span>
                <br />
                <span
                  className="font-bold"
                  style={{
                    color:
                      countdown <= 60
                        ? theme.colors.state.danger
                        : theme.colors.state.warning,
                  }}
                >
                  Time remaining: {formatCountdown(countdown)}
                </span>
              </>
            ) : (
              <span style={{ color: theme.colors.state.danger }}>
                Your items have despawned!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeathScreen;
