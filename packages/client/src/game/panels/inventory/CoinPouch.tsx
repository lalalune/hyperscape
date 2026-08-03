/**
 * Coin Pouch Component
 *
 * Displays the money pouch balance and handles withdrawal interactions.
 * modern MMORPG-style: click or press Enter/Space to open withdrawal modal.
 *
 * Accessibility:
 * - role="button" for screen reader identification
 * - tabIndex={0} for keyboard focusability
 * - onKeyDown for Enter/Space activation
 * - aria-label for descriptive announcement
 *
 * @see InventoryPanel - Parent component
 * @see CoinAmountModal - Modal for withdrawal amount selection
 */

import { useCallback, useState } from "react";
import { CursorTooltip, useThemeStore } from "@/ui";
import {
  getTooltipMetaStyle,
  getTooltipTitleStyle,
} from "@/ui/core/tooltip/tooltipStyles";

// ============================================================================
// Props Interface
// ============================================================================

interface CoinPouchProps {
  /** Current coin balance in money pouch */
  coins: number;
  /** Callback when user wants to withdraw (opens modal) */
  onWithdrawClick: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function CoinPouch({ coins, onWithdrawClick }: CoinPouchProps) {
  const theme = useThemeStore((s) => s.theme);
  const [hoverState, setHoverState] = useState<{ x: number; y: number } | null>(
    null,
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onWithdrawClick();
      }
    },
    [onWithdrawClick],
  );

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="border rounded flex items-center justify-between py-1 px-2 cursor-pointer hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
        style={{
          background: `linear-gradient(180deg, ${theme.colors.background.panelSecondary} 0%, ${theme.colors.background.panelPrimary} 100%)`,
          borderColor: theme.colors.border.default,
          boxShadow:
            "inset 0 1px 0 rgba(150, 130, 80, 0.2), 0 1px 2px rgba(0, 0, 0, 0.3)",
        }}
        onClick={onWithdrawClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={(e) => {
          setHoverState({ x: e.clientX, y: e.clientY });
        }}
        onMouseMove={(e) => {
          setHoverState({ x: e.clientX, y: e.clientY });
        }}
        onMouseLeave={() => setHoverState(null)}
        aria-label={`Money pouch: ${coins.toLocaleString()} coins. Press Enter to withdraw.`}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-base">💰</span>
          <span
            className="font-medium text-xs"
            style={{ color: theme.colors.text.secondary }}
          >
            Coins
          </span>
        </div>
        <span
          className="font-bold text-xs"
          style={{
            color: theme.colors.accent.secondary,
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
          }}
        >
          {coins.toLocaleString()}
        </span>
      </div>

      {hoverState && (
        <CursorTooltip
          visible={true}
          position={hoverState}
          estimatedSize={{ width: 190, height: 48 }}
          style={{
            zIndex: theme.zIndex.tooltip,
            minWidth: "150px",
          }}
        >
          <div
            style={{
              ...getTooltipTitleStyle(theme),
            }}
          >
            Money pouch: {coins.toLocaleString()} coins
          </div>
          <div
            style={{
              ...getTooltipMetaStyle(theme),
              marginTop: "4px",
            }}
          >
            Click to withdraw coins to inventory
          </div>
        </CursorTooltip>
      )}
    </>
  );
}
