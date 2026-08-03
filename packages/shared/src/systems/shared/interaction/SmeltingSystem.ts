/**
 * SmeltingSystem - Handles Smelting at Furnaces
 *
 * rules-accurate smelting implementation:
 * - Use ores on furnace to smelt bars
 * - Consumes primary ore, secondary ore (bronze), and coal
 * - Iron ore has 50% success rate (others always succeed)
 * - Grants smithing XP on successful smelt
 * - Auto-smelting continues until out of materials
 *
 * @see ProcessingDataProvider for smelting recipes from manifest
 */

import {
  isLooseInventoryItem,
  getItemQuantity,
  getSmithingLevelSafe,
} from "../../../constants/SmithingConstants";
import { processingDataProvider } from "../../../data/ProcessingDataProvider";
import { EventType } from "../../../types/events";
import { SystemBase } from "../infrastructure/SystemBase";
import type { World } from "../../../types/index";

/** Active smelting session for a player */
interface SmeltingSession {
  playerId: string;
  barItemId: string;
  furnaceId: string;
  startTime: number;
  quantity: number;
  smelted: number;
  failed: number;
  /** Tick when current smelt action completes (tick-based timing) */
  completionTick: number;
}

export class SmeltingSystem extends SystemBase {
  private readonly activeSessions = new Map<string, SmeltingSession>();
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
      name: "smelting",
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

    // Listen for smelting interaction (player clicked furnace)
    this.subscribe(
      EventType.SMELTING_INTERACT,
      (data: { playerId: string; furnaceId: string }) => {
        this.handleFurnaceInteract(data);
      },
    );

