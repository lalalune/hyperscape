/**
 * state-classes.ts - State Management Classes
 *
 * CLAUDE.md Compliance: Prefer classes over interfaces for types with behavior
 * Converted from interfaces to classes with encapsulation and methods
 */

import type { Position3D as Position } from "@hyperscape/shared";

/**
 * RPGPlayerStats - Player attribute statistics
 */
export class RPGPlayerStats {
  constructor(
    public strength: number = 10,
    public dexterity: number = 10,
    public intelligence: number = 10,
    public constitution: number = 10,
    public wisdom: number = 10,
    public charisma: number = 10,
  ) {}

  /**
   * Calculate total stat points
   */
  getTotalPoints(): number {
    return (
      this.strength +
      this.dexterity +
      this.intelligence +
      this.constitution +
      this.wisdom +
      this.charisma
    );
  }

  /**
   * Get average stat value
   */
  getAverage(): number {
    return this.getTotalPoints() / 6;
  }

  /**
   * Clone stats
   */
  clone(): RPGPlayerStats {
    return new RPGPlayerStats(
      this.strength,
      this.dexterity,
      this.intelligence,
      this.constitution,
      this.wisdom,
      this.charisma,
    );
  }
}

/**
 * SkillInfo - Individual skill progression
 */
export class SkillInfo {
  constructor(
    public level: number = 1,
    public experience: number = 0,
    public maxExperience: number = 100,
  ) {}

  /**
   * Add experience and check for level up
   */
  addExperience(amount: number): boolean {
    this.experience += amount;

    if (this.experience >= this.maxExperience) {
      this.levelUp();
      return true;
    }

    return false;
  }

  /**
   * Level up the skill
   */
  levelUp(): void {
    this.level++;
    this.experience -= this.maxExperience;
    // Exponential growth for next level
    this.maxExperience = Math.floor(this.maxExperience * 1.1);
  }

  /**
   * Get progress percentage
   */
  getProgress(): number {
    return (this.experience / this.maxExperience) * 100;
  }

  /**
   * Clone skill info
   */
  clone(): SkillInfo {
    return new SkillInfo(this.level, this.experience, this.maxExperience);
  }
}

/**
 * InventoryItem - Item in player inventory
 */
export class InventoryItem {
  constructor(
    public id: string,
    public itemId: string,
    public quantity: number,
    public slot?: number,
    public equipped: boolean = false,
    public metadata: Record<string, string | number | boolean> = {},
  ) {}

  /**
   * Check if item is stackable
   */
  isStackable(): boolean {
    return this.quantity > 1 || !this.equipped;
  }

  /**
   * Add to stack
   */
  addQuantity(amount: number): void {
    if (this.isStackable()) {
      this.quantity += amount;
    }
  }

  /**
   * Remove from stack
   */
  removeQuantity(amount: number): boolean {
    if (amount > this.quantity) {
      return false;
    }
    this.quantity -= amount;
    return true;
  }

  /**
   * Clone item
   */
  clone(): InventoryItem {
    return new InventoryItem(
      this.id,
      this.itemId,
      this.quantity,
      this.slot,
      this.equipped,
      { ...this.metadata },
    );
  }
}

/**
 * InventoryState - Player inventory management
 */
export class InventoryState {
  constructor(
    public items: InventoryItem[] = [],
    public capacity: number = 28,
    public weight: number = 0,
    public maxWeight: number = 100,
  ) {}

  /**
   * Add item to inventory
   */
  addItem(item: InventoryItem): boolean {
    // Check capacity
    if (this.items.length >= this.capacity) {
      return false;
    }

    // Try to stack with existing item
    const existingItem = this.items.find(
      (i) => i.itemId === item.itemId && i.isStackable(),
    );

    if (existingItem) {
      existingItem.addQuantity(item.quantity);
    } else {
      this.items.push(item);
    }

    return true;
  }

  /**
   * Remove item from inventory
   */
  removeItem(itemId: string, quantity: number): boolean {
    const item = this.items.find((i) => i.itemId === itemId);

    if (!item) {
      return false;
    }

    const removed = item.removeQuantity(quantity);

    // Remove from array if quantity is 0
    if (item.quantity <= 0) {
      const index = this.items.indexOf(item);
      this.items.splice(index, 1);
    }

    return removed;
  }

