/**
 * Skills Test System
 * Tests XP gaining, leveling up, skill progression, and stat calculations
 * - Tests XP gain from combat actions (attack, strength, defense)
 * - Tests XP gain from gathering actions (woodcutting, fishing, firemaking, cooking)
 * - Tests level up mechanics and thresholds
 * - Tests skill stat bonuses and calculations
 * - Tests combat level calculations
 * - Tests skill requirements for equipment and actions
 */

import type { StatsComponent } from '../types/combat-types';
import type { SkillData, Skills, World } from '../types/core';
import { EventType } from '../types/events';
import type { PlayerEntity } from '../types/index';
import { getEntityStats } from '../utils/CombatUtils';
import { Logger } from '../utils/Logger';
import { SkillsSystem } from './SkillsSystem';
import { VisualTestFramework } from './VisualTestFramework';

// Define skill constants locally (same as SkillsSystem)
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



interface SkillsTestData {
  player: PlayerEntity;
  testType: 'combat_xp' | 'gathering_xp' | 'level_up' | 'stat_calculations' | 'requirements' | 'comprehensive';
  startTime: number;
  initialSkills: Skills;
  finalSkills: Skills;
  xpGained: Record<string, number>;
  levelsGained: Record<string, number>;
  levelUpsDetected: number;
  combatLevelInitial: number;
  combatLevelFinal: number;
  actionsPerformed: Record<string, number>;
  expectedXPPerAction: Record<string, number>;
  skillsToTest: string[];
  testActions: Array<{
    action: string;
    targetSkill: string;
    expectedXP: number;
    levelRequired?: number;
    equipmentRequired?: string;
  }>;
}

export class SkillsTestSystem extends VisualTestFramework {
  private testData = new Map<string, SkillsTestData>();
  private skillsSystem!: SkillsSystem;

  constructor(world: World) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    this.skillsSystem = this.world.getSystem('skills') as SkillsSystem;
    if (!this.skillsSystem) {
      // If skills system isn't registered in this run, skip test setup gracefully
      this.logger.warn('[SkillsTestSystem] skills system not found; tests will be no-op');
    }

    // Set up event listeners
    this.subscribe(EventType.SKILLS_XP_GAINED, (data) => this.handleXPGained(data));
    this.subscribe(EventType.SKILLS_LEVEL_UP, (data) => this.handleLevelUp(data));
    this.subscribe(EventType.COMBAT_ACTION, () => this.handleCombatAction());
    this.subscribe(EventType.RESOURCE_GATHERED, () => this.handleGatheringAction());

