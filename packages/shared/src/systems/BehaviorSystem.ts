/**
 * BehaviorSystem - Behavior Tree Execution Engine
 *
 * Executes JSON-based behavior trees for character AI.
 * Handles condition evaluation, action execution, and behavior state management.
 *
 * **Key Features**:
 * - Behavior tree execution (conditions, actions, sequences, selectors)
 * - Event-triggered behaviors (onAttacked, onPlayerNearby, onLowHealth)
 * - Blackboard for shared state between nodes
 * - Performance optimized (500ms update interval)
 *
 * **Used by**: CharacterEntity, CharacterSystem
 *
 * @public
 */

import type { World } from '../World';
import { SystemBase } from './SystemBase';
import { EventType } from '../types/events';
import type { CharacterEntity } from '../entities/CharacterEntity';
import type { Entity } from '../entities/Entity';
import type { Position3D } from '../types/core';
import type {
  BehaviorTree,
  BehaviorNode,
  BehaviorState,
  ConditionNode,
  ActionNode,
  SequenceNode,
  SelectorNode,
  BehaviorCondition,
  BehaviorAction,
  DistanceCheckCondition,
  HealthCheckCondition,
  PlayerLevelCheckCondition,
  HasQuestCondition,
  TimeOfDayCondition,
  FactionCheckCondition,
  IdleAction,
  SayAction,
  PatrolAction,
  WanderAction,
  CombatAction,
  FleeAction,
  OfferQuestAction,
  PlayAnimationAction,
  SetFlagAction
} from '../types/behavior-tree';

export class BehaviorSystem extends SystemBase {
  private behaviorStates = new Map<string, BehaviorState>();
  private readonly updateInterval: number = 500; // ms between updates
  private lastAttackers = new Map<string, string>(); // targetId -> attackerId

