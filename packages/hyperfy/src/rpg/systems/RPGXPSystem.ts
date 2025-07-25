import { System } from '../../core/systems/System';

export interface RPGSkills {
  attack: { level: number; xp: number };
  strength: { level: number; xp: number };
  defense: { level: number; xp: number };
  constitution: { level: number; xp: number };
  ranged: { level: number; xp: number };
  woodcutting: { level: number; xp: number };
  fishing: { level: number; xp: number };
  firemaking: { level: number; xp: number };
  cooking: { level: number; xp: number };
}

export type RPGSkillName = keyof RPGSkills;

/**
 * RPG XP System
 * Manages skill levels, XP gain, and level calculations
 */
export class RPGXPSystem extends System {
  private playerSkills = new Map<string, RPGSkills>();
  
  // RuneScape XP table - XP required for each level
  private readonly XP_TABLE: number[] = [
    0, 83, 174, 276, 388, 512, 650, 801, 969, 1154,
    1358, 1584, 1833, 2107, 2411, 2746, 3115, 3523, 3973, 4470,
    5018, 5624, 6291, 7028, 7842, 8740, 9730, 10824, 12031, 13363,
    14833, 16456, 18247, 20224, 22406, 24815, 27473, 30408, 33648, 37224,
    41171, 45529, 50339, 55649, 61512, 67983, 75127, 83014, 91721, 101333,
    111945, 123660, 136594, 150872, 166636, 184040, 203254, 224466, 247886, 273742,
    302288, 333804, 368599, 407015, 449428, 496254, 547953, 605032, 668051, 737627,
    814445, 899257, 992895, 1096278, 1210421, 1336443, 1475581, 1629200, 1798808, 1986068,
    2192818, 2421087, 2673114, 2951373, 3258594, 3597792, 3972294, 4385776, 4842295, 5346332,
    5902831, 6517253, 7195629, 7944614, 8771558, 9684577, 10692629, 11805606, 13034431, 14391160
  ];

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGXPSystem] Initializing XP system...');
    
    // Listen for XP events
    this.world.on?.('rpg:xp:gain', this.gainXP.bind(this));
    this.world.on?.('rpg:player:register', this.initializeSkills.bind(this));
    this.world.on?.('rpg:player:unregister', this.cleanupSkills.bind(this));
  }

  start(): void {
    console.log('[RPGXPSystem] XP system started');
  }

  private initializeSkills(playerData: { id: string }): void {
    const skills: RPGSkills = {
      attack: { level: 1, xp: 0 },
      strength: { level: 1, xp: 0 },
      defense: { level: 1, xp: 0 },
      constitution: { level: 10, xp: 1154 }, // Start at level 10 like RuneScape
      ranged: { level: 1, xp: 0 },
      woodcutting: { level: 1, xp: 0 },
      fishing: { level: 1, xp: 0 },
      firemaking: { level: 1, xp: 0 },
      cooking: { level: 1, xp: 0 }
    };

    this.playerSkills.set(playerData.id, skills);
    console.log(`[RPGXPSystem] Initialized skills for player: ${playerData.id}`);
    
    // Emit initial skills state
    this.emitSkillsUpdate(playerData.id);
  }

  private cleanupSkills(playerId: string): void {
    this.playerSkills.delete(playerId);
    console.log(`[RPGXPSystem] Cleaned up skills for player: ${playerId}`);
  }

  private gainXP(data: { playerId: string; skill: RPGSkillName; amount: number }): void {
    const skills = this.playerSkills.get(data.playerId);
    if (!skills) return;

    const skill = skills[data.skill];
    const oldLevel = skill.level;
    
    // Add XP
    skill.xp += data.amount;
    
    // Calculate new level
    const newLevel = this.calculateLevel(skill.xp);
    
    // Check for level up
    if (newLevel > oldLevel) {
      skill.level = newLevel;
      console.log(`[RPGXPSystem] Player ${data.playerId} leveled ${data.skill}: ${oldLevel} -> ${newLevel}`);
      
      // Emit level up event
      this.world.emit?.('rpg:skill:levelup', {
        playerId: data.playerId,
        skill: data.skill,
        oldLevel,
        newLevel,
        totalXP: skill.xp
      });
    }

    // Emit XP gain event
    this.world.emit?.('rpg:skill:xp:gained', {
      playerId: data.playerId,
      skill: data.skill,
      amount: data.amount,
      totalXP: skill.xp,
      level: skill.level
    });

    this.emitSkillsUpdate(data.playerId);
  }

  private calculateLevel(xp: number): number {
    for (let level = this.XP_TABLE.length - 1; level >= 1; level--) {
      if (xp >= this.XP_TABLE[level]) {
        return level + 1; // XP_TABLE is 0-indexed, levels are 1-indexed
      }
    }
    return 1;
  }

  private emitSkillsUpdate(playerId: string): void {
    const skills = this.playerSkills.get(playerId);
    if (skills) {
      this.world.emit?.('rpg:skills:updated', {
        playerId,
        skills
      });
    }
  }

  // Public API for apps
  getSkills(playerId: string): RPGSkills | undefined {
    return this.playerSkills.get(playerId);
  }

  getSkillLevel(playerId: string, skill: RPGSkillName): number {
    const skills = this.playerSkills.get(playerId);
    if (!skills) return 1;
    return skills[skill].level;
  }

  /**
   * Get skill data for testing and external access
   */
  getSkillData(skill: RPGSkillName): { name: string; maxLevel: number } {
    return {
      name: skill,
      maxLevel: 99 // RuneScape max level
    };
  }

  getSkillXP(playerId: string, skill: RPGSkillName): number {
    const skills = this.playerSkills.get(playerId);
    if (!skills) return 0;
    return skills[skill].xp;
  }

  getCombatLevel(playerId: string): number {
    const skills = this.playerSkills.get(playerId);
    if (!skills) return 3;

    const attack = skills.attack.level;
    const strength = skills.strength.level;
    const defense = skills.defense.level;
    const constitution = skills.constitution.level;
    const ranged = skills.ranged.level * 1.5; // Ranged counts for 1.5x

    const combatLevel = Math.floor(
      (defense + constitution + Math.floor(ranged / 2)) * 0.25 +
      Math.max(attack + strength, ranged * 2 / 3) * 0.325
    );

    return Math.max(3, combatLevel);
  }

  getXPForLevel(level: number): number {
    if (level <= 1) return 0;
    if (level > this.XP_TABLE.length) return this.XP_TABLE[this.XP_TABLE.length - 1];
    return this.XP_TABLE[level - 1];
  }

  getXPToNextLevel(playerId: string, skill: RPGSkillName): number {
    const skills = this.playerSkills.get(playerId);
    if (!skills) return 0;

    const currentXP = skills[skill].xp;
    const currentLevel = skills[skill].level;
    const nextLevelXP = this.getXPForLevel(currentLevel + 1);
    
    return Math.max(0, nextLevelXP - currentXP);
  }

  destroy(): void {
    this.playerSkills.clear();
    console.log('[RPGXPSystem] System destroyed');
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}