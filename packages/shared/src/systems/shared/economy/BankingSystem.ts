import type { World } from "../../../types";
import { EventType } from "../../../types/events";
import type {
  BankDepositEvent,
  BankWithdrawEvent,
} from "../../../types/events";
import type {
  PlayerRegisteredEvent,
  PlayerUnregisteredEvent,
  BankOpenEvent,
  BankCloseEvent,
  InventoryUpdatedEvent,
  InventoryCoinsUpdatedEvent,
} from "../../../types/event-handler-types";
import { BANKING_CONSTANTS } from "../../../constants/BankingConstants";
import { BankData, InventoryItem } from "../../../types/core/core";
import { BankID, PlayerID } from "../../../types/core/identifiers";
import { calculateDistance } from "../../../utils/game/EntityUtils";
import {
  createBankID,
  createItemID,
  createPlayerID,
} from "../../../utils/IdentifierUtils";
import { SystemBase } from "../infrastructure/SystemBase";

/**
 * Banking System
 * Manages player bank storage per GDD specifications:
 * - One bank per starter town
 * - Unlimited storage slots per bank
 * - Banks are independent (no shared storage)
 * - Click bank to open interface
 * - Drag items to store/retrieve
 */
export class BankingSystem extends SystemBase {
  private playerBanks = new Map<PlayerID, Map<BankID, BankData>>();
  private openBanks = new Map<PlayerID, BankID>();
  private playerInventories = new Map<
    PlayerID,
    { items: InventoryItem[]; coins: number }
  >();
  private readonly MAX_BANK_SLOTS = BANKING_CONSTANTS.MAX_BANK_SLOTS;
  private readonly playerBanksBuffer = new Map<BankID, BankData>();
  private readonly inventoryUpdateBuffer: {
    items: Array<{
      id: string;
      itemId: string;
      quantity: number;
      slot: number;
      metadata: null;
    }>;
    coins: number;
  } = { items: [], coins: 0 };
  private readonly STARTER_TOWN_BANKS = [
    { id: "bank_town_0", name: "Central Bank", position: { x: 0, y: 0, z: 5 } }, // Y will be grounded to terrain
    {
      id: "bank_town_1",
      name: "Eastern Bank",
      position: { x: 100, y: 0, z: 5 },
    }, // Y will be grounded to terrain
    {
      id: "bank_town_2",
      name: "Western Bank",
      position: { x: -100, y: 0, z: 5 },
    }, // Y will be grounded to terrain
    {
      id: "bank_town_3",
      name: "Northern Bank",
      position: { x: 0, y: 0, z: 105 },
    }, // Y will be grounded to terrain
    {
      id: "bank_town_4",
      name: "Southern Bank",
      position: { x: 0, y: 0, z: -95 },
    }, // Y will be grounded to terrain
  ];

  constructor(world: World) {
    super(world, {
      name: "banking",
      dependencies: {
        required: ["inventory"],
        optional: ["ui"],
      },
      autoCleanup: true,
    });
  }

  /**
   * Public read-only access to a player's bank data for the given bank id.
   * Returns null if the player or bank has not been initialized.
   */
  public getBankData(playerId: string, bankId: string): BankData | null {
    const typedPlayerId = createPlayerID(playerId);
    const typedBankId = createBankID(bankId);
    const playerBanks = this.playerBanks.get(typedPlayerId);
    if (!playerBanks) return null;
    const bank = playerBanks.get(typedBankId);
    return bank ?? null;
  }

