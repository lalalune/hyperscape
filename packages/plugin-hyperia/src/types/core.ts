// Re-export core types for convenience
// World and System are type aliases in core-types
export type { World, System, Entity } from "./core-types";
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
export type { HyperiaAction, HyperiaProvider } from "./core-interfaces";
