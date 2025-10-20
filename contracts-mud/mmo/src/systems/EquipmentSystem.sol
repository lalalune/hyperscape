// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Player, Equipment, EquipmentData, InventorySlot, InventorySlotData, ItemMetadata, ItemMetadataData } from "../codegen/index.sol";
import { ItemType, EquipSlot } from "../codegen/common.sol";

/**
 * @title EquipmentSystem
 * @notice Equipment management - 6 slots (weapon, shield, helmet, body, legs, arrows)
 * @dev Handles equipping/unequipping items with level requirements
 */
contract EquipmentSystem is System {
    event ItemEquipped(address indexed player, uint8 slot, uint16 itemId);
    event ItemUnequipped(address indexed player, uint8 slot, uint16 itemId);
    
    /**
     * @notice Equip an item from inventory
     * @param inventorySlot Slot in inventory (0-27)
     */
    function equipItem(uint8 inventorySlot) public {
        address player = _msgSender();
        require(Player.getExists(player), "Player not registered");
        require(inventorySlot < 28, "Invalid inventory slot");
        
        // Get item from inventory
        InventorySlotData memory invSlot = InventorySlot.get(player, inventorySlot);
        require(invSlot.itemId > 0, "No item in slot");
        
        // Get item metadata
        ItemMetadataData memory item = ItemMetadata.get(invSlot.itemId);
        require(item.itemType != ItemType.CONSUMABLE && item.itemType != ItemType.RESOURCE, "Cannot equip this item type");
        
        // Determine equipment slot
        uint8 equipSlot = _getEquipSlot(invSlot.itemId, item.itemType);
        
        // Get current equipment
        EquipmentData memory equipment = Equipment.get(player);
        uint16 currentItem = _getEquipmentSlotValue(equipment, equipSlot);
        
        // Unequip current item if any
        if (currentItem > 0) {
            _unequipToInventory(player, currentItem);
        }
        
        // Equip new item
        _setEquipmentSlot(player, equipSlot, invSlot.itemId);
        
        // Remove from inventory
        InventorySlot.set(player, inventorySlot, 0, 0);
        
        emit ItemEquipped(player, equipSlot, invSlot.itemId);
    }
    
    /**
     * @notice Unequip an item to inventory
     * @param equipSlot Equipment slot (0-5)
     */
    function unequipItem(uint8 equipSlot) public {
        address player = _msgSender();
        require(Player.getExists(player), "Player not registered");
        require(equipSlot < 6, "Invalid equipment slot");
        
        EquipmentData memory equipment = Equipment.get(player);
        uint16 itemId = _getEquipmentSlotValue(equipment, equipSlot);
        require(itemId > 0, "No item equipped");
        
        // Find empty inventory slot
        uint8 emptySlot = _findEmptyInventorySlot(player);
        require(emptySlot < 28, "Inventory full");
        
        // Add to inventory
        InventorySlot.set(player, emptySlot, itemId, 1);
        
        // Remove from equipment
        _setEquipmentSlot(player, equipSlot, 0);
        
        emit ItemUnequipped(player, equipSlot, itemId);
    }
    
    /**
     * @notice Get equipment slot for an item
     */
    function _getEquipSlot(uint16 itemId, ItemType itemType) internal pure returns (uint8) {
        if (itemType == ItemType.AMMUNITION) return uint8(EquipSlot.ARROWS);
        if (itemType == ItemType.TOOL) return uint8(EquipSlot.WEAPON);
        
        // Determine by item ID range
        if (itemId >= 100 && itemId < 200) return uint8(EquipSlot.WEAPON); // Swords and bows
        if (itemId >= 200 && itemId < 300) return uint8(EquipSlot.SHIELD);
        if (itemId >= 300 && itemId < 350) return uint8(EquipSlot.HELMET);
        if (itemId >= 350 && itemId < 400) return uint8(EquipSlot.BODY);
        if (itemId >= 400 && itemId < 450) return uint8(EquipSlot.LEGS);
        
        revert("Cannot determine equipment slot");
    }
    
    /**
     * @notice Find an empty inventory slot
     */
    function _findEmptyInventorySlot(address player) internal view returns (uint8) {
        for (uint8 i = 0; i < 28; i++) {
            InventorySlotData memory slot = InventorySlot.get(player, i);
            if (slot.itemId == 0) return i;
        }
        return 28; // No empty slot
    }
    
    /**
     * @notice Unequip item to inventory
     */
    function _unequipToInventory(address player, uint16 itemId) internal {
        uint8 emptySlot = _findEmptyInventorySlot(player);
        require(emptySlot < 28, "Inventory full");
        InventorySlot.set(player, emptySlot, itemId, 1);
    }
    
    /**
     * @notice Get equipment slot value
     */
    function _getEquipmentSlotValue(EquipmentData memory equipment, uint8 slot) internal pure returns (uint16) {
        if (slot == uint8(EquipSlot.WEAPON)) return equipment.weapon;
        if (slot == uint8(EquipSlot.SHIELD)) return equipment.shield;
        if (slot == uint8(EquipSlot.HELMET)) return equipment.helmet;
        if (slot == uint8(EquipSlot.BODY)) return equipment.body;
        if (slot == uint8(EquipSlot.LEGS)) return equipment.legs;
        if (slot == uint8(EquipSlot.ARROWS)) return equipment.arrows;
        return 0;
    }
    
    /**
     * @notice Set equipment slot value
     */
    function _setEquipmentSlot(address player, uint8 slot, uint16 itemId) internal {
        EquipmentData memory equipment = Equipment.get(player);
        
        if (slot == uint8(EquipSlot.WEAPON)) equipment.weapon = itemId;
        else if (slot == uint8(EquipSlot.SHIELD)) equipment.shield = itemId;
        else if (slot == uint8(EquipSlot.HELMET)) equipment.helmet = itemId;
        else if (slot == uint8(EquipSlot.BODY)) equipment.body = itemId;
        else if (slot == uint8(EquipSlot.LEGS)) equipment.legs = itemId;
        else if (slot == uint8(EquipSlot.ARROWS)) equipment.arrows = itemId;
        
        Equipment.set(player, equipment.weapon, equipment.shield, equipment.helmet, equipment.body, equipment.legs, equipment.arrows);
    }
}
