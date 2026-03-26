/**
 * CraftingSystem - Handles Crafting Skills
 *
 * OSRS-accurate crafting implementation:
 * - Leather/dragonhide: use needle + thread + hides
 * - Jewelry: use mould + gold bar at furnace
 * - Gem cutting: use chisel on uncut gems
 * - Thread has 5 uses per item (consumed every 5 crafts)
 * - Always succeeds (no failure rate)
 * - Grants crafting XP per item made
 * - Auto-crafting continues until out of materials
 *
 * @see https://oldschool.runescape.wiki/w/Crafting
 * @see ProcessingDataProvider for crafting recipes from manifest
 */

import {
  isLooseInventoryItem,
  getItemQuantity,
  hasSkills,
} from "../../../constants/SmithingConstants";
import { processingDataProvider } from "../../../data/ProcessingDataProvider";
import type { CraftingRecipeData } from "../../../data/ProcessingDataProvider";
import { EventType } from "../../../types/events";
import { Skill } from "../character/SkillsSystem";
import { Logger } from "../../../utils/Logger";
import { SystemBase } from "../infrastructure/SystemBase";
import type { World } from "../../../types/index";

/** Active crafting session for a player */
interface CraftingSession {
  playerId: string;
  recipeId: string; // Output item ID (e.g., "leather_body")
  quantity: number;
  crafted: number;
  /** Tick when current craft action completes (tick-based timing) */
  completionTick: number;
  /** Remaining uses for each consumable before it needs to be consumed from inventory */
  consumableUses: Map<string, number>;
}

/** Pre-built inventory state to avoid redundant scans */
interface InventoryState {
  counts: Map<string, number>;
  itemIds: Set<string>;
}

export class CraftingSystem extends SystemBase {
  private readonly activeSessions = new Map<string, CraftingSession>();
  private readonly playerSkills = new Map<
    string,
    Record<string, { level: number; xp: number }>
  >();

  /** Track last processed tick to ensure once-per-tick processing */
  private lastProcessedTick = -1;

  /** Monotonic counter for unique crafted item IDs (avoids Date.now collisions) */
  private craftCounter = 0;

  /** Reusable array for update loop to avoid allocating per tick */
  private readonly completedPlayerIds: string[] = [];

