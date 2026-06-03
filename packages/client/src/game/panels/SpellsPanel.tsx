/**
 * Spells Panel
 * OSRS-inspired magic spellbook interface
 * Shows available combat spells with level requirements
 * Click to select autocast spell
 *
 * F2P Scope: Strike and Bolt tier combat spells only
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useThemeStore, useMobileLayout, CursorTooltip } from "@/ui";
import {
  getTooltipBodyStyle,
  getTooltipDividerStyle,
  getTooltipMetaStyle,
  getTooltipStatusStyle,
  getTooltipTagStyle,
  getTooltipTitleStyle,
} from "@/ui/core/tooltip/tooltipStyles";
import {
  getInteractiveTileStyle,
  getPanelInsetStyle,
  getPanelSurfaceStyle,
} from "@/ui/theme/themes";
import { zIndex } from "../../constants";
import {
  PANEL_ICON_SIZE,
  PANEL_GRID_GAP,
  PANEL_PADDING,
  PANEL_GRID_PADDING,
  PANEL_MOBILE_PADDING,
  PANEL_MOBILE_ICON_SIZE,
  PANEL_MOBILE_GRID_GAP,
  PANEL_SLOT_RADIUS,
} from "../../constants/panelLayout";
import type { PlayerStats, ClientWorld } from "../../types";
import { spellService, EventType, type Spell } from "@hyperforge/shared";

// Spell panel layout constants — use shared sizing tokens from panelLayout.ts
// to ensure consistency across Prayer, Spells, Skills, and Inventory panels.
const SPELL_ICON_SIZE = PANEL_ICON_SIZE; // 36px desktop icon size
const SPELL_GAP = PANEL_GRID_GAP; // 3px gap between slots
// PANEL_PADDING re-exported from constants barrel
const GRID_PADDING = PANEL_GRID_PADDING; // alias for local use

// Mobile constants – use shared mobile icon size token
const MOBILE_SPELL_ICON_SIZE = PANEL_MOBILE_ICON_SIZE; // 48px (touch target)
const MOBILE_SPELL_GAP = PANEL_MOBILE_GRID_GAP; // 6px

/**
 * Calculate number of columns based on container width
 */
function calculateColumns(containerWidth: number, isMobile: boolean): number {
  const iconSize = isMobile ? MOBILE_SPELL_ICON_SIZE : SPELL_ICON_SIZE;
  const gap = isMobile ? MOBILE_SPELL_GAP : SPELL_GAP;
  const availableWidth = containerWidth - PANEL_PADDING * 2 - GRID_PADDING * 2;
  const colWidth = iconSize + gap;
  const maxCols = Math.floor((availableWidth + gap) / colWidth);
  // 5 columns by default (matches PrayerPanel), adapt for narrower windows
  return Math.max(2, Math.min(5, maxCols));
}

/** Export dimensions for window configuration */
export const SPELLS_PANEL_DIMENSIONS = {
  minWidth: 180,
  minHeight: 200,
  defaultWidth: 220,
  defaultHeight: 320,
  maxWidth: 400,
  maxHeight: 500,
};

/** Spell UI representation */
interface SpellUI extends Spell {
  isSelected: boolean;
  canCast: boolean;
}

interface SpellsPanelProps {
  stats: PlayerStats | null;
  world: ClientWorld;
}

/** Spell context menu state */
interface SpellContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  spell: SpellUI | null;
}

/** Element icons by spell element */
const ELEMENT_ICONS: Record<string, string> = {
  air: "💨",
  water: "💧",
  earth: "🪨",
  fire: "🔥",
};

/** Get element color for styling */
function getElementColor(element: string): string {
  switch (element) {
    case "air":
      return "#87CEEB"; // Sky blue
    case "water":
      return "#4169E1"; // Royal blue
    case "earth":
      return "#8B4513"; // Saddle brown
    case "fire":
      return "#FF4500"; // Orange red
    default:
      return "#9370DB"; // Medium purple
  }
}

