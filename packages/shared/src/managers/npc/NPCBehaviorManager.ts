 
import type { World } from '../../types';
import { EventType } from '../../types/events';
import { NPCEntity } from '../../entities/NPCEntity';
import { PlayerEntity } from '../../entities/PlayerEntity';
import { Entity } from '../../entities/Entity';
import {
  MovementComponent,
  NPCBehavior,
  NPCComponent,
  NPCState,
  Position3D,
  StatsComponent
} from '../../types/core';
import { EntityCombatComponent } from '../../types/entities';
import { calculateDistance, getEntity } from '../../utils/EntityUtils';
// MovementSystem removed (RPG server-side). NPCs move by directly updating positions or via pathfinding.
import THREE from '../../extras/three';

const _v1 = new THREE.Vector3(0, 1, 0)

export class NPCBehaviorManager {
  private world: World;
  
  // Behavior update intervals
  private readonly BEHAVIOR_UPDATE_INTERVAL = 500; // 500ms
  private lastBehaviorUpdate: Map<string, number> = new Map();
  
  constructor(world: World) {
    this.world = world;
    // Note: Don't access systems during construction - they may not be initialized yet
  }

  /**
   * Helper to get NPC component data from entity
   */
  private getNPCData(npc: NPCEntity): NPCComponent | null {
    if (!npc.config.properties) return null;
    return npc.config.properties.npcComponent as NPCComponent || null;
  }

  /**
   * Helper to update NPC component data
   */
  private updateNPCData(npc: NPCEntity, updates: Partial<NPCComponent>): void {
    if (!npc.config.properties) {
          npc.config.properties = {
      movementComponent: null,
      combatComponent: null,
      healthComponent: null,
      visualComponent: null,
      health: {
        current: 100,
        max: 100
      },
      level: 1,
        npcComponent: {
          behavior: NPCBehavior.PATROL,
          state: NPCState.IDLE,
          currentTarget: null,
          spawnPoint: npc.config.position,
          wanderRadius: 5,
          aggroRange: 10,
          isHostile: false,
          combatLevel: 1,
          aggressionLevel: 0,
          dialogueLines: [],
          dialogue: null,
          services: []
        },
        dialogue: [],
        shopInventory: [],
        questGiver: false
      };
    }
    npc.config.properties.npcComponent = {
      ...this.getNPCData(npc),
      ...updates
    } as NPCComponent;
  }
  
  /**
   * Update NPC behavior
   */
  updateBehavior(npc: NPCEntity, _delta: number): void {
    const npcComponent = this.getNPCData(npc);
    if (!npcComponent) return;
    
    // Check if we should update behavior this frame
    const lastUpdate = this.lastBehaviorUpdate.get(npc.id) || 0;
    const now = Date.now();
    
    if (now - lastUpdate < this.BEHAVIOR_UPDATE_INTERVAL) {
      return;
    }
    
    this.lastBehaviorUpdate.set(npc.id, now);
    
    // Update based on behavior type
    switch (npcComponent.behavior) {
      case NPCBehavior.AGGRESSIVE:
        this.updateAggressiveBehavior(npc, npcComponent);
        break;
      case NPCBehavior.DEFENSIVE:
        this.updateDefensiveBehavior(npc, npcComponent);
        break;
      case NPCBehavior.PASSIVE:
        this.updatePassiveBehavior(npc, npcComponent);
        break;
      case NPCBehavior.FRIENDLY:
        this.updateFriendlyBehavior(npc, npcComponent);
        break;
      case NPCBehavior.PATROL:
        this.updatePatrolBehavior(npc, npcComponent);
        break;
      case NPCBehavior.WANDER:
        this.updateWanderBehavior(npc, npcComponent);
        break;
    }
    
    // Update movement if needed
    this.updateMovement(npc, npcComponent);
  }
  
