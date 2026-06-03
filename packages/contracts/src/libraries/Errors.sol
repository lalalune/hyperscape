// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title Errors
 * @notice Custom error definitions for all HyperForge systems.
 * Using custom errors instead of require strings saves gas.
 */
library Errors {
    // =========================================================================
    // Player Registry
    // =========================================================================
    error PlayerAlreadyRegistered(address player);
    error PlayerNotRegistered(address player);
    error CharacterNotFound(bytes32 characterId);
    error CharacterAlreadyRegistered(bytes32 characterId);
    error InvalidPlayerName();

    // =========================================================================
    // Inventory
    // =========================================================================
    error InventoryFull(bytes32 characterId);
    error InventorySlotEmpty(bytes32 characterId, uint8 slot);
    error InventorySlotOccupied(bytes32 characterId, uint8 slot);
    error InsufficientQuantity(bytes32 characterId, uint8 slot, uint32 requested, uint32 available);
    error InvalidSlotIndex(uint8 slot);

    // =========================================================================
    // Equipment
    // =========================================================================
    error ItemNotEquippable(uint32 itemId);
    error LevelRequirementNotMet(uint32 itemId, string skill, uint8 required, uint16 actual);
    error InvalidEquipmentSlot(uint8 slotType);

    // =========================================================================
    // Bank
    // =========================================================================
    error BankSlotEmpty(bytes32 characterId, uint8 tab, uint16 slot);
    error BankSlotOutOfBounds(bytes32 characterId, uint8 tabIndex, uint16 slot);
    error BankFull(bytes32 characterId);

    // =========================================================================
    // Items
    // =========================================================================
    error ItemNotFound(uint32 numericId);
    error ItemIdAlreadyRegistered(uint32 numericId);
    error ItemStringAlreadyRegistered(bytes32 stringIdHash);
    error ItemNotTradeable(uint32 itemId);
    error InvalidItemId();

    // =========================================================================
    // Gold / Economy
    // =========================================================================
    error InsufficientGold(bytes32 characterId, uint64 requested, uint64 available);
    error InsufficientGoldBalance(address account, uint256 requested, uint256 available);
    error ZeroAmount();
    error GoldOverflow(bytes32 characterId, uint64 current, uint64 amount);
    error InvalidCharacterOwner(bytes32 characterId);
    error ERC20OperationFailed(address account, uint256 amount, string operation);

    // =========================================================================
    // Trading
    // =========================================================================
    error TradeNotFound(bytes32 tradeId);
    error TradeNotPending(bytes32 tradeId);
    error TradeNotActive(bytes32 tradeId);
    error TradeNotConfirming(bytes32 tradeId);
    error TradeAlreadyCompleted(bytes32 tradeId);
    error NotTradeParticipant(bytes32 tradeId, address caller);
    error TradeOffersFull(bytes32 tradeId, uint8 side);
    error SelfTrade();
    error TradeGoldOverflow(bytes32 tradeId, bytes32 characterId, uint64 current, uint64 amount);
    error TradeOfferNotFound(bytes32 tradeId, uint8 side, uint8 offerIndex);

    // =========================================================================
    // Duels
    // =========================================================================
    error DuelNotFound(bytes32 duelId);
    error InvalidDuelWinner(bytes32 duelId, address winner);

    // =========================================================================
    // Skills
    // =========================================================================
    error InvalidSkill();
    error MaxLevelReached(bytes32 characterId, uint8 skill);
    error MaxXpReached(bytes32 characterId, uint8 skill);

    // =========================================================================
    // Shop
    // =========================================================================
    error ShopItemNotFound(bytes32 shopId, uint8 slotIndex);
    error InsufficientStock(bytes32 shopId, uint8 slotIndex);

    // =========================================================================
    // ERC-1155
    // =========================================================================
    error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 id);
    error ERC1155InvalidReceiver(address receiver);
    error ERC1155MissingApproval(address operator, address owner);
    error ERC1155InvalidArrayLength(uint256 idsLength, uint256 valuesLength);

    // =========================================================================
    // General
    // =========================================================================
    error Unauthorized(address caller);
    error InvalidAddress();
}
