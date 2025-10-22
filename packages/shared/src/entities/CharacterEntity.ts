/**
 * CharacterEntity - Unified NPC and Mob Entity
 *
 * Replaces both NPCEntity and MobEntity with a single unified class.
 * All characters can fight, talk, move, and provide services based on configuration.
 *
 * **Key Features**:
 * - **Combat**: All characters have health and can fight (if configured)
 * - **Dialogue**: Support for full dialogue trees
 * - **Movement**: Stationary, patrol, wander, or custom behaviors
 * - **Services**: Bank, shop, quest, training
 * - **Behavior Trees**: JSON-defined AI behaviors
 * - **Factions**: Friendly, hostile, neutral, guards, etc.
 *
 * **Extends**: CombatantEntity (all characters can fight)
 *
 * @public
 */

import THREE from '../extras/three';
import type { World } from '../World';
import { CombatantEntity, type CombatantConfig } from './CombatantEntity';
import type {
  EntityInteractionData,
  CharacterEntityConfig
} from '../types/entities';
import { modelCache } from '../utils/ModelCache';
import { EventType } from '../types/events';
import type {
  BehaviorTree,
  BehaviorState,
  CharacterBehaviorConfig
} from '../types/behavior-tree';
import type { DialogueTree } from '../types/core';
import type { Position3D } from '../types/index';

// Re-export types for external use
export type { CharacterEntityConfig } from '../types/entities';

/**
 * Character movement types
 */
export type MovementType = 'stationary' | 'patrol' | 'wander' | 'follow';

/**
 * Character AI states (simplified from old MobAIState)
 */
export type CharacterAIState = 'idle' | 'moving' | 'talking' | 'fighting' | 'fleeing' | 'dead';

/**
 * CharacterEntity - Unified entity for all NPCs and Mobs
 */
export class CharacterEntity extends CombatantEntity {
  public config: CharacterEntityConfig;

  // Core Identity
  public characterId: string;
  public characterType: 'npc' | 'mob' | 'neutral';
  public faction: string;

  // Dialogue System
  public dialogueTree: DialogueTree | null = null;
  public currentDialogueNode: string | null = null;

  // Behavior System
  public behaviorConfig: CharacterBehaviorConfig | null = null;
  public behaviorState: BehaviorState | null = null;

  // Movement System
  public movementType: MovementType;
  public patrolPoints: Position3D[] = [];
  public currentPatrolIndex: number = 0;
  public wanderRadius: number = 0;
  public moveSpeed: number = 0;

  // Services
  public services: Array<'bank' | 'shop' | 'quest' | 'training'> = [];
  public shopInventory: Array<{ itemId: string; quantity: number; price: number }> = [];
  public questsOffered: string[] = [];

  // AI State
  public aiState: CharacterAIState = 'idle';

  // Interaction
  public canBeAttacked: boolean = true;
  public retaliates: boolean = true;

  // Animation system
  private mixer?: THREE.AnimationMixer;
  private animationClips?: {
    idle?: THREE.AnimationClip;
    walk?: THREE.AnimationClip;
    run?: THREE.AnimationClip;
    attack?: THREE.AnimationClip;
  };
  private currentAction?: THREE.AnimationAction;

  async init(): Promise<void> {
    await super.init();

    // CRITICAL: Register for update loop
    // Server needs updates for AI behavior
    // Client needs updates for animations
    this.world.setHot(this, true);

    // Initialize behavior state if behavior tree is configured
    if (this.behaviorConfig) {
      this.behaviorState = {
        currentNodeId: this.behaviorConfig.mainBehavior.rootNode,
        nodeHistory: [],
        lastEvaluationTime: Date.now(),
        completedNodes: new Set(),
        blackboard: {}
      };
    }
  }

