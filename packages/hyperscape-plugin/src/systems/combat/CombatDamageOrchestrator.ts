/**
 * CombatDamageOrchestrator — combat damage calculation pipeline.
 *
 * Wraps the 5 calculate*Damage methods + the 2 small equipment
 * accessors that they share. All damage paths run through here:
 *
 *   - `calculateMeleeDamage` — player-or-mob melee
 *   - `calculateRangedDamageForAttack` — player ranged
 *   - `calculateMobRangedDamageForAttack` — mob ranged
 *   - `calculateMagicDamageForAttack` — player magic
 *   - `calculateMobMagicDamageForAttack` — mob magic
 *   - `getEquippedWeapon` / `getEquippedArrows` — equipment lookups
 *
 * Internally each method assembles the relevant `*DamageParams`
 * struct from a mix of attacker/target stats, prayer bonuses, and
 * equipment cache, then delegates the actual roll to the appropriate
 * pure calculator (`DamageCalculator`, `calculateRangedDamage`,
 * `calculateMagicDamage`).
 *
 * Extracted from CombatSystem.ts as the fourth slice of the system's
 * decomposition (item #9 in PROGRESS_AUDIT, after CombatEventEmitter
 * + CombatPlayerQueries + CombatEventRecorder).
 *
 * Coupling shape: 6 dep references injected at construction time.
 * `playerEquipmentStats` is a shared `Map` reference — CombatSystem
 * still owns the cache (populated on `PLAYER_EQUIPMENT_CHANGED`,
 * cleared on disconnect/destroy); this helper only reads from it.
 */

import type {
  Entity,
  Item,
  EquipmentSlot,
  PrayerCombatBonuses,
} from "@hyperforge/shared";
import {
  WEAPON_DEFAULT_ATTACK_STYLE,
  type MeleeAttackStyle,
  type CombatStyle,
  type World,
  isMobEntity,
} from "@hyperforge/shared";
import { getGameRng } from "@hyperforge/shared";

import { ammunitionService } from "./AmmunitionService.js";
import type { CombatPlayerQueries } from "./CombatPlayerQueries.js";
import type { DamageCalculator } from "./DamageCalculator.js";
import {
  calculateRangedDamage,
  type RangedDamageParams,
} from "./RangedDamageCalculator.js";
import {
  calculateMagicDamage,
  type MagicDamageParams,
} from "./MagicDamageCalculator.js";
import { MobEntity } from "../../entities/npc/MobEntity.js";
import type { Spell } from "./SpellService.js";

// Style types — local to combat.
type RangedCombatStyle = "accurate" | "rapid" | "longrange";
type MagicCombatStyle = "accurate" | "longrange" | "autocast";

/**
 * Cached equipment-derived combat stats per player. Computed by
 * CombatSystem on `PLAYER_EQUIPMENT_CHANGED` and read here during
 * damage rolls. Same shape lives in CombatSystem's owning Map.
 */
export interface PlayerEquipmentStats {
  attack: number;
  strength: number;
  defense: number;
  ranged: number;
  rangedAttack: number;
  rangedStrength: number;
  magicAttack: number;
  magicDefense: number;
  defenseStab: number;
  defenseSlash: number;
  defenseCrush: number;
  defenseRanged: number;
  attackStab: number;
  attackSlash: number;
  attackCrush: number;
}

/** Equipment system surface needed for weapon/arrow lookups. */
interface EquipmentSystemDuck {
  getPlayerEquipment(playerId: string):
    | {
        weapon?: { item?: Item | null } | null;
        arrows?: EquipmentSlot | null;
      }
    | undefined;
}

/** Prayer system surface — read-only combined-bonuses query. */
interface PrayerSystemLike {
  getCombinedBonuses(playerId: string): PrayerCombatBonuses;
}

/** Player system surface — read-only attack-style query. */
interface PlayerSystemLike {
  getPlayerAttackStyle?(playerId: string): { id?: string } | undefined | null;
}