/** Spell icon component */
function SpellIcon({
  spell,
  playerLevel,
  onClick,
  onContextMenu,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  isMobile = false,
}: {
  spell: SpellUI;
  playerLevel: number;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  isMobile?: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  const isUnlocked = playerLevel >= spell.level;
  const isSelected = spell.isSelected;

  const [isHovered, setIsHovered] = React.useState(false);

  const iconSize = isMobile ? MOBILE_SPELL_ICON_SIZE : SPELL_ICON_SIZE;

  const buttonStyle = useMemo(
    (): React.CSSProperties => ({
      width: iconSize,
      height: iconSize,
      padding: 0,
      background:
        isHovered && isUnlocked
          ? "rgba(183, 140, 76, 0.08)"
          : "var(--color-slot-empty)",
      ...getInteractiveTileStyle(theme, {
        active: isSelected,
        hovered: isHovered,
        disabled: !isUnlocked,
        radius: 4, // Square matching equipment/inventory UI
        accentColor: getElementColor(spell.element), // Keep logic
      }),
      borderColor: isSelected
        ? `${getElementColor(spell.element)}B3`
        : isHovered && isUnlocked
          ? "rgba(183, 140, 76, 0.4)"
          : "rgba(8, 8, 10, 0.6)",
      borderWidth: "1px",
      borderRadius: 4,
      cursor: isUnlocked ? "pointer" : "not-allowed",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      boxShadow: isSelected
        ? `0 0 ${isMobile ? 12 : 8}px ${getElementColor(spell.element)}80, inset 0 0 ${isMobile ? 16 : 10}px ${getElementColor(spell.element)}33, inset 2px 2px 4px rgba(0, 0, 0, 0.34)`
        : isHovered && isUnlocked
          ? "inset 2px 2px 4px rgba(0, 0, 0, 0.5), inset -1px -1px 2px rgba(183, 140, 76, 0.15)"
          : "inset 2px 2px 4px rgba(0, 0, 0, 0.42), inset -1px -1px 2px rgba(88, 74, 56, 0.12)",
      opacity: isUnlocked ? 1 : 0.5,
    }),
    [
      isSelected,
      isUnlocked,
      isHovered,
      theme,
      iconSize,
      isMobile,
      spell.element,
    ],
  );

  return (
    <button
      onClick={isUnlocked ? onClick : undefined}
      onContextMenu={onContextMenu}
      onMouseEnter={(e) => {
        setIsHovered(true);
        onMouseEnter(e);
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={() => {
        setIsHovered(false);
        onMouseLeave();
      }}
      disabled={!isUnlocked}
      aria-label={`${spell.name}${isSelected ? " (Selected)" : ""}${!isUnlocked ? " (Locked)" : ""}`}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
      style={buttonStyle}
    >
      {/* Glow effect for selected spell */}
      {isSelected && (
        <div
          style={{
            position: "absolute",
            inset: -2,
            background: `radial-gradient(ellipse at center, ${getElementColor(spell.element)}26 0%, transparent 70%)`,
            animation: "pulse 2s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Spell icon */}
      <span
        style={{
          fontSize: isMobile ? 26 : 20,
          filter: isUnlocked
            ? isSelected
              ? `drop-shadow(0 0 ${isMobile ? 8 : 5}px ${getElementColor(spell.element)}CC) brightness(1.3)`
              : "none"
            : "grayscale(100%) brightness(0.4)",
          transition: "all 0.15s ease",
          zIndex: 1,
        }}
      >
        {ELEMENT_ICONS[spell.element] || "✨"}
      </span>

      {/* Level indicator for locked spells */}
      {!isUnlocked && (
        <div
          style={{
            position: "absolute",
            bottom: 2,
            right: 2,
            fontSize: isMobile ? 10 : 8,
            color: theme.colors.state.danger,
            fontWeight: "bold",
            background: "rgba(0,0,0,0.6)",
            padding: "1px 3px",
            borderRadius: 2,
          }}
        >
          {spell.level}
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <div
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            fontSize: isMobile ? 12 : 10,
          }}
        >
          ✓
        </div>
      )}
    </button>
  );
}

export function SpellsPanel({ stats, world }: SpellsPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const { shouldUseMobileUI } = useMobileLayout();
  const [hoveredSpell, setHoveredSpell] = useState<SpellUI | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(
    SPELLS_PANEL_DIMENSIONS.defaultWidth,
  );
  const [contextMenu, setContextMenu] = useState<SpellContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    spell: null,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const playerMagicLevel = stats?.skills?.magic?.level ?? 1;

  // Track container width for adaptive layout
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    setContainerWidth(containerRef.current.offsetWidth);

    return () => resizeObserver.disconnect();
  }, []);

  // Listen for autocast changes from server
  useEffect(() => {
    if (!world) return;

    // Get initial selected spell from player data
    const localPlayer = world.getPlayer();
    if (localPlayer?.data) {
      const playerData = localPlayer.data as { selectedSpell?: string };
      if (playerData.selectedSpell) {
        setSelectedSpellId(playerData.selectedSpell);
      }
    }

    const handleAutocastSet = (payload: unknown) => {
      const data = payload as { playerId: string; spellId: string | null };
      const player = world.getPlayer();
      if (!player || data.playerId !== player.id) return;
      setSelectedSpellId(data.spellId);
    };

    world.on(EventType.COMBAT_AUTOCAST_SET, handleAutocastSet);

    return () => {
      world.off(EventType.COMBAT_AUTOCAST_SET, handleAutocastSet);
    };
  }, [world]);

  // Calculate grid columns
  const gridColumns = useMemo(() => {
    return calculateColumns(containerWidth, shouldUseMobileUI);
  }, [containerWidth, shouldUseMobileUI]);

  // Get all spells and add UI state
  const spells: SpellUI[] = useMemo(() => {
    return spellService.getAllSpells().map((spell) => ({
      ...spell,
      isSelected: selectedSpellId === spell.id,
      canCast: playerMagicLevel >= spell.level,
    }));
  }, [selectedSpellId, playerMagicLevel]);

  // Select/deselect spell (set autocast)
  const selectSpell = useCallback(
    (spellId: string) => {
      const network = world.network;
      if (!network) return;

      // Toggle: if already selected, deselect; otherwise select
      const newSpellId = selectedSpellId === spellId ? null : spellId;

      if ("setAutocast" in network) {
        (network as { setAutocast: (id: string | null) => void }).setAutocast(
          newSpellId,
        );
      }

      // Optimistically update UI
      setSelectedSpellId(newSpellId);
    },
    [world, selectedSpellId],
  );

  // Handle spell context menu (right-click)
  const handleSpellContextMenu = useCallback(
    (e: React.MouseEvent, spell: SpellUI) => {
      e.preventDefault();
      e.stopPropagation();
      // Hide tooltip when context menu opens
      setHoveredSpell(null);
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        spell,
      });
    },
    [],
  );

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    if (contextMenu.visible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu.visible]);

  const iconSize = shouldUseMobileUI ? MOBILE_SPELL_ICON_SIZE : SPELL_ICON_SIZE;
  const gap = shouldUseMobileUI ? MOBILE_SPELL_GAP : SPELL_GAP;

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full"
      style={{
        ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
        padding: shouldUseMobileUI ? PANEL_MOBILE_PADDING : PANEL_PADDING,
      }}
    >
      {/* Magic Level Header — mirrors Prayer's prayer-points header */}
      <div
        style={{
          ...getPanelInsetStyle(theme, { emphasis: "normal", radius: 4 }),
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: shouldUseMobileUI ? "4px 6px" : "3px 6px",
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: shouldUseMobileUI ? 16 : 14 }}>🔮</span>
          <div>
            <div
              style={{
                fontSize: shouldUseMobileUI ? 9 : 8,
                color: theme.colors.text.muted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Magic Level
            </div>
          </div>
        </div>

        {/* Magic level value on the right — always visible, matches prayer panel pattern */}
        <div
          style={{
            textAlign: "right",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
          }}
        >
          <div
            style={{
              fontSize: shouldUseMobileUI ? 13 : 11,
              fontWeight: 600,
              color: theme.colors.accent.secondary,
            }}
          >
            {playerMagicLevel}
          </div>
          {selectedSpellId && (
            <div
              style={{
                fontSize: 8,
                color: theme.colors.state.success,
                textTransform: "uppercase",
                opacity: 0.8,
                maxWidth: 64,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              ✓ {spells.find((s) => s.id === selectedSpellId)?.name ?? ""}
            </div>
          )}
        </div>
      </div>

      {/* Spell Grid — mirrors PrayerPanel grid exactly */}
      <div
        className="scrollbar-thin"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <div
          style={{
            ...getPanelInsetStyle(theme, { emphasis: "strong", radius: 4 }),
            display: "grid",
            gridTemplateColumns: shouldUseMobileUI
              ? `repeat(${gridColumns}, ${MOBILE_SPELL_ICON_SIZE}px)`
              : `repeat(${gridColumns}, ${SPELL_ICON_SIZE}px)`,
            gap: shouldUseMobileUI ? MOBILE_SPELL_GAP : SPELL_GAP,
            padding: "8px 4px",
            justifyContent: "center",
          }}
        >
          {spells.map((spell) => (
            <SpellIcon
              key={spell.id}
              spell={spell}
              playerLevel={playerMagicLevel}
              onClick={() => selectSpell(spell.id)}
              onContextMenu={(e) => handleSpellContextMenu(e, spell)}
              onMouseEnter={(e) => {
                if (!contextMenu.visible) {
                  setHoveredSpell(spell);
                  setMousePos({ x: e.clientX, y: e.clientY });
                }
              }}
              onMouseMove={(e) => {
                if (!contextMenu.visible) {
                  setMousePos({ x: e.clientX, y: e.clientY });
                }
              }}
              onMouseLeave={() => setHoveredSpell(null)}
              isMobile={shouldUseMobileUI}
            />
          ))}
        </div>
      </div>

      {/* Footer — mirrors Prayer's "Active: X / Deactivate All" row */}
      <div
        style={{
          ...getPanelInsetStyle(theme, { emphasis: "normal", radius: 4 }),
          marginTop: 4,
          padding: shouldUseMobileUI ? "4px 6px" : "3px 6px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: shouldUseMobileUI ? 10 : 9,
            color: theme.colors.text.muted,
          }}
        >
          {selectedSpellId
            ? `Autocast: ${spells.find((s) => s.id === selectedSpellId)?.name ?? ""}`
            : "No autocast set"}
        </span>
        <button
          onClick={() => selectedSpellId && selectSpell(selectedSpellId)}
          disabled={!selectedSpellId}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          style={{
            padding: shouldUseMobileUI ? "3px 8px" : "2px 6px",
            fontSize: shouldUseMobileUI ? 10 : 9,
            background: selectedSpellId
              ? `linear-gradient(180deg, ${theme.colors.state.danger}26 0%, rgba(39, 15, 15, 0.28) 100%)`
              : theme.colors.slot.disabled,
            border: `1px solid ${
              selectedSpellId
                ? theme.colors.state.danger
                : theme.colors.border.default
            }40`,
            borderRadius: 4,
            color: selectedSpellId
              ? theme.colors.state.danger
              : theme.colors.text.disabled,
            cursor: selectedSpellId ? "pointer" : "default",
          }}
        >
          Clear
        </button>
      </div>

      {/* Spell Tooltip */}
      <CursorTooltip
        visible={!!hoveredSpell && !contextMenu.visible}
        position={mousePos}
        estimatedSize={{ width: 220, height: 140 }}
        style={{
          zIndex: zIndex.tooltip,
          minWidth: 190,
          maxWidth: 260,
        }}
      >
        {hoveredSpell && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 28 }}>
                {ELEMENT_ICONS[hoveredSpell.element] || "✨"}
              </span>
              <div>
                <div
                  style={{
                    ...getTooltipTitleStyle(theme),
                    fontSize: 15,
                  }}
                >
                  {hoveredSpell.name}
                </div>
                <div style={getTooltipMetaStyle(theme)}>
                  Level {hoveredSpell.level} Magic
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
                ...getTooltipBodyStyle(theme),
                marginBottom: 8,
              }}
            >
              <div>
                Max Hit:{" "}
                <span
                  style={{ fontWeight: 600, color: theme.colors.text.primary }}
                >
                  {hoveredSpell.baseMaxHit}
                </span>
              </div>
              <div>
                XP:{" "}
                <span
                  style={{ fontWeight: 600, color: theme.colors.text.primary }}
                >
                  {hoveredSpell.baseXp}
                </span>
              </div>
            </div>

            <div
              style={{
                ...getTooltipDividerStyle(theme),
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  ...getTooltipMetaStyle(theme),
                  marginBottom: 4,
                  fontWeight: 600,
                }}
              >
                Rune Cost
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {hoveredSpell.runes.map((rune, idx) => (
                  <span key={idx} style={getTooltipTagStyle(theme)}>
                    {rune.quantity}x{" "}
                    {rune.runeId.replace("_rune", "").replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>

            {playerMagicLevel < hoveredSpell.level && (
              <div
                style={{
                  ...getTooltipStatusStyle(theme, "danger"),
                }}
              >
                Requires level {hoveredSpell.level} Magic
              </div>
            )}
            {hoveredSpell.isSelected && (
              <div
                style={{
                  ...getTooltipStatusStyle(theme, "success"),
                }}
              >
                Currently Selected for Autocast
              </div>
            )}
          </>
        )}
      </CursorTooltip>

      {/* Context Menu */}
      {contextMenu.visible &&
        contextMenu.spell &&
        createPortal(
          <div
            ref={contextMenuRef}
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: zIndex.contextMenu,
              background:
                theme.name === "hyperia"
                  ? "linear-gradient(180deg, rgba(44, 36, 24, 0.98) 0%, rgba(18, 15, 11, 0.98) 100%)"
                  : `linear-gradient(180deg, ${theme.colors.background.tertiary} 0%, ${theme.colors.background.secondary} 100%)`,
              border: `1px solid ${theme.colors.border.default}`,
              borderRadius: theme.borderRadius.md,
              boxShadow: `${theme.shadows.lg}, inset 0 1px 0 rgba(255,255,255,0.04)`,
              minWidth: 140,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "6px 10px",
                background: theme.colors.background.primary,
                borderBottom: `1px solid ${theme.colors.border.default}50`,
                fontSize: 11,
                fontWeight: 600,
                color: getElementColor(contextMenu.spell.element),
              }}
            >
              {contextMenu.spell.name}
            </div>

            {playerMagicLevel >= contextMenu.spell.level && (
              <button
                onClick={() => {
                  selectSpell(contextMenu.spell!.id);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full text-left transition-colors duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/60"
                style={{
                  padding: "6px 10px",
                  fontSize: 11,
                  color: contextMenu.spell.isSelected
                    ? theme.colors.state.success
                    : theme.colors.text.primary,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    theme.colors.background.hover)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {contextMenu.spell.isSelected && (
                  <span style={{ color: theme.colors.state.success }}>✓</span>
                )}
                Autocast {contextMenu.spell.name}
              </button>
            )}

            {playerMagicLevel < contextMenu.spell.level && (
              <div
                style={{
                  padding: "6px 10px",
                  fontSize: 10,
                  color: theme.colors.state.danger,
                  fontStyle: "italic",
                }}
              >
                Requires level {contextMenu.spell.level} Magic
              </div>
            )}

            <button
              onClick={() =>
                setContextMenu((prev) => ({ ...prev, visible: false }))
              }
              className="w-full text-left transition-colors duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/60"
              style={{
                padding: "6px 10px",
                fontSize: 11,
                color: theme.colors.text.muted,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                borderTop: `1px solid ${theme.colors.border.default}30`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background =
                  theme.colors.background.hover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              Cancel
            </button>
          </div>,
          document.body,
        )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
