/**
 * SmithingSystem - Handles Smithing at Anvils
 *
 * tile-based-MMORPG-accurate smithing implementation:
 * - Use bars on anvil to smith items
 * - Requires hammer in inventory (not consumed)
 * - Consumes bars based on recipe
 * - Always succeeds (no failure rate)
 * - Grants smithing XP per item made
 * - Auto-smithing continues until out of bars
 *
 * @see https://oldschool.runescape.wiki/w/Smithing
 * @see ProcessingDataProvider for smithing recipes from manifest
 */

// Migrated 2026-04-24 from
// `packages/shared/src/systems/shared/interaction/` into
// `@hyperforge/hyperscape` as part of the third migration batch.
// Hammer + anvil + bar = tile-based-MMORPG-specific gameplay.
import {
  EventType,
  getHammerItemId,
  getItemQuantity,
  getSmithingLevelSafe,
  isLooseInventoryItem,
  processingDataProvider,
  SystemBase,
  type World,
} from "@hyperforge/shared";

/** Active smithing session for a player */
interface SmithingSession {
  playerId: string;
  recipeId: string; // Output item ID (e.g., "bronze_sword")
  anvilId: string;
  startTime: number;
  quantity: number;
  smithed: number;
  /** Tick when current smith action completes (tick-based timing) */
  completionTick: number;
}

export class SmithingSystem extends SystemBase {
  private readonly activeSessions = new Map<string, SmithingSession>();
  private readonly playerSkills = new Map<
    string,
    Record<string, { level: number; xp: number }>
  >();

  /** Track last processed tick to ensure once-per-tick processing */
  private lastProcessedTick = -1;

  /** OPTIMIZATION: Pre-allocated array for completed players (avoids allocation per tick) */
  private readonly _completedPlayers: string[] = [];

  constructor(world: World) {
    super(world, {
      name: "smithing",
      dependencies: {
        required: [],
        optional: ["inventory", "skills"],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Server-only system - client doesn't need these event handlers
    if (!this.world.isServer) {
      return;
    }

    // Listen for smithing interaction (player clicked anvil)
    this.subscribe(
      EventType.SMITHING_INTERACT,
      (data: { playerId: string; anvilId: string }) => {
        this.handleAnvilInteract(data);
      },
    );

    // Listen for smithing request (player selected item to smith)
    this.subscribe(
      EventType.PROCESSING_SMITHING_REQUEST,
      (data: {
        playerId: string;
        recipeId: string;
        anvilId: string;
        quantity: number;
      }) => {
        this.startSmithing(data);
      },
    );

    // Listen for skills updates
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
        this.cancelSmithing(data.playerId);
        this.playerSkills.delete(data.playerId); // Memory cleanup
      },
    );
  }

  /**
   * Handle anvil interaction - show available items to smith
   */
  private handleAnvilInteract(data: {
    playerId: string;
    anvilId: string;
  }): void {
    const { playerId, anvilId } = data;

    // Check if already smithing
    if (this.activeSessions.has(playerId)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You are already smithing.",
        type: "error",
      });
      return;
    }