export class CombatDamageOrchestrator {
  private readonly world: World;
  private readonly playerQueries: CombatPlayerQueries;
  private readonly damageCalculator: DamageCalculator;
  private readonly playerEquipmentStats: Map<string, PlayerEquipmentStats>;
  private readonly getEquipmentSystem: () => EquipmentSystemDuck | undefined;
  private readonly getPrayerSystem: () => PrayerSystemLike | null | undefined;

  constructor(
    world: World,
    playerQueries: CombatPlayerQueries,
    damageCalculator: DamageCalculator,
    playerEquipmentStats: Map<string, PlayerEquipmentStats>,
    getEquipmentSystem: () => EquipmentSystemDuck | undefined,
    getPrayerSystem: () => PrayerSystemLike | null | undefined,
  ) {
    this.world = world;
    this.playerQueries = playerQueries;
    this.damageCalculator = damageCalculator;
    this.playerEquipmentStats = playerEquipmentStats;
    this.getEquipmentSystem = getEquipmentSystem;
    this.getPrayerSystem = getPrayerSystem;
  }

  // ============================================================================
  // EQUIPMENT LOOKUPS
  // ============================================================================

  /** Get equipped arrows slot for ranged combat. */
  getEquippedArrows(playerId: string): EquipmentSlot | null {
    const equipmentSystem = this.getEquipmentSystem();
    if (!equipmentSystem) return null;
    const equipment = equipmentSystem.getPlayerEquipment(playerId);
    return equipment?.arrows ?? null;
  }

  /** Get equipped weapon for combat. */
  getEquippedWeapon(playerId: string): Item | null {
    const equipmentSystem = this.getEquipmentSystem();
    if (!equipmentSystem) return null;
    const equipment = equipmentSystem.getPlayerEquipment(playerId);
    return equipment?.weapon?.item ?? null;
  }

  // ============================================================================
  // MELEE
  // ============================================================================

  calculateMeleeDamage(
    attacker: Entity | MobEntity,
    target: Entity | MobEntity,
    style: CombatStyle = "accurate",
  ): number {
    // Get prayer bonuses for attacker and defender (players only)
    let attackerPrayerBonuses: PrayerCombatBonuses | undefined;
    let defenderPrayerBonuses: PrayerCombatBonuses | undefined;

    const prayerSystem = this.getPrayerSystem();
    if (prayerSystem) {
      // Attacker prayer bonuses (if player)
      if (!(attacker instanceof MobEntity)) {
        const bonuses = prayerSystem.getCombinedBonuses(
          (attacker as Entity).id,
        );
        if (bonuses.attackMultiplier || bonuses.strengthMultiplier) {
          attackerPrayerBonuses = bonuses;
        }
      }
      // Defender prayer bonuses (if player)
      if (!(target instanceof MobEntity)) {
        const bonuses = prayerSystem.getCombinedBonuses((target as Entity).id);
        if (bonuses.defenseMultiplier) {
          defenderPrayerBonuses = bonuses;
        }
      }
    }

    // Determine melee attack style from weapon type (tile-based MMORPG combat triangle).
    let meleeAttackStyle: MeleeAttackStyle | undefined;
    if (!(attacker instanceof MobEntity)) {
      const weapon = this.getEquippedWeapon((attacker as Entity).id);
      const weaponType = weapon?.weaponType?.toLowerCase() ?? "none";
      meleeAttackStyle = WEAPON_DEFAULT_ATTACK_STYLE[weaponType] ?? "crush";
    }

    return this.damageCalculator.calculateMeleeDamage(
      attacker,
      target,
      style,
      attackerPrayerBonuses,
      defenderPrayerBonuses,
      meleeAttackStyle,
    );
  }

  // ============================================================================
  // RANGED
  // ============================================================================

