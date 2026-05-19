// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { CombatSkills, GatheringSkills, VitalStats } from "../codegen/index.sol";
import { CombatLevel } from "../libraries/CombatLevel.sol";

/**
 * @title SkillSystem
 * @notice Handles skill XP updates and level calculations on-chain.
 *
 * Access: Restricted to namespace owner (server operator).
 * Called optimistically after the game server processes XP gains.
 *
 * The server batches XP changes from multiple game ticks and writes
 * them in a single transaction using updateCombatSkills() or
 * updateGatheringSkills() to minimize gas costs.
 *
 * All level calculations use the tile-based MMORPG XP formula via XPTable library,
 * which must produce identical results to the TypeScript SkillsSystem.
 */
contract SkillSystem is System {
    /**
     * @notice Update all combat skills at once (batched write).
     * levels/xps order: [attack, strength, defense, constitution, ranged, magic, prayer]
     */
    function updateCombatSkills(
        bytes32 characterId,
        uint16[7] calldata levels,
        uint32[7] calldata xps
    ) public {
        CombatSkills.setAttackLevel(characterId, levels[0]);
        CombatSkills.setAttackXp(characterId, xps[0]);
        CombatSkills.setStrengthLevel(characterId, levels[1]);
        CombatSkills.setStrengthXp(characterId, xps[1]);
        CombatSkills.setDefenseLevel(characterId, levels[2]);
        CombatSkills.setDefenseXp(characterId, xps[2]);
        CombatSkills.setConstitutionLevel(characterId, levels[3]);
        CombatSkills.setConstitutionXp(characterId, xps[3]);
        CombatSkills.setRangedLevel(characterId, levels[4]);
        CombatSkills.setRangedXp(characterId, xps[4]);
        CombatSkills.setMagicLevel(characterId, levels[5]);
        CombatSkills.setMagicXp(characterId, xps[5]);
        CombatSkills.setPrayerLevel(characterId, levels[6]);
        CombatSkills.setPrayerXp(characterId, xps[6]);

        // Recalculate and update combat level
        uint16 newCombatLevel = CombatLevel.calculate(
            levels[0], levels[1], levels[2],
            levels[3], levels[4], levels[5], levels[6]
        );
        VitalStats.setCombatLevel(characterId, newCombatLevel);

        // Update max health (Constitution level × 10)
        uint16 newMaxHealth = levels[3] * 10;
        uint16 currentMaxHealth = VitalStats.getMaxHealth(characterId);
        if (newMaxHealth != currentMaxHealth) {
            VitalStats.setMaxHealth(characterId, newMaxHealth);
        }

        // Update max prayer points
        VitalStats.setPrayerMaxPoints(characterId, levels[6]);
    }

    /**
     * @notice Update all gathering/production skills at once (batched write).
     * levels/xps order:
     * [woodcutting, mining, fishing, firemaking, cooking, smithing, agility, crafting, fletching, runecrafting]
     */
    function updateGatheringSkills(
        bytes32 characterId,
        uint16[10] calldata levels,
        uint32[10] calldata xps
    ) public {
        GatheringSkills.setWoodcuttingLevel(characterId, levels[0]);
        GatheringSkills.setWoodcuttingXp(characterId, xps[0]);
        GatheringSkills.setMiningLevel(characterId, levels[1]);
        GatheringSkills.setMiningXp(characterId, xps[1]);
        GatheringSkills.setFishingLevel(characterId, levels[2]);
        GatheringSkills.setFishingXp(characterId, xps[2]);
        GatheringSkills.setFiremakingLevel(characterId, levels[3]);
        GatheringSkills.setFiremakingXp(characterId, xps[3]);
        GatheringSkills.setCookingLevel(characterId, levels[4]);
        GatheringSkills.setCookingXp(characterId, xps[4]);
        GatheringSkills.setSmithingLevel(characterId, levels[5]);
        GatheringSkills.setSmithingXp(characterId, xps[5]);
        GatheringSkills.setAgilityLevel(characterId, levels[6]);
        GatheringSkills.setAgilityXp(characterId, xps[6]);
        GatheringSkills.setCraftingLevel(characterId, levels[7]);
        GatheringSkills.setCraftingXp(characterId, xps[7]);
        GatheringSkills.setFletchingLevel(characterId, levels[8]);
        GatheringSkills.setFletchingXp(characterId, xps[8]);
        GatheringSkills.setRunecraftingLevel(characterId, levels[9]);
        GatheringSkills.setRunecraftingXp(characterId, xps[9]);
    }

    /**
     * @notice Update vital stats (health, prayer, combat/total level).
     * Called frequently -- uses the smallest possible table (1 storage slot).
     *
     * @param characterId The character's bytes32 ID
     * @param combatLevel Calculated combat level
     * @param totalLevel Sum of all skill levels
     * @param health Current health
     * @param maxHealth Maximum health (constitution × 10)
     * @param prayerPoints Current prayer points
     * @param prayerMaxPoints Maximum prayer points (= prayer level)
     */
    function updateVitalStats(
        bytes32 characterId,
        uint16 combatLevel,
        uint16 totalLevel,
        uint16 health,
        uint16 maxHealth,
        uint16 prayerPoints,
        uint16 prayerMaxPoints
    ) public {
        VitalStats.set(
            characterId,
            combatLevel,
            totalLevel,
            health,
            maxHealth,
            prayerPoints,
            prayerMaxPoints
        );
    }

    /**
     * @notice Update just health (most frequent vital stat change).
     * @param characterId The character's bytes32 ID
     * @param health New health value
     */
    function updateHealth(bytes32 characterId, uint16 health) public {
        VitalStats.setHealth(characterId, health);
    }

    /**
     * @notice Update total level (called after any skill level change).
     * @param characterId The character's bytes32 ID
     * @param totalLevel New total level
     */
    function updateTotalLevel(bytes32 characterId, uint16 totalLevel) public {
        VitalStats.setTotalLevel(characterId, totalLevel);
    }
}
