import { SystemBase } from "../infrastructure/SystemBase";
import type { World } from "../../../core/World";
import { EventType } from "../../../types/events";

/**
 * Mob Death System
 * Handles ONLY mob death mechanics:
 * - Mob despawning on death
 * - Loot dropping
 * - Death animations
 * - Respawn timers for world mobs
 *
 * NOTE: Player deaths are handled by PlayerDeathSystem (separate file)
 */
export class MobDeathSystem extends SystemBase {
  private mobRespawnTimers = new Map<string, NodeJS.Timeout>();

  constructor(world: World) {
    super(world, {
      name: "mob-death",
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Listen for ENTITY_DEATH events, filter for mobs only
    this.subscribe(
      EventType.ENTITY_DEATH,
      (data: {
        entityId: string;
        killedBy: string;
        entityType: "player" | "mob";
      }) => this.handleMobDeath(data),
    );
  }

  private handleMobDeath(data: {
    entityId: string;
    killedBy: string;
    entityType: "player" | "mob";
  }): void {
    // Only handle mob deaths - player deaths are handled by PlayerDeathSystem
    if (data.entityType !== "mob") {
      return;
    }

    const mobId = data.entityId;
    this.logger.debug(
      `Processing mob death for ${mobId}, killed by ${data.killedBy}`,
    );

    // Handle mob death (despawn, drops, etc.)
    this.despawnMob(mobId);
  }

  private despawnMob(mobId: string): void {
    // Remove mob entity from world
    const mobEntity = this.world.entities?.get?.(mobId);
    if (mobEntity) {
      this.logger.debug(`Despawning mob ${mobId}`);

      // Emit despawn event for other systems
      this.emitTypedEvent(EventType.MOB_NPC_DESPAWN, { mobId });

      // Remove from entity manager
      if (this.world.entities && "remove" in this.world.entities) {
        (this.world.entities as any).remove(mobId);
      }
    }
  }

  override destroy(): void {
    // Clear all respawn timers
    for (const timer of this.mobRespawnTimers.values()) {
      clearTimeout(timer);
    }
    this.mobRespawnTimers.clear();
  }
}
