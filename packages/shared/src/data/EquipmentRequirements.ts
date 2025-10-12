/**
 * Equipment Requirements Manager
 * Manages level requirements, colors, and starter equipment from JSON data
 */

// Use "with" for Node 22+ loader compatibility per esbuild warning
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - with type is not yet in TS types but supported by loader
import equipmentDataRaw from './equipment-requirements.json' with { type: 'json' };
import type { LevelRequirement, EquipmentDataJSON, StarterEquipmentItem } from '../types/core';

// Type the imported JSON data properly
const equipmentData: EquipmentDataJSON = equipmentDataRaw;

export class EquipmentRequirements {
  private levelRequirements: Map<string, LevelRequirement>;
  private equipmentColors: Map<string, number>;
  private starterEquipment: StarterEquipmentItem[];

  constructor() {
    this.levelRequirements = new Map();
    this.equipmentColors = new Map();
    this.starterEquipment = [];
    this.loadData();
  }

  private loadData(): void {
    // Load level requirements from all categories
    const categories = [
      equipmentData.levelRequirements.weapons,
      equipmentData.levelRequirements.shields,
      equipmentData.levelRequirements.armor.helmets,
      equipmentData.levelRequirements.armor.body,
      equipmentData.levelRequirements.armor.legs,
      equipmentData.levelRequirements.ammunition
    ];

    for (const category of categories) {
      for (const [itemId, requirements] of Object.entries(category)) {
        this.levelRequirements.set(itemId, requirements as LevelRequirement);
      }
    }

    // Load equipment colors
    for (const [material, colorHex] of Object.entries(equipmentData.equipmentColors)) {
      // Convert hex string to number
      const colorNum = parseInt((colorHex as string).replace('#', ''), 16);
      this.equipmentColors.set(material, colorNum);
    }

    // Load starter equipment
    this.starterEquipment = equipmentData.starterEquipment;
  }

  /**
   * Get level requirements for an item
   */
  getLevelRequirements(itemId: string): LevelRequirement | null {
    return this.levelRequirements.get(itemId) || null;
  }

  /**
   * Check if a player meets the level requirements for an item
   */
  meetsRequirements(itemId: string, playerSkills: Record<string, number>): boolean {
    const requirements = this.getLevelRequirements(itemId);
    if (!requirements) {
      return true; // No requirements
    }

    for (const [skill, requiredLevel] of Object.entries(requirements)) {
      const playerLevel = playerSkills[skill] || 1;
      if (playerLevel < requiredLevel) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get color for equipment material
   */
  getEquipmentColor(materialName: string): number | null {
    if (!materialName || typeof materialName !== 'string') {
      return null;
    }
    
    const nameLower = materialName.toLowerCase();
    
    // Check for material types in name
    for (const [material, color] of this.equipmentColors.entries()) {
      if (nameLower.includes(material)) {
        return color;
      }
    }

    return null;
  }

  /**
   * Get default equipment color by type
   */
  getDefaultColorByType(itemType: string): number {
    switch (itemType) {
      case 'weapon': return 0xFFFFFF; // White for weapons
      case 'armor': return 0x8B4513;  // Brown for armor
      case 'arrow': return 0xFFD700;  // Gold for arrows
      default: return 0x808080;       // Gray default
    }
  }

  /**
   * Get starter equipment items
   */
  getStarterEquipment(): StarterEquipmentItem[] {
    return [...this.starterEquipment]; // Return copy to prevent modification
  }

  /**
   * Get all item IDs with level requirements
   */
  getAllRequiredItems(): string[] {
    return Array.from(this.levelRequirements.keys());
  }

  /**
   * Get requirement text for display
   */
  getRequirementText(itemId: string): string {
    const requirements = this.getLevelRequirements(itemId);
    if (!requirements) {
      return '';
    }

    return Object.entries(requirements)
      .map(([skill, level]) => `${skill} ${level}`)
      .join(', ');
  }
}

// Singleton instance for global use
export const equipmentRequirements = new EquipmentRequirements();