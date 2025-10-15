import { Component } from './Component';
import type { Entity } from '../entities/Entity';
import type { SkillData, PrayerComponent, EquipmentComponent, CombatBonuses, PlayerHealth } from '../types/core';

/**
 * StatsComponent - Player/Entity stats and skills
 * 
 * Extends the base Component class to properly integrate with the ECS system
 * while maintaining all the stats functionality needed by the SkillsSystem.
 */
export class StatsComponent extends Component {
  public combatLevel: number;
  public level: number;
  public health: PlayerHealth;
  public attack: SkillData;
  public strength: SkillData;
  public defense: SkillData;
  public constitution: SkillData;
  public ranged: SkillData;
  public magic: SkillData;
  public prayer: { level: number; points: number };
  public woodcutting: SkillData;
  public fishing: SkillData;
  public firemaking: SkillData;
  public cooking: SkillData;
  public activePrayers: PrayerComponent;
  public equipment: EquipmentComponent;
  public equippedSpell: string | null;
  public effects: { onSlayerTask: boolean; targetIsDragon: boolean; targetMagicLevel: number };
  public combatBonuses: CombatBonuses;
  public totalLevel?: number;

  constructor(entity: Entity, initialData: Partial<StatsComponent> = {}) {
    super('stats', entity, initialData);

    // Initialize default values
    const defaultSkill: SkillData = { level: 1, xp: 0 };
    const defaultPrayer = { level: 1, points: 0 };
    const defaultEquipment: EquipmentComponent = {
      helmet: null,
      body: null,
      legs: null,
      boots: null,
      gloves: null,
      weapon: null,
      shield: null,
      cape: null,
      amulet: null,
      ring: null
    };
    const defaultPrayers: PrayerComponent = {
      protectFromMelee: false,
      protectFromRanged: false,
      protectFromMagic: false,
      piety: false,
      chivalry: false,
      ultimateStrength: false,
      superhumanStrength: false,
      burstOfStrength: false,
      rigour: false,
      eagleEye: false,
      hawkEye: false,
      sharpEye: false,
      augury: false,
      mysticMight: false,
      mysticLore: false,
      mysticWill: false
    };
    const defaultBonuses: CombatBonuses = {
      attack: 0,
      defense: 0,
      ranged: 0,
      strength: 0,
      attackStab: 0,
      attackSlash: 0,
      attackCrush: 0,
      attackRanged: 0,
      attackMagic: 0,
      defenseStab: 0,
      defenseSlash: 0,
      defenseCrush: 0,
      defenseRanged: 0,
      defenseMagic: 0,
      meleeStrength: 0,
      rangedStrength: 0,
      magicDamage: 0,
      prayer: 0
    };
    const defaultEffects = { onSlayerTask: false, targetIsDragon: false, targetMagicLevel: 0 };

    // Set properties from initialData or defaults
    this.combatLevel = initialData.combatLevel || 3;
    this.level = initialData.level || 1;
    this.health = initialData.health || { current: 100, max: 100 };
    this.attack = initialData.attack || { ...defaultSkill };
    this.strength = initialData.strength || { ...defaultSkill };
    this.defense = initialData.defense || { ...defaultSkill };
    this.constitution = initialData.constitution || { ...defaultSkill };
    this.ranged = initialData.ranged || { ...defaultSkill };
    this.magic = initialData.magic || { ...defaultSkill };
    this.prayer = initialData.prayer || { ...defaultPrayer };
    this.woodcutting = initialData.woodcutting || { ...defaultSkill };
    this.fishing = initialData.fishing || { ...defaultSkill };
    this.firemaking = initialData.firemaking || { ...defaultSkill };
    this.cooking = initialData.cooking || { ...defaultSkill };
    this.activePrayers = initialData.activePrayers || { ...defaultPrayers };
    this.equipment = initialData.equipment || { ...defaultEquipment };
    this.equippedSpell = initialData.equippedSpell || null;
    this.effects = initialData.effects || { ...defaultEffects };
    this.combatBonuses = initialData.combatBonuses || { ...defaultBonuses };
    this.totalLevel = initialData.totalLevel;
  }

  // Override serialize to include all stats properties
  override serialize(): Record<string, unknown> {
    return {
      type: this.type,
      combatLevel: this.combatLevel,
      level: this.level,
      health: this.health,
      attack: this.attack,
      strength: this.strength,
      defense: this.defense,
      constitution: this.constitution,
      ranged: this.ranged,
      magic: this.magic,
      prayer: this.prayer,
      woodcutting: this.woodcutting,
      fishing: this.fishing,
      firemaking: this.firemaking,
      cooking: this.cooking,
      activePrayers: this.activePrayers,
      equipment: this.equipment,
      equippedSpell: this.equippedSpell,
      effects: this.effects,
      combatBonuses: this.combatBonuses,
      totalLevel: this.totalLevel
    };
  }
}