  /**
   * Aggressive behavior - attacks players on sight
   */
  private updateAggressiveBehavior(npc: NPCEntity, npcComponent: NPCComponent): void {
    // Check current state
    if (npcComponent.state === NPCState.COMBAT) {
      // Already in combat, check if target is still valid
      if (!this.isValidTarget(npc, npcComponent.currentTarget || null)) {
        this.findNewTarget(npc, npcComponent);
      }
      return;
    }
    
    // Look for players in aggression range
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) return;
    
    const nearbyPlayers = this.getPlayersInRange(npcPos, npcComponent.aggroRange || 10);
    
    for (const player of nearbyPlayers) {
      // Check if we can attack this player
      if (this.canAttackPlayer(npc, player)) {
        const playerId = player.id;
        this.startCombat(npc, npcComponent, playerId);
        break;
      }
    }
    
    // If no targets, wander
    if (npcComponent.state === NPCState.IDLE) {
      this.startWandering(npc, npcComponent);
    }
  }
  
  /**
   * Defensive behavior - only attacks when attacked
   */
  private updateDefensiveBehavior(npc: NPCEntity, npcComponent: NPCComponent): void {
    // Check if in combat
    if (npcComponent.state === NPCState.COMBAT) {
      // Validate target
      if (!this.isValidTarget(npc, npcComponent.currentTarget)) {
        // Return to idle
        npcComponent.state = NPCState.IDLE;
        npcComponent.currentTarget = null;
      }
      return;
    }
    
    // Return to spawn point if too far
    const npcPos = this.getEntityPosition(npc);
    if (npcPos && calculateDistance(npcPos, npcComponent.spawnPoint) > npcComponent.wanderRadius * 2) {
      this.moveToPosition(npc, npcComponent.spawnPoint);
    }
  }
  
  /**
   * Passive behavior - never attacks
   */
  private updatePassiveBehavior(npc: NPCEntity, npcComponent: NPCComponent): void {
    // If being attacked, flee
    const combat = npc.config?.properties?.combatComponent as EntityCombatComponent;
    if (combat?.inCombat) {
      this.flee(npc, npcComponent);
      return;
    }
    
    // Wander peacefully
    if (npcComponent.state === NPCState.IDLE) {
      this.startWandering(npc, npcComponent);
    }
  }
  
  /**
   * Friendly behavior - interactable NPCs
   */
  private updateFriendlyBehavior(npc: NPCEntity, _npcComponent: NPCComponent): void {
    // Face nearby players
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) return;
    
    const nearbyPlayers = this.getPlayersInRange(npcPos, 5);
    if (nearbyPlayers.length > 0) {
      // Face the closest player
      const closest = this.getClosestPlayer(npcPos, nearbyPlayers);
      if (closest) {
        this.faceEntity(npc, closest);
      }
    }
  }
  
  /**
   * Patrol behavior - follows waypoints
   */
  private updatePatrolBehavior(npc: NPCEntity, npcComponent: NPCComponent): void {
    this.executePatrol(npc, npcComponent);
  }
  
  /**
   * Wander behavior - random movement
   */
  private updateWanderBehavior(npc: NPCEntity, npcComponent: NPCComponent): void {
    const movement = npc.config?.properties?.movementComponent as MovementComponent;
    if (!movement) return;
    
    // Check if we need a new destination
    if (!movement.targetPosition || this.hasReachedDestination(npc, movement)) {
      // Pick random point within wander radius
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * npcComponent.wanderRadius;
      
      const newDestination: Position3D = {
        x: npcComponent.spawnPoint.x + Math.cos(angle) * distance,
        y: npcComponent.spawnPoint.y,
        z: npcComponent.spawnPoint.z + Math.sin(angle) * distance
      };
      
      movement.targetPosition = newDestination;
      npcComponent.state = NPCState.WANDERING;
    }
  }
  
  /**
   * Update movement towards destination
   */
  private updateMovement(npc: NPCEntity, npcComponent: NPCComponent): void {
    const movement = npc.config?.properties?.movementComponent as MovementComponent;
    if (!movement || !movement.targetPosition) return;
    
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) return;
    
    // Calculate direction
    const dx = movement.targetPosition.x - npcPos.x;
    const dz = movement.targetPosition.z - npcPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    // Check if reached destination
    if (distance < 0.5) {
      movement.targetPosition = null;
      movement.isMoving = false;
      
      if (npcComponent.state === NPCState.WANDERING) {
        npcComponent.state = NPCState.IDLE;
      }
      return;
    }

    // In unified core, we move NPCs directly (or integrate with pathfinding when available)
    const entityInWorld = this.world.entities.get(npc.id)
    if (entityInWorld && entityInWorld.node?.position) {
      entityInWorld.node.position.set(movement.targetPosition.x, movement.targetPosition.y, movement.targetPosition.z)
    }
    
    movement.isMoving = true;
  }
  
  /**
   * Start combat with a target
   */
  private startCombat(npc: NPCEntity, npcComponent: NPCComponent, targetId: string): void {
    npcComponent.currentTarget = targetId;
    npcComponent.state = NPCState.COMBAT;
    
    // Emit combat start event
    this.world.emit(EventType.COMBAT_STARTED, {
      attackerId: npc.id,
      targetId: targetId
    });
  }
  
  /**
   * Find a new target
   */
  private findNewTarget(npc: NPCEntity, npcComponent: NPCComponent): void {
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) return;
    
    const nearbyPlayers = this.getPlayersInRange(npcPos, npcComponent.aggroRange);
    
    for (const player of nearbyPlayers) {
      if (this.canAttackPlayer(npc, player)) {
        npcComponent.currentTarget = player.id;
        return;
      }
    }
    
    // No valid targets
    npcComponent.currentTarget = null;
    npcComponent.state = NPCState.IDLE;
  }
  
  /**
   * Make NPC flee from danger
   */
  private flee(npc: NPCEntity, npcComponent: NPCComponent): void {
    const combat = npc.config?.properties?.combatComponent as EntityCombatComponent;
    if (!combat || !combat.combatTarget) return;
    
    const attacker = getEntity(this.world, combat.combatTarget);
    if (!attacker) return;
    
    const npcPos = this.getEntityPosition(npc);
    const attackerPos = this.getEntityPosition(attacker);
    if (!npcPos || !attackerPos) return;
    
    // Calculate flee direction (opposite of attacker)
    const dx = npcPos.x - attackerPos.x;
    const dz = npcPos.z - attackerPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance === 0) return;
    
    // Flee to a point away from attacker
    const fleeDistance = 10;
    const fleePoint: Position3D = {
      x: npcPos.x + (dx / distance) * fleeDistance,
      y: npcPos.y,
      z: npcPos.z + (dz / distance) * fleeDistance
    };
    
    this.moveToPosition(npc, fleePoint);
    npcComponent.state = NPCState.FLEEING;
  }
  
  /**
   * Move to a specific position
   */
  private moveToPosition(npc: NPCEntity, position: Position3D): void {
    const movement = npc.config?.properties?.movementComponent as MovementComponent;
    if (!movement) return;
    
    movement.targetPosition = { ...position };
    movement.isMoving = true;
  }
  
  /**
   * Make NPC face another entity
   */
  private faceEntity(npc: NPCEntity, target: Entity | Entity): void {
    const npcPos = this.getEntityPosition(npc);
    const targetPos = this.getEntityPosition(target);
    if (!npcPos || !targetPos) return;
    
    // Calculate direction to target
    const dx = targetPos.x - npcPos.x;
    const dz = targetPos.z - npcPos.z;
    
    // Calculate rotation and apply it
    const angle = Math.atan2(dz, dx);
    
    // Apply rotation to NPC
    if (npc.node) {
      npc.node.quaternion.setFromAxisAngle(_v1, angle);
    }
  }
  
  /**
   * Start wandering behavior
   */
  private startWandering(npc: NPCEntity, npcComponent: NPCComponent): void {
    // Small chance to start wandering
    if (Math.random() < 0.1) {
      npcComponent.state = NPCState.WANDERING;
      this.updateWanderBehavior(npc, npcComponent);
    }
  }
  
  /**
   * Check if target is valid
   */
  private isValidTarget(npc: NPCEntity, targetId: string | null): boolean {
    if (!targetId) return false;
    
    const target = getEntity(this.world, targetId);
    if (!target) return false;
    
    // Check if target is alive
    const stats = target.getComponent('stats') as {hitpoints?: {current?: number}} | undefined;
    if (stats?.hitpoints?.current !== undefined && stats.hitpoints.current <= 0) return false;
    
    // Check distance
    const npcPos = this.getEntityPosition(npc);
    const targetPos = this.getEntityPosition(target);
    if (!npcPos || !targetPos) return false;
    
    const distance = calculateDistance(npcPos, targetPos);
    if (distance > 20) return false; // Max chase distance
    
    return true;
  }
  
  /**
   * Check if NPC can attack player
   */
  private canAttackPlayer(npc: NPCEntity, player: PlayerEntity): boolean {
    // Check if player is alive
    const stats = player.getComponent('stats') as StatsComponent | null;
    if (stats?.health !== undefined && stats.health.current <= 0) return false;
    
    // Check combat level difference for aggression
    const npcComponent = this.getNPCData(npc);
    if (!npcComponent) return false;
    
    const playerLevel = stats?.combatLevel || 1;
    const npcLevel = npcComponent.combatLevel || 1;
    const levelDiff = playerLevel - npcLevel;
    
    // Don't attack players too high level
    const aggressionLevel = npcComponent.aggressionLevel || 1;
    if (levelDiff > aggressionLevel * 10) return false;
    
    return true;
  }
  
  /**
   * Check if reached destination
   */
  private hasReachedDestination(npc: NPCEntity, movement: MovementComponent): boolean {
    if (!movement.targetPosition) return true;
    
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) return true;
    
    const distance = calculateDistance(npcPos, movement.targetPosition);
    return distance < 0.5;
  }
  
  /**
   * Get players in range
   */
  private getPlayersInRange(position: Position3D, range: number): PlayerEntity[] {
    // Use spatial query for efficiency when available
    const nearbyEntities = this.spatialQuery(position, range);
    const players: PlayerEntity[] = [];
    
    for (const entity of nearbyEntities) {
      // PlayerEntity extends Entity and has type 'player'
      if (entity instanceof PlayerEntity || entity.type === 'player') {
        players.push(entity as PlayerEntity);
      }
    }
    
    return players;
  }
  
  /**
   * Get closest player from list
   */
  private getClosestPlayer(position: Position3D, players: PlayerEntity[]): PlayerEntity | null {
    let closest: PlayerEntity | null = null;
    let minDistance = Infinity;
    
    for (const player of players) {
      const playerPos = this.getEntityPosition(player);
      if (playerPos) {
        const distance = calculateDistance(position, playerPos);
        if (distance < minDistance) {
          minDistance = distance;
          closest = player;
        }
      }
    }
    
    return closest;
  }
  
  /**
   * Get entity position
   */
  private getEntityPosition(entity: Entity): Position3D {
    return entity.position;
  }
  

  
  /**
   * Execute patrol behavior
   */
  private executePatrol(npc: NPCEntity, npcComponent: NPCComponent): void {
    // Implementation for patrol behavior would go here
    // For now, fallback to wandering
    this.updateWanderBehavior(npc, npcComponent);
  }
  
  /**
   * Spatial query for nearby entities - simplified implementation
   */
  private spatialQuery(position: Position3D, range: number): (Entity | Entity)[] {
    const results: (Entity | Entity)[] = [];
    
    if (!this.world.entities) return results;
    
    // Get all entities and filter by distance
    const allEntities = this.world.entities.items instanceof Map 
      ? Array.from(this.world.entities.items.values())
      : Object.values(this.world.entities);
    
    for (const entity of allEntities) {
      const entityPos = this.getEntityPosition(entity);
      if (entityPos) {
        const distance = calculateDistance(position, entityPos);
        if (distance <= range) {
          results.push(entity as Entity | Entity);
        }
      }
    }
    
    return results;
  }
  
}
