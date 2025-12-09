/**
 * Entity System - Server-authoritative entities
 * Organized by domain: player, npc, world entities, and managers
 */

// Re-export types from shared types
export type {
  EntityConfig,
  EntityInteractionData,
  BaseEntityData,
  PlayerEntityData,
  BankEntityData,
  ItemEntityConfig,
  MobEntityConfig,
  NPCEntityConfig,
  ResourceEntityConfig,
  HeadstoneEntityConfig,
  HeadstoneData,
  HealthComponent,
  EntityCombatComponent,
  VisualComponent,
  BankStorageItem,
  Component,
} from "../types/entities";

// Base entity classes (at root)
export { Entity } from "./Entity";
export { CombatantEntity } from "./CombatantEntity";
export { InteractableEntity } from "./InteractableEntity";

// Player entities
export * from "./player";

// NPC entities
export * from "./npc";

// World entities (items, resources, headstones)
export * from "./world";

// Entity managers (AI, aggro, combat state, death, respawn)
export * from "./managers";
