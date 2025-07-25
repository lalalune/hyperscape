/**
 * BankEntity - Pure ECS Entity for RPG Bank buildings
 * Managed by RPGBankingSystem, no App framework dependencies
 */

import * as THREE from '../../core/extras/three';
import { Entity } from '../../core/entities/Entity';
import type { World, Vector3, EntityData } from '../../types';

export interface BankEntityData extends EntityData {
  bankId: string;
  townId: string;
  capacity?: number;
  interactionDistance?: number;
}

export class BankEntity extends Entity {
  // Bank-specific properties
  public readonly bankId: string;
  public readonly townId: string;
  private capacity: number;
  private interactionDistance: number;
  
  // Visual elements
  private buildingMesh: THREE.Group | null = null;
  private signMesh: THREE.Object3D | null = null;
  private chestMesh: THREE.Mesh | null = null;

  constructor(world: World, data: BankEntityData) {
    super(world, data);
    
    // Initialize bank properties per GDD requirements
    this.bankId = data.bankId;
    this.townId = data.townId;
    this.capacity = data.capacity || 1000; // Unlimited slots per GDD
    this.interactionDistance = data.interactionDistance || 3.0;
    
    // Add ECS components for bank functionality
    this.addComponent('interaction', {
      type: 'bank',
      interactable: true,
      distance: this.interactionDistance,
      prompt: 'Open Bank',
      description: 'Bank - Store and retrieve your items safely'
    });
    
    this.addComponent('banking', {
      bankId: this.bankId,
      townId: this.townId,
      capacity: this.capacity,
      isOpen: false,
      currentUser: null,
      itemStorage: new Map() // playerId -> items[]
    });
    
    this.addComponent('building', {
      type: 'bank',
      townId: this.townId,
      isPublic: true,
      operatingHours: 'always', // Banks are always open per GDD
      services: ['item_storage', 'item_retrieval']
    });
    
    // Initialize visual representation
    this.createBankBuilding();
    
    console.log(`[BankEntity] Created bank ${this.bankId} in town ${this.townId}`);
  }

