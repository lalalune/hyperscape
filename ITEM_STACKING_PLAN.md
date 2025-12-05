# Dropped Item Stacking Implementation Plan

## Issue #286: Dropped items should stack like RuneScape

> Dropping multiple items in one place should stack like RuneScape, with the last item dropped showing only. However, when you right click you should see a list of all items in the stack that you can pick up.

---

## OSRS Ground Item Pile Mechanics Research

### Visual Behavior
- **Only the top item is visible** - When multiple items are on the same tile, only ONE item model is displayed
- **Most recently dropped item shows on top** - Last dropped = most visible
- **No 3D stacking** - Items don't physically pile up; it's a single visual representation

### Right-Click Menu Behavior
- **All items listed** - Right-clicking a tile with multiple items shows ALL items in the context menu
- **Order: Most recent first** - Newest dropped items appear at the top of the menu
- **Each item has its own "Take" action** - e.g., "Take Bronze sword", "Take Coins (25)"
- **Stackable items combine** - If you drop 10 coins, then 15 coins on same tile, they merge into "Coins (25)"

### Left-Click Behavior
- **Takes highest value item** - Left-clicking a pile picks up the most expensive item (by shop value)
- **Not the top visible item** - This is intentional for convenience

### Tile Limits (OSRS)
- **128 different item types per tile** - Stackable items count as one type regardless of quantity
- **Lowest value replaced first** - If limit exceeded, cheapest items are replaced
- **8x8 chunk limit of 129 tradeable items** - Regional cap prevents abuse

### Item Despawn
- **Timer applies to entire stack** - If stackable items merge, the newest timer applies
- **3 minutes for tradeable items** - 60s private, then 120s public visibility

---

## Current Codebase Analysis

### Key Files

| Component | File | Purpose |
|-----------|------|---------|
| ItemEntity | `packages/shared/src/entities/world/ItemEntity.ts` | Ground item representation |
| GroundItemManager | `packages/shared/src/systems/shared/death/GroundItemManager.ts` | Spawn/despawn for death/loot items |
| ItemSpawnerSystem | `packages/shared/src/systems/shared/entities/ItemSpawnerSystem.ts` | Spawn for player-dropped items |
| InventorySystem | `packages/shared/src/systems/shared/character/InventorySystem.ts` | Handles `dropItem()` → emits `ITEM_SPAWN_REQUEST` |
| InteractionSystem | `packages/shared/src/systems/shared/interaction/InteractionSystem.ts` | Context menu & pickup |
| EntityContextMenu | `packages/client/src/game/hud/EntityContextMenu.tsx` | Right-click menu UI |
| TileSystem | `packages/shared/src/systems/shared/movement/TileSystem.ts` | Tile coordinate conversion |
| HeadstoneEntity | `packages/shared/src/entities/world/HeadstoneEntity.ts` | Death loot container (NOT individual items) |

### Current Behavior (Problems)
1. **Each item is a separate 3D entity** - Multiple visible models cluttering the ground
2. **No tile-based grouping** - Items scatter randomly, no concept of "pile"
3. **Context menu shows single item** - Only the clicked entity's actions, not all items on tile
4. **No stackable item merging** - Dropping coins twice creates two separate entities
5. **TWO spawn paths** - `ItemSpawnerSystem` and `GroundItemManager` both spawn items separately
6. **Random scatter on drop** - `InventorySystem.dropItem()` adds ±0.5-1.0 random offset (line 541-544)

### Existing Useful Code
- `worldToTile()` / `tileToWorld()` - Convert between world coords and tile coords
- `ItemEntity.canStackWith()` - Already checks if two items can stack
- `ItemEntity.addQuantity()` - Merges quantities for stackable items
- `GroundItemManager.groundItems` Map - Tracks all ground items with metadata
- `getEntityAtPosition()` - Raycasts to find entity under cursor (returns first hit)

### Important: HeadstoneEntity is Separate
Player death creates a **HeadstoneEntity** (single entity containing multiple items), NOT individual ItemEntities scattered on ground. Headstones are already a single visual entity with a container - they do NOT need pile stacking. This feature only applies to:
- Player-dropped items (from inventory)
- Mob loot drops (individual items, not in headstones)

---

## Implementation Plan

### Phase 0: Consolidate Item Spawn Paths (CRITICAL)

**Goal**: Ensure ALL ground items flow through GroundItemManager for consistent pile tracking.

