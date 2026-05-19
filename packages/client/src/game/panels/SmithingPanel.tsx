/**
 * SmithingPanel - tile-based-MMORPG-style smithing interface
 *
 * Features:
 * - Shows available items to smith based on player's bars
 * - Displays level requirements, bar requirements, XP
 * - Groups items by category (weapons, armor, etc.)
 * - Allows quantity selection (1, 5, 10, All, X)
 * - Sends smithing request to server
 */

import React, { useState, useMemo } from "react";
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

interface SmithingRecipe {
  itemId: string;
  name: string;
  barType: string;
  barsRequired: number;
  levelRequired: number;
  xp: number;
  category: string;
  outputQuantity?: number;
}

interface SmithingPanelProps {
  anvilId: string;
  availableRecipes: SmithingRecipe[];
  world: ClientWorld;
  onClose: () => void;
}

/**
 * Get icon for item type
 */
function getItemIcon(itemId: string, category: string): string {
  const id = itemId.toLowerCase();

  // Weapons
  if (category === "weapons" || id.includes("sword") || id.includes("scimitar"))
    return "⚔️";
  if (id.includes("dagger")) return "🗡️";
  if (id.includes("mace")) return "🔨";
  if (id.includes("axe") && !id.includes("pickaxe")) return "🪓";
  if (id.includes("warhammer")) return "⚒️";

  // Armor
  if (
    category === "armor" ||
    id.includes("platebody") ||
    id.includes("chainbody")
  )
    return "🛡️";
  if (id.includes("helmet") || id.includes("helm") || id.includes("full_helm"))
    return "⛑️";
  if (id.includes("platelegs") || id.includes("plateskirt")) return "👖";
  if (
    id.includes("shield") ||
    id.includes("sq_shield") ||
    id.includes("kiteshield")
  )
    return "🛡️";
  if (id.includes("boots")) return "👢";
  if (id.includes("gauntlets") || id.includes("gloves")) return "🧤";

  // Tools
  if (id.includes("pickaxe")) return "⛏️";
  if (id.includes("hatchet")) return "🪓";

  // Misc
  if (id.includes("nails")) return "📍";
  if (id.includes("bar")) return "🔶";
  if (id.includes("arrowtips") || id.includes("dart")) return "➤";
  if (id.includes("knife")) return "🔪";

  return "🔨";
}

/**
 * Get bar type icon
 */
function getBarIcon(barType: string): string {
  const type = barType.toLowerCase();
  if (type.includes("bronze")) return "🟤";
  if (type.includes("iron")) return "⚫";
  if (type.includes("steel")) return "⚪";
  if (type.includes("mithril")) return "🔵";
  if (type.includes("adamant")) return "🟢";
  if (type.includes("rune") || type.includes("runite")) return "🔷";
  return "🔶";
}

/**
 * Category order for display
 */
const CATEGORY_ORDER = ["weapons", "armor", "tools", "arrowtips", "misc"];

/** localStorage key for Make X memory */
const SMITHING_LAST_X_KEY = "smithing_last_x";

