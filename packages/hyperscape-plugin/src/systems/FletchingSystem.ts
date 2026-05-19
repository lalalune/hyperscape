/**
 * FletchingSystem - Handles Fletching Skill
 *
 * tile-based-MMORPG-accurate fletching implementation:
 * - Knife + logs → arrow shafts (multi-output) or unstrung bows
 * - Bowstring + unstrung bow → strung bow (item-on-item)
 * - Arrowtips + headless arrows → finished arrows (item-on-item, multi-output)
 * - Arrow shafts + feathers → headless arrows (item-on-item, multi-output)
 * - Always succeeds (no failure rate)
 * - Grants fletching XP per action
 * - Auto-fletching continues until out of materials
 *
 * @see https://oldschool.runescape.wiki/w/Fletching
 * @see ProcessingDataProvider for fletching recipes from manifest
 */

// Migrated 2026-04-24 from
// `packages/shared/src/systems/shared/interaction/` into
// `@hyperforge/hyperscape` as part of the fourth migration batch.
// tile-based MMORPG knife+logs / stringing / arrow-tipping fletching.
import {
  EventType,
  type FletchingRecipeData,
  getItemQuantity,
  hasSkills,
  isLooseInventoryItem,
  Logger,
  processingDataProvider,
  Skill,
  SystemBase,
  type World,
} from "@hyperforge/shared";

/** Active fletching session for a player */
interface FletchingSession {
  playerId: string;
  /** Unique recipe ID (output:primaryInput) */
  recipeId: string;
  /** Total actions to perform */
  quantity: number;
  /** Actions already completed */
  crafted: number;
  /** Tick when current fletch action completes */
  completionTick: number;
}

/** Pre-built inventory state to avoid redundant scans */
interface InventoryState {
  counts: Map<string, number>;
  itemIds: Set<string>;
}

export class FletchingSystem extends SystemBase {
  private readonly activeSessions = new Map<string, FletchingSession>();
  private readonly playerSkills = new Map<
    string,
    Record<string, { level: number; xp: number }>
  >();

  /** Track last processed tick to ensure once-per-tick processing */
  private lastProcessedTick = -1;

  /** Monotonic counter for unique fletched item IDs (avoids Date.now collisions) */
  private fletchCounter = 0;

  /** Reusable array for update loop to avoid allocating per tick */
  private readonly completedPlayerIds: string[] = [];

