import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { EventType } from "@hyperscape/shared";
import { COLORS } from "../../constants";
import type { ClientWorld } from "../../types";

type StatTheme = {
  iconLight: string;
  iconDark: string;
  iconGlyph: string;
  barLight: string;
  barDark: string;
  frame: string;
};

interface StatusBarsProps {
  world: ClientWorld;
}

const THEMES = {
  health: {
    iconLight: "#f97373",
    iconDark: "#7f1d1d",
    iconGlyph: "#ffe1e1",
    barLight: "#ef4444",
    barDark: "#7f1d1d",
    frame: "rgba(218, 121, 121, 0.65)",
  },
  staminaRun: {
    iconLight: "#7eed90",
    iconDark: "#166534",
    iconGlyph: "#eafff0",
    barLight: "#34d399",
    barDark: "#166534",
    frame: "rgba(140, 186, 147, 0.65)",
  },
  staminaWalk: {
    iconLight: "#fbbf61",
    iconDark: "#b45309",
    iconGlyph: "#fff7df",
    barLight: "#f97316",
    barDark: "#c2410c",
    frame: "rgba(226, 173, 116, 0.65)",
  },
  prayer: {
    iconLight: "#93c5fd",
    iconDark: "#1d4ed8",
    iconGlyph: "#e0edff",
    barLight: "#60a5fa",
    barDark: "#1d4ed8",
    frame: "rgba(139, 165, 214, 0.65)",
  },
} as const;

const BAR_FRAME_BACKGROUND =
  "linear-gradient(180deg, rgba(20, 15, 10, 0.75), rgba(15, 10, 5, 0.85))";

const ICON_FRAME_BASE: React.CSSProperties = {
  borderRadius: "9999px",
  background:
    "linear-gradient(135deg, rgba(30, 20, 10, 0.9) 0%, rgba(20, 15, 10, 0.95) 100%)",
  backdropFilter: "blur(8px)",
  border: "2px solid rgba(139, 69, 19, 0.7)",
  boxShadow:
    "0 4px 12px rgba(0, 0, 0, 0.7), 0 2px 6px rgba(139, 69, 19, 0.4), inset 0 1px 0 rgba(242, 208, 138, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.5)",
  position: "relative",
  flexShrink: 0,
};

const BAR_HIGHLIGHT_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.05) 35%, rgba(0,0,0,0.35) 100%)",
  pointerEvents: "none",
};

type PlayerDataSource = {
  playerData?: {
    health?: { current: number; max: number };
    stats?: { prayer?: { level: number; points: number } };
  };
  data?: {
    health?: number;
    maxHealth?: number;
  };
  stamina?: number;
  runMode?: boolean;
};

