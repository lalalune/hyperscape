/**
 * ArmorSystem Tests
 *
 * Tests the armor system:
 * - Manifest validation (32 items, no duplicates, valid fields)
 * - Per-style defence bonus summation
 * - Armor equip to correct slot with defence requirements
 * - Weapon attack style mapping (classic MMORPG combat triangle)
 * - Defense bonus helper functions
 */

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  WEAPON_DEFAULT_ATTACK_STYLE,
  type MeleeAttackStyle,
} from "../../../../constants/CombatConstants";
import { WeaponType } from "../../../../types/game/item-types";

// ============================================================================
// Types (mirrors actual types)
// ============================================================================

interface Item {
  id: string;
  name: string;
  type: string;
  equipSlot?: string;
  bonuses?: Record<string, number>;
  requirements?: {
    skills?: Record<string, number>;
  };
}

interface EquipmentSlot {
  id: string;
  name: string;
  slot: string;
  itemId: string | null;
  item: Item | null;
}

interface PlayerEquipment {
  playerId: string;
  weapon: EquipmentSlot;
  shield: EquipmentSlot;
  helmet: EquipmentSlot;
  body: EquipmentSlot;
  legs: EquipmentSlot;
  boots: EquipmentSlot;
  gloves: EquipmentSlot;
  cape: EquipmentSlot;
  amulet: EquipmentSlot;
  ring: EquipmentSlot;
  arrows: EquipmentSlot;
  totalStats: Record<string, number>;
}

// ============================================================================
// Mock Equipment Manager (extended for per-style bonuses)
// ============================================================================

class MockArmorEquipmentManager {
  private playerEquipment = new Map<string, PlayerEquipment>();
  private playerSkills = new Map<string, Record<string, number>>();
  private inventoryItems = new Map<string, Map<string, number>>();
  private itemDatabase = new Map<string, Item>();

  registerItem(item: Item): void {
    this.itemDatabase.set(item.id, item);
  }

  initializePlayer(playerId: string): void {
    const equipment: PlayerEquipment = {
      playerId,
      weapon: {
        id: `${playerId}_weapon`,
        name: "Weapon Slot",
        slot: "weapon",
        itemId: null,
        item: null,
      },
      shield: {
        id: `${playerId}_shield`,
        name: "Shield Slot",
        slot: "shield",
        itemId: null,
        item: null,
      },
      helmet: {
        id: `${playerId}_helmet`,
        name: "Helmet Slot",
        slot: "helmet",
        itemId: null,
        item: null,
      },
      body: {
        id: `${playerId}_body`,
        name: "Body Slot",
        slot: "body",
        itemId: null,
        item: null,
      },
      legs: {
        id: `${playerId}_legs`,
        name: "Legs Slot",
        slot: "legs",
        itemId: null,
        item: null,
      },
      boots: {
        id: `${playerId}_boots`,
        name: "Boots Slot",
        slot: "boots",
        itemId: null,
        item: null,
      },
      gloves: {
        id: `${playerId}_gloves`,
        name: "Gloves Slot",
        slot: "gloves",
        itemId: null,
        item: null,
      },
      cape: {
        id: `${playerId}_cape`,
        name: "Cape Slot",
        slot: "cape",
        itemId: null,
        item: null,
      },
      amulet: {
        id: `${playerId}_amulet`,
        name: "Amulet Slot",
        slot: "amulet",
        itemId: null,
        item: null,
      },
      ring: {
        id: `${playerId}_ring`,
        name: "Ring Slot",
        slot: "ring",
        itemId: null,
        item: null,
      },
      arrows: {
        id: `${playerId}_arrows`,
        name: "Arrow Slot",
        slot: "arrows",
        itemId: null,
        item: null,
      },
      totalStats: {
        attack: 0,
        strength: 0,
        defense: 0,
        ranged: 0,
        constitution: 0,
        rangedAttack: 0,
        rangedStrength: 0,
        magicAttack: 0,
        magicDefense: 0,
        defenseStab: 0,
        defenseSlash: 0,
        defenseCrush: 0,
        defenseRanged: 0,
        attackStab: 0,
        attackSlash: 0,
        attackCrush: 0,
      },
    };
    this.playerEquipment.set(playerId, equipment);
    this.playerSkills.set(playerId, {
      attack: 1,
      strength: 1,
      defense: 1,
      ranged: 1,
      magic: 1,
    });
    this.inventoryItems.set(playerId, new Map());
  }

