// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title Constants
 * @notice Game constants matching the Hyperia TypeScript codebase.
 * All values must be kept in sync with the server-side definitions.
 */
library Constants {
    // =========================================================================
    // Inventory
    // =========================================================================

    /// @notice Maximum inventory slots (RuneScape-style)
    uint8 internal constant MAX_INVENTORY_SLOTS = 28;

    /// @notice Maximum equipment slot type index (0-10 inclusive)
    uint8 internal constant MAX_EQUIPMENT_SLOT = 10;

    // =========================================================================
    // Bank
    // =========================================================================

    /// @notice Maximum bank slots total
    uint16 internal constant MAX_BANK_SLOTS = 480;

    /// @notice Maximum bank tabs (0-9 inclusive)
    uint8 internal constant MAX_BANK_TABS = 10;

    // =========================================================================
    // Skills
    // =========================================================================

    /// @notice Maximum skill level
    uint16 internal constant MAX_SKILL_LEVEL = 99;

    /// @notice Maximum XP for any skill (200 million)
    uint32 internal constant MAX_XP = 200_000_000;

    /// @notice Default Constitution level for new characters
    uint16 internal constant DEFAULT_CONSTITUTION_LEVEL = 10;

    /// @notice Default Constitution XP for new characters (level 10 = 1151 XP per JS formula)
    uint32 internal constant DEFAULT_CONSTITUTION_XP = 1151;

    /// @notice Default health for new characters (Constitution level 10 × 10)
    uint16 internal constant DEFAULT_HEALTH = 100;

    /// @notice Default prayer level
    uint16 internal constant DEFAULT_PRAYER_LEVEL = 1;

    /// @notice Default prayer points
    uint16 internal constant DEFAULT_PRAYER_POINTS = 1;

    /// @notice Default combat level for new characters
    uint16 internal constant DEFAULT_COMBAT_LEVEL = 3;

    // =========================================================================
    // Trading
    // =========================================================================

    /// @notice Maximum items per side in a trade offer
    uint8 internal constant MAX_TRADE_OFFERS = 28;

    // =========================================================================
    // Item Registry
    // =========================================================================

    /// @notice Offset for noted item IDs: notedId = baseId + NOTED_ITEM_OFFSET
    uint32 internal constant NOTED_ITEM_OFFSET = 10000;

    /// @notice Reserved item ID for "no item" / empty slot
    uint32 internal constant EMPTY_ITEM_ID = 0;

    // =========================================================================
    // Gold
    // =========================================================================

    /// @notice Maximum gold a character can hold (matches int32 cap in server)
    uint64 internal constant MAX_GOLD = 2_147_483_647;

    // =========================================================================
    // Combat XP Rates (matches OSRS)
    // =========================================================================

    /// @notice XP per damage dealt for the trained combat skill (×100 for precision)
    uint32 internal constant COMBAT_XP_PER_DAMAGE_X100 = 400;

    /// @notice Hitpoints XP per damage dealt (×100 for precision: 1.33 × 100 = 133)
    uint32 internal constant HITPOINTS_XP_PER_DAMAGE_X100 = 133;

    /// @notice Controlled style XP per damage per skill (×100: 1.33 × 100 = 133)
    uint32 internal constant CONTROLLED_XP_PER_DAMAGE_X100 = 133;
}