  constructor(world: World) {
    super(world, {
      name: "crafting",
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

    // Listen for crafting interaction (player used needle/chisel/gold bar on furnace)
    this.subscribe(
      EventType.CRAFTING_INTERACT,
      (data: {
        playerId: string;
        triggerType: string;
        stationId?: string;
        inputItemId?: string;
      }) => {
        this.handleCraftingInteract(data);
      },
    );

    // Listen for crafting request (player selected item to craft)
    this.subscribe(
      EventType.PROCESSING_CRAFTING_REQUEST,
      (data: { playerId: string; recipeId: string; quantity: number }) => {
        this.startCrafting(data);
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

    // Cancel crafting on movement (OSRS: any click cancels skilling)
    this.subscribe<{
      playerId: string;
      targetPosition: { x: number; y: number; z: number };
    }>(EventType.MOVEMENT_CLICK_TO_MOVE, (data) => {
      if (this.activeSessions.has(data.playerId)) {
        this.cancelCrafting(data.playerId);
      }
    });

    // Cancel crafting on combat start
    this.subscribe(
      EventType.COMBAT_STARTED,
      (data: { attackerId: string; targetId: string }) => {
        if (this.activeSessions.has(data.attackerId)) {
          this.cancelCrafting(data.attackerId);
        }
        if (this.activeSessions.has(data.targetId)) {
          this.cancelCrafting(data.targetId);
        }
      },
    );

    // Clean up on player disconnect
    this.subscribe(
      EventType.PLAYER_UNREGISTERED,
      (data: { playerId: string }) => {
        this.cancelCrafting(data.playerId);
        this.playerSkills.delete(data.playerId); // Memory cleanup
      },
    );
  }

  /**
   * Handle crafting interaction - show available items to craft
   */
  private handleCraftingInteract(data: {
    playerId: string;
    triggerType: string;
    stationId?: string;
    inputItemId?: string;
  }): void {
    const { playerId, triggerType, inputItemId } = data;

    // Check if already crafting
    if (this.activeSessions.has(playerId)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You are already crafting.",
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

    // Get player crafting level
    const craftingLevel = this.getCraftingLevel(playerId);

    // Determine station type based on trigger
    const station = triggerType === "furnace" ? "furnace" : "none";

    // Build inventory lookup first (needed for recipe filtering and availability)
    const inventoryCounts = new Map<string, number>();
    for (const item of inventory) {
      if (!isLooseInventoryItem(item)) continue;
      const count = inventoryCounts.get(item.itemId) || 0;
      inventoryCounts.set(item.itemId, count + getItemQuantity(item));
    }

    // Get crafting recipes filtered by station
    let filteredRecipes =
      processingDataProvider.getCraftingRecipesByStation(station);

    // Filter by specific input item if provided (OSRS-accurate: only show relevant recipes)
    if (inputItemId) {
      filteredRecipes = filteredRecipes.filter((recipe) =>
        recipe.inputs.some((inp) => inp.item === inputItemId),
      );
    }

    // For furnace (jewelry): only show recipes where player has required moulds
    if (station === "furnace") {
      filteredRecipes = filteredRecipes.filter((recipe) =>
        recipe.tools.every((tool) => inventoryCounts.has(tool)),
      );
    }

    if (filteredRecipes.length === 0) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "There are no crafting recipes available.",
        type: "error",
      });
      return;
    }

    // Check availability for each recipe
    const availableRecipes = filteredRecipes.map((recipe) => {
      const meetsLevel = craftingLevel >= recipe.level;
      const hasInputs = recipe.inputs.every((input) => {
        const count = inventoryCounts.get(input.item) || 0;
        return count >= input.amount;
      });
      const hasTools = recipe.tools.every((tool) => inventoryCounts.has(tool));
      const hasConsumables = recipe.consumables.every((c) =>
        inventoryCounts.has(c.item),
      );

      return {
        output: recipe.output,
        name: recipe.name,
        category: recipe.category,
        inputs: recipe.inputs,
        tools: recipe.tools,
        level: recipe.level,
        xp: recipe.xp,
        meetsLevel,
        hasInputs: hasInputs && hasTools && hasConsumables,
      };
    });

    // Emit event with available recipes for UI to display
    this.emitTypedEvent(EventType.CRAFTING_INTERFACE_OPEN, {
      playerId,
      availableRecipes,
      station,
    });
  }

  /**
   * Start crafting a specific item
   */
  private startCrafting(data: {
    playerId: string;
    recipeId: string;
    quantity: number;
  }): void {
    const { playerId, recipeId, quantity } = data;

    // Check if already crafting
    if (this.activeSessions.has(playerId)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You are already crafting.",
        type: "error",
      });
      return;
    }

    // Validate recipe exists
    const recipe = processingDataProvider.getCraftingRecipe(recipeId);
    if (!recipe) {
      console.warn(
        `[CraftingSystem] startCrafting FAILED: recipe not found: ${recipeId} player=${playerId}`,
      );
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "Invalid crafting recipe.",
        type: "error",
      });
      return;
    }

    // Check level requirement
    const craftingLevel = this.getCraftingLevel(playerId);
    if (craftingLevel < recipe.level) {
      console.warn(
        `[CraftingSystem] startCrafting FAILED: level too low: need=${recipe.level} have=${craftingLevel} player=${playerId}`,
      );
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `You need level ${recipe.level} Crafting to make that.`,
        type: "error",
      });
      return;
    }

    // Build inventory state once for all checks
    const invState = this.getInventoryState(playerId);
    if (!invState) {
      console.warn(
        `[CraftingSystem] startCrafting FAILED: no inventory for player=${playerId}`,
      );
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You have no items.",
        type: "error",
      });
      return;
    }

    // Check tools
    if (!this.hasRequiredTools(invState, recipe)) {
      console.warn(
        `[CraftingSystem] startCrafting FAILED: missing tools=${recipe.tools.join(",")} player=${playerId} inventory=${JSON.stringify([...invState.itemIds])}`,
      );
      const toolNames = recipe.tools.join(", ").replace(/_/g, " ");
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `You need a ${toolNames} to craft that.`,
        type: "error",
      });
      return;
    }

    // Check materials
    if (!this.hasRequiredInputs(invState, recipe)) {
      console.warn(
        `[CraftingSystem] startCrafting FAILED: missing materials for ${recipeId} player=${playerId} inventory=${JSON.stringify([...invState.itemIds])}`,
      );
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You don't have the required materials.",
        type: "error",
      });
      return;
    }

    // Check consumables (e.g., thread)
    if (!this.hasRequiredConsumables(invState, recipe)) {
      console.warn(
        `[CraftingSystem] startCrafting FAILED: missing consumables for ${recipeId} player=${playerId} inventory=${JSON.stringify([...invState.itemIds])}`,
      );
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You need thread to craft that.",
        type: "error",
      });
      return;
    }

    // Initialize consumable uses tracking
    // Each consumable has N uses before being consumed (e.g., thread = 5 uses)
    const consumableUses = new Map<string, number>();
    for (const consumable of recipe.consumables) {
      consumableUses.set(consumable.item, consumable.uses);
    }

    // Get current tick for tick-based timing
    const currentTick = this.world.currentTick ?? 0;

    // Create session with tick-based completion
    const session: CraftingSession = {
      playerId,
      recipeId,
      quantity: Math.max(1, quantity),
      crafted: 0,
      completionTick: currentTick + recipe.ticks,
      consumableUses,
    };

    this.activeSessions.set(playerId, session);

    // Show start message
    const itemName = recipe.name || recipe.output.replace(/_/g, " ");
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `You begin crafting ${itemName}s.`,
      type: "info",
    });

    // Emit start event
    this.emitTypedEvent(EventType.CRAFTING_START, {
      playerId,
      recipeId,
    });
  }

  /**
   * Schedule the next craft action for a session.
   * Called after each successful craft to queue the next one.
   */
  private scheduleNextCraft(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (!session) return;

    // Check if we've reached the target quantity
    if (session.crafted >= session.quantity) {
      this.completeCrafting(playerId);
      return;
    }

    const recipe = processingDataProvider.getCraftingRecipe(session.recipeId);
    if (!recipe) {
      this.completeCrafting(playerId);
      return;
    }

    // Build inventory state once for all checks
    const invState = this.getInventoryState(playerId);
    if (!invState) {
      this.completeCrafting(playerId);
      return;
    }

    // Check materials for next craft
    if (!this.hasRequiredInputs(invState, recipe)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You have run out of materials.",
        type: "info",
      });
      this.completeCrafting(playerId);
      return;
    }

    // Check tools still present
    if (!this.hasRequiredTools(invState, recipe)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You no longer have the required tools.",
        type: "info",
      });
      this.completeCrafting(playerId);
      return;
    }

    // Check if consumable uses are depleted and need a new consumable
    for (const consumable of recipe.consumables) {
      const remaining = session.consumableUses.get(consumable.item) || 0;
      if (remaining <= 0) {
        // Need to consume a new thread/consumable from inventory
        if (!this.hasRequiredConsumables(invState, recipe)) {
          this.emitTypedEvent(EventType.UI_MESSAGE, {
            playerId,
            message: "You have run out of thread.",
            type: "info",
          });
          this.completeCrafting(playerId);
          return;
        }
        // Consume 1 from inventory and reset uses
        this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
          playerId,
          itemId: consumable.item,
          quantity: 1,
        });
        session.consumableUses.set(consumable.item, consumable.uses);
      }
    }

    // Set completion tick for next craft action
    const currentTick = this.world.currentTick ?? 0;
    session.completionTick = currentTick + recipe.ticks;
  }

  /**
   * Complete a single craft action
   */
  private completeCraft(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (!session) return;

    const recipe = processingDataProvider.getCraftingRecipe(session.recipeId);
    if (!recipe) {
      this.completeCrafting(playerId);
      return;
    }

    // Play crafting animation (OSRS-style)
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

    // Decrement consumable uses
    for (const consumable of recipe.consumables) {
      const remaining = session.consumableUses.get(consumable.item) || 0;
      session.consumableUses.set(consumable.item, Math.max(0, remaining - 1));
    }

    // Add crafted item to inventory
    // Note: Input removal, output addition, and XP grant are processed synchronously
    // in the same tick. A crash between events would require SIGKILL mid-function,
    // which is acceptable loss for a single craft action.
    this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
      playerId,
      item: {
        id: `craft_${playerId}_${++this.craftCounter}_${Date.now()}`,
        itemId: recipe.output,
        quantity: 1,
        slot: -1,
        metadata: null,
      },
    });

    // Grant XP
    this.emitTypedEvent(EventType.SKILLS_XP_GAINED, {
      playerId,
      skill: Skill.CRAFTING,
      amount: recipe.xp,
    });

    session.crafted++;

    // Audit log for economic tracking
    Logger.system("CraftingSystem", "craft_complete", {
      playerId,
      recipeId: session.recipeId,
      output: recipe.output,
      inputsConsumed: recipe.inputs.map((i) => `${i.amount}x${i.item}`),
      xpAwarded: recipe.xp,
      crafted: session.crafted,
      batchTotal: session.quantity,
    });

    // Success message (OSRS style - shows item name)
    const itemName = recipe.name || recipe.output.replace(/_/g, " ");
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `You craft a ${itemName}.`,
      type: "success",
    });

    // Schedule next craft action
    this.scheduleNextCraft(playerId);
  }

  /**
   * Complete the crafting session
   */
  private completeCrafting(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (!session) return;

    this.activeSessions.delete(playerId);

    const recipe = processingDataProvider.getCraftingRecipe(session.recipeId);

    // Emit completion event
    this.emitTypedEvent(EventType.CRAFTING_COMPLETE, {
      playerId,
      recipeId: session.recipeId,
      outputItemId: recipe?.output || session.recipeId,
      totalCrafted: session.crafted,
      totalXp: session.crafted * (recipe?.xp || 0),
    });
  }

  /**
   * Cancel crafting for a player
   */
  private cancelCrafting(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (session) {
      this.completeCrafting(playerId);
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
    recipe: CraftingRecipeData,
  ): boolean {
    if (recipe.tools.length === 0) return true;
    return recipe.tools.every((tool) => state.itemIds.has(tool));
  }

  /**
   * Check if player has required input materials
   */
  private hasRequiredInputs(
    state: InventoryState,
    recipe: CraftingRecipeData,
  ): boolean {
    return recipe.inputs.every((input) => {
      const count = state.counts.get(input.item) || 0;
      return count >= input.amount;
    });
  }

  /**
   * Check if player has required consumables (e.g., thread)
   */
  private hasRequiredConsumables(
    state: InventoryState,
    recipe: CraftingRecipeData,
  ): boolean {
    if (recipe.consumables.length === 0) return true;
    return recipe.consumables.every((c) => state.itemIds.has(c.item));
  }

  /**
   * Get player's crafting level using type-safe access
   */
  private getCraftingLevel(playerId: string): number {
    // Check cached skills first
    const cachedSkills = this.playerSkills.get(playerId);
    if (cachedSkills?.crafting?.level != null) {
      return cachedSkills.crafting.level;
    }

    // Fall back to player entity using type-safe guard
    const player = this.world.getPlayer(playerId);
    if (!hasSkills(player)) return 1;
    const craftingSkill =
      player.skills?.["crafting" as keyof typeof player.skills];
    return craftingSkill?.level ?? 1;
  }

  /**
   * Check if player is currently crafting
   */
  isPlayerCrafting(playerId: string): boolean {
    return this.activeSessions.has(playerId);
  }

  /**
   * Update method - processes tick-based crafting sessions.
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
      this.completeCraft(playerId);
    }
  }

  destroy(): void {
    // Complete all active sessions
    for (const playerId of this.activeSessions.keys()) {
      this.completeCrafting(playerId);
    }
    this.activeSessions.clear();
    this.playerSkills.clear(); // Memory cleanup
  }
}
