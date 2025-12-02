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
import { EventType, ALL_WORLD_AREAS } from "@hyperscape/shared";
import type { BroadcastManager } from "./broadcast";
import { BankRepository } from "../../database/repositories/BankRepository";
import type { StoreSystem } from "@hyperscape/shared";
import type pg from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../../database/schema";

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
   * Get database from world object
   *
   * @private
   */
  private getDatabase(): {
    drizzle: NodePgDatabase<typeof schema>;
    pool: pg.Pool;
  } | null {
    const serverWorld = this.world as {
      pgPool?: pg.Pool;
      drizzleDb?: NodePgDatabase<typeof schema>;
    };

    if (serverWorld.drizzleDb && serverWorld.pgPool) {
      return {
        drizzle: serverWorld.drizzleDb,
        pool: serverWorld.pgPool,
      };
    }

    return null;
  }

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
    this.setupCombatEvents();
    this.setupPlayerEvents();
    this.setupDialogueEvents();
    this.setupBankingEvents();
    this.setupStoreEvents();
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

      // Handle coin updates - send to specific player
      this.world.on(EventType.INVENTORY_COINS_UPDATED, (payload: unknown) => {
        const data = payload as { playerId: string; coins: number };
        // Send coins update to the specific player
        this.broadcast.sendToPlayer(data.playerId, "coinsUpdated", {
          playerId: data.playerId,
          coins: data.coins,
        });
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

      // Forward death screen events to specific player
      this.world.on(EventType.UI_DEATH_SCREEN, (payload: unknown) => {
        const data = payload as {
          playerId: string;
          message: string;
          killedBy: string;
          respawnTime: number;
        };

        if (data.playerId) {
          console.log(
            `[EventBridge] Forwarding UI_DEATH_SCREEN to player ${data.playerId}`,
          );
          this.broadcast.sendToPlayer(data.playerId, "deathScreen", data);
        }
      });

      // Forward death screen close events to specific player
      this.world.on(EventType.UI_DEATH_SCREEN_CLOSE, (payload: unknown) => {
        const data = payload as { playerId: string };

        if (data.playerId) {
          console.log(
            `[EventBridge] Forwarding UI_DEATH_SCREEN_CLOSE to player ${data.playerId}`,
          );
          this.broadcast.sendToPlayer(data.playerId, "deathScreenClose", data);
        }
      });

      // Forward player death state changes to clients
      this.world.on(EventType.PLAYER_SET_DEAD, (payload: unknown) => {
        const data = payload as { playerId: string; isDead: boolean };

        if (data.playerId) {
          console.log(
            `[EventBridge] Forwarding PLAYER_SET_DEAD to player ${data.playerId}, isDead:${data.isDead}`,
          );
          this.broadcast.sendToPlayer(data.playerId, "playerSetDead", data);
        }
      });

      // Forward player respawn events to clients
      this.world.on(EventType.PLAYER_RESPAWNED, (payload: unknown) => {
        const data = payload as {
          playerId: string;
          spawnPosition: { x: number; y: number; z: number };
        };

        if (data.playerId) {
          console.log(
            `[EventBridge] Forwarding PLAYER_RESPAWNED to player ${data.playerId}`,
          );
          this.broadcast.sendToPlayer(data.playerId, "playerRespawned", data);
        }
      });

      // Forward attack style change events to specific player
      this.world.on(EventType.UI_ATTACK_STYLE_CHANGED, (payload: unknown) => {
        const data = payload as {
          playerId: string;
          currentStyle: unknown;
          availableStyles: unknown;
          canChange: boolean;
          cooldownRemaining?: number;
        };

        if (data.playerId) {
          console.log(
            `[EventBridge] Forwarding UI_ATTACK_STYLE_CHANGED to player ${data.playerId}`,
          );
          this.broadcast.sendToPlayer(
            data.playerId,
            "attackStyleChanged",
            data,
          );
        }
      });

      // Forward attack style update events to specific player
      this.world.on(EventType.UI_ATTACK_STYLE_UPDATE, (payload: unknown) => {
        const data = payload as {
          playerId: string;
          currentStyle: unknown;
          availableStyles: unknown;
          canChange: boolean;
        };

        if (data.playerId) {
          console.log(
            `[EventBridge] Forwarding UI_ATTACK_STYLE_UPDATE to player ${data.playerId}`,
          );
          this.broadcast.sendToPlayer(data.playerId, "attackStyleUpdate", data);
        }
      });
    } catch (_err) {
      console.error("[EventBridge] Error setting up UI events:", _err);
    }
  }

  /**
   * Setup combat system event listeners
   *
   * Forwards combat damage events to all connected clients for visual feedback
   * (damage splats, hit effects, etc.)
   *
   * @private
   */
  private setupCombatEvents(): void {
    try {
      // Forward damage dealt events to all clients for visual effects
      this.world.on(EventType.COMBAT_DAMAGE_DEALT, (payload: unknown) => {
        const data = payload as {
          attackerId: string;
          targetId: string;
          damage: number;
          targetType: "player" | "mob";
          position: { x: number; y: number; z: number };
        };

        console.log(
          `[EventBridge] Forwarding COMBAT_DAMAGE_DEALT: ${data.damage} damage to ${data.targetId}`,
        );

        // Broadcast to all clients so everyone sees the damage splat
        this.broadcast.sendToAll("combatDamageDealt", data);
      });
    } catch (_err) {
      console.error("[EventBridge] Error setting up combat events:", _err);
    }
  }

  /**
   * Setup player system event listeners
   *
   * Forwards player state updates (health, stats, etc.) to specific players
   *
   * @private
   */
  private setupPlayerEvents(): void {
    try {
      // Forward player updates to specific player (health, stats, etc.)
      // Note: emitPlayerUpdate() sends { playerId, component, data: playerData }
      // where data.health is { current, max } object
      this.world.on(EventType.PLAYER_UPDATED, (payload: unknown) => {
        const data = payload as {
          playerId: string;
          component?: string;
          data?: {
            id: string;
            name: string;
            level: number;
            health: { current: number; max: number };
            alive: boolean;
          };
        };

        if (data.playerId && data.data) {
          const playerData = data.data;

          // Send to specific player with flat health values for client
          this.broadcast.sendToPlayer(data.playerId, "playerUpdated", {
            health: playerData.health.current,
            maxHealth: playerData.health.max,
            alive: playerData.alive,
          });
        }
      });
    } catch (_err) {
      console.error("[EventBridge] Error setting up player events:", _err);
    }
  }

  /**
   * Setup dialogue system event listeners
   *
   * Forwards dialogue events (start, node change, end) to specific players
   * for the DialoguePanel UI component.
   *
   * @private
   */
  private setupDialogueEvents(): void {
    try {
      // Forward dialogue start events to specific player
      this.world.on(EventType.DIALOGUE_START, (payload: unknown) => {
        const data = payload as {
          playerId: string;
          npcId: string;
          npcName: string;
          nodeId: string;
          text: string;
          responses: Array<{
            text: string;
            nextNodeId: string;
            effect?: string;
          }>;
          npcEntityId?: string;
        };

        if (data.playerId) {
          // Pass npcEntityId for live position lookup on client (like bank does)
          this.broadcast.sendToPlayer(data.playerId, "dialogueStart", {
            npcId: data.npcId,
            npcName: data.npcName,
            nodeId: data.nodeId,
            text: data.text,
            responses: data.responses,
            npcEntityId: data.npcEntityId,
          });
        }
      });

      // Forward dialogue node change events to specific player
      this.world.on(EventType.DIALOGUE_NODE_CHANGE, (payload: unknown) => {
        const data = payload as {
          playerId: string;
          npcId: string;
          nodeId: string;
          text: string;
          responses: Array<{
            text: string;
            nextNodeId: string;
            effect?: string;
          }>;
        };

        if (data.playerId) {
          this.broadcast.sendToPlayer(data.playerId, "dialogueNodeChange", {
            npcId: data.npcId,
            nodeId: data.nodeId,
            text: data.text,
            responses: data.responses,
          });
        }
      });

      // Forward dialogue end events to specific player
      this.world.on(EventType.DIALOGUE_END, (payload: unknown) => {
        const data = payload as {
          playerId: string;
          npcId: string;
        };

        if (data.playerId) {
          this.broadcast.sendToPlayer(data.playerId, "dialogueEnd", {
            npcId: data.npcId,
          });
        }
      });
    } catch (_err) {
      console.error("[EventBridge] Error setting up dialogue events:", _err);
    }
  }

  /**
   * Setup banking system event listeners
   *
   * Handles bank open requests from dialogue effects and other sources.
   * Queries the database for player's bank items and sends bankState to client.
   *
   * @private
   */
  private setupBankingEvents(): void {
    try {
      // Handle bank open requests (from dialogue effects, NPC interactions, etc.)
      this.world.on(EventType.BANK_OPEN_REQUEST, async (payload: unknown) => {
        const data = payload as {
          playerId: string;
          npcId: string;
          npcEntityId?: string;
        };

        if (!data.playerId) {
          console.warn("[EventBridge] BANK_OPEN_REQUEST missing playerId");
          return;
        }

        try {
          // Query database for player's bank items (universal bank - same as BankEntity)
          const db = this.getDatabase();
          if (!db) {
            console.error(
              "[EventBridge] No database available for bank operation",
            );
            return;
          }

          const bankRepo = new BankRepository(db.drizzle, db.pool);
          const items = await bankRepo.getPlayerBank(data.playerId);

          // Send bankState to player (same format as handleBankOpen in bank.ts)
          // Use npcEntityId for distance checking if available (from dialogue), otherwise use spawn_bank
          this.broadcast.sendToPlayer(data.playerId, "bankState", {
            playerId: data.playerId,
            bankId: data.npcEntityId || "spawn_bank",
            items,
            maxSlots: 480,
          });
        } catch (err) {
          console.error("[EventBridge] Error fetching bank data:", err);
        }
      });
    } catch (_err) {
      console.error("[EventBridge] Error setting up banking events:", _err);
    }
  }

  /**
   * Setup store system event listeners
   *
   * Handles store open requests from dialogue effects.
   * Looks up store data and sends storeState to client.
   *
   * @private
   */
  private setupStoreEvents(): void {
    try {
      this.world.on(EventType.STORE_OPEN_REQUEST, async (payload: unknown) => {
        const data = payload as {
          playerId: string;
          npcId: string;
          storeId?: string;
          npcEntityId?: string;
        };

        if (!data.playerId) {
          console.warn("[EventBridge] STORE_OPEN_REQUEST missing playerId");
          return;
        }

        // Get storeId - either from event or look up from NPC
        let storeId = data.storeId;
        if (!storeId) {
          storeId = this.getStoreIdForNpc(data.npcId);
        }

        if (!storeId) {
          console.warn(`[EventBridge] No store linked to NPC ${data.npcId}`);
          return;
        }

        // Get store data from StoreSystem
        const storeSystem = this.world.getSystem("store") as
          | StoreSystem
          | undefined;
        const store = storeSystem?.getStore(storeId);

        if (!store) {
          console.warn(`[EventBridge] Store not found: ${storeId}`);
          return;
        }

        // Send storeState packet to player (include npcEntityId for distance checking)
        this.broadcast.sendToPlayer(data.playerId, "storeState", {
          storeId: store.id,
          storeName: store.name,
          buybackRate: store.buybackRate,
          items: store.items,
          isOpen: true,
          npcEntityId: data.npcEntityId,
        });
      });
    } catch (_err) {
      console.error("[EventBridge] Error setting up store events:", _err);
    }
  }

  /**
   * Look up storeId for an NPC from world areas
   */
  private getStoreIdForNpc(npcId: string): string | undefined {
    // ALL_WORLD_AREAS is flat: Record<string, WorldArea>
    for (const area of Object.values(ALL_WORLD_AREAS)) {
      const typedArea = area as {
        npcs?: Array<{ id: string; storeId?: string }>;
      };
      const npc = typedArea.npcs?.find((n) => n.id === npcId);
      if (npc?.storeId) return npc.storeId;
    }
    return undefined;
  }

  /**
   * Look up NPC position from world areas
   */
  private getNpcPositionFromWorldAreas(
    npcId: string,
  ): { x: number; y: number; z: number } | undefined {
    for (const area of Object.values(ALL_WORLD_AREAS)) {
      const typedArea = area as {
        npcs?: Array<{
          id: string;
          position: { x: number; y: number; z: number };
        }>;
      };
      const npc = typedArea.npcs?.find((n) => n.id === npcId);
      if (npc?.position) return npc.position;
    }
    return undefined;
  }
}
