/**
 * ScriptQueue - OSRS-Accurate Script Priority System
 *
 * Implements the RuneScape queue script priority system:
 *
 * STRONG (Priority 0):
 *   - Removes all WEAK scripts from queue
 *   - Closes modal interfaces (bank, shop, dialogue)
 *   - Cannot be interrupted by other scripts
 *   - Examples: Damage, teleports, death
 *
 * NORMAL (Priority 1):
 *   - Skipped if modal interface is open (retries next tick)
 *   - Can be queued behind other scripts
 *   - Examples: Most player actions, clicking on objects
 *
 * WEAK (Priority 2):
 *   - Removed if any STRONG script executes
 *   - Cleared by walk-here and other interactions
 *   - Examples: NPC dialogue options, some skilling actions
 *
 * SOFT (Priority 3):
 *   - Cannot be paused or interrupted
 *   - Always executes regardless of other queue state
 *   - Examples: System messages, login scripts
 *
 * IMPORTANT OSRS DIFFERENCE:
 * - Players have all 4 queue types
 * - NPCs have only ONE queue type (all scripts are equal priority)
 *
 * @see https://oldschool.runescape.wiki/w/Tick
 * @see COMBAT_SYSTEM_AUDIT.md for full OSRS research
 */

import type { ServerSocket } from "../../shared/types";
import { getCachedTimestamp } from "@hyperforge/shared";

/**
 * Script priority levels (OSRS-accurate)
 * Lower number = higher priority
 */
export enum ScriptPriority {
  /** Removes weak scripts, closes modals, uninterruptible */
  STRONG = 0,
  /** Skipped if modal open, retries next tick */
  NORMAL = 1,
  /** Removed by strong scripts, cleared by interactions */
  WEAK = 2,
  /** Always executes, cannot be paused */
  SOFT = 3,
}

/**
 * Script types that can be queued
 */
export enum ScriptType {
  /** Movement script (walk/run to tile) */
  MOVEMENT = "movement",
  /** Combat script (attack target) */
  COMBAT = "combat",
  /** Interaction script (use item, talk to NPC) */
  INTERACTION = "interaction",
  /** Damage script (apply damage, always STRONG) */
  DAMAGE = "damage",
  /** Teleport script (always STRONG) */
  TELEPORT = "teleport",
  /** Death script (always STRONG) */
  DEATH = "death",
  /** System script (always SOFT) */
  SYSTEM = "system",
  /** Cancel script (clears queue) */
  CANCEL = "cancel",
}

/**
 * A queued script waiting to be executed
 */
export interface QueuedScript {
  /** Unique ID for this script instance */
  id: string;
  /** Type of script */
  type: ScriptType;
  /** Priority level */
  priority: ScriptPriority;
  /** Entity ID this script belongs to */
  entityId: string;
  /** Socket for player scripts (null for NPC scripts) */
  socket: ServerSocket | null;
  /** Script data/payload */
  data: unknown;
  /** When this script was queued */
  timestamp: number;
  /** Tick this script should execute on (0 = ASAP) */
  executeOnTick: number;
  /** Number of ticks this script has been delayed (for NORMAL scripts) */
  delayedTicks: number;
  /** Whether this script has been executed */
  executed: boolean;
}

/**
 * Modal state for a player (affects NORMAL script processing)
 */
export interface ModalState {
  /** Is bank interface open */
  bankOpen: boolean;
  /** Is shop interface open */
  shopOpen: boolean;
  /** Is dialogue open */
  dialogueOpen: boolean;
  /** Is trade open */
  tradeOpen: boolean;
  /** Generic modal open flag */
  anyModalOpen: boolean;
}

/**
 * Per-entity script queue state
 */
interface EntityScriptState {
  /** Scripts sorted by priority */
  scripts: QueuedScript[];
  /** Modal state (players only) */
  modal: ModalState;
  /** Last tick processed */
  lastProcessedTick: number;
  /** Script counter for unique IDs */
  scriptCounter: number;
}

/** Maximum scripts per entity to prevent memory issues */
const MAX_SCRIPTS_PER_ENTITY = 20;

