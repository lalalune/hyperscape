/**
 * Entity System - Server-authoritative entities
 * Replaces the .hyp app system with full server control
 */

// Re-export types from shared types
export type {
  EntityConfig,
  EntityInteractionData,
  BaseEntityData,
  PlayerEntityData,
  BankEntityData,
  ItemEntityConfig,
  CharacterEntityConfig,
  ResourceEntityConfig,
  HeadstoneEntityConfig,
  HeadstoneData,
  HealthComponent,
  EntityCombatComponent,
  VisualComponent,
  BankStorageItem,
  Component
} from '../types/entities';

// Export entity classes
export { Entity } from './Entity';

// Specialized base classes
export { CombatantEntity } from './CombatantEntity';
export { InteractableEntity } from './InteractableEntity';

// Concrete entity classes
export { ItemEntity } from './ItemEntity';
export { HeadstoneEntity } from './HeadstoneEntity';
export { ResourceEntity } from './ResourceEntity';
export { PlayerEntity } from './PlayerEntity';

// Unified Character System
export { CharacterEntity } from './CharacterEntity';