    // Check for hammer
    if (!this.hasHammer(playerId)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You need a hammer to work the metal on this anvil.",
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

    // Get player smithing level
    const smithingLevel = this.getSmithingLevel(playerId);

    // Get all recipes for bar types the player has, with availability info
    const availableRecipes =
      processingDataProvider.getSmithableItemsWithAvailability(
        inventory.map((item: { itemId: string; quantity?: number }) => ({
          itemId: item.itemId,
          quantity: item.quantity || 1,
        })),
        smithingLevel,
      );

    if (availableRecipes.length === 0) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You don't have the bars to smith anything.",
        type: "error",
      });
      return;
    }

    // Emit event with available recipes for UI to display
    // Includes meetsLevel and hasBars flags for greying out unavailable items
    // Use SMITHING_INTERFACE_OPEN (not SMITHING_INTERACT) to avoid infinite recursion
    this.emitTypedEvent(EventType.SMITHING_INTERFACE_OPEN, {
      playerId,
      anvilId,
      availableRecipes: availableRecipes.map((recipe) => ({
        itemId: recipe.itemId,
        name: recipe.name,
        barType: recipe.barType,
        barsRequired: recipe.barsRequired,
        levelRequired: recipe.levelRequired,
        xp: recipe.xp,
        category: recipe.category,
        outputQuantity: recipe.outputQuantity,
        meetsLevel: recipe.meetsLevel,
        hasBars: recipe.hasBars,
      })),
    });
  }

  /**
   * Start smithing a specific item
   */
  private startSmithing(data: {
    playerId: string;
    recipeId: string;
    anvilId: string;
    quantity: number;
  }): void {
    const { playerId, recipeId, anvilId, quantity } = data;

    // Check if already smithing
    if (this.activeSessions.has(playerId)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You are already smithing.",
        type: "error",
      });
      return;
    }

    // Check for hammer
    if (!this.hasHammer(playerId)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You need a hammer to work the metal on this anvil.",
        type: "error",
      });
      return;
    }

    // Validate recipe exists
    const recipe = processingDataProvider.getSmithingRecipe(recipeId);
    if (!recipe) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "Invalid smithing recipe.",
        type: "error",
      });
      return;
    }

    // Check level requirement
    const smithingLevel = this.getSmithingLevel(playerId);
    if (smithingLevel < recipe.levelRequired) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `You need level ${recipe.levelRequired} Smithing to make that.`,
        type: "error",
      });
      return;
    }

    // Get current tick for tick-based timing
    const currentTick = this.world.currentTick ?? 0;

    // Create session with tick-based completion
    const session: SmithingSession = {
      playerId,
      recipeId,
      anvilId,
      startTime: Date.now(),
      quantity: Math.max(1, quantity),
      smithed: 0,
      completionTick: currentTick + recipe.ticks, // First smith completes after recipe.ticks
    };

    this.activeSessions.set(playerId, session);

    // Show start message
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `You begin smithing ${recipe.name}s.`,
      type: "info",
    });

    // Emit start event
    this.emitTypedEvent(EventType.SMITHING_START, {
      playerId,
      recipeId,
      anvilId,
    });
  }

  /**
   * Schedule the next smith action for a session.
   * Called after each successful smith to queue the next one.
   */
  private scheduleNextSmith(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (!session) return;

    // Check if we've reached the target quantity
    if (session.smithed >= session.quantity) {
      this.completeSmithing(playerId);
      return;
    }

    const recipe = processingDataProvider.getSmithingRecipe(session.recipeId);
    if (!recipe) {
      this.completeSmithing(playerId);
      return;
    }

    // Check materials (bars)
    if (!this.hasRequiredBars(playerId, recipe.barType, recipe.barsRequired)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You have run out of bars.",
        type: "info",
      });
      this.completeSmithing(playerId);
      return;
    }

    // Set completion tick for next smith action (tick-based timing)
    const currentTick = this.world.currentTick ?? 0;
    session.completionTick = currentTick + recipe.ticks;
  }

  /**
   * Complete a single smith action
   */
  private completeSmith(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (!session) return;

    const recipe = processingDataProvider.getSmithingRecipe(session.recipeId);
    if (!recipe) {
      this.completeSmithing(playerId);
      return;
    }

    // Play smithing animation (tile-based-MMORPG-style)
    this.emitTypedEvent(EventType.ANIMATION_PLAY, {
      entityId: playerId,
      animation: "smithing",
      loop: false,
    });

    // Consume bars
    this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
      playerId,
      itemId: recipe.barType,
      quantity: recipe.barsRequired,
    });

    // Add smithed item(s) to inventory
    const qty = recipe.outputQuantity || 1;
    this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
      playerId,
      item: {
        id: `inv_${playerId}_${Date.now()}`,
        itemId: recipe.itemId,
        quantity: qty,
        slot: -1,
        metadata: null,
      },
    });

    // Grant XP
    this.emitTypedEvent(EventType.SKILLS_XP_GAINED, {
      playerId,
      skill: "smithing",
      amount: recipe.xp,
    });

    session.smithed++;

    // Success message (tile-based MMORPG style - shows item name)
    const qtyText = qty > 1 ? `${qty} ${recipe.name}` : `a ${recipe.name}`;
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `You hammer the ${recipe.barType.replace("_bar", "")} and make ${qtyText}.`,
      type: "success",
    });

    // Schedule next smith action
    this.scheduleNextSmith(playerId);
  }

  /**
   * Complete the smithing session
   */
  private completeSmithing(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (!session) return;

    this.activeSessions.delete(playerId);

    const recipe = processingDataProvider.getSmithingRecipe(session.recipeId);

    // Emit completion event
    this.emitTypedEvent(EventType.SMITHING_COMPLETE, {
      playerId,
      recipeId: session.recipeId,
      outputItemId: recipe?.itemId || session.recipeId,
      totalSmithed: session.smithed,
      totalXp: session.smithed * (recipe?.xp || 0),
    });
  }

  /**
   * Cancel smithing for a player
   */
  private cancelSmithing(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (session) {
      this.completeSmithing(playerId);
    }
  }

  /**
   * Check if player has a hammer in inventory
   */
  private hasHammer(playerId: string): boolean {
    const inventory = this.world.getInventory?.(playerId);
    if (!inventory || !Array.isArray(inventory)) return false;

    return inventory.some(
      (item) => isLooseInventoryItem(item) && item.itemId === getHammerItemId(),
    );
  }

  /**
   * Check if player has required bars
   */
  private hasRequiredBars(
    playerId: string,
    barType: string,
    barsRequired: number,
  ): boolean {
    const inventory = this.world.getInventory?.(playerId);
    if (!inventory || !Array.isArray(inventory)) return false;

    let totalBars = 0;
    for (const item of inventory) {
      if (!isLooseInventoryItem(item)) continue;
      if (item.itemId === barType) {
        totalBars += getItemQuantity(item);
      }
    }

    return totalBars >= barsRequired;
  }

  /**
   * Get player's smithing level using type-safe access
   */
  private getSmithingLevel(playerId: string): number {
    // Check cached skills first
    const cachedSkills = this.playerSkills.get(playerId);
    if (cachedSkills?.smithing?.level) {
      return cachedSkills.smithing.level;
    }

    // Fall back to player entity using type-safe getter
    const player = this.world.getPlayer(playerId);
    return getSmithingLevelSafe(player, 1);
  }

  /**
   * Check if player is currently smithing
   */
  isPlayerSmithing(playerId: string): boolean {
    return this.activeSessions.has(playerId);
  }

  /**
   * Update method - processes tick-based smithing sessions.
   * Called each frame, but only processes once per game tick.
   */
  update(_dt: number): void {
    // Server-only processing
    if (!this.world.isServer) return;

    const currentTick = this.world.currentTick ?? 0;

    // Only process once per tick (avoid duplicate processing)
    if (currentTick === this.lastProcessedTick) {
      return;
    }
    this.lastProcessedTick = currentTick;

    // Process all active sessions that have reached their completion tick
    // OPTIMIZATION: Use pre-allocated array to avoid allocation per tick
    this._completedPlayers.length = 0; // Clear without reallocating
    for (const [playerId, session] of this.activeSessions) {
      if (currentTick >= session.completionTick) {
        this._completedPlayers.push(playerId);
      }
    }
    for (const playerId of this._completedPlayers) {
      this.completeSmith(playerId);
    }
  }

  destroy(): void {
    // Complete all active sessions
    for (const playerId of this.activeSessions.keys()) {
      this.completeSmithing(playerId);
    }
    this.activeSessions.clear();
    this.playerSkills.clear(); // Memory cleanup
  }
}