/** Maximum age of a script before it's discarded (ms) */
const MAX_SCRIPT_AGE_MS = 30000; // 30 seconds

/** Maximum ticks a NORMAL script can be delayed before discard */
const MAX_NORMAL_DELAY_TICKS = 10;

/**
 * PlayerScriptQueue - Script queue for players with full priority system
 *
 * Processes scripts in priority order (STRONG > NORMAL > WEAK > SOFT)
 * with OSRS-accurate interruption and modal handling.
 */
export class PlayerScriptQueue {
  private playerStates: Map<string, EntityScriptState> = new Map();
  private currentTick = 0;

  // Script handlers - set by ServerNetwork
  private handlers: Map<
    ScriptType,
    (playerId: string, socket: ServerSocket, data: unknown) => void
  > = new Map();

  // ============================================================================
  // PRE-ALLOCATED BUFFERS (Zero-allocation hot path support)
  // ============================================================================

  /** Pre-allocated array for scripts to execute during processPlayerTick */
  private readonly _toExecute: QueuedScript[] = [];

  /** Pre-allocated array for scripts to retain during processPlayerTick */
  private readonly _toRetain: QueuedScript[] = [];

  /**
   * Register a handler for a script type
   */
  setHandler(
    type: ScriptType,
    handler: (playerId: string, socket: ServerSocket, data: unknown) => void,
  ): void {
    this.handlers.set(type, handler);
  }

  /**
   * Get or create queue state for a player
   */
  private getOrCreateState(playerId: string): EntityScriptState {
    let state = this.playerStates.get(playerId);
    if (!state) {
      state = {
        scripts: [],
        modal: {
          bankOpen: false,
          shopOpen: false,
          dialogueOpen: false,
          tradeOpen: false,
          anyModalOpen: false,
        },
        lastProcessedTick: 0,
        scriptCounter: 0,
      };
      this.playerStates.set(playerId, state);
    }
    return state;
  }

  /**
   * Queue a script for a player
   *
   * @param playerId - Player entity ID
   * @param socket - Player socket
   * @param type - Script type
   * @param priority - Script priority (auto-assigned for some types)
   * @param data - Script payload
   * @param executeOnTick - Tick to execute on (0 = next available)
   */
  queueScript(
    playerId: string,
    socket: ServerSocket,
    type: ScriptType,
    priority: ScriptPriority,
    data: unknown,
    executeOnTick = 0,
  ): string {
    const state = this.getOrCreateState(playerId);

    // Auto-assign priority for certain script types
    let effectivePriority = priority;
    if (
      type === ScriptType.DAMAGE ||
      type === ScriptType.DEATH ||
      type === ScriptType.TELEPORT
    ) {
      effectivePriority = ScriptPriority.STRONG;
    } else if (type === ScriptType.SYSTEM) {
      effectivePriority = ScriptPriority.SOFT;
    }

    // Generate unique script ID
    state.scriptCounter++;
    const scriptId = `${playerId}-${state.scriptCounter}`;

    const script: QueuedScript = {
      id: scriptId,
      type,
      priority: effectivePriority,
      entityId: playerId,
      socket,
      data,
      timestamp: getCachedTimestamp(),
      executeOnTick,
      delayedTicks: 0,
      executed: false,
    };

    // OSRS RULE: STRONG scripts remove all WEAK scripts
    if (effectivePriority === ScriptPriority.STRONG) {
      state.scripts = state.scripts.filter(
        (s) => s.priority !== ScriptPriority.WEAK,
      );
    }

    // OSRS RULE: Movement (walk-here) clears WEAK scripts
    if (type === ScriptType.MOVEMENT) {
      state.scripts = state.scripts.filter(
        (s) => s.priority !== ScriptPriority.WEAK,
      );
    }

    // Limit queue size
    if (state.scripts.length >= MAX_SCRIPTS_PER_ENTITY) {
      // Remove oldest non-STRONG script
      const oldestIndex = state.scripts.findIndex(
        (s) => s.priority !== ScriptPriority.STRONG,
      );
      if (oldestIndex !== -1) {
        state.scripts.splice(oldestIndex, 1);
      }
    }

    // Insert script in priority order (maintain stable sort)
    let insertIndex = state.scripts.length;
    for (let i = 0; i < state.scripts.length; i++) {
      if (state.scripts[i].priority > effectivePriority) {
        insertIndex = i;
        break;
      }
    }
    state.scripts.splice(insertIndex, 0, script);

    return scriptId;
  }