    // Listen for smelting request (player selected bar to smelt)
    this.subscribe(
      EventType.PROCESSING_SMELTING_REQUEST,
      (data: {
        playerId: string;
        barItemId: string;
        furnaceId: string;
        quantity: number;
      }) => {
        this.startSmelting(data);
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

    // Cancel smelting on movement (classic MMORPG: any click cancels skilling)
    this.subscribe<{
      playerId: string;
      targetPosition: { x: number; y: number; z: number };
    }>(EventType.MOVEMENT_CLICK_TO_MOVE, (data) => {
      if (this.activeSessions.has(data.playerId)) {
        this.cancelSmelting(data.playerId);
      }
    });

    // Cancel smelting on combat start
    this.subscribe(
      EventType.COMBAT_STARTED,
      (data: { attackerId: string; targetId: string }) => {
        if (this.activeSessions.has(data.attackerId)) {
          this.cancelSmelting(data.attackerId);
        }
        if (this.activeSessions.has(data.targetId)) {
          this.cancelSmelting(data.targetId);
        }
      },
    );

    // Clean up on player disconnect
    this.subscribe(
      EventType.PLAYER_UNREGISTERED,
      (data: { playerId: string }) => {
        this.cancelSmelting(data.playerId);
        this.playerSkills.delete(data.playerId); // Memory cleanup
      },
    );
  }

  /**
   * Handle furnace interaction - show available bars to smelt
   */
  private handleFurnaceInteract(data: {
    playerId: string;
    furnaceId: string;
  }): void {
    const { playerId, furnaceId } = data;

    // Check if already smelting
    if (this.activeSessions.has(playerId)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You are already smelting.",
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

    // Get available bars to smelt
    const availableBars = processingDataProvider.getSmeltableBarsFromInventory(
      inventory.map((item: { itemId: string; quantity?: number }) => ({
        itemId: item.itemId,
        quantity: item.quantity || 1,
      })),
      smithingLevel,
    );

    if (availableBars.length === 0) {
      // Check if any bars are blocked by level — give a specific message
      const inventoryItems = inventory.map(
        (item: { itemId: string; quantity?: number }) => ({
          itemId: item.itemId,
          quantity: item.quantity || 1,
        }),
      );
      const levelBlocked = processingDataProvider.getLevelBlockedBars(
        inventoryItems,
        smithingLevel,
      );

      if (levelBlocked.length > 0) {
        // Find the lowest level bar they could work toward
        const lowest = levelBlocked.reduce((a, b) =>
          a.levelRequired < b.levelRequired ? a : b,
        );
        const barName = lowest.barItemId.replace(/_/g, " ");
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId,
          message: `You need level ${lowest.levelRequired} Smithing to smelt a ${barName}.`,
          type: "error",
        });
      } else {
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId,
          message: "You don't have the ores to smelt anything.",
          type: "error",
        });
      }
      return;
    }

    // Emit event with available bars for UI to display
    // Use SMELTING_INTERFACE_OPEN (not SMELTING_INTERACT) to avoid infinite recursion
    this.emitTypedEvent(EventType.SMELTING_INTERFACE_OPEN, {
      playerId,
      furnaceId,
      availableBars: availableBars.map((bar) => ({
        barItemId: bar.barItemId,
        levelRequired: bar.levelRequired,
        primaryOre: bar.primaryOre,
        secondaryOre: bar.secondaryOre,
        coalRequired: bar.coalRequired,
      })),
    });
  }

  /**
   * Start smelting a specific bar type
   */
  private startSmelting(data: {
    playerId: string;
    barItemId: string;
    furnaceId: string;
    quantity: number;
  }): void {
    const { playerId, barItemId, furnaceId, quantity } = data;

    // Check if already smelting
    if (this.activeSessions.has(playerId)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You are already smelting.",
        type: "error",
      });
      return;
    }

    // Validate smelting data exists
    const smeltingData = processingDataProvider.getSmeltingData(barItemId);
    if (!smeltingData) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "Invalid bar type.",
        type: "error",
      });
      return;
    }

    // Check level requirement
    const smithingLevel = this.getSmithingLevel(playerId);
    if (smithingLevel < smeltingData.levelRequired) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `You need level ${smeltingData.levelRequired} Smithing to smelt that.`,
        type: "error",
      });
      return;
    }

    // Get current tick for tick-based timing
    const currentTick = this.world.currentTick ?? 0;

    // Create session with tick-based completion
    const session: SmeltingSession = {
      playerId,
      barItemId,
      furnaceId,
      startTime: Date.now(),
      quantity: Math.max(1, quantity),
      smelted: 0,
      failed: 0,
      completionTick: currentTick + smeltingData.ticks, // First smelt completes after smeltingData.ticks
    };

    this.activeSessions.set(playerId, session);

    // Show start message
    const barName = barItemId.replace("_bar", " bar");
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `You begin smelting ${barName}s.`,
      type: "info",
    });

    // Emit start event
    this.emitTypedEvent(EventType.SMELTING_START, {
      playerId,
      barItemId,
      furnaceId,
    });
  }

  /**
   * Schedule the next smelt action for a session.
   * Called after each smelt (success or failure) to queue the next one.
   */
  private scheduleNextSmelt(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (!session) return;

    // Check if we've reached the target quantity
    if (session.smelted + session.failed >= session.quantity) {
      this.completeSmelting(playerId);
      return;
    }

    // Get smelting data for tick timing
    const smeltingData = processingDataProvider.getSmeltingData(
      session.barItemId,
    );
    if (!smeltingData) {
      this.completeSmelting(playerId);
      return;
    }

    // Check materials
    if (!this.hasRequiredMaterials(playerId, session.barItemId)) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "You have run out of materials.",
        type: "info",
      });
      this.completeSmelting(playerId);
      return;
    }

    // Set completion tick for next smelt action (tick-based timing)
    const currentTick = this.world.currentTick ?? 0;
    session.completionTick = currentTick + smeltingData.ticks;
  }

  /**
   * Complete a single smelt action
   */
  private completeSmelt(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (!session) return;

    const smeltingData = processingDataProvider.getSmeltingData(
      session.barItemId,
    );
    if (!smeltingData) {
      this.completeSmelting(playerId);
      return;
    }

    // Play smelting animation (classic MMORPG-style)
    this.emitTypedEvent(EventType.ANIMATION_PLAY, {
      entityId: playerId,
      animation: "smelting",
      loop: false,
    });

    // Consume materials first
    this.consumeMaterials(playerId, smeltingData);

    // Check success (iron has 50% failure)
    const success = Math.random() < smeltingData.successRate;

    if (success) {
      // Add bar to inventory
      this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
        playerId,
        item: {
          id: `inv_${playerId}_${Date.now()}`,
          itemId: session.barItemId,
          quantity: 1,
          slot: -1,
          metadata: null,
        },
      });

      // Grant XP
      this.emitTypedEvent(EventType.SKILLS_XP_GAINED, {
        playerId,
        skill: "smithing",
        amount: smeltingData.xp,
      });

      session.smelted++;

      // Success message
      const barName = session.barItemId.replace("_bar", " bar");
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: `You smelt a ${barName}.`,
        type: "success",
      });

      // Emit success event
      this.emitTypedEvent(EventType.SMELTING_SUCCESS, {
        playerId,
        barItemId: session.barItemId,
        xpGained: smeltingData.xp,
      });
    } else {
      session.failed++;

      // Failure message (iron ore specific)
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId,
        message: "The ore is too impure and you fail to smelt it.",
        type: "warning",
      });

      // Emit failure event
      this.emitTypedEvent(EventType.SMELTING_FAILURE, {
        playerId,
        barItemId: session.barItemId,
      });
    }

    // Schedule next smelt action
    this.scheduleNextSmelt(playerId);
  }

  /**
   * Complete the smelting session
   */
  private completeSmelting(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (!session) return;

    this.activeSessions.delete(playerId);

    // Emit completion event
    this.emitTypedEvent(EventType.SMELTING_COMPLETE, {
      playerId,
      barItemId: session.barItemId,
      totalSmelted: session.smelted,
      totalFailed: session.failed,
      totalXp:
        session.smelted *
        (processingDataProvider.getSmeltingXP(session.barItemId) || 0),
    });
  }

  /**
   * Cancel smelting for a player
   */
  private cancelSmelting(playerId: string): void {
    const session = this.activeSessions.get(playerId);
    if (session) {
      this.completeSmelting(playerId);
    }
  }

  /**
   * Check if player has required materials for smelting
   */
  private hasRequiredMaterials(playerId: string, barItemId: string): boolean {
    const smeltingData = processingDataProvider.getSmeltingData(barItemId);
    if (!smeltingData) return false;

    const inventory = this.world.getInventory?.(playerId);
    if (!inventory || !Array.isArray(inventory)) return false;

    // Build item counts using type-safe guard
    const itemCounts = new Map<string, number>();
    for (const item of inventory) {
      if (!isLooseInventoryItem(item)) continue;
      itemCounts.set(
        item.itemId,
        (itemCounts.get(item.itemId) || 0) + getItemQuantity(item),
      );
    }

    // Check primary ore
    if ((itemCounts.get(smeltingData.primaryOre) || 0) < 1) {
      return false;
    }

    // Check secondary ore (bronze)
    if (smeltingData.secondaryOre) {
      if ((itemCounts.get(smeltingData.secondaryOre) || 0) < 1) {
        return false;
      }
    }

    // Check coal
    if (smeltingData.coalRequired > 0) {
      if ((itemCounts.get("coal") || 0) < smeltingData.coalRequired) {
        return false;
      }
    }

    return true;
  }

  /**
   * Consume materials for smelting
   */
  private consumeMaterials(
    playerId: string,
    smeltingData: {
      primaryOre: string;
      secondaryOre: string | null;
      coalRequired: number;
    },
  ): void {
    // Remove primary ore
    this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
      playerId,
      itemId: smeltingData.primaryOre,
      quantity: 1,
    });

    // Remove secondary ore (bronze)
    if (smeltingData.secondaryOre) {
      this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
        playerId,
        itemId: smeltingData.secondaryOre,
        quantity: 1,
      });
    }

    // Remove coal
    if (smeltingData.coalRequired > 0) {
      this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
        playerId,
        itemId: "coal",
        quantity: smeltingData.coalRequired,
      });
    }
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
   * Check if player is currently smelting
   */
  isPlayerSmelting(playerId: string): boolean {
    return this.activeSessions.has(playerId);
  }

  /**
   * Update method - processes tick-based smelting sessions.
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
      this.completeSmelt(playerId);
    }
  }

  destroy(): void {
    // Complete all active sessions
    for (const playerId of this.activeSessions.keys()) {
      this.completeSmelting(playerId);
    }
    this.activeSessions.clear();
    this.playerSkills.clear(); // Memory cleanup
  }
}