export function SmithingPanel({
  anvilId,
  availableRecipes,
  world,
  onClose,
}: SmithingPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const [selectedRecipe, setSelectedRecipe] = useState<SmithingRecipe | null>(
    null,
  );
  const [showQuantityInput, setShowQuantityInput] = useState(false);
  const [customQuantity, setCustomQuantity] = useState("");

  // Make X memory - remember last custom quantity (tile-based MMORPG feature)
  const [lastCustomQuantity, setLastCustomQuantity] = useState(() => {
    try {
      const stored = localStorage.getItem(SMITHING_LAST_X_KEY);
      return stored ? parseInt(stored, 10) || 10 : 10;
    } catch {
      return 10;
    }
  });

  // Group recipes by category
  const groupedRecipes = useMemo(() => {
    const groups: Record<string, SmithingRecipe[]> = {};

    for (const recipe of availableRecipes) {
      const category = recipe.category || "misc";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(recipe);
    }

    // Sort by category order
    const sorted: Array<[string, SmithingRecipe[]]> = [];
    for (const cat of CATEGORY_ORDER) {
      if (groups[cat]) {
        sorted.push([cat, groups[cat]]);
      }
    }
    // Add any categories not in the predefined order
    for (const cat of Object.keys(groups)) {
      if (!CATEGORY_ORDER.includes(cat)) {
        sorted.push([cat, groups[cat]]);
      }
    }

    return sorted;
  }, [availableRecipes]);

  const handleSmith = (recipe: SmithingRecipe, qty: number) => {
    if (world.network?.send) {
      world.network.send("processingSmithing", {
        recipeId: recipe.itemId,
        anvilId,
        quantity: qty,
      });
    }
    onClose();
  };

  const handleCustomQuantitySubmit = () => {
    // Use entered quantity, or fall back to last X if empty (tile-based MMORPG behavior)
    const qty = customQuantity.trim()
      ? parseInt(customQuantity, 10)
      : lastCustomQuantity;

    if (qty > 0 && selectedRecipe) {
      // Save to localStorage for Make X memory (only if custom value entered)
      if (customQuantity.trim()) {
        try {
          localStorage.setItem(SMITHING_LAST_X_KEY, String(qty));
          setLastCustomQuantity(qty);
        } catch {
          // localStorage may be unavailable
        }
      }
      handleSmith(selectedRecipe, qty);
    }
    setShowQuantityInput(false);
    setCustomQuantity("");
  };

  return (
    <SkillingPanelBody
      theme={theme}
      intro="Choose an anvil recipe to preview its bar cost, smithing level, and XP before starting a batch."
      emptyMessage={
        availableRecipes.length === 0
          ? "You don't have the bars to smith anything."
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
              {category}
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {recipes.map((recipe) => {
                const isSelected = selectedRecipe?.itemId === recipe.itemId;
                return (
                  <button
                    key={recipe.itemId}
                    onClick={() => setSelectedRecipe(recipe)}
                    className="flex items-center gap-3 rounded-xl border p-3 text-left transition-all"
                    style={getSkillingSelectableStyle(theme, isSelected)}
                  >
                    <span className="text-xl">
                      {getItemIcon(recipe.itemId, recipe.category)}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div
                        className="truncate text-sm font-semibold"
                        style={{ color: theme.colors.accent.primary }}
                      >
                        {recipe.name || formatItemName(recipe.itemId)}
                        {recipe.outputQuantity && recipe.outputQuantity > 1
                          ? ` (x${recipe.outputQuantity})`
                          : ""}
                      </div>
                      <div
                        className="mt-1 flex items-center gap-1 text-[10px]"
                        style={{ color: theme.colors.text.muted }}
                      >
                        <span>{getBarIcon(recipe.barType)}</span>
                        <span>×{recipe.barsRequired}</span>
                        <span className="mx-1">•</span>
                        <span>Lv {recipe.levelRequired}</span>
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
                {getItemIcon(selectedRecipe.itemId, selectedRecipe.category)}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="text-sm font-semibold"
                  style={{ color: theme.colors.accent.primary }}
                >
                  {selectedRecipe.name || formatItemName(selectedRecipe.itemId)}
                  {selectedRecipe.outputQuantity &&
                  selectedRecipe.outputQuantity > 1
                    ? ` (x${selectedRecipe.outputQuantity})`
                    : ""}
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {selectedRecipe.barsRequired}x{" "}
                  {formatItemName(selectedRecipe.barType)} needed
                </div>
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
              onPresetQuantity={(qty) => handleSmith(selectedRecipe, qty)}
              allQuantity={28}
              onShowCustomInput={() => setShowQuantityInput(true)}
            />
          </SkillingSection>
        ) : null}
      </div>
    </SkillingPanelBody>
  );
}
