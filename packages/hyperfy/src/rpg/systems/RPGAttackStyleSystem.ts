import { System } from '../../core/systems/System';

export interface AttackStyle {
  id: string;
  name: string;
  description: string;
  xpDistribution: {
    attack: number;
    strength: number;
    defense: number;
    constitution: number;
  };
  damageModifier: number; // Multiplier for damage calculation
  accuracyModifier: number; // Multiplier for hit chance
  icon: string;
}

export interface PlayerAttackStyleState {
  playerId: string;
  selectedStyle: string;
  lastStyleChange: number;
  combatStyleHistory: Array<{
    style: string;
    timestamp: number;
    combatSession: string;
  }>;
}

/**
 * RPG Attack Style System - GDD Compliant
 * Implements attack style selection per GDD specifications:
 * - Accurate: Focus on Attack XP, higher accuracy
 * - Aggressive: Focus on Strength XP, higher damage
 * - Defensive: Focus on Defense XP, reduced damage taken
 * - Controlled: Balanced XP distribution across all combat skills
 * 
 * Each style affects XP distribution and combat effectiveness
 */
export class RPGAttackStyleSystem extends System {
  private playerAttackStyles = new Map<string, PlayerAttackStyleState>();
  private styleChangeTimers = new Map<string, NodeJS.Timeout>();

  // Attack styles per GDD - XP percentages must total 100%
  private readonly ATTACK_STYLES: Record<string, AttackStyle> = {
    accurate: {
      id: 'accurate',
      name: 'Accurate',
      description: 'Gain more Attack XP. Higher accuracy but normal damage.',
      xpDistribution: {
        attack: 40,     // 40% Attack XP
        strength: 10,   // 10% Strength XP
        defense: 10,    // 10% Defense XP
        constitution: 40 // 40% Constitution XP (always gained)
      },
      damageModifier: 1.0,   // Normal damage
      accuracyModifier: 1.15, // +15% accuracy
      icon: '🎯'
    },

    aggressive: {
      id: 'aggressive',
      name: 'Aggressive',
      description: 'Gain more Strength XP. Higher damage but normal accuracy.',
      xpDistribution: {
        attack: 10,     // 10% Attack XP
        strength: 40,   // 40% Strength XP
        defense: 10,    // 10% Defense XP
        constitution: 40 // 40% Constitution XP (always gained)
      },
      damageModifier: 1.15,  // +15% damage
      accuracyModifier: 1.0, // Normal accuracy
      icon: '⚔️'
    },

    defensive: {
      id: 'defensive',
      name: 'Defensive',
      description: 'Gain more Defense XP. Reduced damage taken but lower damage dealt.',
      xpDistribution: {
        attack: 10,     // 10% Attack XP
        strength: 10,   // 10% Strength XP
        defense: 40,    // 40% Defense XP
        constitution: 40 // 40% Constitution XP (always gained)
      },
      damageModifier: 0.85,  // -15% damage dealt
      accuracyModifier: 1.0, // Normal accuracy
      icon: '🛡️'
    },

    controlled: {
      id: 'controlled',
      name: 'Controlled',
      description: 'Balanced XP gain across all combat skills.',
      xpDistribution: {
        attack: 20,     // 20% Attack XP
        strength: 20,   // 20% Strength XP
        defense: 20,    // 20% Defense XP
        constitution: 40 // 40% Constitution XP (always gained)
      },
      damageModifier: 1.0,   // Normal damage
      accuracyModifier: 1.0, // Normal accuracy
      icon: '⚖️'
    }
  };