  constructor(world: World, config: CharacterEntityConfig) {
    // Convert CharacterEntityConfig to CombatantConfig format
    const combatConfig: CombatantConfig = {
      ...config,
      rotation: config.rotation || { x: 0, y: 0, z: 0, w: 1 },
      combat: {
        attack: config.attackPower || 10,
        defense: config.defense || 5,
        attackSpeed: config.attackSpeed || 1.0,
        criticalChance: 0.05,
        combatLevel: config.level || 1,
        respawnTime: config.respawnTime || 30000,
        aggroRadius: config.aggroRange || 10,
        attackRange: config.combatRange || 2
      }
    };

    super(world, combatConfig);
    this.config = config;

    // Core Identity
    this.characterId = config.characterId;
    this.characterType = config.characterType || 'neutral';
    this.faction = config.faction || 'neutral';

    // Dialogue
    this.dialogueTree = config.dialogueTree || null;

    // Behavior
    this.behaviorConfig = config.behaviorConfig || null;

    // Movement
    this.movementType = config.movementType || 'stationary';
    this.patrolPoints = config.patrolPoints || [];
    this.wanderRadius = config.wanderRadius || 0;
    this.moveSpeed = config.moveSpeed || 0;

    // Services
    this.services = config.services || [];
    this.shopInventory = config.shopInventory || [];
    this.questsOffered = config.questsOffered || [];

    // Combat flags
    this.canBeAttacked = config.canBeAttacked !== false; // Default true
    this.retaliates = config.retaliates !== false; // Default true

    // Set entity properties for systems to access
    this.setProperty('characterId', this.characterId);
    this.setProperty('characterType', this.characterType);
    this.setProperty('faction', this.faction);
    this.setProperty('level', config.level);
    this.setProperty('health', { current: config.currentHealth || config.maxHealth, max: config.maxHealth });
  }

  /**
   * Handle player interaction with character
   * Routes to appropriate handler based on AI state and services
   */
  protected async onInteract(data: EntityInteractionData): Promise<void> {
    const { playerId, interactionType } = data;

    // If character is in combat, handle attack
    if (interactionType === 'attack' && this.canBeAttacked) {
      this.world.emit(EventType.COMBAT_ATTACK_REQUEST, {
        attackerId: playerId,
        targetId: this.id,
        attackerType: 'player',
        targetType: 'character',
        attackType: 'melee',
        position: this.getPosition()
      });
      return;
    }

    // If character has dialogue, start dialogue
    if (interactionType === 'talk' && this.dialogueTree) {
      this.handleDialogue(playerId);
      return;
    }

    // Handle service interactions
    switch (interactionType) {
      case 'bank':
        if (this.services.includes('bank')) {
          this.handleBank(playerId);
        }
        break;
      case 'shop':
      case 'trade':
        if (this.services.includes('shop')) {
          this.handleShop(playerId);
        }
        break;
      case 'quest':
        if (this.services.includes('quest')) {
          this.handleQuest(playerId);
        }
        break;
      case 'train':
        if (this.services.includes('training')) {
          this.handleTraining(playerId);
        }
        break;
      default:
        // Default: start dialogue or show character info
        if (this.dialogueTree) {
          this.handleDialogue(playerId);
        } else {
          this.handleExamine(playerId);
        }
        break;
    }
  }

  /**
   * Start dialogue with player
   */
  private handleDialogue(playerId: string): void {
    if (!this.dialogueTree) return;

    this.aiState = 'talking';
    this.currentDialogueNode = this.dialogueTree.entryNodeId;

    this.world.emit(EventType.DIALOGUE_START, {
      characterId: this.characterId,
      playerId,
      dialogueTree: this.dialogueTree,
      entryNodeId: this.dialogueTree.entryNodeId,
      services: this.services,
      questsOffered: this.questsOffered
    });
  }

  /**
   * Open bank interface
   */
  private handleBank(playerId: string): void {
    this.world.emit(EventType.BANK_OPEN_REQUEST, {
      playerId,
      characterId: this.characterId,
      characterName: this.config.name
    });
  }

  /**
   * Open shop interface
   */
  private handleShop(playerId: string): void {
    this.world.emit(EventType.STORE_OPEN_REQUEST, {
      playerId,
      characterId: this.characterId,
      characterName: this.config.name,
      inventory: this.shopInventory
    });
  }

  /**
   * Open quest interface
   */
  private handleQuest(playerId: string): void {
    this.world.emit(EventType.NPC_QUEST_OPEN, {
      playerId,
      npcId: this.characterId,
      questsAvailable: this.questsOffered
    });
  }

