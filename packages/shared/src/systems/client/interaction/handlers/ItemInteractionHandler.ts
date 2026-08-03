/**
 * ItemInteractionHandler
 *
 * Handles interactions with ground items.
 *
 * classic MMORPG Context Menu Format: "<Action> <ItemName>" with orange target (item color)
 * - "Take Bones" (orange #ff9040 for "Bones")
 * - "Walk here"
 * - "Examine Bones" (orange #ff9040 for "Bones")
 *
 * classic MMORPG-Style Behavior:
 * - Must stand ON the item's tile to pick it up (range 0)
 * - Left-click picks up highest value item in pile
 * - Context menu shows all items in pile
 *
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE, TIMING, MESSAGE_TYPES } from "../constants";
import { getItem } from "../../../../data/items";
import {
  worldToTile,
  tileToWorld,
  TILE_SIZE,
} from "../../../shared/movement/TileSystem";
import type { Entity } from "../../../../entities/Entity";
import type { GroundItemSystem } from "../../../shared/economy/GroundItemSystem";
import { CONTEXT_MENU_COLORS } from "../../../../constants/GameConstants";

export class ItemInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Pick up highest value item in pile
   */
  onLeftClick(target: RaycastTarget): void {
    const player = this.getPlayer();
    if (!player) return;

    // Get all items at this tile
    const itemTile = worldToTile(target.position.x, target.position.z);
    let pileItems = this.getItemEntitiesAtTile(itemTile);

    // Fallback: If pile lookup fails but we have target entity, use it directly
    if (pileItems.length === 0 && target.entity) {
      const entity = target.entity;
      const itemId = entity.getProperty("itemId") as string | undefined;
      const quantity = entity.getProperty("quantity") as number | undefined;
      const value = entity.getProperty("value") as number | undefined;

      pileItems = [
        {
          id: entity.id,
          name: entity.name || "Item",
          itemId: itemId ?? entity.id,
          quantity: quantity ?? 1,
          value: value ?? 0,
          entity,
          position: target.position,
        },
      ];
    }

    if (pileItems.length === 0) return;

    // Find highest value item in pile (classic MMORPG behavior)
    const bestItem = pileItems.reduce(
      (best, item) => (item.value > best.value ? item : best),
      pileItems[0],
    );

    this.pickupItem(bestItem.id, bestItem.position);
  }

  /**
   * Right-click: Show all items in pile
   *
   * rules-accurate format with orange item names:
   * - "Take Bones" (orange for "Bones")
   * - "Take Coins" (orange for "Coins")
   * - "Walk here"
   * - "Examine Bones" (orange for "Bones")
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];

    // Get all items at this tile
    const itemTile = worldToTile(target.position.x, target.position.z);
    let pileItems = this.getItemEntitiesAtTile(itemTile);

    // Fallback: If pile lookup fails but we have target entity, use it directly
    // This handles cases where entity type detection differs between systems
    if (pileItems.length === 0 && target.entity) {
      const entity = target.entity;
      const itemId = entity.getProperty("itemId") as string | undefined;
      const quantity = entity.getProperty("quantity") as number | undefined;
      const value = entity.getProperty("value") as number | undefined;

      pileItems = [
        {
          id: entity.id,
          name: entity.name || "Item",
          itemId: itemId ?? entity.id,
          quantity: quantity ?? 1,
          value: value ?? 0,
          entity,
          position: target.position,
        },
      ];
    }

    // Add "Take" for each item in pile (newest first = top of menu)
    // classic MMORPG: "Take Bones" with orange item name
    let priority = 1;
    for (const pileItem of pileItems) {
      actions.push({
        id: `pickup_${pileItem.id}`,
        label: `Take ${pileItem.name}`,
        styledLabel: [
          { text: "Take " },
          { text: pileItem.name, color: CONTEXT_MENU_COLORS.ITEM },
        ],
        enabled: true,
        priority: priority++,
        handler: () => this.pickupItem(pileItem.id, pileItem.position),
      });
    }

    // Walk here
    actions.push(this.createWalkHereAction(target));

    // Examine for each item - classic MMORPG: "Examine Bones" with orange item name
    for (const pileItem of pileItems) {
      const itemData = getItem(pileItem.itemId);
      const examineText =
        itemData?.examine || `It's ${pileItem.name.toLowerCase()}.`;
      actions.push({
        id: `examine_${pileItem.id}`,
        label: `Examine ${pileItem.name}`,
        styledLabel: [
          { text: "Examine " },
          { text: pileItem.name, color: CONTEXT_MENU_COLORS.ITEM },
        ],
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
      return;
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
          return;
        }

        // Server expects entityId as 'itemId' field (legacy naming)
        // Include timestamp for replay attack prevention
        this.send(MESSAGE_TYPES.PICKUP_ITEM, {
          itemId: entityId,
          timestamp: Date.now(),
        });
      },
    });
  }

  /**
   * Get all item entities at a specific tile (classic MMORPG-style pile query)
   *
   * Optimization: Tries GroundItemSystem O(1) lookup first (server-side),
   * falls back to O(n) entity iteration (client-side).
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
    // Try GroundItemSystem O(1) lookup (server-side only has pile data)
    // On client, GroundItemSystem exists but groundItemPiles is empty
    const groundItems = this.world.getSystem("ground-items");
    if (groundItems) {
      const groundItemsAtTile = groundItems.getItemsAtTile(tile);

      // Only use GroundItemSystem if it has data (server-side)
      // Fall through to entity iteration if empty (client-side)
      if (groundItemsAtTile.length > 0) {
        const items: Array<{
          id: string;
          name: string;
          itemId: string;
          quantity: number;
          value: number;
          entity: Entity;
          position: { x: number; y: number; z: number };
        }> = [];

        for (const groundItem of groundItemsAtTile) {
          const entity = this.world.entities.get(groundItem.entityId);
          if (!entity) continue;

          // Get item data for name and value
          const itemData = getItem(groundItem.itemId);

          items.push({
            id: groundItem.entityId,
            name: itemData?.name || entity.name || "Item",
            itemId: groundItem.itemId,
            quantity: groundItem.quantity,
            value: itemData?.value ?? 0,
            entity,
            position: groundItem.position,
          });
        }

        return items;
      }
    }

    // Fallback to O(n) entity iteration (client-side)
    // This iterates all entities and finds items at the tile position
    return this.getItemEntitiesAtTileFallback(tile);
  }

  /**
   * Fallback: O(n) entity iteration for client-side tile queries
   * Used when GroundItemSystem is not available (client doesn't have it)
   */
  private getItemEntitiesAtTileFallback(tile: { x: number; z: number }): Array<{
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
      // Check for item type - support both string "item" and any case variations
      const entityType = entity.type?.toLowerCase?.() ?? entity.type;
      const isItem = entityType === "item";

      if (!isItem) continue;

      const pos = entity.getPosition();
      const dx = Math.abs(pos.x - tileCenter.x);
      const dz = Math.abs(pos.z - tileCenter.z);
      const inRange = dx < tolerance && dz < tolerance;

      if (inRange) {
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