  /**
   * Queue a STRONG script (damage, teleport, death)
   */
  queueStrong(
    playerId: string,
    socket: ServerSocket,
    type: ScriptType,
    data: unknown,
  ): string {
    return this.queueScript(
      playerId,
      socket,
      type,
      ScriptPriority.STRONG,
      data,
    );
  }

  /**
   * Queue a NORMAL script (most player actions)
   */
  queueNormal(
    playerId: string,
    socket: ServerSocket,
    type: ScriptType,
    data: unknown,
  ): string {
    return this.queueScript(
      playerId,
      socket,
      type,
      ScriptPriority.NORMAL,
      data,
    );
  }

  /**
   * Queue a WEAK script (dialogue options, some skilling)
   */
  queueWeak(
    playerId: string,
    socket: ServerSocket,
    type: ScriptType,
    data: unknown,
  ): string {
    return this.queueScript(playerId, socket, type, ScriptPriority.WEAK, data);
  }

  /**
   * Queue a SOFT script (system messages)
   */
  queueSoft(
    playerId: string,
    socket: ServerSocket,
    type: ScriptType,
    data: unknown,
  ): string {
    return this.queueScript(playerId, socket, type, ScriptPriority.SOFT, data);
  }

  /**
   * Set modal state for a player
   */
  setModalState(playerId: string, modal: Partial<ModalState>): void {
    const state = this.getOrCreateState(playerId);
    Object.assign(state.modal, modal);
    state.modal.anyModalOpen =
      state.modal.bankOpen ||
      state.modal.shopOpen ||
      state.modal.dialogueOpen ||
      state.modal.tradeOpen;
  }

  /**
   * Close all modals for a player (called by STRONG scripts)
   */
  closeAllModals(playerId: string): void {
    const state = this.playerStates.get(playerId);
    if (state) {
      state.modal = {
        bankOpen: false,
        shopOpen: false,
        dialogueOpen: false,
        tradeOpen: false,
        anyModalOpen: false,
      };
    }
  }

  /**
   * Clear all scripts for a player (cancel action)
   */
  clearScripts(playerId: string): void {
    const state = this.playerStates.get(playerId);
    if (state) {
      // Only clear non-STRONG scripts (STRONG scripts cannot be cancelled)
      state.scripts = state.scripts.filter(
        (s) => s.priority === ScriptPriority.STRONG,
      );
    }
  }

  /**
   * Process scripts for a specific player on this tick
   *
   * OSRS Order (for players):
   * 1. SOFT scripts execute first (always)
   * 2. STRONG scripts execute and close modals
   * 3. NORMAL scripts execute if no modal open (else delay)
   * 4. WEAK scripts execute if no STRONG pending
   *
   * Zero-allocation: Uses pre-allocated toExecute/toRetain arrays.
   */
  processPlayerTick(playerId: string, tickNumber: number): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    // Skip if already processed this tick
    if (state.lastProcessedTick >= tickNumber) return;
    state.lastProcessedTick = tickNumber;
    this.currentTick = tickNumber;

    const now = getCachedTimestamp();
    // Clear and reuse pre-allocated buffers (zero allocation)
    this._toExecute.length = 0;
    this._toRetain.length = 0;

