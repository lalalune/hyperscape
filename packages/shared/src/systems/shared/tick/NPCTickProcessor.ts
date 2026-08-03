/**
 * NPCTickProcessor - Processes all NPC logic in rules-accurate order
 *
 * classic MMORPG Processing Order (per tick):
 * 1. NPC timers execute
 * 2. NPC queues process
 * 3. NPC movement
 * 4. NPC combat
 * 5. Player timers execute
 * 6. Player queues process
 *
 * This processor handles steps 1-4 for all NPCs, ensuring they process
 * in the correct order and with zero allocations in the hot path.
 *
 */

import type { TileCoord } from "../movement/TileSystem";
import { worldToTile } from "../movement/TileSystem";
import type {
  IAggroStrategy,
  IPathStrategy,
  ICombatStrategy,
  ProcessableNPC,
  NPCTarget,
} from "../../../types/systems/npc-strategies";

/**
 * Configuration for NPCTickProcessor
 */
export interface NPCTickProcessorConfig {
  /** Maximum NPCs to process per tick (for performance) */
  maxNPCsPerTick?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Statistics from tick processing
 */
export interface TickProcessingStats {
  npcsProcessed: number;
  combatActionsProcessed: number;
  movementsProcessed: number;
  wandersStarted: number;
  processingTimeMs: number;
}

/**
 * NPCTickProcessor - Single entry point for all NPC tick processing
 *
 * Ensures correct classic MMORPG processing order and zero allocations in hot paths.
 */
export class NPCTickProcessor {
  // Strategy dependencies (DIP - depend on abstractions)
  private readonly aggroStrategy: IAggroStrategy;
  private readonly pathStrategy: IPathStrategy;
  private readonly combatStrategy: ICombatStrategy;

  // Configuration
  private readonly config: Required<NPCTickProcessorConfig>;

  // Pre-allocated buffers for zero-allocation iteration
  private readonly _npcBuffer: ProcessableNPC[] = [];
  private readonly _targetBuffer: NPCTarget[] = [];
  private readonly _tempTile: TileCoord = { x: 0, z: 0 };

  // Statistics (reset each tick)
  private readonly _stats: TickProcessingStats = {
    npcsProcessed: 0,
    combatActionsProcessed: 0,
    movementsProcessed: 0,
    wandersStarted: 0,
    processingTimeMs: 0,
  };

  constructor(
    aggroStrategy: IAggroStrategy,
    pathStrategy: IPathStrategy,
    combatStrategy: ICombatStrategy,
    config: NPCTickProcessorConfig = {},
  ) {
    this.aggroStrategy = aggroStrategy;
    this.pathStrategy = pathStrategy;
    this.combatStrategy = combatStrategy;

    this.config = {
      maxNPCsPerTick: config.maxNPCsPerTick ?? 1000,
      debug: config.debug ?? false,
    };
  }

  /**
   * Process all NPCs for current tick
   *
   * Called exactly once per 600ms server tick.
   * Processes NPCs in spawn order for deterministic behavior.
   *
   * @param npcs - Map of all NPCs in the world
   * @param players - Map of all players (for target finding)
   * @param currentTick - Current server tick number
   * @returns Processing statistics
   */
  processTick(
    npcs: ReadonlyMap<string, ProcessableNPC>,
    players: ReadonlyMap<string, NPCTarget>,
    currentTick: number,
  ): TickProcessingStats {
    const startTime = performance.now();

    // Reset stats
    this._stats.npcsProcessed = 0;
    this._stats.combatActionsProcessed = 0;
    this._stats.movementsProcessed = 0;
    this._stats.wandersStarted = 0;

    // Clear and populate NPC buffer (no allocation - reuse array)
    this._npcBuffer.length = 0;
    for (const npc of npcs.values()) {
      if (!npc.isDead()) {
        this._npcBuffer.push(npc);
      }
    }

    // Process in spawn order for determinism (classic MMORPG processes NPCs by spawn order)
    this._npcBuffer.sort((a, b) => a.spawnOrder - b.spawnOrder);

    // Limit processing if needed (for performance)
    const maxToProcess = Math.min(
      this._npcBuffer.length,
      this.config.maxNPCsPerTick,
    );

    // Populate target buffer (players for aggro checks)
    this._targetBuffer.length = 0;
    for (const player of players.values()) {
      if (!player.isDead() && !player.isLoading) {
        this._targetBuffer.push(player);
      }
    }

    // Process each NPC
    for (let i = 0; i < maxToProcess; i++) {
      this.processNPC(this._npcBuffer[i], currentTick);
      this._stats.npcsProcessed++;
    }

    this._stats.processingTimeMs = performance.now() - startTime;

    if (this.config.debug && this._stats.npcsProcessed > 0) {
      console.log(
        `[NPCTickProcessor] Tick ${currentTick}: ${this._stats.npcsProcessed} NPCs, ` +
          `${this._stats.combatActionsProcessed} attacks, ` +
          `${this._stats.movementsProcessed} moves, ` +
          `${this._stats.wandersStarted} wanders ` +
          `(${this._stats.processingTimeMs.toFixed(2)}ms)`,
      );
    }

    // Return reference to internal stats object (zero allocation)
    // Caller should not modify; use getLastStats() for a safe reference
    return this._stats;
  }

