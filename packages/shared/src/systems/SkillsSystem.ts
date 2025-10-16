/**
 * SkillsSystem.ts - Skills, XP, and Leveling System
 * 
 * Implements RuneScape-style skill progression system with experience points and levels.
 * 
 * **Skills Managed:**
 * - Combat: attack, strength, defense, constitution, ranged
 * - Gathering: woodcutting, fishing
 * - Artisan: firemaking, cooking
 * 
 * **XP Calculation:**
 * Uses RuneScape XP table formula:
 * - Level 1-99 (max level)
 * - XP for level N = floor(N + 300 * 2^(N/7)) / 4
 * - Example: Level 50 requires 101,333 XP
 * 
 * **Combat Level:**
 * Calculated from combat skills:
 * - Base = 0.25 * (Defense + Constitution + Ranged/2)
 * - Melee = 0.325 * (Attack + Strength)
 * - Ranged = 0.325 * (Ranged * 1.5)
 * - Combat Level = floor(Base + max(Melee, Ranged))
 * 
 * **Features:**
 * - Automatic level-up detection
 * - XP multipliers for special conditions
 * - Skill milestones (level 50, 99, etc.)
 * - XP drop tracking for visual feedback
 * - Total level calculation (sum of all skill levels)
 * 
 * **Referenced by:** CombatSystem, ResourceSystem, ProcessingSystem, all skill-based interactions
 */

import { Entity } from '../entities/Entity';
import { SkillData, Skills } from '../types/core';
import { StatsComponent } from '../components/StatsComponent';
import { EventType } from '../types/events';
import type { World } from '../types/index';
import { SystemBase } from './SystemBase';
import { getStatsComponent, requireStatsComponent } from '../utils/ComponentUtils';

/** Skill name constants for type-safe skill references */
const Skill = {
  ATTACK: 'attack' as keyof Skills,
  STRENGTH: 'strength' as keyof Skills,
  DEFENSE: 'defense' as keyof Skills,
  RANGE: 'ranged' as keyof Skills,
  CONSTITUTION: 'constitution' as keyof Skills,
  WOODCUTTING: 'woodcutting' as keyof Skills,
  FISHING: 'fishing' as keyof Skills,
  FIREMAKING: 'firemaking' as keyof Skills,
  COOKING: 'cooking' as keyof Skills
};

import type { SkillMilestone, XPDrop } from '../types/system-interfaces';

/**
 * SkillsSystem - Experience and Level Management
 * 
 * Manages skill progression, XP grants, level-ups, and combat level calculation.
 */
export class SkillsSystem extends SystemBase {
  private static readonly MAX_LEVEL = 99;
  private static readonly MAX_XP = 200_000_000; // 200M XP cap
  private static readonly COMBAT_SKILLS: (keyof Skills)[] = [
    Skill.ATTACK, Skill.STRENGTH, Skill.DEFENSE, Skill.RANGE
  ];
  
  private xpTable: number[] = [];
  private xpDrops: XPDrop[] = [];
  private skillMilestones: Map<keyof Skills, SkillMilestone[]> = new Map();

  constructor(world: World) {
    super(world, {
      name: 'skills',
      dependencies: {
        optional: ['xp', 'combat', 'ui', 'quest']
      },
      autoCleanup: true
    });
    this.generateXPTable();
    this.setupSkillMilestones();
  }

  async init(): Promise<void> {
    // Subscribe to skill events using type-safe event system
    this.subscribe<{ attackerId: string; targetId: string; damageDealt: number; attackStyle: string }>(EventType.COMBAT_KILL, (data) => this.handleCombatKill(data));
    this.subscribe<{ entityId: string; skill: keyof Skills; xp: number }>(EventType.SKILLS_ACTION, (data) => this.handleSkillAction(data));
    this.subscribe<{ playerId: string; skill: keyof Skills; amount: number }>(EventType.SKILLS_XP_GAINED, (data) => this.handleExternalXPGain(data));
    this.subscribe(EventType.QUEST_COMPLETED, (data: { playerId: string; questId: string; rewards: { xp?: Record<keyof Skills, number> } }) => {
      this.handleQuestComplete(data);
    });
  }