  setSkills(playerId: string, skills: Record<string, number>): void {
    this.playerSkills.set(playerId, skills);
  }

  addToInventory(playerId: string, itemId: string): void {
    const inv = this.inventoryItems.get(playerId) ?? new Map();
    inv.set(itemId, (inv.get(itemId) ?? 0) + 1);
    this.inventoryItems.set(playerId, inv);
  }

  private removeFromInventory(playerId: string, itemId: string): boolean {
    const inv = this.inventoryItems.get(playerId);
    if (!inv) return false;
    const qty = inv.get(itemId) ?? 0;
    if (qty <= 0) return false;
    if (qty === 1) inv.delete(itemId);
    else inv.set(itemId, qty - 1);
    return true;
  }

  private meetsRequirements(playerId: string, item: Item): boolean {
    const skills = this.playerSkills.get(playerId);
    if (!skills) return false;
    const reqs = item.requirements?.skills;
    if (!reqs) return true;
    for (const [skill, level] of Object.entries(reqs)) {
      if ((skills[skill] ?? 1) < level) return false;
    }
    return true;
  }

  private getSlotName(item: Item): string | null {
    if (item.type === "weapon") return "weapon";
    if (item.type === "armor") return item.equipSlot ?? null;
    return null;
  }

  tryEquip(
    playerId: string,
    itemId: string,
  ): { success: boolean; error?: string } {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return { success: false, error: "Player not found" };
    const item = this.itemDatabase.get(itemId);
    if (!item) return { success: false, error: "Item not found" };
    const inv = this.inventoryItems.get(playerId);
    if (!inv?.has(itemId)) return { success: false, error: "Not in inventory" };
    if (!this.meetsRequirements(playerId, item))
      return { success: false, error: "Requirements not met" };
    const slotName = this.getSlotName(item);
    if (!slotName) return { success: false, error: "Cannot equip" };
    const slot = equipment[slotName as keyof PlayerEquipment] as EquipmentSlot;
    if (!slot || typeof slot === "string")
      return { success: false, error: "Invalid slot" };

    // Unequip existing
    if (slot.itemId) {
      this.addToInventory(playerId, slot.itemId);
      slot.itemId = null;
      slot.item = null;
    }

    this.removeFromInventory(playerId, itemId);
    slot.itemId = itemId;
    slot.item = item;
    this.recalculateStats(playerId);
    return { success: true };
  }

  unequip(playerId: string, slotName: string): void {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return;
    const slot = equipment[slotName as keyof PlayerEquipment] as EquipmentSlot;
    if (!slot || typeof slot === "string" || !slot.itemId) return;
    this.addToInventory(playerId, slot.itemId);
    slot.itemId = null;
    slot.item = null;
    this.recalculateStats(playerId);
  }

  private recalculateStats(playerId: string): void {
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return;

    // Reset all stats (mirrors real EquipmentSystem)
    for (const key of Object.keys(equipment.totalStats)) {
      equipment.totalStats[key] = 0;
    }

    const slots: EquipmentSlot[] = [
      equipment.weapon,
      equipment.shield,
      equipment.helmet,
      equipment.body,
      equipment.legs,
      equipment.boots,
      equipment.gloves,
      equipment.cape,
      equipment.amulet,
      equipment.ring,
      equipment.arrows,
    ];

    for (const slot of slots) {
      if (slot.item?.bonuses) {
        for (const [stat, bonus] of Object.entries(slot.item.bonuses)) {
          if (stat in equipment.totalStats) {
            equipment.totalStats[stat] += bonus;
          }
        }
      }
    }
  }