  calculateRangedDamageForAttack(
    _attacker: Entity | MobEntity,
    target: Entity | MobEntity,
    attackerId: string,
    targetType: "player" | "mob",
  ): number {
    const rangedLevel = this.playerQueries.getPlayerSkillLevel(
      attackerId,
      "ranged",
    );
    const equipmentStats = this.playerEquipmentStats.get(attackerId);
    const arrowSlot = this.getEquippedArrows(attackerId);

    // Get arrow strength bonus
    const arrowStrength = ammunitionService.getArrowStrengthBonus(arrowSlot);

    // Get target stats
    const targetDefenseLevel =
      targetType === "mob" && isMobEntity(target)
        ? target.getMobData().defense
        : this.playerQueries.getPlayerSkillLevel(String(target.id), "defense");

    // Per-style defenseRanged from equipment (tile-based MMORPG combat triangle).
    const targetEquipStats = this.playerEquipmentStats.get(String(target.id));
    const targetRangedDefense =
      targetType === "mob" && isMobEntity(target)
        ? target.getMobData().defense
        : (targetEquipStats?.defenseRanged ?? targetEquipStats?.ranged ?? 0);

    // Get prayer bonuses
    const prayerSystem = this.world.getSystem(
      "prayer",
    ) as unknown as PrayerSystemLike | null;
    const attackerPrayer = prayerSystem?.getCombinedBonuses(attackerId);
    const defenderPrayer =
      targetType === "player"
        ? prayerSystem?.getCombinedBonuses(String(target.id))
        : undefined;

    // equipmentStats.rangedStrength already includes arrow strength.
    const rangedStrengthBonus = equipmentStats?.rangedStrength ?? arrowStrength;

    // Player combat style.
    let rangedStyle: RangedCombatStyle = "accurate";
    const playerSystem = this.world.getSystem(
      "player",
    ) as unknown as PlayerSystemLike | null;
    const styleData = playerSystem?.getPlayerAttackStyle?.(attackerId);
    if (styleData?.id) {
      const id = styleData.id;
      if (id === "accurate" || id === "rapid" || id === "longrange") {
        rangedStyle = id;
      }
    }

    const params: RangedDamageParams = {
      rangedLevel,
      rangedAttackBonus: equipmentStats?.rangedAttack ?? 0,
      rangedStrengthBonus,
      style: rangedStyle,
      targetDefenseLevel,
      targetRangedDefenseBonus: targetRangedDefense,
      prayerBonuses: attackerPrayer,
      targetPrayerBonuses: defenderPrayer,
    };

    const result = calculateRangedDamage(params, getGameRng());
    return result.damage;
  }

  calculateMobRangedDamageForAttack(
    target: Entity | MobEntity,
    targetType: "player" | "mob",
    rangedLevel: number,
    arrowId: string,
  ): number {
    const targetDefenseLevel =
      targetType === "mob" && isMobEntity(target)
        ? target.getMobData().defense
        : this.playerQueries.getPlayerSkillLevel(String(target.id), "defense");

    const targetRangedDefense =
      targetType === "mob" && isMobEntity(target)
        ? target.getMobData().defense
        : (this.playerEquipmentStats.get(String(target.id))?.defenseRanged ??
          0);

    const prayerSystem = this.getPrayerSystem();
    const defenderPrayer =
      targetType === "player"
        ? prayerSystem?.getCombinedBonuses(String(target.id))
        : undefined;

    const params: RangedDamageParams = {
      rangedLevel,
      rangedAttackBonus: 0,
      rangedStrengthBonus:
        ammunitionService.getArrowData(arrowId)?.rangedStrength ?? 7,
      style: "accurate",
      targetDefenseLevel,
      targetRangedDefenseBonus: targetRangedDefense,
      prayerBonuses: undefined,
      targetPrayerBonuses: defenderPrayer,
    };

    const result = calculateRangedDamage(params, getGameRng());
    return result.damage;
  }

  // ============================================================================
  // MAGIC
  // ============================================================================