export function StatusBars({ world }: StatusBarsProps) {
  const [health, setHealth] = useState<{ current: number; max: number }>({
    current: 100,
    max: 100,
  });
  const [stamina, setStamina] = useState<number>(100);
  const [prayer, setPrayer] = useState<{ level: number; points: number }>({
    level: 1,
    points: 1,
  });
  const [runMode, setRunMode] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const isSpectatorRef = useRef(false);

  useEffect(() => {
    const config = (
      window as {
        __HYPERSCAPE_CONFIG__?: { mode?: string };
      }
    ).__HYPERSCAPE_CONFIG__;
    isSpectatorRef.current = config?.mode === "spectator";
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getPlayerData = useCallback((): PlayerDataSource | undefined => {
    let player = world.entities?.player as PlayerDataSource | undefined;

    if (!player && isSpectatorRef.current) {
      const cameraSystem = world.getSystem("client-camera-system") as {
        getCameraInfo?: () => { target?: PlayerDataSource };
      } | null;
      const cameraInfo = cameraSystem?.getCameraInfo?.();
      if (cameraInfo?.target) {
        player = cameraInfo.target;
      }
    }

    return player;
  }, [world]);

  const updateFromPlayer = useCallback(() => {
    const player = getPlayerData();
    if (!player) return;

    if (player.playerData?.health) {
      setHealth((prev) => {
        const newCurrent = player.playerData!.health!.current;
        const newMax = player.playerData!.health!.max;
        if (prev.current !== newCurrent || prev.max !== newMax) {
          return { current: newCurrent, max: newMax };
        }
        return prev;
      });
    } else if (player.data?.health !== undefined) {
      setHealth((prev) => {
        const newCurrent = player.data!.health!;
        const newMax = player.data!.maxHealth ?? 100;
        if (prev.current !== newCurrent || prev.max !== newMax) {
          return { current: newCurrent, max: newMax };
        }
        return prev;
      });
    }

    const newStamina = player.stamina ?? 100;
    setStamina((prev) => (prev !== newStamina ? newStamina : prev));

    if (player.playerData?.stats?.prayer) {
      setPrayer((prev) => {
        const newLevel = player.playerData!.stats!.prayer!.level || 1;
        const newPoints = player.playerData!.stats!.prayer!.points || 1;
        if (prev.level !== newLevel || prev.points !== newPoints) {
          return { level: newLevel, points: newPoints };
        }
        return prev;
      });
    }

    const newRunMode = player.runMode ?? true;
    setRunMode((prev) => (prev !== newRunMode ? newRunMode : prev));
  }, [getPlayerData]);

  useEffect(() => {
    updateFromPlayer();

    const handleHealthUpdate = (data: unknown) => {
      const d = data as {
        playerId?: string;
        health?: { current: number; max: number };
        current?: number;
        max?: number;
      };
      const localPlayer = world.entities?.player;
      if (!localPlayer || (d.playerId && localPlayer.id !== d.playerId)) return;

      if (d.health) {
        setHealth({ current: d.health.current, max: d.health.max });
      } else if (d.current !== undefined && d.max !== undefined) {
        setHealth({ current: d.current, max: d.max });
      }
    };

    const handleStaminaUpdate = (data: unknown) => {
      const d = data as { playerId?: string; stamina?: number };
      const localPlayer = world.entities?.player;
      if (!localPlayer || (d.playerId && localPlayer.id !== d.playerId)) return;

      if (d.stamina !== undefined) {
        setStamina(d.stamina);
      }
    };

    const handlePlayerUpdate = (data: unknown) => {
      const d = data as {
        playerId?: string;
        playerData?: PlayerDataSource["playerData"];
        runMode?: boolean;
      };
      const localPlayer = world.entities?.player;
      if (!localPlayer || (d.playerId && localPlayer.id !== d.playerId)) return;

      if (d.runMode !== undefined) {
        setRunMode(d.runMode);
      }
      if (d.playerData?.health) {
        setHealth({
          current: d.playerData.health.current,
          max: d.playerData.health.max,
        });
      }
      if (d.playerData?.stats?.prayer) {
        setPrayer({
          level: d.playerData.stats.prayer.level || 1,
          points: d.playerData.stats.prayer.points || 1,
        });
      }
    };

    const handlePlayerSpawned = () => updateFromPlayer();

    world.on(EventType.PLAYER_HEALTH_UPDATED, handleHealthUpdate);
    world.on(EventType.PLAYER_STAMINA_UPDATE, handleStaminaUpdate);
    world.on(EventType.PLAYER_UPDATED, handlePlayerUpdate);
    world.on(EventType.PLAYER_SPAWNED, handlePlayerSpawned);

    // Poll for stamina updates since PLAYER_STAMINA_UPDATE is not emitted by the server
    // Stamina changes frequently during running so this needs to be relatively fast
    const staminaPollInterval = setInterval(() => {
      const player = getPlayerData();
      if (player) {
        const newStamina = player.stamina ?? 100;
        setStamina((prev) => (prev !== newStamina ? newStamina : prev));
        const newRunMode = player.runMode ?? true;
        setRunMode((prev) => (prev !== newRunMode ? newRunMode : prev));
      }
    }, 100);

    // Full update poll for spectator mode
    let spectatorInterval: ReturnType<typeof setInterval> | null = null;
    if (isSpectatorRef.current) {
      spectatorInterval = setInterval(updateFromPlayer, 500);
    }

    return () => {
      world.off(EventType.PLAYER_HEALTH_UPDATED, handleHealthUpdate);
      world.off(EventType.PLAYER_STAMINA_UPDATE, handleStaminaUpdate);
      world.off(EventType.PLAYER_UPDATED, handlePlayerUpdate);
      world.off(EventType.PLAYER_SPAWNED, handlePlayerSpawned);
      clearInterval(staminaPollInterval);
      if (spectatorInterval) {
        clearInterval(spectatorInterval);
      }
    };
  }, [world, updateFromPlayer, getPlayerData]);

  const toggleRunMode = useCallback(() => {
    const player = world.entities?.player as { runMode?: boolean } | undefined;
    if (player) {
      const newRunMode = !runMode;
      setRunMode(newRunMode);
      player.runMode = newRunMode;
      world.network?.send?.("moveRequest", { runMode: newRunMode });
    }
  }, [world, runMode]);

  const dimensions = useMemo(() => ({
    iconSize: isMobile ? 40 : 48,
    iconInset: isMobile ? 4 : 5,
    iconFontSize: isMobile ? "1rem" : "1.25rem",
    barWidth: isMobile ? 130 : 190,
    barHeight: isMobile ? 22 : 27,
    labelFontSize: isMobile ? "0.7rem" : "0.8rem",
    rowGap: isMobile ? 10 : 12,
    positionTop: isMobile ? 12 : 20,
    positionLeft: isMobile ? 12 : 24,
    barOffsetX: isMobile ? -18 : -24,
  }), [isMobile]);

  const createIconFrameStyle = useMemo(() => (clickable: boolean): React.CSSProperties => ({
    ...ICON_FRAME_BASE,
    width: dimensions.iconSize,
    height: dimensions.iconSize,
    pointerEvents: clickable ? "auto" : "none",
    cursor: clickable ? "pointer" : "default",
  }), [dimensions.iconSize]);

  const createIconInnerStyle = useMemo(() => (theme: StatTheme): React.CSSProperties => ({
      position: "absolute",
      inset: dimensions.iconInset,
      borderRadius: "9999px",
      background: `linear-gradient(135deg, ${theme.iconLight}, ${theme.iconDark})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: theme.iconGlyph,
      boxShadow:
        "inset 0 2px 4px rgba(255,255,255,0.18), inset 0 -3px 4px rgba(0,0,0,0.35)",
      fontSize: dimensions.iconFontSize,
      textShadow: "0 1px 1px rgba(0,0,0,0.7)",
  }), [dimensions.iconInset, dimensions.iconFontSize]);

  const iconHighlightStyle = useMemo(
    (): React.CSSProperties => ({
      position: "absolute",
      inset: dimensions.iconInset,
      borderRadius: "9999px",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%)",
      pointerEvents: "none",
    }),
    [dimensions.iconInset]
  );

  const createBarFrameStyle = useMemo(() => (theme: StatTheme, clickable: boolean): React.CSSProperties => ({
      width: dimensions.barWidth,
      height: dimensions.barHeight,
      borderRadius: dimensions.barHeight / 2,
      background: BAR_FRAME_BACKGROUND,
      backdropFilter: "blur(8px)",
      border: "2px solid rgba(139, 69, 19, 0.6)",
      boxShadow:
        "0 6px 16px rgba(0, 0, 0, 0.7), 0 3px 8px rgba(139, 69, 19, 0.4), inset 0 1px 0 rgba(242, 208, 138, 0.15), inset 0 -2px 0 rgba(0, 0, 0, 0.6)",
      position: "relative",
      overflow: "hidden",
      pointerEvents: clickable ? "auto" : "none",
      cursor: clickable ? "pointer" : "default",
  }), [dimensions.barWidth, dimensions.barHeight]);

  const createBarFillStyle = useCallback(
    (theme: StatTheme, percent: number): React.CSSProperties => ({
      width: `${percent}%`,
      height: "100%",
      background: `linear-gradient(90deg, ${theme.barLight}, ${theme.barDark})`,
      boxShadow:
        "inset 0 1px 2px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.35)",
      transition: "width 0.3s ease-out",
    }),
    []
  );

  const labelStyle = useMemo(
    (): React.CSSProperties => ({
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: COLORS.ACCENT,
      fontWeight: 600,
      fontSize: dimensions.labelFontSize,
      letterSpacing: 0.3,
      textShadow:
        "0 1px 2px rgba(0, 0, 0, 0.8), 0 0 4px rgba(242, 208, 138, 0.3)",
      pointerEvents: "none",
    }),
    [dimensions.labelFontSize]
  );

  const barOffsetStyle = useMemo(
    (): React.CSSProperties => ({
      transform: `translateX(${dimensions.barOffsetX}px)`,
    }),
    [dimensions.barOffsetX]
  );

  const containerStyle = useMemo(
    (): React.CSSProperties => ({
      top: dimensions.positionTop,
      left: dimensions.positionLeft,
      gap: dimensions.rowGap,
    }),
    [dimensions.positionTop, dimensions.positionLeft, dimensions.rowGap]
  );

  const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
  const healthPercent = clampPercent(
    (health.current / Math.max(health.max, 1)) * 100
  );
  const staminaPercent = clampPercent(stamina);
  const prayerPercent = clampPercent(
    (prayer.points / Math.max(prayer.level, 1)) * 100
  );

  const staminaTheme = runMode ? THEMES.staminaRun : THEMES.staminaWalk;

  const rows = useMemo(
    () => [
      {
        id: "health",
        icon: "❤️",
        theme: THEMES.health,
        percent: healthPercent,
        label: `${Math.round(health.current)}/${health.max}`,
        onClick: undefined as (() => void) | undefined,
        title: undefined as string | undefined,
      },
      {
        id: "stamina",
        icon: "🏃",
        theme: staminaTheme,
        percent: staminaPercent,
        label: `${Math.round(stamina)}%`,
        onClick: toggleRunMode,
        title: runMode ? "Click to walk" : "Click to run",
      },
      {
        id: "prayer",
        icon: "🙏",
        theme: THEMES.prayer,
        percent: prayerPercent,
        label: `${Math.round(prayer.points)}/${Math.max(prayer.level, 1)}`,
        onClick: undefined,
        title: undefined,
      },
    ],
    [
      healthPercent,
      health.current,
      health.max,
      staminaTheme,
      staminaPercent,
      stamina,
      toggleRunMode,
      runMode,
      prayerPercent,
      prayer.points,
      prayer.level,
    ]
  );

  return (
    <div
      className="fixed pointer-events-none z-50 flex flex-col"
      style={containerStyle}
    >
      {rows.map((row) => {
        const clickable = Boolean(row.onClick);
        return (
          <div key={row.id} className="flex items-end" style={{ gap: 0 }}>
            <div
              style={{
                ...createIconFrameStyle(clickable),
                zIndex: 2,
                position: "relative",
              }}
              onClick={row.onClick}
              title={row.title}
            >
              <div style={createIconInnerStyle(row.theme)}>{row.icon}</div>
              <div style={iconHighlightStyle} />
            </div>
            <div
              style={{
                ...createBarFrameStyle(row.theme, clickable),
                ...barOffsetStyle,
              }}
              onClick={row.onClick}
              title={row.title}
            >
              <div style={createBarFillStyle(row.theme, row.percent)} />
              <div style={BAR_HIGHLIGHT_STYLE} />
              <div style={labelStyle}>{row.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
