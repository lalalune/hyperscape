/**
 * CombatEntityResolver - Entity lookup and query utilities for combat
 *
 * Single Responsibility: Resolve entity references and query entity state.
 * Extracted from CombatSystem to reduce god class size.
 */

import type { World } from "../../../core/World";
import type { EntityID } from "../../../types/core/identifiers";
import { MobEntity } from "../../../entities/npc/MobEntity";
import { Entity } from "../../../entities/Entity";
import { COMBAT_CONSTANTS } from "../../../constants/CombatConstants";
import { getItem } from "../../../data/items";
import { isMobEntity } from "../../../utils/typeGuards";

/**
 * Interface for entity manager operations
 */
interface EntityManager {
  getEntity(id: string): Entity | undefined;
}

/**
 * Logger interface for debug output
 */
interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
}

export class CombatEntityResolver {
  private entityManager?: EntityManager;
  private logger?: Logger;

  constructor(
    private world: World,
    entityManager?: EntityManager,
    logger?: Logger,
  ) {
    this.entityManager = entityManager;
    this.logger = logger;
  }

  /**
   * Set entity manager after initialization
   * Called from CombatSystem.init() after EntityManager is available
   */
  setEntityManager(entityManager: EntityManager | undefined): void {
    this.entityManager = entityManager;
  }

  /**
   * Set logger for debug output
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Resolve an entity by ID and type
   * @param entityId - Entity ID to look up
   * @param entityType - Type hint ("player" or "mob")
   * @returns Entity if found, null otherwise
   */
  resolve(entityId: string, entityType: string): Entity | MobEntity | null {
    if (entityType === "mob") {
      const entity = this.world.entities.get(entityId);
      if (!entity) {
        return null;
      }
      return isMobEntity(entity) ? entity : (entity as Entity);
    }

    if (entityType === "player") {
      const player = this.world.entities.players.get(entityId);
      if (!player) {
        return null;
      }
      return player;
    }

    if (!this.entityManager) {
      this.logger?.warn("Entity manager not available");
      return null;
    }
    const entity = this.entityManager.getEntity(entityId);
    if (!entity) {
      return null;
    }
    return entity ?? null;
  }

  /**
   * Determine entity type from entity ID
   * @param entityId - Entity ID to check
   * @returns "player" or "mob" based on entity lookup
   */
  resolveType(entityId: string): "player" | "mob" {
    if (this.world.entities.players.has(entityId)) {
      return "player";
    }

    const entity = this.world.entities.get(entityId);
    if (entity instanceof MobEntity) {
      return "mob";
    }

    return "mob";
  }

  /**
   * Get current health of an entity
   * @param entity - Entity to check
   * @returns Current health value (0 if entity is null or has no health)
   */
  getHealth(entity: Entity | MobEntity | null): number {
    if (!entity) {
      return 0;
    }

    try {
      const health = entity.getHealth();
      return Math.max(0, health);
    } catch {
      return 0;
    }
  }

  /**
   * Check if entity is alive
   * @param entity - Entity to check
   * @param entityType - Type of entity ("player" or "mob")
   * @returns true if entity is alive, false otherwise
   */
  isAlive(entity: Entity | MobEntity | null, entityType: string): boolean {
    if (!entity) return false;

    if (entityType === "player") {
      const player = entity as Entity;
      const healthComponent = player.getComponent("health");
      if (healthComponent?.data) {
        const health = healthComponent.data as {
          current: number;
          isDead?: boolean;
        };
        return health.current > 0 && !health.isDead;
      }
      const playerHealth = player.getHealth();
      return playerHealth > 0;
    }

    if (entityType === "mob" && isMobEntity(entity)) {
      if (typeof entity.isDead === "function" && entity.isDead()) {
        return false;
      }

      const mobData = entity.getMobData();
      if (mobData && typeof mobData.health === "number") {
        return mobData.health > 0;
      }

      if (typeof entity.getHealth === "function") {
        return entity.getHealth() > 0;
      }
      return false;
    }

    return false;
  }