#### 0.1 Problem: Two Separate Spawn Systems

Currently:
- `ItemSpawnerSystem` handles `ITEM_SPAWN_REQUEST` from player drops
- `GroundItemManager` handles death drops and mob loot

This split means player-dropped items bypass pile management!

#### 0.2 Solution: Route All Spawns Through GroundItemManager

**Option A (Recommended)**: Make `ItemSpawnerSystem.spawnItemAtLocation()` call `GroundItemManager.spawnGroundItem()` instead of spawning directly.

**File**: `packages/shared/src/systems/shared/entities/ItemSpawnerSystem.ts`

```typescript
private async spawnItemAtLocation(data: {...}): Promise<void> {
  // Instead of calling spawnItemFromData directly:
  const groundItemManager = this.world.getSystem('groundItemManager');
  await groundItemManager.spawnGroundItem(
    data.itemId,
    data.quantity || 1,
    data.position,
    { despawnTime: 180000, scatter: false }  // No scatter - pile system handles positioning
  );
}
```

#### 0.3 Remove Scatter from InventorySystem

**File**: `packages/shared/src/systems/shared/character/InventorySystem.ts` (line 541-544)

Change:
```typescript
position: {
  x: position.x + (Math.random() - 0.5) * 2,  // REMOVE THIS
  y: position.y,
  z: position.z + (Math.random() - 0.5) * 2,  // REMOVE THIS
}
```

To:
```typescript
position: {
  x: position.x,  // Exact position - pile system will snap to tile
  y: position.y,
  z: position.z,
}
```

---

### Phase 1: Tile-Based Ground Item Registry

**Goal**: Track all ground items by their tile position, enabling pile management.

#### 1.1 Create `GroundItemPile` Data Structure

**File**: `packages/shared/src/types/death.ts`

```typescript
export interface GroundItemPileData {
  tileKey: string;  // "x_z" format for Map key
  tile: { x: number; z: number };
  items: GroundItemData[];  // Ordered by drop time (newest first)
  topItemEntityId: string;  // The visible item entity
}
```

#### 1.2 Extend `GroundItemManager`

**File**: `packages/shared/src/systems/shared/death/GroundItemManager.ts`

Add:
- `groundItemPiles: Map<string, GroundItemPileData>` - Keyed by `"tile_x_z"`
- `getItemsAtTile(tile: TileCoord): GroundItemData[]`
- `getPileAtTile(tile: TileCoord): GroundItemPileData | null`
- `addItemToPile(tile, itemData)` - Adds item, handles stacking for stackable items
- `removeItemFromPile(tile, entityId)` - Removes item, updates top visible item
- `getTileKey(tile)` - Helper: `"${tile.x}_${tile.z}"`

#### 1.3 Modify `spawnGroundItem()`

Current: Creates ItemEntity at raw position.

Change to:
1. Convert position to tile using `worldToTile()`
2. Snap position to tile center using `tileToWorld()`
3. Check if pile exists at tile:
   - **If stackable item and same type exists**: Merge quantities, extend despawn timer, DON'T create new entity
   - **Otherwise**: Add to pile, hide previous top item mesh, create new entity

### Phase 2: Visual Pile Representation

**Goal**: Only show the top item in each pile visually.

#### 2.1 Modify ItemEntity Visibility

**File**: `packages/shared/src/entities/world/ItemEntity.ts`

Add:
- `setVisibleInPile(visible: boolean)` - Controls mesh visibility without destroying entity
- When pile updates, call `setVisibleInPile(false)` on non-top items

#### 2.2 Update Top Item on Changes

When an item is:
- **Added to pile**: Hide previous top, show new item
- **Removed from pile (pickup)**: Show next item in pile (if any)
- **Despawned**: Show next item in pile (if any)

### Phase 3: Right-Click Context Menu for Piles

**Goal**: Show all items on a tile when right-clicking any item in the pile.

#### 3.1 PROBLEM: Client Cannot Access GroundItemManager

`GroundItemManager` is **server-only** (has `if (!this.world.isServer) return` checks).
`getActionsForEntityType()` runs on the **client** to build the context menu.

**Solution**: Query local entities by tile position instead of calling server-side manager.

#### 3.2 Create Client-Side Pile Query Helper

**File**: `packages/shared/src/systems/shared/interaction/InteractionSystem.ts`

