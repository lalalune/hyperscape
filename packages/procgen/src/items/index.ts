/**
 * Procedural Items Module
 *
 * Generators for procedural world items like docks, bridges, wells, fences, etc.
 * These are non-building structures that enhance the world.
 *
 * @example
 * ```typescript
 * import { DockGen } from "@hyperforge/procgen/items";
 *
 * const dock = DockGen.dockGenerator.generateFromPreset("fishing", shorelinePoint);
 * ```
 */

// Shared types
export type {
  WorldPosition,
  Direction2D,
  WoodTypeValue,
  ItemRecipeBase,
  GeneratedItemBase,
  ItemCollisionData,
  ItemStats,
  ShorelinePoint,
  WaterBody,
} from "./types";

export { WoodType } from "./types";

// Dock generator (namespaced)
export * as DockGen from "./dock/index";
