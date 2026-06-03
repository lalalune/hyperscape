/**
 * ConnectionIndicator - Network Connection Status Display
 *
 * Shows connection status and reconnection progress:
 * - Hidden when connected normally
 * - Shows reconnecting state with attempt count
 * - Shows failed state when max attempts exceeded
 *
 * @packageDocumentation
 */

import React, { useEffect, useState, useCallback } from "react";
import { EventType } from "@hyperforge/shared";
import type { ClientWorld } from "../../types";
import { UI } from "../../constants/ui";
import { zIndex } from "../../constants/tokens";

/** Connection status states */
type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "failed";

/** Reconnection state data */
interface ReconnectState {
  status: ConnectionStatus;
  attempt: number;
  maxAttempts: number;
  delayMs: number;
}

interface ConnectionIndicatorProps {
  /** The world instance for event subscriptions */
  world: ClientWorld | null;
}

export function ConnectionIndicator({
  world,
}: ConnectionIndicatorProps): React.ReactElement | null {
  const [state, setState] = useState<ReconnectState>({
    status: "connected",
    attempt: 0,
    maxAttempts: 10,
    delayMs: 0,
  });

  // Handle network events
  const handleReconnecting = useCallback((payload: unknown) => {
    const data = payload as {
      attempt: number;
      maxAttempts: number;
      delayMs: number;
    };
    setState({
      status: "reconnecting",
      attempt: data.attempt,
      maxAttempts: data.maxAttempts,
      delayMs: data.delayMs,
    });
  }, []);

  const handleReconnected = useCallback(() => {
    setState({
      status: "connected",
      attempt: 0,
      maxAttempts: 10,
      delayMs: 0,
    });
  }, []);

  const handleDisconnected = useCallback(() => {
    // Only update if not already reconnecting
    setState((prev) => {
      if (prev.status === "reconnecting") {
        return prev;
      }
      return {
        ...prev,
        status: "disconnected",
      };
    });
  }, []);

  const handleReconnectFailed = useCallback((payload: unknown) => {
    const data = payload as { attempts: number; reason: string };
    setState({
      status: "failed",
      attempt: data.attempts,
      maxAttempts: data.attempts,
      delayMs: 0,
    });
  }, []);

  // Subscribe to network events
  useEffect(() => {
    if (!world) return;

    world.on(EventType.NETWORK_RECONNECTING, handleReconnecting);
    world.on(EventType.NETWORK_RECONNECTED, handleReconnected);
    world.on(EventType.NETWORK_DISCONNECTED, handleDisconnected);
    world.on(EventType.NETWORK_RECONNECT_FAILED, handleReconnectFailed);

    return () => {
      world.off(EventType.NETWORK_RECONNECTING, handleReconnecting);
      world.off(EventType.NETWORK_RECONNECTED, handleReconnected);
      world.off(EventType.NETWORK_DISCONNECTED, handleDisconnected);
      world.off(EventType.NETWORK_RECONNECT_FAILED, handleReconnectFailed);
    };
  }, [
    world,
    handleReconnecting,
    handleReconnected,
    handleDisconnected,
    handleReconnectFailed,
  ]);

  // Don't render when connected
  if (state.status === "connected") {
    return null;
  }

  // Calculate progress for reconnecting state
  const progress =
    state.status === "reconnecting"
      ? (state.attempt / state.maxAttempts) * 100
      : state.status === "failed"
        ? 100
        : 0;

  return (
    <div
      style={{
        position: "fixed",
        top: `calc(${UI.SAFE_AREAS.TOP} + 16px)`,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: zIndex.toast,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "12px 20px",
        backgroundColor:
          state.status === "failed"
            ? "rgba(180, 30, 30, 0.95)"
            : "rgba(40, 40, 40, 0.95)",
        borderRadius: 8,
        border: `1px solid ${state.status === "failed" ? "#c44" : "#555"}`,
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
        minWidth: 200,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Status Icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {state.status === "reconnecting" && (
          <div
            style={{
              width: 16,
              height: 16,
              border: "2px solid #888",
              borderTopColor: "#fff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
        )}
        {state.status === "failed" && (
          <div
            style={{
              width: 16,
              height: 16,
              color: "#fff",
              fontSize: 16,
              lineHeight: "16px",
              textAlign: "center",
            }}
          >
            ✕
          </div>
        )}
        <span
          style={{
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {state.status === "reconnecting" && "Reconnecting..."}
          {state.status === "disconnected" && "Disconnected"}
          {state.status === "failed" && "Connection Lost"}
        </span>
      </div>

      {/* Progress bar for reconnecting */}
      {state.status === "reconnecting" && (
        <>
          <div
            style={{
              width: "100%",
              height: 4,
              backgroundColor: "#333",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                backgroundColor: "#4a9eff",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span
            style={{
              color: "#aaa",
              fontSize: 12,
            }}
          >
            Attempt {state.attempt} of {state.maxAttempts}
          </span>
        </>
      )}

      {/* Failed state message */}
      {state.status === "failed" && (
        <span
          style={{
            color: "#faa",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Please refresh the page to reconnect.
        </span>
      )}

      {/* CSS animation for spinner */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

export default ConnectionIndicator;
