/**
 * Combat Panel (Orchestrator)
 *
 * OSRS-style combat panel that composes sub-components for style selection,
 * bonuses display, and auto-retaliate toggle. Manages combat state via
 * world events and exposes optimistic UI updates.
 */

import { useEffect, useState, useMemo, useRef } from "react";
import { useThemeStore, useMobileLayout, useWindowStore } from "@/ui";
import { getPanelInsetStyle, getPanelSurfaceStyle } from "@/ui/theme/themes";
import {
  EventType,
  getAvailableStyles,
  WeaponType,
  calculateCombatLevel,
  normalizeCombatSkills,
} from "@hyperscape/shared";
import {
  PANEL_PADDING,
  PANEL_MOBILE_PADDING,
  PANEL_GRID_GAP,
} from "../../constants/panelLayout";
import type {
  ClientWorld,
  PlayerStats,
  PlayerEquipmentItems,
  PlayerHealth,
} from "../../types";
import {
  CombatStyleSelector,
  CombatBonusesDisplay,
  AutoRetaliateToggle,
  isStyleUpdateEvent,
  isTargetChangedEvent,
  isTargetHealthEvent,
  isAutoRetaliateEvent,
} from "./combat";
import type { CombatStyleInfo } from "./combat";

// Client-side cache for combat style state (persists across panel opens/closes)
// This enables instant display when reopening panel (RuneScape pattern)
const combatStyleCache = new Map<string, string>();
const autoRetaliateCache = new Map<string, boolean>();
const VALID_WEAPON_TYPES = new Set<string>(Object.values(WeaponType));

/** All possible combat styles with their XP training info and colors (OSRS-accurate) */
const ALL_STYLES: CombatStyleInfo[] = [
  // Melee styles
  { id: "accurate", label: "Accurate", xp: "Attack", color: "#ef4444" },
  { id: "aggressive", label: "Aggressive", xp: "Strength", color: "#22c55e" },
  { id: "defensive", label: "Defensive", xp: "Defense", color: "#3b82f6" },
  { id: "controlled", label: "Controlled", xp: "All", color: "#a855f7" },
  // Ranged styles
  { id: "rapid", label: "Rapid", xp: "Ranged", color: "#f59e0b" },
  { id: "longrange", label: "Longrange", xp: "Rng+Def", color: "#06b6d4" },
  // Magic styles
  { id: "autocast", label: "Autocast", xp: "Magic", color: "#8b5cf6" },
];

interface CombatPanelProps {
  world: ClientWorld;
  stats: PlayerStats | null;
  equipment: PlayerEquipmentItems | null;
}

