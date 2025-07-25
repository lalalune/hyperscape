/**
 * RPG Equipment System
 * Handles equipment management, stat bonuses, level requirements, and visual attachment per GDD specifications
 * - Equipment slots (weapon, shield, helmet, body, legs, arrows)
 * - Level requirements for equipment tiers
 * - Stat bonuses from equipped items
 * - Right-click equip/unequip functionality
 * - Visual equipment attachment to player avatars
 * - Colored cube representations for equipment
 */

import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

export interface EquipmentSlot {
  slot: 'weapon' | 'shield' | 'helmet' | 'body' | 'legs' | 'arrows';
  itemId: number | null;
  item: any | null;
  visualMesh?: THREE.Object3D;
}

export interface PlayerEquipment {
  playerId: string;
  weapon: EquipmentSlot;
  shield: EquipmentSlot;
  helmet: EquipmentSlot;
  body: EquipmentSlot;
  legs: EquipmentSlot;
  arrows: EquipmentSlot;
  totalStats: {
    attack: number;
    strength: number;
    defense: number;
    ranged: number;
    constitution: number;
  };
}

/**
 * RPG Equipment System - GDD Compliant
 * Manages player equipment per GDD specifications:
 * - 6 equipment slots as defined in GDD
 * - Level requirements (bronze=1, steel=10, mithril=20)
 * - Automatic stat calculation from equipped items
 * - Arrow consumption integration with combat
 * - Equipment persistence via inventory system
 */
export class RPGEquipmentSystem extends System {
  private playerEquipment = new Map<string, PlayerEquipment>();
  private equipmentColors = new Map<string, number>();
  
  // GDD-compliant level requirements
  private readonly LEVEL_REQUIREMENTS = {
    // Weapons
    'bronze_sword': { attack: 1 },
    'steel_sword': { attack: 10 },
    'mithril_sword': { attack: 20 },
    'wood_bow': { ranged: 1 },
    'oak_bow': { ranged: 10 },
    'willow_bow': { ranged: 20 },
    
    // Shields
    'bronze_shield': { defense: 1 },
    'steel_shield': { defense: 10 },
    'mithril_shield': { defense: 20 },
    
    // Helmets
    'leather_helmet': { defense: 1 },
    'hard_leather_helmet': { defense: 5 },
    'studded_leather_helmet': { defense:10 },
    'bronze_helmet': { defense: 1 },
    'steel_helmet': { defense: 10 },
    'mithril_helmet': { defense: 20 },
    
    // Body armor
    'leather_body': { defense: 1 },
    'hard_leather_body': { defense: 5 },
    'studded_leather_body': { defense: 10 },
    'bronze_body': { defense: 1 },
    'steel_body': { defense: 10 },
    'mithril_body': { defense: 20 },
    
    // Leg armor
    'hard_leather_legs': { defense: 5 },
    'studded_leather_legs': { defense: 10 },
    
    // Arrows (no level requirement)
    'arrows': {}
  };

  constructor(world: any) {
    super(world);
    this.initializeEquipmentColors();
  }

  private initializeEquipmentColors(): void {
    // Equipment colors for visual representation
    this.equipmentColors.set('bronze', 0xCD7F32);     // Bronze
    this.equipmentColors.set('steel', 0xC0C0C0);      // Silver
    this.equipmentColors.set('mithril', 0x4169E1);    // Royal blue
    this.equipmentColors.set('leather', 0x8B4513);    // Saddle brown
    this.equipmentColors.set('hard_leather', 0xA0522D); // Sienna
    this.equipmentColors.set('studded_leather', 0x654321); // Dark brown
    this.equipmentColors.set('wood', 0x8B4513);       // Brown
    this.equipmentColors.set('oak', 0x8B7355);        // Burlywood
    this.equipmentColors.set('willow', 0x9ACD32);     // Yellow green
    this.equipmentColors.set('arrows', 0xFFD700);     // Gold
  }

