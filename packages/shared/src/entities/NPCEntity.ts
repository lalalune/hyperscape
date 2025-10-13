/**
 * NPCEntity - Non-Player Character Entity
 * 
 * Represents friendly NPCs like shopkeepers, bankers, trainers, and quest givers.
 * NPCs provide services to players through dialogue and interaction menus.
 * 
 * **Extends**: Entity (not combatant - NPCs cannot be attacked)
 * 
 * **Key Features**:
 * 
 * **NPC Types**:
 * - **Store**: Sells and buys items (shopkeepers)
 * - **Bank**: Provides item storage (bankers)
 * - **Trainer**: Teaches skills or abilities
 * - **Quest**: Gives quests and rewards
 * - **Dialogue**: General conversation
 * 
 * **Interaction System**:
 * - Player clicks NPC to interact
 * - Opens appropriate UI based on NPC type
 * - Dialogue trees (simple or complex)
 * - Service menus (shop, bank, training)
 * 
 * **Dialogue**:
 * - Multiple dialogue lines
 * - Context-aware responses
 * - Service advertisements
 * - Quest information
 * 
 * **Shop System** (if npcType === 'store'):
 * - Inventory of items to sell
 * - Buy/sell prices
 * - Stock quantities
 * - Purchase restrictions
 * 
 * **Banking** (if npcType === 'bank'):
 * - Opens player's bank storage
 * - Deposit/withdraw items
 * - Currency storage
 * - Shared across all bank NPCs
 * 
 * **Visual Representation**:
 * - 3D model or humanoid mesh
 * - Nametag with NPC name and role
 * - NO health bar (cannot be damaged)
 * - Idle animations
 * - Interaction highlight when in range
 * 
 * **Persistence**:
 * - NPCs are defined in world configuration
 * - Position and properties persist
 * - Inventory/stock may regenerate
 * 
 * **Runs on**: Server (authoritative), Client (visual + UI)
 * **Referenced by**: NPCSystem, StoreSystem, BankingSystem, InteractionSystem
 * 
 * @public
 */

import THREE from '../extras/three';
import type { World } from '../World';
import { Entity } from './Entity';
import type { EntityInteractionData, NPCEntityConfig } from '../types/entities';
import { modelCache } from '../utils/ModelCache';
import { EventType } from '../types/events';

// Re-export types for external use
export type { NPCEntityConfig } from '../types/entities';

export class NPCEntity extends Entity {
  public config: NPCEntityConfig;

  constructor(world: World, config: NPCEntityConfig) {
    super(world, config);
    this.config = {
      ...config,
      dialogueLines: config.dialogueLines || ['Hello there!'],
      services: config.services || []
    };
    
    // NPCs don't have health bars - they're not combatants
    // Set health to 0 to prevent health bar creation
    this.health = 0;
    this.maxHealth = 0;
  }

  protected async onInteract(data: EntityInteractionData): Promise<void> {
    const { playerId, interactionType } = data;
    
    switch (interactionType) {
      case 'talk':
        this.handleTalk(playerId);
        break;
      case 'trade':
        this.handleTrade(playerId);
        break;
      case 'bank':
        this.handleBank(playerId);
        break;
      case 'train':
        this.handleTrain(playerId);
        break;
      case 'quest':
        this.handleQuest(playerId);
        break;
      default:
        this.handleTalk(playerId);
        break;
    }
  }

  private handleTalk(playerId: string): void {
    // Send dialogue to UI system
    this.world.emit(EventType.NPC_DIALOGUE, {
      playerId,
      npcId: this.config.npcId,
      npcType: this.config.npcType,
      dialogueLines: this.config.dialogueLines,
      services: this.config.services
    });
  }

  private handleTrade(playerId: string): void {
    if (this.config.npcType !== 'store') {
      return;
    }

    // Send store interface request
    this.world.emit(EventType.STORE_OPEN_REQUEST, {
      playerId,
      npcId: this.config.npcId,
      inventory: this.config.inventory || []
    });
  }

  private handleBank(playerId: string): void {
    if (this.config.npcType !== 'bank') {
      return;
    }

    // Send bank interface request
    this.world.emit(EventType.BANK_OPEN_REQUEST, {
      playerId,
      npcId: this.config.npcId
    });
  }

