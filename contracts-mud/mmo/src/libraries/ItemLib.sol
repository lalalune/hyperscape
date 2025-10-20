// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library ItemLib {
    function checkItemRequirements(uint8 playerAttackLevel, uint8 playerStrengthLevel, uint8 playerDefenseLevel, uint8 playerRangedLevel, uint8 requiredAttackLevel, uint8 requiredStrengthLevel, uint8 requiredDefenseLevel, uint8 requiredRangedLevel) internal pure returns (bool meetsRequirements, string memory missingRequirement) {
        if (playerAttackLevel < requiredAttackLevel) return (false, "Insufficient Attack level");
        if (playerStrengthLevel < requiredStrengthLevel) return (false, "Insufficient Strength level");
        if (playerDefenseLevel < requiredDefenseLevel) return (false, "Insufficient Defense level");
        if (playerRangedLevel < requiredRangedLevel) return (false, "Insufficient Ranged level");
        return (true, "");
    }
    
    function getEquipmentSlot(uint8 itemType, string memory itemName) internal pure returns (uint8 slot, bool isEquipment) {
        if (itemType == 5) return (5, true); // Ammunition
        if (itemType == 0) {
            if (_contains(bytes(itemName), bytes("shield"))) return (1, true);
            return (0, true);
        }
        if (itemType == 1) {
            if (_contains(bytes(itemName), bytes("helmet"))) return (2, true);
            if (_contains(bytes(itemName), bytes("body")) || _contains(bytes(itemName), bytes("Plate"))) return (3, true);
            if (_contains(bytes(itemName), bytes("legs"))) return (4, true);
            return (3, true);
        }
        return (0, false);
    }
    
    function _contains(bytes memory haystack, bytes memory needle) private pure returns (bool) {
        if (needle.length > haystack.length || needle.length == 0) return false;
        for (uint256 i = 0; i <= haystack.length - needle.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }
}