  async init(): Promise<void> {
    console.log('[RPGEquipmentSystem] Initializing GDD-compliant equipment system...');
    
    // Listen for equipment events
    this.world.on('rpg:player:register', this.initializePlayerEquipment.bind(this));
    this.world.on('rpg:player:unregister', this.cleanupPlayerEquipment.bind(this));
    this.world.on('rpg:equipment:equip', this.equipItem.bind(this));
    this.world.on('rpg:equipment:unequip', this.unequipItem.bind(this));
    this.world.on('rpg:equipment:try_equip', this.tryEquipItem.bind(this));
    this.world.on('rpg:equipment:force_equip', this.handleForceEquip.bind(this));
    this.world.on('rpg:inventory:item_right_click', this.handleItemRightClick.bind(this));
    this.world.on('equipment:consume_arrow', this.consumeArrow.bind(this));
    
    console.log('[RPGEquipmentSystem] Equipment system initialized with GDD mechanics');
  }

  start(): void {
    console.log('[RPGEquipmentSystem] Equipment system started');
  }

  private initializePlayerEquipment(playerData: { id: string }): void {
    const equipment: PlayerEquipment = {
      playerId: playerData.id,
      weapon: { slot: 'weapon', itemId: null, item: null },
      shield: { slot: 'shield', itemId: null, item: null },
      helmet: { slot: 'helmet', itemId: null, item: null },
      body: { slot: 'body', itemId: null, item: null },
      legs: { slot: 'legs', itemId: null, item: null },
      arrows: { slot: 'arrows', itemId: null, item: null },
      totalStats: {
        attack: 0,
        strength: 0,
        defense: 0,
        ranged: 0,
        constitution: 0
      }
    };
    
    this.playerEquipment.set(playerData.id, equipment);
    
    // Equip starting equipment per GDD (bronze sword)
    this.equipStartingItems(playerData.id);
    
    console.log(`[RPGEquipmentSystem] Initialized equipment for player: ${playerData.id}`);
  }

  private equipStartingItems(playerId: string): void {
    // Per GDD, players start with bronze sword equipped
    const bronzeSword = this.getItemData('bronze_sword');
    if (bronzeSword) {
      this.forceEquipItem(playerId, bronzeSword, 'weapon');
      console.log(`[RPGEquipmentSystem] Equipped starting bronze sword for player: ${playerId}`);
    }
  }

  private cleanupPlayerEquipment(playerId: string): void {
    this.playerEquipment.delete(playerId);
    console.log(`[RPGEquipmentSystem] Cleaned up equipment for player: ${playerId}`);
  }

  private handleItemRightClick(data: { playerId: string; itemId: number; slot: number }): void {
    console.log(`[RPGEquipmentSystem] Right-click on item ${data.itemId} by player ${data.playerId}`);
    
    const itemData = this.getItemData(data.itemId);
    if (!itemData) {
      console.warn(`[RPGEquipmentSystem] Unknown item: ${data.itemId}`);
      return;
    }
    
    // Determine if this is equippable
    const equipSlot = this.getEquipmentSlot(itemData);
    if (equipSlot) {
      this.tryEquipItem({
        playerId: data.playerId,
        itemId: data.itemId,
        inventorySlot: data.slot
      });
    } else {
      // Not equippable - maybe it's consumable?
      if (itemData.type === 'food') {
        this.world.emit('rpg:inventory:consume_item', {
          playerId: data.playerId,
          itemId: data.itemId,
          slot: data.slot
        });
      }
    }
  }

  private tryEquipItem(data: { playerId: string; itemId: number; inventorySlot?: number }): void {
    const player = this.world.getPlayer?.(data.playerId);
    const equipment = this.playerEquipment.get(data.playerId);
    
    if (!player || !equipment) {
      console.warn(`[RPGEquipmentSystem] Player or equipment not found: ${data.playerId}`);
      return;
    }
    
    const itemData = this.getItemData(data.itemId);
    if (!itemData) {
      console.warn(`[RPGEquipmentSystem] Item not found: ${data.itemId}`);
      return;
    }
    
    const equipSlot = this.getEquipmentSlot(itemData);
    if (!equipSlot) {
      console.warn(`[RPGEquipmentSystem] Item not equippable: ${itemData.name}`);
      this.sendMessage(data.playerId, `${itemData.name} cannot be equipped.`, 'warning');
      return;
    }
    
    // Check level requirements
    if (!this.meetsLevelRequirements(data.playerId, itemData)) {
      const requirements = this.LEVEL_REQUIREMENTS[itemData.id] || {};
      const reqText = Object.entries(requirements).map(([skill, level]) => 
        `${skill} ${level}`
      ).join(', ');
      
      this.sendMessage(data.playerId, `You need ${reqText} to equip ${itemData.name}.`, 'warning');
      return;
    }
    
    // Check if item is in inventory
    if (!this.playerHasItem(data.playerId, data.itemId)) {
      console.warn(`[RPGEquipmentSystem] Player ${data.playerId} doesn't have item ${data.itemId}`);
      return;
    }
    
    // Perform the equipment
    this.equipItem({
      playerId: data.playerId,
      itemId: data.itemId,
      slot: equipSlot,
      inventorySlot: data.inventorySlot
    });
  }

