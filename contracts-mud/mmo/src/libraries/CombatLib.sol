// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library CombatLib {
    function calculateMeleeDamage(uint8 attackLevel, uint8 strengthLevel, int16 weaponAttackBonus, int16 weaponStrengthBonus, uint8 targetDefenseLevel) internal view returns (uint32) {
        bool hit = rollAccuracy(attackLevel, weaponAttackBonus, targetDefenseLevel);
        if (!hit) return 0;
        
        // Calculate effective strength (base level + gear bonuses)
        uint256 effectiveStrength = uint256(strengthLevel) + uint256(attackLevel);
        if (weaponStrengthBonus > 0) effectiveStrength += uint256(uint16(weaponStrengthBonus));
        
        // Calculate max hit (simplified RuneScape formula)
        uint256 maxHit = (effectiveStrength + 8) / 10;
        if (maxHit == 0) maxHit = 1; // Ensure at least 1 damage possible
        
        // Roll for damage (1 to maxHit)
        uint256 damage = (_random(maxHit) + 1);
        return uint32(damage);
    }
    
    function calculateRangedDamage(uint8 rangedLevel, int16 bowAttackBonus, int16 bowStrengthBonus, uint8 targetDefenseLevel) internal view returns (uint32) {
        bool hit = rollAccuracy(rangedLevel, bowAttackBonus, targetDefenseLevel);
        if (!hit) return 0;
        
        // Calculate effective ranged strength
        uint256 effectiveRanged = uint256(rangedLevel);
        if (bowStrengthBonus > 0) effectiveRanged += uint256(uint16(bowStrengthBonus));
        
        // Calculate max hit
        uint256 maxHit = (effectiveRanged + 8) / 10;
        if (maxHit == 0) maxHit = 1; // Ensure at least 1 damage possible
        
        // Roll for damage (1 to maxHit)
        uint256 damage = (_random(maxHit) + 1);
        return uint32(damage);
    }
    
    function rollAccuracy(uint8 attackLevel, int16 attackBonus, uint8 defenseLevel) internal view returns (bool) {
        // Calculate attack and defense rolls
        uint256 effectiveAttack = uint256(attackLevel) + 8;
        if (attackBonus > 0) effectiveAttack += uint256(uint16(attackBonus));
        
        uint256 effectiveDefense = uint256(defenseLevel) + 8;
        
        // Calculate hit chance (simplified)
        // Base 50% chance + attack advantage
        uint256 hitChance = 50;
        if (effectiveAttack > effectiveDefense) {
            hitChance += ((effectiveAttack - effectiveDefense) * 2);
        } else if (effectiveDefense > effectiveAttack) {
            uint256 disadvantage = ((effectiveDefense - effectiveAttack) * 2);
            if (disadvantage >= hitChance) {
                hitChance = 10; // Minimum 10% hit chance
            } else {
                hitChance -= disadvantage;
            }
        }
        
        if (hitChance > 95) hitChance = 95; // Maximum 95% hit chance
        
        return _random(100) < hitChance;
    }
    
    function calculateCombatLevel(uint8 attackLevel, uint8 strengthLevel, uint8 defenseLevel, uint8 constitutionLevel, uint8 rangedLevel) internal pure returns (uint8) {
        uint256 base = (uint256(defenseLevel) + uint256(constitutionLevel)) / 4;
        uint256 melee = (uint256(attackLevel) + uint256(strengthLevel)) * 325 / 1000;
        uint256 ranged = (uint256(rangedLevel) * 3 * 325) / 2000;
        uint256 combatLevel = base + (melee > ranged ? melee : ranged);
        if (combatLevel > 99) combatLevel = 99;
        return uint8(combatLevel);
    }
    
    function _random(uint256 max) private view returns (uint256) {
        if (max == 0) return 0;
        return uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, gasleft()))) % max;
    }
}

