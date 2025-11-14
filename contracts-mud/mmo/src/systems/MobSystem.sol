// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Mob, MobData } from "../codegen/index.sol";
import { MobType } from "../codegen/common.sol";

/**
 * @title MobSystem
 * @notice Mob spawning, respawning, and basic AI state
 * @dev Handles mob lifecycle and spawn management
 */
contract MobSystem is System {
    // Respawn time: 15 minutes (900 seconds)
    uint256 public constant MOB_RESPAWN_TIME = 900;
    
    // Events
    event MobSpawned(bytes32 indexed mobId, uint8 mobType, int32 x, int32 y, int32 z);
    event MobRespawned(bytes32 indexed mobId);
    
    /**
     * @notice Spawn a new mob
     * @param mobType Type of mob (0-8: Goblin to Dark Ranger)
     * @param x X coordinate
     * @param y Y coordinate
     * @param z Z coordinate
     * @param spawnIndex Index for this spawn point (for unique ID)
     * @return mobId ID of spawned mob
     */
    function spawnMob(
        uint8 mobType,
        int32 x,
        int32 y,
        int32 z,
        uint16 spawnIndex
    ) public returns (bytes32 mobId) {
        require(mobType < 9, "Invalid mob type");
        
        // Generate unique mob ID
        mobId = keccak256(abi.encodePacked(mobType, spawnIndex, x, z));
        
        // Get mob stats based on type
        (uint32 maxHealth, uint8 attackLevel, uint8 strengthLevel, uint8 defenseLevel, uint8 rangedLevel) = _getMobStats(mobType);
        
        // Spawn mob
        Mob.set(
            mobId,
            MobType(mobType),
            x, y, z,
            maxHealth,
            maxHealth,
            attackLevel,
            strengthLevel,
            defenseLevel,
            rangedLevel,
            block.timestamp,
            true // isAlive
        );
        
        emit MobSpawned(mobId, mobType, x, y, z);
        
        return mobId;
    }
    
    /**
     * @notice Respawn a dead mob
     * @param mobId ID of mob to respawn
     * @return success True if respawned
     */
    function respawnMob(bytes32 mobId) public returns (bool) {
        MobData memory mob = Mob.get(mobId);
        require(!mob.isAlive, "Mob is already alive");
        require(block.timestamp >= mob.lastSpawnTime + MOB_RESPAWN_TIME, "Respawn time not reached");
        
        // Respawn with full health
        Mob.setHealth(mobId, mob.maxHealth);
        Mob.setIsAlive(mobId, true);
        Mob.setLastSpawnTime(mobId, block.timestamp);
        
        emit MobRespawned(mobId);
        return true;
    }
    
    /**
     * @notice Check if a mob can respawn
     * @param mobId ID of mob
     * @return canRespawn True if mob can respawn
     */
    function canRespawn(bytes32 mobId) public view returns (bool) {
        MobData memory mob = Mob.get(mobId);
        if (mob.isAlive) return false;
        return block.timestamp >= mob.lastSpawnTime + MOB_RESPAWN_TIME;
    }
    
    /**
     * @notice Get mob stats by type
     * @dev Returns (maxHealth, attackLevel, strengthLevel, defenseLevel, rangedLevel)
     */
    function _getMobStats(uint8 mobType) internal pure returns (uint32, uint8, uint8, uint8, uint8) {
        // Level 1 Mobs (HP: 25-30, Levels: 1-5)
        if (mobType == 0) return (25, 2, 2, 1, 1); // Goblin
        if (mobType == 1) return (28, 3, 3, 2, 1); // Bandit
        if (mobType == 2) return (30, 4, 5, 3, 1); // Barbarian
        
        // Level 2 Mobs (HP: 50-75, Levels: 10-15)
        if (mobType == 3) return (50, 12, 12, 10, 1); // Hobgoblin
        if (mobType == 4) return (60, 14, 14, 15, 1); // Guard
        if (mobType == 5) return (75, 15, 16, 12, 1); // Dark Warrior
        
        // Level 3 Mobs (HP: 100-150, Levels: 20-30)
        if (mobType == 6) return (100, 25, 26, 22, 1); // Black Knight
        if (mobType == 7) return (120, 28, 30, 25, 1); // Ice Warrior
        if (mobType == 8) return (150, 20, 18, 15, 30); // Dark Ranger
        
        revert("Invalid mob type");
    }
}
