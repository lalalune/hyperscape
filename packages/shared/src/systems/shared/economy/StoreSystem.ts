import type { World } from "../../../types";
import { Store } from "../../../types/core/core";
import type { StoreCloseEvent, StoreOpenEvent } from "../../../types/events";
import { EventType } from "../../../types/events";
import { StoreID } from "../../../types/core/identifiers";
import { createStoreID } from "../../../utils/IdentifierUtils";
import { SystemBase } from "..";
import { GENERAL_STORES } from "../../../data/banks-stores";

/**
 * Store System
 * Manages general stores per GDD specifications:
 * - One general store per starter town
 * - Sells basic tools: Hatchet (Bronze), Fishing Rod, Tinderbox
 * - Sells ammunition: Arrows
 * - Uses coins as currency
 * - Click shopkeeper to open store interface
 */
export class StoreSystem extends SystemBase {
  private stores = new Map<StoreID, Store>();

  constructor(world: World) {
    super(world, {
      name: "store",
      dependencies: {
        required: [], // Store system can work independently
        optional: ["inventory", "npc", "ui", "database"], // Better with inventory and NPC systems
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Initialize all stores from loaded JSON data
    for (const storeData of Object.values(GENERAL_STORES)) {
      // Convert StoreData to Store format
      // Note: position is optional - it will be set when NPC registers via STORE_REGISTER_NPC
      const store: Store = {
        id: storeData.id,
        name: storeData.name,
        // Position comes from the NPC entity, not the store definition
        // It gets set when the shopkeeper NPC registers via STORE_REGISTER_NPC
        position: storeData.location?.position,
        items: storeData.items,
        npcName:
          storeData.name.replace("General Store", "").trim() || "Shopkeeper",
        buyback: storeData.buyback,
        buybackRate: storeData.buybackRate,
      };
      this.stores.set(createStoreID(store.id), store);
    }

    // Set up type-safe event subscriptions for store mechanics
    this.subscribe<StoreOpenEvent>(EventType.STORE_OPEN, (data) => {
      this.openStore(data);
    });
    this.subscribe<StoreCloseEvent>(EventType.STORE_CLOSE, (data) => {
      this.closeStore(data);
    });

    // NOTE: STORE_BUY and STORE_SELL are now handled by the server handler
    // (packages/server/src/systems/ServerNetwork/handlers/store.ts)
    // with proper database transactions, input validation, and security measures.
    // The buyItem and sellItem methods below are deprecated but kept for backwards compatibility.

    // Listen for NPC registrations from world content system
    this.subscribe<{
      npcId: string;
      storeId: string;
      position: { x: number; y: number; z: number };
      name: string;
      area: string;
    }>(EventType.STORE_REGISTER_NPC, (data) => {
      this.registerStoreNPC(data);
    });
  }

  private registerStoreNPC(data: {
    npcId: string;
    storeId: string;
    position: { x: number; y: number; z: number };
    name: string;
    area: string;
  }): void {
    const storeId = createStoreID(data.storeId);
    const store = this.stores.get(storeId);

    // Store must exist - fail if not found
    if (!store) {
      throw new Error(`Store ${data.storeId} not found for NPC ${data.npcId}`);
    }

    // Update store position to match NPC position
    store.position = data.position;
    store.npcName = data.name;
  }

  private openStore(data: StoreOpenEvent): void {
    const storeId = createStoreID(data.storeId);
    const store = this.stores.get(storeId);

    if (!store) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: "Store not found.",
        type: "error",
      });
      return;
    }

    // NOTE (Phase 8): Distance check removed - now handled by:
    // 1. Server handler (per-operation validation using Chebyshev distance)
    // 2. InteractionSessionManager (periodic validation, auto-close on walk away)
    // This eliminates the inconsistency between Euclidean 3D (old) vs Chebyshev 2D (new)
    // and the hardcoded distance 3 vs shared constant INTERACTION_DISTANCE[store] = 5

    // Send store interface data to player
    this.emitTypedEvent(EventType.STORE_OPEN, {
      playerId: data.playerId,
      storeId: data.storeId,
      storeName: store.name,
      npcName: store.npcName,
      items: store.items,
      categories: ["tools", "ammunition", "consumables"],
    });
  }

  private closeStore(_data: StoreCloseEvent): void {
    // Store close is handled by the client UI
    // No server-side cleanup needed for now
  }

  // NOTE: buyItem and sellItem methods have been removed.
  // All store transactions now go through the secure server handler
  // (packages/server/src/systems/ServerNetwork/handlers/store.ts)
  // which provides database transactions, input validation, distance checks,
  // overflow protection, and rate limiting.

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all store data
    this.stores.clear();

    // Call parent cleanup
    super.destroy();
  }

  // Public API methods for integration tests
  public getAllStores(): Store[] {
    return Array.from(this.stores.values());
  }

  public getStore(storeId: string): Store | undefined {
    return this.stores.get(createStoreID(storeId));
  }

  public getStoreLocations(): Array<{
    id: string;
    name: string;
    position?: { x: number; y: number; z: number };
  }> {
    return Array.from(this.stores.values()).map((store) => ({
      id: store.id,
      name: store.name,
      position: store.position,
    }));
  }

  // NOTE: purchaseItem method has been removed - use network.send("storeBuy") instead
}
