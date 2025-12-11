/**
 * BankFooter Component
 *
 * Status bar with slot count, Item/Note toggle, and placeholder controls.
 * RS3-style bank footer displaying stats and quick-access toggles.
 */

import { TAB_INDEX_ALL, BANK_THEME } from "../constants";
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
  const placeholderCount = items.filter((i) => i.quantity === 0).length;

  return (
    <div
      className="mx-3 mb-2 mt-1 px-3 py-1.5 flex justify-between items-center text-xs rounded"
      style={{
        background: BANK_THEME.PANEL_BG_DARK,
        border: `1px solid ${BANK_THEME.PANEL_BORDER}`,
        color: BANK_THEME.TEXT_GOLD_DIM,
      }}
    >
      <div className="flex items-center gap-3">
        <span>
          {selectedTab === TAB_INDEX_ALL
            ? `${items.length} items`
            : `${filteredItems.length} in tab`}{" "}
          • {items.length}/{maxSlots} slots
        </span>
        {/* RS3-style: Count items with qty=0 as placeholders */}
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
            border: `1px solid ${BANK_THEME.PANEL_BORDER}`,
          }}
        >
          <button
            onClick={() => onToggleNote(false)}
            className="px-2 py-0.5 text-[10px] font-bold transition-all"
            style={{
              background: !withdrawAsNote
                ? "rgba(139, 69, 19, 0.7)"
                : "rgba(0, 0, 0, 0.3)",
              color: !withdrawAsNote ? "#f2d08a" : "rgba(255,255,255,0.4)",
              borderRight: `1px solid ${BANK_THEME.PANEL_BORDER}`,
            }}
            title="Withdraw items as-is (1 slot per item)"
          >
            Item
          </button>
          <button
            onClick={() => onToggleNote(true)}
            className="px-2 py-0.5 text-[10px] font-bold transition-all"
            style={{
              background: withdrawAsNote
                ? "rgba(139, 69, 19, 0.7)"
                : "rgba(0, 0, 0, 0.3)",
              color: withdrawAsNote ? "#f2d08a" : "rgba(255,255,255,0.4)",
            }}
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
            className="w-3.5 h-3.5 rounded cursor-pointer accent-amber-600"
            style={{
              accentColor: "#d97706",
            }}
          />
          <span
            className="text-[10px] font-medium"
            style={{
              color: alwaysSetPlaceholder ? "#f2d08a" : "rgba(255,255,255,0.5)",
            }}
          >
            Always placeholder
          </span>
        </label>
        {/* Release All Placeholders (RS3-style: items with qty=0) */}
        {placeholderCount > 0 && (
          <button
            onClick={onReleaseAllPlaceholders}
            className="px-2 py-0.5 rounded text-[10px] font-medium transition-all"
            style={{
              background: "rgba(180, 100, 100, 0.5)",
              color: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(180, 100, 100, 0.6)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(180, 100, 100, 0.7)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(180, 100, 100, 0.5)";
            }}
            title="Release all placeholders"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
