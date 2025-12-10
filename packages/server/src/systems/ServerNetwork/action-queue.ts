/**
 * Action Queue System
 *
 * OSRS-style action queue that processes player inputs on tick boundaries.
 * This ensures fair, predictable timing for all players regardless of
 * connection speed or click rate.
 *
 * Key behaviors:
 * - Actions are queued and processed once per tick (600ms)
 * - Movement actions REPLACE previous movement (no queue)
 * - Combat actions set a persistent target (continues across ticks)
 * - Interaction actions can be queued (up to limit)
 * - Each player has their own queue
 *
 * OSRS Reference:
 * - Walk-here replaces current movement, doesn't queue
 * - Attack sets target, combat continues until target dead/out of range
 * - Use-item queues if busy, executes when possible
 */

import type { ServerSocket } from "../../shared/types";

/**
 * Types of actions that can be queued
 */
export enum ActionType {
  /** Walk/run to a tile - replaces previous movement */
  MOVEMENT = "movement",
  /** Attack a target - sets persistent combat target */
  COMBAT = "combat",
  /** Interact with object/NPC - can queue */
  INTERACTION = "interaction",
  /** Cancel current action */
  CANCEL = "cancel",
}

/**
 * Priority levels for actions (lower = higher priority)
 * Used when multiple actions arrive in the same tick
 */
export enum ActionPriority {
  CANCEL = 0, // Cancel always wins
  COMBAT = 1, // Combat is high priority
  INTERACTION = 2, // Interactions next
  MOVEMENT = 3, // Movement is default
}

/**
 * A queued action waiting to be processed
 */
export interface QueuedAction {
  type: ActionType;
  playerId: string;
  socket: ServerSocket;
  data: unknown;
  timestamp: number;
  priority: ActionPriority;
}

/**
 * Per-player queue state
 */
interface PlayerQueueState {
  /** Pending action for next tick (only one primary action per tick) */
  pendingAction: QueuedAction | null;
  /** Queued interactions (processed after primary action) */
  interactionQueue: QueuedAction[];
  /** Persistent combat target (continues across ticks until cleared) */
  combatTarget: string | null;
  /** Last tick this player's actions were processed */
  lastProcessedTick: number;
}

/** Maximum queued interactions per player */
const MAX_INTERACTION_QUEUE = 5;

/** Maximum age of an action before it's discarded (ms) */
const MAX_ACTION_AGE_MS = 10000; // 10 seconds

/**
 * Action Queue Manager
 *
 * Manages action queues for all players and processes them on tick boundaries.
 */
export class ActionQueue {
  private playerQueues: Map<string, PlayerQueueState> = new Map();

  // Action handlers - set by ServerNetwork
  private moveHandler: ((socket: ServerSocket, data: unknown) => void) | null =
    null;
  private combatHandler:
    | ((socket: ServerSocket, data: unknown) => void)
    | null = null;
  private interactionHandler:
    | ((socket: ServerSocket, data: unknown) => void)
    | null = null;

  /**
   * Register action handlers
   */
  setHandlers(handlers: {
    movement?: (socket: ServerSocket, data: unknown) => void;
    combat?: (socket: ServerSocket, data: unknown) => void;
    interaction?: (socket: ServerSocket, data: unknown) => void;
  }): void {
    if (handlers.movement) this.moveHandler = handlers.movement;
    if (handlers.combat) this.combatHandler = handlers.combat;
    if (handlers.interaction) this.interactionHandler = handlers.interaction;
  }

  /**
   * Get or create queue state for a player
   */
  private getOrCreateState(playerId: string): PlayerQueueState {
    let state = this.playerQueues.get(playerId);
    if (!state) {
      state = {
        pendingAction: null,
        interactionQueue: [],
        combatTarget: null,
        lastProcessedTick: 0,
      };
      this.playerQueues.set(playerId, state);
    }
    return state;
  }

  /**
   * Queue a movement action
   * Movement ALWAYS replaces pending action (OSRS behavior)
   * In OSRS, clicking the ground immediately cancels whatever you're doing
   */
  queueMovement(socket: ServerSocket, data: unknown): void {
    const playerId = socket.player?.id;
    if (!playerId) {
      return;
    }

    const state = this.getOrCreateState(playerId);
    const action: QueuedAction = {
      type: ActionType.MOVEMENT,
      playerId,
      socket,
      data,
      timestamp: Date.now(),
      priority: ActionPriority.MOVEMENT,
    };

    // Movement always replaces pending action (OSRS: ground click cancels all)
    state.pendingAction = action;

    // Clear combat target when player clicks to move elsewhere
    // (OSRS behavior: clicking ground cancels combat)
    state.combatTarget = null;
  }

