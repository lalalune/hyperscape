/**
 * TanningPanel - tile-based-MMORPG-style tanning interface
 *
 * Features:
 * - Shows available hides to tan based on player's inventory
 * - Displays cost per hide and available quantity
 * - Allows quantity selection (1, 5, 10, All, X)
 * - Sends tanning request to server
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

interface TanningRecipe {
  input: string;
  output: string;
  cost: number;
  name: string;
  hasHide: boolean;
  hideCount: number;
}

interface TanningPanelProps {
  availableRecipes: TanningRecipe[];
  world: ClientWorld;
  onClose: () => void;
}

function getHideIcon(input: string): string {
  const id = input.toLowerCase();
  if (id.includes("dragon")) return "🐉";
  if (id.includes("cowhide")) return "🐄";
  return "🧶";
}

const TANNING_LAST_X_KEY = "tanning_last_x";

export function TanningPanel({
  availableRecipes,
  world,
  onClose,
}: TanningPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const [selectedRecipe, setSelectedRecipe] = useState<TanningRecipe | null>(
    null,
  );
  const [showQuantityInput, setShowQuantityInput] = useState(false);
  const [customQuantity, setCustomQuantity] = useState("");

  const [lastCustomQuantity, setLastCustomQuantity] = useState(() => {
    try {
      const stored = localStorage.getItem(TANNING_LAST_X_KEY);
      return stored ? parseInt(stored, 10) || 10 : 10;
    } catch {
      return 10;
    }
  });

  const handleTan = (recipe: TanningRecipe, qty: number) => {
    if (world.network?.send) {
      world.network.send("processingTanning", {
        inputItemId: recipe.input,
        quantity: qty,
      });
    }
    onClose();
  };

  const handleCustomQuantitySubmit = () => {
    const qty = customQuantity.trim()
      ? parseInt(customQuantity, 10)
      : lastCustomQuantity;

    if (qty > 0 && selectedRecipe) {
      if (customQuantity.trim()) {
        try {
          localStorage.setItem(TANNING_LAST_X_KEY, String(qty));
          setLastCustomQuantity(qty);
        } catch {
          // localStorage may be unavailable
        }
      }
      handleTan(selectedRecipe, qty);
    }
    setShowQuantityInput(false);
    setCustomQuantity("");
  };

  return (
    <SkillingPanelBody
      theme={theme}
      intro="Select a hide to see its leather result, cost, and how many you can process from your current inventory."
      emptyMessage={
        availableRecipes.length === 0
          ? "No hides available for tanning."
          : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <SkillingSection theme={theme}>
          <div
            className="mb-2 text-xs font-medium"
            style={{ color: theme.colors.text.secondary }}
          >
            Select a hide to tan:
          </div>

          <div className="flex max-h-[20rem] flex-col gap-2 overflow-y-auto pr-1">
            {availableRecipes.map((recipe) => {
              const isSelected = selectedRecipe?.input === recipe.input;
              return (
                <button
                  key={recipe.input}
                  onClick={() => setSelectedRecipe(recipe)}
                  className="flex items-center gap-3 rounded-xl border p-3 text-left transition-all"
                  style={getSkillingSelectableStyle(
                    theme,
                    isSelected,
                    !recipe.hasHide,
                  )}
                >
                  <span className="text-xl">{getHideIcon(recipe.input)}</span>

                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm font-semibold"
                      style={{ color: theme.colors.accent.primary }}
                    >
                      {recipe.name || formatItemName(recipe.output)}
                    </div>
                    <div
                      className="mt-1 text-[10px]"
                      style={{ color: theme.colors.text.muted }}
                    >
                      {formatItemName(recipe.input)}
                      {recipe.hideCount > 0 &&
                        ` (${recipe.hideCount} in inventory)`}
                    </div>
                  </div>

                  <div
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={getSkillingBadgeStyle(theme)}
                  >
                    {recipe.cost} gp
                  </div>
                </button>
              );
            })}
          </div>
        </SkillingSection>

        {selectedRecipe ? (
          <SkillingSection theme={theme}>
            <div className="mb-3 flex items-start gap-3">
              <span className="text-2xl">
                {getHideIcon(selectedRecipe.input)}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="text-sm font-semibold"
                  style={{ color: theme.colors.accent.primary }}
                >
                  {selectedRecipe.name || formatItemName(selectedRecipe.output)}
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {formatItemName(selectedRecipe.input)}
                  {selectedRecipe.hideCount > 0 &&
                    ` (${selectedRecipe.hideCount} in inventory)`}
                </div>
              </div>
              <div
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={getSkillingBadgeStyle(theme)}
              >
                {selectedRecipe.cost} gp
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
              onPresetQuantity={(qty) => handleTan(selectedRecipe, qty)}
              allQuantity={-1}
              onShowCustomInput={() => setShowQuantityInput(true)}
            />
          </SkillingSection>
        ) : null}
      </div>
    </SkillingPanelBody>
  );
}
