/**
 * BankFooter Component
 *
 * Status bar with slot count, Item/Note toggle, and placeholder controls.
 * modern MMORPG-style bank footer displaying stats and quick-access toggles.
 */

import { useState } from "react";
import { useThemeStore } from "@/ui";
import { getInteractiveTileStyle, getPanelInsetStyle } from "@/ui/theme/themes";
import { TAB_INDEX_ALL } from "../constants";
import type { BankItem } from "../types";

export interface BankFooterProps {
  items: BankItem[];
  filteredItems: BankItem[];
  maxSlots: number;
  selectedTab: number;

  withdrawAsNote: boolean;
  onToggleNote: (value: boolean) => void;

  alwaysSetPlaceholder: boolean;
  onTogglePlaceholder: () => void;
  onReleaseAllPlaceholders: () => void;
}

export function BankFooter({
  items,
  filteredItems,
  maxSlots,
  selectedTab,
  withdrawAsNote,
  onToggleNote,
  alwaysSetPlaceholder,
  onTogglePlaceholder,
  onReleaseAllPlaceholders,
}: BankFooterProps) {
  const theme = useThemeStore((s) => s.theme);
  const placeholderCount = items.filter((i) => i.quantity === 0).length;
  const [hoveredNoteMode, setHoveredNoteMode] = useState<
    "item" | "note" | null
  >(null);
  const [isClearAllHovered, setIsClearAllHovered] = useState(false);

  return (
    <div
      className="mx-3 mb-2 mt-1 px-3 py-1.5 flex justify-between items-center text-xs rounded"
      style={{
        ...getPanelInsetStyle(theme, {
          emphasis: "strong",
          radius: theme.borderRadius.md,
        }),
        color: theme.colors.text.secondary,
      }}
    >
      <div className="flex items-center gap-3">
        <span>
          {selectedTab === TAB_INDEX_ALL
            ? `${items.length} items`
            : `${filteredItems.length} in tab`}{" "}
          • {items.length}/{maxSlots} slots
        </span>
        {/* modern MMORPG-style: Count items with qty=0 as placeholders */}
        {placeholderCount > 0 && (
          <span style={{ opacity: 0.6 }}>
            ({placeholderCount} placeholder
            {placeholderCount !== 1 ? "s" : ""})
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* BANK NOTE SYSTEM: Item/Note Toggle Buttons */}
        <div
          className="flex rounded overflow-hidden"
          style={{
            border: `1px solid ${theme.colors.border.decorative}`,
            background: String(
              getPanelInsetStyle(theme, { radius: theme.borderRadius.sm })
                .background,
            ),
          }}
        >
          <button
            onClick={() => onToggleNote(false)}
            className="px-2 py-0.5 text-[10px] font-bold transition-all"
            style={{
              background: !withdrawAsNote
                ? String(
                    getInteractiveTileStyle(theme, {
                      active: true,
                      radius: theme.borderRadius.sm,
                    }).background,
                  )
                : hoveredNoteMode === "item"
                  ? String(
                      getInteractiveTileStyle(theme, {
                        hovered: true,
                        radius: theme.borderRadius.sm,
                      }).background,
                    )
                  : "transparent",
              color: !withdrawAsNote
                ? theme.colors.accent.primary
                : hoveredNoteMode === "item"
                  ? theme.colors.text.primary
                  : theme.colors.text.muted,
              borderRight: `1px solid ${theme.colors.border.decorative}`,
            }}
            onMouseEnter={() => setHoveredNoteMode("item")}
            onMouseLeave={() =>
              setHoveredNoteMode((prev) => (prev === "item" ? null : prev))
            }
            title="Withdraw items as-is (1 slot per item)"
          >
            Item
          </button>
          <button
            onClick={() => onToggleNote(true)}
            className="px-2 py-0.5 text-[10px] font-bold transition-all"
            style={{
              background: withdrawAsNote
                ? String(
                    getInteractiveTileStyle(theme, {
                      active: true,
                      radius: theme.borderRadius.sm,
                    }).background,
                  )
                : hoveredNoteMode === "note"
                  ? String(
                      getInteractiveTileStyle(theme, {
                        hovered: true,
                        radius: theme.borderRadius.sm,
                      }).background,
                    )
                  : "transparent",
              color: withdrawAsNote
                ? theme.colors.accent.primary
                : hoveredNoteMode === "note"
                  ? theme.colors.text.primary
                  : theme.colors.text.muted,
            }}
            onMouseEnter={() => setHoveredNoteMode("note")}
            onMouseLeave={() =>
              setHoveredNoteMode((prev) => (prev === "note" ? null : prev))
            }
            title="Withdraw items as bank notes (stackable, all fit in 1 slot)"
          >
            Note
          </button>
        </div>
        {/* Always Set Placeholder Checkbox */}
        <label
          className="flex items-center gap-1.5 cursor-pointer select-none"
          title={
            alwaysSetPlaceholder
              ? "Placeholders ON: Withdrawing all creates placeholder"
              : "Placeholders OFF: Withdrawing all removes slot"
          }
        >
          <input
            type="checkbox"
            checked={alwaysSetPlaceholder}
            onChange={onTogglePlaceholder}
            className="w-3.5 h-3.5 rounded cursor-pointer"
            style={{
              accentColor: theme.colors.accent.primary,
            }}
          />
          <span
            className="text-[10px] font-medium"
            style={{
              color: alwaysSetPlaceholder
                ? theme.colors.accent.primary
                : theme.colors.text.muted,
            }}
          >
            Always placeholder
          </span>
        </label>
        {/* Release All Placeholders (modern MMORPG-style: items with qty=0) */}
        {placeholderCount > 0 && (
          <button
            onClick={onReleaseAllPlaceholders}
            className="px-2 py-0.5 rounded text-[10px] font-medium transition-all"
            style={{
              ...getInteractiveTileStyle(theme, {
                active: !isClearAllHovered,
                hovered: isClearAllHovered,
                accentColor: theme.colors.state.danger,
                radius: theme.borderRadius.sm,
              }),
              color: theme.colors.text.primary,
            }}
            onMouseEnter={() => setIsClearAllHovered(true)}
            onMouseLeave={() => setIsClearAllHovered(false)}
            title="Release all placeholders"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
