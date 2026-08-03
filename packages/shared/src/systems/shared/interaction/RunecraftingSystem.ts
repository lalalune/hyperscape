/**
 * RunecraftingSystem - Instant Essence-to-Rune Conversion at Altars
 *
 * rules-accurate runecrafting implementation:
 * - Click altar to instantly convert all carried essence into runes
 * - Two essence types: rune_essence (basic runes), pure_essence (all runes)
 * - Multi-rune crafting at higher levels (e.g., 2x air runes at level 11)
 * - Grants runecrafting XP per essence consumed
 *
 * Unlike smelting/smithing, runecrafting is INSTANT (no tick-based sessions).
 * One click converts all valid essence in inventory at once.
 *
 * @see ProcessingDataProvider for runecrafting recipes from manifest
 */

import {
  isLooseInventoryItem,
  getItemQuantity,
  hasSkills,
} from "../../../constants/SmithingConstants";
import { processingDataProvider } from "../../../data/ProcessingDataProvider";
import { EventType } from "../../../types/events";
import { SystemBase } from "../infrastructure/SystemBase";
import type { World } from "../../../types/index";

export class RunecraftingSystem extends SystemBase {
  /** Cache player skill levels to avoid repeated lookups */
  private readonly playerSkills = new Map<
    string,
    Record<string, { level: number; xp: number }>
  >();

  constructor(world: World) {
    super(world, {
      name: "runecrafting",
      dependencies: {
        required: [],
        optional: ["inventory", "skills"],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Server-only system
    if (!this.world.isServer) return;

    // Listen for altar interactions
    this.subscribe(
      EventType.RUNECRAFTING_INTERACT,
      (data: { playerId: string; altarId: string; runeType: string }) => {
        this.handleRunecraftingInteract(data);
      },
    );

    // Cache skill updates
    this.subscribe(
      EventType.SKILLS_UPDATED,
      (data: {
        playerId: string;
        skills: Record<string, { level: number; xp: number }>;
      }) => {
        this.playerSkills.set(data.playerId, data.skills);
      },
    );

    // Clean up on player disconnect
    this.subscribe(
      EventType.PLAYER_UNREGISTERED,
      (data: { playerId: string }) => {
        this.playerSkills.delete(data.playerId);
      },
    );
  }

  /**
   * Handle altar interaction — instantly convert all essence into runes.
   */
  private handleRunecraftingInteract(data: {
    playerId: string;
    altarId: string;
    runeType: string;
  }): void {
    const { playerId, runeType } = data;

    // Get recipe data
    const recipe = processingDataProvider.getRunecraftingRecipe(runeType);
    if (!recipe) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "Nothing interesting happens.",
        type: "error",
      });
      return;
    }

    // Get player's runecrafting level
    const rcLevel = this.getRunecraftingLevel(playerId);

    // Check level requirement
    if (rcLevel < recipe.levelRequired) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `You need a Runecrafting level of ${recipe.levelRequired} to craft ${recipe.name}s.`,
        type: "error",
      });
      return;
    }

    // Get player inventory
    const inventory = this.world.getInventory?.(playerId);
    if (!inventory || !Array.isArray(inventory)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You have no items.",
        type: "error",
      });
      return;
    }

    // Count valid essence in inventory
    const essenceSet = new Set(recipe.essenceTypes);
    let totalEssence = 0;
    const essenceCounts = new Map<string, number>();

    for (const item of inventory) {
      if (!isLooseInventoryItem(item)) continue;
      if (essenceSet.has(item.itemId)) {
        const qty = getItemQuantity(item);
        totalEssence += qty;
        essenceCounts.set(
          item.itemId,
          (essenceCounts.get(item.itemId) || 0) + qty,
        );
      }
    }

    if (totalEssence === 0) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You don't have any essence to craft runes.",
        type: "error",
      });
      return;
    }

    // Calculate multi-rune multiplier
    const multiplier = processingDataProvider.getRunecraftingMultiplier(
      runeType,
      rcLevel,
    );
    const runesProduced = totalEssence * multiplier;
    const xpAwarded = totalEssence * recipe.xpPerEssence;

    // Consume all essence
    for (const [essenceId, count] of essenceCounts) {
      this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
        playerId,
        itemId: essenceId,
        quantity: count,
      });
    }

    // Add runes to inventory
    this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
      playerId,
      item: {
        id: `inv_${playerId}_${Date.now()}`,
        itemId: recipe.runeItemId,
        quantity: runesProduced,
        slot: -1,
        metadata: null,
      },
    });

    // Grant XP
    this.emitTypedEvent(EventType.SKILLS_XP_GAINED, {
      playerId,
      skill: "runecrafting",
      amount: xpAwarded,
    });

    // Emit completion event
    this.emitTypedEvent(EventType.RUNECRAFTING_COMPLETE, {
      playerId,
      runeType,
      runeItemId: recipe.runeItemId,
      essenceConsumed: totalEssence,
      runesProduced,
      multiplier,
      xpAwarded,
    });

    // Send feedback message
    const multiplierText = multiplier > 1 ? ` (${multiplier}x multiplier)` : "";
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `You craft ${runesProduced} ${recipe.name}${runesProduced !== 1 ? "s" : ""}${multiplierText}.`,
      type: "success",
    });
  }

  /**
   * Get the player's runecrafting level from cached skills or entity.
   */
  private getRunecraftingLevel(playerId: string): number {
    // Try cached skills first
    const cached = this.playerSkills.get(playerId);
    if (cached?.runecrafting?.level != null) {
      return cached.runecrafting.level;
    }

    // Fall back to player entity using type-safe guard
    const player = this.world.getPlayer(playerId);
    if (!hasSkills(player)) return 1;
    const runecraftingSkill =
      player.skills?.["runecrafting" as keyof typeof player.skills];
    return runecraftingSkill?.level ?? 1;
  }

  update(_dt: number): void {
    // Runecrafting is instant — no tick-based processing needed
  }
}