Add helper method:
```typescript
private getItemEntitiesAtTile(tile: { x: number; z: number }): Array<{
  id: string;
  name: string;
  itemId: string;
  quantity: number;
  value: number;
  entity: Entity;
  position: Position3D;
}> {
  const items: Array<...> = [];
  const tileCenter = tileToWorld(tile);
  const tolerance = 0.6; // Half tile width + small margin

  // Iterate all entities, filter to items on this tile
  for (const entity of this.world.entities.values()) {
    if (entity.type !== 'item') continue;

    const pos = entity.getPosition();
    const dx = Math.abs(pos.x - tileCenter.x);
    const dz = Math.abs(pos.z - tileCenter.z);

    if (dx < tolerance && dz < tolerance) {
      items.push({
        id: entity.id,
        name: entity.name,
        itemId: entity.getProperty('itemId'),
        quantity: entity.getProperty('quantity') || 1,
        value: entity.getProperty('value') || 0,
        entity,
        position: pos,
      });
    }
  }

  // Sort by drop time (newest first) - use entity spawn order or ID
  return items.reverse();  // Newer entities have higher IDs
}
```

#### 3.3 Update `getActionsForEntityType()` for Item Piles

**File**: `packages/shared/src/systems/shared/interaction/InteractionSystem.ts`

```typescript
case "item":
  const itemTile = worldToTile(target.position.x, target.position.z);
  const pileItems = this.getItemEntitiesAtTile(itemTile);

  // Add "Take" for each item in pile (newest first = top of menu)
  for (const pileItem of pileItems) {
    const quantityStr = pileItem.quantity > 1 ? ` (${pileItem.quantity})` : '';
    actions.push({
      id: `pickup_${pileItem.id}`,
      label: `Take ${pileItem.name}${quantityStr}`,
      icon: "🎒",
      enabled: true,
      handler: () => this.attemptPickupById(player, pileItem.id),
    });
  }

  // Add "Walk here" option (OSRS always shows this)
  actions.push({
    id: "walk_here",
    label: "Walk here",
    icon: "👟",
    enabled: true,
    handler: () => this.walkTo(target.position),
  });

  // Add "Examine" for each item (OSRS shows examine per item)
  for (const pileItem of pileItems) {
    actions.push({
      id: `examine_${pileItem.id}`,
      label: `Examine ${pileItem.name}`,
      icon: "👁️",
      enabled: true,
      handler: () => this.examineItem(pileItem.itemId, screenPosition),
    });
  }

  // "Cancel" is added automatically by menu component
  break;
```

#### 3.4 Update EntityContextMenu Component

**File**: `packages/client/src/game/hud/EntityContextMenu.tsx`

Enhancements needed:
- **Max height with scroll**: `max-height: 300px; overflow-y: auto`
- **Collapsing for 15+ items**: Show "[Item name] >" with submenu (future enhancement)
- Menu should not exceed viewport bounds (already handled)

### Phase 4: Left-Click "Take Best" Behavior

**Goal**: Left-clicking a pile takes the highest-value item.

#### 4.1 Modify Left-Click Handler

**File**: `packages/shared/src/systems/shared/interaction/InteractionSystem.ts`

Current location: `onCanvasClick()` method, around line 414-435

```typescript
// Handle item pickup with left-click
if (target.type === "item") {
  event.preventDefault();
  const localPlayer = this.world.getPlayer();
  if (localPlayer) {
    // NEW: Get all items at this tile
    const itemTile = worldToTile(target.position.x, target.position.z);
    const pileItems = this.getItemEntitiesAtTile(itemTile);

    // NEW: Find highest value item
    const bestItem = pileItems.reduce((best, item) =>
      item.value > best.value ? item : best
    , pileItems[0]);

    // Check distance to item
    const distance = this.calculateDistance(localPlayer.position, target.position);
    const pickupRange = 2.0;

    if (distance > pickupRange) {
      // Too far - move towards the item first (use best item's entity)
      this.moveToItem(localPlayer, { ...target, id: bestItem.id });
      return;
    }

    // Close enough - pickup the BEST value item, not clicked one
    this.attemptPickupById(localPlayer, bestItem.id);
  }
  return;
}
```

#### 4.2 Add `attemptPickupById()` Helper

Current `attemptPickup()` takes a target object. Add variant that takes entity ID:

```typescript
private attemptPickupById(player: PlayerEntity, entityId: string): void {
  const entity = this.world.entities.get(entityId);
  if (!entity) return;

  // Debounce and send pickup request
  if (this.world.network?.send) {
    this.world.network.send("pickupItem", { entityId });
  }
}
```

### Phase 5: Stackable Item Merging

**Goal**: Dropping stackable items onto existing stack should merge them.

#### 5.1 Modify `addItemToPile()`

When adding a stackable item to a pile:
1. Check if same `itemId` already exists in pile
2. If yes: Add quantity to existing item, update despawn timer
3. If no: Add as new item in pile

#### 5.2 Handle Edge Cases

- **Max stack size**: If stack would exceed 2,147,483,647, create new stack
- **Mixed ownership**: Player-dropped vs mob-dropped stacks stay separate (loot protection)

### Phase 6: Network Synchronization

**Goal**: Pile state must sync between server and all clients.

#### 6.1 Analysis: What Needs Syncing?

Current system already syncs:
- Entity spawn/destroy (ItemEntity created on server → synced to clients)
- Entity properties (quantity, position via `getNetworkData()`)

What's NEW that needs syncing:
- **Item visibility state** - Which item in a pile is visible
- **Stackable merges** - Quantity updates when items combine

#### 6.2 Approach: Entity Property for Visibility

Instead of new events, use existing entity property sync:

**File**: `packages/shared/src/entities/world/ItemEntity.ts`

Add property:
```typescript
this.setProperty("visibleInPile", true);  // Default: visible
```

When server updates pile:
```typescript
// Hide old top item
oldTopEntity.setProperty("visibleInPile", false);
oldTopEntity.markNetworkDirty();

// Show new top item
newTopEntity.setProperty("visibleInPile", true);
newTopEntity.markNetworkDirty();
```

Client reads this in `clientUpdate()`:
```typescript
if (this.mesh) {
  this.mesh.visible = this.getProperty("visibleInPile", true);
}
```

#### 6.3 Quantity Sync for Merges

When stackable items merge on server:
```typescript
existingEntity.setProperty("quantity", existingQuantity + newQuantity);
existingEntity.markNetworkDirty();
// Don't spawn new entity - quantity update syncs automatically
```

#### 6.4 No New Events Needed

The existing entity sync system handles:
- New entities appearing (spawn)
- Entities disappearing (destroy)
- Property changes (quantity, visibleInPile)

This is simpler and more consistent with existing architecture.

---

## Implementation Order

### Sprint 0: Consolidate Spawn Paths (PREREQUISITE)
1. [ ] Remove scatter from `InventorySystem.dropItem()` (line 541-544)
2. [ ] Make `ItemSpawnerSystem.spawnItemAtLocation()` call `GroundItemManager`
3. [ ] Verify all item spawns flow through `GroundItemManager`
4. [ ] Test: Drop item from inventory → confirm it uses GroundItemManager

### Sprint 1: Foundation (Tile Registry)
5. [ ] Add `GroundItemPileData` type definition to `types/death.ts`
6. [ ] Add `groundItemPiles: Map` to `GroundItemManager`
7. [ ] Add `getTileKey()`, `getItemsAtTile()`, `getPileAtTile()` methods
8. [ ] Modify `spawnGroundItem()` to snap position to tile center
9. [ ] Modify `spawnGroundItem()` to track items in pile data structure
10. [ ] Unit tests for pile tracking

### Sprint 2: Visual Stacking
11. [ ] Add `visibleInPile` property to `ItemEntity` (default: true)
12. [ ] Modify `ItemEntity.clientUpdate()` to set `mesh.visible` from property
13. [ ] Modify `GroundItemManager.spawnGroundItem()` to hide old top item
14. [ ] Modify `GroundItemManager.removeGroundItem()` to show next item
15. [ ] Modify despawn handler to show next item in pile
16. [ ] Visual tests - verify only top item shows

### Sprint 3: Context Menu
17. [ ] Add `getItemEntitiesAtTile()` helper to `InteractionSystem`
18. [ ] Modify `getActionsForEntityType()` case "item" for piles
19. [ ] Add "Walk here" option to item context menu
20. [ ] Add per-item "Examine" options
21. [ ] Add `attemptPickupById()` helper method
22. [ ] Add max-height + scroll to `EntityContextMenu` component
23. [ ] Test context menu shows all pile items

