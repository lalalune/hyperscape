// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Player, PlayerData, Position, PositionData, Health, HealthData, CombatSkills, GatheringSkills, Coins, Equipment, CombatTarget, InventorySlot, InventorySlotData, ItemInstance, ItemInstanceData } from "../codegen/index.sol";
import { CombatStyle } from "../codegen/common.sol";

interface IItems {
    function checkInstance(bytes32 instanceId) external view returns (bool isMinted, address originalMinter);
    function balanceOf(address owner, uint256 itemId) external view returns (uint256);
}

contract PlayerSystem is System {
    uint8 constant MAX_INVENTORY_SLOTS = 28;
    address public itemsContract; // Set by admin, address of Items.sol ERC-1155
    
    event PlayerRegistered(address indexed player, string name);
    event PlayerMoved(address indexed player, int32 x, int32 y, int32 z);
    event PlayerDied(address indexed player, int32 deathX, int32 deathY, int32 deathZ);
    event PlayerRespawned(address indexed player, int32 spawnX, int32 spawnY, int32 spawnZ);
    event ItemDropped(address indexed player, uint16 indexed itemId, bytes32 instanceId, int32 x, int32 y, int32 z, uint32 quantity);
    event ItemProtected(address indexed player, uint16 indexed itemId, bytes32 instanceId);
    
    int32[3][] private starterPositions;
    
    constructor() {
        starterPositions.push([int32(100), int32(10), int32(100)]);
        starterPositions.push([int32(200), int32(10), int32(150)]);
        starterPositions.push([int32(150), int32(10), int32(200)]);
    }
    
    function register(string memory name) public {
        address player = _msgSender();
        require(!Player.getExists(player), "Player already registered");
        require(bytes(name).length > 0 && bytes(name).length <= 20, "Name must be 1-20 characters");
        
        Player.set(player, true, block.timestamp, block.timestamp, name);
        
        uint256 randomIndex = _random(starterPositions.length);
        int32[3] memory spawnPos = starterPositions[randomIndex];
        
        Position.set(player, spawnPos[0], spawnPos[1], spawnPos[2], int16(spawnPos[0] / 16), int16(spawnPos[2] / 16));
        Health.set(player, 100, 100);
        CombatSkills.set(player, 1, 0, 1, 0, 1, 0, 10, 1154, 1, 0);
        GatheringSkills.set(player, 1, 0, 1, 0, 1, 0, 1, 0);
        Coins.setAmount(player, 0);
        Equipment.set(player, 0, 0, 0, 0, 0, 0);
        CombatTarget.set(player, 0, bytes32(0), CombatStyle(0), 0);
        
        emit PlayerRegistered(player, name);
    }
    
    function move(int32 x, int32 y, int32 z) public {
        address player = _msgSender();
        require(Player.getExists(player), "Player not registered");
        
        int16 chunkX = int16(x / 16);
        int16 chunkZ = int16(z / 16);
        Position.set(player, x, y, z, chunkX, chunkZ);
        
        PlayerData memory playerData = Player.get(player);
        Player.set(player, playerData.exists, playerData.createdAt, block.timestamp, playerData.name);
        
        emit PlayerMoved(player, x, y, z);
    }
    
    function takeDamage(address player, uint32 amount) public returns (bool died) {
        require(Player.getExists(player), "Player not registered");
        
        HealthData memory healthData = Health.get(player);
        
        if (amount >= healthData.current) {
            Health.set(player, 0, healthData.max);
            _onPlayerDeath(player);
            return true;
        } else {
            Health.set(player, healthData.current - amount, healthData.max);
            return false;
        }
    }
    
    function heal(address player, uint32 amount) public {
        require(Player.getExists(player), "Player not registered");
        
        HealthData memory healthData = Health.get(player);
        uint32 newHealth = healthData.current + amount;
        if (newHealth > healthData.max) newHealth = healthData.max;
        
        Health.set(player, newHealth, healthData.max);
    }
    
    function updateMaxHealth(address player, uint8 constitutionLevel) public {
        require(Player.getExists(player), "Player not registered");
        
        uint32 newMaxHealth = uint32(constitutionLevel) * 10;
        HealthData memory healthData = Health.get(player);
        uint32 currentHealth = healthData.current;
        if (currentHealth > newMaxHealth) currentHealth = newMaxHealth;
        
        Health.set(player, currentHealth, newMaxHealth);
    }
    
    function _onPlayerDeath(address player) internal {
        PositionData memory pos = Position.get(player);
        emit PlayerDied(player, pos.x, pos.y, pos.z);
        
        // Drop all unminted items from inventory
        _dropUnmintedItems(player, pos);
        
        uint256 randomIndex = _random(starterPositions.length);
        int32[3] memory spawnPos = starterPositions[randomIndex];
        
        Position.set(player, spawnPos[0], spawnPos[1], spawnPos[2], int16(spawnPos[0] / 16), int16(spawnPos[2] / 16));
        
        HealthData memory healthData = Health.get(player);
        Health.set(player, healthData.max, healthData.max);
        
        CombatTarget.set(player, 0, bytes32(0), CombatStyle(0), 0);
        
        emit PlayerRespawned(player, spawnPos[0], spawnPos[1], spawnPos[2]);
    }
    
    function _dropUnmintedItems(address player, PositionData memory deathPos) internal {
        if (itemsContract == address(0)) return; // Skip if not configured
        
        for (uint8 slot = 0; slot < MAX_INVENTORY_SLOTS; slot++) {
            InventorySlotData memory slotData = InventorySlot.get(player, slot);
            if (slotData.itemId == 0) continue;
            
            bytes32 instanceId = keccak256(abi.encodePacked(player, slotData.itemId, slot, "hyperscape"));
            (bool isMinted, address minter) = IItems(itemsContract).checkInstance(instanceId);
            
            if (isMinted && minter == player) {
                emit ItemProtected(player, slotData.itemId, instanceId);
                continue;
            }
            
            // Drop item
            ItemInstance.set(instanceId, ItemInstanceData(slotData.itemId, address(0), false, 0, block.timestamp, deathPos.x, deathPos.y, deathPos.z, true));
            InventorySlot.set(player, slot, 0, 0);
            emit ItemDropped(player, slotData.itemId, instanceId, deathPos.x, deathPos.y, deathPos.z, slotData.quantity);
        }
    }
    
    function setItemsContract(address _itemsContract) public {
        require(msg.sender == address(this), "Only system");
        itemsContract = _itemsContract;
    }
    
    function getPosition(address player) public view returns (int32 x, int32 y, int32 z) {
        PositionData memory pos = Position.get(player);
        return (pos.x, pos.y, pos.z);
    }
    
    function isAlive(address player) public view returns (bool) {
        HealthData memory healthData = Health.get(player);
        return healthData.current > 0;
    }
    
    function _random(uint256 max) internal view returns (uint256) {
        if (max == 0) return 0;
        return uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, gasleft()))) % max;
    }
}

