import { defineWorld } from "@latticexyz/world";
import { defineERC20Module } from "@latticexyz/world-module-erc20/internal";

/**
 * Hyperia On-Chain World Configuration
 *
 * This defines all MUD tables for the on-chain representation of Hyperia.
 * The game server writes to these tables optimistically after processing game logic locally.
 * Player-to-player transactions (trades, duels) execute through on-chain escrow.
 *
 * Design principles:
 * - Tables are split by access pattern to minimize gas per write
 * - Skills split into combat/gathering to avoid rewriting unrelated data
 * - VitalStats separated because they change most frequently
 * - Offchain tables used for high-volume, low-value data (loot tables, activity)
 * - Item ownership tracked in slot tables; ERC-1155 wraps total balances
 */
export default defineWorld({
  namespace: "hyperia",

  enums: {
    /**
     * Trade session status lifecycle:
     * Pending(0) → Active(1) → Confirming(2) → Completed(3)
     *                                        → Cancelled(4) (from any state)
     */
    TradeStatus: ["Pending", "Active", "Confirming", "Completed", "Cancelled"],

    /**
     * Equipment slot identifiers matching the game client's EquipmentSlotName enum.
     * Values map to uint8: Weapon=0, Shield=1, ..., Arrows=10
     */
    EquipSlot: [
      "Weapon",
      "Shield",
      "Helmet",
      "Body",
      "Legs",
      "Boots",
      "Gloves",
      "Cape",
      "Amulet",
      "Ring",
      "Arrows",
    ],

    /**
     * Item type categories matching the game client's ItemType enum.
     */
    ItemCategory: [
      "Weapon",
      "Armor",
      "Food",
      "Resource",
      "Tool",
      "Misc",
      "Currency",
      "Consumable",
      "Ammunition",
    ],
  },

  tables: {
    // =========================================================================
    // PLAYER IDENTITY & REGISTRATION
    // =========================================================================

    /**
     * PlayerRegistry - Links wallet addresses to in-game character IDs.
     * Written once at registration time by the server operator.
     * The characterId is a bytes32 hash of the server-side UUID.
     */
    PlayerRegistry: {
      schema: {
        playerAddress: "address",
        characterId: "bytes32",
        createdAt: "uint64",
        isActive: "bool",
        name: "string",
      },
      key: ["playerAddress"],
    },

    /**
     * Reverse lookup: characterId → playerAddress.
     * Needed because trades/duels reference characters by ID but
     * ERC-20/1155 operations require addresses.
     */
    CharacterOwner: {
      schema: {
        characterId: "bytes32",
        playerAddress: "address",
      },
      key: ["characterId"],
    },

    // =========================================================================
    // ITEM ID REGISTRY (Bidirectional Mapping)
    // =========================================================================

    /**
     * Maps numeric item IDs (uint32) to string item IDs (e.g. "bronze_sword").
     * Seeded at deploy time from the game's item manifests.
     * Noted items use numericId = baseId + 10000.
     */
    ItemIdToString: {
      schema: {
        numericId: "uint32",
        stringId: "string",
      },
      key: ["numericId"],
    },

    /**
     * Reverse mapping: keccak256(stringId) → numericId.
     * Used by the server to translate string IDs before chain writes.
     */
    ItemStringToId: {
      schema: {
        stringIdHash: "bytes32",
        numericId: "uint32",
      },
      key: ["stringIdHash"],
    },

    /**
     * Counter for generating sequential numeric IDs during seeding.
     */
    ItemIdCounter: {
      schema: {
        value: "uint32",
      },
      key: [],
    },

    // =========================================================================
    // ITEM DEFINITIONS (Reference Data)
    // =========================================================================

    /**
     * Core item properties. Seeded at deploy time from manifests.
     * Split from combat bonuses to keep the primary lookup small.
     */
    ItemDefinition: {
      schema: {
        numericId: "uint32",
        itemType: "ItemCategory",
        value: "uint32",
        stackable: "bool",
        tradeable: "bool",
        equipSlot: "uint8",
        healAmount: "uint16",
        name: "string",
      },
      key: ["numericId"],
    },

    /**
     * Level requirements for equipping items. Separate table because
     * only checked on equip action, not during general inventory ops.
     */
    ItemRequirements: {
      schema: {
        numericId: "uint32",
        attackReq: "uint8",
        strengthReq: "uint8",
        defenseReq: "uint8",
        rangedReq: "uint8",
        magicReq: "uint8",
        prayerReq: "uint8",
      },
      key: ["numericId"],
    },

    // =========================================================================
    // CHARACTER SKILLS (Split for gas efficiency)
    // =========================================================================

    /**
     * Combat skills - updated together when combat XP is granted.
     * 7 skills × (uint16 level + uint32 xp) = 336 bits = 2 storage slots.
     */
    CombatSkills: {
      schema: {
        characterId: "bytes32",
        attackLevel: "uint16",
        attackXp: "uint32",
        strengthLevel: "uint16",
        strengthXp: "uint32",
        defenseLevel: "uint16",
        defenseXp: "uint32",
        constitutionLevel: "uint16",
        constitutionXp: "uint32",
        rangedLevel: "uint16",
        rangedXp: "uint32",
        magicLevel: "uint16",
        magicXp: "uint32",
        prayerLevel: "uint16",
        prayerXp: "uint32",
      },
      key: ["characterId"],
    },

    /**
     * Gathering/production skills - updated during skilling activities.
     * 10 skills × (uint16 level + uint32 xp) = 480 bits = 2 storage slots.
     */
    GatheringSkills: {
      schema: {
        characterId: "bytes32",
        woodcuttingLevel: "uint16",
        woodcuttingXp: "uint32",
        miningLevel: "uint16",
        miningXp: "uint32",
        fishingLevel: "uint16",
        fishingXp: "uint32",
        firemakingLevel: "uint16",
        firemakingXp: "uint32",
        cookingLevel: "uint16",
        cookingXp: "uint32",
        smithingLevel: "uint16",
        smithingXp: "uint32",
        agilityLevel: "uint16",
        agilityXp: "uint32",
        craftingLevel: "uint16",
        craftingXp: "uint32",
        fletchingLevel: "uint16",
        fletchingXp: "uint32",
        runecraftingLevel: "uint16",
        runecraftingXp: "uint32",
      },
      key: ["characterId"],
    },

    /**
     * Vital stats - changes frequently (every combat tick, heal, prayer drain).
     * 80 bits = 1 storage slot. Cheapest possible write.
     */
    VitalStats: {
      schema: {
        characterId: "bytes32",
        combatLevel: "uint16",
        totalLevel: "uint16",
        health: "uint16",
        maxHealth: "uint16",
        prayerPoints: "uint16",
        prayerMaxPoints: "uint16",
      },
      key: ["characterId"],
    },

    // =========================================================================
    // INVENTORY (28 slots)
    // =========================================================================

    /**
     * Each row is one inventory slot for one character.
     * A slot with itemId=0 is empty (deleted record).
     * The server writes full inventory snapshots after changes.
     */
    InventorySlot: {
      schema: {
        characterId: "bytes32",
        slotIndex: "uint8",
        itemId: "uint32",
        quantity: "uint32",
      },
      key: ["characterId", "slotIndex"],
    },

    /**
     * Gold balance stored separately from inventory.
     * Mirrors characters.coins from the server database.
     * Also serves as the backing for ERC-20 HyperGold minting.
     */
    GoldBalance: {
      schema: {
        characterId: "bytes32",
        amount: "uint64",
      },
      key: ["characterId"],
    },

    // =========================================================================
    // EQUIPMENT (11 slots)
    // =========================================================================

    /**
     * Each row is one equipment slot for one character.
     * slotType maps to EquipSlot enum (0=Weapon through 10=Arrows).
     */
    EquipmentSlot: {
      schema: {
        characterId: "bytes32",
        slotType: "uint8",
        itemId: "uint32",
        quantity: "uint32",
      },
      key: ["characterId", "slotType"],
    },

    // =========================================================================
    // BANK (480 slots across 10 tabs)
    // =========================================================================

    /**
     * Bank storage. All items stack in bank.
     * Written lazily -- only changed slots are updated, not the full bank.
     */
    BankSlot: {
      schema: {
        characterId: "bytes32",
        tabIndex: "uint8",
        slot: "uint16",
        itemId: "uint32",
        quantity: "uint32",
      },
      key: ["characterId", "tabIndex", "slot"],
    },

    // =========================================================================
    // SHOP INVENTORY
    // =========================================================================

    /**
     * NPC shop stock. Seeded at deploy time from stores.json.
     * shopId is keccak256 of the shop's string ID.
     */
    ShopItem: {
      schema: {
        shopId: "bytes32",
        slotIndex: "uint8",
        itemId: "uint32",
        basePrice: "uint32",
        maxStock: "int32",
        currentStock: "int32",
        lastRestockBlock: "uint64",
      },
      key: ["shopId", "slotIndex"],
    },

    // =========================================================================
    // TRADE ESCROW SYSTEM
    // =========================================================================

    /**
     * Active trade session. Created when both players agree to trade.
     * Items/gold are escrowed in the World contract until completion or cancellation.
     */
    TradeSession: {
      schema: {
        tradeId: "bytes32",
        initiator: "address",
        recipient: "address",
        initiatorCharId: "bytes32",
        recipientCharId: "bytes32",
        status: "TradeStatus",
        initiatorAccepted: "bool",
        recipientAccepted: "bool",
        initiatorGold: "uint64",
        recipientGold: "uint64",
        createdAt: "uint64",
      },
      key: ["tradeId"],
    },

    /**
     * Items offered in a trade. side=0 for initiator, side=1 for recipient.
     * Items are moved from the player's InventorySlot into escrow (this table)
     * and the InventorySlot is cleared. On cancel, items return to inventory.
     */
    TradeOffer: {
      schema: {
        tradeId: "bytes32",
        side: "uint8",
        offerIndex: "uint8",
        itemId: "uint32",
        quantity: "uint32",
        sourceSlot: "uint8",
      },
      key: ["tradeId", "side", "offerIndex"],
    },

    /**
     * Completed trade log. Written when a trade completes, for historical record.
     * This is an offchain table -- emits events but costs no storage gas.
     */
    TradeLog: {
      schema: {
        tradeId: "bytes32",
        initiator: "address",
        recipient: "address",
        initiatorGold: "uint64",
        recipientGold: "uint64",
        timestamp: "uint64",
      },
      key: ["tradeId"],
      type: "offchainTable",
    },

    // =========================================================================
    // DUEL SYSTEM
    // =========================================================================

    /**
     * Completed duel record. Written when a duel finishes.
     * Stakes are handled off-chain by the server during the duel;
     * the final result (winner/loser, stake transfer) is committed here.
     */
    DuelRecord: {
      schema: {
        duelId: "bytes32",
        challenger: "address",
        opponent: "address",
        winner: "address",
        challengerCharId: "bytes32",
        opponentCharId: "bytes32",
        challengerStakeValue: "uint64",
        opponentStakeValue: "uint64",
        forfeit: "bool",
        timestamp: "uint64",
      },
      key: ["duelId"],
    },

    // =========================================================================
    // PLAYER STATISTICS
    // =========================================================================

    /**
     * Aggregate player stats. Updated after each combat encounter,
     * death, trade, or duel completion.
     */
    PlayerStats: {
      schema: {
        characterId: "bytes32",
        totalMobKills: "uint32",
        totalDeaths: "uint32",
        totalPlayerKills: "uint32",
        totalBossKills: "uint32",
        totalXpEarned: "uint64",
        totalGoldEarned: "uint64",
        totalTradesCompleted: "uint32",
        totalDuelsWon: "uint32",
        totalDuelsLost: "uint32",
      },
      key: ["characterId"],
    },

    /**
     * Per-NPC kill tracking. Updated after each mob kill.
     * npcId is keccak256 of the NPC's string identifier (e.g. "goblin").
     */
    NpcKillCount: {
      schema: {
        characterId: "bytes32",
        npcId: "bytes32",
        killCount: "uint32",
      },
      key: ["characterId", "npcId"],
    },

    // =========================================================================
    // ERC-1155 ITEM TOKEN TABLES
    // =========================================================================

    /**
     * ERC-1155 balance tracking. This is the canonical balance for each
     * (address, tokenId) pair. Game systems update this alongside slot tables.
     * External transfers (marketplace) modify this directly.
     *
     * Invariant: For any (address, tokenId):
     *   ItemBalance[addr][tokenId] ==
     *     sum(InventorySlots where itemId=tokenId) +
     *     sum(EquipmentSlots where itemId=tokenId) +
     *     sum(BankSlots where itemId=tokenId) +
     *     sum(TradeOffers where itemId=tokenId) +
     *     freeFloating (withdrawn items not in any slot)
     */
    ItemBalance: {
      schema: {
        account: "address",
        tokenId: "uint256",
        balance: "uint256",
      },
      key: ["account", "tokenId"],
    },

    /**
     * ERC-1155 operator approval. Standard setApprovalForAll mapping.
     */
    ItemOperatorApproval: {
      schema: {
        owner: "address",
        operator: "address",
        approved: "bool",
      },
      key: ["owner", "operator"],
    },

    // =========================================================================
    // OFFCHAIN TABLES (Events only, no storage cost)
    // =========================================================================

    /**
     * Combat result log. Emitted as events for indexing.
     * Contains the outcome of a combat encounter including XP gained and loot.
     */
    CombatResultLog: {
      schema: {
        resultId: "bytes32",
        characterId: "bytes32",
        targetNpcId: "bytes32",
        attackXpGained: "uint32",
        strengthXpGained: "uint32",
        defenseXpGained: "uint32",
        constitutionXpGained: "uint32",
        rangedXpGained: "uint32",
        magicXpGained: "uint32",
        goldDropped: "uint32",
        timestamp: "uint64",
      },
      key: ["resultId"],
      type: "offchainTable",
    },

    /**
     * Loot drop log. Emitted alongside CombatResultLog.
     * Each entry is one item drop from one combat encounter.
     */
    LootDropLog: {
      schema: {
        resultId: "bytes32",
        dropIndex: "uint8",
        itemId: "uint32",
        quantity: "uint32",
      },
      key: ["resultId", "dropIndex"],
      type: "offchainTable",
    },
  },

  // ===========================================================================
  // SYSTEM ACCESS CONTROL
  // ===========================================================================

  systems: {
    /**
     * PlayerRegistrySystem - restricted to namespace owner (server operator).
     * Handles player registration and character linking.
     */
    PlayerRegistrySystem: {
      openAccess: false,
    },

    /**
     * SkillSystem - restricted to namespace owner (server operator).
     * Handles XP grants and level-up calculations.
     */
    SkillSystem: {
      openAccess: false,
    },

    /**
     * InventorySystem - restricted to namespace owner (server operator).
     * Handles inventory slot management and ERC-1155 balance sync.
     */
    InventorySystem: {
      openAccess: false,
    },

    /**
     * EquipmentSystem - restricted to namespace owner (server operator).
     * Handles equip/unequip and stat recalculation.
     */
    EquipmentSystem: {
      openAccess: false,
    },

    /**
     * BankSystem - restricted to namespace owner (server operator).
     * Handles bank deposit/withdraw operations.
     */
    BankSystem: {
      openAccess: false,
    },

    /**
     * CombatResultSystem - restricted to namespace owner (server operator).
     * Batches combat outcomes: XP, loot, kills, gold.
     */
    CombatResultSystem: {
      openAccess: false,
    },

    /**
     * StatsSystem - restricted to namespace owner (server operator).
     * Updates kill counts, death counts, and aggregate stats.
     */
    StatsSystem: {
      openAccess: false,
    },

    /**
     * ShopSystem - restricted to namespace owner (server operator).
     * Handles NPC shop buy/sell and stock management.
     */
    ShopSystem: {
      openAccess: false,
    },

    /**
     * ItemRegistrySystem - restricted to namespace owner (server operator).
     * Manages the bidirectional item ID mapping registry.
     */
    ItemRegistrySystem: {
      openAccess: false,
    },

    /**
     * TradeSystem - PUBLIC ACCESS. Players call this directly.
     * Handles escrow-based player-to-player trading.
     * Players sign their own transactions for offers/confirmations.
     */
    TradeSystem: {
      openAccess: true,
    },

    /**
     * DuelSystem - restricted to namespace owner (server resolves duels).
     * Server commits duel results after combat is resolved off-chain.
     */
    DuelSystem: {
      openAccess: false,
    },

    /**
     * GoldSystem - restricted to namespace owner (server mints/burns).
     * Manages ERC-20 gold minting, burning, and in-game transfers.
     */
    GoldSystem: {
      openAccess: false,
    },

    /**
     * ItemTokenSystem - restricted to namespace owner initially.
     * Manages ERC-1155 minting, burning, and balance tracking.
     */
    ItemTokenSystem: {
      openAccess: false,
    },
  },

  // ===========================================================================
  // MODULES
  // ===========================================================================

  modules: [
    /**
     * HyperGold ERC-20 Token
     *
     * The in-game gold currency as a standard ERC-20.
     * - Server operator mints gold (mob drops, quest rewards, shop sells)
     * - Server operator burns gold (shop buys, death penalties)
     * - Players can transfer freely (enables DEX trading)
     * - Transfer tax applied on external transfers (configurable)
     *
     * Namespace "gold" is created automatically by the module.
     * Ownership is transferred to the deployer (server operator).
     */
    defineERC20Module({
      namespace: "gold",
      name: "HyperGold",
      symbol: "HGLD",
    }),
  ],
});
