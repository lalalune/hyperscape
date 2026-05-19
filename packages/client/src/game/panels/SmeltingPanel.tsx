/**
 * SmeltingPanel - tile-based-MMORPG-style smelting interface
 *
 * Features:
 * - Shows available bars to smelt based on player's inventory
 * - Displays level requirements, ore requirements
 * - Allows quantity selection (1, 5, 10, All, X)
 * - Sends smelting request to server
 */

import React, { useState } from "react";
import type { ClientWorld } from "../../types";
import { useThemeStore } from "@/ui";
import { formatItemName } from "@/utils";
import {
  getSkillingBadgeStyle,
  getSkillingSelectableStyle,
  SkillingPanelBody,
  SkillingQuantitySelector,
  SkillingSection,
} from "./skilling/SkillingPanelShared";

interface SmeltingBar {
  barItemId: string;
  levelRequired: number;
  primaryOre: string;
  secondaryOre: string | null;
  coalRequired: number;
}

interface SmeltingPanelProps {
  furnaceId: string;
  availableBars: SmeltingBar[];
  world: ClientWorld;
  onClose: () => void;
}

function getItemIcon(itemId: string): string {
  const id = itemId.toLowerCase();
  if (id.includes("bronze")) return "🟤";
  if (id.includes("iron")) return "⚫";
  if (id.includes("steel")) return "⚪";
  if (id.includes("mithril")) return "🔵";
  if (id.includes("adamant")) return "🟢";
  if (id.includes("rune") || id.includes("runite")) return "🔷";
  if (id.includes("gold")) return "🟡";
  if (id.includes("silver")) return "⚪";
  if (id.includes("coal")) return "⬛";
  if (id.includes("ore")) return "🪨";
  return "🔶";
}

const SMELTING_LAST_X_KEY = "smelting_last_x";

export function SmeltingPanel({
  furnaceId,
  availableBars,
  world,
  onClose,
}: SmeltingPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const [selectedBar, setSelectedBar] = useState<SmeltingBar | null>(null);
  const [showQuantityInput, setShowQuantityInput] = useState(false);
  const [customQuantity, setCustomQuantity] = useState("");

  const [lastCustomQuantity, setLastCustomQuantity] = useState(() => {
    try {
      const stored = localStorage.getItem(SMELTING_LAST_X_KEY);
      return stored ? parseInt(stored, 10) || 10 : 10;
    } catch {
      return 10;
    }
  });

  const handleSmelt = (bar: SmeltingBar, qty: number) => {
    if (world.network?.send) {
      world.network.send("processingSmelting", {
        barItemId: bar.barItemId,
        furnaceId,
        quantity: qty,
      });
    }
    onClose();
  };

  const handleCustomQuantitySubmit = () => {
    const qty = customQuantity.trim()
      ? parseInt(customQuantity, 10)
      : lastCustomQuantity;

    if (qty > 0 && selectedBar) {
      if (customQuantity.trim()) {
        try {
          localStorage.setItem(SMELTING_LAST_X_KEY, String(qty));
          setLastCustomQuantity(qty);
        } catch {
          // localStorage may be unavailable
        }
      }
      handleSmelt(selectedBar, qty);
    }
    setShowQuantityInput(false);
    setCustomQuantity("");
  };

  return (
    <SkillingPanelBody
      theme={theme}
      intro="Choose a bar to review its ore mix and smithing requirement before smelting a batch."
      emptyMessage={
        availableBars.length === 0
          ? "You don't have the materials to smelt anything."
          : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <SkillingSection theme={theme}>
          <div
            className="mb-2 text-xs font-medium"
            style={{ color: theme.colors.text.secondary }}
          >
            Select a bar to smelt:
          </div>

          <div className="flex max-h-[20rem] flex-col gap-2 overflow-y-auto pr-1">
            {availableBars.map((bar) => {
              const isSelected = selectedBar?.barItemId === bar.barItemId;
              return (
                <button
                  key={bar.barItemId}
                  onClick={() => setSelectedBar(bar)}
                  className="flex items-center gap-3 rounded-xl border p-3 text-left transition-all"
                  style={getSkillingSelectableStyle(theme, isSelected)}
                >
                  <span className="text-xl">{getItemIcon(bar.barItemId)}</span>

                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm font-semibold"
                      style={{ color: theme.colors.accent.primary }}
                    >
                      {formatItemName(bar.barItemId)}
                    </div>
                    <div
                      className="mt-1 text-[10px]"
                      style={{ color: theme.colors.text.muted }}
                    >
                      {formatItemName(bar.primaryOre)}
                      {bar.secondaryOre &&
                        ` + ${formatItemName(bar.secondaryOre)}`}
                      {bar.coalRequired > 0 && ` + ${bar.coalRequired} Coal`}
                    </div>
                  </div>

                  <div
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={getSkillingBadgeStyle(theme)}
                  >
                    Lv {bar.levelRequired}
                  </div>
                </button>
              );
            })}
          </div>
        </SkillingSection>

        {selectedBar ? (
          <SkillingSection theme={theme}>
            <div className="mb-3 flex items-start gap-3">
              <span className="text-2xl">
                {getItemIcon(selectedBar.barItemId)}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="text-sm font-semibold"
                  style={{ color: theme.colors.accent.primary }}
                >
                  {formatItemName(selectedBar.barItemId)}
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {formatItemName(selectedBar.primaryOre)}
                  {selectedBar.secondaryOre &&
                    ` + ${formatItemName(selectedBar.secondaryOre)}`}
                  {selectedBar.coalRequired > 0 &&
                    ` + ${selectedBar.coalRequired} Coal`}
                </div>
              </div>
            </div>

            <div
              className="mb-2 text-xs font-medium"
              style={{ color: theme.colors.text.secondary }}
            >
              How many?
            </div>

            <SkillingQuantitySelector
              theme={theme}
              showCustomInput={showQuantityInput}
              customQuantity={customQuantity}
              lastCustomQuantity={lastCustomQuantity}
              onCustomQuantityChange={setCustomQuantity}
              onCustomSubmit={handleCustomQuantitySubmit}
              onCancelCustomInput={() => setShowQuantityInput(false)}
              onPresetQuantity={(qty) => handleSmelt(selectedBar, qty)}
              allQuantity={28}
              onShowCustomInput={() => setShowQuantityInput(true)}
            />
          </SkillingSection>
        ) : null}
      </div>
    </SkillingPanelBody>
  );
}
