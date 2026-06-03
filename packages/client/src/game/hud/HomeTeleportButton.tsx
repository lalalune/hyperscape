/**
 * Home Teleport Button - Allows players to teleport back to spawn.
 * Keyboard shortcut: H
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useThemeStore } from "@/ui";
import { HOME_TELEPORT_CONSTANTS, EventType } from "@hyperforge/shared";
import type { ClientWorld } from "../../types";
import {
  getHomeTeleportCooldownProgress,
  readHomeTeleportRemainingMs,
} from "./homeTeleportUi";

type TeleportState = "ready" | "cooldown" | "casting";

const formatTime = (ms: number): string => {
  const seconds = Math.ceil(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
};

export function HomeTeleportButton({ world }: { world: ClientWorld }) {
  const theme = useThemeStore((s) => s.theme);
  const [state, setState] = useState<TeleportState>("ready");
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [castProgress, setCastProgress] = useState(0);
  const [castStartTime, setCastStartTime] = useState<number | null>(null);
  const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Use ref to track state in event handlers (avoids stale closure)
  const stateRef = useRef(state);
  stateRef.current = state;
  const castStartTimeRef = useRef<number | null>(null);
  const cooldownEndTimeRef = useRef<number | null>(null);
  const cooldownSecondRef = useRef(-1);
  const tickerRef = useRef<number | null>(null);

  // Resize handler
  useEffect(() => {
    castStartTimeRef.current = castStartTime;
  }, [castStartTime]);

  useEffect(() => {
    cooldownEndTimeRef.current = cooldownEndTime;
  }, [cooldownEndTime]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Server event handlers
  useEffect(() => {
    const onCastStart = () => {
      setState("casting");
      setCastStartTime(performance.now());
      setCooldownEndTime(null);
      setCooldownRemaining(0);
      setCastProgress(0);
    };

    const onFailed = (event?: unknown) => {
      const remainingMs = readHomeTeleportRemainingMs(event);
      if (remainingMs > 0) {
        setState("cooldown");
        setCooldownEndTime(performance.now() + remainingMs);
        setCooldownRemaining(remainingMs);
      } else {
        // Server rejected or cancelled - reset to ready
        setState("ready");
        setCooldownEndTime(null);
        setCooldownRemaining(0);
      }
      setCastStartTime(null);
      setCastProgress(0);
    };

    const onCastCancel = () => {
      // Server confirmed cancel - reset to ready
      setState("ready");
      setCastStartTime(null);
      setCooldownEndTime(null);
      setCooldownRemaining(0);
      setCastProgress(0);
    };

    const onTeleported = () => {
      // Use ref to get current state (avoids stale closure)
      if (stateRef.current === "casting") {
        setState("cooldown");
        setCooldownEndTime(
          performance.now() + HOME_TELEPORT_CONSTANTS.COOLDOWN_MS,
        );
        setCooldownRemaining(HOME_TELEPORT_CONSTANTS.COOLDOWN_MS);
        setCastStartTime(null);
        setCastProgress(0);
      }
    };

    world.on(EventType.HOME_TELEPORT_CAST_START, onCastStart);
    world.on(EventType.HOME_TELEPORT_FAILED, onFailed);
    world.on(EventType.HOME_TELEPORT_CAST_CANCEL, onCastCancel);
    world.on(EventType.PLAYER_TELEPORTED, onTeleported);

    return () => {
      world.off(EventType.HOME_TELEPORT_CAST_START, onCastStart);
      world.off(EventType.HOME_TELEPORT_FAILED, onFailed);
      world.off(EventType.HOME_TELEPORT_CAST_CANCEL, onCastCancel);
      world.off(EventType.PLAYER_TELEPORTED, onTeleported);
    };
  }, [world]);

  // Animation-driven progress/cooldown ticker keeps timing aligned with the
  // newer minimap orb without relying on multiple intervals.
  useEffect(() => {
    const clearTicker = () => {
      if (tickerRef.current !== null) {
        cancelAnimationFrame(tickerRef.current);
        tickerRef.current = null;
      }
    };

    if (state === "ready") {
      clearTicker();
      cooldownSecondRef.current = -1;
      setCooldownRemaining(0);
      setCastProgress(0);
      return undefined;
    }

    cooldownSecondRef.current = -1;

    const tick = () => {
      const now = performance.now();

      if (state === "casting" && castStartTimeRef.current !== null) {
        const progress = Math.max(
          0,
          Math.min(
            100,
            ((now - castStartTimeRef.current) /
              HOME_TELEPORT_CONSTANTS.CAST_TIME_MS) *
              100,
          ),
        );
        setCastProgress(progress);
      } else if (state === "cooldown" && cooldownEndTimeRef.current !== null) {
        const remaining = Math.max(0, cooldownEndTimeRef.current - now);
        const remainingSeconds = Math.floor(remaining / 1000);
        if (remainingSeconds !== cooldownSecondRef.current) {
          cooldownSecondRef.current = remainingSeconds;
          setCooldownRemaining(remaining);
        }
        if (remaining <= 0) {
          setCooldownRemaining(0);
          setState("ready");
          setCooldownEndTime(null);
          clearTicker();
          return;
        }
      } else {
        clearTicker();
        return;
      }

      tickerRef.current = requestAnimationFrame(tick);
    };

    tickerRef.current = requestAnimationFrame(tick);
    return clearTicker;
  }, [state, cooldownEndTime]);

  const handleClick = useCallback(() => {
    const network = world.network as {
      send?: (packet: string, data: unknown) => void;
    };
    if (!network?.send) return;

    if (state === "casting") {
      // Send cancel request - don't reset state until server confirms via HOME_TELEPORT_CAST_CANCEL
      network.send("homeTeleportCancel", {});
    } else if (state === "ready") {
      network.send("homeTeleport", {});
    }
  }, [world, state]);

  // Keyboard shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyH" && !e.repeat) {
        const tag = document.activeElement?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") handleClick();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClick]);

  const isCasting = state === "casting";
  const isDisabled = state === "cooldown";
  const cooldownProgress = isDisabled
    ? getHomeTeleportCooldownProgress(cooldownRemaining)
    : 0;

  const styles = useMemo(() => {
    const size = isMobile ? 48 : 56;
    const bg = isDisabled
      ? `linear-gradient(135deg, ${theme.colors.background.tertiary}, ${theme.colors.background.secondary})`
      : isCasting
        ? `linear-gradient(135deg, ${theme.colors.status.prayer}, ${theme.colors.status.prayerBackground})`
        : `linear-gradient(135deg, ${theme.colors.background.tertiary}, ${theme.colors.background.primary})`;
    const border = isDisabled
      ? theme.colors.border.default
      : isCasting
        ? theme.colors.accent.primary
        : theme.colors.border.decorative;

    return {
      container: {
        bottom: isMobile ? 80 : 100,
        right: isMobile ? 12 : 24,
      } as React.CSSProperties,
      button: {
        width: size,
        height: size,
        borderRadius: theme.borderRadius.xl,
        background: bg,
        backdropFilter: `blur(${theme.glass.blur}px)`,
        border: `2px solid ${border}`,
        boxShadow: isDisabled
          ? `${theme.shadows.sm}, inset 0 1px 0 ${theme.colors.accent.secondary}20`
          : `${theme.shadows.lg}, inset 0 1px 0 ${theme.colors.accent.secondary}33`,
        cursor: isDisabled ? "not-allowed" : "pointer",
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        position: "relative" as const,
        overflow: "hidden",
        transition: theme.transitions.normal,
      } as React.CSSProperties,
      cooldownFill: {
        position: "absolute" as const,
        inset: 0,
        top: `${100 - cooldownProgress}%`,
        background: `linear-gradient(180deg, ${theme.colors.status.prayer}cc, ${theme.colors.accent.primary}f2)`,
        transition: "top 0.1s linear",
        pointerEvents: "none" as const,
      } as React.CSSProperties,
      content: {
        position: "relative" as const,
        zIndex: 1,
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
      } as React.CSSProperties,
      icon: {
        fontSize: isMobile ? "1.25rem" : "1.5rem",
        opacity: isDisabled ? 0.5 : 1,
        filter: isCasting ? "brightness(1.2)" : "none",
      } as React.CSSProperties,
      label: {
        fontSize: isMobile ? "0.7rem" : "0.8rem",
        color: isDisabled
          ? `${theme.colors.accent.secondary}80`
          : theme.colors.accent.primary,
        fontWeight: theme.typography.fontWeight.semibold,
        textShadow: "0 1px 2px rgba(0,0,0,0.8)",
        marginTop: 2,
      } as React.CSSProperties,
      progress: {
        position: "absolute" as const,
        bottom: 0,
        left: 0,
        width: `${castProgress}%`,
        height: 4,
        background: `linear-gradient(90deg, ${theme.colors.state.info}, ${theme.colors.accent.primary})`,
        borderRadius: `0 0 ${theme.borderRadius.lg}px ${theme.borderRadius.lg}px`,
        transition: "width 0.05s linear",
      } as React.CSSProperties,
    };
  }, [theme, isMobile, isDisabled, isCasting, castProgress, cooldownProgress]);

  const label =
    state === "cooldown"
      ? formatTime(cooldownRemaining)
      : state === "casting"
        ? "Cancel"
        : "Home";
  const title =
    state === "cooldown"
      ? `On cooldown (${formatTime(cooldownRemaining)})`
      : state === "casting"
        ? "Click to cancel (H)"
        : "Teleport home (H)";

  return (
    <div className="fixed pointer-events-auto z-50" style={styles.container}>
      <button onClick={handleClick} style={styles.button} title={title}>
        {isDisabled && <div style={styles.cooldownFill} />}
        <div style={styles.content}>
          <span style={styles.icon}>🏠</span>
          <span style={styles.label}>{label}</span>
        </div>
        {isCasting && <div style={styles.progress} />}
      </button>
    </div>
  );
}