    // Sort scripts into execute vs retain
    for (let i = 0; i < state.scripts.length; i++) {
      const script = state.scripts[i];
      // Skip already executed scripts
      if (script.executed) continue;

      // Discard old scripts
      if (now - script.timestamp > MAX_SCRIPT_AGE_MS) continue;

      // Check execute tick
      if (script.executeOnTick > tickNumber) {
        this._toRetain.push(script);
        continue;
      }

      // Process by priority
      switch (script.priority) {
        case ScriptPriority.SOFT:
          // SOFT always executes
          this._toExecute.push(script);
          break;

        case ScriptPriority.STRONG:
          // STRONG always executes and closes modals
          this.closeAllModals(playerId);
          this._toExecute.push(script);
          break;

        case ScriptPriority.NORMAL:
          // NORMAL skipped if modal open (retry next tick)
          if (state.modal.anyModalOpen) {
            script.delayedTicks++;
            if (script.delayedTicks < MAX_NORMAL_DELAY_TICKS) {
              this._toRetain.push(script);
            }
            // else: discard after too many delays
          } else {
            this._toExecute.push(script);
          }
          break;

        case ScriptPriority.WEAK: {
          // WEAK executes if no STRONG in queue
          let hasStrong = false;
          for (let j = 0; j < state.scripts.length; j++) {
            const s = state.scripts[j];
            if (s.priority === ScriptPriority.STRONG && !s.executed) {
              hasStrong = true;
              break;
            }
          }
          if (!hasStrong) {
            this._toExecute.push(script);
          }
          // WEAK is removed by STRONG, don't retain
          break;
        }
      }
    }

    // Update scripts list with retained scripts only (reuse array)
    state.scripts.length = 0;
    for (let i = 0; i < this._toRetain.length; i++) {
      state.scripts.push(this._toRetain[i]);
    }

    // Execute scripts in order
    for (let i = 0; i < this._toExecute.length; i++) {
      this.executeScript(this._toExecute[i]);
    }
  }

  /**
   * Execute a single script
   */
  private executeScript(script: QueuedScript): void {
    script.executed = true;

    const handler = this.handlers.get(script.type);
    if (handler && script.socket) {
      try {
        handler(script.entityId, script.socket, script.data);
      } catch (error) {
        console.error(
          `[PlayerScriptQueue] Error executing ${script.type} script for ${script.entityId}:`,
          error,
        );
      }
    }
  }

  /**
   * Check if player has pending scripts
   */
  hasPendingScripts(playerId: string): boolean {
    const state = this.playerStates.get(playerId);
    return state ? state.scripts.length > 0 : false;
  }

  /**
   * Get pending script count by priority
   */
  getScriptCounts(playerId: string): Record<ScriptPriority, number> {
    const counts = {
      [ScriptPriority.STRONG]: 0,
      [ScriptPriority.NORMAL]: 0,
      [ScriptPriority.WEAK]: 0,
      [ScriptPriority.SOFT]: 0,
    };

    const state = this.playerStates.get(playerId);
    if (state) {
      for (const script of state.scripts) {
        counts[script.priority]++;
      }
    }

    return counts;
  }

  /**
   * Clean up state for disconnected player
   */
  cleanup(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  /**
   * Get queue stats for debugging
   */
  getStats(): {
    totalPlayers: number;
    totalScripts: number;
    scriptsByPriority: Record<ScriptPriority, number>;
  } {
    let totalScripts = 0;
    const byPriority = {
      [ScriptPriority.STRONG]: 0,
      [ScriptPriority.NORMAL]: 0,
      [ScriptPriority.WEAK]: 0,
      [ScriptPriority.SOFT]: 0,
    };

    for (const state of this.playerStates.values()) {
      totalScripts += state.scripts.length;
      for (const script of state.scripts) {
        byPriority[script.priority]++;
      }
    }

    return {
      totalPlayers: this.playerStates.size,
      totalScripts,
      scriptsByPriority: byPriority,
    };
  }

  /**
   * Destroy the script queue and clear all state
   * Called during server shutdown to prevent memory leaks
   */
  destroy(): void {
    this.playerStates.clear();
    this.handlers.clear();
  }
}

/**
 * NPCScriptQueue - Simplified script queue for NPCs
 *
 * OSRS DIFFERENCE: NPCs have only ONE queue type - all scripts are equal priority.
 * This is much simpler than the player queue.
 */
export class NPCScriptQueue {
  private npcStates: Map<string, QueuedScript[]> = new Map();
  private currentTick = 0;

  // Script handler for NPC scripts
  private handler: ((npcId: string, data: unknown) => void) | null = null;

  // ============================================================================
  // PRE-ALLOCATED BUFFERS (Zero-allocation hot path support)
  // ============================================================================

