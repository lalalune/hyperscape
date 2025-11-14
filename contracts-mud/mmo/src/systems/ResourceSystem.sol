// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Player, Resource, ResourceData, Equipment, EquipmentData, InventorySlot, InventorySlotData, GatheringSkills, GatheringSkillsData } from "../codegen/index.sol";
import { ResourceType } from "../codegen/common.sol";
import { XPLib } from "../libraries/XPLib.sol";

/**
 * @title ResourceSystem
 * @notice Resource gathering (woodcutting, fishing, firemaking)
 * @dev Handles resource nodes and skill-based gathering
 */
contract ResourceSystem is System {
    event ResourceSpawned(bytes32 indexed resourceId, uint8 resourceType, int32 x, int32 y, int32 z);
    event ResourceHarvested(address indexed player, bytes32 indexed resourceId, uint16 itemId);
    event ResourceDepleted(bytes32 indexed resourceId);
    
    /**
     * @notice Spawn a resource node
     * @param resourceType 0=TREE, 1=FISHING_SPOT, 2=FIRE
     * @param x X coordinate
     * @param y Y coordinate
     * @param z Z coordinate
     * @return resourceId ID of spawned resource
     */
    function spawnResource(
        uint8 resourceType,
        int32 x,
        int32 y,
        int32 z
    ) public returns (bytes32) {
        require(resourceType < 3, "Invalid resource type");
        
        bytes32 resourceId = keccak256(abi.encodePacked(resourceType, x, y, z, block.timestamp));
        
        uint32 respawnTime = _getRespawnTime(resourceType);
        
        Resource.set(
            resourceId,
            ResourceType(resourceType),
            x, y, z,
            true, // available
            block.timestamp,
            respawnTime
        );
        
        emit ResourceSpawned(resourceId, resourceType, x, y, z);
        return resourceId;
    }
    
    /**
     * @notice Chop a tree (woodcutting)
     * @param resourceId Resource to chop
     * @return success True if successful
     * @return itemId Item ID of logs (1)
     */
    function chopTree(bytes32 resourceId) public returns (bool success, uint16 itemId) {
        address player = _msgSender();
        require(Player.getExists(player), "Player not registered");
        
        ResourceData memory resource = Resource.get(resourceId);
        require(resource.resourceType == ResourceType.TREE, "Not a tree");
        require(resource.available, "Resource not available");
        
        // Check for hatchet
        EquipmentData memory equipment = Equipment.get(player);
        require(equipment.weapon >= 50 && equipment.weapon < 60, "Need hatchet equipped");
        
        GatheringSkillsData memory skills = GatheringSkills.get(player);
        require(skills.woodcuttingLevel >= 1, "Woodcutting level too low");
        
        // Add logs to inventory
        _addItemToInventory(player, 1, 1); // 1 = Logs
        
        // Grant XP
        _grantWoodcuttingXP(player, 25);
        
        // Deplete resource
        Resource.setAvailable(resourceId, false);
        Resource.setLastHarvestTime(resourceId, block.timestamp);
        
        emit ResourceHarvested(player, resourceId, 1);
        emit ResourceDepleted(resourceId);
        
        return (true, 1);
    }
    
    /**
     * @notice Fish at a fishing spot
     * @param resourceId Resource to fish
     * @return success True if successful
     * @return itemId Item ID of fish (10)
     */
    function fish(bytes32 resourceId) public returns (bool success, uint16 itemId) {
        address player = _msgSender();
        require(Player.getExists(player), "Player not registered");
        
        ResourceData memory resource = Resource.get(resourceId);
        require(resource.resourceType == ResourceType.FISHING_SPOT, "Not a fishing spot");
        require(resource.available, "Resource not available");
        
        // Check for fishing rod
        EquipmentData memory equipment = Equipment.get(player);
        require(equipment.weapon == 51, "Need fishing rod equipped");
        
        GatheringSkillsData memory skills = GatheringSkills.get(player);
        require(skills.fishingLevel >= 1, "Fishing level too low");
        
        // Add raw shrimp to inventory
        _addItemToInventory(player, 10, 1); // 10 = Raw Shrimp
        
        // Grant XP
        _grantFishingXP(player, 10);
        
        emit ResourceHarvested(player, resourceId, 10);
        
        return (true, 10);
    }
    
    /**
     * @notice Light a fire (firemaking)
     * @param resourceId Resource to light
     * @return success True if successful
     */
    function lightFire(bytes32 resourceId) public returns (bool success) {
        address player = _msgSender();
        require(Player.getExists(player), "Player not registered");
        
        ResourceData memory resource = Resource.get(resourceId);
        require(resource.resourceType == ResourceType.FIRE, "Not a fire location");
        
        // Check for tinderbox and logs
        bool hasTinderbox = false;
        bool hasLogs = false;
        
        for (uint8 i = 0; i < 28; i++) {
            InventorySlotData memory slot = InventorySlot.get(player, i);
            if (slot.itemId == 52) hasTinderbox = true; // Tinderbox
            if (slot.itemId == 1 && slot.quantity > 0) hasLogs = true; // Logs
        }
        
        require(hasTinderbox, "Need tinderbox");
        require(hasLogs, "Need logs");
        
        GatheringSkillsData memory skills = GatheringSkills.get(player);
        require(skills.firemakingLevel >= 1, "Firemaking level too low");
        
        // Consume logs
        _removeItemFromInventory(player, 1, 1);
        
        // Grant XP
        _grantFiremakingXP(player, 40);
        
        return true;
    }
    
    /**
     * @notice Get respawn time for resource type
     */
    function _getRespawnTime(uint8 resourceType) internal pure returns (uint32) {
        if (resourceType == 0) return 60; // Tree: 1 minute
        if (resourceType == 1) return 30; // Fishing spot: 30 seconds
        if (resourceType == 2) return 120; // Fire: 2 minutes
        return 60;
    }
    
    /**
     * @notice Add item to inventory
     */
    function _addItemToInventory(address player, uint16 itemId, uint32 quantity) internal {
        // Find empty slot or stack
        for (uint8 i = 0; i < 28; i++) {
            InventorySlotData memory slot = InventorySlot.get(player, i);
            if (slot.itemId == 0) {
                InventorySlot.set(player, i, itemId, quantity);
                return;
            }
            if (slot.itemId == itemId) {
                InventorySlot.setQuantity(player, i, slot.quantity + quantity);
                return;
            }
        }
        revert("Inventory full");
    }
    
    /**
     * @notice Remove item from inventory
     */
    function _removeItemFromInventory(address player, uint16 itemId, uint32 quantity) internal {
        for (uint8 i = 0; i < 28; i++) {
            InventorySlotData memory slot = InventorySlot.get(player, i);
            if (slot.itemId == itemId && slot.quantity >= quantity) {
                if (slot.quantity == quantity) {
                    InventorySlot.set(player, i, 0, 0);
                } else {
                    InventorySlot.setQuantity(player, i, slot.quantity - quantity);
                }
                return;
            }
        }
        revert("Item not found");
    }
    
    /**
     * @notice Grant woodcutting XP
     */
    function _grantWoodcuttingXP(address player, uint32 xp) internal {
        GatheringSkillsData memory skills = GatheringSkills.get(player);
        uint32 newXP = skills.woodcuttingXp + xp;
        uint8 newLevel = XPLib.getLevelFromXP(newXP);
        GatheringSkills.setWoodcuttingXp(player, newXP);
        GatheringSkills.setWoodcuttingLevel(player, newLevel);
    }
    
    /**
     * @notice Grant fishing XP
     */
    function _grantFishingXP(address player, uint32 xp) internal {
        GatheringSkillsData memory skills = GatheringSkills.get(player);
        uint32 newXP = skills.fishingXp + xp;
        uint8 newLevel = XPLib.getLevelFromXP(newXP);
        GatheringSkills.setFishingXp(player, newXP);
        GatheringSkills.setFishingLevel(player, newLevel);
    }
    
    /**
     * @notice Grant firemaking XP
     */
    function _grantFiremakingXP(address player, uint32 xp) internal {
        GatheringSkillsData memory skills = GatheringSkills.get(player);
        uint32 newXP = skills.firemakingXp + xp;
        uint8 newLevel = XPLib.getLevelFromXP(newXP);
        GatheringSkills.setFiremakingXp(player, newXP);
        GatheringSkills.setFiremakingLevel(player, newLevel);
    }
}
