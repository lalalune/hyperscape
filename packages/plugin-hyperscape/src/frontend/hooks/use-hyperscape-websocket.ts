/**
 * useHyperscapeWebSocket Hook
 *
 * Manages WebSocket connection to Hyperscape game server and provides
 * real-time game state updates to components.
 */

import { useEffect, useRef, useState } from "react";
import type {
  HyperscapeAgentStatus,
  PlayerStats,
  PlayerHealth,
  Inventory,
  WorldPosition,
  NearbyEntity,
  CombatSession,
  PerformanceMetrics,
} from "../types/hyperscape/index.js";
import type { UUID } from "@elizaos/core";

export interface HyperscapeWebSocketState {
  /** Current connection status */
  status: "connecting" | "connected" | "disconnected" | "error";
  /** Complete agent game state */
  agentStatus: HyperscapeAgentStatus | null;
  /** Player stats (skills) */
  stats: PlayerStats | null;
  /** Player health */
  health: PlayerHealth | null;
  /** Inventory state */
  inventory: Inventory | null;
  /** World position */
  position: WorldPosition | null;
  /** Nearby entities */
  nearbyEntities: NearbyEntity[] | null;
  /** Current combat session */
  combatSession: CombatSession | null;
  /** Performance metrics */
  metrics: PerformanceMetrics | null;
  /** Last error message */
  error: string | null;
  /** Reconnect attempt count */
  reconnectAttempts: number;
}

export interface HyperscapeWebSocketOptions {
  /** Agent ID to connect for */
  agentId: UUID | undefined;
  /** WebSocket server URL */
  url: string;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Max reconnect attempts */
  maxReconnectAttempts?: number;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
}

/**
 * Hook to manage WebSocket connection to Hyperscape game server
 *
 * @param options - WebSocket connection options
 * @returns Current game state and connection status
 *
 * @example
 * ```tsx
 * const { status, agentStatus, stats, inventory } = useHyperscapeWebSocket({
 *   agentId,
 *   url: 'ws://localhost:5555/ws',
 *   autoReconnect: true
 * });
 *
 * if (status === 'connected' && stats) {
 *   return <PlayerStatsPanel stats={stats} />;
 * }
 * ```
 */
export function useHyperscapeWebSocket(
  options: HyperscapeWebSocketOptions,
): HyperscapeWebSocketState {
  const {
    agentId,
    url,
    autoReconnect = true,
    maxReconnectAttempts = 10,
    reconnectDelay = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const [state, setState] = useState<HyperscapeWebSocketState>({
    status: "disconnected",
    agentStatus: null,
    stats: null,
    health: null,
    inventory: null,
    position: null,
    nearbyEntities: null,
    combatSession: null,
    metrics: null,
    error: null,
    reconnectAttempts: 0,
  });

  useEffect(() => {
    // Don't connect if no agent ID
    if (!agentId) {
      setState((prev) => ({
        ...prev,
        status: "disconnected",
        error: "No agent ID provided",
      }));
      return;
    }

    // Establish WebSocket connection
    const connect = () => {
      try {
        setState((prev) => ({ ...prev, status: "connecting", error: null }));

        // Connect with agent ID as query parameter
        const wsUrl = `${url}?agentId=${agentId}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[Hyperscape] WebSocket connected");
          setState((prev) => ({ ...prev, status: "connected", error: null }));
          setReconnectAttempts(0);

          // Request initial state
          ws.send(
            JSON.stringify({
              type: "request_state",
              agentId,
            }),
          );
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            // Handle different message types from Hyperscape server
            switch (message.type) {
              case "agent_status":
                setState((prev) => ({
                  ...prev,
                  agentStatus: message.data as HyperscapeAgentStatus,
                }));
                break;

              case "player_stats":
                setState((prev) => ({
                  ...prev,
                  stats: message.data as PlayerStats,
                }));
                break;

              case "player_health":
                setState((prev) => ({
                  ...prev,
                  health: message.data as PlayerHealth,
                }));
                break;

              case "inventory_update":
                setState((prev) => ({
                  ...prev,
                  inventory: message.data as Inventory,
                }));
                break;

              case "position_update":
                setState((prev) => ({
                  ...prev,
                  position: message.data as WorldPosition,
                }));
                break;

              case "nearby_entities":
                setState((prev) => ({
                  ...prev,
                  nearbyEntities: message.data as NearbyEntity[],
                }));
                break;

              case "combat_session":
                setState((prev) => ({
                  ...prev,
                  combatSession: message.data as CombatSession,
                }));
                break;

              case "performance_metrics":
                setState((prev) => ({
                  ...prev,
                  metrics: message.data as PerformanceMetrics,
                }));
                break;

              case "full_state":
                // Complete state update
                const fullState = message.data as HyperscapeAgentStatus;
                setState((prev) => ({
                  ...prev,
                  agentStatus: fullState,
                  stats: fullState.stats,
                  health: fullState.health,
                  inventory: fullState.inventory,
                  position: fullState.position,
                  combatSession: fullState.currentCombatSession ?? null,
                }));
                break;

              case "error":
                console.error("[Hyperscape] Server error:", message.error);
                setState((prev) => ({
                  ...prev,
                  error: message.error,
                }));
                break;

              default:
                console.warn(
                  "[Hyperscape] Unknown message type:",
                  message.type,
                );
            }
          } catch (error) {
            console.error("[Hyperscape] Failed to parse message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("[Hyperscape] WebSocket error:", error);
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "WebSocket connection error",
          }));
        };

        ws.onclose = () => {
          console.log("[Hyperscape] WebSocket disconnected");
          setState((prev) => ({
            ...prev,
            status: "disconnected",
          }));

          // Attempt reconnection if enabled
          if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
            console.log(
              `[Hyperscape] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`,
            );
            reconnectTimeoutRef.current = setTimeout(() => {
              setReconnectAttempts((prev) => prev + 1);
              connect();
            }, reconnectDelay);
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            setState((prev) => ({
              ...prev,
              error: "Max reconnection attempts reached",
            }));
          }
        };
      } catch (error) {
        console.error("[Hyperscape] Failed to connect:", error);
        setState((prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error.message : "Connection failed",
        }));
      }
    };

    // Initial connection
    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [
    agentId,
    url,
    autoReconnect,
    maxReconnectAttempts,
    reconnectDelay,
    reconnectAttempts,
  ]);

  return {
    ...state,
    reconnectAttempts,
  };
}
