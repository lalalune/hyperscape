/**
 * CraftingPanel - tile-based-MMORPG-style crafting interface
 *
 * Features:
 * - Shows available items to craft based on player's materials
 * - Groups recipes by category (leather, studded, dragonhide, jewelry, gem cutting)
 * - Displays level requirements, material requirements, XP
 * - Allows quantity selection (1, 5, 10, All, X)
 * - Sends crafting request to server
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

interface CraftingRecipe {
  output: string;
  name: string;
  category: string;
  inputs: Array<{ item: string; amount: number }>;
  tools: string[];
  level: number;
  xp: number;
  meetsLevel: boolean;
  hasInputs: boolean;
}

interface CraftingPanelProps {
  availableRecipes: CraftingRecipe[];
  world: ClientWorld;
  onClose: () => void;
  station?: string;
}

function getItemIcon(output: string, category: string): string {
  const id = output.toLowerCase();

  if (id.includes("leather") && !id.includes("dragon")) return "🧥";
  if (id.includes("vambraces") || id.includes("vambrace")) return "🧤";
  if (id.includes("chaps")) return "👖";
  if (id.includes("coif")) return "⛑️";
  if (id.includes("cowl")) return "⛑️";
  if (id.includes("body")) return "🛡️";
  if (
    category === "dragonhide" ||
    id.includes("dhide") ||
    id.includes("dragon")
  )
    return "🐉";
  if (id.includes("studded")) return "🔩";
  if (id.includes("ring")) return "💍";
  if (id.includes("necklace")) return "📿";
  if (id.includes("amulet")) return "📿";
  if (id.includes("bracelet")) return "⌚";
  if (id.includes("sapphire")) return "💎";
  if (id.includes("emerald")) return "💚";
  if (id.includes("ruby")) return "❤️";
  if (id.includes("diamond")) return "💠";
  if (category === "gem_cutting") return "💎";

  return "🧵";
}

const CATEGORY_ORDER = [
  "leather",
  "studded",
  "dragonhide",
  "jewelry",
  "gem_cutting",
];

const CATEGORY_LABELS: Record<string, string> = {
  leather: "Leather",
  studded: "Studded",
  dragonhide: "Dragonhide",
  jewelry: "Jewelry",
  gem_cutting: "Gem Cutting",
};

const CRAFTING_LAST_X_KEY = "crafting_last_x";

export function CraftingPanel({
  availableRecipes,
  world,
  onClose,
}: CraftingPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe | null>(
    null,
  );
  const [showQuantityInput, setShowQuantityInput] = useState(false);
  const [customQuantity, setCustomQuantity] = useState("");

  const [lastCustomQuantity, setLastCustomQuantity] = useState(() => {
    try {
      const stored = localStorage.getItem(CRAFTING_LAST_X_KEY);
      return stored ? parseInt(stored, 10) || 10 : 10;
    } catch {
      return 10;
    }
  });

  const groupedRecipes = useMemo(() => {
    const groups: Record<string, CraftingRecipe[]> = {};

    for (const recipe of availableRecipes) {
      const category = recipe.category || "misc";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(recipe);
    }

    const sorted: Array<[string, CraftingRecipe[]]> = [];
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

  const handleCraft = (recipe: CraftingRecipe, qty: number) => {
    if (world.network?.send) {
      world.network.send("processingCrafting", {
        recipeId: recipe.output,
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
          localStorage.setItem(CRAFTING_LAST_X_KEY, String(qty));
          setLastCustomQuantity(qty);
        } catch {
          // localStorage may be unavailable
        }
      }
      handleCraft(selectedRecipe, qty);
    }
    setShowQuantityInput(false);
    setCustomQuantity("");
  };

  return (
    <SkillingPanelBody
      theme={theme}
      intro="Browse available recipes by category, then inspect the exact inputs and crafting XP before starting a batch."
      emptyMessage={
        availableRecipes.length === 0
          ? "You don't have the materials to craft anything."
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
                const isSelected = selectedRecipe?.output === recipe.output;
                const canCraft = recipe.meetsLevel && recipe.hasInputs;

                return (
                  <button
                    key={recipe.output}
                    onClick={() => setSelectedRecipe(recipe)}
                    className="flex items-center gap-3 rounded-xl border p-3 text-left transition-all"
                    style={getSkillingSelectableStyle(
                      theme,
                      isSelected,
                      !canCraft,
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
                        {recipe.name || formatItemName(recipe.output)}
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
                  {selectedRecipe.name || formatItemName(selectedRecipe.output)}
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
                    Requires Crafting level {selectedRecipe.level}
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
              onPresetQuantity={(qty) => handleCraft(selectedRecipe, qty)}
              allQuantity={-1}
              onShowCustomInput={() => setShowQuantityInput(true)}
            />
          </SkillingSection>
        ) : null}
      </div>
    </SkillingPanelBody>
  );
}