  /**
   * Process a single NPC for the current tick
   *
   * classic MMORPG order within NPC processing:
   * 1. Update timers (handled externally by MobEntity)
   * 2. Process queues (handled externally by MobEntity)
   * 3. Aggro check and target selection
   * 4. Movement (if has target or wandering)
   * 5. Combat (if in range)
   */
  private processNPC(npc: ProcessableNPC, currentTick: number): void {
    // Step 3: Aggro check and target selection
    let target: NPCTarget | null = null;
    const currentTargetId = npc.getTarget();

    if (currentTargetId) {
      // Validate existing target
      target = this.findTargetById(currentTargetId);
      if (!target || target.isDead()) {
        // Target lost - clear and look for new target
        npc.setTarget(null);
        this.aggroStrategy.clearAggro(npc.id);
        target = null;
      }
    }

    // If no target, look for one
    if (!target && !npc.isInCombat()) {
      target = this.aggroStrategy.findTarget(npc, this._targetBuffer);
      if (target) {
        npc.setTarget(target.id);
      }
    }

    // Step 4: Movement
    if (target) {
      // Has target - move toward it
      const targetTile = worldToTile(target.position.x, target.position.z);
      const nextStep = this.pathStrategy.calculateNextStep(npc, targetTile);
      if (nextStep) {
        this._stats.movementsProcessed++;
      }
    } else if (npc.shouldWander(currentTick)) {
      // No target - maybe wander
      if (!npc.hasWanderPath()) {
        // Start new wander
        const wanderTarget = this.generateWanderTarget(npc);
        if (wanderTarget) {
          const nextStep = this.pathStrategy.calculateNextStep(
            npc,
            wanderTarget,
          );
          if (nextStep) {
            this._stats.wandersStarted++;
            this._stats.movementsProcessed++;
          }
        }
      } else {
        // Continue existing wander
        const nextStep = this.pathStrategy.calculateNextStep(npc, null);
        if (nextStep) {
          this._stats.movementsProcessed++;
        }
      }
    }

    // Step 5: Combat (if has target and in range)
    if (target && this.combatStrategy.canAttack(npc.id, currentTick)) {
      if (this.combatStrategy.isInRange(npc, target)) {
        this.combatStrategy.processAttack(npc, target, currentTick);
        this._stats.combatActionsProcessed++;
      }
    }
  }

  /**
   * Find a target by ID in the target buffer
   * Zero-allocation - searches pre-populated buffer
   */
  private findTargetById(targetId: string): NPCTarget | null {
    for (let i = 0; i < this._targetBuffer.length; i++) {
      if (this._targetBuffer[i].id === targetId) {
        return this._targetBuffer[i];
      }
    }
    return null;
  }

  /**
   * Generate a wander destination for an NPC
   *
   * classic MMORPG: Random offset -5 to +5 tiles from spawn point
   */
  private generateWanderTarget(npc: ProcessableNPC): TileCoord | null {
    const spawnTile = npc.getSpawnTile();

    // classic MMORPG: -5 to +5 offset from spawn (11x11 area)
    const offsetX = Math.floor(Math.random() * 11) - 5;
    const offsetZ = Math.floor(Math.random() * 11) - 5;

    // Reuse temp tile for zero allocation
    this._tempTile.x = spawnTile.x + offsetX;
    this._tempTile.z = spawnTile.z + offsetZ;

    return this._tempTile;
  }

  /**
   * Get the last processing statistics
   */
  getLastStats(): Readonly<TickProcessingStats> {
    return this._stats;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this._npcBuffer.length = 0;
    this._targetBuffer.length = 0;
  }
}