  calculateMagicDamageForAttack(
    _attacker: Entity | MobEntity,
    target: Entity | MobEntity,
    attackerId: string,
    targetType: "player" | "mob",
    spell: Spell,
  ): number {
    const magicLevel = this.playerQueries.getPlayerSkillLevel(
      attackerId,
      "magic",
    );
    const equipmentStats = this.playerEquipmentStats.get(attackerId);

    // Get target stats
    const targetMagicLevel =
      targetType === "mob" && isMobEntity(target)
        ? 1 // Most F2P mobs have 1 magic
        : this.playerQueries.getPlayerSkillLevel(String(target.id), "magic");

    const targetDefenseLevel =
      targetType === "mob" && isMobEntity(target)
        ? target.getMobData().defense
        : this.playerQueries.getPlayerSkillLevel(String(target.id), "defense");

    const targetMagicDefense =
      targetType === "mob" && isMobEntity(target)
        ? 0
        : (this.playerEquipmentStats.get(String(target.id))?.magicDefense ?? 0);

    // Get prayer bonuses
    const prayerSystem = this.world.getSystem(
      "prayer",
    ) as unknown as PrayerSystemLike | null;
    const attackerPrayer = prayerSystem?.getCombinedBonuses(attackerId);
    const defenderPrayer =
      targetType === "player"
        ? prayerSystem?.getCombinedBonuses(String(target.id))
        : undefined;

    // Player combat style.
    let magicStyle: MagicCombatStyle = "accurate";
    const playerSystem = this.world.getSystem(
      "player",
    ) as unknown as PlayerSystemLike | null;
    const styleData = playerSystem?.getPlayerAttackStyle?.(attackerId);
    if (styleData?.id) {
      const id = styleData.id;
      if (id === "accurate" || id === "longrange" || id === "autocast") {
        magicStyle = id;
      }
    }

    const params: MagicDamageParams = {
      magicLevel,
      magicAttackBonus: equipmentStats?.magicAttack ?? 0,
      style: magicStyle,
      spellBaseMaxHit: spell.baseMaxHit,
      // MagicDamageParams uses "npc" instead of "mob".
      targetType: targetType === "mob" ? "npc" : "player",
      targetMagicLevel,
      targetDefenseLevel,
      targetMagicDefenseBonus: targetMagicDefense,
      prayerBonuses: attackerPrayer,
      targetPrayerBonuses: defenderPrayer,
    };

    const result = calculateMagicDamage(params, getGameRng());
    return result.damage;
  }

  calculateMobMagicDamageForAttack(
    target: Entity | MobEntity,
    targetType: "player" | "mob",
    magicLevel: number,
    spell: Spell,
  ): number {
    const targetMagicLevel =
      targetType === "mob" && isMobEntity(target)
        ? 1
        : this.playerQueries.getPlayerSkillLevel(String(target.id), "magic");

    const targetDefenseLevel =
      targetType === "mob" && isMobEntity(target)
        ? target.getMobData().defense
        : this.playerQueries.getPlayerSkillLevel(String(target.id), "defense");

    const targetMagicDefense =
      targetType === "mob" && isMobEntity(target)
        ? 0
        : (this.playerEquipmentStats.get(String(target.id))?.magicDefense ?? 0);

    const prayerSystem = this.getPrayerSystem();
    const defenderPrayer =
      targetType === "player"
        ? prayerSystem?.getCombinedBonuses(String(target.id))
        : undefined;

    const params: MagicDamageParams = {
      magicLevel,
      magicAttackBonus: 0,
      style: "accurate",
      spellBaseMaxHit: spell.baseMaxHit,
      targetType: targetType === "mob" ? "npc" : "player",
      targetMagicLevel,
      targetDefenseLevel,
      targetMagicDefenseBonus: targetMagicDefense,
      prayerBonuses: undefined,
      targetPrayerBonuses: defenderPrayer,
    };

    const result = calculateMagicDamage(params, getGameRng());
    return result.damage;
  }
}