  constructor(world: World) {
    super(world, {
      name: 'behavior',
      dependencies: {
        required: ['entity-manager'],
        optional: ['combat', 'dialogue', 'pathfinding']
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    // Subscribe to character events
    this.subscribe(EventType.CHARACTER_SPAWNED, (data: { characterId: string; entityId: string }) => {
      this.onCharacterSpawned(data);
    });

    this.subscribe(EventType.CHARACTER_DESPAWNED, (data: { characterId: string }) => {
      this.onCharacterDespawned(data);
    });

    this.subscribe(EventType.CHARACTER_BEHAVIOR_UPDATE, (data: { characterId: string; entityId: string }) => {
      this.updateCharacterBehavior(data);
    });

    // Subscribe to combat events for behavior triggers
    this.subscribe(EventType.COMBAT_ATTACK_REQUEST, (data: { targetId: string; attackerId: string }) => {
      this.onCharacterAttacked(data);
    });

    this.subscribe(EventType.PLAYER_POSITION_UPDATED, (data: { playerId: string; position: Position3D }) => {
      this.onPlayerMoved(data);
    });
  }

  start(): void {
    // Run behavior update loop
    this.createInterval(() => {
      this.updateAllBehaviors();
    }, this.updateInterval);
  }

  // ========================================================================
  // Behavior Tree Evaluation
  // ========================================================================

  private updateAllBehaviors(): void {
    // Iterate all characters with behavior trees
    for (const [characterId, state] of this.behaviorStates) {
      const character = this.getCharacter(characterId);
      if (character && character.aiState !== 'dead') {
        this.evaluateBehaviorTree(character, state);
      }
    }
  }

  private updateCharacterBehavior(data: { characterId: string; entityId: string }): void {
    const character = this.getCharacter(data.characterId);
    const state = this.behaviorStates.get(data.characterId);

    if (character && state) {
      this.evaluateBehaviorTree(character, state);
    }
  }

  private evaluateBehaviorTree(character: CharacterEntity, state: BehaviorState): void {
    const tree = character.behaviorConfig?.mainBehavior;
    if (!tree) return;

    const currentNode = this.findNode(tree, state.currentNodeId);
    if (!currentNode) return;

    // Execute node based on type
    switch (currentNode.type) {
      case 'condition':
        this.evaluateConditionNode(character, currentNode as ConditionNode, state);
        break;
      case 'action':
        this.executeActionNode(character, currentNode as ActionNode, state);
        break;
      case 'sequence':
        this.evaluateSequenceNode(character, currentNode as SequenceNode, state);
        break;
      case 'selector':
        this.evaluateSelectorNode(character, currentNode as SelectorNode, state);
        break;
    }
  }

  private findNode(tree: BehaviorTree, nodeId: string): BehaviorNode | null {
    return tree.nodes.find(node => node.id === nodeId) || null;
  }

  // ========================================================================
  // Condition Evaluation
  // ========================================================================

  private evaluateConditionNode(
    character: CharacterEntity,
    node: ConditionNode,
    state: BehaviorState
  ): void {
    const result = this.evaluateCondition(character, node.condition);

    // Transition to next node based on result
    state.currentNodeId = result ? node.onTrue : node.onFalse;
    state.nodeHistory.push(node.id);
    state.lastEvaluationTime = Date.now();

    // Emit behavior executed event
    this.world.emit('behavior:executed', {
      characterId: character.characterId,
      nodeId: node.id,
      nodeType: 'condition',
      success: result,
      timestamp: Date.now()
    });
  }

  private evaluateCondition(
    character: CharacterEntity,
    condition: BehaviorCondition
  ): boolean {
    switch (condition.type) {
      case 'distance_check':
        return this.checkDistance(character, condition as DistanceCheckCondition);
      case 'health_check':
        return this.checkHealth(character, condition as HealthCheckCondition);
      case 'player_level_check':
        return this.checkPlayerLevel(character, condition as PlayerLevelCheckCondition);
      case 'has_quest':
        return this.checkQuest(character, condition as HasQuestCondition);
      case 'time_of_day':
        return this.checkTimeOfDay(condition as TimeOfDayCondition);
      case 'faction_check':
        return this.checkFaction(character, condition as FactionCheckCondition);
      case 'random_chance':
        return Math.random() < condition.probability;
      case 'in_combat':
        return character.aiState === 'fighting';
      default:
        return false;
    }
  }

  private checkDistance(character: CharacterEntity, condition: DistanceCheckCondition): boolean {
    const target = condition.target || 'nearest_player';
    let targetEntity: Entity | null = null;

    if (target === 'nearest_player') {
      targetEntity = this.findNearestPlayer(character);
    } else if (target === 'nearest_enemy') {
      targetEntity = this.findNearestEnemy(character);
    } else if (target === 'spawn_point') {
      // Check distance to spawn point
      const spawnPoint = character.spawnPosition;
      const distance = this.calculateDistance(character.getPosition(), spawnPoint);
      return distance <= condition.distance;
    }

    if (!targetEntity) return false;

    const distance = this.calculateDistance(
      character.getPosition(),
      targetEntity.getPosition()
    );

    return distance <= condition.distance;
  }

  private checkHealth(character: CharacterEntity, condition: HealthCheckCondition): boolean {
    const currentHealth = condition.usePercentage
      ? (character.health / character.maxHealth) * 100
      : character.health;

    switch (condition.operator) {
      case '<': return currentHealth < condition.value;
      case '>': return currentHealth > condition.value;
      case '<=': return currentHealth <= condition.value;
      case '>=': return currentHealth >= condition.value;
      case '==': return currentHealth === condition.value;
      default: return false;
    }
  }

  private checkPlayerLevel(character: CharacterEntity, condition: PlayerLevelCheckCondition): boolean {
    const nearestPlayer = this.findNearestPlayer(character);
    if (!nearestPlayer) return false;

    const playerLevel = nearestPlayer.level || 1;

    if (condition.minLevel && playerLevel < condition.minLevel) return false;
    if (condition.maxLevel && playerLevel > condition.maxLevel) return false;

    return true;
  }

  private checkQuest(character: CharacterEntity, condition: HasQuestCondition): boolean {
    // Quest checking would be handled by QuestSystem
    // For now, return false
    return false;
  }

  private checkTimeOfDay(condition: TimeOfDayCondition): boolean {
    const currentHour = new Date().getHours();
    return currentHour >= condition.startHour && currentHour <= condition.endHour;
  }

  private checkFaction(character: CharacterEntity, condition: FactionCheckCondition): boolean {
    // Simple faction check - can be expanded
    return character.faction === condition.faction;
  }

  // ========================================================================
  // Action Execution
  // ========================================================================

  private executeActionNode(
    character: CharacterEntity,
    node: ActionNode,
    state: BehaviorState
  ): void {
    this.executeAction(character, node.action);

    // Transition to next node if specified
    if (node.next) {
      state.currentNodeId = node.next;
    }

    state.nodeHistory.push(node.id);
    state.lastEvaluationTime = Date.now();

    this.world.emit('behavior:executed', {
      characterId: character.characterId,
      nodeId: node.id,
      nodeType: 'action',
      success: true,
      timestamp: Date.now()
    });
  }

  private executeAction(character: CharacterEntity, action: BehaviorAction): void {
    switch (action.type) {
      case 'idle':
        this.executeIdle(character, action as IdleAction);
        break;
      case 'say':
        this.executeSay(character, action as SayAction);
        break;
      case 'patrol':
        this.executePatrol(character, action as PatrolAction);
        break;
      case 'wander':
        this.executeWander(character, action as WanderAction);
        break;
      case 'combat':
        this.executeCombat(character, action as CombatAction);
        break;
      case 'flee':
        this.executeFlee(character, action as FleeAction);
        break;
      case 'offer_quest':
        this.executeOfferQuest(character, action as OfferQuestAction);
        break;
      case 'open_shop':
        this.executeOpenShop(character);
        break;
      case 'turn_to_player':
        this.executeTurnToPlayer(character);
        break;
      case 'play_animation':
        this.executePlayAnimation(character, action as PlayAnimationAction);
        break;
      case 'set_flag':
        this.executeSetFlag(character, action as SetFlagAction);
        break;
    }
  }

  private executeIdle(character: CharacterEntity, action: IdleAction): void {
    character.aiState = 'idle';
    character.velocity = { x: 0, y: 0, z: 0 };
  }

  private executeSay(character: CharacterEntity, action: SayAction): void {
    this.world.emit('character:say', {
      characterId: character.characterId,
      text: action.text,
      duration: action.duration || 3000,
      voiceClipId: action.voiceClipId
    });
  }

  private executePatrol(character: CharacterEntity, action: PatrolAction): void {
    character.aiState = 'moving';
    character.patrolPoints = action.points;
    character.movementType = 'patrol';
  }

  private executeWander(character: CharacterEntity, action: WanderAction): void {
    character.aiState = 'moving';
    character.wanderRadius = action.radius;
    character.movementType = 'wander';

    // Generate random wander point within radius
    const spawnPoint = character.spawnPosition;
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * action.radius;

    const targetX = spawnPoint.x + Math.cos(angle) * distance;
    const targetZ = spawnPoint.z + Math.sin(angle) * distance;

    // Store target in blackboard
    const state = this.behaviorStates.get(character.characterId)!;
    state.blackboard.wanderTarget = { x: targetX, y: spawnPoint.y, z: targetZ };
  }

  private executeCombat(character: CharacterEntity, action: CombatAction): void {
    character.aiState = 'fighting';

    let targetId: string | null = null;

    if (action.targetNearestPlayer) {
      const nearestPlayer = this.findNearestPlayer(character);
      targetId = nearestPlayer?.id || null;
    } else if (action.targetNearestEnemy) {
      const nearestEnemy = this.findNearestEnemy(character);
      targetId = nearestEnemy?.id || null;
    } else if (action.targetAttacker) {
      targetId = this.lastAttackers.get(character.id) || null;
    }

    if (targetId) {
      this.emitTypedEvent(EventType.COMBAT_ATTACK_REQUEST, {
        attackerId: character.id,
        targetId: targetId,
        attackerType: 'character',
        targetType: 'player',
        attackType: 'melee',
        position: character.getPosition()
      });

      if (action.callAllies) {
        this.callAllies(character, action.allyRadius || 10);
      }
    }
  }

  private executeFlee(character: CharacterEntity, action: FleeAction): void {
    character.aiState = 'fleeing';

    let destination: Position3D;

    switch (action.destination) {
      case 'spawn_point':
        destination = character.spawnPosition;
        break;
      case 'nearest_ally':
        const ally = this.findNearestAlly(character);
        destination = ally ? ally.getPosition() : character.spawnPosition;
        break;
      case 'safe_zone':
        destination = this.findNearestSafeZone(character);
        break;
      default:
        destination = character.spawnPosition;
    }

    const state = this.behaviorStates.get(character.characterId)!;
    state.blackboard.fleeTarget = destination;
  }

  private executeOfferQuest(character: CharacterEntity, action: OfferQuestAction): void {
    // Store quest offer in character data
    if (!character.questsOffered.includes(action.questId)) {
      character.questsOffered.push(action.questId);
    }
  }

  private executeOpenShop(character: CharacterEntity): void {
    // Shop opening is handled by character interaction
    // This just marks the character as having a shop
    if (!character.services.includes('shop')) {
      character.services.push('shop');
    }
  }

  private executeTurnToPlayer(character: CharacterEntity): void {
    const nearestPlayer = this.findNearestPlayer(character);
    if (nearestPlayer) {
      // Calculate rotation to face player
      const dx = nearestPlayer.getPosition().x - character.getPosition().x;
      const dz = nearestPlayer.getPosition().z - character.getPosition().z;
      const angle = Math.atan2(dx, dz);

      // Update character rotation
      character.node.rotation.y = angle;
    }
  }

  private executePlayAnimation(character: CharacterEntity, action: PlayAnimationAction): void {
    // Animation playing would be handled by character entity
    this.world.emit('character:play_animation', {
      characterId: character.characterId,
      animationName: action.animationName,
      loop: action.loop || false,
      duration: action.duration
    });
  }

  private executeSetFlag(character: CharacterEntity, action: SetFlagAction): void {
    const state = this.behaviorStates.get(character.characterId)!;
    state.blackboard[action.flag] = action.value;
  }

  // ========================================================================
  // Sequence & Selector Nodes
  // ========================================================================

  private evaluateSequenceNode(
    character: CharacterEntity,
    node: SequenceNode,
    state: BehaviorState
  ): void {
    // Execute children in order until one fails
    for (const childId of node.children) {
      if (!state.completedNodes.has(childId)) {
        state.currentNodeId = childId;
        return;
      }
    }

    // All children completed successfully
    state.completedNodes.clear();
    if (node.next) {
      state.currentNodeId = node.next;
    }
  }

  private evaluateSelectorNode(
    character: CharacterEntity,
    node: SelectorNode,
    state: BehaviorState
  ): void {
    // Try children in order until one succeeds
    for (const childId of node.children) {
      const childNode = this.findNode(character.behaviorConfig!.mainBehavior, childId);
      if (childNode && childNode.type === 'condition') {
        const result = this.evaluateCondition(character, (childNode as ConditionNode).condition);
        if (result) {
          state.currentNodeId = childId;
          return;
        }
      }
    }

    // No child succeeded, go to next if specified
    if (node.next) {
      state.currentNodeId = node.next;
    }
  }

  // ========================================================================
  // Event Handlers
  // ========================================================================

  private onCharacterSpawned(data: { characterId: string; entityId: string }): void {
    const character = this.world.entities.get(data.entityId) as CharacterEntity;
    if (!character || !character.behaviorConfig) return;

    // Initialize behavior state
    this.behaviorStates.set(data.characterId, {
      currentNodeId: character.behaviorConfig.mainBehavior.rootNode,
      nodeHistory: [],
      lastEvaluationTime: Date.now(),
      completedNodes: new Set(),
      blackboard: {}
    });
  }

  private onCharacterDespawned(data: { characterId: string }): void {
    this.behaviorStates.delete(data.characterId);

    // Clean up any references
    for (const [key, value] of this.lastAttackers.entries()) {
      if (key.includes(data.characterId) || value.includes(data.characterId)) {
        this.lastAttackers.delete(key);
      }
    }
  }

  private onCharacterAttacked(data: { targetId: string; attackerId: string }): void {
    // Track last attacker for targetAttacker behavior
    this.lastAttackers.set(data.targetId, data.attackerId);

    const character = this.world.entities.get(data.targetId) as CharacterEntity;
    if (!character || !character.behaviorConfig?.onAttacked) return;

    // Switch to onAttacked behavior tree
    const state = this.behaviorStates.get(character.characterId);
    if (state) {
      state.currentNodeId = character.behaviorConfig.onAttacked.rootNode;
      state.blackboard.lastAttacker = data.attackerId;
    }
  }

  private onPlayerMoved(data: { playerId: string; position: Position3D }): void {
    // Check if any characters have onPlayerNearby behavior
    for (const [characterId, state] of this.behaviorStates) {
      const character = this.getCharacter(characterId);
      if (character && character.behaviorConfig?.onPlayerNearby) {
        const distance = this.calculateDistance(character.getPosition(), data.position);
        const triggerDistance = 5; // Default 5 meters

        if (distance <= triggerDistance) {
          state.currentNodeId = character.behaviorConfig.onPlayerNearby.rootNode;
          state.blackboard.nearbyPlayer = data.playerId;
        }
      }
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private getCharacter(characterId: string): CharacterEntity | null {
    for (const entity of this.world.entities.values()) {
      if ((entity as CharacterEntity).characterId === characterId) {
        return entity as CharacterEntity;
      }
    }
    return null;
  }

  private findNearestPlayer(character: CharacterEntity): Entity | null {
    let nearest: Entity | null = null;
    let minDistance = Infinity;

    for (const entity of this.world.entities.values()) {
      if (entity.isPlayer) {
        const distance = this.calculateDistance(
          character.getPosition(),
          entity.getPosition()
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearest = entity;
        }
      }
    }

    return nearest;
  }

  private findNearestEnemy(character: CharacterEntity): Entity | null {
    let nearest: Entity | null = null;
    let minDistance = Infinity;

    for (const entity of this.world.entities.values()) {
      const otherCharacter = entity as CharacterEntity;
      if (otherCharacter.characterId && otherCharacter.faction !== character.faction) {
        const distance = this.calculateDistance(
          character.getPosition(),
          entity.getPosition()
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearest = entity;
        }
      }
    }

    return nearest;
  }

  private findNearestAlly(character: CharacterEntity): Entity | null {
    let nearest: Entity | null = null;
    let minDistance = Infinity;

    for (const entity of this.world.entities.values()) {
      const otherCharacter = entity as CharacterEntity;
      if (otherCharacter.characterId &&
          otherCharacter.faction === character.faction &&
          otherCharacter.id !== character.id) {
        const distance = this.calculateDistance(
          character.getPosition(),
          entity.getPosition()
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearest = entity;
        }
      }
    }

    return nearest;
  }

  private findNearestSafeZone(character: CharacterEntity): Position3D {
    // For now, return spawn point as safe zone
    return character.spawnPosition;
  }

  private callAllies(character: CharacterEntity, radius: number): void {
    for (const entity of this.world.entities.values()) {
      const ally = entity as CharacterEntity;
      if (ally.characterId &&
          ally.faction === character.faction &&
          ally.id !== character.id) {
        const distance = this.calculateDistance(
          character.getPosition(),
          ally.getPosition()
        );

        if (distance <= radius) {
          // Trigger ally's onAllyDied or combat behavior
          const state = this.behaviorStates.get(ally.characterId);
          if (state && ally.behaviorConfig?.mainBehavior) {
            // Find combat node and switch to it
            const combatNode = ally.behaviorConfig.mainBehavior.nodes.find(
              node => node.type === 'action' && (node as ActionNode).action.type === 'combat'
            );

            if (combatNode) {
              state.currentNodeId = combatNode.id;
            }
          }
        }
      }
    }
  }

  private calculateDistance(pos1: Position3D, pos2: Position3D): number {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
      Math.pow(pos1.y - pos2.y, 2) +
      Math.pow(pos1.z - pos2.z, 2)
    );
  }

  destroy(): void {
    this.behaviorStates.clear();
    this.lastAttackers.clear();
    super.destroy();
  }
}
