/**
 * Interaction Systems
 * Player-world interactions, inventory actions, crafting, physics, and pathfinding
 *
 * NOTE: The legacy InteractionSystem has been replaced by InteractionRouter
 * which is exported from systems/client/interaction/
 */

// Legacy InteractionSystem is deprecated - use InteractionRouter from client/interaction
// export * from "./InteractionSystem";
export * from "./InventoryInteractionSystem";
export * from "./ProcessingSystem";
export * from "./PathfindingSystem";
export * from "./Physics";
export * from "./DialogueSystem";
