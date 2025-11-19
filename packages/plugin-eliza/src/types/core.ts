// Re-export core types and classes for convenience
// World and System are classes from @hyperscape/shared
export { World, System } from "./core-types";
// Entity is a type alias
export type { Entity } from "./core-types";
export type {
  Player,
  Vector3,
  Quaternion,
  Component,
  Physics,
  Entities,
  Events,
  WorldOptions,
  Position,
  ContentInstance,
} from "./core-types";

// Re-export plugin-specific interfaces
export type { HyperscapeAction, HyperscapeProvider } from "./core-interfaces";