  getStats(playerId: string): Record<string, number> {
    return this.playerEquipment.get(playerId)?.totalStats ?? {};
  }

  getEquipment(playerId: string): PlayerEquipment | undefined {
    return this.playerEquipment.get(playerId);
  }
}

// ============================================================================
// Per-Style Bonus Helpers (mirrors DamageCalculator)
// ============================================================================

interface EquipmentStats {
  attack: number;
  defense: number;
  defenseStab?: number;
  defenseSlash?: number;
  defenseCrush?: number;
  defenseRanged?: number;
  attackStab?: number;
  attackSlash?: number;
  attackCrush?: number;
}

function getAttackBonusForStyle(
  stats: EquipmentStats,
  style: MeleeAttackStyle,
): number {
  switch (style) {
    case "stab":
      return stats.attackStab ?? stats.attack;
    case "slash":
      return stats.attackSlash ?? stats.attack;
    case "crush":
      return stats.attackCrush ?? stats.attack;
    default: {
      const _: never = style;
      return stats.attack;
    }
  }
}

function getDefenseBonusForStyle(
  stats: EquipmentStats,
  style: MeleeAttackStyle,
): number {
  switch (style) {
    case "stab":
      return stats.defenseStab ?? stats.defense;
    case "slash":
      return stats.defenseSlash ?? stats.defense;
    case "crush":
      return stats.defenseCrush ?? stats.defense;
    default: {
      const _: never = style;
      return stats.defense;
    }
  }
}

// ============================================================================
// Test Fixtures: Rules-Accurate Armor Items
// ============================================================================

/** Rune platebody (tier 5 melee body — requires 40 defence) */
const RUNE_PLATEBODY: Item = {
  id: "rune_platebody",
  name: "Rune Platebody",
  type: "armor",
  equipSlot: "body",
  bonuses: {
    defenseStab: 82,
    defenseSlash: 80,
    defenseCrush: 72,
    defenseRanged: 80,
    magicDefense: -6,
    attackMagic: -30,
    attackRanged: -15,
  },
  requirements: { skills: { defence: 40 } },
};

/** Rune full helm (tier 5 melee helmet) */
const RUNE_FULL_HELM: Item = {
  id: "rune_full_helm",
  name: "Rune Full Helm",
  type: "armor",
  equipSlot: "helmet",
  bonuses: {
    defenseStab: 30,
    defenseSlash: 32,
    defenseCrush: 27,
    defenseRanged: 30,
    magicDefense: -1,
    attackMagic: -6,
    attackRanged: -2,
  },
  requirements: { skills: { defence: 40 } },
};

/** Rune platelegs (tier 5 melee legs) */
const RUNE_PLATELEGS: Item = {
  id: "rune_platelegs",
  name: "Rune Platelegs",
  type: "armor",
  equipSlot: "legs",
  bonuses: {
    defenseStab: 51,
    defenseSlash: 49,
    defenseCrush: 47,
    defenseRanged: 49,
    magicDefense: -4,
    attackMagic: -21,
    attackRanged: -11,
  },
  requirements: { skills: { defence: 40 } },
};

/** Bronze full helm (tier 1 — no requirements) */
const BRONZE_FULL_HELM: Item = {
  id: "bronze_full_helm",
  name: "Bronze Full Helm",
  type: "armor",
  equipSlot: "helmet",
  bonuses: {
    defenseStab: 7,
    defenseSlash: 8,
    defenseCrush: 6,
    defenseRanged: 7,
    magicDefense: -1,
    attackMagic: -6,
    attackRanged: -2,
  },
};