  update(_deltaTime: number): void {
    // Clean up old XP drops (for UI)
    const currentTime = Date.now();
    this.xpDrops = this.xpDrops.filter(drop => 
      currentTime - drop.timestamp < 3000 // Keep for 3 seconds
    );
  }

  /**
   * Add XP internally without emitting events (used by external XP handlers)
   */
  private addXPInternal(entityId: string, skill: keyof Skills, amount: number): void {
    const entity = this.world.entities.get(entityId) as Entity;
    if (!entity) return;

    const stats = getStatsComponent(entity);
    if (!stats) {
      console.warn(`[SkillsSystem] Entity ${entityId} has no stats component. Available components:`, Array.from(entity.components.keys()));
      return;
    }

    const skillData = stats[skill] as SkillData;
    if (!skillData) {
      console.warn(`[SkillsSystem] Entity ${entityId} has no skill data for ${skill}. Stats component:`, stats);
      return;
    }

    // Apply XP modifiers (e.g., from equipment, prayers, etc.)
    const modifiedAmount = this.calculateModifiedXP(entity, skill, amount);

    // Check XP cap
    const oldXP = skillData.xp;
    const newXP = Math.min(oldXP + modifiedAmount, SkillsSystem.MAX_XP);
    const actualGain = newXP - oldXP;

    if (actualGain <= 0) return;

    // Update XP
    skillData.xp = newXP;

    // Check for level up
    const oldLevel = skillData.level;
    const newLevel = this.getLevelForXP(newXP);

    if (newLevel > oldLevel) {
      this.handleLevelUp(entity, skill, oldLevel, newLevel);
    }

    // Update combat level if it's a combat skill
    if (SkillsSystem.COMBAT_SKILLS.includes(skill as keyof Skills)) {
      this.updateCombatLevel(entity, stats);
    }

    // Update total level
    this.updateTotalLevel(entity, stats);

    // Add XP drop for UI
    this.xpDrops.push({
      entityId,
      playerId: entityId,
      skill,
      amount: actualGain,
      timestamp: Date.now(),
      position: { x: 0, y: 0, z: 0 } // Position not used for non-visual drops
    });

    // Emit skills updated event for UI (but not XP_GAINED to avoid loops)
    this.emitTypedEvent(EventType.SKILLS_UPDATED, {
      playerId: entityId,
      skills: this.getSkills(entityId) || {}
    });
  }

  /**
   * Grant XP to a specific skill
   */
  public grantXP(entityId: string, skill: keyof Skills, amount: number): void {
    const entity = this.world.entities.get(entityId) as Entity;
    if (!entity) return;

    const stats = getStatsComponent(entity);
    if (!stats) {
      console.warn(`[SkillsSystem] Entity ${entityId} has no stats component. Available components:`, Array.from(entity.components.keys()));
      return;
    }

    const skillData = stats[skill] as SkillData;
    if (!skillData) {
      console.warn(`[SkillsSystem] Entity ${entityId} has no skill data for ${skill}. Stats component:`, stats);
      return;
    }

    // Apply XP modifiers (e.g., from equipment, prayers, etc.)
    const modifiedAmount = this.calculateModifiedXP(entity, skill, amount);

    // Check XP cap
    const oldXP = skillData.xp;
    const newXP = Math.min(oldXP + modifiedAmount, SkillsSystem.MAX_XP);
    const actualGain = newXP - oldXP;

    if (actualGain <= 0) return;

    // Update XP
    skillData.xp = newXP;

    // Check for level up
    const oldLevel = skillData.level;
    const newLevel = this.getLevelForXP(newXP);

    if (newLevel > oldLevel) {
      this.handleLevelUp(entity, skill, oldLevel, newLevel);
    }

    // Update combat level if it's a combat skill
    if (SkillsSystem.COMBAT_SKILLS.includes(skill as keyof Skills)) {
      this.updateCombatLevel(entity, stats);
    }

    // Update total level
    this.updateTotalLevel(entity, stats);

    // Add XP drop for UI
    this.xpDrops.push({
      entityId,
      playerId: entityId,
      skill,
      amount: actualGain,
      timestamp: Date.now(),
      position: { x: 0, y: 0, z: 0 } // Position not used for non-visual drops
    });

    // Emit XP gained event
    this.emitTypedEvent(EventType.SKILLS_XP_GAINED, {
      playerId: entityId,
      skill,
      amount: actualGain
    });

    // Emit skills updated event for UI
    this.emitTypedEvent(EventType.SKILLS_UPDATED, {
      playerId: entityId,
      skills: this.getSkills(entityId) || {}
    });
  }

