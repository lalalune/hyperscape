// Re-export core types and classes for convenience
export { World, Entity, System } from "./core-types";
export type {
  Player,
  Vector3,
  Quaternion,
  Component,
  Physics,
  Entities,
  Events,
  WorldOptions,
} from "./core-types";

// Additional common types for cross-file compatibility
export type {
  Position,
  ContentInstance,
  HyperscapeAction,
  HyperscapeProvider,
} from "./core-types";