  private equipItem(data: { playerId: string; itemId: number; slot: string; inventorySlot?: number }): void {
    const equipment = this.playerEquipment.get(data.playerId);
    if (!equipment) return;
    
    const itemData = this.getItemData(data.itemId);
    if (!itemData) return;
    
    const slot = data.slot as keyof PlayerEquipment;
    if (slot === 'playerId' || slot === 'totalStats') return;
    
    // Unequip current item in slot if any
    if (equipment[slot].itemId) {
      this.unequipItem({
        playerId: data.playerId,
        slot: data.slot
      });
    }
    
    // Equip new item
    equipment[slot].itemId = data.itemId;
    equipment[slot].item = itemData;
    
    // Create visual representation
    this.createEquipmentVisual(data.playerId, equipment[slot]);
    
    // Remove from inventory
    this.world.emit('rpg:inventory:remove', {
      playerId: data.playerId,
      itemId: data.itemId,
      quantity: 1,
      slot: data.inventorySlot
    });
    
    // Update stats
    this.recalculateStats(data.playerId);
    
    // Update combat system with new equipment
    this.world.emit('rpg:player:equipment:changed', {
      playerId: data.playerId,
      equipment: this.getEquipmentData(data.playerId)
    });
    
    console.log(`[RPGEquipmentSystem] Player ${data.playerId} equipped ${itemData.name} to ${data.slot}`);
    this.sendMessage(data.playerId, `Equipped ${itemData.name}.`, 'info');
  }

  private unequipItem(data: { playerId: string; slot: string }): void {
    const equipment = this.playerEquipment.get(data.playerId);
    if (!equipment) return;
    
    const slot = data.slot as keyof PlayerEquipment;
    if (slot === 'playerId' || slot === 'totalStats') return;
    
    const currentItem = equipment[slot];
    if (!currentItem.itemId || !currentItem.item) return;
    
    // Add back to inventory
    const addedToInventory = this.world.emit('rpg:inventory:add', {
      playerId: data.playerId,
      item: {
        id: currentItem.itemId,
        name: currentItem.item.name,
        type: currentItem.item.type,
        quantity: currentItem.item.type === 'arrow' ? currentItem.item.quantity || 1 : 1,
        stackable: currentItem.item.stackable || false
      }
    });
    
    if (addedToInventory !== false) {
      // Remove visual representation
      this.removeEquipmentVisual(equipment[slot]);
      
      // Clear equipment slot
      equipment[slot].itemId = null;
      equipment[slot].item = null;
      
      // Update stats
      this.recalculateStats(data.playerId);
      
      // Update combat system
      this.world.emit('rpg:player:equipment:changed', {
        playerId: data.playerId,
        equipment: this.getEquipmentData(data.playerId)
      });
      
      console.log(`[RPGEquipmentSystem] Player ${data.playerId} unequipped ${currentItem.item.name} from ${data.slot}`);
      this.sendMessage(data.playerId, `Unequipped ${currentItem.item.name}.`, 'info');
    } else {
      this.sendMessage(data.playerId, 'Inventory full! Cannot unequip item.', 'warning');
    }
  }

  private handleForceEquip(data: { playerId: string; item: any; slot: string }): void {
    console.log(`[RPGEquipmentSystem] Force equipping ${data.item.name} for player ${data.playerId}`);
    this.forceEquipItem(data.playerId, data.item, data.slot);
  }