export function CombatPanel({ world, stats, equipment }: CombatPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const { shouldUseMobileUI } = useMobileLayout();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelSize, setPanelSize] = useState({ width: 280, height: 360 });

  // Initialize from cache if available, otherwise default to "accurate"
  const [style, setStyle] = useState<string>(() => {
    const playerId = world.entities?.player?.id;
    if (playerId && combatStyleCache.has(playerId)) {
      return combatStyleCache.get(playerId)!;
    }
    const networkCache =
      world.network?.lastAttackStyleByPlayerId?.[playerId || ""];
    if (networkCache?.currentStyle?.id) {
      if (playerId) {
        combatStyleCache.set(playerId, networkCache.currentStyle.id);
      }
      return networkCache.currentStyle.id;
    }
    return "accurate";
  });

  const [cooldown, setCooldown] = useState<number>(0);
  const [targetName, setTargetName] = useState<string | null>(null);
  const [targetHealth, setTargetHealth] = useState<PlayerHealth | null>(null);

  // Auto-retaliate state (OSRS default is ON)
  const [autoRetaliate, setAutoRetaliate] = useState<boolean>(() => {
    const player = world.entities?.player;
    const playerId = player?.id;
    if (playerId && autoRetaliateCache.has(playerId)) {
      return autoRetaliateCache.get(playerId)!;
    }
    const playerCombat = (player as { combat?: { autoRetaliate?: boolean } })
      ?.combat;
    if (typeof playerCombat?.autoRetaliate === "boolean") {
      return playerCombat.autoRetaliate;
    }
    return true;
  });

  const playerId = world.entities?.player?.id ?? null;
  const previousPlayerIdRef = useRef<string | null>(null);

  const combatLevel = stats?.skills
    ? calculateCombatLevel(
        normalizeCombatSkills({
          attack: stats.skills.attack?.level,
          strength: stats.skills.strength?.level,
          defense: stats.skills.defense?.level,
          constitution: stats.skills.constitution?.level,
          ranged: stats.skills.ranged?.level,
          magic: stats.skills.magic?.level,
          prayer: stats.skills.prayer?.level,
        }),
      )
    : 1;

  const inCombat = stats?.inCombat || false;
  const health = stats?.health ?? { current: 0, max: 1 };
  const attackLevel = stats?.skills?.attack?.level || 1;
  const strengthLevel = stats?.skills?.strength?.level || 1;
  const defenseLevel = stats?.skills?.defense?.level || 1;

  // Sync state from server events
  useEffect(() => {
    if (!playerId) return;

    const networkCache = world.network?.lastAttackStyleByPlayerId?.[playerId];
    if (networkCache?.currentStyle?.id) {
      combatStyleCache.set(playerId, networkCache.currentStyle.id);
      setStyle(networkCache.currentStyle.id);
    }

    const actions = world.getSystem("actions") as {
      actionMethods?: {
        getAttackStyleInfo?: (
          id: string,
          cb: (info: { style: string; cooldown?: number }) => void,
        ) => void;
        changeAttackStyle?: (id: string, style: string) => void;
        getAutoRetaliate?: (id: string, cb: (enabled: boolean) => void) => void;
        setAutoRetaliate?: (id: string, enabled: boolean) => void;
      };
    } | null;

    actions?.actionMethods?.getAttackStyleInfo?.(
      playerId,
      (info: { style: string; cooldown?: number }) => {
        if (info) {
          combatStyleCache.set(playerId, info.style);
          setStyle(info.style);
          setCooldown(info.cooldown || 0);
        }
      },
    );

    actions?.actionMethods?.getAutoRetaliate?.(playerId, (enabled: boolean) => {
      autoRetaliateCache.set(playerId, enabled);
      setAutoRetaliate(enabled);
    });

    const onUpdate = (data: unknown) => {
      if (!isStyleUpdateEvent(data)) return;
      if (data.playerId !== playerId) return;
      combatStyleCache.set(playerId, data.currentStyle.id);
      setStyle(data.currentStyle.id);
    };
    const onChanged = (data: unknown) => {
      if (!isStyleUpdateEvent(data)) return;
      if (data.playerId !== playerId) return;
      combatStyleCache.set(playerId, data.currentStyle.id);
      setStyle(data.currentStyle.id);
    };

    const onTargetChanged = (data: unknown) => {
      if (!isTargetChangedEvent(data)) return;
      if (data.targetId) {
        setTargetName(data.targetName || data.targetId);
        setTargetHealth(data.targetHealth || null);
      } else {
        setTargetName(null);
        setTargetHealth(null);
      }
    };

    const onTargetHealthUpdate = (data: unknown) => {
      if (!isTargetHealthEvent(data)) return;
      if (data.targetId && targetName) {
        setTargetHealth(data.health);
      }
    };

    const onAutoRetaliateChanged = (data: unknown) => {
      if (!isAutoRetaliateEvent(data)) return;
      if (data.playerId !== playerId) return;
      autoRetaliateCache.set(playerId, data.enabled);
      setAutoRetaliate(data.enabled);
    };

    world.on(EventType.UI_ATTACK_STYLE_UPDATE, onUpdate, undefined);
    world.on(EventType.UI_ATTACK_STYLE_CHANGED, onChanged, undefined);
    world.on(
      EventType.UI_AUTO_RETALIATE_CHANGED,
      onAutoRetaliateChanged,
      undefined,
    );
    world.on(EventType.UI_COMBAT_TARGET_CHANGED, onTargetChanged, undefined);
    world.on(
      EventType.UI_COMBAT_TARGET_HEALTH,
      onTargetHealthUpdate,
      undefined,
    );

    return () => {
      world.off(
        EventType.UI_ATTACK_STYLE_UPDATE,
        onUpdate,
        undefined,
        undefined,
      );
      world.off(
        EventType.UI_ATTACK_STYLE_CHANGED,
        onChanged,
        undefined,
        undefined,
      );
      world.off(
        EventType.UI_AUTO_RETALIATE_CHANGED,
        onAutoRetaliateChanged,
        undefined,
        undefined,
      );
      world.off(
        EventType.UI_COMBAT_TARGET_CHANGED,
        onTargetChanged,
        undefined,
        undefined,
      );
      world.off(
        EventType.UI_COMBAT_TARGET_HEALTH,
        onTargetHealthUpdate,
        undefined,
        undefined,
      );
    };
  }, [playerId, targetName, world]);

  // Clean up cache when player changes
  useEffect(() => {
    const previousPlayerId = previousPlayerIdRef.current;
    if (previousPlayerId && previousPlayerId !== playerId) {
      combatStyleCache.delete(previousPlayerId);
      autoRetaliateCache.delete(previousPlayerId);
    }
    previousPlayerIdRef.current = playerId;
  }, [playerId]);

  const changeStyle = (next: string) => {
    const currentPlayerId = world.entities?.player?.id;
    if (!currentPlayerId) return;

    const actions = world.getSystem("actions") as {
      actionMethods?: {
        changeAttackStyle?: (id: string, style: string) => void;
      };
    } | null;

    if (!actions?.actionMethods?.changeAttackStyle) return;

    // Optimistic: update UI instantly (OSRS has zero visible delay)
    combatStyleCache.set(currentPlayerId, next);
    setStyle(next);

    actions.actionMethods.changeAttackStyle(currentPlayerId, next);

    // OSRS-accurate: selecting autocast opens the spells panel for spell selection
    if (next === "autocast") {
      const store = useWindowStore.getState();
      const windows = Array.from(store.windows.values());
      const existing = windows.find((w) =>
        w.tabs.some((t) => t.content === "spells"),
      );
      if (existing) {
        const tabIndex = existing.tabs.findIndex((t) => t.content === "spells");
        if (tabIndex >= 0) {
          store.updateWindow(existing.id, {
            activeTabIndex: tabIndex,
            visible: true,
          });
          store.bringToFront(existing.id);
        }
      } else {
        store.createWindow({
          id: `panel-spells-${Date.now()}`,
          position: {
            x: Math.max(100, window.innerWidth / 2 - 200),
            y: Math.max(100, window.innerHeight / 2 - 150),
          },
          size: { width: 400, height: 350 },
          minSize: { width: 250, height: 200 },
          tabs: [
            {
              id: "spells",
              label: "Spells",
              content: "spells",
              closeable: true,
            },
          ],
        });
      }
    }
  };

  const toggleAutoRetaliate = () => {
    const currentPlayerId = world.entities?.player?.id;
    if (!currentPlayerId) return;

    const actions = world.getSystem("actions") as {
      actionMethods?: {
        setAutoRetaliate?: (id: string, enabled: boolean) => void;
      };
    } | null;

    if (!actions?.actionMethods?.setAutoRetaliate) return;

    const newValue = !autoRetaliate;
    autoRetaliateCache.set(currentPlayerId, newValue);
    setAutoRetaliate(newValue);
    actions.actionMethods.setAutoRetaliate(currentPlayerId, newValue);
  };

  // Filter styles based on equipped weapon (OSRS-accurate restrictions)
  const styles = useMemo(() => {
    const normalizedWeaponType = equipment?.weapon?.weaponType?.toLowerCase();
    const weaponType = normalizedWeaponType
      ? VALID_WEAPON_TYPES.has(normalizedWeaponType)
        ? (normalizedWeaponType as WeaponType)
        : WeaponType.NONE
      : WeaponType.NONE;
    const availableStyleIds = getAvailableStyles(weaponType);
    return ALL_STYLES.filter((s) =>
      (availableStyleIds as readonly string[]).includes(s.id),
    );
  }, [equipment?.weapon?.weaponType]);

  // Responsive panel sizing via ResizeObserver
  useEffect(() => {
    const element = panelRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      setPanelSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const compactPanel =
    shouldUseMobileUI || panelSize.height < 330 || panelSize.width < 250;
  const ultraCompactPanel = panelSize.height < 290 || panelSize.width < 220;
  const p = compactPanel
    ? {
        outer: PANEL_MOBILE_PADDING,
        inner: PANEL_PADDING,
        gap: PANEL_MOBILE_PADDING,
      }
    : { outer: PANEL_PADDING, inner: PANEL_PADDING + 2, gap: PANEL_GRID_GAP };

  return (
    <div
      ref={panelRef}
      className="flex flex-col h-full overflow-hidden"
      style={{
        ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
        padding: `${p.outer}px`,
        gap: `${p.gap}px`,
      }}
    >
      {/* Inline CSS animations */}
      <style>{`
        @keyframes combat-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .combat-pulse { animation: combat-pulse 1.5s ease-in-out infinite; }
        .combat-banner { transition: transform 0.15s ease, filter 0.15s ease; }
        .combat-banner:hover:not(:disabled) { transform: translateY(-2px) scale(1.03); filter: brightness(1.15) contrast(1.05); }
        .combat-banner:active:not(:disabled) { transform: translateY(0) scale(0.98); filter: brightness(0.9); }
      `}</style>

      {/* Attack Styles + Bonuses (top section) */}
      <div
        style={{
          ...getPanelInsetStyle(theme, {
            emphasis: "strong",
            radius: 4,
            padding: `${p.inner}px`,
          }),
          display: "flex",
          flexDirection: "column",
          overflow: "visible",
          flexShrink: 0,
        }}
      >
        <CombatStyleSelector
          styles={styles}
          activeStyleId={style}
          cooldown={cooldown}
          compactPanel={compactPanel}
          theme={theme}
          onStyleChange={changeStyle}
        />

        <CombatBonusesDisplay
          health={health}
          combatLevel={combatLevel}
          inCombat={inCombat}
          attackLevel={attackLevel}
          strengthLevel={strengthLevel}
          defenseLevel={defenseLevel}
          targetName={targetName}
          targetHealth={targetHealth}
          compactPanel={compactPanel}
          ultraCompactPanel={ultraCompactPanel}
          isMobile={shouldUseMobileUI}
          innerPadding={p.inner}
          theme={theme}
        />
      </div>

      {/* Spacer to push auto-retaliate to bottom */}
      <div style={{ flex: 1 }} />

      {/* Auto Retaliate -- pinned to bottom */}
      <AutoRetaliateToggle
        enabled={autoRetaliate}
        onToggle={toggleAutoRetaliate}
        theme={theme}
      />
    </div>
  );
}
