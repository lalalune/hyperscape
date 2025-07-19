import {
  RPGSkillsSystem,
  PlayerState,
  RPGSkill,
  SkillState,
  ItemRequirement,
  EXPERIENCE_TABLE,
  GAME_CONSTANTS,
  RPGEventEmitter,
  SkillLevelUpEvent
} from '../types/index.js'

export class RPGSkillsSystemImpl implements RPGSkillsSystem {
  public name = 'SkillsSystem'
  public initialized = false

  private players: Map<string, PlayerState> = new Map()
  private eventEmitter: RPGEventEmitter | null = null

  constructor(eventEmitter?: RPGEventEmitter) {
    this.eventEmitter = eventEmitter || null
  }

  async init(): Promise<void> {
    console.log('[SkillsSystem] Initializing skills system...')
    this.initialized = true
    console.log('[SkillsSystem] Skills system initialized')
  }

  async update(deltaTime: number): Promise<void> {
    // Skills system doesn't need per-frame updates
    // All skill operations are event-driven
  }

  async cleanup(): Promise<void> {
    console.log('[SkillsSystem] Cleaning up skills system...')
    this.players.clear()
    this.initialized = false
  }

  // ===== PUBLIC API =====

  async grantExperience(playerId: string, skill: RPGSkill, amount: number): Promise<boolean> {
    const player = this.players.get(playerId)
    if (!player) {
      console.log(`[SkillsSystem] Player ${playerId} not found`)
      return false
    }

    if (amount <= 0) {
      console.log(`[SkillsSystem] Invalid experience amount: ${amount}`)
      return false
    }

    const skillState = player.skills[skill]
    if (!skillState) {
      console.log(`[SkillsSystem] Skill ${skill} not found for player ${playerId}`)
      return false
    }

    const oldLevel = skillState.level
    const oldExperience = skillState.experience

    // Add experience
    skillState.experience += amount

    // Check for level up
    const newLevel = this.calculateLevel(skillState.experience)
    const levelledUp = newLevel > oldLevel

    if (levelledUp) {
      skillState.level = newLevel
      console.log(`[SkillsSystem] Player ${playerId} leveled up ${skill}: ${oldLevel} -> ${newLevel}`)

      // Emit level up event
      if (this.eventEmitter) {
        await this.eventEmitter.emit({
          type: 'skill:levelup',
          timestamp: Date.now(),
          data: {
            playerId,
            skill,
            newLevel,
            oldLevel
          }
        } as SkillLevelUpEvent)
      }

      // Update constitution health if constitution leveled up
      if (skill === RPGSkill.CONSTITUTION) {
        const healthIncrease = (newLevel - oldLevel) * 4 // +4 HP per constitution level
        player.health.max += healthIncrease
        player.health.current += healthIncrease
        console.log(`[SkillsSystem] Player ${playerId} health increased by ${healthIncrease} (${player.health.current}/${player.health.max})`)
      }
    }

    console.log(`[SkillsSystem] Player ${playerId} gained ${amount} ${skill} XP (${oldExperience} -> ${skillState.experience})`)
    return true
  }

  calculateLevel(experience: number): number {
    // Use RuneScape experience table
    for (let level = EXPERIENCE_TABLE.length - 1; level >= 0; level--) {
      if (experience >= EXPERIENCE_TABLE[level]) {
        return level + 1 // Levels are 1-based
      }
    }
    return 1 // Minimum level is 1
  }

  getRequiredExperience(level: number): number {
    if (level < 1) return 0
    if (level > EXPERIENCE_TABLE.length) return EXPERIENCE_TABLE[EXPERIENCE_TABLE.length - 1]
    return EXPERIENCE_TABLE[level - 1] // Convert to 0-based index
  }

  async checkLevelUp(playerId: string, skill: RPGSkill): Promise<boolean> {
    const player = this.players.get(playerId)
    if (!player) return false

    const skillState = player.skills[skill]
    if (!skillState) return false

    const currentLevel = skillState.level
    const calculatedLevel = this.calculateLevel(skillState.experience)

    return calculatedLevel > currentLevel
  }

