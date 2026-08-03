// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { PlayerRegistry, CharacterOwner, CombatSkills, GatheringSkills, VitalStats, PlayerStats } from "../codegen/index.sol";
import { Constants } from "../libraries/Constants.sol";
import { Errors } from "../libraries/Errors.sol";

/**
 * @title PlayerRegistrySystem
 * @notice Handles player registration and character creation on-chain.
 *
 * Access: Restricted to namespace owner (server operator).
 * The server calls this after a player creates a character in-game.
 *
 * Flow:
 * 1. Player creates character via game client (Privy auth + WebSocket)
 * 2. Server creates character in PostgreSQL (immediate, fast)
 * 3. Server calls registerPlayer() optimistically (async chain write)
 * 4. Character is now on-chain with initial stats
 */
contract PlayerRegistrySystem is System {
    /**
     * @notice Register a new player character on-chain.
     * @param playerAddress The player's wallet address (from Privy embedded wallet)
     * @param characterId The server-generated character UUID, hashed to bytes32
     * @param name The character's display name
     *
     * Creates:
     * - PlayerRegistry entry (address → characterId + name)
     * - CharacterOwner entry (characterId → address, reverse lookup)
     * - CombatSkills with defaults (all level 1 except Constitution=10)
     * - GatheringSkills with defaults (all level 1, all XP 0)
     * - VitalStats with defaults (health=100, combat level=3)
     * - PlayerStats with all zeroes
     */
    function registerPlayer(
        address playerAddress,
        bytes32 characterId,
        string calldata name
    ) public {
        // Validate inputs
        if (playerAddress == address(0)) revert Errors.InvalidAddress();
        if (characterId == bytes32(0)) revert Errors.CharacterNotFound(characterId);
        if (bytes(name).length == 0) revert Errors.InvalidPlayerName();

        // Check wallet not already registered
        bytes32 existingCharId = PlayerRegistry.getCharacterId(playerAddress);
        if (existingCharId != bytes32(0)) revert Errors.PlayerAlreadyRegistered(playerAddress);

        // SECURITY: Check character ID not already registered to another wallet (Task 75)
        address existingOwner = CharacterOwner.getPlayerAddress(characterId);
        if (existingOwner != address(0)) revert Errors.CharacterAlreadyRegistered(characterId);

        // Register player identity
        PlayerRegistry.set(
            playerAddress,
            characterId,
            uint64(block.timestamp),
            true,
            name
        );

        // Create reverse lookup
        CharacterOwner.set(characterId, playerAddress);

        // Initialize combat skills with classic MMORPG defaults
        CombatSkills.set(
            characterId,
            1, 0,   // attack: level 1, 0 xp
            1, 0,   // strength: level 1, 0 xp
            1, 0,   // defense: level 1, 0 xp
            Constants.DEFAULT_CONSTITUTION_LEVEL, Constants.DEFAULT_CONSTITUTION_XP,
            1, 0,   // ranged: level 1, 0 xp
            1, 0,   // magic: level 1, 0 xp
            Constants.DEFAULT_PRAYER_LEVEL, 0  // prayer: level 1, 0 xp
        );

        // Initialize gathering skills (all level 1, 0 xp)
        GatheringSkills.set(
            characterId,
            1, 0,   // woodcutting
            1, 0,   // mining
            1, 0,   // fishing
            1, 0,   // firemaking
            1, 0,   // cooking
            1, 0,   // smithing
            1, 0,   // agility
            1, 0,   // crafting
            1, 0,   // fletching
            1, 0    // runecrafting
        );

        // Initialize vital stats
        VitalStats.set(
            characterId,
            Constants.DEFAULT_COMBAT_LEVEL,  // combatLevel
            32,                              // totalLevel (sum of all level 1s + con 10 = 16×1 + 10 + 6×1 = 32)
            Constants.DEFAULT_HEALTH,        // health
            Constants.DEFAULT_HEALTH,        // maxHealth
            Constants.DEFAULT_PRAYER_POINTS, // prayerPoints
            Constants.DEFAULT_PRAYER_POINTS  // prayerMaxPoints
        );

        // Initialize player stats (all zeroes)
        PlayerStats.set(
            characterId,
            0, // totalMobKills
            0, // totalDeaths
            0, // totalPlayerKills
            0, // totalBossKills
            0, // totalXpEarned
            0, // totalGoldEarned
            0, // totalTradesCompleted
            0, // totalDuelsWon
            0  // totalDuelsLost
        );
    }

    /**
     * @notice Update a player's display name.
     * @param playerAddress The player's wallet address
     * @param newName The new display name
     */
    function updatePlayerName(address playerAddress, string calldata newName) public {
        bytes32 charId = PlayerRegistry.getCharacterId(playerAddress);
        if (charId == bytes32(0)) revert Errors.PlayerNotRegistered(playerAddress);
        if (bytes(newName).length == 0) revert Errors.InvalidPlayerName();

        PlayerRegistry.setName(playerAddress, newName);
    }

    /**
     * @notice Deactivate a player (soft delete).
     * @param playerAddress The player's wallet address
     */
    function deactivatePlayer(address playerAddress) public {
        bytes32 charId = PlayerRegistry.getCharacterId(playerAddress);
        if (charId == bytes32(0)) revert Errors.PlayerNotRegistered(playerAddress);

        PlayerRegistry.setIsActive(playerAddress, false);
    }

    /**
     * @notice Reactivate a previously deactivated player.
     * @param playerAddress The player's wallet address
     */
    function reactivatePlayer(address playerAddress) public {
        bytes32 charId = PlayerRegistry.getCharacterId(playerAddress);
        if (charId == bytes32(0)) revert Errors.PlayerNotRegistered(playerAddress);

        PlayerRegistry.setIsActive(playerAddress, true);
    }

    /**
     * @notice Resolve a character ID to a player address.
     * @param characterId The character's bytes32 ID
     * @return playerAddress The owning wallet address
     */
    function getPlayerAddress(bytes32 characterId) public view returns (address playerAddress) {
        playerAddress = CharacterOwner.getPlayerAddress(characterId);
        if (playerAddress == address(0)) revert Errors.CharacterNotFound(characterId);
    }

    /**
     * @notice Resolve a player address to a character ID.
     * @param playerAddress The player's wallet address
     * @return characterId The character ID (bytes32(0) if not registered)
     */
    function getCharacterId(address playerAddress) public view returns (bytes32 characterId) {
        return PlayerRegistry.getCharacterId(playerAddress);
    }

    /**
     * @notice Check whether a player address is registered.
     * @param playerAddress The player's wallet address
     */
    function isPlayerRegistered(address playerAddress) public view returns (bool registered) {
        return PlayerRegistry.getCharacterId(playerAddress) != bytes32(0);
    }
}
