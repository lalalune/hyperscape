// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Player, InventorySlot, InventorySlotData, ItemMetadata, ItemMetadataData } from "../codegen/index.sol";

contract InventorySystem is System {
    uint8 public constant MAX_INVENTORY_SLOTS = 28;
    
    event ItemAdded(address indexed player, uint16 itemId, uint32 quantity, uint8 slot);
    event ItemRemoved(address indexed player, uint16 itemId, uint32 quantity, uint8 slot);
    event ItemMoved(address indexed player, uint8 fromSlot, uint8 toSlot);
    
    function addItem(address player, uint16 itemId, uint32 quantity) public returns (bool success, uint8 slot) {
        require(Player.getExists(player), "Player not registered");
        require(itemId > 0, "Invalid item ID");
        require(quantity > 0, "Invalid quantity");
        
        ItemMetadataData memory itemMeta = ItemMetadata.get(itemId);
        require(bytes(itemMeta.name).length > 0, "Item does not exist");
        
        if (itemMeta.stackable) {
            for (uint8 i = 0; i < MAX_INVENTORY_SLOTS; i++) {
                InventorySlotData memory slotData = InventorySlot.get(player, i);
                if (slotData.itemId == itemId) {
                    InventorySlot.setQuantity(player, i, slotData.quantity + quantity);
                    emit ItemAdded(player, itemId, quantity, i);
                    return (true, i);
                }
            }
        }
        
        for (uint8 i = 0; i < MAX_INVENTORY_SLOTS; i++) {
            InventorySlotData memory slotData = InventorySlot.get(player, i);
            if (slotData.itemId == 0) {
                InventorySlot.set(player, i, itemId, quantity);
                emit ItemAdded(player, itemId, quantity, i);
                return (true, i);
            }
        }
        
        return (false, 0);
    }
    
    function removeItem(address player, uint8 slot, uint32 quantity) public returns (bool success) {
        require(Player.getExists(player), "Player not registered");
        require(slot < MAX_INVENTORY_SLOTS, "Invalid slot");
        
        InventorySlotData memory slotData = InventorySlot.get(player, slot);
        require(slotData.itemId > 0, "Slot is empty");
        
        if (quantity == 0 || quantity >= slotData.quantity) {
            emit ItemRemoved(player, slotData.itemId, slotData.quantity, slot);
            InventorySlot.set(player, slot, 0, 0);
        } else {
            emit ItemRemoved(player, slotData.itemId, quantity, slot);
            InventorySlot.setQuantity(player, slot, slotData.quantity - quantity);
        }
        
        return true;
    }
    
    function moveItem(address player, uint8 fromSlot, uint8 toSlot) public {
        require(Player.getExists(player), "Player not registered");
        require(player == _msgSender(), "Can only move own items");
        require(fromSlot < MAX_INVENTORY_SLOTS && toSlot < MAX_INVENTORY_SLOTS, "Invalid slot");
        require(fromSlot != toSlot, "Same slot");
        
        InventorySlotData memory fromData = InventorySlot.get(player, fromSlot);
        require(fromData.itemId > 0, "From slot is empty");
        
        InventorySlotData memory toData = InventorySlot.get(player, toSlot);
        
        if (toData.itemId == 0) {
            InventorySlot.set(player, toSlot, fromData.itemId, fromData.quantity);
            InventorySlot.set(player, fromSlot, 0, 0);
        } else if (toData.itemId == fromData.itemId && ItemMetadata.get(fromData.itemId).stackable) {
            InventorySlot.setQuantity(player, toSlot, toData.quantity + fromData.quantity);
            InventorySlot.set(player, fromSlot, 0, 0);
        } else {
            InventorySlot.set(player, toSlot, fromData.itemId, fromData.quantity);
            InventorySlot.set(player, fromSlot, toData.itemId, toData.quantity);
        }
        
        emit ItemMoved(player, fromSlot, toSlot);
    }
    
    function hasItem(address player, uint16 itemId) public view returns (bool found, uint32 quantity) {
        uint32 totalQuantity = 0;
        for (uint8 i = 0; i < MAX_INVENTORY_SLOTS; i++) {
            InventorySlotData memory slotData = InventorySlot.get(player, i);
            if (slotData.itemId == itemId) totalQuantity += slotData.quantity;
        }
        return (totalQuantity > 0, totalQuantity);
    }
    
    function getFreeSlots(address player) public view returns (uint8 freeSlots) {
        uint8 count = 0;
        for (uint8 i = 0; i < MAX_INVENTORY_SLOTS; i++) {
            if (InventorySlot.get(player, i).itemId == 0) count++;
        }
        return count;
    }
    
    function findItem(address player, uint16 itemId) public view returns (bool found, uint8 slot) {
        for (uint8 i = 0; i < MAX_INVENTORY_SLOTS; i++) {
            if (InventorySlot.get(player, i).itemId == itemId) return (true, i);
        }
        return (false, 0);
    }
}

