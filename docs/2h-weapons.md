# 2-Handed Weapon System

## Overview

Hyperscape now supports 2-handed weapons that prevent shield equipping, matching OSRS mechanics.

## Implementation

### Type Definition

```typescript
// In Item interface (packages/shared/src/types/core.ts)
export interface Item {
  equipSlot: EquipmentSlotName | '2h' | null    // Can be '2h' for two-handed
  is2h?: boolean                                 // Alternative explicit flag
  // ... other properties
}
```

### Detection Logic

A weapon is considered 2-handed if:
- `equipSlot === '2h'` OR
- `is2h === true`

### Equipment Rules

1. **Equipping a 2h weapon:**
   - Automatically unequips shield if one is equipped
   - Shows message: "Shield unequipped (2-handed weapon equipped)."

2. **Equipping a shield:**
   - Checks if a 2h weapon is currently equipped
   - If yes, prevents shield equip with message: "Cannot equip shield while wielding a 2-handed weapon."

## Example Item Definitions

### 2-Handed Sword (using equipSlot)
```json
{
  "id": "2h_sword",
  "name": "Two-Handed Sword",
  "type": "weapon",
  "equipSlot": "2h",
  "weaponType": "sword",
  "attackType": "melee",
  "equipable": true
}
```

### 2-Handed Sword (using is2h flag)
```json
{
  "id": "greatsword",
  "name": "Greatsword",
  "type": "weapon",
  "equipSlot": "weapon",
  "weaponType": "sword",
  "attackType": "melee",
  "equipable": true,
  "is2h": true
}
```

### Regular 1-Handed Weapon
```json
{
  "id": "bronze_sword",
  "name": "Bronze Sword",
  "type": "weapon",
  "equipSlot": "weapon",
  "weaponType": "sword",
  "attackType": "melee",
  "equipable": true
}
```

## Testing

### Test Case 1: Equipping 2h weapon with shield
```
1. Equip shield
2. Equip 2h weapon
Expected: Shield automatically unequipped, message shown
```

### Test Case 2: Equipping shield with 2h weapon
```
1. Equip 2h weapon
2. Try to equip shield
Expected: Shield equip blocked, warning message shown
```

### Test Case 3: Switching from 2h to 1h weapon
```
1. Equip 2h weapon
2. Equip 1h weapon
3. Equip shield
Expected: All succeed, shield can be equipped with 1h weapon
```

## Code Location

**Equipment System:**
- `/packages/shared/src/systems/EquipmentSystem.ts:612-614` - `is2hWeapon()` helper
- `/packages/shared/src/systems/EquipmentSystem.ts:410-428` - 2h weapon checks in `equipItem()`

**Type Definitions:**
- `/packages/shared/src/types/core.ts:421-426` - Item interface with 2h support

**OSRS Reference:**
- `/osrs-interfaces/ItemEquipment.ts:7-11` - EquipmentSlot type with '2h'
- `/osrs-interfaces/README.md:186-187` - Documentation

## OSRS Comparison

Hyperscape implements 2-handed weapons **identically** to OSRS:

| Feature | OSRS | Hyperscape |
|---------|------|------------|
| **Detection** | `slot === '2h'` | `equipSlot === '2h' \|\| is2h === true` |
| **Shield Block** | ✅ Yes | ✅ Yes |
| **Auto-unequip** | ✅ Yes | ✅ Yes |
| **Examples** | Godswords, 2h swords, bows | Same pattern |

### OSRS Examples
- Godsword (2h melee)
- Two-handed sword (2h melee)
- Longbow / Shortbow (2h ranged)
- Staff (2h magic)

All of these prevent shield equipping in OSRS, and now Hyperscape works the same way.