  async init(): Promise<void> {
    // NOTE: Banking is now handled server-side via network packets (bankOpen, bankDeposit, bankWithdraw)
    // and persisted to database via BankRepository.
    // The client sends packets directly via world.network.send() from InteractionSystem.
    // This in-memory system is kept for backwards compatibility but server packet handlers
    // have priority for actual bank operations.

    // Only subscribe to events on server (client uses network packets directly)
    if (!this.world.isClient) {
      // Subscribe to banking events with proper type casting
      // Listen to PLAYER_REGISTERED for all players (real and test)
      this.subscribe<PlayerRegisteredEvent>(
        EventType.PLAYER_REGISTERED,
        (data) => this.initializePlayerBanks({ id: data.playerId }),
      );
      this.subscribe<PlayerUnregisteredEvent>(
        EventType.PLAYER_UNREGISTERED,
        (data) => {
          this.cleanupPlayerBanks(data.playerId);
        },
      );
      this.subscribe<BankOpenEvent>(EventType.BANK_OPEN, (data) =>
        this.openBank(data),
      );
      this.subscribe<BankCloseEvent>(EventType.BANK_CLOSE, (data) =>
        this.closeBank(data),
      );
      this.subscribe<BankDepositEvent>(EventType.BANK_DEPOSIT, (data) =>
        this.depositItem(data),
      );
      this.subscribe<BankWithdrawEvent>(EventType.BANK_WITHDRAW, (data) =>
        this.withdrawItem(data),
      );
      this.subscribe<{ playerId: string; bankId: string }>(
        EventType.BANK_DEPOSIT_ALL,
        (data) => this.depositAllItems(data),
      );
    }

    this.subscribe<InventoryUpdatedEvent>(
      EventType.INVENTORY_UPDATED,
      (data) => {
        const playerId = createPlayerID(data.playerId);
        let inventory = this.playerInventories.get(playerId);

        if (!inventory) {
          inventory = { items: [], coins: 0 };
          this.playerInventories.set(playerId, inventory);
        }

        this.inventoryUpdateBuffer.items.length = 0;
        for (const item of data.items) {
          this.inventoryUpdateBuffer.items.push({
            id: `${playerId}_${item.itemId}_${item.slot}`,
            itemId: item.itemId,
            quantity: item.quantity,
            slot: item.slot,
            metadata: null,
          });
        }

        inventory.items = this.inventoryUpdateBuffer.items.slice();
      },
    );

    this.subscribe<InventoryCoinsUpdatedEvent>(
      EventType.INVENTORY_COINS_UPDATED,
      (data) => {
        const playerId = createPlayerID(data.playerId);
        let inventory = this.playerInventories.get(playerId);

        if (!inventory) {
          inventory = { items: [], coins: 0 };
          this.playerInventories.set(playerId, inventory);
        }

        inventory.coins = data.newAmount;
      },
    );
  }

  private initializePlayerBanks(playerData: { id: string }): void {
    const playerId = createPlayerID(playerData.id);

    this.playerBanksBuffer.clear();

    for (const bankInfo of this.STARTER_TOWN_BANKS) {
      const bankData: BankData = {
        items: [],
        maxSlots: this.MAX_BANK_SLOTS,
      };
      this.playerBanksBuffer.set(createBankID(bankInfo.id), bankData);
    }

    this.playerBanks.set(playerId, new Map(this.playerBanksBuffer));
  }

  private cleanupPlayerBanks(playerId: string): void {
    this.playerBanks.delete(createPlayerID(playerId));
  }

