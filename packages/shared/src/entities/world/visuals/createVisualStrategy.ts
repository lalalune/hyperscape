/**
 * Factory — picks a ResourceVisualStrategy based on config.
 * Separated from the interface file to avoid circular imports.
 */

import type { ResourceEntityConfig } from "../../../types/entities";
import type { ResourceVisualStrategy } from "./ResourceVisualStrategy";
import { TreeGLBVisualStrategy } from "./TreeGLBVisualStrategy";
import { TreeProcgenVisualStrategy } from "./TreeProcgenVisualStrategy";
// import { StandardModelVisualStrategy } from "./StandardModelVisualStrategy";
import { InstancedModelVisualStrategy } from "./InstancedModelVisualStrategy";
import { FishingSpotVisualStrategy } from "./FishingSpotVisualStrategy";
import { PlaceholderVisualStrategy } from "./PlaceholderVisualStrategy";

function hasModel(config: ResourceEntityConfig): boolean {
  return !!config.model && config.model !== "null";
}

export function createVisualStrategy(
  config: ResourceEntityConfig,
): ResourceVisualStrategy {
  if (config.resourceType === "fishing_spot")
    return new FishingSpotVisualStrategy();

  if (config.resourceType === "tree" && config.procgenPreset)
    return new TreeProcgenVisualStrategy();

  if (config.resourceType === "tree" && hasModel(config))
    return new TreeGLBVisualStrategy();

  // if (hasModel(config)) return new StandardModelVisualStrategy();
  if (hasModel(config)) return new InstancedModelVisualStrategy();

  return new PlaceholderVisualStrategy();
}
