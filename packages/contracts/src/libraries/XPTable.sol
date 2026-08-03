// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Constants } from "./Constants.sol";

/**
 * @title XPTable
 * @notice rules-accurate XP table for skill levels 1-99.
 *
 * The XP formula for each level N (1-indexed) is:
 *   xpForLevel[N] = sum from i=1 to N-1 of floor(i + 300 * 2^(i/7)) / 4
 *
 * This matches the classic fantasy MMORPG XP table exactly and must produce identical
 * values to SkillsSystem.generateXPTable() in the TypeScript codebase.
 *
 * Because Solidity cannot do floating-point 2^(i/7), we use a precomputed
 * lookup table. This is the most gas-efficient and accurate approach.
 *
 * The table is stored as a constant array in contract bytecode (no storage reads).
 */
library XPTable {
    /**
     * @notice Returns the cumulative XP required to reach a given level.
     * @param level The target level (1-99). Level 1 requires 0 XP.
     * @return xp The cumulative XP required for that level.
     */
    function xpForLevel(uint16 level) internal pure returns (uint32 xp) {
        if (level <= 1) return 0;
        if (level > Constants.MAX_SKILL_LEVEL) return Constants.MAX_XP;

        // Precomputed XP thresholds for levels 1-99.
        // Generated from: floor(sum(i=1..N-1, floor(i + 300 * 2^(i/7)) / 4))
        // These values match the classic MMORPG wiki exactly.
        // Generated from the TypeScript SkillsSystem.generateXPTable() formula.
        // These MUST match the game server's values exactly (JavaScript floating-point).
        // Differs from classic MMORPG wiki values by up to 37 XP at level 99 due to float rounding.
        uint32[99] memory table = [
            uint32(0),        // Level 1
            uint32(83),       // Level 2
            uint32(174),      // Level 3
            uint32(275),      // Level 4
            uint32(387),      // Level 5
            uint32(511),      // Level 6
            uint32(648),      // Level 7
            uint32(799),      // Level 8
            uint32(966),      // Level 9
            uint32(1151),     // Level 10
            uint32(1355),     // Level 11
            uint32(1580),     // Level 12
            uint32(1829),     // Level 13
            uint32(2103),     // Level 14
            uint32(2406),     // Level 15
            uint32(2740),     // Level 16
            uint32(3109),     // Level 17
            uint32(3517),     // Level 18
            uint32(3967),     // Level 19
            uint32(4463),     // Level 20
            uint32(5011),     // Level 21
            uint32(5616),     // Level 22
            uint32(6283),     // Level 23
            uint32(7020),     // Level 24
            uint32(7833),     // Level 25
            uint32(8730),     // Level 26
            uint32(9720),     // Level 27
            uint32(10813),    // Level 28
            uint32(12020),    // Level 29
            uint32(13352),    // Level 30
            uint32(14822),    // Level 31
            uint32(16444),    // Level 32
            uint32(18235),    // Level 33
            uint32(20212),    // Level 34
            uint32(22394),    // Level 35
            uint32(24802),    // Level 36
            uint32(27460),    // Level 37
            uint32(30394),    // Level 38
            uint32(33633),    // Level 39
            uint32(37209),    // Level 40
            uint32(41156),    // Level 41
            uint32(45513),    // Level 42
            uint32(50323),    // Level 43
            uint32(55633),    // Level 44
            uint32(61495),    // Level 45
            uint32(67966),    // Level 46
            uint32(75110),    // Level 47
            uint32(82996),    // Level 48
            uint32(91702),    // Level 49
            uint32(101314),   // Level 50
            uint32(111925),   // Level 51
            uint32(123640),   // Level 52
            uint32(136573),   // Level 53
            uint32(150851),   // Level 54
            uint32(166614),   // Level 55
            uint32(184017),   // Level 56
            uint32(203231),   // Level 57
            uint32(224443),   // Level 58
            uint32(247862),   // Level 59
            uint32(273718),   // Level 60
            uint32(302264),   // Level 61
            uint32(333780),   // Level 62
            uint32(368575),   // Level 63
            uint32(406990),   // Level 64
            uint32(449403),   // Level 65
            uint32(496229),   // Level 66
            uint32(547928),   // Level 67
            uint32(605006),   // Level 68
            uint32(668024),   // Level 69
            uint32(737600),   // Level 70
            uint32(814417),   // Level 71
            uint32(899228),   // Level 72
            uint32(992866),   // Level 73
            uint32(1096249),  // Level 74
            uint32(1210391),  // Level 75
            uint32(1336413),  // Level 76
            uint32(1475551),  // Level 77
            uint32(1629170),  // Level 78
            uint32(1798777),  // Level 79
            uint32(1986037),  // Level 80
            uint32(2192787),  // Level 81
            uint32(2421055),  // Level 82
            uint32(2673082),  // Level 83
            uint32(2951341),  // Level 84
            uint32(3258562),  // Level 85
            uint32(3597759),  // Level 86
            uint32(3972261),  // Level 87
            uint32(4385743),  // Level 88
            uint32(4842262),  // Level 89
            uint32(5346298),  // Level 90
            uint32(5902797),  // Level 91
            uint32(6517219),  // Level 92
            uint32(7195594),  // Level 93
            uint32(7944579),  // Level 94
            uint32(8771523),  // Level 95
            uint32(9684541),  // Level 96
            uint32(10692593), // Level 97
            uint32(11805570), // Level 98
            uint32(13034394)  // Level 99
        ];

        return table[level - 1];
    }

    /**
     * @notice Returns the level for a given amount of cumulative XP.
     * @param xp The cumulative XP.
     * @return level The level achieved with that XP (1-99).
     */
    function levelForXp(uint32 xp) internal pure returns (uint16 level) {
        // Binary search through the XP table for efficiency.
        // Worst case: 7 iterations (log2(99) ≈ 6.6)
        uint16 low = 1;
        uint16 high = Constants.MAX_SKILL_LEVEL;

        while (low < high) {
            uint16 mid = (low + high + 1) / 2;
            if (xpForLevel(mid) <= xp) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }

        return low;
    }

    /**
     * @notice Checks if adding XP would cause a level up.
     * @param currentXp Current XP in the skill.
     * @param currentLevel Current level in the skill.
     * @param xpToAdd XP being added.
     * @return newLevel The new level after XP addition.
     * @return newXp The new total XP (capped at MAX_XP).
     * @return levelsGained Number of levels gained (0 if no level up).
     */
    function calculateXpGain(
        uint32 currentXp,
        uint16 currentLevel,
        uint32 xpToAdd
    ) internal pure returns (uint16 newLevel, uint32 newXp, uint16 levelsGained) {
        // Cap total XP at MAX_XP
        uint64 totalXp = uint64(currentXp) + uint64(xpToAdd);
        if (totalXp > Constants.MAX_XP) {
            totalXp = Constants.MAX_XP;
        }
        newXp = uint32(totalXp);

        // Calculate new level from new XP
        newLevel = levelForXp(newXp);

        // Calculate levels gained
        if (newLevel > currentLevel) {
            levelsGained = newLevel - currentLevel;
        } else {
            levelsGained = 0;
        }
    }
}
