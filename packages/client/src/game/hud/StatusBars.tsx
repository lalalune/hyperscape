import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const update = () => {
      const player = world.entities?.player as
        | {
            playerData?: {
              health?: { current: number; max: number };
              stats?: { prayer?: { level: number; points: number } };
            };
            stamina?: number;
            runMode?: boolean;
          }
        | undefined;
      if (player) {
        // Get health from player data
        if (player.playerData?.health) {
          setHealth({
            current: player.playerData.health.current,
            max: player.playerData.health.max,
          });
        }

        // Get stamina from player
        setStamina(player.stamina || 100);

        // Get prayer from player stats
        if (player.playerData?.stats?.prayer) {
          setPrayer({
            level: player.playerData.stats.prayer.level || 1,
            points: player.playerData.stats.prayer.points || 1,
          });
        }

        // Get run mode from player
        setRunMode(player.runMode ?? true);
      }
    };

    const id = setInterval(update, 200);
    update();
    return () => clearInterval(id);
  }, [world]);

  const toggleRunMode = () => {
    const player = world.entities?.player as { runMode?: boolean } | undefined;
    if (player) {
      const newRunMode = !runMode;
      setRunMode(newRunMode);
      player.runMode = newRunMode;

      // Send network request to update server
      world.network?.send?.("moveRequest", { runMode: newRunMode });
    }
  };

  const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

  const healthPercent = clampPercent(
    (health.current / Math.max(health.max, 1)) * 100,
  );
  const staminaPercent = clampPercent(stamina);
  const prayerPercent = clampPercent(
    (prayer.points / Math.max(prayer.level, 1)) * 100,
  );

  const themes: {
    health: StatTheme;
    staminaRun: StatTheme;
    staminaWalk: StatTheme;
    prayer: StatTheme;
  } = {
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
  };

  const iconSize = isMobile ? 40 : 48;
  const iconInset = isMobile ? 4 : 5;
  const iconFontSize = isMobile ? "1rem" : "1.25rem";
  const barWidth = isMobile ? 130 : 190;
  const barHeight = isMobile ? 22 : 27;
  const labelFontSize = isMobile ? "0.7rem" : "0.8rem";
  const rowGap = isMobile ? 10 : 12;
  const positionOffsets = { top: isMobile ? 12 : 20, left: isMobile ? 12 : 24 };

  const barFrameBackground =
    "linear-gradient(180deg, rgba(20, 15, 10, 0.75), rgba(15, 10, 5, 0.85))";

  const barOffsetStyle: React.CSSProperties = {
    transform: `translateX(${isMobile ? -18 : -24}px)`,
  };

  const createIconFrameStyle = (clickable: boolean): React.CSSProperties => ({
    width: iconSize,
    height: iconSize,
    borderRadius: "9999px",
    background:
      "linear-gradient(135deg, rgba(30, 20, 10, 0.9) 0%, rgba(20, 15, 10, 0.95) 100%)",
    backdropFilter: "blur(8px)",
    border: "2px solid rgba(139, 69, 19, 0.7)",
    boxShadow:
      "0 4px 12px rgba(0, 0, 0, 0.7), 0 2px 6px rgba(139, 69, 19, 0.4), inset 0 1px 0 rgba(242, 208, 138, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.5)",
    position: "relative",
    pointerEvents: clickable ? "auto" : "none",
    cursor: clickable ? "pointer" : "default",
    flexShrink: 0,
  });

  const createIconInnerStyle = (theme: StatTheme): React.CSSProperties => ({
    position: "absolute",
    inset: iconInset,
    borderRadius: "9999px",
    background: `linear-gradient(135deg, ${theme.iconLight}, ${theme.iconDark})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.iconGlyph,
    boxShadow:
      "inset 0 2px 4px rgba(255,255,255,0.18), inset 0 -3px 4px rgba(0,0,0,0.35)",
    fontSize: iconFontSize,
    textShadow: "0 1px 1px rgba(0,0,0,0.7)",
  });

  const iconHighlightStyle: React.CSSProperties = {
    position: "absolute",
    inset: iconInset,
    borderRadius: "9999px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%)",
    pointerEvents: "none",
  };

  const createBarFrameStyle = (
    theme: StatTheme,
    clickable: boolean,
  ): React.CSSProperties => ({
    width: barWidth,
    height: barHeight,
    borderRadius: barHeight / 2,
    background: barFrameBackground,
    backdropFilter: "blur(8px)",
    border: "2px solid rgba(139, 69, 19, 0.6)",
    boxShadow:
      "0 6px 16px rgba(0, 0, 0, 0.7), 0 3px 8px rgba(139, 69, 19, 0.4), inset 0 1px 0 rgba(242, 208, 138, 0.15), inset 0 -2px 0 rgba(0, 0, 0, 0.6)",
    position: "relative",
    overflow: "hidden",
    pointerEvents: clickable ? "auto" : "none",
    cursor: clickable ? "pointer" : "default",
  });

  const createBarFillStyle = (
    theme: StatTheme,
    percent: number,
  ): React.CSSProperties => ({
    width: `${percent}%`,
    height: "100%",
    background: `linear-gradient(90deg, ${theme.barLight}, ${theme.barDark})`,
    boxShadow:
      "inset 0 1px 2px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.35)",
    transition: "width 0.3s ease-out",
  });

  const barHighlightStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.05) 35%, rgba(0,0,0,0.35) 100%)",
    pointerEvents: "none",
  };

  const labelStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: COLORS.ACCENT,
    fontWeight: 600,
    fontSize: labelFontSize,
    letterSpacing: 0.3,
    textShadow:
      "0 1px 2px rgba(0, 0, 0, 0.8), 0 0 4px rgba(242, 208, 138, 0.3)",
    pointerEvents: "none",
  };

  const staminaTheme = runMode ? themes.staminaRun : themes.staminaWalk;

  const rows: Array<{
    id: string;
    icon: string;
    theme: StatTheme;
    percent: number;
    label: string;
    onClick?: () => void;
    title?: string;
  }> = [
    {
      id: "health",
      icon: "❤️",
      theme: themes.health,
      percent: healthPercent,
      label: `${Math.round(health.current)}/${health.max}`,
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
      theme: themes.prayer,
      percent: prayerPercent,
      label: `${Math.round(prayer.points)}/${Math.max(prayer.level, 1)}`,
    },
  ];

  return (
    <div
      className="fixed pointer-events-none z-50 flex flex-col"
      style={{
        top: positionOffsets.top,
        left: positionOffsets.left,
        gap: rowGap,
      }}
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
              <div style={barHighlightStyle} />
              <div style={labelStyle}>{row.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
