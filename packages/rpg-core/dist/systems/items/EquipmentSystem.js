"use strict";
/**
 * Equipment System - Manages player equipment and gear progression
 * Handles equipping, unequipping, stat bonuses, and equipment validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EquipmentSystem = void 0;
const sdk_1 = require("@hyperfy/sdk");
const ItemDefinitions_1 = require("./ItemDefinitions");
const SkillDefinitions_1 = require("../skills/SkillDefinitions");
class EquipmentSystem extends sdk_1.System {
    constructor(world) {
        super(world);
        this.equipmentUpdates = new Map();
    }
    async initialize() {
        console.log('[EquipmentSystem] Initializing...');
        // Listen for equipment events
        this.world.events.on('player:joined', this.handlePlayerJoined.bind(this));
        this.world.events.on('equipment:equip_item', this.handleEquipItem.bind(this));
        this.world.events.on('equipment:unequip_item', this.handleUnequipItem.bind(this));
        this.world.events.on('inventory:use_item', this.handleUseItem.bind(this));
        this.world.events.on('equipment:swap_items', this.handleSwapItems.bind(this));
        this.world.events.on('equipment:auto_equip', this.handleAutoEquip.bind(this));
        console.log('[EquipmentSystem] Initialized');
    }
    handlePlayerJoined(data) {
        const { entityId } = data;
        this.createEquipmentComponent(entityId);
    }
    createEquipmentComponent(entityId) {
        const entity = this.world.getEntityById(entityId);
        if (!entity) {
            return null;
        }
        const equipmentComponent = {
            type: 'equipment',
            slots: {
                [ItemDefinitions_1.EquipmentSlot.WEAPON]: null,
                [ItemDefinitions_1.EquipmentSlot.HELMET]: null,
                [ItemDefinitions_1.EquipmentSlot.BODY]: null,
                [ItemDefinitions_1.EquipmentSlot.LEGS]: null,
                [ItemDefinitions_1.EquipmentSlot.BOOTS]: null,
                [ItemDefinitions_1.EquipmentSlot.GLOVES]: null,
                [ItemDefinitions_1.EquipmentSlot.SHIELD]: null,
                [ItemDefinitions_1.EquipmentSlot.RING]: null,
                [ItemDefinitions_1.EquipmentSlot.AMULET]: null,
                [ItemDefinitions_1.EquipmentSlot.ARROW]: null,
                [ItemDefinitions_1.EquipmentSlot.CAPE]: null,
            },
            totalWeight: 0,
            bonuses: {
                attackBonus: 0,
                strengthBonus: 0,
                defenceBonus: 0,
                rangedBonus: 0,
                rangedDefence: 0,
                magicBonus: 0,
                magicDefence: 0,
                prayer: 0,
                weight: 0,
            },
            combatLevel: 3,
        };
        entity.addComponent(equipmentComponent);
        return equipmentComponent;
    }
    handleEquipItem(data) {
        const { playerId, itemId, slot } = data;
        this.equipItem(playerId, itemId, slot);
    }
    handleUnequipItem(data) {
        const { playerId, slot } = data;
        this.unequipItem(playerId, slot);
    }
    handleUseItem(data) {
        const { playerId, itemId } = data;
        this.useItem(playerId, itemId, data);
    }
    handleSwapItems(data) {
        const { playerId, fromSlot, toSlot } = data;
        this.swapEquippedItems(playerId, fromSlot, toSlot);
    }
    handleAutoEquip(data) {
        const { playerId, itemId } = data;
        this.autoEquipItem(playerId, itemId);
    }
    equipItem(playerId, itemId, slot) {
        const entity = this.world.getEntityById(playerId);
        const itemDef = (0, ItemDefinitions_1.getItemDefinition)(itemId);
        if (!entity || !itemDef) {
            this.world.events.emit('equipment:error', {
                playerId,
                message: 'Item not found or invalid entity',
            });
            return false;
        }
        const equipment = entity.getComponent('equipment');
        if (!equipment) {
            this.world.events.emit('equipment:error', {
                playerId,
                message: 'Equipment component not found',
            });
            return false;
        }
        // Check if item is equippable
        if (itemDef.category !== ItemDefinitions_1.ItemCategory.WEAPON &&
            itemDef.category !== ItemDefinitions_1.ItemCategory.ARMOR &&
            itemDef.category !== ItemDefinitions_1.ItemCategory.TOOL) {
            this.world.events.emit('equipment:error', {
                playerId,
                message: 'Item is not equippable',
            });
            return false;
        }
        // Determine equipment slot
        const equipmentSlot = slot || itemDef.equipmentSlot;
        if (!equipmentSlot) {
            this.world.events.emit('equipment:error', {
                playerId,
                message: 'Item does not have a valid equipment slot',
            });
            return false;
        }
        // Check requirements
        if (!this.canPlayerEquipItem(playerId, itemDef)) {
            this.world.events.emit('equipment:error', {
                playerId,
                message: 'You do not meet the requirements to equip this item',
            });
            return false;
        }
        // Check if player has the item in inventory
        const inventorySystem = this.world.systems.find(s => s.constructor.name === 'InventorySystem');
        if (!inventorySystem || !inventorySystem.hasItem(playerId, itemId, 1)) {
            this.world.events.emit('equipment:error', {
                playerId,
                message: 'You do not have this item in your inventory',
            });
            return false;
        }
        // Unequip existing item in slot if any
        if (equipment.slots[equipmentSlot]) {
            this.unequipItem(playerId, equipmentSlot);
        }
        // Remove item from inventory
        ;
        inventorySystem.removeItem(playerId, itemId, 1);
        // Equip the item
        equipment.slots[equipmentSlot] = {
            itemId,
            slot: equipmentSlot,
            equipped: Date.now(),
        };
        // Update bonuses
        this.updateEquipmentBonuses(playerId);
        this.world.events.emit('equipment:item_equipped', {
            playerId,
            itemId,
            slot: equipmentSlot,
            itemName: itemDef.name,
        });
        return true;
    }
    unequipItem(playerId, slot) {
        const entity = this.world.getEntityById(playerId);
        if (!entity) {
            return false;
        }
        const equipment = entity.getComponent('equipment');
        if (!equipment || !equipment.slots[slot]) {
            this.world.events.emit('equipment:error', {
                playerId,
                message: 'No item equipped in that slot',
            });
            return false;
        }
        const equippedItem = equipment.slots[slot];
        const itemDef = (0, ItemDefinitions_1.getItemDefinition)(equippedItem.itemId);
        if (!itemDef) {
            return false;
        }
        // Check if inventory has space
        const inventorySystem = this.world.systems.find(s => s.constructor.name === 'InventorySystem');
        if (!inventorySystem || !inventorySystem.canAddItem(playerId, equippedItem.itemId, 1)) {
            this.world.events.emit('equipment:error', {
                playerId,
                message: 'Not enough inventory space to unequip item',
            });
            return false;
        }
        // Add item back to inventory
        ;
        inventorySystem.addItem(playerId, equippedItem.itemId, 1);
        // Unequip the item
        equipment.slots[slot] = null;
        // Update bonuses
        this.updateEquipmentBonuses(playerId);
        this.world.events.emit('equipment:item_unequipped', {
            playerId,
            itemId: equippedItem.itemId,
            slot,
            itemName: itemDef.name,
        });
        return true;
    }
    useItem(playerId, itemId, useData) {
        const itemDef = (0, ItemDefinitions_1.getItemDefinition)(itemId);
        if (!itemDef) {
            return false;
        }
        // Handle consumable items
        if (itemDef.category === ItemDefinitions_1.ItemCategory.CONSUMABLE && itemDef.consumable) {
            return this.consumeItem(playerId, itemId);
        }
        // Handle equippable items (auto-equip)
        if (itemDef.equipmentSlot) {
            return this.autoEquipItem(playerId, itemId);
        }
        // Handle other item uses (tools, etc.)
        this.world.events.emit('equipment:item_used', {
            playerId,
            itemId,
            useData,
        });
        return true;
    }
    consumeItem(playerId, itemId) {
        const entity = this.world.getEntityById(playerId);
        const itemDef = (0, ItemDefinitions_1.getItemDefinition)(itemId);
        if (!entity || !itemDef || !itemDef.consumable) {
            return false;
        }
        // Check if player has the item
        const inventorySystem = this.world.systems.find(s => s.constructor.name === 'InventorySystem');
        if (!inventorySystem || !inventorySystem.hasItem(playerId, itemId, 1)) {
            this.world.events.emit('equipment:error', {
                playerId,
                message: 'You do not have this item',
            });
            return false;
        }
        // Check if player can consume (not in combat, etc.)
        const combatSystem = this.world.systems.find(s => s.constructor.name === 'AdvancedCombatSystem');
        if (combatSystem) {
            const combatComponent = combatSystem.getCombatComponent(playerId);
            if (combatComponent && combatComponent.inCombat) {
                // Only allow food consumption in combat, not potions
                if (!itemDef.consumable.healAmount) {
                    this.world.events.emit('equipment:error', {
                        playerId,
                        message: 'Cannot use this item in combat',
                    });
                    return false;
                }
            }
        }
        // Consume the item
        ;
        inventorySystem.removeItem(playerId, itemId, 1);
        // Apply healing
        if (itemDef.consumable.healAmount) {
            if (combatSystem) {
                const combatComponent = combatSystem.getCombatComponent(playerId);
                if (combatComponent) {
                    const newHp = Math.min(combatComponent.maxHitpoints, combatComponent.currentHitpoints + itemDef.consumable.healAmount);
                    combatComponent.currentHitpoints = newHp;
                    this.world.events.emit('equipment:healing_applied', {
                        playerId,
                        healAmount: itemDef.consumable.healAmount,
                        currentHp: newHp,
                        maxHp: combatComponent.maxHitpoints,
                    });
                }
            }
        }
        // Apply temporary effects
        if (itemDef.consumable.effects) {
            for (const effect of itemDef.consumable.effects) {
                this.applyTemporaryEffect(playerId, effect);
            }
        }
        this.world.events.emit('equipment:item_consumed', {
            playerId,
            itemId,
            itemName: itemDef.name,
            healAmount: itemDef.consumable.healAmount,
            effects: itemDef.consumable.effects,
        });
        return true;
    }
    applyTemporaryEffect(playerId, effect) {
        // This would integrate with a temporary effects system
        this.world.events.emit('equipment:temporary_effect_applied', {
            playerId,
            skill: effect.skill,
            boost: effect.boost,
            duration: effect.duration,
        });
    }
    autoEquipItem(playerId, itemId) {
        const itemDef = (0, ItemDefinitions_1.getItemDefinition)(itemId);
        if (!itemDef || !itemDef.equipmentSlot) {
            return false;
        }
        return this.equipItem(playerId, itemId, itemDef.equipmentSlot);
    }
    swapEquippedItems(playerId, fromSlot, toSlot) {
        const entity = this.world.getEntityById(playerId);
        if (!entity) {
            return false;
        }
        const equipment = entity.getComponent('equipment');
        if (!equipment) {
            return false;
        }
        const fromItem = equipment.slots[fromSlot];
        const toItem = equipment.slots[toSlot];
        // Validate the swap
        if (fromItem && toItem) {
            const fromItemDef = (0, ItemDefinitions_1.getItemDefinition)(fromItem.itemId);
            const toItemDef = (0, ItemDefinitions_1.getItemDefinition)(toItem.itemId);
            // Check if items can be equipped in target slots
            if (fromItemDef && fromItemDef.equipmentSlot !== toSlot) {
                return false;
            }
            if (toItemDef && toItemDef.equipmentSlot !== fromSlot) {
                return false;
            }
        }
        // Perform the swap
        equipment.slots[fromSlot] = toItem;
        equipment.slots[toSlot] = fromItem;
        // Update bonuses
        this.updateEquipmentBonuses(playerId);
        this.world.events.emit('equipment:items_swapped', {
            playerId,
            fromSlot,
            toSlot,
            fromItem: fromItem?.itemId,
            toItem: toItem?.itemId,
        });
        return true;
    }
    canPlayerEquipItem(playerId, itemDef) {
        const skillsSystem = this.world.systems.find(s => s.constructor.name === 'EnhancedSkillsSystem');
        if (!skillsSystem || !itemDef.requirements) {
            return true;
        }
        const playerLevels = {
            attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1,
            prayer: 1, hitpoints: 10, mining: 1, smithing: 1,
            fishing: 1, cooking: 1, woodcutting: 1, firemaking: 1,
            fletching: 1,
            crafting: 1, herblore: 1, agility: 1, thieving: 1,
            slayer: 1, farming: 1, runecrafting: 1, hunter: 1,
            construction: 1
        };
        for (const req of itemDef.requirements) {
            playerLevels[req.skill] = skillsSystem.getSkillLevel(playerId, req.skill);
        }
        return (0, ItemDefinitions_1.canPlayerEquipItem)(playerLevels, itemDef);
    }
    updateEquipmentBonuses(playerId) {
        const entity = this.world.getEntityById(playerId);
        if (!entity) {
            return;
        }
        const equipment = entity.getComponent('equipment');
        if (!equipment) {
            return;
        }
        // Reset bonuses
        equipment.bonuses = {
            attackBonus: 0,
            strengthBonus: 0,
            defenceBonus: 0,
            rangedBonus: 0,
            rangedDefence: 0,
            magicBonus: 0,
            magicDefence: 0,
            prayer: 0,
            weight: 0,
        };
        equipment.totalWeight = 0;
        // Sum bonuses from all equipped items
        for (const equippedItem of Object.values(equipment.slots)) {
            if (!equippedItem) {
                continue;
            }
            const itemDef = (0, ItemDefinitions_1.getItemDefinition)(equippedItem.itemId);
            if (!itemDef || !itemDef.stats) {
                continue;
            }
            if (itemDef.stats.attackBonus) {
                equipment.bonuses.attackBonus = (equipment.bonuses.attackBonus || 0) + itemDef.stats.attackBonus;
            }
            if (itemDef.stats.strengthBonus) {
                equipment.bonuses.strengthBonus = (equipment.bonuses.strengthBonus || 0) + itemDef.stats.strengthBonus;
            }
            if (itemDef.stats.defenceBonus) {
                equipment.bonuses.defenceBonus = (equipment.bonuses.defenceBonus || 0) + itemDef.stats.defenceBonus;
            }
            if (itemDef.stats.rangedBonus) {
                equipment.bonuses.rangedBonus = (equipment.bonuses.rangedBonus || 0) + itemDef.stats.rangedBonus;
            }
            if (itemDef.stats.rangedDefence) {
                equipment.bonuses.rangedDefence = (equipment.bonuses.rangedDefence || 0) + itemDef.stats.rangedDefence;
            }
            if (itemDef.stats.magicBonus) {
                equipment.bonuses.magicBonus = (equipment.bonuses.magicBonus || 0) + itemDef.stats.magicBonus;
            }
            if (itemDef.stats.magicDefence) {
                equipment.bonuses.magicDefence = (equipment.bonuses.magicDefence || 0) + itemDef.stats.magicDefence;
            }
            if (itemDef.stats.prayer) {
                equipment.bonuses.prayer = (equipment.bonuses.prayer || 0) + itemDef.stats.prayer;
            }
            if (itemDef.stats.weight) {
                equipment.bonuses.weight = (equipment.bonuses.weight || 0) + itemDef.stats.weight;
                equipment.totalWeight += itemDef.stats.weight;
            }
        }
        // Update combat level
        this.updateCombatLevel(playerId);
        // Mark for update
        this.equipmentUpdates.set(playerId, Date.now());
        this.world.events.emit('equipment:bonuses_updated', {
            playerId,
            bonuses: equipment.bonuses,
            totalWeight: equipment.totalWeight,
            combatLevel: equipment.combatLevel,
        });
    }
    updateCombatLevel(playerId) {
        const entity = this.world.getEntityById(playerId);
        if (!entity) {
            return;
        }
        const equipment = entity.getComponent('equipment');
        const skillsSystem = this.world.systems.find(s => s.constructor.name === 'EnhancedSkillsSystem');
        if (!equipment || !skillsSystem) {
            return;
        }
        // Calculate combat level (RuneScape formula)
        const attack = skillsSystem.getSkillLevel(playerId, SkillDefinitions_1.SkillType.ATTACK);
        const strength = skillsSystem.getSkillLevel(playerId, SkillDefinitions_1.SkillType.STRENGTH);
        const defence = skillsSystem.getSkillLevel(playerId, SkillDefinitions_1.SkillType.DEFENCE);
        const hitpoints = skillsSystem.getSkillLevel(playerId, SkillDefinitions_1.SkillType.HITPOINTS);
        const ranged = skillsSystem.getSkillLevel(playerId, SkillDefinitions_1.SkillType.RANGED);
        const magic = skillsSystem.getSkillLevel(playerId, SkillDefinitions_1.SkillType.MAGIC);
        const prayer = skillsSystem.getSkillLevel(playerId, SkillDefinitions_1.SkillType.PRAYER);
        const combatLevel = Math.floor((defence + hitpoints + Math.floor(prayer / 2)) * 0.25 +
            Math.max((attack + strength) * 0.325, ranged * 0.65, magic * 0.65));
        equipment.combatLevel = combatLevel;
    }
    getEquippedItem(playerId, slot) {
        const entity = this.world.getEntityById(playerId);
        if (!entity) {
            return null;
        }
        const equipment = entity.getComponent('equipment');
        return equipment ? equipment.slots[slot] : null;
    }
    getAllEquippedItems(playerId) {
        const entity = this.world.getEntityById(playerId);
        if (!entity) {
            return {};
        }
        const equipment = entity.getComponent('equipment');
        return equipment ? equipment.slots : {};
    }
    getEquipmentBonuses(playerId) {
        const entity = this.world.getEntityById(playerId);
        if (!entity) {
            return null;
        }
        const equipment = entity.getComponent('equipment');
        return equipment ? equipment.bonuses : null;
    }
    getEquipmentComponent(playerId) {
        const entity = this.world.getEntityById(playerId);
        return entity ? entity.getComponent('equipment') : null;
    }
    isItemEquipped(playerId, itemId) {
        const equipment = this.getAllEquippedItems(playerId);
        return Object.values(equipment).some(item => item && item.itemId === itemId);
    }
    getCombatLevel(playerId) {
        const entity = this.world.getEntityById(playerId);
        if (!entity) {
            return 3;
        }
        const equipment = entity.getComponent('equipment');
        return equipment ? equipment.combatLevel : 3;
    }
    update(deltaTime) {
        // Handle any ongoing equipment-related processes
        // For now, just cleanup old update timestamps
        const now = Date.now();
        for (const [playerId, timestamp] of this.equipmentUpdates) {
            if (now - timestamp > 60000) {
                // 1 minute old
                this.equipmentUpdates.delete(playerId);
            }
        }
    }
    serialize() {
        return {
            equipmentUpdates: Object.fromEntries(this.equipmentUpdates),
        };
    }
    deserialize(data) {
        if (data.equipmentUpdates) {
            this.equipmentUpdates = new Map(Object.entries(data.equipmentUpdates));
        }
    }
}
exports.EquipmentSystem = EquipmentSystem;
//# sourceMappingURL=EquipmentSystem.js.map