/**
 * Core types
 * These types are specific to the game systems
 *
 * NOTE: This file has been fully modularized. All type definitions have been moved to their
 * respective files. This file now serves as a re-export hub for backward compatibility.
 *
 * New modular type files:
 * - base-types.ts - Base type definitions (Position3D, etc.)
 * - player-types.ts - Player-related types
 * - item-types.ts - Item/Equipment types
 * - entity-types.ts - ECS Component types
 * - combat-types.ts - Combat types
 * - misc-types.ts - Other shared types
 * - world-types.ts - World, zones, biomes, chunks, and world content types
 * - npc-mob-types.ts - NPC and Mob types, AI, behavior, and drop systems
 * - inventory-types.ts - Inventory, equipment, banking, stores, and item management
 * - resource-processing-types.ts - Resources, fires, processing actions, death/respawn
 * - interaction-types.ts - Interaction system, interactable entities, tooltips, and damage numbers
 * - animation-dialogue-types.ts - Dialogue system (AnimationTask is in combat-types.ts)
 * - spawning-types.ts - Spawn points, respawn tasks, and spawner system
 * - system-types.ts - System configuration and system-specific interfaces
 *
 * All types remain exported from this file for backward compatibility.
 * New code can import from specific type files for better organization.
 */

// Re-export all modular type files for convenience
// Note: base-types is not re-exported here to avoid conflicts (types are re-exported from other modules)
export * from "./player-types";
export * from "./item-types";
export * from "./entity-types";
export * from "./combat-types";
export * from "./misc-types";
export * from "./world-types";
export * from "./npc-mob-types";
export * from "./inventory-types";
export * from "./resource-processing-types";
export * from "./interaction-types";
export * from "./animation-dialogue-types";
export * from "./spawning-types";
export * from "./system-types";

// Re-export specific types for components
export type { World } from "../World";
export type { Position3D } from "./base-types";
export { ItemRarity } from "./entities";
