// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { WorldConfig, WorldConfigData, ItemMetadata, MobLootTable } from "../codegen/index.sol";
import { ItemType, MobType } from "../codegen/common.sol";

contract AdminSystem is System {
    event WorldInitialized(address indexed admin);
    event ItemCreated(uint16 indexed itemId, string name);
    event LootTableSet(uint8 indexed mobType, uint32 coinMin, uint32 coinMax);
    
    function initialize() public {
        WorldConfigData memory config = WorldConfig.get();
        require(!config.initialized, "World already initialized");
        
        WorldConfig.set(true, true, false, _msgSender());
        _initializeItems();
        _initializeLootTables();
        
        emit WorldInitialized(_msgSender());
    }
    
    function createItem(uint16 itemId, string memory name, uint8 itemType, bool stackable, int16 attackBonus, int16 strengthBonus, int16 defenseBonus, int16 rangedBonus, uint8 reqAttack, uint8 reqStrength, uint8 reqDefense, uint8 reqRanged, uint16 heals) public {
        require(_msgSender() == WorldConfig.get().adminAddress, "Not admin");
        require(itemId > 0 && bytes(name).length > 0, "Invalid item");
        
        ItemMetadata.set(itemId, ItemType(itemType), stackable, attackBonus, strengthBonus, defenseBonus, rangedBonus, reqAttack, reqStrength, reqDefense, reqRanged, heals, name);
        emit ItemCreated(itemId, name);
    }
    
    function setLootTable(uint8 mobType, uint32 coinMin, uint32 coinMax, uint16 itemId1, uint16 itemId1Chance, uint16 itemId2, uint16 itemId2Chance, uint16 itemId3, uint16 itemId3Chance, uint16 itemId4, uint16 itemId4Chance) public {
        require(_msgSender() == WorldConfig.get().adminAddress, "Not admin");
        require(mobType < 9 && coinMax >= coinMin, "Invalid config");
        
        MobLootTable.set(MobType(mobType), coinMin, coinMax, itemId1, itemId1Chance, itemId2, itemId2Chance, itemId3, itemId3Chance, itemId4, itemId4Chance);
        emit LootTableSet(mobType, coinMin, coinMax);
    }
    
    function _initializeItems() internal {
        // Resources
        createItem(1, "Logs", 3, true, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        // Consumables
        createItem(10, "Raw Shrimp", 4, true, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(11, "Cooked Shrimp", 4, true, 0, 0, 0, 0, 0, 0, 0, 0, 30);
        // Tools
        createItem(50, "Bronze Hatchet", 2, false, 0, 0, 0, 0, 1, 0, 0, 0, 0);
        createItem(51, "Fishing Rod", 2, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(52, "Tinderbox", 2, true, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        // Arrows
        createItem(60, "Arrows", 5, true, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        // Swords
        createItem(100, "Bronze Sword", 0, false, 4, 5, 0, 0, 1, 1, 0, 0, 0);
        createItem(101, "Steel Sword", 0, false, 10, 12, 0, 0, 10, 10, 0, 0, 0);
        createItem(102, "Mithril Sword", 0, false, 20, 24, 0, 0, 20, 20, 0, 0, 0);
        // Placeholder items for testing (use RESOURCE type to keep them valid but distinct)
        createItem(103, "Item103", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(104, "Item104", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(105, "Item105", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(106, "Item106", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(107, "Item107", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(108, "Item108", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(109, "Item109", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(110, "Item110", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(111, "Item111", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(112, "Item112", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(113, "Item113", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(114, "Item114", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(115, "Item115", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(116, "Item116", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(117, "Item117", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(118, "Item118", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(119, "Item119", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(120, "Item120", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(121, "Item121", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(122, "Item122", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(123, "Item123", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(124, "Item124", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(125, "Item125", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(126, "Item126", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        createItem(127, "Item127", 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        // Bows
        createItem(150, "Wood Bow", 0, false, 0, 0, 0, 8, 0, 0, 0, 1, 0);
        // Shields
        createItem(200, "Bronze Shield", 0, false, 0, 0, 8, 0, 0, 0, 1, 0, 0);
        // Helmets
        createItem(300, "Leather Helmet", 1, false, 0, 0, 2, 0, 0, 0, 1, 0, 0);
        // Body armor
        createItem(350, "Leather Body", 1, false, 0, 0, 4, 0, 0, 0, 1, 0, 0);
        // Leg armor
        createItem(400, "Leather Legs", 1, false, 0, 0, 2, 0, 0, 0, 1, 0, 0);
    }
    
    function _initializeLootTables() internal {
        setLootTable(0, 1, 5, 100, 50, 0, 0, 0, 0, 0, 0);
        setLootTable(1, 2, 8, 0, 0, 0, 0, 0, 0, 0, 0);
        setLootTable(2, 5, 15, 300, 100, 0, 0, 0, 0, 0, 0);
        setLootTable(3, 10, 25, 101, 200, 200, 100, 0, 0, 0, 0);
        setLootTable(4, 15, 30, 350, 500, 400, 300, 0, 0, 0, 0);
        setLootTable(5, 20, 40, 101, 300, 350, 200, 0, 0, 0, 0);
        setLootTable(6, 50, 100, 102, 400, 350, 300, 200, 200, 0, 0);
        setLootTable(7, 75, 150, 350, 600, 400, 500, 300, 400, 0, 0);
        setLootTable(8, 60, 120, 60, 5000, 150, 500, 300, 300, 0, 0);
    }
}
