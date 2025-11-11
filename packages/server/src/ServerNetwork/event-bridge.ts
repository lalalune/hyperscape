/**
 * Event Bridge Module - World event to network message bridge
 *
 * Listens to world events (resource depletion, inventory changes, etc.)
 * and forwards them to connected clients via network messages.
 *
 * Responsibilities:
 * - Subscribe to world events (EventType.RESOURCE_*, INVENTORY_*, etc.)
 * - Transform event data into network messages
 * - Route messages to appropriate clients (broadcast or targeted)
 * - Handle event-specific logic (player ID routing, data transformation)
 *
 * Usage:
 * ```typescript
 * const eventBridge = new EventBridge(world, broadcast);
 * eventBridge.setupEventListeners(); // Register all listeners
 * ```
 */

import type { World } from "@hyperscape/shared";
import { EventType } from "@hyperscape/shared";
import type { BroadcastManager } from "./broadcast";

/**
 * EventBridge - Bridges world events to network messages
 *
 * Provides centralized event subscription and message routing.
 */
export class EventBridge {
  /**
   * Create an EventBridge
   *
   * @param world - Game world instance that emits events
   * @param broadcast - Broadcast manager for sending messages
   */
  constructor(
    private world: World,
    private broadcast: BroadcastManager,
  ) {}

  /**
   * Setup all event listeners
   *
   * Registers listeners for all world events that need to be
   * forwarded to clients. Call this once during initialization.
   */
  setupEventListeners(): void {
    this.setupResourceEvents();
    this.setupInventoryEvents();
    this.setupSkillEvents();
    this.setupUIEvents();
  }

  /**
   * Setup resource system event listeners
   *
   * Forwards resource depletion, respawn, and spawn point events
   * to all connected clients.
   *
   * @private
   */
  private setupResourceEvents(): void {
    try {
      this.world.on(EventType.RESOURCE_DEPLETED, (...args: unknown[]) => {
        this.broadcast.sendToAll("resourceDepleted", args[0]);
      });

      this.world.on(EventType.RESOURCE_RESPAWNED, (...args: unknown[]) => {
        this.broadcast.sendToAll("resourceRespawned", args[0]);
      });

      this.world.on(EventType.RESOURCE_SPAWNED, (...args: unknown[]) => {
        this.broadcast.sendToAll("resourceSpawned", args[0]);
      });

      this.world.on(
        EventType.RESOURCE_SPAWN_POINTS_REGISTERED,
        (...args: unknown[]) => {
          this.broadcast.sendToAll("resourceSpawnPoints", args[0]);
        },
      );
    } catch (_err) {
      console.error("[EventBridge] Error setting up resource events:", _err);
    }
  }

  /**
   * Setup inventory system event listeners
   *
   * Handles inventory updates, initialization, and request events.
   * Routes messages to specific players when needed.
   *
   * @private
   */
  private setupInventoryEvents(): void {
    try {
      // Broadcast inventory updates to all clients
      this.world.on(EventType.INVENTORY_UPDATED, (...args: unknown[]) => {
        this.broadcast.sendToAll("inventoryUpdated", args[0]);
      });

      // Send inventory initialization to specific player
      this.world.on(EventType.INVENTORY_INITIALIZED, (payload: unknown) => {
        const data = payload as {
          playerId: string;
          inventory: { items: unknown[]; coins: number; maxSlots: number };
        };

        const packet = {
          playerId: data.playerId,
          items: data.inventory.items,
          coins: data.inventory.coins,
          maxSlots: data.inventory.maxSlots,
        };

        this.broadcast.sendToPlayer(data.playerId, "inventoryUpdated", packet);
      });

      // Handle inventory data requests
      this.world.on(EventType.INVENTORY_REQUEST, (payload: unknown) => {
        const data = payload as { playerId: string };

        try {
          const invSystem = this.world.getSystem?.("inventory") as
            | {
                getInventoryData?: (id: string) => {
                  items: unknown[];
                  coins: number;
                  maxSlots: number;
                };
              }
            | undefined;

          const inv = invSystem?.getInventoryData
            ? invSystem.getInventoryData(data.playerId)
            : { items: [], coins: 0, maxSlots: 28 };

          const packet = {
            playerId: data.playerId,
            items: inv.items,
            coins: inv.coins,
            maxSlots: inv.maxSlots,
          };

          this.broadcast.sendToPlayer(
            data.playerId,
            "inventoryUpdated",
            packet,
          );
        } catch (_err) {
          console.error(
            "[EventBridge] Error handling inventory request:",
            _err,
          );
        }
      });
    } catch (_err) {
      console.error("[EventBridge] Error setting up inventory events:", _err);
    }
  }

  /**
   * Setup skill system event listeners
   *
   * Routes skill updates to specific players or broadcasts to all.
   *
   * @private
   */
  private setupSkillEvents(): void {
    try {
      this.world.on(EventType.SKILLS_UPDATED, (payload: unknown) => {
        const data = payload as { playerId?: string; skills?: unknown };

        if (data?.playerId) {
          // Send to specific player
          this.broadcast.sendToPlayer(data.playerId, "skillsUpdated", data);
        } else {
          // Broadcast to all
          this.broadcast.sendToAll("skillsUpdated", payload);
        }
      });
    } catch (_err) {
      console.error("[EventBridge] Error setting up skill events:", _err);
    }
  }

  /**
   * Setup UI event listeners
   *
   * Routes UI updates to specific players when player component changes.
   *
   * @private
   */
  private setupUIEvents(): void {
    try {
      this.world.on(EventType.UI_UPDATE, (payload: unknown) => {
        const data = payload as
          | { component?: string; data?: { playerId?: string } }
          | undefined;

        if (data?.component === "player" && data.data?.playerId) {
          this.broadcast.sendToPlayer(
            data.data.playerId,
            "playerState",
            data.data,
          );
        }
      });
    } catch (_err) {
      console.error("[EventBridge] Error setting up UI events:", _err);
    }
  }
}
