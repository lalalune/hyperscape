// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title CombatLevel
 * @notice Calculates rules-accurate combat level from skill levels.
 *
 * Formula (must match TypeScript CombatCalculations.ts):
 *   base = 0.25 × (Defense + Constitution + floor(Prayer / 2))
 *   melee = 0.325 × (Attack + Strength)
 *   ranged = 0.325 × floor(Ranged × 1.5)
 *   magic = 0.325 × floor(Magic × 1.5)
 *   combatLevel = floor(base + max(melee, ranged, magic))
 *
 * All calculations use fixed-point arithmetic (×1000) to avoid
 * floating point, then divide at the end.
 */
library CombatLevel {
    /**
     * @notice Calculates combat level from individual skill levels.
     * @param attack Attack level (1-99)
     * @param strength Strength level (1-99)
     * @param defense Defense level (1-99)
     * @param constitution Constitution/Hitpoints level (1-99)
     * @param ranged Ranged level (1-99)
     * @param magic Magic level (1-99)
     * @param prayer Prayer level (1-99)
     * @return combatLevel The calculated combat level
     */
    function calculate(
        uint16 attack,
        uint16 strength,
        uint16 defense,
        uint16 constitution,
        uint16 ranged,
        uint16 magic,
        uint16 prayer
    ) internal pure returns (uint16 combatLevel) {
        // All arithmetic scaled by 1000 to preserve decimal precision
        // base = 0.25 × (defense + constitution + floor(prayer / 2))
        uint256 base = 250 * (uint256(defense) + uint256(constitution) + (uint256(prayer) / 2));

        // melee = 0.325 × (attack + strength)
        uint256 melee = 325 * (uint256(attack) + uint256(strength));

        // ranged = 0.325 × floor(ranged × 1.5)
        // ranged × 1.5 = ranged × 3 / 2 (floor division)
        uint256 rangedContrib = 325 * ((uint256(ranged) * 3) / 2);

        // magic = 0.325 × floor(magic × 1.5)
        uint256 magicContrib = 325 * ((uint256(magic) * 3) / 2);

        // Take the maximum of melee, ranged, magic
        uint256 maxContrib = melee;
        if (rangedContrib > maxContrib) maxContrib = rangedContrib;
        if (magicContrib > maxContrib) maxContrib = magicContrib;

        // combatLevel = floor((base + maxContrib) / 1000)
        // The extra /1000 accounts for our ×1000 scaling
        combatLevel = uint16((base + maxContrib) / 1000);
    }
}