  constructor(world: World) {
    super(world, {
      name: "fletching",
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

    // Listen for fletching interaction (player used knife on logs, or item-on-item)
    this.subscribe(
      EventType.FLETCHING_INTERACT,
      (data: {
        playerId: string;
        triggerType: string;
        inputItemId: string;
        secondaryItemId?: string;
      }) => {
        this.handleFletchingInteract(data);
      },
    );

    // Listen for fletching request (player selected recipe and quantity)
    this.subscribe(
      EventType.PROCESSING_FLETCHING_REQUEST,
      (data: { playerId: string; recipeId: string; quantity: number }) => {
        this.startFletching(data);
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

    // Cancel fletching on movement (Tile-based MMORPG: any click cancels skilling)
    this.subscribe<{
      playerId: string;
      targetPosition: { x: number; y: number; z: number };
    }>(EventType.MOVEMENT_CLICK_TO_MOVE, (data) => {
      if (this.activeSessions.has(data.playerId)) {
        this.cancelFletching(data.playerId);
      }
    });

    // Cancel fletching on combat start
    this.subscribe(
      EventType.COMBAT_STARTED,
      (data: { attackerId: string; targetId: string }) => {
        if (this.activeSessions.has(data.attackerId)) {
          this.cancelFletching(data.attackerId);
        }
        if (this.activeSessions.has(data.targetId)) {
          this.cancelFletching(data.targetId);
        }
      },
    );

    // Clean up on player disconnect
    this.subscribe(
      EventType.PLAYER_UNREGISTERED,
      (data: { playerId: string }) => {
        this.cancelFletching(data.playerId);
        this.playerSkills.delete(data.playerId);
      },
    );
  }

  /**
   * Handle fletching interaction - show available recipes to player
   */
  private handleFletchingInteract(data: {
    playerId: string;
    triggerType: string;
    inputItemId: string;
    secondaryItemId?: string;
  }): void {
    const { playerId, inputItemId, secondaryItemId } = data;

    // Check if already fletching
    if (this.activeSessions.has(playerId)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You are already fletching.",
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

    // Get player fletching level
    const fletchingLevel = this.getFletchingLevel(playerId);

    // Build inventory lookup
    const inventoryCounts = new Map<string, number>();
    for (const item of inventory) {
      if (!isLooseInventoryItem(item)) continue;
      const count = inventoryCounts.get(item.itemId) || 0;
      inventoryCounts.set(item.itemId, count + getItemQuantity(item));
    }

    // Get matching recipes based on input item(s)
    let filteredRecipes: FletchingRecipeData[];

    if (secondaryItemId) {
      // Item-on-item: find recipes that use BOTH items as inputs
      filteredRecipes = processingDataProvider.getFletchingRecipesForInputPair(
        inputItemId,
        secondaryItemId,
      );
    } else {
      // Knife + item: find all recipes that use this input
      filteredRecipes =
        processingDataProvider.getFletchingRecipesForInput(inputItemId);
    }

    if (filteredRecipes.length === 0) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You can't fletch anything with that.",
        type: "error",
      });
      return;
    }

    // Check availability for each recipe
    const availableRecipes = filteredRecipes.map((recipe) => {
      const meetsLevel = fletchingLevel >= recipe.level;
      const hasInputs = recipe.inputs.every((input) => {
        const count = inventoryCounts.get(input.item) || 0;
        return count >= input.amount;
      });
      const hasTools = recipe.tools.every((tool) => inventoryCounts.has(tool));

      return {
        recipeId: recipe.recipeId,
        output: recipe.output,
        name: recipe.name,
        category: recipe.category,
        outputQuantity: recipe.outputQuantity,
        inputs: recipe.inputs,
        tools: recipe.tools,
        level: recipe.level,
        xp: recipe.xp,
        meetsLevel,
        hasInputs: hasInputs && hasTools,
      };
    });

    // Emit event with available recipes for UI to display
    this.emitTypedEvent(EventType.FLETCHING_INTERFACE_OPEN, {
      playerId,
      availableRecipes,
    });
  }

  /**
   * Start fletching a specific recipe
   */
  private startFletching(data: {
    playerId: string;
    recipeId: string;
    quantity: number;
  }): void {
    const { playerId, recipeId, quantity } = data;

    // Check if already fletching
    if (this.activeSessions.has(playerId)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You are already fletching.",
        type: "error",
      });
      return;
    }

    // Validate recipe exists
    const recipe = processingDataProvider.getFletchingRecipe(recipeId);
    if (!recipe) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "Invalid fletching recipe.",
        type: "error",
      });
      return;
    }

    // Check level requirement
    const fletchingLevel = this.getFletchingLevel(playerId);
    if (fletchingLevel < recipe.level) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `You need level ${recipe.level} Fletching to make that.`,
        type: "error",
      });
      return;
    }

    // Build inventory state once for all checks
    const invState = this.getInventoryState(playerId);
    if (!invState) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You have no items.",
        type: "error",
      });
      return;
    }

    // Check tools
    if (!this.hasRequiredTools(invState, recipe)) {
      const toolNames = recipe.tools.join(", ").replace(/_/g, " ");
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `You need a ${toolNames} to fletch that.`,
        type: "error",
      });
      return;
    }

    // Check materials
    if (!this.hasRequiredInputs(invState, recipe)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You don't have the required materials.",
        type: "error",
      });
      return;
    }

    // Get current tick for tick-based timing
    const currentTick = this.world.currentTick ?? 0;

    // Create session with tick-based completion
    const session: FletchingSession = {
      playerId,
      recipeId,
      quantity: Math.max(1, quantity),
      crafted: 0,
      completionTick: currentTick + recipe.ticks,
    };

    this.activeSessions.set(playerId, session);

    // Show start message
    const itemName = recipe.name || recipe.output.replace(/_/g, " ");
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `You begin fletching ${itemName}s.`,
      type: "info",
    });

    // Emit start event
    this.emitTypedEvent(EventType.FLETCHING_START, {
      playerId,
      recipeId,
    });
  }

  /**
   * Schedule the next fletch action for a session.
   * Called after each successful fletch to queue the next one.
   */
  private scheduleNextFletch(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (!session) return;

    // Check if we've reached the target quantity
    if (session.crafted >= session.quantity) {
      this.completeFletching(playerId);
      return;
    }

    const recipe = processingDataProvider.getFletchingRecipe(session.recipeId);
    if (!recipe) {
      this.completeFletching(playerId);
      return;
    }

    // Build inventory state once for all checks
    const invState = this.getInventoryState(playerId);
    if (!invState) {
      this.completeFletching(playerId);
      return;
    }

    // Check materials for next fletch
    if (!this.hasRequiredInputs(invState, recipe)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You have run out of materials.",
        type: "info",
      });
      this.completeFletching(playerId);
      return;
    }

    // Check tools still present
    if (!this.hasRequiredTools(invState, recipe)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You no longer have the required tools.",
        type: "info",
      });
      this.completeFletching(playerId);
      return;
    }

    // Set completion tick for next fletch action
    const currentTick = this.world.currentTick ?? 0;
    session.completionTick = currentTick + recipe.ticks;
  }

  /**
   * Complete a single fletch action.
   * Handles multi-output recipes (e.g., 15 arrow shafts per log).
   */
  private completeFletch(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (!session) return;

    const recipe = processingDataProvider.getFletchingRecipe(session.recipeId);
    if (!recipe) {
      this.completeFletching(playerId);
      return;
    }

    // Re-verify inventory before consuming (guard against external modifications)
    const invState = this.getInventoryState(playerId);
    if (!invState || !this.hasRequiredInputs(invState, recipe)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You have run out of materials.",
        type: "info",
      });
      this.completeFletching(playerId);
      return;
    }
    if (!this.hasRequiredTools(invState, recipe)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You no longer have the required tools.",
        type: "info",
      });
      this.completeFletching(playerId);
      return;
    }

    // Play fletching animation
    this.emitTypedEvent(EventType.ANIMATION_PLAY, {
      entityId: playerId,
      animation: "crafting",
      loop: false,
    });

    // Consume input materials
    for (const input of recipe.inputs) {
      this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
        playerId,
        itemId: input.item,
        quantity: input.amount,
      });
    }

    // Add fletched item(s) to inventory
    // Multi-output: outputQuantity items per action (e.g., 15 arrow shafts)
    this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
      playerId,
      item: {
        id: `fletch_${playerId}_${++this.fletchCounter}_${Date.now()}`,
        itemId: recipe.output,
        quantity: recipe.outputQuantity,
        slot: -1,
        metadata: null,
      },
    });

    // Grant XP (total for the action, not per item)
    this.emitTypedEvent(EventType.SKILLS_XP_GAINED, {
      playerId,
      skill: Skill.FLETCHING,
      amount: recipe.xp,
    });

    session.crafted++;

    // Audit log for economic tracking
    Logger.system("FletchingSystem", "fletch_complete", {
      playerId,
      recipeId: session.recipeId,
      output: recipe.output,
      outputQuantity: recipe.outputQuantity,
      inputsConsumed: recipe.inputs.map((i) => `${i.amount}x${i.item}`),
      xpAwarded: recipe.xp,
      crafted: session.crafted,
      batchTotal: session.quantity,
    });

    // Success message
    const itemName = recipe.name || recipe.output.replace(/_/g, " ");
    if (recipe.outputQuantity > 1) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `You fletch ${recipe.outputQuantity} ${itemName}s.`,
        type: "success",
      });
    } else {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `You fletch a ${itemName}.`,
        type: "success",
      });
    }

    // Schedule next fletch action
    this.scheduleNextFletch(playerId);
  }

  /**
   * Complete the fletching session
   */
  private completeFletching(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (!session) return;

    this.activeSessions.delete(playerId);

    const recipe = processingDataProvider.getFletchingRecipe(session.recipeId);

    // Emit completion event
    this.emitTypedEvent(EventType.FLETCHING_COMPLETE, {
      playerId,
      recipeId: session.recipeId,
      outputItemId: recipe?.output || session.recipeId,
      totalCrafted: session.crafted,
      totalXp: session.crafted * (recipe?.xp || 0),
    });
  }

  /**
   * Cancel fletching for a player
   */
  private cancelFletching(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (session) {
      this.completeFletching(playerId);
    }
  }

  /**
   * Build inventory state once for use across multiple checks.
   */
  private getInventoryState(playerId: string): InventoryState | null {
    const inventory = this.world.getInventory?.(playerId);
    if (!inventory || !Array.isArray(inventory)) return null;

    const counts = new Map<string, number>();
    const itemIds = new Set<string>();
    for (const item of inventory) {
      if (!isLooseInventoryItem(item)) continue;
      itemIds.add(item.itemId);
      const count = counts.get(item.itemId) || 0;
      counts.set(item.itemId, count + getItemQuantity(item));
    }
    return { counts, itemIds };
  }

  /**
   * Check if player has required tools in inventory
   */
  private hasRequiredTools(
    state: InventoryState,
    recipe: FletchingRecipeData,
  ): boolean {
    if (recipe.tools.length === 0) return true;
    return recipe.tools.every((tool) => state.itemIds.has(tool));
  }

  /**
   * Check if player has required input materials
   */
  private hasRequiredInputs(
    state: InventoryState,
    recipe: FletchingRecipeData,
  ): boolean {
    return recipe.inputs.every((input) => {
      const count = state.counts.get(input.item) || 0;
      return count >= input.amount;
    });
  }

  /**
   * Get player's fletching level using type-safe access
   */
  private getFletchingLevel(playerId: string): number {
    // Check cached skills first
    const cachedSkills = this.playerSkills.get(playerId);
    if (cachedSkills?.fletching?.level != null) {
      return cachedSkills.fletching.level;
    }

    // Fall back to player entity using type-safe guard
    const player = this.world.getPlayer(playerId);
    if (!hasSkills(player)) return 1;
    const fletchingSkill =
      player.skills?.["fletching" as keyof typeof player.skills];
    return fletchingSkill?.level ?? 1;
  }

  /**
   * Check if player is currently fletching
   */
  isPlayerFletching(playerId: string): boolean {
    return this.activeSessions.has(playerId);
  }

  /**
   * Update method - processes tick-based fletching sessions.
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

    // Collect completed session IDs first, then process (avoids Map snapshot allocation)
    this.completedPlayerIds.length = 0;
    for (const [playerId, session] of this.activeSessions) {
      if (currentTick >= session.completionTick) {
        this.completedPlayerIds.push(playerId);
      }
    }
    for (const playerId of this.completedPlayerIds) {
      this.completeFletch(playerId);
    }
  }

  destroy(): void {
    // Complete all active sessions
    for (const playerId of this.activeSessions.keys()) {
      this.completeFletching(playerId);
    }
    this.activeSessions.clear();
    this.playerSkills.clear();
  }
}