  private handleTrain(playerId: string): void {
    if (this.config.npcType !== 'trainer') {
      return;
    }

    // Send training interface request
    this.world.emit(EventType.NPC_TRAINER_OPEN, {
      playerId,
      npcId: this.config.npcId,
      skillsOffered: this.config.skillsOffered || []
    });
  }

  private handleQuest(playerId: string): void {
    if (this.config.npcType !== 'quest_giver') {
      return;
    }

    // Send quest interface request
    this.world.emit(EventType.NPC_QUEST_OPEN, {
      playerId,
      npcId: this.config.npcId,
      questsAvailable: this.config.questsAvailable || []
    });
  }

  protected async createMesh(): Promise<void> {
    console.log(`[NPCEntity] createMesh() called for ${this.config.npcType}`, {
      hasModelPath: !!this.config.model,
      modelPath: this.config.model,
      hasLoader: !!this.world.loader,
      isServer: this.world.isServer,
      isClient: this.world.isClient
    });
    
    if (this.world.isServer) {
      return;
    }
    
    // Try to load 3D model if available (same approach as ItemEntity/ResourceEntity)
    if (this.config.model && this.world.loader) {
      try {
        console.log(`[NPCEntity] Loading model for ${this.config.npcType}:`, this.config.model);
        const { scene } = await modelCache.loadModel(this.config.model, this.world);
        
        this.mesh = scene;
        this.mesh.name = `NPC_${this.config.npcType}_${this.id}`;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.scale.set(1, 1, 1); // Standard scale for NPCs
        
        // Set up userData for interaction detection (raycasting)
        this.mesh.userData = {
          type: 'npc',
          entityId: this.id,
          name: this.config.name,
          interactable: true,
          npcType: this.config.npcType,
          services: this.config.services
        };
        
        this.node.add(this.mesh);
        console.log(`[NPCEntity] ✅ Model loaded for ${this.config.npcType}`);
        return;
      } catch (error) {
        console.warn(`[NPCEntity] Failed to load model for ${this.config.npcType}, using placeholder:`, error);
        // Fall through to placeholder
      }
    }
    
    console.log(`[NPCEntity] Creating placeholder capsule for ${this.config.npcType}`);
    
    const geometry = new THREE.CapsuleGeometry(0.35, 1.4, 4, 8);
    const material = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = `NPC_${this.config.npcType}_${this.id}`;
    
    // CRITICAL: Set userData for interaction detection (raycasting)
    this.mesh.userData = {
      type: 'npc',
      entityId: this.id,
      name: this.config.name,
      interactable: true,
      npcType: this.config.npcType,
      services: this.config.services
    };
    
    this.mesh.scale.set(1, 2, 1);
    
    if (this.mesh instanceof THREE.Mesh && this.mesh.material) {
      if (this.mesh.material instanceof THREE.MeshStandardMaterial) {
        const meshMaterial = this.mesh.material;
        switch (this.config.npcType) {
          case 'bank':
            meshMaterial.color.setHex(0x00ff00);
            break;
          case 'store':
            meshMaterial.color.setHex(0x0000ff);
            break;
          case 'quest_giver':
            meshMaterial.color.setHex(0xffff00);
            break;
          case 'trainer':
            meshMaterial.color.setHex(0xff00ff);
            break;
          default:
            meshMaterial.color.setHex(0xffffff);
            break;
        }
      }
    }
    
    if (this.mesh) {
      this.node.add(this.mesh);
    }
    
    console.log(`[NPCEntity] ✅ Placeholder mesh created and added for ${this.config.npcType}`);
  }

  public getNetworkData(): Record<string, unknown> {
    return {
      ...super.getNetworkData(),
      npcType: this.config.npcType,
      npcId: this.config.npcId,
      services: this.config.services
    };
  }

  public addService(service: string): void {
    if (!this.world.isServer) return;
    
    if (!this.config.services.includes(service)) {
      this.config.services.push(service);
      this.markNetworkDirty();
    }
  }

  public removeService(service: string): void {
    if (!this.world.isServer) return;
    
    const index = this.config.services.indexOf(service);
    if (index > -1) {
      this.config.services.splice(index, 1);
      this.markNetworkDirty();
    }
  }

  public updateInventory(inventory: NPCEntityConfig['inventory']): void {
    if (!this.world.isServer) return;
    
    this.config.inventory = inventory;
    this.markNetworkDirty();
  }
}