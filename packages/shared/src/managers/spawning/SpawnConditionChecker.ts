 
import { Entity } from '../../entities/Entity';
import { Time } from '../../systems/Time';
import type { World } from '../../types';
import { PlayerEntity } from '../../entities/PlayerEntity';
import {
  Position3D,
  Spawner
} from '../../types';
import { getEntityStats } from '../../utils/CombatUtils';

/**
 * Checks spawn conditions for spawners
 */
export class SpawnConditionChecker {
  /**
   * Check if all conditions are met for spawning
   */
  checkConditions(spawner: Spawner, world: World): boolean {
    const conditions = spawner.conditions;
    if (!conditions) return true;
    
    // Check time of day
    if (conditions.timeOfDay) {
      const currentTime = this.getTimeOfDay(world);
      const { start, end } = conditions.timeOfDay;
      
      if (start <= end) {
        if (currentTime < start || currentTime > end) return false;
      } else {
        // Handles overnight periods
        if (currentTime < start && currentTime > end) return false;
      }
    }
    
    // Check player count
    if (conditions.minPlayers !== undefined || conditions.maxPlayers !== undefined) {
      const playerCount = this.getPlayersInRange(spawner, world).length;
      
      if (conditions.minPlayers !== undefined && playerCount < conditions.minPlayers) {
        return false;
      }
      if (conditions.maxPlayers !== undefined && playerCount > conditions.maxPlayers) {
        return false;
      }
    }
    
    // Check player level
    if (conditions.playerLevel) {
      const players = this.getPlayersInRange(spawner, world);
      if (players.length === 0) return false;
      
      const avgLevel = this.getAveragePlayerLevel(players, world);
      const { min, max } = conditions.playerLevel;
      
      if (min !== undefined && avgLevel < min) return false;
      if (max !== undefined && avgLevel > max) return false;
    }
    
    // Check custom condition
    if (conditions.customCondition) {
      if (!conditions.customCondition(spawner, world)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get current time of day (0-24)
   */
  private getTimeOfDay(world: World): number {
    // Get time system from world
    const timeSystem = world.getSystem('time') as Time | undefined;
    
    if (timeSystem) {
      const gameTime = timeSystem.getTime();
      return gameTime.hour + (gameTime.minute / 60);
    }
    
    // Fallback to real time
    const now = new Date();
    return now.getHours() + (now.getMinutes() / 60);
  }
  
  /**
   * Get players in range of spawner
   */
  private getPlayersInRange(spawner: Spawner, world: World): PlayerEntity[] {
    const players: PlayerEntity[] = [];
    
    // Get all entities from world
    if (!world.entities) return players;
    
    const allEntities = world.entities.items instanceof Map 
      ? Array.from(world.entities.items.values())
      : Object.values(world.entities);
    
    // Filter by range and type
    for (const entity of allEntities) {
      // Check if entity is a player
      if (entity instanceof PlayerEntity || entity.type === 'player') {
        // Check distance
        const entityPos = this.getEntityPosition(entity);
        if (entityPos && this.isInRange(spawner.position, entityPos, spawner.activationRange)) {
          players.push(entity as PlayerEntity);
        }
      }
    }
    
    return players;
  }
  
  /**
   * Get average level of players
   */
  private getAveragePlayerLevel(players: PlayerEntity[], world: World): number {
    if (players.length === 0) return 0;
    
    let totalLevel = 0;
    let validPlayers = 0;
    
    for (const player of players) {
      // Use safe stats access from CombatUtils
      const stats = getEntityStats(world, player.id);
      if (stats && typeof stats.combatLevel === 'number') {
        totalLevel += stats.combatLevel;
        validPlayers++;
      }
    }
    
    return validPlayers > 0 ? totalLevel / validPlayers : 0;
  }
  
  /**
   * Get entity position
   */
  private getEntityPosition(entity: Entity | PlayerEntity): Position3D | null {
    if (entity instanceof Entity) {
      return {
        x: entity.position.x,
        y: entity.position.y,
        z: entity.position.z
      };
    }
    
    return null;
  }
  
  /**
   * Check if two positions are within range
   */
  private isInRange(pos1: Position3D, pos2: Position3D, range: number): boolean {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance <= range;
  }
} 