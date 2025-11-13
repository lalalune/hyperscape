/**
 * Shared Systems
 *
 * These systems work in both client and server contexts.
 * Organized by domain for better maintainability and discoverability.
 */

// Core system infrastructure (base classes, loaders, events, settings)
export * from "./infrastructure";

// Combat mechanics (combat, aggro, death)
export * from "./combat";

// Character systems (player, equipment, inventory, skills)
export * from "./character";

// Economy systems (banking, stores, loot)
export * from "./economy";

// World systems (environment, terrain, sky, water, vegetation)
export * from "./world";

// Entity systems (entity management, NPCs, mobs, spawning, resources)
export * from "./entities";

// Interaction systems (player interactions, crafting, physics, pathfinding)
export * from "./interaction";

// Presentation systems (rendering, visual effects, audio, chat, actions)
export * from "./presentation";