  private forceEquipItem(playerId: string, itemData: any, slot: string): void {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) {
      console.warn(`[RPGEquipmentSystem] No equipment data for player ${playerId}, initializing...`);
      this.initializePlayerEquipment({ id: playerId });
      return;
    }
    
    const equipSlot = slot as keyof PlayerEquipment;
    if (equipSlot === 'playerId' || equipSlot === 'totalStats') return;
    
    equipment[equipSlot].itemId = itemData.id;
    equipment[equipSlot].item = itemData;
    
    // Create visual representation
    this.createEquipmentVisual(playerId, equipment[equipSlot]);
    
    this.recalculateStats(playerId);
    
    // Update combat system
    this.world.emit?.('rpg:player:equipment:changed', {
      playerId: playerId,
      equipment: this.getEquipmentData(playerId)
    });

    console.log(`[RPGEquipmentSystem] Force equipped ${itemData.name} to ${slot} for player ${playerId}`);
  }

  private recalculateStats(playerId: string): void {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return;
    
    // Reset stats
    equipment.totalStats = {
      attack: 0,
      strength: 0,
      defense: 0,
      ranged: 0,
      constitution: 0
    };
    
    // Add bonuses from each equipped item
    Object.values(equipment).forEach(slot => {
      if (slot && typeof slot === 'object' && 'item' in slot && slot.item) {
        const item = slot.item;
        const bonuses = item.bonuses || {};
        
        Object.keys(equipment.totalStats).forEach(stat => {
          if (bonuses[stat]) {
            equipment.totalStats[stat as keyof typeof equipment.totalStats] += bonuses[stat];
          }
        });
      }
    });
    
    // Emit stats update
    this.world.emit('rpg:player:stats:equipment_updated', {
      playerId: playerId,
      equipmentStats: equipment.totalStats
    });
    
    console.log(`[RPGEquipmentSystem] Updated stats for player ${playerId}:`, equipment.totalStats);
  }

  private getEquipmentSlot(itemData: any): string | null {
    switch (itemData.type) {
      case 'weapon':
        return itemData.weaponType === 'ranged' ? 'weapon' : 'weapon';
      case 'armor':
        return itemData.armorSlot || null;
      case 'arrow':
        return 'arrows';
      default:
        return null;
    }
  }

  private meetsLevelRequirements(playerId: string, itemData: any): boolean {
    const requirements = this.LEVEL_REQUIREMENTS[itemData.id];
    if (!requirements) return true; // No requirements
    
    // Get player skills (simplified for MVP)
    const playerSkills = this.getPlayerSkills(playerId);
    
    for (const [skill, requiredLevel] of Object.entries(requirements)) {
      const playerLevel = playerSkills[skill] || 1;
      if (playerLevel < (requiredLevel as number)) {
        return false;
      }
    }
    
    return true;
  }

  private getPlayerSkills(playerId: string): Record<string, number> {
    // Simplified for MVP - would integrate with RPGXPSystem
    return {
      attack: 10,
      strength: 10,
      defense: 10,
      ranged: 10,
      constitution: 10
    };
  }

  private playerHasItem(playerId: string, itemId: number): boolean {
    // Check with inventory system
    // Simplified for MVP
    return true; // Assume player has the item
  }

  private getItemData(itemId: string | number): any {
    // This would integrate with the item data system
    // Simplified for MVP
    const itemMap: Record<string, any> = {
      'bronze_sword': {
        id: 'bronze_sword',
        name: 'Bronze Sword',
        type: 'weapon',
        weaponType: 'melee',
        bonuses: { attack: 2, strength: 1 }
      },
      'steel_sword': {
        id: 'steel_sword', 
        name: 'Steel Sword',
        type: 'weapon',
        weaponType: 'melee',
        bonuses: { attack: 5, strength: 3 }
      },
      'mithril_sword': {
        id: 'mithril_sword',
        name: 'Mithril Sword', 
        type: 'weapon',
        weaponType: 'melee',
        bonuses: { attack: 8, strength: 5 }
      },
      'wood_bow': {
        id: 'wood_bow',
        name: 'Wood Bow',
        type: 'weapon',
        weaponType: 'ranged',
        bonuses: { ranged: 2 }
      },
      'arrows': {
        id: 'arrows',
        name: 'Arrows',
        type: 'arrow',
        stackable: true,
        quantity: 50
      }
    };
    
    return itemMap[itemId] || null;
  }

  private sendMessage(playerId: string, message: string, type: 'info' | 'warning' | 'error'): void {
    this.world.emit('rpg:ui:message', {
      playerId: playerId,
      message: message,
      type: type
    });
  }

  // Public API
  getPlayerEquipment(playerId: string): PlayerEquipment | undefined {
    return this.playerEquipment.get(playerId);
  }

  getEquipmentData(playerId: string): any {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return {};
    
    return {
      weapon: equipment.weapon.item,
      shield: equipment.shield.item,
      helmet: equipment.helmet.item,
      body: equipment.body.item,
      legs: equipment.legs.item,
      arrows: equipment.arrows.item
    };
  }

  getEquipmentStats(playerId: string): any {
    const equipment = this.playerEquipment.get(playerId);
    return equipment?.totalStats || {
      attack: 0,
      strength: 0,
      defense: 0,
      ranged: 0,
      constitution: 0
    };
  }

  isItemEquipped(playerId: string, itemId: number): boolean {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return false;
    
    return Object.values(equipment).some(slot => 
      slot && typeof slot === 'object' && 'itemId' in slot && slot.itemId === itemId
    );
  }

  canEquipItem(playerId: string, itemId: number): boolean {
    const itemData = this.getItemData(itemId);
    if (!itemData) return false;
    
    const equipSlot = this.getEquipmentSlot(itemData);
    if (!equipSlot) return false;
    
    return this.meetsLevelRequirements(playerId, itemData);
  }

  getArrowCount(playerId: string): number {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment || !equipment.arrows.item) return 0;
    
    return equipment.arrows.item.quantity || 0;
  }

  public consumeArrow(playerId: string): boolean {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment || !equipment.arrows.item) {
      console.log(`[RPGEquipmentSystem] Player ${playerId} has no arrows equipped`);
      return false;
    }
    
    if (equipment.arrows.item.quantity > 0) {
      equipment.arrows.item.quantity--;
      
      console.log(`[RPGEquipmentSystem] Consumed 1 arrow for player ${playerId}, ${equipment.arrows.item.quantity} remaining`);
      
      if (equipment.arrows.item.quantity <= 0) {
        // No arrows left - unequip
        console.log(`[RPGEquipmentSystem] Player ${playerId} ran out of arrows - unequipping`);
        equipment.arrows.itemId = null;
        equipment.arrows.item = null;
        
        // Remove visual
        if (equipment.arrows.visualMesh) {
          this.world.stage?.scene?.remove(equipment.arrows.visualMesh);
          equipment.arrows.visualMesh = undefined;
        }
        
        // Emit event to notify UI and other systems
        this.world.emit?.('rpg:combat:out_of_arrows', { playerId: playerId });
      }
      
      // Update combat system
      this.world.emit('rpg:player:equipment:changed', {
        playerId: playerId,
        equipment: this.getEquipmentData(playerId)
      });
      
      return true;
    }
    
    return false;
  }

  destroy(): void {
    this.playerEquipment.clear();
    console.log('[RPGEquipmentSystem] System destroyed');
  }

  /**
   * Create visual representation of equipped item
   */
  private createEquipmentVisual(playerId: string, slot: EquipmentSlot): void {
    if (!THREE || !slot.item) return;

    const { item } = slot;
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;

    // Create geometry based on equipment slot
    switch (slot.slot) {
      case 'helmet':
        geometry = new THREE.BoxGeometry(0.4, 0.3, 0.4);
        break;
      case 'body':
        geometry = new THREE.BoxGeometry(0.5, 0.6, 0.3);
        break;
      case 'legs':
        geometry = new THREE.BoxGeometry(0.4, 0.8, 0.3);
        break;
      case 'weapon':
        geometry = new THREE.BoxGeometry(0.1, 1.2, 0.1);
        break;
      case 'shield':
        geometry = new THREE.BoxGeometry(0.05, 0.8, 0.5);
        break;
      case 'arrows':
        geometry = new THREE.BoxGeometry(0.05, 0.6, 0.05);
        break;
      default:
        geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    }

    // Get color based on material type
    const color = this.getEquipmentColor(item);
    material = new THREE.MeshLambertMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.9
    });

    const visual = new THREE.Mesh(geometry, material);
    visual.name = `equipment_${slot.slot}_${playerId}`;
    visual.userData = {
      type: 'equipment_visual',
      playerId: playerId,
      slot: slot.slot,
      itemId: item.id
    };

    slot.visualMesh = visual;
    
    // Add to world scene
    if (this.world.stage?.scene) {
      this.world.stage.scene.add(visual);
    }

    console.log(`[RPGEquipmentSystem] Created visual for ${item.name} on player ${playerId}`);
  }

  /**
   * Remove visual representation of equipment
   */
  private removeEquipmentVisual(slot: EquipmentSlot): void {
    if (slot.visualMesh) {
      // Remove from scene
      if (slot.visualMesh.parent) {
        slot.visualMesh.parent.remove(slot.visualMesh);
      }
      slot.visualMesh = undefined;
    }
  }

  /**
   * Get equipment color based on material
   */
  private getEquipmentColor(item: any): number {
    const nameLower = item.name.toLowerCase();
    
    // Check for material types in item name
    for (const [material, color] of this.equipmentColors.entries()) {
      if (nameLower.includes(material)) {
        return color;
      }
    }

    // Default colors by slot type
    switch (item.type) {
      case 'weapon': return 0xFFFFFF; // White for weapons
      case 'armor': return 0x8B4513;  // Brown for armor
      case 'arrow': return 0xFFD700;  // Gold for arrows
      default: return 0x808080;       // Gray default
    }
  }

  /**
   * Update equipment positions to follow player avatars
   */
  private updateEquipmentPositions(): void {
    for (const [playerId, equipment] of this.playerEquipment) {
      const player = this.world.getPlayer?.(playerId);
      if (!player) continue;

      this.updatePlayerEquipmentVisuals(player, equipment);
    }
  }

  /**
   * Update equipment visuals for a specific player
   */
  private updatePlayerEquipmentVisuals(player: any, equipment: PlayerEquipment): void {
    const attachmentPoints = {
      helmet: { bone: 'head', offset: new THREE.Vector3(0, 0.1, 0) },
      body: { bone: 'spine', offset: new THREE.Vector3(0, 0, 0) },
      legs: { bone: 'hips', offset: new THREE.Vector3(0, -0.2, 0) },
      weapon: { bone: 'rightHand', offset: new THREE.Vector3(0.1, 0, 0) },
      shield: { bone: 'leftHand', offset: new THREE.Vector3(-0.1, 0, 0) },
      arrows: { bone: 'spine', offset: new THREE.Vector3(0, 0, -0.2) }
    };

    // Process each equipment slot
    Object.entries(attachmentPoints).forEach(([slotName, attachment]) => {
      const slot = equipment[slotName as keyof PlayerEquipment] as EquipmentSlot;
      if (slot?.visualMesh) {
        this.attachEquipmentToPlayer(player, slot.visualMesh, attachment.bone, attachment.offset);
      }
    });
  }

  /**
   * Attach equipment visual to player avatar bone
   */
  private attachEquipmentToPlayer(player: any, equipmentMesh: THREE.Object3D, boneName: string, offset: THREE.Vector3): void {
    try {
      // Try to get bone transform from player avatar
      const boneMatrix = player.getBoneTransform?.(boneName);
      if (boneMatrix) {
        equipmentMesh.position.setFromMatrixPosition(boneMatrix);
        equipmentMesh.quaternion.setFromRotationMatrix(boneMatrix);
        equipmentMesh.position.add(offset);
      } else {
        // Fallback: attach to player position with offset
        equipmentMesh.position.copy(player.position);
        equipmentMesh.position.add(offset);
        equipmentMesh.position.y += 1.8; // Approximate head height
      }
    } catch (error) {
      // Silent fallback to player position
      if (player.position) {
        equipmentMesh.position.copy(player.position);
        equipmentMesh.position.add(offset);
        equipmentMesh.position.y += 1.8;
      }
    }
  }


  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {
    // Update equipment visuals every frame
    this.updateEquipmentPositions();
  }
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}