  /**
   * Get item by ID
   */
  getItem(itemId: string): InventoryItem | undefined {
    return this.items.find((i) => i.itemId === itemId);
  }

  /**
   * Check if inventory has item
   */
  hasItem(itemId: string, quantity: number = 1): boolean {
    const item = this.getItem(itemId);
    return item ? item.quantity >= quantity : false;
  }

  /**
   * Get total item count
   */
  getTotalItems(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Clone inventory
   */
  clone(): InventoryState {
    return new InventoryState(
      this.items.map((item) => item.clone()),
      this.capacity,
      this.weight,
      this.maxWeight,
    );
  }
}

/**
 * CombatStats - Combat-related statistics
 */
export class CombatStats {
  constructor(
    public attackPower: number = 10,
    public defensePower: number = 10,
    public accuracy: number = 80,
    public evasion: number = 5,
    public criticalChance: number = 5,
    public criticalDamage: number = 150,
  ) {}

  /**
   * Calculate effective attack with modifiers
   */
  getEffectiveAttack(modifiers: number = 1): number {
    return Math.floor(this.attackPower * modifiers);
  }

  /**
   * Calculate effective defense with modifiers
   */
  getEffectiveDefense(modifiers: number = 1): number {
    return Math.floor(this.defensePower * modifiers);
  }

  /**
   * Roll for critical hit
   */
  rollCritical(): boolean {
    return Math.random() * 100 < this.criticalChance;
  }

  /**
   * Clone combat stats
   */
  clone(): CombatStats {
    return new CombatStats(
      this.attackPower,
      this.defensePower,
      this.accuracy,
      this.evasion,
      this.criticalChance,
      this.criticalDamage,
    );
  }
}

/**
 * CombatState - Active combat status
 */
export class CombatState {
  constructor(
    public inCombat: boolean = false,
    public target?: string,
    public attackStyle: "melee" | "ranged" | "magic" = "melee",
    public lastAttackTime: number = 0,
    public combatStats: CombatStats = new CombatStats(),
  ) {}

  /**
   * Enter combat
   */
  enterCombat(targetId: string): void {
    this.inCombat = true;
    this.target = targetId;
    this.lastAttackTime = Date.now();
  }

  /**
   * Exit combat
   */
  exitCombat(): void {
    this.inCombat = false;
    this.target = undefined;
  }

  /**
   * Check if can attack (cooldown check)
   */
  canAttack(cooldownMs: number = 2000): boolean {
    return Date.now() - this.lastAttackTime >= cooldownMs;
  }

  /**
   * Record attack
   */
  recordAttack(): void {
    this.lastAttackTime = Date.now();
  }

  /**
   * Clone combat state
   */
  clone(): CombatState {
    return new CombatState(
      this.inCombat,
      this.target,
      this.attackStyle,
      this.lastAttackTime,
      this.combatStats.clone(),
    );
  }
}

/**
 * PlayerState - Complete player state
 */
export class PlayerState {
  constructor(
    public id: string,
    public name: string,
    public level: number = 1,
    public experience: number = 0,
    public health: number = 100,
    public maxHealth: number = 100,
    public stamina: number = 100,
    public maxStamina: number = 100,
    public position: Position = { x: 0, y: 0, z: 0 },
    public stats: RPGPlayerStats = new RPGPlayerStats(),
    public skills: Record<string, SkillInfo> = {},
  ) {}

  /**
   * Add experience and check for level up
   */
  addExperience(amount: number): boolean {
    this.experience += amount;
    const expNeeded = this.getExperienceNeeded();

    if (this.experience >= expNeeded) {
      this.levelUp();
      return true;
    }

    return false;
  }

  /**
   * Get experience needed for next level
   */
  getExperienceNeeded(): number {
    return this.level * 100;
  }

  /**
   * Level up player
   */
  levelUp(): void {
    this.level++;
    this.experience -= this.getExperienceNeeded();

    // Increase stats
    this.maxHealth += 10;
    this.maxStamina += 5;
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
  }

  /**
   * Heal player
   */
  heal(amount: number): void {
    this.health = Math.min(this.health + amount, this.maxHealth);
  }

