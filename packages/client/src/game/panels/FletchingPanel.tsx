/**
 * FletchingPanel - tile-based-MMORPG-style fletching interface
 *
 * Features:
 * - Shows available items to fletch based on player's materials
 * - Groups recipes by category (arrow_shafts, shortbows, longbows, stringing, arrows)
 * - Displays output quantity for multi-output recipes (e.g., "Arrow shafts (x15)")
 * - Allows quantity selection (1, 5, 10, All, X)
 * - Auto-selects when only one recipe is available
 * - Sends fletching request to server
 */

import React, { useEffect, useMemo, useState } from "react";
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

interface FletchingRecipe {
  recipeId: string;
  output: string;
  name: string;
  category: string;
  outputQuantity: number;
  inputs: Array<{ item: string; amount: number }>;
  tools: string[];
  level: number;
  xp: number;
  meetsLevel: boolean;
  hasInputs: boolean;
}

interface FletchingPanelProps {
  availableRecipes: FletchingRecipe[];
  world: ClientWorld;
  onClose: () => void;
}

function getItemIcon(output: string, category: string): string {
  const id = output.toLowerCase();

  if (category === "arrow_shafts" || id.includes("arrow_shaft")) return "🪵";
  if (category === "shortbows" || id.includes("shortbow")) return "🏹";
  if (category === "longbows" || id.includes("longbow")) return "🎯";
  if (category === "stringing") return "🧵";
  if (category === "arrows" || id.includes("arrow")) return "➳";

  return "🪓";
}

const CATEGORY_ORDER = [
  "arrow_shafts",
  "shortbows",
  "longbows",
  "stringing",
  "arrows",
];

const CATEGORY_LABELS: Record<string, string> = {
  arrow_shafts: "Arrow Shafts",
  shortbows: "Shortbows",
  longbows: "Longbows",
  stringing: "Stringing",
  arrows: "Arrows",
};

const FLETCHING_LAST_X_KEY = "fletching_last_x";

export function FletchingPanel({
  availableRecipes,
  world,
  onClose,
}: FletchingPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const [selectedRecipe, setSelectedRecipe] = useState<FletchingRecipe | null>(
    null,
  );
  const [showQuantityInput, setShowQuantityInput] = useState(false);
  const [customQuantity, setCustomQuantity] = useState("");

  const [lastCustomQuantity, setLastCustomQuantity] = useState(() => {
    try {
      const stored = localStorage.getItem(FLETCHING_LAST_X_KEY);
      return stored ? parseInt(stored, 10) || 10 : 10;
    } catch {
      return 10;
    }
  });

  const groupedRecipes = useMemo(() => {
    const groups: Record<string, FletchingRecipe[]> = {};

    for (const recipe of availableRecipes) {
      const category = recipe.category || "misc";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(recipe);
    }

    const sorted: Array<[string, FletchingRecipe[]]> = [];
    for (const category of CATEGORY_ORDER) {
      if (groups[category]) {
        sorted.push([category, groups[category]]);
      }
    }

    for (const category of Object.keys(groups)) {
      if (!CATEGORY_ORDER.includes(category)) {
        sorted.push([category, groups[category]]);
      }
    }

    return sorted;
  }, [availableRecipes]);

  useEffect(() => {
    if (availableRecipes.length === 1) {
      setSelectedRecipe(availableRecipes[0]);
    }
  }, [availableRecipes]);

  const handleFletch = (recipe: FletchingRecipe, qty: number) => {
    if (world.network?.send) {
      world.network.send("processingFletching", {
        recipeId: recipe.recipeId,
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
          localStorage.setItem(FLETCHING_LAST_X_KEY, String(qty));
          setLastCustomQuantity(qty);
        } catch {
          // localStorage may be unavailable
        }
      }
      handleFletch(selectedRecipe, qty);
    }
    setShowQuantityInput(false);
    setCustomQuantity("");
  };

  const getDisplayName = (recipe: FletchingRecipe): string => {
    const name = recipe.name || formatItemName(recipe.output);
    return recipe.outputQuantity > 1
      ? `${name} (x${recipe.outputQuantity})`
      : name;
  };

  return (
    <SkillingPanelBody
      theme={theme}
      intro="Review each fletching recipe by category, including multi-output results and required materials, before starting."
      emptyMessage={
        availableRecipes.length === 0
          ? "You don't have the materials to fletch anything."
          : undefined
      }
    >
      <div className="flex flex-col gap-3">
        {groupedRecipes.map(([category, recipes]) => (
          <SkillingSection key={category} theme={theme}>
            <div
              className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: theme.colors.text.muted }}
            >
              {CATEGORY_LABELS[category] || category}
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {recipes.map((recipe) => {
                const isSelected = selectedRecipe?.recipeId === recipe.recipeId;
                const canFletch = recipe.meetsLevel && recipe.hasInputs;

                return (
                  <button
                    key={recipe.recipeId}
                    onClick={() => setSelectedRecipe(recipe)}
                    className="flex items-center gap-3 rounded-xl border p-3 text-left transition-all"
                    style={getSkillingSelectableStyle(
                      theme,
                      isSelected,
                      !canFletch,
                    )}
                  >
                    <span className="text-xl">
                      {getItemIcon(recipe.output, recipe.category)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-sm font-semibold"
                        style={{
                          color: recipe.meetsLevel
                            ? theme.colors.accent.primary
                            : theme.colors.state.danger,
                        }}
                      >
                        {getDisplayName(recipe)}
                      </div>
                      <div
                        className="mt-1 flex items-center gap-1 text-[10px]"
                        style={{ color: theme.colors.text.muted }}
                      >
                        <span>Lv {recipe.level}</span>
                        <span className="mx-1">•</span>
                        <span>{recipe.xp} XP</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </SkillingSection>
        ))}

        {selectedRecipe ? (
          <SkillingSection theme={theme}>
            <div className="mb-3 flex items-start gap-3">
              <span className="text-2xl">
                {getItemIcon(selectedRecipe.output, selectedRecipe.category)}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="text-sm font-semibold"
                  style={{ color: theme.colors.accent.primary }}
                >
                  {getDisplayName(selectedRecipe)}
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {selectedRecipe.inputs
                    .map(
                      (input) =>
                        `${input.amount}x ${formatItemName(input.item)}`,
                    )
                    .join(", ")}
                </div>
                {!selectedRecipe.meetsLevel ? (
                  <div
                    className="mt-1 text-[10px]"
                    style={{ color: theme.colors.state.danger }}
                  >
                    Requires Fletching level {selectedRecipe.level}
                  </div>
                ) : null}
              </div>
              <div
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={getSkillingBadgeStyle(theme)}
              >
                {selectedRecipe.xp} XP
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
              onPresetQuantity={(qty) => handleFletch(selectedRecipe, qty)}
              allQuantity={-1}
              onShowCustomInput={() => setShowQuantityInput(true)}
            />
          </SkillingSection>
        ) : null}
      </div>
    </SkillingPanelBody>
  );
}