  /**
   * Create the bank building's visual representation using Three.js
   */
  private async createBankBuilding(): Promise<void> {
    // Create main building group
    const bankGroup = new THREE.Group();
    bankGroup.userData.entity = this;
    bankGroup.userData.entityType = 'bank';
    bankGroup.userData.bankId = this.bankId;
    bankGroup.userData.townId = this.townId;
    
    // Main building structure (brown wooden building)
    const buildingGeometry = new THREE.BoxGeometry(4, 3, 3);
    const buildingMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x8B4513, // Brown wood
      shininess: 0,
      side: THREE.FrontSide
    });
    const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
    buildingMesh.position.y = 1.5;
    buildingMesh.castShadow = true;
    buildingMesh.receiveShadow = true;
    bankGroup.add(buildingMesh);
    
    // Bank vault/chest (symbolic storage)
    const chestGeometry = new THREE.BoxGeometry(1.5, 1, 1);
    const chestMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x4A4A4A, // Dark gray metal
      metalness: 0.8,
      roughness: 0.2
    });
    this.chestMesh = new THREE.Mesh(chestGeometry, chestMaterial);
    this.chestMesh.position.set(0, 0.5, 1.8);
    this.chestMesh.castShadow = true;
    this.chestMesh.receiveShadow = true;
    bankGroup.add(this.chestMesh);
    
    // Gold accents on vault chest
    const accentGeometry = new THREE.BoxGeometry(1.6, 0.2, 1.1);
    const accentMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xFFD700, // Gold
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x332200,
      emissiveIntensity: 0.1
    });
    const accentMesh = new THREE.Mesh(accentGeometry, accentMaterial);
    accentMesh.position.set(0, 0.9, 1.8);
    accentMesh.castShadow = true;
    bankGroup.add(accentMesh);
    
    // Bank entrance (door area)
    const doorGeometry = new THREE.BoxGeometry(1.2, 2.2, 0.1);
    const doorMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x654321, // Dark brown
      shininess: 10
    });
    const doorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
    doorMesh.position.set(0, 1.1, 1.55);
    bankGroup.add(doorMesh);
    
    // Create bank sign
    this.createBankSign(bankGroup);
    
    // Create interaction area marker (invisible trigger zone)
    const triggerGeometry = new THREE.CylinderGeometry(this.interactionDistance, this.interactionDistance, 0.1);
    const triggerMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      transparent: true, 
      opacity: 0, // Invisible
      visible: false
    });
    const triggerMesh = new THREE.Mesh(triggerGeometry, triggerMaterial);
    triggerMesh.position.y = 0.05;
    triggerMesh.userData.interactionTrigger = true;
    bankGroup.add(triggerMesh);
    
    this.buildingMesh = bankGroup;
    
    // Add building group to the entity's node
    this.node.add(bankGroup);

    // Add mesh component to ECS
    this.addComponent('mesh', {
      mesh: bankGroup,
      geometry: buildingGeometry,
      material: buildingMaterial,
      castShadow: true,
      receiveShadow: true
    });
  }

  /**
   * Create the bank sign with text
   */
  private createBankSign(container: THREE.Group): void {
    // Create sign background
    const signGeometry = new THREE.PlaneGeometry(2.5, 1);
    const signMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xF5F5DC, // Beige
      side: THREE.DoubleSide,
      shininess: 5
    });
    const signBackground = new THREE.Mesh(signGeometry, signMaterial);
    signBackground.position.set(0, 3.5, 1.52);
    signBackground.rotation.x = -0.1; // Slight tilt
    container.add(signBackground);
    
    // Create sign text using canvas texture
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 400;
    canvas.height = 160;
    
    // Draw sign text
    context.fillStyle = '#F5F5DC'; // Beige background
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Bank name
    context.fillStyle = '#8B4513'; // Brown text
    context.font = 'bold 36px serif';
    context.textAlign = 'center';
    context.fillText('BANK', canvas.width / 2, 60);
    
    // Town name
    context.font = '24px serif';
    context.fillText(`${this.townId.replace('_', ' ').toUpperCase()}`, canvas.width / 2, 100);
    
    // Services text
    context.font = '16px serif';
    context.fillText('Safe Item Storage', canvas.width / 2, 130);
    
    // Create sign text texture
    const signTexture = new THREE.CanvasTexture(canvas);
    const signTextMaterial = new THREE.SpriteMaterial({ 
      map: signTexture, 
      transparent: true,
      alphaTest: 0.1
    });
    const signSprite = new THREE.Sprite(signTextMaterial);
    signSprite.scale.set(2.4, 0.96, 1);
    signSprite.position.set(0, 3.5, 1.53);
    
    this.signMesh = signSprite;
    container.add(signSprite);
  }

  // Bank-specific methods that can be called by Systems

  /**
   * Open bank interface for a player
   */
  public openBank(playerId: string): boolean {
    console.log(`[BankEntity] Opening bank ${this.bankId} for player ${playerId}`);
    
    // Update banking component
    const bankingComponent = this.getComponent('banking');
    if (bankingComponent) {
      if (bankingComponent.data.currentUser && bankingComponent.data.currentUser !== playerId) {
        console.warn(`[BankEntity] Bank ${this.bankId} already in use by ${bankingComponent.data.currentUser}`);
        return false;
      }
      
      bankingComponent.data.isOpen = true;
      bankingComponent.data.currentUser = playerId;
    }
    
    // Visual feedback - chest opens slightly
    if (this.chestMesh) {
      this.chestMesh.rotation.x = -0.3; // Tilt to show "open"
    }
    
    // Emit bank opened event
    this.emit('bank-opened', {
      bankId: this.bankId,
      playerId: playerId,
      townId: this.townId
    });
    
    return true;
  }

  /**
   * Close bank interface for a player
   */
  public closeBank(playerId: string): void {
    console.log(`[BankEntity] Closing bank ${this.bankId} for player ${playerId}`);
    
    // Update banking component
    const bankingComponent = this.getComponent('banking');
    if (bankingComponent && bankingComponent.data.currentUser === playerId) {
      bankingComponent.data.isOpen = false;
      bankingComponent.data.currentUser = null;
    }
    
    // Visual feedback - chest closes
    if (this.chestMesh) {
      this.chestMesh.rotation.x = 0; // Return to closed position
    }
    
    // Emit bank closed event
    this.emit('bank-closed', {
      bankId: this.bankId,
      playerId: playerId,
      townId: this.townId
    });
  }

  /**
   * Check if player can interact with this bank
   */
  public canInteract(playerId: string, playerPosition: Vector3): boolean {
    // Check distance
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - this.position.x, 2) +
      Math.pow(playerPosition.z - this.position.z, 2)
    );
    
    if (distance > this.interactionDistance) {
      return false;
    }
    
    // Check if bank is already in use by another player
    const bankingComponent = this.getComponent('banking');
    if (bankingComponent && bankingComponent.data.currentUser && 
        bankingComponent.data.currentUser !== playerId) {
      return false;
    }
    
    return true;
  }

  /**
   * Get bank status information
   */
  public getBankStatus() {
    const bankingComponent = this.getComponent('banking');
    return {
      bankId: this.bankId,
      townId: this.townId,
      position: this.position,
      capacity: this.capacity,
      isOpen: bankingComponent?.data.isOpen || false,
      currentUser: bankingComponent?.data.currentUser || null,
      interactionDistance: this.interactionDistance
    };
  }

  /**
   * Store items for a player (called by banking system)
   */
  public storeItems(playerId: string, items: any[]): boolean {
    const bankingComponent = this.getComponent('banking');
    if (!bankingComponent) return false;
    
    // Get or create player storage
    if (!bankingComponent.data.itemStorage.has(playerId)) {
      bankingComponent.data.itemStorage.set(playerId, []);
    }
    
    const playerItems = bankingComponent.data.itemStorage.get(playerId);
    
    // Add items to storage (unlimited capacity per GDD)
    for (const item of items) {
      playerItems.push({
        ...item,
        storedAt: Date.now(),
        bankId: this.bankId
      });
    }
    
    console.log(`[BankEntity] Stored ${items.length} items for player ${playerId} in bank ${this.bankId}`);
    
    // Emit storage event
    this.emit('items-stored', {
      bankId: this.bankId,
      playerId: playerId,
      items: items,
      totalItems: playerItems.length
    });
    
    return true;
  }

  /**
   * Retrieve items for a player (called by banking system)
   */
  public retrieveItems(playerId: string, itemIds: string[]): any[] {
    const bankingComponent = this.getComponent('banking');
    if (!bankingComponent) return [];
    
    const playerItems = bankingComponent.data.itemStorage.get(playerId) || [];
    const retrievedItems: any[] = [];
    
    // Find and remove requested items
    for (const itemId of itemIds) {
      const itemIndex = playerItems.findIndex((item: any) => item.id === itemId);
      if (itemIndex !== -1) {
        const item = playerItems.splice(itemIndex, 1)[0];
        retrievedItems.push(item);
      }
    }
    
    console.log(`[BankEntity] Retrieved ${retrievedItems.length} items for player ${playerId} from bank ${this.bankId}`);
    
    // Emit retrieval event
    this.emit('items-retrieved', {
      bankId: this.bankId,
      playerId: playerId,
      items: retrievedItems,
      remainingItems: playerItems.length
    });
    
    return retrievedItems;
  }

  /**
   * Get all items stored by a player
   */
  public getPlayerItems(playerId: string): any[] {
    const bankingComponent = this.getComponent('banking');
    if (!bankingComponent) return [];
    
    return bankingComponent.data.itemStorage.get(playerId) || [];
  }

  /**
   * Clean up when entity is destroyed
   */
  public destroy(): void {
    console.log(`[BankEntity] Destroying bank entity ${this.bankId}`);
    
    // Clean up visual elements
    if (this.signMesh) {
      this.signMesh.removeFromParent();
      this.signMesh = null;
    }
    if (this.buildingMesh) {
      this.buildingMesh.removeFromParent();
      this.buildingMesh = null;
    }
    if (this.chestMesh) {
      this.chestMesh.removeFromParent();
      this.chestMesh = null;
    }
    
    // Call parent destroy
    super.destroy();
  }
}