  private readonly STYLE_CHANGE_COOLDOWN = 5000; // 5 seconds between style changes

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGAttackStyleSystem] Initializing GDD-compliant attack style system...');
    
    // Listen for combat and UI events
    this.world.on?.('rpg:player:register', this.handlePlayerRegister.bind(this));
    this.world.on?.('rpg:player:unregister', this.handlePlayerUnregister.bind(this));
    this.world.on?.('rpg:combat:attack_style:change', this.handleStyleChange.bind(this));
    this.world.on?.('rpg:combat:xp:calculate', this.handleXPCalculation.bind(this));
    this.world.on?.('rpg:combat:damage:calculate', this.handleDamageCalculation.bind(this));
    this.world.on?.('rpg:combat:accuracy:calculate', this.handleAccuracyCalculation.bind(this));
    this.world.on?.('rpg:ui:attack_style:get', this.handleGetStyleInfo.bind(this));
    
    console.log('[RPGAttackStyleSystem] Attack style system initialized with 4 combat styles');
  }

  start(): void {
    console.log('[RPGAttackStyleSystem] Attack style system started');
  }

  private handlePlayerRegister(data: { id: string }): void {
    const playerId = data.id;
    
    // Initialize player with default attack style (controlled)
    const playerState: PlayerAttackStyleState = {
      playerId,
      selectedStyle: 'controlled', // Default per GDD
      lastStyleChange: Date.now(),
      combatStyleHistory: []
    };

    this.playerAttackStyles.set(playerId, playerState);
    
    // Notify UI of initial attack style
    this.world.emit?.('rpg:ui:attack_style:update', {
      playerId,
      currentStyle: this.ATTACK_STYLES.controlled,
      availableStyles: Object.values(this.ATTACK_STYLES),
      canChange: true
    });

    console.log(`[RPGAttackStyleSystem] Initialized attack style for player ${playerId} (default: controlled)`);
  }

  private handlePlayerUnregister(data: { id: string }): void {
    const playerId = data.id;
    
    // Clear style change timer
    const timer = this.styleChangeTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.styleChangeTimers.delete(playerId);
    }
    
    this.playerAttackStyles.delete(playerId);
    console.log(`[RPGAttackStyleSystem] Cleaned up attack style data for player ${playerId}`);
  }

  private handleStyleChange(data: { playerId: string; newStyle: string }): void {
    const { playerId, newStyle } = data;
    
    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) {
      console.error(`[RPGAttackStyleSystem] No attack style state found for player ${playerId}`);
      return;
    }

    // Validate new style
    const style = this.ATTACK_STYLES[newStyle];
    if (!style) {
      this.world.emit?.('rpg:ui:message', {
        playerId,
        message: `Invalid attack style: ${newStyle}`,
        type: 'error'
      });
      return;
    }

    // Check cooldown
    const now = Date.now();
    if (now - playerState.lastStyleChange < this.STYLE_CHANGE_COOLDOWN) {
      const remainingCooldown = Math.ceil((this.STYLE_CHANGE_COOLDOWN - (now - playerState.lastStyleChange)) / 1000);
      this.world.emit?.('rpg:ui:message', {
        playerId,
        message: `You must wait ${remainingCooldown} seconds before changing attack style.`,
        type: 'warning'
      });
      return;
    }

    // Update player's attack style
    const oldStyle = playerState.selectedStyle;
    playerState.selectedStyle = newStyle;
    playerState.lastStyleChange = now;
    
    // Record style change in history
    playerState.combatStyleHistory.push({
      style: newStyle,
      timestamp: now,
      combatSession: `session_${now}`
    });

    // Keep only last 50 style changes
    if (playerState.combatStyleHistory.length > 50) {
      playerState.combatStyleHistory = playerState.combatStyleHistory.slice(-50);
    }

    // Set temporary cooldown
    const cooldownTimer = setTimeout(() => {
      this.styleChangeTimers.delete(playerId);
      
      // Notify UI that cooldown is over
      this.world.emit?.('rpg:ui:attack_style:update', {
        playerId,
        currentStyle: this.ATTACK_STYLES[playerState.selectedStyle],
        availableStyles: Object.values(this.ATTACK_STYLES),
        canChange: true
      });
    }, this.STYLE_CHANGE_COOLDOWN);

    this.styleChangeTimers.set(playerId, cooldownTimer);

    // Notify UI immediately
    this.world.emit?.('rpg:ui:attack_style:update', {
      playerId,
      currentStyle: style,
      availableStyles: Object.values(this.ATTACK_STYLES),
      canChange: false,
      cooldownRemaining: this.STYLE_CHANGE_COOLDOWN
    });

    // Notify chat
    this.world.emit?.('rpg:ui:message', {
      playerId,
      message: `Attack style changed from ${this.ATTACK_STYLES[oldStyle].name} to ${style.name}. ${style.description}`,
      type: 'info'
    });

    console.log(`[RPGAttackStyleSystem] Player ${playerId} changed attack style: ${oldStyle} -> ${newStyle}`);
  }

  private handleXPCalculation(data: { playerId: string; baseXP: number; skill: string; callback: (xpAmount: number) => void }): void {
    const { playerId, baseXP, skill } = data;
    
    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) {
      // No attack style state, return base XP
      data.callback(baseXP);
      return;
    }

    const attackStyle = this.ATTACK_STYLES[playerState.selectedStyle];
    if (!attackStyle) {
      data.callback(baseXP);
      return;
    }

    // Calculate XP based on attack style distribution
    let xpMultiplier = 0;
    
    switch (skill.toLowerCase()) {
      case 'attack':
        xpMultiplier = attackStyle.xpDistribution.attack / 100;
        break;
      case 'strength':
        xpMultiplier = attackStyle.xpDistribution.strength / 100;
        break;
      case 'defense':
        xpMultiplier = attackStyle.xpDistribution.defense / 100;
        break;
      case 'constitution':
        xpMultiplier = attackStyle.xpDistribution.constitution / 100;
        break;
      default:
        xpMultiplier = 1; // Non-combat skills unaffected
    }

    const finalXP = Math.floor(baseXP * xpMultiplier);
    data.callback(finalXP);

    if (finalXP > 0) {
      console.log(`[RPGAttackStyleSystem] XP calculation for ${skill}: ${baseXP} * ${xpMultiplier} = ${finalXP} (style: ${attackStyle.name})`);
    }
  }

  private handleDamageCalculation(data: { playerId: string; baseDamage: number; callback: (damage: number) => void }): void {
    const { playerId, baseDamage } = data;
    
    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) {
      data.callback(baseDamage);
      return;
    }

    const attackStyle = this.ATTACK_STYLES[playerState.selectedStyle];
    if (!attackStyle) {
      data.callback(baseDamage);
      return;
    }

    // Apply damage modifier from attack style
    const finalDamage = Math.floor(baseDamage * attackStyle.damageModifier);
    data.callback(finalDamage);

    console.log(`[RPGAttackStyleSystem] Damage calculation: ${baseDamage} * ${attackStyle.damageModifier} = ${finalDamage} (style: ${attackStyle.name})`);
  }

  private handleAccuracyCalculation(data: { playerId: string; baseAccuracy: number; callback: (accuracy: number) => void }): void {
    const { playerId, baseAccuracy } = data;
    
    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) {
      data.callback(baseAccuracy);
      return;
    }

    const attackStyle = this.ATTACK_STYLES[playerState.selectedStyle];
    if (!attackStyle) {
      data.callback(baseAccuracy);
      return;
    }

    // Apply accuracy modifier from attack style
    const finalAccuracy = Math.min(1.0, baseAccuracy * attackStyle.accuracyModifier);
    data.callback(finalAccuracy);

    console.log(`[RPGAttackStyleSystem] Accuracy calculation: ${baseAccuracy} * ${attackStyle.accuracyModifier} = ${finalAccuracy} (style: ${attackStyle.name})`);
  }

  private handleGetStyleInfo(data: { playerId: string; callback: (info: any) => void }): void {
    const { playerId } = data;
    
    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) {
      data.callback(null);
      return;
    }

    const currentStyle = this.ATTACK_STYLES[playerState.selectedStyle];
    const canChange = !this.styleChangeTimers.has(playerId);
    
    let cooldownRemaining = 0;
    if (!canChange) {
      const now = Date.now();
      cooldownRemaining = Math.max(0, this.STYLE_CHANGE_COOLDOWN - (now - playerState.lastStyleChange));
    }

    const styleInfo = {
      currentStyle,
      availableStyles: Object.values(this.ATTACK_STYLES),
      canChange,
      cooldownRemaining,
      styleHistory: playerState.combatStyleHistory.slice(-10) // Last 10 changes
    };

    data.callback(styleInfo);
  }

  // Public API methods
  getPlayerAttackStyle(playerId: string): AttackStyle | null {
    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) return null;
    
    return this.ATTACK_STYLES[playerState.selectedStyle] || null;
  }

  getAllAttackStyles(): AttackStyle[] {
    return Object.values(this.ATTACK_STYLES);
  }

  canPlayerChangeStyle(playerId: string): boolean {
    return !this.styleChangeTimers.has(playerId);
  }

  getRemainingCooldown(playerId: string): number {
    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState || this.canPlayerChangeStyle(playerId)) return 0;
    
    const now = Date.now();
    return Math.max(0, this.STYLE_CHANGE_COOLDOWN - (now - playerState.lastStyleChange));
  }

  forceChangeAttackStyle(playerId: string, styleId: string): boolean {
    const style = this.ATTACK_STYLES[styleId];
    if (!style) return false;

    const playerState = this.playerAttackStyles.get(playerId);
    if (!playerState) return false;

    // Clear any existing cooldown
    const timer = this.styleChangeTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.styleChangeTimers.delete(playerId);
    }

    // Force change style
    this.handleStyleChange({ playerId, newStyle: styleId });
    return true;
  }

  getPlayerStyleHistory(playerId: string): Array<{ style: string; timestamp: number; combatSession: string }> {
    const playerState = this.playerAttackStyles.get(playerId);
    return playerState?.combatStyleHistory || [];
  }

  getSystemInfo(): any {
    const activeStyles: { [key: string]: number } = {};
    let totalPlayers = 0;

    for (const playerState of this.playerAttackStyles.values()) {
      totalPlayers++;
      const style = playerState.selectedStyle;
      activeStyles[style] = (activeStyles[style] || 0) + 1;
    }

    return {
      totalPlayers,
      activeStyles,
      availableStyles: Object.keys(this.ATTACK_STYLES),
      activeCooldowns: this.styleChangeTimers.size,
      systemLoaded: true
    };
  }

  destroy(): void {
    // Clear all timers
    for (const timer of this.styleChangeTimers.values()) {
      clearTimeout(timer);
    }
    
    this.playerAttackStyles.clear();
    this.styleChangeTimers.clear();
    
    console.log('[RPGAttackStyleSystem] Attack style system destroyed');
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {
    // Optional: Update UI cooldown timers in real-time
    // This could be used to update the UI every frame during cooldowns
  }
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}