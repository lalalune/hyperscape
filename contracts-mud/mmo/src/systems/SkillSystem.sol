// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Player, CombatSkills, CombatSkillsData, GatheringSkills, GatheringSkillsData, Health, HealthData } from "../codegen/index.sol";
import { XPLib } from "../libraries/XPLib.sol";

/**
 * @title SkillSystem
 * @notice XP and leveling for 9 skills
 * @dev Combat: Attack, Strength, Defense, Constitution, Ranged
 *      Gathering: Woodcutting, Fishing, Firemaking, Cooking
 */
contract SkillSystem is System {
    event LevelUp(address indexed player, uint8 skill, uint8 newLevel);
    event XPGained(address indexed player, uint8 skill, uint32 xp);
    
    // Skill indices
    uint8 constant ATTACK = 0;
    uint8 constant STRENGTH = 1;
    uint8 constant DEFENSE = 2;
    uint8 constant CONSTITUTION = 3;
    uint8 constant RANGED = 4;
    uint8 constant WOODCUTTING = 5;
    uint8 constant FISHING = 6;
    uint8 constant FIREMAKING = 7;
    uint8 constant COOKING = 8;
    
    /**
     * @notice Grant attack XP
     */
    function grantAttackXP(address player, uint32 xp) public {
        require(Player.getExists(player), "Player not registered");
        CombatSkillsData memory skills = CombatSkills.get(player);
        
        uint32 newXP = skills.attackXp + xp;
        uint8 newLevel = XPLib.getLevelFromXP(newXP);
        
        if (newLevel > skills.attackLevel) {
            emit LevelUp(player, ATTACK, newLevel);
        }
        
        CombatSkills.setAttackXp(player, newXP);
        CombatSkills.setAttackLevel(player, newLevel);
        
        emit XPGained(player, ATTACK, xp);
    }
    
    /**
     * @notice Grant strength XP
     */
    function grantStrengthXP(address player, uint32 xp) public {
        require(Player.getExists(player), "Player not registered");
        CombatSkillsData memory skills = CombatSkills.get(player);
        
        uint32 newXP = skills.strengthXp + xp;
        uint8 newLevel = XPLib.getLevelFromXP(newXP);
        
        if (newLevel > skills.strengthLevel) {
            emit LevelUp(player, STRENGTH, newLevel);
        }
        
        CombatSkills.setStrengthXp(player, newXP);
        CombatSkills.setStrengthLevel(player, newLevel);
        
        emit XPGained(player, STRENGTH, xp);
    }
    
    /**
     * @notice Grant defense XP
     */
    function grantDefenseXP(address player, uint32 xp) public {
        require(Player.getExists(player), "Player not registered");
        CombatSkillsData memory skills = CombatSkills.get(player);
        
        uint32 newXP = skills.defenseXp + xp;
        uint8 newLevel = XPLib.getLevelFromXP(newXP);
        
        if (newLevel > skills.defenseLevel) {
            emit LevelUp(player, DEFENSE, newLevel);
        }
        
        CombatSkills.setDefenseXp(player, newXP);
        CombatSkills.setDefenseLevel(player, newLevel);
        
        emit XPGained(player, DEFENSE, xp);
    }
    
    /**
     * @notice Grant constitution XP
     */
    function grantConstitutionXP(address player, uint32 xp) public {
        require(Player.getExists(player), "Player not registered");
        CombatSkillsData memory skills = CombatSkills.get(player);
        
        uint32 newXP = skills.constitutionXp + xp;
        uint8 newLevel = XPLib.getLevelFromXP(newXP);
        
        if (newLevel > skills.constitutionLevel) {
            // Update max health when constitution levels up
            uint32 newMaxHealth = uint32(newLevel) * 10;
            HealthData memory healthData = Health.get(player);
            uint32 currentHealth = healthData.current;
            if (currentHealth > newMaxHealth) currentHealth = newMaxHealth;
            Health.set(player, currentHealth, newMaxHealth);
            
            emit LevelUp(player, CONSTITUTION, newLevel);
        }
        
        CombatSkills.setConstitutionXp(player, newXP);
        CombatSkills.setConstitutionLevel(player, newLevel);
        
        emit XPGained(player, CONSTITUTION, xp);
    }
    
    /**
     * @notice Grant ranged XP
     */
    function grantRangedXP(address player, uint32 xp) public {
        require(Player.getExists(player), "Player not registered");
        CombatSkillsData memory skills = CombatSkills.get(player);
        
        uint32 newXP = skills.rangedXp + xp;
        uint8 newLevel = XPLib.getLevelFromXP(newXP);
        
        if (newLevel > skills.rangedLevel) {
            emit LevelUp(player, RANGED, newLevel);
        }
        
        CombatSkills.setRangedXp(player, newXP);
        CombatSkills.setRangedLevel(player, newLevel);
        
        emit XPGained(player, RANGED, xp);
    }
    
    /**
     * @notice Grant woodcutting XP
     */
    function grantWoodcuttingXP(address player, uint32 xp) public {
        require(Player.getExists(player), "Player not registered");
        GatheringSkillsData memory skills = GatheringSkills.get(player);
        
        uint32 newXP = skills.woodcuttingXp + xp;
        uint8 newLevel = XPLib.getLevelFromXP(newXP);
        
        if (newLevel > skills.woodcuttingLevel) {
            emit LevelUp(player, WOODCUTTING, newLevel);
        }
        
        GatheringSkills.setWoodcuttingXp(player, newXP);
        GatheringSkills.setWoodcuttingLevel(player, newLevel);
        
        emit XPGained(player, WOODCUTTING, xp);
    }
    
    /**
     * @notice Grant fishing XP
     */
    function grantFishingXP(address player, uint32 xp) public {
        require(Player.getExists(player), "Player not registered");
        GatheringSkillsData memory skills = GatheringSkills.get(player);
        
        uint32 newXP = skills.fishingXp + xp;
        uint8 newLevel = XPLib.getLevelFromXP(newXP);
        
        if (newLevel > skills.fishingLevel) {
            emit LevelUp(player, FISHING, newLevel);
        }
        
        GatheringSkills.setFishingXp(player, newXP);
        GatheringSkills.setFishingLevel(player, newLevel);
        
        emit XPGained(player, FISHING, xp);
    }
    
    /**
     * @notice Grant firemaking XP
     */
    function grantFiremakingXP(address player, uint32 xp) public {
        require(Player.getExists(player), "Player not registered");
        GatheringSkillsData memory skills = GatheringSkills.get(player);
        
        uint32 newXP = skills.firemakingXp + xp;
        uint8 newLevel = XPLib.getLevelFromXP(newXP);
        
        if (newLevel > skills.firemakingLevel) {
            emit LevelUp(player, FIREMAKING, newLevel);
        }
        
        GatheringSkills.setFiremakingXp(player, newXP);
        GatheringSkills.setFiremakingLevel(player, newLevel);
        
        emit XPGained(player, FIREMAKING, xp);
    }
    
    /**
     * @notice Grant cooking XP
     */
    function grantCookingXP(address player, uint32 xp) public {
        require(Player.getExists(player), "Player not registered");
        GatheringSkillsData memory skills = GatheringSkills.get(player);
        
        uint32 newXP = skills.cookingXp + xp;
        uint8 newLevel = XPLib.getLevelFromXP(newXP);
        
        if (newLevel > skills.cookingLevel) {
            emit LevelUp(player, COOKING, newLevel);
        }
        
        GatheringSkills.setCookingXp(player, newXP);
        GatheringSkills.setCookingLevel(player, newLevel);
        
        emit XPGained(player, COOKING, xp);
    }
}