  /**
   * Get the level for a given amount of XP
   */
  public getLevelForXP(xp: number): number {
    for (let level = SkillsSystem.MAX_LEVEL; level >= 1; level--) {
      if (xp >= this.xpTable[level]) {
        return level;
      }
    }
    return 1;
  }

  /**
   * Get the XP required for a specific level
   */
  public getXPForLevel(level: number): number {
    if (level < 1) return 0;
    if (level > SkillsSystem.MAX_LEVEL) return this.xpTable[SkillsSystem.MAX_LEVEL];
    return this.xpTable[level];
  }

  /**
   * Get XP remaining to next level
   */
  public getXPToNextLevel(skill: SkillData): number {
    if (skill.level >= SkillsSystem.MAX_LEVEL) return 0;
    
    const nextLevelXP = this.getXPForLevel(skill.level + 1);
    return nextLevelXP - skill.xp;
  }

  /**
   * Get XP progress percentage to next level
   */
  public getXPProgress(skill: SkillData): number {
    if (skill.level >= SkillsSystem.MAX_LEVEL) return 100;
    
    const currentLevelXP = this.getXPForLevel(skill.level);
    const nextLevelXP = this.getXPForLevel(skill.level + 1);
    const progressXP = skill.xp - currentLevelXP;
    const requiredXP = nextLevelXP - currentLevelXP;
    
    return (progressXP / requiredXP) * 100;
  }