  async meetsRequirement(playerId: string, requirement: ItemRequirement): Promise<boolean> {
    const player = this.players.get(playerId)
    if (!player) return false

    const skillState = player.skills[requirement.skill]
    if (!skillState) return false

    return skillState.level >= requirement.level
  }

  // ===== UTILITY METHODS =====

  public registerPlayer(player: PlayerState): void {
    this.players.set(player.id, player)
  }

  public unregisterPlayer(playerId: string): void {
    this.players.delete(playerId)
  }

  public getPlayerSkills(playerId: string): PlayerState['skills'] | null {
    const player = this.players.get(playerId)
    return player ? player.skills : null
  }

  public getSkillLevel(playerId: string, skill: RPGSkill): number | null {
    const player = this.players.get(playerId)
    return player ? player.skills[skill].level : null
  }

  public getSkillExperience(playerId: string, skill: RPGSkill): number | null {
    const player = this.players.get(playerId)
    return player ? player.skills[skill].experience : null
  }

  public getTotalLevel(playerId: string): number | null {
    const player = this.players.get(playerId)
    if (!player) return null

    let totalLevel = 0
    for (const skillState of Object.values(player.skills)) {
      totalLevel += skillState.level
    }
    return totalLevel
  }

  public getCombatLevel(playerId: string): number | null {
    const player = this.players.get(playerId)
    if (!player) return null

    const { attack, strength, defense, range, constitution } = player.skills

    // RuneScape combat level formula
    const base = 0.25 * (defense.level + constitution.level + Math.floor(constitution.level / 2))
    const melee = 0.325 * (attack.level + strength.level)
    const ranged = 0.325 * (Math.floor(range.level * 1.5))
    const magic = 0 // No magic in MVP
    
    return Math.floor(base + Math.max(melee, ranged, magic))
  }

  public getExperienceToNextLevel(playerId: string, skill: RPGSkill): number | null {
    const player = this.players.get(playerId)
    if (!player) return null

    const skillState = player.skills[skill]
    const currentLevel = skillState.level
    
    if (currentLevel >= GAME_CONSTANTS.MAX_LEVEL) {
      return 0 // Already at max level
    }

    const nextLevelExperience = this.getRequiredExperience(currentLevel + 1)
    return nextLevelExperience - skillState.experience
  }

  public getSkillProgress(playerId: string, skill: RPGSkill): { level: number, experience: number, toNext: number, percentage: number } | null {
    const player = this.players.get(playerId)
    if (!player) return null

    const skillState = player.skills[skill]
    const currentLevel = skillState.level
    const currentExperience = skillState.experience
    
    if (currentLevel >= GAME_CONSTANTS.MAX_LEVEL) {
      return {
        level: currentLevel,
        experience: currentExperience,
        toNext: 0,
        percentage: 100
      }
    }

    const currentLevelExperience = this.getRequiredExperience(currentLevel)
    const nextLevelExperience = this.getRequiredExperience(currentLevel + 1)
    const experienceInCurrentLevel = currentExperience - currentLevelExperience
    const experienceNeededForLevel = nextLevelExperience - currentLevelExperience
    const toNext = nextLevelExperience - currentExperience
    const percentage = (experienceInCurrentLevel / experienceNeededForLevel) * 100

    return {
      level: currentLevel,
      experience: currentExperience,
      toNext,
      percentage: Math.min(100, Math.max(0, percentage))
    }
  }

  public createStartingSkills(): PlayerState['skills'] {
    const startingSkills: PlayerState['skills'] = {
      [RPGSkill.ATTACK]: { level: GAME_CONSTANTS.STARTING_LEVEL, experience: 0 },
      [RPGSkill.STRENGTH]: { level: GAME_CONSTANTS.STARTING_LEVEL, experience: 0 },
      [RPGSkill.DEFENSE]: { level: GAME_CONSTANTS.STARTING_LEVEL, experience: 0 },
      [RPGSkill.RANGE]: { level: GAME_CONSTANTS.STARTING_LEVEL, experience: 0 },
      [RPGSkill.CONSTITUTION]: { level: 10, experience: 1154 }, // Start at level 10 (like RuneScape)
      [RPGSkill.WOODCUTTING]: { level: GAME_CONSTANTS.STARTING_LEVEL, experience: 0 },
      [RPGSkill.FISHING]: { level: GAME_CONSTANTS.STARTING_LEVEL, experience: 0 },
      [RPGSkill.FIREMAKING]: { level: GAME_CONSTANTS.STARTING_LEVEL, experience: 0 },
      [RPGSkill.COOKING]: { level: GAME_CONSTANTS.STARTING_LEVEL, experience: 0 }
    }

    return startingSkills
  }