  /**
   * Queue a combat action
   * Sets persistent combat target that continues across ticks
   * OSRS behavior: clicking new target switches immediately
   */
  queueCombat(socket: ServerSocket, data: unknown): void {
    const playerId = socket.player?.id;
    if (!playerId) {
      return;
    }

    const state = this.getOrCreateState(playerId);
    const payload = data as { mobId?: string; targetId?: string };
    const targetId = payload.mobId || payload.targetId;

    if (!targetId) {
      return;
    }

    // Set persistent combat target (replaces any existing target)
    state.combatTarget = targetId;

    // Queue combat action for this tick
    const action: QueuedAction = {
      type: ActionType.COMBAT,
      playerId,
      socket,
      data,
      timestamp: Date.now(),
      priority: ActionPriority.COMBAT,
    };

    // Combat replaces pending action if:
    // - No pending action exists
    // - Pending action is lower priority (movement)
    // - Pending action is also combat (target switch)
    if (
      !state.pendingAction ||
      state.pendingAction.priority >= action.priority
    ) {
      state.pendingAction = action;
    }
  }

  /**
   * Queue an interaction action
   * Interactions can queue up to MAX_INTERACTION_QUEUE
   */
  queueInteraction(socket: ServerSocket, data: unknown): void {
    const playerId = socket.player?.id;
    if (!playerId) return;

    const state = this.getOrCreateState(playerId);

    // Limit queue size
    if (state.interactionQueue.length >= MAX_INTERACTION_QUEUE) {
      state.interactionQueue.shift();
    }

    const action: QueuedAction = {
      type: ActionType.INTERACTION,
      playerId,
      socket,
      data,
      timestamp: Date.now(),
      priority: ActionPriority.INTERACTION,
    };

    state.interactionQueue.push(action);
  }

  /**
   * Cancel current action and clear queue
   */
  cancelActions(playerId: string): void {
    const state = this.playerQueues.get(playerId);
    if (!state) return;

    state.pendingAction = null;
    state.interactionQueue = [];
    state.combatTarget = null;
  }

  /**
   * Process all queued actions for this tick
   * Called by TickSystem at INPUT priority
   */
  processTick(tickNumber: number): void {
    const now = Date.now();

    for (const [_playerId, state] of this.playerQueues) {
      // Skip if already processed this tick
      if (state.lastProcessedTick >= tickNumber) {
        continue;
      }
      state.lastProcessedTick = tickNumber;

      // Process pending primary action
      if (state.pendingAction) {
        const action = state.pendingAction;

        // Check if action is too old
        if (now - action.timestamp > MAX_ACTION_AGE_MS) {
          state.pendingAction = null;
        } else {
          this.executeAction(action);
          state.pendingAction = null;
        }
      }

      // Process one queued interaction per tick (if no primary action)
      if (state.interactionQueue.length > 0 && !state.pendingAction) {
        const interaction = state.interactionQueue.shift()!;

        // Check if interaction is too old
        if (now - interaction.timestamp <= MAX_ACTION_AGE_MS) {
          this.executeAction(interaction);
        }
      }

      // Note: Persistent combat (continuing to attack across ticks) is handled
      // by the CombatSystem, not the ActionQueue. The ActionQueue's role is to
      // queue the initial attack; the CombatSystem manages attack cooldowns and
      // continues attacking until target is dead/out of range/cancelled.
      // We store combatTarget for potential future use (e.g., re-engage if
      // target returns to range) but currently the CombatSystem handles this.
    }
  }

  /**
   * Execute a single action
   */
  private executeAction(action: QueuedAction): void {
    try {
      switch (action.type) {
        case ActionType.MOVEMENT:
          if (this.moveHandler) {
            this.moveHandler(action.socket, action.data);
          }
          break;

        case ActionType.COMBAT:
          if (this.combatHandler) {
            this.combatHandler(action.socket, action.data);
          }
          break;

        case ActionType.INTERACTION:
          if (this.interactionHandler) {
            this.interactionHandler(action.socket, action.data);
          }
          break;

        case ActionType.CANCEL:
          // Cancel is handled by cancelActions()
          break;
      }
    } catch (error) {
      console.error(
        `[ActionQueue] Error executing ${action.type} action for player ${action.playerId}:`,
        error,
      );
    }
  }

  /**
   * Clear combat target for a player
   * Called when combat ends (target dies, out of range, etc.)
   */
  clearCombatTarget(playerId: string): void {
    const state = this.playerQueues.get(playerId);
    if (state) {
      state.combatTarget = null;
    }
  }

  /**
   * Get combat target for a player
   */
  getCombatTarget(playerId: string): string | null {
    return this.playerQueues.get(playerId)?.combatTarget || null;
  }

  /**
   * Check if player has pending actions
   */
  hasPendingActions(playerId: string): boolean {
    const state = this.playerQueues.get(playerId);
    if (!state) return false;
    return state.pendingAction !== null || state.interactionQueue.length > 0;
  }

  /**
   * Clean up state for a disconnected player
   */
  cleanup(playerId: string): void {
    this.playerQueues.delete(playerId);
  }

  /**
   * Get queue stats (for debugging/monitoring)
   */
  getStats(): {
    totalPlayers: number;
    playersWithPending: number;
    totalQueuedInteractions: number;
  } {
    let playersWithPending = 0;
    let totalQueuedInteractions = 0;

    for (const state of this.playerQueues.values()) {
      if (state.pendingAction) playersWithPending++;
      totalQueuedInteractions += state.interactionQueue.length;
    }

    return {
      totalPlayers: this.playerQueues.size,
      playersWithPending,
      totalQueuedInteractions,
    };
  }
}
