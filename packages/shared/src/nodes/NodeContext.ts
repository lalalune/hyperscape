/**
 * Node context utilities and strong typing for mounted nodes
 */

import type { World } from "../core/World";
import type { Node } from "./Node";

/**
 * Interface for nodes that are guaranteed to have a valid context
 * Used when nodes are mounted and have access to world resources
 */
export interface MountedNode extends Node {
  ctx: MountedNodeContext;
}

/**
 * Context interface for mounted nodes - guarantees world exists
 */
export interface MountedNodeContext extends World {
  world: World;
  physics: NonNullable<World["physics"]>;
  stage: NonNullable<World["stage"]>;
  graphics: NonNullable<World["graphics"]>;
  loader: NonNullable<World["loader"]>;
  network: NonNullable<World["network"]>;
}

/**
 * Type guard to check if a node has a valid mounted context
 */
export function isMountedNode(node: Node): node is MountedNode {
  return node.ctx !== null && node.ctx.stage !== undefined;
}

/**
 * Type guard to check if a context is valid for mounting operations
 */
export function isMountedContext(ctx: World | null): ctx is MountedNodeContext {
  return ctx !== null && ctx.stage !== undefined;
}

/**
 * Get mounted context with strong typing
 * Throws if context is not valid for mounting
 */
export function getMountedContext(node: Node): MountedNodeContext {
  if (!node.ctx || !isMountedContext(node.ctx)) {
    throw new Error(
      `Node ${node.name || "unnamed"} does not have a valid mounted context`,
    );
  }
  return node.ctx;
}

/**
 * Safe context access that returns undefined if not mounted
 */
export function getSafeContext(node: Node): MountedNodeContext | undefined {
  return isMountedContext(node.ctx) ? node.ctx : undefined;
}
