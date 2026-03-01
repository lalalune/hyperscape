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
import {
  calculateCursorTooltipPosition,
  useThemeStore,
  useMobileLayout,
} from "@/ui";
import { zIndex } from "../../constants";
import { useTooltipSize } from "../../hooks";
import type { PlayerStats, ClientWorld } from "../../types";
import { spellService, EventType, type Spell } from "@hyperscape/shared";

// Spell panel layout constants
const SPELL_ICON_SIZE = 40;
const SPELL_GAP = 4;
const PANEL_PADDING = 8;
const GRID_PADDING = 6;

// Mobile constants
const MOBILE_SPELL_ICON_SIZE = 52;
const MOBILE_SPELL_GAP = 6;

/**
 * Calculate number of columns based on container width
 */
function calculateColumns(containerWidth: number, isMobile: boolean): number {
  const iconSize = isMobile ? MOBILE_SPELL_ICON_SIZE : SPELL_ICON_SIZE;
  const gap = isMobile ? MOBILE_SPELL_GAP : SPELL_GAP;
  const availableWidth = containerWidth - PANEL_PADDING * 2 - GRID_PADDING * 2;
  const colWidth = iconSize + gap;
  const maxCols = Math.floor((availableWidth + gap) / colWidth);
  return Math.max(2, Math.min(4, maxCols));
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

  const iconSize = isMobile ? MOBILE_SPELL_ICON_SIZE : SPELL_ICON_SIZE;

  const buttonStyle = useMemo(
    (): React.CSSProperties => ({
      width: iconSize,
      height: iconSize,
      padding: 0,
      background: isSelected
        ? `radial-gradient(ellipse at center, ${getElementColor(spell.element)}4D 0%, ${theme.colors.slot.selected} 70%)`
        : theme.colors.slot.filled,
      border: isSelected
        ? `2px solid ${getElementColor(spell.element)}B3`
        : `1px solid ${theme.colors.border.default}40`,
      borderRadius: isMobile ? 6 : 4,
      cursor: isUnlocked ? "pointer" : "not-allowed",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      transition: "all 0.15s ease",
      boxShadow: isSelected
        ? `0 0 ${isMobile ? 14 : 10}px ${getElementColor(spell.element)}80, inset 0 0 ${isMobile ? 18 : 12}px ${getElementColor(spell.element)}33`
        : "inset 0 1px 2px rgba(0, 0, 0, 0.4)",
      opacity: isUnlocked ? 1 : 0.5,
    }),
    [isSelected, isUnlocked, theme, iconSize, isMobile, spell.element],
  );

  return (
    <button
      onClick={isUnlocked ? onClick : undefined}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
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
  const spellTooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const playerMagicLevel = stats?.skills?.magic?.level ?? 1;

  const spellTooltipSize = useTooltipSize(hoveredSpell, spellTooltipRef, {
    width: 220,
    height: 150,
  });

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
        background: "transparent",
        padding: PANEL_PADDING,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: shouldUseMobileUI ? "6px 8px" : "4px 8px",
          marginBottom: 6,
          background: theme.colors.slot.filled,
          borderRadius: 4,
          border: `1px solid ${theme.colors.border.default}30`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: shouldUseMobileUI ? 18 : 16 }}>🔮</span>
          <div>
            <div
              style={{
                fontSize: shouldUseMobileUI ? 10 : 9,
                color: theme.colors.text.muted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Spellbook
            </div>
            <div
              style={{
                fontSize: shouldUseMobileUI ? 14 : 12,
                fontWeight: 600,
                color: theme.colors.text.primary,
              }}
            >
              Magic Level: {playerMagicLevel}
            </div>
          </div>
        </div>
      </div>

      {/* Selected spell indicator */}
      {selectedSpellId && (
        <div
          style={{
            padding: shouldUseMobileUI ? "6px 8px" : "4px 8px",
            marginBottom: 6,
            background: `${getElementColor(spells.find((s) => s.id === selectedSpellId)?.element || "air")}20`,
            borderRadius: 4,
            border: `1px solid ${getElementColor(spells.find((s) => s.id === selectedSpellId)?.element || "air")}40`,
            fontSize: shouldUseMobileUI ? 11 : 10,
            color: theme.colors.text.secondary,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            Autocast:{" "}
            <span style={{ color: theme.colors.text.primary, fontWeight: 600 }}>
              {spells.find((s) => s.id === selectedSpellId)?.name}
            </span>
          </span>
          <button
            onClick={() => selectSpell(selectedSpellId)}
            style={{
              background: "transparent",
              border: "none",
              color: theme.colors.state.danger,
              cursor: "pointer",
              fontSize: shouldUseMobileUI ? 11 : 10,
              padding: "2px 6px",
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Spell Grid */}
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
            display: "grid",
            gridTemplateColumns: `repeat(${gridColumns}, ${iconSize}px)`,
            gap: gap,
            padding: GRID_PADDING,
            background: theme.colors.slot.empty,
            borderRadius: 4,
            border: `1px solid ${theme.colors.border.default}30`,
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

      {/* Spell Tooltip */}
      {hoveredSpell &&
        createPortal(
          (() => {
            const tooltipSize = {
              width: spellTooltipSize.width || 220,
              height: spellTooltipSize.height || 150,
            };
            const { left, top } = calculateCursorTooltipPosition(
              mousePos,
              tooltipSize,
            );
            const isUnlocked = playerMagicLevel >= hoveredSpell.level;

            return (
              <div
                ref={spellTooltipRef}
                className="fixed pointer-events-none"
                style={{
                  left,
                  top,
                  zIndex: zIndex.tooltip,
                  background: `linear-gradient(180deg, ${theme.colors.background.secondary} 0%, ${theme.colors.background.primary} 100%)`,
                  border: `1px solid ${getElementColor(hoveredSpell.element)}50`,
                  borderRadius: 6,
                  padding: "12px 14px",
                  boxShadow: theme.shadows.lg,
                  minWidth: 200,
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 28 }}>
                    {ELEMENT_ICONS[hoveredSpell.element] || "✨"}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: getElementColor(hoveredSpell.element),
                      }}
                    >
                      {hoveredSpell.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: theme.colors.text.muted,
                      }}
                    >
                      Level {hoveredSpell.level} Magic
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                    fontSize: 11,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ color: theme.colors.text.muted }}>
                    Max Hit:{" "}
                    <span style={{ color: theme.colors.state.danger }}>
                      {hoveredSpell.baseMaxHit}
                    </span>
                  </div>
                  <div style={{ color: theme.colors.text.muted }}>
                    XP:{" "}
                    <span style={{ color: theme.colors.state.success }}>
                      {hoveredSpell.baseXp}
                    </span>
                  </div>
                </div>

                {/* Rune cost */}
                <div
                  style={{
                    fontSize: 10,
                    color: theme.colors.text.muted,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ marginBottom: 4, fontWeight: 600 }}>
                    Rune Cost:
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {hoveredSpell.runes.map((rune, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: theme.colors.slot.filled,
                          padding: "2px 6px",
                          borderRadius: 3,
                          color: theme.colors.text.secondary,
                        }}
                      >
                        {rune.quantity}x{" "}
                        {rune.runeId.replace("_rune", "").replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Status */}
                {!isUnlocked && (
                  <div
                    style={{
                      padding: "5px 10px",
                      background: `${theme.colors.state.danger}26`,
                      borderRadius: 4,
                      fontSize: 11,
                      color: theme.colors.state.danger,
                      textAlign: "center",
                    }}
                  >
                    Requires level {hoveredSpell.level} Magic
                  </div>
                )}
                {hoveredSpell.isSelected && (
                  <div
                    style={{
                      padding: "5px 10px",
                      background: `${theme.colors.state.success}26`,
                      borderRadius: 4,
                      fontSize: 11,
                      color: theme.colors.state.success,
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    Currently Selected for Autocast
                  </div>
                )}
              </div>
            );
          })(),
          document.body,
        )}

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
              background: `linear-gradient(180deg, ${theme.colors.background.tertiary} 0%, ${theme.colors.background.secondary} 100%)`,
              border: `1px solid ${theme.colors.border.default}`,
              borderRadius: 4,
              boxShadow: theme.shadows.lg,
              minWidth: 140,
              overflow: "hidden",
            }}
          >
            {/* Menu Header */}
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

            {/* Autocast option */}
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

            {/* Locked message */}
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

            {/* Cancel option */}
            <button
              onClick={() => {
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
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

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
