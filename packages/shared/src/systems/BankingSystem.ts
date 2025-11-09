import type { World } from "../types";
import { EventType } from "../types/events";
import type { BankDepositEvent, BankWithdrawEvent } from "../types/events";
import { BANKING_CONSTANTS } from "../constants/BankingConstants";
import { BankData, InventoryItem } from "../types/core";
import { BankID, PlayerID } from "../types/identifiers";
import { calculateDistance } from "../utils/EntityUtils";
import {
  createBankID,
  createItemID,
  createPlayerID,
} from "../utils/IdentifierUtils";
import { SystemBase } from "./SystemBase";

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
  private playerBanks = new Map<PlayerID, Map<BankID, BankData>>(); // playerId -> bankId -> bankData
  private openBanks = new Map<PlayerID, BankID>(); // playerId -> currently open bankId
  private playerInventories = new Map<
    PlayerID,
    { items: InventoryItem[]; coins: number }
  >(); // Cache for reactive pattern
  // Logger is inherited from SystemBase, no need to override
  private readonly MAX_BANK_SLOTS = BANKING_CONSTANTS.MAX_BANK_SLOTS;
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
    // Subscribe to banking events with proper type casting
    // Listen to PLAYER_REGISTERED for all players (real and test)
    this.subscribe(EventType.PLAYER_REGISTERED, (data) =>
      this.initializePlayerBanks({
        id: (data as { playerId: string }).playerId,
      }),
    );
    this.subscribe(EventType.PLAYER_UNREGISTERED, (data) => {
      this.cleanupPlayerBanks((data as { playerId: string }).playerId);
    });
    this.subscribe(EventType.BANK_OPEN, (data) =>
      this.openBank(
        data as {
          playerId: string;
          bankId: string;
          playerPosition?: { x: number; y: number; z: number };
        },
      ),
    );
    this.subscribe(EventType.BANK_CLOSE, (data) =>
      this.closeBank(data as { playerId: string; bankId: string }),
    );
    this.subscribe(EventType.BANK_DEPOSIT, (data) =>
      this.depositItem(data as unknown as BankDepositEvent),
    );
    this.subscribe(EventType.BANK_WITHDRAW, (data) =>
      this.withdrawItem(data as unknown as BankWithdrawEvent),
    );
    this.subscribe(EventType.BANK_DEPOSIT_ALL, (data) =>
      this.depositAllItems(data as { playerId: string; bankId: string }),
    );

    // Listen to inventory updates for reactive pattern
    this.subscribe(EventType.INVENTORY_UPDATED, (data) => {
      const typedData = data as {
        playerId: string;
        items: Array<{ slot: number; itemId: string; quantity: number }>;
        coins: number;
      };
      const playerId = createPlayerID(typedData.playerId);
      const inventory = this.playerInventories.get(playerId) || {
        items: [],
        coins: 0,
      };
      inventory.items = typedData.items.map((item) => ({
        id: `${playerId}_${item.itemId}_${item.slot}`,
        itemId: item.itemId,
        quantity: item.quantity,
        slot: item.slot,
        metadata: null,
      }));
      this.playerInventories.set(playerId, inventory);
    });

    this.subscribe(EventType.INVENTORY_COINS_UPDATED, (data) => {
      const typedData = data as { playerId: string; newAmount: number };
      const playerId = createPlayerID(typedData.playerId);
      const inventory = this.playerInventories.get(playerId) || {
        items: [],
        coins: 0,
      };
      inventory.coins = typedData.newAmount;
      this.playerInventories.set(playerId, inventory);
    });
  }

  private initializePlayerBanks(playerData: { id: string }): void {
    const playerId = createPlayerID(playerData.id);
    const playerBanks = new Map<BankID, BankData>();

    // Initialize empty banks for each starter town per GDD
    for (const bankInfo of this.STARTER_TOWN_BANKS) {
      const bankData: BankData = {
        items: [],
        maxSlots: this.MAX_BANK_SLOTS,
      };
      playerBanks.set(createBankID(bankInfo.id), bankData);
    }

    this.playerBanks.set(playerId, playerBanks);
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
      console.warn(
        "[BankingSystem] No banks initialized for player:",
        playerId,
      );
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

    // Get the currently open bank for this player
    const bankId = this.openBanks.get(playerId);
    if (!bankId) {
      console.warn("[BankingSystem] No bank open for player:", playerId);

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
      console.warn("[BankingSystem] No bank open for player:", playerId);
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

    // Get the currently open bank for this player
    const bankId = this.openBanks.get(playerId);
    if (!bankId) {
      console.warn("[BankingSystem] No bank open for player:", playerId);
      return;
    }

    // Get cached inventory items (reactive pattern)
    const inventory = this.playerInventories.get(playerId);
    if (!inventory || !inventory.items || inventory.items.length === 0) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: "You have no items to deposit.",
        type: "info",
      });
      return;
    }

    // Get the bank for this player
    const playerBanks = this.playerBanks.get(playerId);
    const bank = playerBanks?.get(bankId);
    if (!bank) {
      console.error(
        "[BankingSystem] Bank not found:",
        bankId,
        "for player:",
        playerId,
      );
      return;
    }

    // Deposit each item from inventory
    let itemsDeposited = 0;
    const itemsToDeposit = [...inventory.items] as Array<{
      itemId: string;
      quantity: number;
      slot?: number;
    }>;

    for (const item of itemsToDeposit) {
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
