import { defineWorld } from "@latticexyz/world";

/**
 * Hyperscape MUD World Configuration
 * 
 * On-chain RuneScape-style RPG with 9 skills, 28-slot inventory, 6-slot equipment.
 * All game state stored on Jeju blockchain.
 */
export default defineWorld({
  namespace: "hyperscape",
  
  enums: {
    ItemType: ["WEAPON", "ARMOR", "TOOL", "RESOURCE", "CONSUMABLE", "AMMUNITION"],
    EquipSlot: ["WEAPON", "SHIELD", "HELMET", "BODY", "LEGS", "ARROWS"],
    MobType: ["GOBLIN", "BANDIT", "BARBARIAN", "HOBGOBLIN", "GUARD", "DARK_WARRIOR", "BLACK_KNIGHT", "ICE_WARRIOR", "DARK_RANGER"],
    ResourceType: ["TREE", "FISHING_SPOT", "FIRE"],
    CombatStyle: ["ACCURATE", "AGGRESSIVE", "DEFENSIVE", "CONTROLLED"],
  },
  
  tables: {
    Player: {
      schema: {
        player: "address",
        exists: "bool",
        createdAt: "uint256",
        lastLogin: "uint256",
        name: "string",
      },
      key: ["player"],
    },
    
    Position: {
      schema: {
        player: "address",
        x: "int32",
        y: "int32",
        z: "int32",
        chunkX: "int16",
        chunkZ: "int16",
      },
      key: ["player"],
    },
    
    Health: {
      schema: {
        player: "address",
        current: "uint32",
        max: "uint32",
      },
      key: ["player"],
    },
    
    CombatSkills: {
      schema: {
        player: "address",
        attackLevel: "uint8",
        attackXp: "uint32",
        strengthLevel: "uint8",
        strengthXp: "uint32",
        defenseLevel: "uint8",
        defenseXp: "uint32",
        constitutionLevel: "uint8",
        constitutionXp: "uint32",
        rangedLevel: "uint8",
        rangedXp: "uint32",
      },
      key: ["player"],
    },
    
    GatheringSkills: {
      schema: {
        player: "address",
        woodcuttingLevel: "uint8",
        woodcuttingXp: "uint32",
        fishingLevel: "uint8",
        fishingXp: "uint32",
        firemakingLevel: "uint8",
        firemakingXp: "uint32",
        cookingLevel: "uint8",
        cookingXp: "uint32",
      },
      key: ["player"],
    },
    
    InventorySlot: {
      schema: {
        player: "address",
        slot: "uint8",
        itemId: "uint16",
        quantity: "uint32",
      },
      key: ["player", "slot"],
    },
    
    Equipment: {
      schema: {
        player: "address",
        weapon: "uint16",
        shield: "uint16",
        helmet: "uint16",
        body: "uint16",
        legs: "uint16",
        arrows: "uint16",
      },
      key: ["player"],
    },
    
    ItemMetadata: {
      schema: {
        itemId: "uint16",
        itemType: "ItemType",
        stackable: "bool",
        attackBonus: "int16",
        strengthBonus: "int16",
        defenseBonus: "int16",
        rangedBonus: "int16",
        requiredAttackLevel: "uint8",
        requiredStrengthLevel: "uint8",
        requiredDefenseLevel: "uint8",
        requiredRangedLevel: "uint8",
        heals: "uint16",
        name: "string",
      },
      key: ["itemId"],
    },
    
    Mob: {
      schema: {
        mobId: "bytes32",
        mobType: "MobType",
        x: "int32",
        y: "int32",
        z: "int32",
        health: "uint32",
        maxHealth: "uint32",
        attackLevel: "uint8",
        strengthLevel: "uint8",
        defenseLevel: "uint8",
        rangedLevel: "uint8",
        lastSpawnTime: "uint256",
        isAlive: "bool",
      },
      key: ["mobId"],
    },
    
    MobLootTable: {
      schema: {
        mobType: "MobType",
        coinMin: "uint32",
        coinMax: "uint32",
        itemId1: "uint16",
        itemId1Chance: "uint16",
        itemId2: "uint16",
        itemId2Chance: "uint16",
        itemId3: "uint16",
        itemId3Chance: "uint16",
        itemId4: "uint16",
        itemId4Chance: "uint16",
      },
      key: ["mobType"],
    },
    
    Resource: {
      schema: {
        resourceId: "bytes32",
        resourceType: "ResourceType",
        x: "int32",
        y: "int32",
        z: "int32",
        available: "bool",
        lastHarvestTime: "uint256",
        respawnTime: "uint32",
      },
      key: ["resourceId"],
    },
    
    Coins: {
      schema: {
        player: "address",
        amount: "uint256",
        claimed: "uint256",
        unclaimed: "uint256",
        lastClaimTime: "uint256",
      },
      key: ["player"],
    },
    
    ItemInstance: {
      schema: {
        instanceId: "bytes32",
        itemId: "uint16",
        owner: "address",
        isMinted: "bool",
        mintedTokenId: "uint256",
        createdAt: "uint256",
        x: "int32",
        y: "int32",
        z: "int32",
        isOnGround: "bool",
      },
      key: ["instanceId"],
    },
    
    PendingTrade: {
      schema: {
        tradeId: "uint256",
        playerA: "address",
        playerB: "address",
        status: "uint8",
        createdAt: "uint256",
        escrowAddress: "address",
      },
      key: ["tradeId"],
    },
    
    CombatTarget: {
      schema: {
        player: "address",
        targetType: "uint8",
        targetId: "bytes32",
        combatStyle: "CombatStyle",
        lastAttackTime: "uint256",
      },
      key: ["player"],
    },
    
    WorldConfig: {
      schema: {
        initialized: "bool",
        respawnEnabled: "bool",
        pvpEnabled: "bool",
        adminAddress: "address",
      },
      key: [],
    },
  },
});
