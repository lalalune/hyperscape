/**
 * ItemInteractionHandler
 *
 * Handles interactions with ground items.
 *
 * Actions:
 * - Take (left-click primary, context menu)
 * - Walk here
 * - Examine
 *
 * OSRS-Style Behavior:
 * - Must stand ON the item's tile to pick it up (range 0)
 * - Left-click picks up highest value item in pile
 * - Context menu shows all items in pile
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE, TIMING } from "../constants";
import { getItem } from "../../../../data/items";
import {
  worldToTile,
  tileToWorld,
  TILE_SIZE,
} from "../../../shared/movement/TileSystem";
import type { Entity } from "../../../../entities/Entity";

export class ItemInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Pick up highest value item in pile
   */
  onLeftClick(target: RaycastTarget): void {
    const player = this.getPlayer();
    if (!player) return;

    // Get all items at this tile
    const itemTile = worldToTile(target.position.x, target.position.z);
    const pileItems = this.getItemEntitiesAtTile(itemTile);

    if (pileItems.length === 0) return;

    // Find highest value item in pile (OSRS behavior)
    const bestItem = pileItems.reduce(
      (best, item) => (item.value > best.value ? item : best),
      pileItems[0],
    );

    this.pickupItem(bestItem.id, bestItem.position);
  }

  /**
   * Right-click: Show all items in pile
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];

    // Get all items at this tile
    const itemTile = worldToTile(target.position.x, target.position.z);
    const pileItems = this.getItemEntitiesAtTile(itemTile);

    // Add "Take" for each item in pile (newest first = top of menu)
    let priority = 1;
    for (const pileItem of pileItems) {
      const quantityStr =
        pileItem.quantity > 1 ? ` (${pileItem.quantity})` : "";
      actions.push({
        id: `pickup_${pileItem.id}`,
        label: `Take ${pileItem.name}${quantityStr}`,
        icon: "🎒",
        enabled: true,
        priority: priority++,
        handler: () => this.pickupItem(pileItem.id, pileItem.position),
      });
    }

    // Walk here
    actions.push(this.createWalkHereAction(target));

    // Examine for each item
    for (const pileItem of pileItems) {
      const itemData = getItem(pileItem.itemId);
      const examineText =
        itemData?.examine || `It's ${pileItem.name.toLowerCase()}.`;
      actions.push({
        id: `examine_${pileItem.id}`,
        label: `Examine ${pileItem.name}`,
        icon: "👁️",
        enabled: true,
        priority: 100 + priority++,
        handler: () => this.showExamineMessage(examineText),
      });
    }

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.SAME_TILE;
  }

  // === Private Methods ===

  private pickupItem(
    entityId: string,
    position: { x: number; y: number; z: number },
  ): void {
    // Check debounce - prevents spam clicking same item
    const debounceKey = `pickup:${entityId}`;
    if (this.actionQueue.isDebounced(debounceKey, TIMING.PICKUP_DEBOUNCE_MS)) {
      return;
    }

    // Verify entity exists at queue time
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return; // Already picked up by another click
    }

    this.queueInteraction({
      target: {
        entityId,
        entityType: "item",
        entity,
        name: entity.name || "Item",
        position,
        hitPoint: position,
        distance: 0,
      },
      actionId: "take",
      range: INTERACTION_RANGE.SAME_TILE,
      onExecute: () => {
        // CRITICAL: Re-check entity exists at EXECUTE time
        // Between queueing and executing, the item may have been:
        // - Picked up by another player
        // - Despawned
        // - Already picked up by a previous click (sync delay)
        const currentEntity = this.world.entities.get(entityId);
        if (!currentEntity) {
          return; // Item no longer exists - silently skip
        }

        // Server expects entityId as 'itemId' field (legacy naming)
        this.send("pickupItem", { itemId: entityId });
      },
    });
  }

  /**
   * Get all item entities at a specific tile (OSRS-style pile query)
   */
  private getItemEntitiesAtTile(tile: { x: number; z: number }): Array<{
    id: string;
    name: string;
    itemId: string;
    quantity: number;
    value: number;
    entity: Entity;
    position: { x: number; y: number; z: number };
  }> {
    const items: Array<{
      id: string;
      name: string;
      itemId: string;
      quantity: number;
      value: number;
      entity: Entity;
      position: { x: number; y: number; z: number };
    }> = [];

    const tileCenter = tileToWorld(tile);
    const tolerance = TILE_SIZE * INTERACTION_RANGE.TILE_PILE_TOLERANCE;

    // Iterate all entities, filter to items on this tile
    for (const entity of this.world.entities.values()) {
      if (entity.type !== "item") continue;

      const pos = entity.getPosition();
      const dx = Math.abs(pos.x - tileCenter.x);
      const dz = Math.abs(pos.z - tileCenter.z);

      if (dx < tolerance && dz < tolerance) {
        // Type-safe property access with explicit casts
        const itemId = entity.getProperty("itemId") as string | undefined;
        const quantity = entity.getProperty("quantity") as number | undefined;
        const value = entity.getProperty("value") as number | undefined;

        items.push({
          id: entity.id,
          name: entity.name || "Item",
          itemId: itemId ?? entity.id,
          quantity: quantity ?? 1,
          value: value ?? 0,
          entity,
          position: pos,
        });
      }
    }

    // Sort by drop order (newer entities have higher IDs typically, so reverse)
    return items.reverse();
  }
}