  /**
   * Damage player
   */
  damage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  /**
   * Check if player is alive
   */
  isAlive(): boolean {
    return this.health > 0;
  }

  /**
   * Rest to restore health and stamina
   */
  rest(): void {
    this.health = Math.min(this.health + 10, this.maxHealth);
    this.stamina = Math.min(this.stamina + 20, this.maxStamina);
  }

  /**
   * Get or create skill
   */
  getSkill(skillName: string): SkillInfo {
    if (!this.skills[skillName]) {
      this.skills[skillName] = new SkillInfo();
    }
    return this.skills[skillName];
  }

  /**
   * Add skill experience
   */
  addSkillExperience(skillName: string, amount: number): boolean {
    const skill = this.getSkill(skillName);
    return skill.addExperience(amount);
  }

  /**
   * Clone player state
   */
  clone(): PlayerState {
    const clonedSkills: Record<string, SkillInfo> = {};
    for (const [name, skill] of Object.entries(this.skills)) {
      clonedSkills[name] = skill.clone();
    }

    return new PlayerState(
      this.id,
      this.name,
      this.level,
      this.experience,
      this.health,
      this.maxHealth,
      this.stamina,
      this.maxStamina,
      { ...this.position },
      this.stats.clone(),
      clonedSkills,
    );
  }
}

/**
 * RPGStateManager - Central state management class
 */
export class RPGStateManager {
  private playerStates: Map<string, PlayerState> = new Map();
  private inventories: Map<string, InventoryState> = new Map();
  private combatStates: Map<string, CombatState> = new Map();
  private worldState: Record<string, unknown> = {};

  /**
   * Get player state
   */
  getPlayerState(playerId: string): PlayerState | null {
    return this.playerStates.get(playerId) || null;
  }

  /**
   * Update player state
   */
  updatePlayerState(playerId: string, updates: Partial<PlayerState>): void {
    const existing = this.playerStates.get(playerId);

    if (existing) {
      Object.assign(existing, updates);
    } else {
      // Create new player state
      const newState = new PlayerState(playerId, updates.name || "Player");
      Object.assign(newState, updates);
      this.playerStates.set(playerId, newState);
    }
  }

  /**
   * Get inventory
   */
  getInventory(playerId: string): InventoryState {
    let inventory = this.inventories.get(playerId);

    if (!inventory) {
      inventory = new InventoryState();
      this.inventories.set(playerId, inventory);
    }

    return inventory;
  }

  /**
   * Add item to inventory
   */
  addItem(playerId: string, itemId: string, quantity: number): boolean {
    const inventory = this.getInventory(playerId);
    const item = new InventoryItem(`${itemId}_${Date.now()}`, itemId, quantity);
    return inventory.addItem(item);
  }

  /**
   * Remove item from inventory
   */
  removeItem(playerId: string, itemId: string, quantity: number): boolean {
    const inventory = this.getInventory(playerId);
    return inventory.removeItem(itemId, quantity);
  }

  /**
   * Get combat state
   */
  getCombatState(entityId: string): CombatState | null {
    return this.combatStates.get(entityId) || null;
  }

  /**
   * Update combat state
   */
  updateCombatState(entityId: string, updates: Partial<CombatState>): void {
    const existing = this.combatStates.get(entityId);

    if (existing) {
      Object.assign(existing, updates);
    } else {
      const newState = new CombatState();
      Object.assign(newState, updates);
      this.combatStates.set(entityId, newState);
    }
  }

  /**
   * Get world state
   */
  getWorldState(): Record<string, unknown> {
    return this.worldState;
  }

  /**
   * Save world state - persistence handled by external database plugin
   */
  async saveWorldState(): Promise<void> {
    // Note: Persistence is handled externally via ElizaOS plugin-sql
    // State is already tracked in-memory and synced via world updates
    console.debug("World state save requested (handled externally)");
  }

  /**
   * Load world state - persistence handled by external database plugin
   */
  async loadWorldState(): Promise<void> {
    // Note: Persistence is handled externally via ElizaOS plugin-sql
    // State is loaded on world initialization
    console.debug("World state load requested (handled externally)");
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.playerStates.clear();
    this.inventories.clear();
    this.combatStates.clear();
    this.worldState = {};
  }
}
