/**
 * NPCEntity - Non-player characters like shopkeepers, bankers, and quest givers
 */

import * as THREE from '../../core/extras/three';
import { RPGEntity, RPGEntityConfig, EntityInteractionData } from './RPGEntity';

export interface NPCEntityConfig extends RPGEntityConfig {
  npcType: 'bank' | 'store' | 'quest_giver' | 'trainer';
  npcId: string;
  dialogueLines: string[];
  services: string[];
  inventory?: {
    itemId: string;
    quantity: number;
    price: number;
  }[];
  skillsOffered?: string[];
  questsAvailable?: string[];
}

export class NPCEntity extends RPGEntity {
  public config: NPCEntityConfig;

  constructor(world: any, config: NPCEntityConfig) {
    super(world, config);
    this.config = {
      ...config,
      dialogueLines: config.dialogueLines || ['Hello there!'],
      services: config.services || []
    };
  }

  protected async onInteract(data: EntityInteractionData): Promise<void> {
    const { playerId, interactionType } = data;
    
    console.log(`[NPCEntity] Player ${playerId} interacting with ${this.config.npcType} ${this.config.npcId} (${interactionType})`);
    
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
      console.log(`[NPCEntity] NPC ${this.config.npcId} is not a store`);
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
      console.log(`[NPCEntity] NPC ${this.config.npcId} is not a bank`);
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
      console.log(`[NPCEntity] NPC ${this.config.npcId} is not a trainer`);
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
      console.log(`[NPCEntity] NPC ${this.config.npcId} is not a quest giver`);
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
    // Create basic NPC mesh
    const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
    const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    if (!this.mesh) return;
    
    // Set NPC-specific visual properties
    this.mesh.scale.set(1, 2, 1); // Human-sized
    
    // Color code by NPC type
    const meshObj = this.mesh as THREE.Mesh;
    if (meshObj.material && 'color' in meshObj.material) {
      const material = meshObj.material as THREE.MeshStandardMaterial;
      switch (this.config.npcType) {
        case 'bank':
          material.color.setHex(0x00ff00); // Green for bank
          break;
        case 'store':
          material.color.setHex(0x0000ff); // Blue for store
          break;
        case 'quest_giver':
          material.color.setHex(0xffff00); // Yellow for quest giver
          break;
        case 'trainer':
          material.color.setHex(0xff00ff); // Magenta for trainer
          break;
        default:
          material.color.setHex(0xffffff); // White default
          break;
      }
    }
  }

  public getNetworkData(): any {
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
      console.log(`[NPCEntity] Added service ${service} to NPC ${this.config.npcId}`);
    }
  }

  public removeService(service: string): void {
    if (!this.world.isServer) return;
    
    const index = this.config.services.indexOf(service);
    if (index > -1) {
      this.config.services.splice(index, 1);
      this.markNetworkDirty();
      console.log(`[NPCEntity] Removed service ${service} from NPC ${this.config.npcId}`);
    }
  }

  public updateInventory(inventory: NPCEntityConfig['inventory']): void {
    if (!this.world.isServer) return;
    
    this.config.inventory = inventory;
    this.markNetworkDirty();
    console.log(`[NPCEntity] Updated inventory for NPC ${this.config.npcId}`);
  }
}