  /**
   * Get display name for a target entity
   * @param entity - Entity to get name for
   * @returns Display name string
   */
  getDisplayName(entity: Entity | MobEntity | null): string {
    if (!entity) return "Unknown";
    if (isMobEntity(entity)) {
      return entity.getMobData().name;
    }
    return entity.name || "Enemy";
  }

  /**
   * Get attack speed in TICKS for an entity (rules-accurate)
   * @param entityId - Entity ID to check
   * @param entityType - Type of entity ("player" or "mob")
   * @returns Attack speed in game ticks (default: 4 ticks = 2.4 seconds)
   */
  getAttackSpeed(entityId: EntityID, entityType: string): number {
    if (entityType === "player") {
      const equipmentSystem = this.world.getSystem?.("equipment") as
        | {
            getPlayerEquipment?: (id: string) => {
              weapon?: { item?: { attackSpeed?: number; id?: string } };
            } | null;
          }
        | undefined;

      if (equipmentSystem?.getPlayerEquipment) {
        const equipment = equipmentSystem.getPlayerEquipment(String(entityId));

        if (equipment?.weapon?.item) {
          const weaponItem = equipment.weapon.item;

          if (weaponItem.attackSpeed) {
            return weaponItem.attackSpeed;
          }

          if (weaponItem.id) {
            const itemData = getItem(weaponItem.id);
            if (itemData?.attackSpeed) {
              return itemData.attackSpeed;
            }
          }
        }
      }

      return COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS;
    }

    const entity = this.resolve(String(entityId), entityType);
    if (entity && isMobEntity(entity)) {
      const mobData = entity.getMobData();
      const mobAttackSpeedTicks = (mobData as { attackSpeedTicks?: number })
        .attackSpeedTicks;
      if (mobAttackSpeedTicks) {
        return mobAttackSpeedTicks;
      }
    }

    return COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS;
  }

  /**
   * Get combat range for an entity in tiles
   * Mobs use combatRange from manifest, players use equipped weapon's attackRange
   * rules-accurate: If player has a spell selected, use magic range (10 tiles)
   * @param entity - Entity to check
   * @param entityType - Type of entity ("player" or "mob")
   * @returns Combat range in tiles (default: 1 for unarmed)
   */
  getCombatRange(entity: Entity | MobEntity, entityType: string): number {
    if (entityType === "mob" && isMobEntity(entity)) {
      if (typeof entity.getCombatRange === "function") {
        return entity.getCombatRange();
      }
    }

    if (entityType === "player") {
      // rules-accurate: Check if player has a spell selected first
      // You can cast spells without a staff - the staff just provides magic bonus
      const selectedSpell = (entity as { data?: { selectedSpell?: string } })
        ?.data?.selectedSpell;
      if (selectedSpell) {
        return 10; // Standard magic attack range
      }

      const equipmentSystem = this.world.getSystem?.("equipment") as
        | {
            getPlayerEquipment?: (id: string) => {
              weapon?: {
                item?: {
                  attackRange?: number;
                  id?: string;
                  attackType?: string;
                };
              };
            } | null;
          }
        | undefined;

      if (equipmentSystem?.getPlayerEquipment) {
        const equipment = equipmentSystem.getPlayerEquipment(entity.id);

        if (equipment?.weapon?.item) {
          const weaponItem = equipment.weapon.item;

          // rules-accurate: Magic weapons (staffs/wands) only use their attackRange
          // when a spell is selected (autocast). Without autocast, staffs default
          // to melee range. The selectedSpell check above already returns 10 for
          // magic range, so if we reach here, no spell is selected.
          const isMagicWeapon =
            weaponItem.attackType?.toLowerCase() === "magic" ||
            (weaponItem.id &&
              getItem(weaponItem.id)?.attackType?.toLowerCase() === "magic");

          if (!isMagicWeapon) {
            if (weaponItem.attackRange) {
              return weaponItem.attackRange;
            }

            if (weaponItem.id) {
              const itemData = getItem(weaponItem.id);
              if (itemData?.attackRange) {
                return itemData.attackRange;
              }
            }
          }
          // Magic weapons without autocast fall through to melee range (1)
        }
      }
    }

    return 1;
  }
}