  /** Pre-allocated array for scripts to execute during processNPCTick */
  private readonly _toExecuteNPC: QueuedScript[] = [];

  /** Pre-allocated array for scripts to retain during processNPCTick */
  private readonly _toRetainNPC: QueuedScript[] = [];

  /**
   * Set the NPC script handler
   */
  setHandler(handler: (npcId: string, data: unknown) => void): void {
    this.handler = handler;
  }

  /**
   * Queue a script for an NPC
   *
   * NPCs don't have priority levels - all scripts are FIFO
   */
  queueScript(
    npcId: string,
    type: ScriptType,
    data: unknown,
    executeOnTick = 0,
  ): string {
    let scripts = this.npcStates.get(npcId);
    if (!scripts) {
      scripts = [];
      this.npcStates.set(npcId, scripts);
    }

    // Limit queue size
    if (scripts.length >= MAX_SCRIPTS_PER_ENTITY) {
      scripts.shift();
    }

    const scriptId = `${npcId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const script: QueuedScript = {
      id: scriptId,
      type,
      priority: ScriptPriority.NORMAL, // NPCs don't use priority
      entityId: npcId,
      socket: null,
      data,
      timestamp: getCachedTimestamp(),
      executeOnTick,
      delayedTicks: 0,
      executed: false,
    };

    scripts.push(script);
    return scriptId;
  }

  /**
   * Process scripts for a specific NPC on this tick
   *
   * NPCs process scripts in FIFO order (no priority system)
   */
  processNPCTick(npcId: string, tickNumber: number): void {
    this.currentTick = tickNumber;
    const scripts = this.npcStates.get(npcId);
    if (!scripts || scripts.length === 0) return;

    const now = getCachedTimestamp();
    // Zero-allocation: Clear and reuse pre-allocated buffers
    this._toExecuteNPC.length = 0;
    this._toRetainNPC.length = 0;

    for (const script of scripts) {
      if (script.executed) continue;

      // Discard old scripts
      if (now - script.timestamp > MAX_SCRIPT_AGE_MS) continue;

      // Check execute tick
      if (script.executeOnTick > tickNumber) {
        this._toRetainNPC.push(script);
        continue;
      }

      this._toExecuteNPC.push(script);
    }

    // Update scripts - copy from buffer to avoid sharing reference
    scripts.length = 0;
    for (const script of this._toRetainNPC) {
      scripts.push(script);
    }

    // Execute scripts (FIFO - process first one only per tick like OSRS)
    if (this._toExecuteNPC.length > 0 && this.handler) {
      const script = this._toExecuteNPC[0];
      script.executed = true;
      try {
        this.handler(script.entityId, script.data);
      } catch (error) {
        console.error(
          `[NPCScriptQueue] Error executing ${script.type} script for ${script.entityId}:`,
          error,
        );
      }

      // Put remaining scripts back in queue
      for (let i = 1; i < this._toExecuteNPC.length; i++) {
        scripts.push(this._toExecuteNPC[i]);
      }
    }
  }

  /**
   * Clear all scripts for an NPC
   */
  clearScripts(npcId: string): void {
    this.npcStates.delete(npcId);
  }

  /**
   * Check if NPC has pending scripts
   */
  hasPendingScripts(npcId: string): boolean {
    const scripts = this.npcStates.get(npcId);
    return scripts ? scripts.length > 0 : false;
  }

  /**
   * Get pending script count for NPC
   */
  getScriptCount(npcId: string): number {
    return this.npcStates.get(npcId)?.length ?? 0;
  }

  /**
   * Clean up state for despawned NPC
   */
  cleanup(npcId: string): void {
    this.npcStates.delete(npcId);
  }

  /**
   * Get queue stats for debugging
   */
  getStats(): { totalNPCs: number; totalScripts: number } {
    let totalScripts = 0;
    for (const scripts of this.npcStates.values()) {
      totalScripts += scripts.length;
    }
    return {
      totalNPCs: this.npcStates.size,
      totalScripts,
    };
  }

  /**
   * Destroy the script queue and clear all state
   * Called during server shutdown to prevent memory leaks
   */
  destroy(): void {
    this.npcStates.clear();
    this.handler = null;
  }
}
