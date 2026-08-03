/**
 * Tier Data Provider
 *
 * Provides rules-accurate tier-based level requirements for equipment and tools.
 * Single source of truth - loaded from tier-requirements.json manifest.
 *
 * Usage:
 * - TierDataProvider.getInstance().getRequirements(tier, itemType, equipSlot)
 * - Returns skill requirements object or null
 */

// Types for tier requirements data
export interface TierRequirements {
  attack?: number;
  defence?: number;
  ranged?: number;
  magic?: number;
  woodcutting?: number;
  mining?: number;
  fishing?: number;
}

export interface MeleeTierData {
  attack: number;
  defence: number;
}

export interface ToolTierData {
  attack: number;
  woodcutting: number;
  mining: number;
}

export interface RangedTierData {
  ranged: number;
  defence: number;
}

export interface MagicTierData {
  magic: number;
  defence?: number;
}

export interface TierRequirementsManifest {
  melee: Record<string, MeleeTierData>;
  tools: Record<string, ToolTierData>;
  ranged: Record<string, RangedTierData>;
  magic: Record<string, MagicTierData>;
}

// Item type for tier derivation
export interface TierableItem {
  id: string;
  type: string;
  tier?: string;
  equipSlot?: string;
  attackType?: string;
  requirements?: {
    level?: number;
    skills?: Record<string, number>;
  };
  tool?: {
    skill: "woodcutting" | "mining" | "fishing";
    priority: number;
    rollTicks?: number;
  };
}

/**
 * TierDataProvider - Singleton for tier-based level requirements
 */
class TierDataProviderImpl {
  private static instance: TierDataProviderImpl;
  private tiers: TierRequirementsManifest | null = null;
  private loaded = false;

  private constructor() {}

  static getInstance(): TierDataProviderImpl {
    if (!TierDataProviderImpl.instance) {
      TierDataProviderImpl.instance = new TierDataProviderImpl();
    }
    return TierDataProviderImpl.instance;
  }

  /**
   * Load tier requirements from manifest data
   */
  load(manifest: TierRequirementsManifest): void {
    this.tiers = manifest;
    this.loaded = true;
  }

  /**
   * Check if tier data is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Reset tier data (for testing)
   */
  reset(): void {
    this.tiers = null;
    this.loaded = false;
  }

  /**
   * Get requirements for an item based on its tier
   *
   * Order of precedence:
   * 1. Explicit item.requirements (for special items like Barrows, fishing tools)
   * 2. Tier-derived requirements (for standard equipment/tools)
   * 3. null (for items without requirements)
   */
  getRequirements(item: TierableItem): TierRequirements | null {
    // 1. Explicit requirements take priority (special items)
    if (item.requirements?.skills) {
      return item.requirements.skills;
    }

    // 2. No tier = no requirements (food, resources)
    if (!item.tier) {
      return null;
    }

    // 3. Tier data not loaded
    if (!this.tiers) {
      return null;
    }

    const tier = item.tier;

    // Tools (hatchets, pickaxes)
    // NOTE: Fishing tools DON'T use tiers - they have explicit requirements
    if (item.type === "tool" && item.tool) {
      // Fishing tools should have explicit requirements field (not tier-based)
      if (item.tool.skill === "fishing") {
        return null; // Use explicit item.requirements instead
      }

      const toolTier = this.tiers.tools[tier];
      if (!toolTier) return null;

      // Return skill requirement based on tool's skill
      if (item.tool.skill === "woodcutting") {
        return {
          attack: toolTier.attack,
          woodcutting: toolTier.woodcutting,
        };
      }
      if (item.tool.skill === "mining") {
        return {
          attack: toolTier.attack,
          mining: toolTier.mining,
        };
      }
    }

    // Weapons
    if (item.equipSlot === "weapon") {
      // Check ranged weapons first
      if (item.attackType === "RANGED") {
        const rangedTier = this.tiers.ranged[tier];
        if (rangedTier) {
          return { ranged: rangedTier.ranged };
        }
      }

      // Check magic weapons
      if (item.attackType === "MAGIC") {
        const magicTier = this.tiers.magic[tier];
        if (magicTier) {
          return { magic: magicTier.magic };
        }
      }

      // Default to melee weapons
      const meleeTier = this.tiers.melee[tier];
      if (meleeTier) {
        return { attack: meleeTier.attack };
      }
    }

    // Armor
    if (
      ["head", "body", "legs", "shield", "hands", "feet", "cape"].includes(
        item.equipSlot || "",
      )
    ) {
      // Check for ranged armor
      const rangedTier = this.tiers.ranged[tier];
      if (rangedTier) {
        return { ranged: rangedTier.ranged, defence: rangedTier.defence };
      }

      // Check for magic armor
      const magicTier = this.tiers.magic[tier];
      if (magicTier) {
        return {
          magic: magicTier.magic,
          defence: magicTier.defence,
        };
      }

      // Default to melee armor
      const meleeTier = this.tiers.melee[tier];
      if (meleeTier) {
        return { defence: meleeTier.defence };
      }
    }

    return null;
  }

  /**
   * Get raw tier data for a specific category and tier
   */
  getTierData(
    category: "melee" | "tools" | "ranged" | "magic",
    tier: string,
  ): MeleeTierData | ToolTierData | RangedTierData | MagicTierData | null {
    if (!this.tiers) return null;
    return this.tiers[category]?.[tier] || null;
  }

  /**
   * Get all available tiers for a category
   */
  getAvailableTiers(
    category: "melee" | "tools" | "ranged" | "magic",
  ): string[] {
    if (!this.tiers) return [];
    return Object.keys(this.tiers[category] || {});
  }
}

// Export singleton accessor
export const TierDataProvider = TierDataProviderImpl.getInstance();

// Export function to load tier data
export function loadTierRequirements(manifest: TierRequirementsManifest): void {
  TierDataProvider.load(manifest);
}

// Export function to check if tier data is loaded
export function isTierDataLoaded(): boolean {
  return TierDataProvider.isLoaded();
}

// Export function to reset tier data (for testing)
export function resetTierData(): void {
  TierDataProvider.reset();
}
