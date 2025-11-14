import { Component } from "./Component";
import type { Entity } from "../entities/Entity";
import { EventType } from "../types/events";

/**
 * Health Component
 *
 * Manages health, damage, and healing for entities.
 * Used by both players and NPCs/mobs.
 */
export class HealthComponent extends Component {
  constructor(
    entity: Entity,
    data: {
      maxHealth?: number;
      currentHealth?: number;
      regeneration?: number;
      invulnerable?: boolean;
      [key: string]: unknown;
    } = {},
  ) {
    const maxHealth = data.maxHealth || 100;
    super("health", entity, {
      maxHealth,
      currentHealth: data.currentHealth ?? maxHealth,
      regeneration: data.regeneration || 0,
      invulnerable: data.invulnerable || false,
      lastDamageTime: 0,
      ...data,
    });
  }

  get maxHealth(): number {
    return this.get<number>("maxHealth") || 100;
  }

  set maxHealth(value: number) {
    this.set("maxHealth", Math.max(1, value));
    // Clamp current health to new max
    if (this.currentHealth > value) {
      this.currentHealth = value;
    }
  }

  get currentHealth(): number {
    return this.get<number>("currentHealth") || 0;
  }

  set currentHealth(value: number) {
    const newHealth = Math.max(0, Math.min(value, this.maxHealth));
    this.set("currentHealth", newHealth);

    // Emit health change event
    this.entity.world.emit(EventType.ENTITY_HEALTH_CHANGED, {
      entityId: this.entity.id,
      health: newHealth,
      maxHealth: this.maxHealth,
      isDead: newHealth <= 0,
    });

    // Check for death
    if (newHealth <= 0 && !this.isDead) {
      this.handleDeath();
    }
  }

  get regeneration(): number {
    return this.get<number>("regeneration") || 0;
  }

  set regeneration(value: number) {
    this.set("regeneration", Math.max(0, value));
  }

  get invulnerable(): boolean {
    return this.get<boolean>("invulnerable") || false;
  }

  set invulnerable(value: boolean) {
    this.set("invulnerable", value);
  }

  get isDead(): boolean {
    return this.currentHealth <= 0;
  }

  get isAlive(): boolean {
    return this.currentHealth > 0;
  }

  get isFull(): boolean {
    return this.currentHealth >= this.maxHealth;
  }

  get healthPercentage(): number {
    return this.maxHealth > 0 ? this.currentHealth / this.maxHealth : 0;
  }

  get lastDamageTime(): number {
    return this.get<number>("lastDamageTime") || 0;
  }

  // Apply damage to the entity
  damage(amount: number, source?: Entity, damageType?: string): boolean {
    console.log(
      `[HealthComponent] damage called on ${this.entity.id}: ${amount} damage from ${source?.id || "unknown"} (${damageType || "unknown type"})`,
    );
    if (this.invulnerable || this.isDead || amount <= 0) {
      return false;
    }

    const actualDamage = Math.min(amount, this.currentHealth);
    this.currentHealth -= actualDamage;
    this.set("lastDamageTime", Date.now());

    // Emit damage event
    this.entity.world.emit(EventType.ENTITY_DAMAGE_TAKEN, {
      entityId: this.entity.id,
      damage: actualDamage,
      sourceId: source?.id,
      damageType,
      remainingHealth: this.currentHealth,
    });

    return true;
  }

  // Heal the entity
  heal(amount: number, source?: Entity): number {
    if (this.isDead || amount <= 0) {
      return 0;
    }

    const oldHealth = this.currentHealth;
    this.currentHealth += amount;
    const actualHealing = this.currentHealth - oldHealth;

    if (actualHealing > 0) {
      // Emit healing event
      this.entity.world.emit(EventType.ENTITY_HEALING_RECEIVED, {
        entityId: this.entity.id,
        healing: actualHealing,
        sourceId: source?.id,
        newHealth: this.currentHealth,
      });
    }

    return actualHealing;
  }

  // Set health to maximum
  fullHeal(): void {
    this.currentHealth = this.maxHealth;
  }

  // Instantly kill the entity
  kill(source?: Entity): void {
    if (!this.isDead) {
      this.currentHealth = 0;

      // Emit death event
      this.entity.world.emit(EventType.ENTITY_DEATH, {
        entityId: this.entity.id,
        sourceId: source?.id,
        killedBy: source?.id,
        entityType: (this.entity.type === "player"
          ? "player"
          : this.entity.type === "mob"
            ? "mob"
            : "npc") as "player" | "mob" | "npc",
      });
    }
  }

  // Revive the entity with specified health
  revive(health?: number): void {
    if (this.isDead) {
      this.currentHealth = health ?? this.maxHealth;

      // Emit revive event
      this.entity.world.emit(EventType.ENTITY_REVIVED, {
        entityId: this.entity.id,
        newHealth: this.currentHealth,
      });
    }
  }

  private handleDeath(): void {
    // Emit death event
    this.entity.world.emit(EventType.ENTITY_DEATH, {
      entityId: this.entity.id,
      lastDamageTime: this.lastDamageTime,
      entityType: (this.entity.type === "player"
        ? "player"
        : this.entity.type === "mob"
          ? "mob"
          : "npc") as "player" | "mob" | "npc",
    });
  }

  // Regeneration update (called by systems)
  update(delta: number): void {
    if (this.regeneration > 0 && this.isAlive && !this.isFull) {
      const regenAmount = this.regeneration * delta;
      this.heal(regenAmount);
    }
  }
}
