/**
 * NPCEntity - Non-player characters like shopkeepers, bankers, and quest givers
 */

import THREE from '../extras/three';
import type { World } from '../World';
import { Entity } from './Entity';
import type { EntityInteractionData, NPCEntityConfig } from '../types/entities';

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
    this.world.emit('npc:dialogue', {
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
    this.world.emit('store:open_request', {
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
    this.world.emit('bank:open_request', {
      playerId,
      npcId: this.config.npcId
    });
  }

  private handleTrain(playerId: string): void {
    if (this.config.npcType !== 'trainer') {
      return;
    }

    // Send training interface request
    this.world.emit('trainer:open_request', {
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
    this.world.emit('quest:open_request', {
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
      isServer: this.world.isServer
    });
    
    // SKIP 3D MODEL LOADING - Use clean capsule fallbacks
    // Prevents 404 errors until /world-assets/forge/ has actual files
    
    // No model loading - use fallback
    if (this.world.isServer) {
      return; // Don't create fallback mesh on server
    }
    
    console.log(`[NPCEntity] Creating fallback capsule for ${this.config.npcType}`);
    
    // Fallback: Create NPC capsule (human-like shape)
    const geometry = new THREE.CapsuleGeometry(0.35, 1.4, 4, 8);
    const material = new THREE.MeshLambertMaterial({ color: 0x6b4423 }); // Brown
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = `NPC_${this.config.npcType}_${this.id}`;
    
    // Set NPC-specific visual properties
    this.mesh.scale.set(1, 2, 1); // Human-sized
    
    // Color code by NPC type for easy identification
    if (this.mesh instanceof THREE.Mesh && this.mesh.material) {
      if (this.mesh.material instanceof THREE.MeshStandardMaterial) {
        const fallbackMaterial = this.mesh.material;
        switch (this.config.npcType) {
          case 'bank':
            fallbackMaterial.color.setHex(0x00ff00); // Green for bank
            break;
          case 'store':
            fallbackMaterial.color.setHex(0x0000ff); // Blue for store
            break;
          case 'quest_giver':
            fallbackMaterial.color.setHex(0xffff00); // Yellow for quest giver
            break;
          case 'trainer':
            fallbackMaterial.color.setHex(0xff00ff); // Magenta for trainer
            break;
          default:
            fallbackMaterial.color.setHex(0xffffff); // White default
            break;
        }
      }
    }
    
    // Add mesh to node so it appears in the scene
    if (this.mesh) {
      this.node.add(this.mesh);
    }
    
    console.log(`[NPCEntity] ✅ Fallback mesh created and added for ${this.config.npcType}`);
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