### Sprint 4: Pickup Behavior
24. [ ] Modify `onCanvasClick()` item handler for "take best"
25. [ ] Handle empty pile after pickup (pile cleanup)
26. [ ] Test left-click picks highest value item

### Sprint 5: Stackable Merging
27. [ ] Modify `spawnGroundItem()` to check for existing stackable
28. [ ] If match: update quantity + despawn timer, skip entity creation
29. [ ] Use `markNetworkDirty()` to sync quantity change
30. [ ] Test coin/arrow stacking behavior

### Sprint 6: Polish & Testing
31. [ ] Handle 128-item-per-tile limit (optional, OSRS parity)
32. [ ] Integration tests - full drop/pickup/stack flows
33. [ ] Mobile testing - long-press shows full pile menu
34. [ ] Performance testing with many piles

---

## Edge Cases to Handle

1. **Pile on water/unwalkable tile** - Items should still pile correctly (items drop where player stands)
2. **Loot protection mixing** - Player-dropped items have no protection; death items do. If mixing on same tile, each item retains its own protection state (tracked in `GroundItemData.lootProtectionTick`)
3. **Pile limit** - Cap at 128 item types per tile (OSRS behavior) - low priority, implement if needed
4. **Despawn with pile** - When top item despawns, reveal next item. Use pile order to find next.
5. **Pickup while walking** - Player walks to tile, then picks up. Existing `moveToItem()` handles this.
6. **Mobile/touch** - Long-press already shows context menu (lines 811-824 in InteractionSystem)
7. **Empty pile cleanup** - When last item removed from pile, delete pile from `groundItemPiles` Map
8. **Concurrent pickups** - Server authoritative; if two players click same item, first wins
9. **Same item type, different owners** - Stackable items only merge if BOTH have no loot protection OR same owner
10. **Player reconnects** - Entity sync will restore all items; visibility property syncs correctly

---

## Testing Checklist

### Unit Tests
- [ ] Tile coordinate conversion accuracy
- [ ] Pile add/remove operations
- [ ] Stackable merging logic
- [ ] Value sorting for left-click

### Integration Tests
- [ ] Drop 3 different items on same tile - verify only top shows
- [ ] Right-click pile - verify all items in menu
- [ ] Left-click pile - verify highest value taken
- [ ] Drop coins, drop more coins - verify they merge
- [ ] Pick up from pile - verify next item becomes visible
- [ ] Despawn from pile - verify next item becomes visible

### Visual Tests
- [ ] Items snap to tile centers
- [ ] Floating animation on visible item
- [ ] Context menu positioning near pile
- [ ] Menu scrollable with 10+ items

---

## References

- [OSRS Wiki: Items](https://oldschool.runescape.wiki/w/Items) - Ground item limits
- [OSRS Wiki: Drop](https://oldschool.runescape.wiki/w/Drop) - Drop mechanics
- [RS Wiki: Choose Option](https://runescape.wiki/w/Choose_Option) - Context menu behavior
- [OSRS Wiki: Stackable Items](https://oldschool.runescape.wiki/w/Stackable_items) - Stacking rules

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/types/death.ts` | Add `GroundItemPileData` interface |
| `packages/shared/src/systems/shared/death/GroundItemManager.ts` | Add pile Map, tile snapping, merging, visibility control |
| `packages/shared/src/systems/shared/entities/ItemSpawnerSystem.ts` | Route `spawnItemAtLocation()` through GroundItemManager |
| `packages/shared/src/systems/shared/character/InventorySystem.ts` | Remove scatter from `dropItem()` position |
| `packages/shared/src/entities/world/ItemEntity.ts` | Add `visibleInPile` property, update `clientUpdate()` for visibility |
| `packages/shared/src/systems/shared/interaction/InteractionSystem.ts` | Add `getItemEntitiesAtTile()`, modify context menu, left-click best |
| `packages/client/src/game/hud/EntityContextMenu.tsx` | Add max-height + scroll for long menus |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance with many piles | Lag when iterating entities | Use spatial index or limit pile query radius |
| Stale client entity list | Context menu shows wrong items | Entity sync already handles this; items destroyed on server are removed on client |
| Breaking existing item spawns | Items don't appear | Thorough testing of all spawn paths in Sprint 0 |
| Mobile UX regression | Can't access items in pile | Test long-press menu thoroughly |

---

*Plan created: December 4, 2025*
*Plan reviewed and updated: December 4, 2025*
*Issue: #286*