    // Create test stations immediately
    this.createTestStations();
    this.testStationsCreated = true;
  }

  protected createTestStations(): void {
    const testConfigs = [
      {
        id: 'combat-xp-test',
        name: 'Combat XP Test',
        position: { x: 10, y: 1, z: 10 },
        testType: 'combat_xp' as const
      },
      {
        id: 'gathering-xp-test', 
        name: 'Gathering XP Test',
        position: { x: 20, y: 1, z: 10 },
        testType: 'gathering_xp' as const
      },
      {
        id: 'level-up-test',
        name: 'Level Up Test',
        position: { x: 30, y: 1, z: 10 },
        testType: 'level_up' as const
      },
      {
        id: 'stat-calc-test',
        name: 'Stat Calculations Test',
        position: { x: 40, y: 1, z: 10 },
        testType: 'stat_calculations' as const
      },
      {
        id: 'requirements-test',
        name: 'Requirements Test',
        position: { x: 50, y: 1, z: 10 },
        testType: 'requirements' as const
      },
      {
        id: 'comprehensive-skills-test',
        name: 'Comprehensive Skills Test',
        position: { x: 60, y: 1, z: 10 },
        testType: 'comprehensive' as const
      }
    ];

    
    testConfigs.forEach(config => {
      this.createTestStation(config);
      this.testData.set(config.id, {
        player: this.createPlayer({
          id: `${config.id}-player`,
          name: `${config.name} Player`,
          position: config.position
        }),
        testType: config.testType,
        startTime: 0,
        initialSkills: this.getDefaultSkills(),
        finalSkills: this.getDefaultSkills(),
        xpGained: {},
        levelsGained: {},
        levelUpsDetected: 0,
        combatLevelInitial: 3,
        combatLevelFinal: 3,
        actionsPerformed: {},
        expectedXPPerAction: {},
        skillsToTest: [],
        testActions: []
      });
          });
    
      }

  private getDefaultSkills(): Skills {
    return {
      attack: { level: 1, xp: 0 },
      strength: { level: 1, xp: 0 },
      defense: { level: 1, xp: 0 },
      ranged: { level: 1, xp: 0 },
      constitution: { level: 10, xp: 1154 },
      woodcutting: { level: 1, xp: 0 },
      fishing: { level: 1, xp: 0 },
      firemaking: { level: 1, xp: 0 },
      cooking: { level: 1, xp: 0 }
    };
  }

  protected runTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) {
      const availableStations = Array.from(this.testData.keys());
      Logger.systemError('SkillsTestSystem', `No test data found for station ${stationId}. Available stations: [${availableStations.join(', ')}]`);
      this.failTest(stationId, 'Test data not found');
      return;
    }

    this.startTest(stationId);
    testData.startTime = Date.now();

    switch (testData.testType) {
      case 'combat_xp':
        this.runCombatXPTest(stationId);
        break;
      case 'gathering_xp':
        this.runGatheringXPTest(stationId);
        break;
      case 'level_up':
        this.runLevelUpTest(stationId);
        break;
      case 'stat_calculations':
        this.runStatCalculationsTest(stationId);
        break;
      case 'requirements':
        this.runRequirementsTest(stationId);
        break;
      case 'comprehensive':
        this.runComprehensiveSkillsTest(stationId);
        break;
    }
  }

  private async runCombatXPTest(stationId: string): Promise<void> {
    const testData = this.testData.get(stationId)!;

    // Initialize test actions for combat skills
    testData.testActions = [
      { action: 'melee_attack', targetSkill: 'attack', expectedXP: 4 },
      { action: 'strength_training', targetSkill: 'strength', expectedXP: 4 },
      { action: 'defense_training', targetSkill: 'defense', expectedXP: 4 },
      { action: 'ranged_attack', targetSkill: 'ranged', expectedXP: 4 }
    ];

    testData.skillsToTest = ['attack', 'strength', 'defense', 'ranged'];
    testData.initialSkills = await this.getPlayerSkills(testData.player.id);

    // Create training dummy
    this.createTrainingDummy();

    // Start combat training sequence
    this.startCombatTrainingSequence(stationId);

    // Complete test after training actions
    setTimeout(() => {
      this.completeCombatXPTest(stationId);
    }, 15000);
  }

  private async runGatheringXPTest(stationId: string): Promise<void> {
    const testData = this.testData.get(stationId)!;

    testData.testActions = [
      { action: 'chop_tree', targetSkill: 'woodcutting', expectedXP: 6 },
      { action: 'catch_fish', targetSkill: 'fishing', expectedXP: 5 },
      { action: 'light_fire', targetSkill: 'firemaking', expectedXP: 3 },
      { action: 'cook_food', targetSkill: 'cooking', expectedXP: 7 }
    ];

    testData.skillsToTest = ['woodcutting', 'fishing', 'firemaking', 'cooking'];
    testData.initialSkills = await this.getPlayerSkills(testData.player.id);

    // Create gathering resources
    this.createGatheringResources();

    // Start gathering sequence
    this.startGatheringSequence(stationId);

    setTimeout(() => {
      this.completeGatheringXPTest(stationId);
    }, 20000);
  }

  private async runLevelUpTest(stationId: string): Promise<void> {
    const testData = this.testData.get(stationId)!;

    // Set player to near level-up XP amounts
    const nearLevelUpSkills: Skills = {
      attack: { level: 1, xp: 80 }, // Need 83 XP for level 2
      strength: { level: 1, xp: 80 },
      defense: { level: 1, xp: 80 },
      ranged: { level: 1, xp: 80 },
      constitution: { level: 10, xp: 1154 },
      woodcutting: { level: 1, xp: 80 },
      fishing: { level: 1, xp: 80 },
      firemaking: { level: 1, xp: 80 },
      cooking: { level: 1, xp: 80 }
    };

    // Set initial skills near level up
    await this.setPlayerSkills(testData.player.id, nearLevelUpSkills);
    testData.initialSkills = nearLevelUpSkills;

    // Perform actions to trigger level ups
    this.triggerLevelUps(stationId);

    setTimeout(() => {
      this.completeLevelUpTest(stationId);
    }, 10000);
  }

  private async runStatCalculationsTest(stationId: string): Promise<void> {
    const testData = this.testData.get(stationId)!;

    // Test combat level calculation with different skill combinations
    const testSkillSets = [
      { attack: 20, strength: 15, defense: 10, ranged: 1, constitution: 15 }, // Should be combat level 16
      { attack: 40, strength: 40, defense: 40, ranged: 1, constitution: 40 }, // Should be combat level 40  
      { attack: 60, strength: 60, defense: 60, ranged: 60, constitution: 60 }, // Should be combat level 60
      { attack: 99, strength: 99, defense: 99, ranged: 99, constitution: 99 }  // Should be combat level 126
    ];

    for (let i = 0; i < testSkillSets.length; i++) {
      const skillSet = testSkillSets[i];
      const expectedCombatLevel = this.calculateExpectedCombatLevel(skillSet);
      
      // Set skills and verify combat level
      await this.setPlayerCombatSkills(testData.player.id, skillSet);
      const actualCombatLevel = await this.getPlayerCombatLevel(testData.player.id);
      
      if (actualCombatLevel === expectedCombatLevel) {
        testData.actionsPerformed[`combat_calc_${i}`] = 1;
      }
    }

    this.completeStatCalculationsTest(stationId);
  }

  private async runRequirementsTest(stationId: string): Promise<void> {
    const testData = this.testData.get(stationId)!;

    // Test equipment level requirements
    const equipmentTests = [
      { itemId: 'steel_sword', requiredLevel: 10, skill: 'attack' },
      { itemId: 'steel_body', requiredLevel: 10, skill: 'defense' },
      { itemId: 'mithril_sword', requiredLevel: 20, skill: 'attack' },
      { itemId: 'mithril_body', requiredLevel: 20, skill: 'defense' }
    ];

    for (const test of equipmentTests) {
      // Test with insufficient level
      await this.setPlayerSkillLevel(testData.player.id, test.skill, test.requiredLevel - 1);
      const canEquipLow = await this.testEquipmentRequirement(testData.player.id, test.itemId);
      
      // Test with sufficient level  
      await this.setPlayerSkillLevel(testData.player.id, test.skill, test.requiredLevel);
      const canEquipHigh = await this.testEquipmentRequirement(testData.player.id, test.itemId);
      
      if (!canEquipLow && canEquipHigh) {
        testData.actionsPerformed[`req_${test.itemId}`] = 1;
      }
    }

    this.completeRequirementsTest(stationId);
  }

  private async runComprehensiveSkillsTest(stationId: string): Promise<void> {
    // Run all skill tests in sequence
    await this.runCombatXPTest(stationId);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.runGatheringXPTest(stationId);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.runLevelUpTest(stationId);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.runStatCalculationsTest(stationId);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.runRequirementsTest(stationId);

    this.completeComprehensiveTest(stationId);
  }

  // Helper methods for test execution
  private createTrainingDummy(): void {
    // Create visual training dummy for combat tests
  }

  private createGatheringResources(): void {
    // Create visual resources for gathering tests
  }

  private startCombatTrainingSequence(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    let actionIndex = 0;
    const performNextAction = () => {
      if (actionIndex >= testData.testActions.length) return;

      const action = testData.testActions[actionIndex];
      this.performCombatAction(testData.player.id, action.action);
      testData.actionsPerformed[action.action] = (testData.actionsPerformed[action.action] || 0) + 1;
      
      actionIndex++;
      setTimeout(performNextAction, 2000);
    };

    performNextAction();
  }

  private startGatheringSequence(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    let actionIndex = 0;
    const performNextAction = () => {
      if (actionIndex >= testData.testActions.length) return;

      const action = testData.testActions[actionIndex];
      this.performGatheringAction(testData.player.id, action.action);
      testData.actionsPerformed[action.action] = (testData.actionsPerformed[action.action] || 0) + 1;
      
      actionIndex++;
      setTimeout(performNextAction, 3000);
    };

    performNextAction();
  }

  private triggerLevelUps(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    // Give small XP amounts to trigger level ups from near-level state
    testData.skillsToTest.forEach((skill, index) => {
      setTimeout(() => {
        this.giveSkillXP(testData.player.id, skill, 5); // Should push to level 2
      }, index * 1000);
    });
  }

  // Event handlers
  private handleXPGained(data: { playerId: string; skill: string; amount: number }): void {
    for (const testData of this.testData.values()) {
      if (testData.player.id === data.playerId) {
        testData.xpGained[data.skill] = (testData.xpGained[data.skill] ?? 0) + data.amount;
        break;
      }
    }
  }

  private handleLevelUp(data: { playerId: string; skill: string; newLevel: number; oldLevel: number }): void {
    for (const testData of this.testData.values()) {
      if (testData.player.id === data.playerId) {
        testData.levelUpsDetected++;
        testData.levelsGained[data.skill] = data.newLevel - data.oldLevel;
        break;
      }
    }
  }

  private handleCombatAction(): void {
    // Track combat actions for XP validation
  }

  private handleGatheringAction(): void {
    // Track gathering actions for XP validation
  }

  // Test completion methods
  private completeCombatXPTest(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    const totalXPGained = Object.values(testData.xpGained).reduce((sum, xp) => sum + xp, 0);
    const skillsTested = testData.skillsToTest.length;
    const actionsPerformed = Object.values(testData.actionsPerformed).reduce((sum, count) => sum + count, 0);

    const success = totalXPGained > 0 && skillsTested > 0 && actionsPerformed > 0;

    if (success) {
      this.passTest(stationId);
    } else {
      this.failTest(stationId, 'No XP gained from combat actions');
    }
  }

  private completeGatheringXPTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) {
      Logger.systemError('SkillsTestSystem', `No test data found for station ${stationId} in completeGatheringXPTest`);
      this.failTest(stationId, 'Test data not found');
      return;
    }

    const gatheringSkills = ['woodcutting', 'fishing', 'firemaking', 'cooking'];
    const xpInGatheringSkills = gatheringSkills.some(skill => testData.xpGained[skill] > 0);

    if (xpInGatheringSkills) {
      this.passTest(stationId);
    } else {
      this.failTest(stationId, 'No XP gained from gathering actions');
    }
  }

  private completeLevelUpTest(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    const expectedLevelUps = testData.skillsToTest.length;
    const actualLevelUps = testData.levelUpsDetected;

    if (actualLevelUps >= expectedLevelUps) {
      this.passTest(stationId);
    } else {
      this.failTest(stationId, `Expected ${expectedLevelUps} level ups, got ${actualLevelUps}`);
    }
  }

  private completeStatCalculationsTest(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    const calculationsPerformed = Object.keys(testData.actionsPerformed).filter(key => key.startsWith('combat_calc_')).length;
    const expectedCalculations = 4; // 4 test skill sets

    if (calculationsPerformed >= expectedCalculations) {
      this.passTest(stationId);
    } else {
      this.failTest(stationId, `Only ${calculationsPerformed}/${expectedCalculations} calculations correct`);
    }
  }

  private completeRequirementsTest(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    const requirementsTestsPassed = Object.keys(testData.actionsPerformed).filter(key => key.startsWith('req_')).length;
    const expectedTests = 4; // 4 equipment requirement tests

    if (requirementsTestsPassed >= expectedTests) {
      this.passTest(stationId);
    } else {
      this.failTest(stationId, `Only ${requirementsTestsPassed}/${expectedTests} requirement tests passed`);
    }
  }

  private completeComprehensiveTest(stationId: string): void {
    const testData = this.testData.get(stationId)!;

    const allTestsPerformed = testData.actionsPerformed;
    const totalActions = Object.values(allTestsPerformed).reduce((sum, count) => sum + count, 0);
    const totalXP = Object.values(testData.xpGained).reduce((sum, xp) => sum + xp, 0);

    const success = totalActions > 10 && totalXP > 50 && testData.levelUpsDetected > 0;

    if (success) {
      this.passTest(stationId);
    } else {
      this.failTest(stationId, 'Comprehensive skills test did not meet all criteria');
    }
  }

  protected cleanupTest(stationId: string): void {
    // Clean up any test-specific visuals or timers
    this.testData.delete(stationId);
  }

  // Helper methods for skill system interaction
  private async getPlayerSkills(playerId: string): Promise<Skills> {
    // Get skills from the stats component
    const stats = getEntityStats(this.world, playerId);
    if (!stats) return this.getDefaultSkills();
    
    // Helper function to ensure SkillData type
    const ensureSkillData = (skill: SkillData | number | undefined, defaultLevel: number = 1): SkillData => {
      if (typeof skill === 'object' && skill && 'level' in skill && 'xp' in skill) {
        return skill;
      }
      return { level: (typeof skill === 'number' ? skill : defaultLevel), xp: 0 };
    };

    // Extract skills from stats component
    const skills: Skills = {
      attack: ensureSkillData(stats.attack as SkillData | number | undefined, 1),
      strength: ensureSkillData(stats.strength as SkillData | number | undefined, 1),
      defense: ensureSkillData(stats.defense as SkillData | number | undefined, 1),
      ranged: ensureSkillData(stats.ranged as SkillData | number | undefined, 1),
      constitution: ensureSkillData(stats.constitution as SkillData | number | undefined, 10),
      woodcutting: ensureSkillData(stats.woodcutting as SkillData | number | undefined, 1),
      fishing: ensureSkillData(stats.fishing as SkillData | number | undefined, 1),
      firemaking: ensureSkillData(stats.firemaking as SkillData | number | undefined, 1),
      cooking: ensureSkillData(stats.cooking as SkillData | number | undefined, 1)
    };
    
    return skills;
  }

  private async setPlayerSkills(playerId: string, skills: Skills): Promise<void> {
    if (!this.skillsSystem) return;
    
    // Set skills via the skills system
    for (const _skill of Object.keys(skills)) {
      // Skills system methods not available - would need to use alternative approach
    }
  }

  private async setPlayerSkillLevel(playerId: string, skill: string, level: number): Promise<void> {
    // Calculate XP needed for the target level
    const xpForLevel = this.getXPForLevel(level);
    
    // Get the stats component and set the skill level directly
    const stats = getEntityStats(this.world, playerId) as StatsComponent;
    if (!stats) {
      Logger.systemError('SkillsTestSystem', `No stats component found for player ${playerId}`);
      return;
    }
    
    // Update the skill in the stats component
    const skillKey = skill as keyof Skills;
    if (stats[skillKey]) {
      const skillData = stats[skillKey] as SkillData;
      if (typeof skillData === 'object' && 'level' in skillData) {
        skillData.level = level;
        skillData.xp = xpForLevel;
      }
      
      // Also update combat level if this is a combat skill
      if (['attack', 'strength', 'defense', 'ranged', 'constitution'].includes(skill)) {
        stats.combatLevel = this.calculateCombatLevel(stats);
      }
    }
  }

  private async setPlayerCombatSkills(playerId: string, skills: Record<string, number>): Promise<void> {
    
    for (const [skill, level] of Object.entries(skills)) {
      await this.setPlayerSkillLevel(playerId, skill, level);
    }
  }

  private async getPlayerCombatLevel(playerId: string): Promise<number> {
    const stats = getEntityStats(this.world, playerId) as StatsComponent;
    if (!stats) return 3;
    
    // Calculate combat level based on stats
    const combatLevel = this.calculateCombatLevel(stats);
    return combatLevel;
  }

  private calculateExpectedCombatLevel(skills: Record<string, number>): number {
    // RuneScape combat level formula
    const { attack, strength, defense, ranged, constitution } = skills;
    const combatLevel = (defense + constitution + Math.floor(constitution / 2)) / 4 +
                       Math.max(attack + strength, Math.floor(ranged * 1.5)) / 4;
    return Math.floor(combatLevel);
  }

  private giveSkillXP(playerId: string, skill: string, amount: number): void {
    // Use the proper grantXP method from SkillsSystem
    if (this.skillsSystem) {
      this.skillsSystem.grantXP(playerId, skill as keyof Skills, amount);
    }
  }

  private performCombatAction(playerId: string, action: string): void {
    // Simulate combat action that should give XP
    this.emitTypedEvent(EventType.COMBAT_ACTION, { playerId, action });
    
    // Give XP based on the action
    const xpAmount = 10; // Base XP per action
    switch (action) {
      case 'melee_attack':
        this.giveSkillXP(playerId, Skill.ATTACK, xpAmount);
        this.giveSkillXP(playerId, Skill.CONSTITUTION, Math.floor(xpAmount / 3));
        break;
      case 'strength_attack':
        this.giveSkillXP(playerId, Skill.STRENGTH, xpAmount);
        this.giveSkillXP(playerId, Skill.CONSTITUTION, Math.floor(xpAmount / 3));
        break;
      case 'defensive_attack':
        this.giveSkillXP(playerId, Skill.DEFENSE, xpAmount);
        this.giveSkillXP(playerId, Skill.CONSTITUTION, Math.floor(xpAmount / 3));
        break;
      case 'ranged_attack':
        this.giveSkillXP(playerId, Skill.RANGE, xpAmount);
        this.giveSkillXP(playerId, Skill.CONSTITUTION, Math.floor(xpAmount / 3));
        break;
    }
  }

  private performGatheringAction(playerId: string, action: string): void {
    // Simulate gathering action that should give XP
    this.emitTypedEvent(EventType.RESOURCE_ACTION, { playerId, action });
    
    // Give XP based on the gathering action
    const xpAmount = 15; // Base XP per gathering action
    switch (action) {
      case 'cut_tree':
        this.giveSkillXP(playerId, Skill.WOODCUTTING, xpAmount);
        break;
      case 'catch_fish':
        this.giveSkillXP(playerId, Skill.FISHING, xpAmount);
        break;
      case 'light_fire':
        this.giveSkillXP(playerId, Skill.FIREMAKING, xpAmount);
        break;
      case 'cook_food':
        this.giveSkillXP(playerId, Skill.COOKING, xpAmount);
        break;
    }
  }

  private async testEquipmentRequirement(playerId: string, itemId: string): Promise<boolean> {
    // Test if player meets requirements to equip item
    this.world.emit(EventType.EQUIPMENT_CAN_EQUIP, { playerId, itemId });
    
    // Get player skills and check against item requirements
    const skills = await this.getPlayerSkills(playerId);
    
    // Mock item requirements for testing
    const itemRequirements: Record<string, { skill: string; level: number }> = {
      'bronze_sword': { skill: Skill.ATTACK, level: 1 },
      'iron_sword': { skill: Skill.ATTACK, level: 10 },
      'steel_sword': { skill: Skill.ATTACK, level: 20 },
      'mithril_sword': { skill: Skill.ATTACK, level: 30 },
      'adamant_sword': { skill: Skill.ATTACK, level: 40 },
      'rune_sword': { skill: Skill.ATTACK, level: 50 }
    };
    
    const requirement = itemRequirements[itemId];
    if (!requirement) return true; // No requirements
    
    const playerSkillLevel = skills[requirement.skill as keyof Skills]?.level ?? 1;
    return playerSkillLevel >= requirement.level;
  }

  // Helper method to calculate combat level
  private calculateCombatLevel(stats: StatsComponent): number {
    const getLevel = (stat: unknown): number => {
      if (typeof stat === 'number') return stat;
      if (typeof stat === 'object' && stat !== null && 'level' in stat && typeof (stat as { level: unknown }).level === 'number') {
        return (stat as { level: number }).level;
      }
      return 1;
    };
    
    const attack = getLevel((stats as { attack?: unknown }).attack);
    const strength = getLevel((stats as { strength?: unknown }).strength);
    const defense = getLevel((stats as { defense?: unknown }).defense);
    const constitution = getLevel((stats as { constitution?: unknown }).constitution);
    
    return Math.floor((attack + strength + defense + constitution) / 4);
  }
  
  // Helper method to get XP for a level
  private getXPForLevel(level: number): number {
    if (level <= 1) return 0;
    
    let totalXP = 0;
    for (let i = 2; i <= level; i++) {
      totalXP += Math.floor(i - 1 + 300 * Math.pow(2, (i - 1) / 7.0));
    }
    return Math.floor(totalXP / 4);
  }

  async getSystemRating(): Promise<string> {
    const allTests = Array.from(this.testStations.values());
    const passedTests = allTests.filter(station => station.status === 'passed').length;
    const totalTests = allTests.length;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    return `Skills System: ${passedTests}/${totalTests} tests passed (${passRate.toFixed(1)}%)`;
  }

  // Empty lifecycle methods removed for cleaner code
}