  /**
   * Check if entity meets skill requirements
   */
  public meetsRequirements(entity: Entity, requirements: Partial<Record<keyof Skills, number>>): boolean {
    const stats = getStatsComponent(entity);
    if (!stats) return false;

    for (const [skill, requiredLevel] of Object.entries(requirements)) {
      const skillData = stats[skill as keyof Skills] as SkillData;
      if (!skillData) return false;
      if (skillData.level < (requiredLevel ?? 0)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get combat level for an entity
   */
  public getCombatLevel(stats: StatsComponent): number {
    // RuneScape combat level formula
    // Extract levels from stats
    const defenseLevel = stats.defense?.level ?? 1;
    const hitpointsLevel = stats.constitution?.level ?? 10;
    const prayerLevel = stats.prayer?.level ?? 1;
    const attackLevel = stats.attack?.level ?? 1;
    const strengthLevel = stats.strength?.level ?? 1;
    const rangedLevel = stats.ranged?.level ?? 1;
    const magicLevel = stats.magic?.level ?? 1;
    
    const base = 0.25 * (
      defenseLevel + 
      hitpointsLevel + 
      Math.floor(prayerLevel / 2)
    );
    
    const melee = 0.325 * (attackLevel + strengthLevel);
    const rangedCalc = 0.325 * Math.floor(rangedLevel * 1.5);
    const magicCalc = 0.325 * Math.floor(magicLevel * 1.5);
    
    return Math.floor(base + Math.max(melee, rangedCalc, magicCalc));
  }

  /**
   * Get total level (sum of all skill levels)
   */
  public getTotalLevel(stats: StatsComponent): number {
    let total = 0;
    
    // Sum all skill levels
    const skills: (keyof Skills)[] = [
      Skill.ATTACK, Skill.STRENGTH, Skill.DEFENSE, Skill.RANGE, 
      Skill.CONSTITUTION, Skill.WOODCUTTING, Skill.FISHING,
      Skill.FIREMAKING, Skill.COOKING
    ];

    for (const skill of skills) {
      const skillData = stats[skill] as SkillData;
      total += skillData.level;
    }

    return total;
  }

  /**
   * Get total XP across all skills
   */
  public getTotalXP(stats: StatsComponent): number {
    let total = 0;
    
    const skills: (keyof Skills)[] = [
      Skill.ATTACK, Skill.STRENGTH, Skill.DEFENSE, Skill.RANGE, 
      Skill.CONSTITUTION, Skill.WOODCUTTING, Skill.FISHING,
      Skill.FIREMAKING, Skill.COOKING
    ];

    for (const skill of skills) {
      const skillData = stats[skill] as SkillData;
      total += skillData.xp;
    }

    return total;
  }

  /**
   * Reset a skill to level 1
   */
  public resetSkill(entityId: string, skill: keyof Skills): void {
    const entity = this.world.entities.get(entityId) as Entity;
    if (!entity) return;

    const stats = getStatsComponent(entity);
    if (!stats) {
      console.warn(`[SkillsSystem] Entity ${entityId} has no stats component. Available components:`, Array.from(entity.components.keys()));
      return;
    }

    const skillData = stats[skill] as SkillData;
    if (!skillData) {
      console.warn(`[SkillsSystem] Entity ${entityId} has no skill data for ${skill}. Stats component:`, stats);
      return;
    }

    skillData.level = 1;
    skillData.xp = 0;

    // Update combat level if needed
    if (SkillsSystem.COMBAT_SKILLS.includes(skill as keyof Skills)) {
      this.updateCombatLevel(entity, stats);
    }

    this.updateTotalLevel(entity, stats);

    this.emitTypedEvent(EventType.SKILLS_RESET, {
      entityId,
      skill
    });
  }

  /**
   * Set skill level directly (for admin commands)
   */
  public setSkillLevel(entityId: string, skill: keyof Skills, level: number): void {
    if (level < 1 || level > SkillsSystem.MAX_LEVEL) {
      console.warn(`Invalid level ${level} for skill ${skill}`);
      return;
    }

    const entity = this.world.entities.get(entityId) as Entity;
    if (!entity) return;

    const stats = getStatsComponent(entity);
    if (!stats) {
      console.warn(`[SkillsSystem] Entity ${entityId} has no stats component. Available components:`, Array.from(entity.components.keys()));
      return;
    }
    
    const skillData = stats[skill] as SkillData;
    if (!skillData) {
      console.warn(`[SkillsSystem] Entity ${entityId} has no skill data for ${skill}. Stats component:`, stats);
      return;
    }

    const oldLevel = skillData.level;
    skillData.level = level;
    skillData.xp = this.getXPForLevel(level);

    if (level > oldLevel) {
      this.handleLevelUp(entity, skill, oldLevel, level);
    }

    // Update combat level if needed
    if (SkillsSystem.COMBAT_SKILLS.includes(skill as keyof Skills)) {
      this.updateCombatLevel(entity, stats);
    }

    this.updateTotalLevel(entity, stats);
  }

  private generateXPTable(): void {
    this.xpTable = [0, 0]; // Levels 0 and 1
    
    for (let level = 2; level <= SkillsSystem.MAX_LEVEL; level++) {
      const xp = Math.floor(
        (level - 1) + 300 * Math.pow(2, (level - 1) / 7)
      ) / 4;
      this.xpTable.push(Math.floor(this.xpTable[level - 1] + xp));
    }
  }

  private setupSkillMilestones(): void {
    // Define special milestones for each skill
    const commonMilestones: SkillMilestone[] = [
      { level: 50, name: 'Halfway', message: 'Halfway to mastery!', reward: null },
      { level: 92, name: 'Half XP', message: 'Halfway to 99 in XP!', reward: null },
      { level: 99, name: 'Mastery', message: 'Skill mastered!', reward: null }
    ];

    // Apply common milestones to all skills
    const skills: (keyof Skills)[] = [
      Skill.ATTACK, Skill.STRENGTH, Skill.DEFENSE, Skill.RANGE, 
      Skill.CONSTITUTION, Skill.WOODCUTTING, Skill.FISHING,
      Skill.FIREMAKING, Skill.COOKING
    ];

    for (const skill of skills) {
      this.skillMilestones.set(skill, [...commonMilestones]);
    }

    // Add skill-specific milestones
    const combatMilestones = this.skillMilestones.get(Skill.ATTACK)!;
    combatMilestones.push(
      { level: 40, name: 'Rune Weapons', message: 'You can now wield rune weapons!', reward: null },
      { level: 60, name: 'Dragon Weapons', message: 'You can now wield dragon weapons!', reward: null }
    );
  }

  private handleLevelUp(entity: Entity, skill: keyof Skills, oldLevel: number, newLevel: number): void {
    // This method is only called after verifying stats exists in grantXP and setSkillLevel
    const stats = requireStatsComponent(entity, 'SkillsSystem.handleLevelUp');

    const skillData = stats[skill] as SkillData;
    if (!skillData) {
      console.warn(`[SkillsSystem] Entity ${entity.id} has no skill data for ${skill} in handleLevelUp. Stats component:`, stats);
      return;
    }
    
    skillData.level = newLevel;

    // Check for milestones
    const milestones = this.skillMilestones.get(skill) ?? [];
    for (const milestone of milestones) {
      if (milestone.level > oldLevel && milestone.level <= newLevel) {
        this.emitTypedEvent(EventType.SKILLS_MILESTONE, {
          entityId: entity.id,
          skill,
          milestone
        });
      }
    }

    // Special handling for HP level up
    if (skill === Skill.CONSTITUTION) {
      // Update hitpoints max
      const newMax = this.calculateMaxHitpoints(newLevel);
      stats.health.max = newMax;
      // If current HP is higher than new max, cap it
      stats.health.current = Math.min(stats.health.current, newMax);
    }

    // Special handling for Prayer level up - skipping for MVP
    // Prayer is not in our current Skill enum

    this.emitTypedEvent(EventType.SKILLS_LEVEL_UP, {
      entityId: entity.id,
      skill,
      oldLevel,
      newLevel,
      totalLevel: stats.totalLevel
    });
  }

  private calculateMaxHitpoints(level: number): number {
    // RuneScape formula: 10 + level
    return 10 + level;
  }

  private updateCombatLevel(entity: Entity, stats: StatsComponent): void {
    const oldCombatLevel = stats.combatLevel;
    const newCombatLevel = this.getCombatLevel(stats);

    if (newCombatLevel !== oldCombatLevel) {
      stats.combatLevel = newCombatLevel;
      
      this.emitTypedEvent(EventType.COMBAT_LEVEL_CHANGED, {
        entityId: entity.id,
        oldLevel: oldCombatLevel,
        newLevel: newCombatLevel
      });
    }
  }

  private updateTotalLevel(entity: Entity, stats: StatsComponent): void {
    const oldTotalLevel = stats.totalLevel;
    const newTotalLevel = this.getTotalLevel(stats);

    if (newTotalLevel !== oldTotalLevel) {
      stats.totalLevel = newTotalLevel;
      
      this.emitTypedEvent(EventType.TOTAL_LEVEL_CHANGED, {
        entityId: entity.id,
        oldLevel: oldTotalLevel,
        newLevel: newTotalLevel
      });
    }
  }

  private calculateModifiedXP(entity: Entity, skill: keyof Skills, baseXP: number): number {
    const modifier = 1.0;

    // Note: inventory component access reserved for future XP bonus calculations
    
    return Math.floor(baseXP * modifier);
  }

  // Event handlers
  private handleCombatKill(data: { 
    attackerId: string; 
    targetId: string; 
    damageDealt: number;
    attackStyle: string;
  }): void {
    const { attackerId, targetId, attackStyle } = data;
    
    const target = this.world.entities.get(targetId) as Entity;
    if (!target) return;

    const targetStats = getStatsComponent(target);
    if (!targetStats) return;

    // Calculate XP based on target's hitpoints
    const baseXP = (targetStats.health?.max ?? 10) * 4; // 4 XP per hitpoint
    
    // Grant XP based on attack style
    switch (attackStyle) {
      case 'accurate':
        this.grantXP(attackerId, Skill.ATTACK, baseXP);
        break;
      case 'aggressive':
        this.grantXP(attackerId, Skill.STRENGTH, baseXP);
        break;
      case 'defensive':
        this.grantXP(attackerId, Skill.DEFENSE, baseXP);
        break;
      case 'controlled':
        // Split XP between attack, strength, and defense
        this.grantXP(attackerId, Skill.ATTACK, baseXP / 3);
        this.grantXP(attackerId, Skill.STRENGTH, baseXP / 3);
        this.grantXP(attackerId, Skill.DEFENSE, baseXP / 3);
        break;
      case 'ranged':
        this.grantXP(attackerId, Skill.RANGE, baseXP);
        break;
      case 'magic':
        // Magic is not in our current Skill enum, skip for MVP
        break;
    }

    // Always grant Constitution XP
    this.grantXP(attackerId, Skill.CONSTITUTION, baseXP / 3);
  }

  private handleSkillAction(data: {
    entityId: string;
    skill: keyof Skills;
    xp: number;
  }): void {
    this.grantXP(data.entityId, data.skill, data.xp);
  }

  private handleExternalXPGain(data: {
    playerId: string;
    skill: keyof Skills;
    amount: number;
  }): void {
    // Handle XP gained from other systems (ResourceSystem, ProcessingSystem, etc.)
    // Use private method to avoid event loop
    this.addXPInternal(data.playerId, data.skill, data.amount);
  }

  private handleQuestComplete(data: {
    playerId: string;
    questId: string;
    rewards: {
      xp?: Record<keyof Skills, number>;
    };
  }): void {
    if (!data.rewards.xp) return;

    for (const [skill, xp] of Object.entries(data.rewards.xp)) {
      this.grantXP(data.playerId, skill as keyof Skills, xp);
    }
  }

  // Public getters
  public getXPDrops(): XPDrop[] {
    return [...this.xpDrops];
  }

  public getSkillData(entityId: string, skill: keyof Skills): SkillData | undefined {
    const entity = this.world.entities.get(entityId) as Entity;
    if (!entity) return undefined;

    const stats = getStatsComponent(entity);
    if (!stats) return undefined;
    
    return stats[skill] as SkillData;
  }

  public getSkills(entityId: string): Skills | undefined {
    const entity = this.world.entities.get(entityId) as Entity;
    if (!entity) return undefined;

    const stats = getStatsComponent(entity);
    if (!stats) return undefined;

    // Extract only the skill data from stats component
    const skills: Skills = {
      attack: stats.attack ?? { level: 1, xp: 0 },
      strength: stats.strength ?? { level: 1, xp: 0 },
      defense: stats.defense ?? { level: 1, xp: 0 },
      constitution: stats.constitution ?? { level: 1, xp: 0 },
      ranged: stats.ranged ?? { level: 1, xp: 0 },
      woodcutting: stats.woodcutting ?? { level: 1, xp: 0 },
      fishing: stats.fishing ?? { level: 1, xp: 0 },
      firemaking: stats.firemaking ?? { level: 1, xp: 0 },
      cooking: stats.cooking ?? { level: 1, xp: 0 }
    };

    return skills;
  }

  destroy(): void {
    // Clear XP drops for UI
    this.xpDrops.length = 0;
    
    // Clear skill milestones
    this.skillMilestones.clear();
    
    // Clear XP table
    this.xpTable.length = 0;
    
    // Event cleanup is handled by parent SystemBase destroy method
    
    // Call parent cleanup
    super.destroy();
  }
} 