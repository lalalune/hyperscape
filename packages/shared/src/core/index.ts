/**
 * Core Hyperscape classes
 * World, Entity, System, and Component base classes
 */

export { World } from "./World";
export type { World as WorldType } from "./World";

// Re-export base classes from their source modules
export { Entity } from "../entities/Entity";
export type { EventCallback } from "../entities/Entity";

export { System } from "../systems/shared";
export { SystemBase } from "../systems/shared";

export { Component } from "../components/Component";