  public validateSkillExperience(skills: PlayerState['skills']): boolean {
    for (const [skillName, skillState] of Object.entries(skills)) {
      const calculatedLevel = this.calculateLevel(skillState.experience)
      if (calculatedLevel !== skillState.level) {
        console.warn(`[SkillsSystem] Skill ${skillName} level mismatch: stored=${skillState.level}, calculated=${calculatedLevel}`)
        return false
      }
    }
    return true
  }

  public fixSkillLevels(skills: PlayerState['skills']): void {
    for (const skillState of Object.values(skills)) {
      skillState.level = this.calculateLevel(skillState.experience)
    }
  }

  public getSkillRank(experience: number): string {
    const level = this.calculateLevel(experience)
    
    if (level >= 99) return 'Grandmaster'
    if (level >= 90) return 'Master'
    if (level >= 80) return 'Expert'
    if (level >= 70) return 'Adept'
    if (level >= 60) return 'Skilled'
    if (level >= 50) return 'Experienced'
    if (level >= 40) return 'Competent'
    if (level >= 30) return 'Proficient'
    if (level >= 20) return 'Apprentice'
    if (level >= 10) return 'Novice'
    return 'Beginner'
  }

  public calculateSkillBonus(level: number): number {
    // Calculate effective skill bonus for equipment/combat calculations
    return Math.floor(level / 10) + level
  }

  public getRandomSkillExperience(baseAmount: number, variance = 0.2): number {
    const minAmount = Math.floor(baseAmount * (1 - variance))
    const maxAmount = Math.floor(baseAmount * (1 + variance))
    return Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount
  }

  // ===== SKILL-SPECIFIC METHODS =====

  public async grantCombatExperience(
    playerId: string, 
    damage: number, 
    style: 'accurate' | 'aggressive' | 'defensive' | 'controlled' = 'accurate'
  ): Promise<void> {
    const baseXP = damage * 4 // RuneScape-style XP calculation

    switch (style) {
      case 'accurate':
        await this.grantExperience(playerId, RPGSkill.ATTACK, baseXP)
        break
      case 'aggressive':
        await this.grantExperience(playerId, RPGSkill.STRENGTH, baseXP)
        break
      case 'defensive':
        await this.grantExperience(playerId, RPGSkill.DEFENSE, baseXP)
        break
      case 'controlled':
        const splitXP = Math.floor(baseXP / 3)
        await this.grantExperience(playerId, RPGSkill.ATTACK, splitXP)
        await this.grantExperience(playerId, RPGSkill.STRENGTH, splitXP)
        await this.grantExperience(playerId, RPGSkill.DEFENSE, splitXP)
        break
    }

    // Always grant Constitution XP (1/3 of base)
    await this.grantExperience(playerId, RPGSkill.CONSTITUTION, Math.floor(baseXP / 3))
  }

  public async grantGatheringExperience(
    playerId: string, 
    skill: RPGSkill.WOODCUTTING | RPGSkill.FISHING, 
    resourceLevel: number
  ): Promise<void> {
    // Grant XP based on resource level
    const baseXP = resourceLevel * 10
    const bonusXP = Math.floor(Math.random() * (resourceLevel * 5)) // Random bonus
    await this.grantExperience(playerId, skill, baseXP + bonusXP)
  }

  public async grantProcessingExperience(
    playerId: string,
    skill: RPGSkill.FIREMAKING | RPGSkill.COOKING,
    itemLevel: number,
    quantity = 1
  ): Promise<void> {
    const baseXP = itemLevel * 8 * quantity
    await this.grantExperience(playerId, skill, baseXP)
  }
}