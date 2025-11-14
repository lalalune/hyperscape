// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Player, CombatSkills, CombatSkillsData, Health, Equipment, EquipmentData, CombatTarget, CombatTargetData, Mob, MobData, Coins, ItemMetadata, ItemMetadataData, MobLootTable, MobLootTableData } from "../codegen/index.sol";
import { CombatLib } from "../libraries/CombatLib.sol";
import { MobType, CombatStyle } from "../codegen/common.sol";

contract CombatSystem is System {
    event AttackStarted(address indexed player, bytes32 indexed mobId);
    event DamageDealt(address indexed attacker, bytes32 indexed target, uint32 damage);
    event MobKilled(address indexed killer, bytes32 indexed mobId, uint256 coinsDropped);
    event LootDropped(bytes32 indexed mobId, uint16 itemId, uint32 quantity);
    
    function attackMob(bytes32 mobId) public {
        address player = _msgSender();
        require(Player.getExists(player), "Player not registered");
        
        MobData memory mobData = Mob.get(mobId);
        require(mobData.isAlive, "Mob is dead");
        require(mobData.health > 0, "Mob has no health");
        
        CombatTargetData memory currentTarget = CombatTarget.get(player);
        uint8 combatStyle = uint8(currentTarget.combatStyle);
        if (combatStyle == 0) combatStyle = 3;
        
        CombatTarget.setTargetType(player, 1);
        CombatTarget.setTargetId(player, mobId);
        CombatTarget.setCombatStyle(player, CombatStyle(combatStyle));
        CombatTarget.setLastAttackTime(player, block.timestamp);
        
        CombatSkillsData memory skills = CombatSkills.get(player);
        EquipmentData memory equipment = Equipment.get(player);
        
        bool isRanged = (equipment.weapon >= 150 && equipment.weapon < 200 && equipment.arrows > 0);
        
        uint32 damage;
        if (isRanged) {
            ItemMetadataData memory weaponMeta = ItemMetadata.get(equipment.weapon);
            damage = CombatLib.calculateRangedDamage(skills.rangedLevel, weaponMeta.rangedBonus, weaponMeta.rangedBonus, mobData.defenseLevel);
        } else {
            int16 attackBonus = 0;
            int16 strengthBonus = 0;
            if (equipment.weapon > 0) {
                ItemMetadataData memory weaponMeta = ItemMetadata.get(equipment.weapon);
                attackBonus = weaponMeta.attackBonus;
                strengthBonus = weaponMeta.strengthBonus;
            }
            damage = CombatLib.calculateMeleeDamage(skills.attackLevel, skills.strengthLevel, attackBonus, strengthBonus, mobData.defenseLevel);
        }
        
        emit DamageDealt(player, mobId, damage);
        
        if (damage >= mobData.health) {
            _killMob(mobId, player);
        } else {
            Mob.setHealth(mobId, mobData.health - damage);
        }
        
        _grantCombatXP(player, damage, isRanged, combatStyle);
    }
    
    function _killMob(bytes32 mobId, address killer) internal {
        MobData memory mobData = Mob.get(mobId);
        Mob.setHealth(mobId, 0);
        Mob.setIsAlive(mobId, false);
        Mob.setLastSpawnTime(mobId, block.timestamp);
        
        _dropLoot(uint8(mobData.mobType), mobId, killer);
        
        CombatTarget.setTargetType(killer, 0);
        CombatTarget.setTargetId(killer, bytes32(0));
    }
    
    function _dropLoot(uint8 mobType, bytes32 mobId, address killer) internal {
        MobLootTableData memory lootTable = MobLootTable.get(MobType(mobType));
        uint256 coinDrop = lootTable.coinMin + _random(lootTable.coinMax - lootTable.coinMin + 1);
        Coins.setAmount(killer, Coins.getAmount(killer) + coinDrop);
        emit MobKilled(killer, mobId, coinDrop);
        
        if (lootTable.itemId1 > 0 && _random(10000) < lootTable.itemId1Chance) emit LootDropped(mobId, lootTable.itemId1, 1);
        if (lootTable.itemId2 > 0 && _random(10000) < lootTable.itemId2Chance) emit LootDropped(mobId, lootTable.itemId2, 1);
        if (lootTable.itemId3 > 0 && _random(10000) < lootTable.itemId3Chance) emit LootDropped(mobId, lootTable.itemId3, 1);
        if (lootTable.itemId4 > 0 && _random(10000) < lootTable.itemId4Chance) emit LootDropped(mobId, lootTable.itemId4, 1);
    }
    
    function _grantCombatXP(address player, uint32 damage, bool isRanged, uint8 combatStyle) internal {
        uint32 xpGain = damage * 4;
        CombatSkillsData memory skills = CombatSkills.get(player);
        
        if (!isRanged) {
            if (combatStyle == 1) CombatSkills.setStrengthXp(player, skills.strengthXp + xpGain);
            else if (combatStyle == 2) CombatSkills.setDefenseXp(player, skills.defenseXp + xpGain);
            else {
                CombatSkills.setAttackXp(player, skills.attackXp + xpGain / 3);
                CombatSkills.setStrengthXp(player, skills.strengthXp + xpGain / 3);
                CombatSkills.setDefenseXp(player, skills.defenseXp + xpGain / 3);
            }
        } else {
            CombatSkills.setRangedXp(player, skills.rangedXp + xpGain);
        }
        
        CombatSkills.setConstitutionXp(player, skills.constitutionXp + xpGain / 3);
    }
    
    function _random(uint256 max) internal view returns (uint256) {
        if (max == 0) return 0;
        return uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, gasleft()))) % max;
    }
}

