


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

  async init(): Promise<void> {
    await super.init();
    
    // CRITICAL: Register for update loop (client only - NPCs don't need server updates)
    if (this.world.isClient) {
      this.world.setHot(this, true);
    }
  }

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

  /**
   * Setup idle animation for NPCs (usually a subtle idle loop)
   */
  private setupIdleAnimation(animations: THREE.AnimationClip[]): void {
    if (!this.mesh || animations.length === 0) return;
    
    // Find the SkinnedMesh to apply animation to
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    this.mesh.traverse((child) => {
      if (!skinnedMesh && (child as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMesh = child as THREE.SkinnedMesh;
      }
    });
    
    if (!skinnedMesh) {
      console.warn(`[NPCEntity] No SkinnedMesh found in model for animations`);
      return;
    }
    
    // Create AnimationMixer
    const mixer = new THREE.AnimationMixer(skinnedMesh);
    
    // Find idle or walking animation
    const idleClip = animations.find(clip => 
      clip.name.toLowerCase().includes('idle') || clip.name.toLowerCase().includes('standing')
    ) || animations.find(clip =>
      clip.name.toLowerCase().includes('walk')
    ) || animations[0];
    
    const action = mixer.clipAction(idleClip);
    action.play();
    
    
    // Store mixer on entity for update in clientUpdate
    (this as { mixer?: THREE.AnimationMixer }).mixer = mixer;
  }
  
  /**
   * Update animation mixer each frame
   */
  private updateAnimations(deltaTime: number): void {
    const mixer = (this as { mixer?: THREE.AnimationMixer }).mixer;
    if (mixer) {
      // Update the mixer (advances animation time)
      mixer.update(deltaTime);
      
      // CRITICAL: Update skeleton (exactly like VRM does!)
      // This actually moves the bones to match the animation
      if (this.mesh) {
        this.mesh.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            // Update each bone matrix WITHOUT forcing parent recalc
            child.skeleton.bones.forEach(bone => bone.updateMatrixWorld());
          }
        });
      }
    }
  }

  protected async createMesh(): Promise<void> {
    if (this.world.isServer) {
      return;
    }
    
    // Try to load 3D model if available (same approach as ItemEntity/ResourceEntity)
    if (this.config.model && this.world.loader) {
      try {
        const { scene, animations } = await modelCache.loadModel(this.config.model, this.world);
        
        this.mesh = scene;
        this.mesh.name = `NPC_${this.config.npcType}_${this.id}`;
        
        // CRITICAL: Scale the root mesh transform, then bind skeleton
        const modelScale = 100; // cm to meters
        this.mesh.scale.set(modelScale, modelScale, modelScale);
        this.mesh.updateMatrix();
        this.mesh.updateMatrixWorld(true);
        
        // NOW bind the skeleton at the scaled size
        this.mesh.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            // Ensure mesh matrix is updated
            child.updateMatrix();
            child.updateMatrixWorld(true);
            
            // Bind skeleton with DetachedBindMode (like VRM)
            child.bindMode = THREE.DetachedBindMode;
            child.bindMatrix.copy(child.matrixWorld);
            child.bindMatrixInverse.copy(child.bindMatrix).invert();
          }
        });
        
        // Set up userData for interaction detection (raycasting)
        this.mesh.userData = {
          type: 'npc',
          entityId: this.id,
          name: this.config.name,
          interactable: true,
          npcType: this.config.npcType,
          services: this.config.services
        };
        
        // Add as child of node (standard approach with correct scale)
        // Position is relative to node, so keep it at origin
        this.mesh.position.set(0, 0, 0);
        this.mesh.quaternion.identity();
        this.node.add(this.mesh);
        
        // Setup animations if available (NPCs usually have idle animations)
        if (animations.length > 0) {
          this.setupIdleAnimation(animations);
        }
        
        return;
      } catch (error) {
        console.warn(`[NPCEntity] Failed to load model for ${this.config.npcType}, using placeholder:`, error);
        // Fall through to placeholder
      }
    }
    
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
    
  }

  /**
   * Update animations on client side
   */
  protected clientUpdate(deltaTime: number): void {
    super.clientUpdate(deltaTime);
    
    // Mesh is child of node, so it follows automatically
    // No manual position sync needed
    
    this.updateAnimations(deltaTime);
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
  
  /**
   * Override destroy to clean up animations
   */
  override destroy(): void {
    // Clean up animation mixer
    const mixer = (this as { mixer?: THREE.AnimationMixer }).mixer;
    if (mixer) {
      mixer.stopAllAction();
      (this as { mixer?: THREE.AnimationMixer }).mixer = undefined;
    }
    
    // Parent will handle mesh removal (mesh is child of node)
    super.destroy();
  }
}