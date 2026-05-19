/**
 * TanningSystem - Handles Hide Tanning at Tanner NPCs
 *
 * Migrated 2026-04-24 from `packages/shared/src/systems/shared/interaction/`
 * into `@hyperforge/hyperscape` as the third slice of the
 * Hyperscape→meta-plugin extraction. Tanning is tile-based-MMORPG-specific
 * gameplay (cowhide → leather, dragonhide → dragon leather, fixed
 * 1gp / 20gp coin cost per hide) so it belongs in the Hyperscape
 * plugin, not in `@hyperforge/shared`.
 *
 * tile-based-MMORPG-accurate tanning implementation:
 * - Talk to tanner NPC to open tanning interface
 * - Select hide type and quantity
 * - Instant conversion: deduct coins + hide, add leather
 * - No tick delay — tanning is instant in the tile-based MMORPG genre
 * - Costs: cowhide → leather (1gp), green dragonhide → green dragon leather (20gp)
 *
 * @see https://oldschool.runescape.wiki/w/Tanner
 * @see ProcessingDataProvider for tanning recipes from manifest
 */

import {
  EventType,
  getItemQuantity,
  isLooseInventoryItem,
  processingDataProvider,
  SystemBase,
  type World,
} from "@hyperforge/shared";

export class TanningSystem extends SystemBase {
  constructor(world: World) {
    super(world, {
      name: "tanning",
      dependencies: {
        required: [],
        optional: ["inventory"],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Server-only system
    if (!this.world.isServer) {
      return;
    }

    // Listen for tanning interaction (player talked to tanner NPC)
    this.subscribe(
      EventType.TANNING_INTERACT,
      (data: { playerId: string; npcId: string }) => {
        this.handleTanningInteract(data);
      },
    );

    // Listen for tanning request (player selected hide to tan)
    this.subscribe(
      EventType.TANNING_REQUEST,
      (data: { playerId: string; inputItemId: string; quantity: number }) => {
        this.handleTanningRequest(data);
      },
    );

    // Clean up on player disconnect
    this.subscribe(
      EventType.PLAYER_UNREGISTERED,
      (_data: { playerId: string }) => {
        // No active sessions to clean up (tanning is instant)
      },
    );
  }

  /**
   * Handle tanner NPC interaction - show available hides to tan
   */
  private handleTanningInteract(data: {
    playerId: string;
    npcId: string;
  }): void {
    const { playerId } = data;

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

    // Build inventory counts
    const inventoryCounts = new Map<string, number>();
    for (const item of inventory) {
      if (!isLooseInventoryItem(item)) continue;
      const count = inventoryCounts.get(item.itemId) || 0;
      inventoryCounts.set(item.itemId, count + getItemQuantity(item));
    }

    // Get all tanning recipes with availability info
    const allRecipes = processingDataProvider.getAllTanningRecipes();

    if (allRecipes.length === 0) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "There are no tanning recipes available.",
        type: "error",
      });
      return;
    }

    const availableRecipes = allRecipes.map((recipe) => {
      const hideCount = inventoryCounts.get(recipe.input) || 0;
      return {
        input: recipe.input,
        output: recipe.output,
        cost: recipe.cost,
        name: recipe.name,
        hasHide: hideCount > 0,
        hideCount,
      };
    });

    // Emit event with available recipes for UI to display
    this.emitTypedEvent(EventType.TANNING_INTERFACE_OPEN, {
      playerId,
      availableRecipes,
    });
  }

  /**
   * Handle tanning request - instant conversion of hides to leather
   */
  private handleTanningRequest(data: {
    playerId: string;
    inputItemId: string;
    quantity: number;
  }): void {
    const { playerId, inputItemId, quantity } = data;

    // Validate recipe exists
    const recipe = processingDataProvider.getTanningRecipe(inputItemId);
    if (!recipe) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "Invalid tanning request.",
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

    // Count available hides
    let hideCount = 0;
    for (const item of inventory) {
      if (!isLooseInventoryItem(item)) continue;
      if (item.itemId === inputItemId) {
        hideCount += getItemQuantity(item);
      }
    }

    if (hideCount === 0) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You don't have any hides to tan.",
        type: "error",
      });
      return;
    }

    // Determine how many we can actually tan (limited by hides and quantity)
    const actualQuantity = Math.min(quantity, hideCount);
    const totalCost = actualQuantity * recipe.cost;

    // Check if player has enough coins
    let playerCoins = 0;
    const coinItems = inventory.filter(
      (item) => isLooseInventoryItem(item) && item.itemId === "coins",
    );
    for (const item of coinItems) {
      if (isLooseInventoryItem(item)) {
        playerCoins += getItemQuantity(item);
      }
    }

    if (playerCoins < totalCost) {
      // Calculate how many we can afford
      const affordable = Math.floor(playerCoins / recipe.cost);
      if (affordable === 0) {
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId,
          message: `You need ${recipe.cost} coins per hide. You don't have enough coins.`,
          type: "error",
        });
        return;
      }
      // Tan only what we can afford
      this.processTanning(playerId, recipe, affordable);
      return;
    }

    // Process the full tanning request
    this.processTanning(playerId, recipe, actualQuantity);
  }

  /**
   * Process the actual tanning - remove hides and coins, add leather
   */
  private processTanning(
    playerId: string,
    recipe: { input: string; output: string; cost: number; name: string },
    quantity: number,
  ): void {
    const totalCost = quantity * recipe.cost;

    // Remove coins
    if (totalCost > 0) {
      this.emitTypedEvent(EventType.INVENTORY_REMOVE_COINS, {
        playerId,
        amount: totalCost,
      });
    }

    // Remove hides
    this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
      playerId,
      itemId: recipe.input,
      quantity,
    });

    // Add leather - one item at a time (inventory handles stacking)
    for (let i = 0; i < quantity; i++) {
      this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
        playerId,
        item: {
          id: `inv_${playerId}_${Date.now()}_${i}`,
          itemId: recipe.output,
          quantity: 1,
          slot: -1,
          metadata: null,
        },
      });
    }

    // Success message
    const itemName = recipe.name || recipe.output.replace(/_/g, " ");
    if (quantity === 1) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `The tanner tans your hide into ${itemName}.`,
        type: "success",
      });
    } else {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `The tanner tans ${quantity} hides into ${itemName}.`,
        type: "success",
      });
    }

    // Emit completion event
    this.emitTypedEvent(EventType.TANNING_COMPLETE, {
      playerId,
      inputItemId: recipe.input,
      outputItemId: recipe.output,
      totalTanned: quantity,
      totalCost,
    });
  }

  /**
   * No tick-based update needed - tanning is instant
   */
  update(_dt: number): void {
    // Tanning is instant, no active sessions to process
  }

  override destroy(): void {
    super.destroy();
  }
}