  /**
   * Open training interface
   */
  private handleTraining(playerId: string): void {
    this.world.emit(EventType.NPC_TRAINER_OPEN, {
      playerId,
      npcId: this.characterId,
      skillsOffered: []
    });
  }

  /**
   * Show character information
   */
  private handleExamine(playerId: string): void {
    this.world.emit(EventType.MOB_EXAMINE, {
      playerId,
      mobId: this.id,
      mobData: {
        id: this.id,
        name: this.config.name,
        type: this.characterType,
        faction: this.faction,
        level: this.config.level,
        health: this.health,
        maxHealth: this.maxHealth,
        canBeAttacked: this.canBeAttacked
      }
    });
  }

  /**
   * Setup animations for character model
   */
  private setupAnimations(animations: THREE.AnimationClip[]): void {
    if (!this.mesh || animations.length === 0) return;

    // Find the SkinnedMesh to apply animation to
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    this.mesh.traverse((child) => {
      if (!skinnedMesh && (child as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMesh = child as THREE.SkinnedMesh;
      }
    });

    if (!skinnedMesh) {
      console.warn(`[CharacterEntity] No SkinnedMesh found in model for ${this.characterId}`);
      return;
    }

    // Create AnimationMixer on SkinnedMesh
    const mixer = new THREE.AnimationMixer(skinnedMesh);

    // Categorize animations by name
    const animationClips: { idle?: THREE.AnimationClip; walk?: THREE.AnimationClip; attack?: THREE.AnimationClip } = {};

    for (const clip of animations) {
      const nameLower = clip.name.toLowerCase();
      if (nameLower.includes('idle') || nameLower.includes('standing')) {
        animationClips.idle = clip;
      } else if (nameLower.includes('walk') || nameLower.includes('move')) {
        animationClips.walk = clip;
      } else if (nameLower.includes('attack') || nameLower.includes('hit')) {
        animationClips.attack = clip;
      }
    }

    // Default to first animation if no categorized animations found
    if (!animationClips.idle && !animationClips.walk) {
      animationClips.idle = animations[0];
    }

    // Play idle animation by default
    const initialClip = animationClips.idle || animationClips.walk || animations[0];
    const action = mixer.clipAction(initialClip);
    action.enabled = true;
    action.setEffectiveWeight(1.0);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();

    // Store mixer and clips
    this.mixer = mixer;
    this.animationClips = animationClips;
    this.currentAction = action;
  }

  /**
   * Update animation based on AI state
   */
  private updateAnimation(): void {
    if (!this.mixer || !this.animationClips) {
      return;
    }

    // Determine which animation should be playing based on AI state
    let targetClip: THREE.AnimationClip | undefined;

    if (this.aiState === 'moving') {
      // Moving states - play walk animation
      targetClip = this.animationClips.walk || this.animationClips.idle;
    } else if (this.aiState === 'fighting') {
      // Fighting - play attack animation
      targetClip = this.animationClips.attack || this.animationClips.idle;
    } else {
      // Idle, talking, fleeing, or dead - play idle animation
      targetClip = this.animationClips.idle || this.animationClips.walk;
    }

    // Switch animation if needed
    if (targetClip && this.currentAction?.getClip() !== targetClip) {
      this.currentAction?.fadeOut(0.2);

      const newAction = this.mixer.clipAction(targetClip);
      newAction.reset();
      newAction.setEffectiveWeight(1.0);
      newAction.setLoop(THREE.LoopRepeat, Infinity);
      newAction.fadeIn(0.2);
      newAction.play();

      this.currentAction = newAction;
    }
  }

  /**
   * Update animations each frame
   */
  private updateAnimations(deltaTime: number): void {
    if (this.mixer) {
      // Update the mixer (advances animation time)
      this.mixer.update(deltaTime);

      // CRITICAL: Update skeleton
      if (this.mesh) {
        this.mesh.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            // Update each bone matrix
            child.skeleton.bones.forEach(bone => bone.updateMatrixWorld());
          }
        });
      }
    }
  }

  /**
   * Create 3D mesh for character
   */
  protected async createMesh(): Promise<void> {
    if (this.world.isServer) {
      return;
    }

    // Try to load 3D model if available
    if (this.config.model && this.world.loader) {
      try {
        const { scene, animations } = await modelCache.loadModel(this.config.model, this.world);

        this.mesh = scene;
        this.mesh.name = `Character_${this.characterType}_${this.characterId}`;

        // Scale the root mesh transform
        const modelScale = 100; // cm to meters
        this.mesh.scale.set(modelScale, modelScale, modelScale);
        this.mesh.updateMatrix();
        this.mesh.updateMatrixWorld(true);

        // Bind skeleton
        this.mesh.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            child.updateMatrix();
            child.updateMatrixWorld(true);

            // Bind skeleton with DetachedBindMode
            child.bindMode = THREE.DetachedBindMode;
            child.bindMatrix.copy(child.matrixWorld);
            child.bindMatrixInverse.copy(child.bindMatrix).invert();
          }
        });

        // Set up userData for interaction detection
        this.mesh.userData = {
          type: 'character',
          entityId: this.id,
          characterId: this.characterId,
          name: this.config.name,
          interactable: true,
          characterType: this.characterType,
          faction: this.faction,
          services: this.services,
          canBeAttacked: this.canBeAttacked
        };

        // Add as child of node
        this.mesh.position.set(0, 0, 0);
        this.mesh.quaternion.identity();
        this.node.add(this.mesh);

        // Setup animations if available
        if (animations.length > 0) {
          this.setupAnimations(animations);
        }

        return;
      } catch (error) {
        console.warn(`[CharacterEntity] Failed to load model for ${this.characterId}, using placeholder:`, error);
        // Fall through to placeholder
      }
    }

    // Placeholder geometry (colored capsule based on type/faction)
    const geometry = new THREE.CapsuleGeometry(0.35, 1.4, 4, 8);

    // Color based on faction
    let color = 0xffffff;
    switch (this.faction) {
      case 'friendly':
        color = 0x00ff00; // Green
        break;
      case 'hostile':
        color = 0xff0000; // Red
        break;
      case 'neutral':
        color = 0xffff00; // Yellow
        break;
      case 'guards':
        color = 0x0000ff; // Blue
        break;
      default:
        color = 0x888888; // Gray
        break;
    }

    const material = new THREE.MeshLambertMaterial({ color });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = `Character_${this.characterType}_${this.characterId}`;

    // Set userData
    this.mesh.userData = {
      type: 'character',
      entityId: this.id,
      characterId: this.characterId,
      name: this.config.name,
      interactable: true,
      characterType: this.characterType,
      faction: this.faction,
      services: this.services,
      canBeAttacked: this.canBeAttacked
    };

    this.node.add(this.mesh);
  }

  /**
   * SERVER-SIDE UPDATE
   * Runs behavior tree and AI logic
   */
  protected serverUpdate(deltaTime: number): void {
    super.serverUpdate(deltaTime);

    // Only run AI if not dead
    if (this.aiState !== 'dead') {
      // BehaviorSystem will handle behavior tree execution
      // For now, just emit update event
      this.world.emit(EventType.CHARACTER_BEHAVIOR_UPDATE, {
        characterId: this.characterId,
        entityId: this.id,
        aiState: this.aiState,
        position: this.getPosition()
      });
    }
  }

  /**
   * CLIENT-SIDE UPDATE
   * Updates animations
   */
  protected clientUpdate(deltaTime: number): void {
    super.clientUpdate(deltaTime);

    // Update animations based on current state
    this.updateAnimation();
    this.updateAnimations(deltaTime);
  }

  /**
   * Get network data for syncing to clients
   */
  public getNetworkData(): Record<string, unknown> {
    return {
      ...super.getNetworkData(),
      characterId: this.characterId,
      characterType: this.characterType,
      faction: this.faction,
      aiState: this.aiState,
      services: this.services,
      canBeAttacked: this.canBeAttacked
    };
  }

  /**
   * Cleanup
   */
  override destroy(): void {
    // Clean up animation mixer
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = undefined;
    }

    super.destroy();
  }
}