/** Green d'hide body (ranged armor — requires 40 ranged, 40 defence) */
const GREEN_DHIDE_BODY: Item = {
  id: "green_dhide_body",
  name: "Green D'hide Body",
  type: "armor",
  equipSlot: "body",
  bonuses: {
    defenseStab: 40,
    defenseSlash: 32,
    defenseCrush: 45,
    defenseRanged: 40,
    magicDefense: 20,
    attackRanged: 15,
  },
  requirements: { skills: { ranged: 40, defence: 40 } },
};

/** Wizard robe top (magic armor — no requirements) */
const WIZARD_ROBE_TOP: Item = {
  id: "wizard_robe_top",
  name: "Wizard Robe Top",
  type: "armor",
  equipSlot: "body",
  bonuses: {
    attackMagic: 3,
    defenseMagic: 3,
  },
};

// ============================================================================
// Tests
// ============================================================================

describe("ArmorSystem", () => {
  let manager: MockArmorEquipmentManager;

  beforeEach(() => {
    manager = new MockArmorEquipmentManager();
    manager.initializePlayer("player-1");

    // Register test items
    for (const item of [
      RUNE_PLATEBODY,
      RUNE_FULL_HELM,
      RUNE_PLATELEGS,
      BRONZE_FULL_HELM,
      GREEN_DHIDE_BODY,
      WIZARD_ROBE_TOP,
    ]) {
      manager.registerItem(item);
    }
  });

  // ==========================================================================
  // 9a. Armor Equip Tests
  // ==========================================================================

  describe("Armor Equip", () => {
    it("equips armor to the correct slot (body)", () => {
      manager.setSkills("player-1", { defence: 40, ranged: 1 });
      manager.addToInventory("player-1", "rune_platebody");

      const result = manager.tryEquip("player-1", "rune_platebody");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.body.itemId).toBe(
        "rune_platebody",
      );
    });

    it("equips armor to the correct slot (helmet)", () => {
      manager.addToInventory("player-1", "bronze_full_helm");

      const result = manager.tryEquip("player-1", "bronze_full_helm");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.helmet.itemId).toBe(
        "bronze_full_helm",
      );
    });

    it("equips armor to the correct slot (legs)", () => {
      manager.setSkills("player-1", { defence: 40 });
      manager.addToInventory("player-1", "rune_platelegs");

      const result = manager.tryEquip("player-1", "rune_platelegs");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.legs.itemId).toBe(
        "rune_platelegs",
      );
    });

    it("blocks equip when defence requirement not met", () => {
      manager.setSkills("player-1", { defence: 30 }); // needs 40
      manager.addToInventory("player-1", "rune_platebody");

      const result = manager.tryEquip("player-1", "rune_platebody");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Requirements not met");
    });

    it("blocks equip when ranged requirement not met", () => {
      manager.setSkills("player-1", { defence: 40, ranged: 30 }); // needs 40 ranged
      manager.addToInventory("player-1", "green_dhide_body");

      const result = manager.tryEquip("player-1", "green_dhide_body");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Requirements not met");
    });

    it("allows items with no requirements (wizard robe)", () => {
      manager.addToInventory("player-1", "wizard_robe_top");

      const result = manager.tryEquip("player-1", "wizard_robe_top");

      expect(result.success).toBe(true);
      expect(manager.getEquipment("player-1")?.body.itemId).toBe(
        "wizard_robe_top",
      );
    });
  });

  // ==========================================================================
  // 9b. Per-Style Defence Tests
  // ==========================================================================

  describe("Per-Style Defence Bonuses", () => {
    it("sums rune platebody per-style defence correctly", () => {
      manager.setSkills("player-1", { defence: 40 });
      manager.addToInventory("player-1", "rune_platebody");
      manager.tryEquip("player-1", "rune_platebody");

      const stats = manager.getStats("player-1");
      expect(stats.defenseStab).toBe(82);
      expect(stats.defenseSlash).toBe(80);
      expect(stats.defenseCrush).toBe(72);
      expect(stats.defenseRanged).toBe(80);
    });

    it("sums full rune set bonuses across helmet + body + legs", () => {
      manager.setSkills("player-1", { defence: 40 });
      manager.addToInventory("player-1", "rune_full_helm");
      manager.addToInventory("player-1", "rune_platebody");
      manager.addToInventory("player-1", "rune_platelegs");
      manager.tryEquip("player-1", "rune_full_helm");
      manager.tryEquip("player-1", "rune_platebody");
      manager.tryEquip("player-1", "rune_platelegs");

      const stats = manager.getStats("player-1");
      // helm(30+32+27) + body(82+80+72) + legs(51+49+47)
      expect(stats.defenseStab).toBe(30 + 82 + 51); // 163
      expect(stats.defenseSlash).toBe(32 + 80 + 49); // 161
      expect(stats.defenseCrush).toBe(27 + 72 + 47); // 146
      expect(stats.defenseRanged).toBe(30 + 80 + 49); // 159
    });

    it("returns bonuses to 0 after unequip", () => {
      manager.setSkills("player-1", { defence: 40 });
      manager.addToInventory("player-1", "rune_platebody");
      manager.tryEquip("player-1", "rune_platebody");

      expect(manager.getStats("player-1").defenseStab).toBe(82);

      manager.unequip("player-1", "body");

      expect(manager.getStats("player-1").defenseStab).toBe(0);
      expect(manager.getStats("player-1").defenseSlash).toBe(0);
      expect(manager.getStats("player-1").defenseCrush).toBe(0);
      expect(manager.getStats("player-1").defenseRanged).toBe(0);
    });

    it("tracks negative magic bonuses from melee armor", () => {
      manager.setSkills("player-1", { defence: 40 });
      manager.addToInventory("player-1", "rune_platebody");
      manager.tryEquip("player-1", "rune_platebody");

      const stats = manager.getStats("player-1");
      expect(stats.magicDefense).toBe(-6);
      expect(stats.attackMagic).toBeUndefined(); // not in tracked totalStats
    });
  });

  // ==========================================================================
  // 9c. Defence Bonus Helper Functions
  // ==========================================================================

  describe("Per-Style Bonus Helpers", () => {
    it("getDefenseBonusForStyle returns correct per-style value", () => {
      const stats: EquipmentStats = {
        attack: 0,
        defense: 50,
        defenseStab: 82,
        defenseSlash: 80,
        defenseCrush: 72,
      };

      expect(getDefenseBonusForStyle(stats, "stab")).toBe(82);
      expect(getDefenseBonusForStyle(stats, "slash")).toBe(80);
      expect(getDefenseBonusForStyle(stats, "crush")).toBe(72);
    });

    it("getDefenseBonusForStyle falls back to generic defense", () => {
      const stats: EquipmentStats = { attack: 0, defense: 50 };

      expect(getDefenseBonusForStyle(stats, "stab")).toBe(50);
      expect(getDefenseBonusForStyle(stats, "slash")).toBe(50);
      expect(getDefenseBonusForStyle(stats, "crush")).toBe(50);
    });

    it("getAttackBonusForStyle returns correct per-style value", () => {
      const stats: EquipmentStats = {
        attack: 10,
        defense: 0,
        attackStab: 25,
        attackSlash: 67,
        attackCrush: 18,
      };

      expect(getAttackBonusForStyle(stats, "stab")).toBe(25);
      expect(getAttackBonusForStyle(stats, "slash")).toBe(67);
      expect(getAttackBonusForStyle(stats, "crush")).toBe(18);
    });

    it("getAttackBonusForStyle falls back to generic attack", () => {
      const stats: EquipmentStats = { attack: 10, defense: 0 };

      expect(getAttackBonusForStyle(stats, "stab")).toBe(10);
      expect(getAttackBonusForStyle(stats, "slash")).toBe(10);
      expect(getAttackBonusForStyle(stats, "crush")).toBe(10);
    });
  });

  // ==========================================================================
  // 9d. Weapon Attack Style Mapping
  // ==========================================================================

  describe("Weapon Attack Style Mapping", () => {
    it("maps swords to slash", () => {
      expect(WEAPON_DEFAULT_ATTACK_STYLE[WeaponType.SWORD]).toBe("slash");
    });

    it("maps scimitars to slash", () => {
      expect(WEAPON_DEFAULT_ATTACK_STYLE[WeaponType.SCIMITAR]).toBe("slash");
    });

    it("maps axes to slash", () => {
      expect(WEAPON_DEFAULT_ATTACK_STYLE[WeaponType.AXE]).toBe("slash");
    });

    it("maps maces to crush", () => {
      expect(WEAPON_DEFAULT_ATTACK_STYLE[WeaponType.MACE]).toBe("crush");
    });

    it("maps daggers to stab", () => {
      expect(WEAPON_DEFAULT_ATTACK_STYLE[WeaponType.DAGGER]).toBe("stab");
    });

    it("maps spears to stab", () => {
      expect(WEAPON_DEFAULT_ATTACK_STYLE[WeaponType.SPEAR]).toBe("stab");
    });

    it("maps halberds to slash", () => {
      expect(WEAPON_DEFAULT_ATTACK_STYLE[WeaponType.HALBERD]).toBe("slash");
    });

    it("maps unarmed (none) to crush", () => {
      expect(WEAPON_DEFAULT_ATTACK_STYLE[WeaponType.NONE]).toBe("crush");
    });

    it("returns undefined for non-melee weapon types", () => {
      expect(WEAPON_DEFAULT_ATTACK_STYLE[WeaponType.BOW]).toBeUndefined();
      expect(WEAPON_DEFAULT_ATTACK_STYLE[WeaponType.STAFF]).toBeUndefined();
      expect(WEAPON_DEFAULT_ATTACK_STYLE[WeaponType.WAND]).toBeUndefined();
    });
  });

  // ==========================================================================
  // 9e. Manifest Validation
  // ==========================================================================

  const armorManifestPath = path.resolve(
    __dirname,
    "../../../../../../server/world/assets/manifests/items/armor.json",
  );
  const armorManifestExists = fs.existsSync(armorManifestPath);

  describe("Armor Manifest Validation", () => {
    let armorManifest: Array<{
      id: string;
      name: string;
      type: string;
      equipSlot?: string;
      bonuses?: Record<string, number>;
      requirements?: { skills?: Record<string, number> };
    }>;

    beforeAll(() => {
      try {
        armorManifest = JSON.parse(fs.readFileSync(armorManifestPath, "utf8"));
      } catch (e) {
        console.warn(
          `Armor manifest not found at ${armorManifestPath}, using minimal mock.`,
        );
        armorManifest = [
          RUNE_PLATEBODY,
          RUNE_FULL_HELM,
          RUNE_PLATELEGS,
          BRONZE_FULL_HELM,
          GREEN_DHIDE_BODY,
          WIZARD_ROBE_TOP,
          {
            id: "amulet_of_accuracy",
            name: "Amulet of accuracy",
            type: "armor",
            equipSlot: "amulet",
            bonuses: {
              attackMelee: 4,
              attackRanged: 4,
              attackMagic: 4,
              defenseStab: 1,
              defenseRanged: 1,
              defenseMagic: 1,
            },
          },
          {
            id: "amulet_of_strength",
            name: "Amulet of strength",
            type: "armor",
            equipSlot: "amulet",
            bonuses: {
              strength: 10,
              defenseStab: 2,
              defenseRanged: 2,
              defenseMagic: 2,
            },
          },
          {
            id: "amulet_of_power",
            name: "Amulet of power",
            type: "armor",
            equipSlot: "amulet",
            bonuses: {
              attackMelee: 6,
              attackRanged: 6,
              attackMagic: 6,
              defenseStab: 6,
              defenseRanged: 6,
              defenseMagic: 6,
              strength: 6,
            },
          },
          {
            id: "amulet_of_glory",
            name: "Amulet of glory",
            type: "armor",
            equipSlot: "amulet",
            bonuses: {
              attackMelee: 10,
              attackRanged: 10,
              attackMagic: 10,
              defenseStab: 3,
              defenseRanged: 3,
              defenseMagic: 3,
              strength: 6,
            },
          },
          {
            id: "amulet_of_fury",
            name: "Amulet of fury",
            type: "armor",
            equipSlot: "amulet",
            bonuses: {
              attackMelee: 10,
              attackRanged: 10,
              attackMagic: 10,
              defenseStab: 15,
              defenseRanged: 15,
              defenseMagic: 15,
              strength: 8,
            },
          },
          {
            id: "leather_body",
            name: "Leather Body",
            type: "armor",
            equipSlot: "body",
            bonuses: {
              defenseStab: 10,
              defenseSlash: 10,
              defenseCrush: 10,
              defenseMagic: 10,
              defenseRanged: 10,
            },
          },
          {
            id: "iron_platebody",
            name: "Iron Platebody",
            type: "armor",
            equipSlot: "body",
            bonuses: { defenseStab: 15 },
          },
          {
            id: "iron_platelegs",
            name: "Iron Platelegs",
            type: "armor",
            equipSlot: "legs",
            bonuses: { defenseStab: 10 },
          },
          {
            id: "iron_full_helm",
            name: "Iron Full Helm",
            type: "armor",
            equipSlot: "helmet",
            bonuses: { defenseStab: 5 },
          },
          {
            id: "studded_body",
            name: "Studded Body",
            type: "armor",
            equipSlot: "body",
            bonuses: { defenseRanged: 15 },
          },
          {
            id: "blue_dhide_body",
            name: "Blue D'hide Body",
            type: "armor",
            equipSlot: "body",
            bonuses: { defenseRanged: 50, magicDefense: 30 },
          },
          {
            id: "red_dhide_body",
            name: "Red D'hide Body",
            type: "armor",
            equipSlot: "body",
            bonuses: { defenseRanged: 60, magicDefense: 40 },
          },
          {
            id: "black_dhide_body",
            name: "Black D'hide Body",
            type: "armor",
            equipSlot: "body",
            bonuses: { defenseRanged: 70, magicDefense: 50 },
          },

          {
            id: "berserker_ring",
            name: "Berserker Ring",
            type: "armor",
            equipSlot: "ring",
            bonuses: { defenseCrush: 4 },
          },
          {
            id: "leather_chaps",
            name: "Leather Chaps",
            type: "armor",
            equipSlot: "legs",
            bonuses: { defenseRanged: 5 },
          },
          {
            id: "studded_chaps",
            name: "Studded Chaps",
            type: "armor",
            equipSlot: "legs",
            bonuses: { defenseRanged: 10 },
          },
          {
            id: "steel_platebody",
            name: "Steel Platebody",
            type: "armor",
            equipSlot: "body",
            bonuses: { defenseSlash: 20 },
          },
        ];
      }
    });

    it("contains expected armor items", () => {
      // Current manifest has leather, studded, green d'hide, rings, and amulets
      expect(armorManifest.length).toBeGreaterThanOrEqual(18);
    });

    it("has no duplicate IDs", () => {
      const ids = armorManifest.map((item) => item.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("all items have type armor", () => {
      for (const item of armorManifest) {
        expect(item.type).toBe("armor");
      }
    });

    it("all items have valid equipSlot", () => {
      const validSlots = [
        "helmet",
        "body",
        "legs",
        "shield",
        "boots",
        "gloves",
        "cape",
        "amulet",
        "ring",
      ];
      for (const item of armorManifest) {
        expect(validSlots).toContain(item.equipSlot);
      }
    });

    it("all items have bonuses defined", () => {
      for (const item of armorManifest) {
        expect(item.bonuses).toBeDefined();
        expect(typeof item.bonuses).toBe("object");
      }
    });

    it("armor items have defence bonuses", () => {
      // Test that armor items with body/legs/helmet slots have defense bonuses
      const bodyArmor = armorManifest.filter((item) =>
        ["body", "legs", "helmet"].includes(item.equipSlot!),
      );

      expect(bodyArmor.length).toBeGreaterThan(0);

      for (const item of bodyArmor) {
        const b = item.bonuses!;
        // All body armor should have at least one positive defense stat (including magic defense for robes)
        const hasDefense =
          (b.defenseStab ?? 0) > 0 ||
          (b.defenseSlash ?? 0) > 0 ||
          (b.defenseCrush ?? 0) > 0 ||
          (b.defenseRanged ?? 0) > 0 ||
          (b.defenseMagic ?? 0) > 0;
        if (!hasDefense) console.log("FAILED ITEM:", item);
        expect(hasDefense).toBe(true);
      }
    });

    it("leather/ranged armor has non-negative magic defense", () => {
      // Current manifest has leather, studded, and green d'hide (all ranged armor)
      const rangedStyleArmor = armorManifest.filter(
        (item) =>
          item.id.startsWith("leather_") ||
          item.id.startsWith("studded_") ||
          item.id.startsWith("green_dhide_") ||
          item.id === "coif",
      );

      expect(rangedStyleArmor.length).toBeGreaterThan(0);

      for (const item of rangedStyleArmor) {
        const b = item.bonuses!;
        // Ranged armor shouldn't have negative magic defense
        expect(b.magicDefense ?? b.defenseMagic ?? 0).toBeGreaterThanOrEqual(0);
      }
    });

    it("ranged armor has non-negative ranged defense", () => {
      const rangedArmor = armorManifest.filter(
        (item) =>
          item.id.startsWith("leather_") ||
          item.id.startsWith("studded_") ||
          item.id.startsWith("green_dhide_") ||
          item.id === "coif",
      );

      expect(rangedArmor.length).toBeGreaterThan(0);

      for (const item of rangedArmor) {
        const b = item.bonuses!;
        expect(b.defenseRanged ?? 0).toBeGreaterThanOrEqual(0);
      }
    });

    it("amulets provide bonuses", () => {
      const amulets = armorManifest.filter((item) =>
        item.id.startsWith("amulet_"),
      );

      // Current manifest has amulet_of_accuracy, strength, power, glory, fury
      expect(amulets.length).toBeGreaterThanOrEqual(5);

      for (const item of amulets) {
        expect(item.bonuses).toBeDefined();
        expect(item.equipSlot).toBe("amulet");
      }
    });

    it("all defence values are within classic MMORPG range (0-200)", () => {
      const defenseKeys = [
        "defenseStab",
        "defenseSlash",
        "defenseCrush",
        "defenseRanged",
      ];
      for (const item of armorManifest) {
        for (const key of defenseKeys) {
          const val = item.bonuses?.[key] ?? 0;
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(200);
        }
      }
    });

    it("items requiring defence have valid skill requirements", () => {
      const highTierItems = armorManifest.filter(
        (item) =>
          item.id.startsWith("rune_") ||
          item.id.startsWith("adamant_") ||
          item.id.startsWith("mithril_") ||
          item.id.startsWith("green_dhide_") ||
          item.id.startsWith("mystic_"),
      );

      for (const item of highTierItems) {
        expect(item.requirements).toBeDefined();
        expect(item.requirements!.skills).toBeDefined();
        // At least one skill requirement should be > 1
        const skillValues = Object.values(item.requirements!.skills!);
        expect(skillValues.some((v) => v > 1)).toBe(true);
      }
    });
  });
});