  private openBank(data: {
    playerId: string;
    bankId: string;
    playerPosition?: { x: number; y: number; z: number };
  }): void {
    const playerId = createPlayerID(data.playerId);
    const bankId = createBankID(data.bankId);

    // Check if this bank is already open to prevent recursive calls
    const currentOpenBank = this.openBanks.get(playerId);
    if (currentOpenBank === bankId) {
      return; // Bank is already open, don't process again
    }

    // Track which bank is open
    this.openBanks.set(playerId, bankId);

    const playerBanks = this.playerBanks.get(playerId);
    if (!playerBanks) {
      this.logger.warn("No banks initialized for player:", { playerId });
      return;
    }

    const bank = playerBanks.get(bankId);
    if (!bank) {
      return;
    }

    // Check if player is near the bank (within 3 meters)
    const bankInfo = this.STARTER_TOWN_BANKS.find((b) => b.id === data.bankId);
    if (bankInfo && data.playerPosition) {
      const distance = calculateDistance(
        data.playerPosition,
        bankInfo.position,
      );
      if (distance > 3) {
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: data.playerId,
          message: "You need to be closer to the bank to use it.",
          type: "error",
        });
        return;
      }
    }

    // Send bank interface data to player
    this.emitTypedEvent(EventType.UI_UPDATE, {
      playerId: data.playerId,
      component: "bank",
      data: {
        bankId: data.bankId,
        bankName: bankInfo?.name || "Bank",
        items: bank.items,
        maxSlots: bank.maxSlots,
        usedSlots: bank.items.length,
        isOpen: true,
      },
    });

    // Also send player inventory for transfer interface
    this.emitTypedEvent(EventType.INVENTORY_REQUEST, {
      playerId: data.playerId,
    });
  }

  private closeBank(data: { playerId: string; bankId: string }): void {
    const playerId = createPlayerID(data.playerId);

    // Clear the open bank
    this.openBanks.delete(playerId);

    this.emitTypedEvent(EventType.UI_UPDATE, {
      playerId: data.playerId,
      component: "bank",
      data: {
        bankId: data.bankId,
        isOpen: false,
      },
    });
  }

  private depositItem(data: BankDepositEvent): void {
    const playerId = createPlayerID(data.playerId);

    const bankId = this.openBanks.get(playerId);
    if (!bankId) {
      this.logger.warn("No bank open for player:", { playerId });
      return;
    }

    const itemId = createItemID(String(data.itemId));

    const playerBanks = this.playerBanks.get(playerId);
    if (!playerBanks) return;

    const bank = playerBanks.get(bankId);
    if (!bank) return;

    // Remove item from inventory, then add to bank if successful
    this.emitTypedEvent(EventType.INVENTORY_CHECK, {
      playerId: data.playerId,
      itemId,
      quantity: data.quantity,
      callback: (hasItem, itemInfo) => {
        if (hasItem && itemInfo) {
          this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
            playerId: data.playerId,
            itemId: data.itemId,
            quantity: data.quantity,
          });

          const existingItem = bank.items.find(
            (bankItem) => bankItem.id === itemId,
          );
          if (existingItem) {
            existingItem.quantity += data.quantity;
          } else {
            if (bank.items.length >= bank.maxSlots) {
              this.emitTypedEvent(EventType.UI_MESSAGE, {
                playerId: data.playerId,
                message: "Bank is full.",
                type: "error",
              });
              // Refund item if bank is full
              this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
                playerId: data.playerId,
                item: {
                  id: `inv_${data.playerId}_${Date.now()}`,
                  itemId: data.itemId,
                  quantity: data.quantity,
                  slot: -1,
                  metadata: null,
                },
              });
              return;
            }
            bank.items.push({
              id: itemId,
              name: itemInfo.name,
              quantity: data.quantity,
              stackable: itemInfo.stackable,
            });
          }

          this.emitTypedEvent(EventType.BANK_DEPOSIT_SUCCESS, {
            playerId: data.playerId,
            itemId: data.itemId,
            quantity: data.quantity,
            bankId: bankId,
          });

          this.updateBankInterface(data.playerId, bankId);
        } else {
          this.emitTypedEvent(EventType.UI_MESSAGE, {
            playerId: data.playerId,
            message: "Item not found in inventory.",
            type: "error",
          });
        }
      },
    });
  }

  private withdrawItem(data: BankWithdrawEvent): void {
    const playerId = createPlayerID(data.playerId);

    // Get the currently open bank for this player
    const bankId = this.openBanks.get(playerId);
    if (!bankId) {
      this.logger.warn("No bank open for player:", { playerId });
      return;
    }
    const itemId = createItemID(String(data.itemId));

    const playerBanks = this.playerBanks.get(playerId);
    if (!playerBanks) return;

    const bank = playerBanks.get(bankId);
    if (!bank) return;

    // Find item in bank
    const bankItemIndex = bank.items.findIndex((item) => item.id === itemId);
    if (bankItemIndex === -1) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: "Item not found in bank.",
        type: "error",
      });
      return;
    }

    const bankItem = bank.items[bankItemIndex];
    if (bankItem.quantity < data.quantity) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: "Not enough of that item in bank.",
        type: "error",
      });
      return;
    }

    // Simplified approach - assume inventory can add and let inventory system handle validation
    // Remove from bank
    bankItem.quantity -= data.quantity;
    if (bankItem.quantity <= 0) {
      bank.items.splice(bankItemIndex, 1);
    }

    // Add to player inventory
    this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
      playerId: data.playerId,
      item: {
        id: `inv_${data.playerId}_${Date.now()}`,
        itemId: bankItem.id, // bankItem.id is the itemId (reference to base item)
        quantity: data.quantity,
        slot: -1, // Let system find empty slot
        metadata: null,
      },
    });

    // Update bank interface
    this.updateBankInterface(data.playerId, bankId);
  }

  private depositAllItems(data: { playerId: string; bankId: string }): void {
    const playerId = createPlayerID(data.playerId);

    const bankId = this.openBanks.get(playerId);
    if (!bankId) {
      this.logger.warn("No bank open for player:", { playerId });
      return;
    }

    const inventory = this.playerInventories.get(playerId);
    if (!inventory || inventory.items.length === 0) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: "You have no items to deposit.",
        type: "info",
      });
      return;
    }

    const playerBanks = this.playerBanks.get(playerId);
    const bank = playerBanks?.get(bankId);
    if (!bank) {
      this.logger.error("Bank not found", new Error("Bank not found"), {
        bankId,
        playerId,
      });
      return;
    }

    let itemsDeposited = 0;

    for (const item of inventory.items) {
      // Check if bank is full
      if (bank.items.length >= this.MAX_BANK_SLOTS) {
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: data.playerId,
          message: `Bank is full! Deposited ${itemsDeposited} items.`,
          type: "warning",
        });
        break;
      }

      // Add item to bank
      bank.items.push({
        id: item.itemId,
        name: "", // Will be populated when UI fetches full item data
        quantity: item.quantity,
        stackable: true, // Will be determined by actual item data
      });

      // Remove item from inventory
      this.emitTypedEvent(EventType.INVENTORY_ITEM_REMOVED, {
        playerId: data.playerId,
        itemId: item.itemId,
        quantity: item.quantity,
        slot: item.slot,
      });

      itemsDeposited++;
    }

    // Emit success events
    if (itemsDeposited > 0) {
      this.emitTypedEvent(EventType.BANK_DEPOSIT_SUCCESS, {
        playerId: data.playerId,
        bankId: bankId,
        itemsDeposited,
      });

      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: `Deposited ${itemsDeposited} items into the bank.`,
        type: "success",
      });
    }
  }

  private updateBankInterface(playerId: string, bankId: string): void {
    const typedPlayerId = createPlayerID(playerId);
    const typedBankId = createBankID(bankId);

    const playerBanks = this.playerBanks.get(typedPlayerId);
    if (!playerBanks) return;

    const bank = playerBanks.get(typedBankId);
    if (!bank) return;

    const bankInfo = this.STARTER_TOWN_BANKS.find((b) => b.id === bankId);

    // Send bank data via UI_UPDATE event - UI will update reactively
    this.emitTypedEvent(EventType.UI_UPDATE, {
      playerId,
      component: "bank",
      data: {
        bankId,
        bankName: bankInfo?.name || "Bank",
        items: bank.items,
        maxSlots: bank.maxSlots,
        usedSlots: bank.items.length,
        isOpen: true,
      },
    });
  }
}
