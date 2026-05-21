/**
 * buildModulePalette — Converts a GameModule's entity types into palette items.
 *
 * For each entity type with templates, generates PaletteItem entries.
 * For types without templates, generates a single default entry.
 * This enables new game modules to automatically populate the Entity Palette
 * without hardcoded switch statements.
 */

import type { GameModule, EntityTypeSchema } from "../GameModule";

/** Minimal palette item shape matching WorldStudio's PaletteItem. */
export interface ModulePaletteItem {
  id: string;
  name: string;
  /** The palette category this item belongs to (from the module) */
  category: string;
  description?: string;
  /** The entity type schema this item creates */
  entityTypeId: string;
  /** Template ID within the schema (if from a template) */
  templateId?: string;
  /** Hex color from the entity type schema */
  color: string;
  /** Lucide icon name from the entity type schema */
  icon: string;
  /** Default values to merge when creating this entity */
  defaults: Record<string, unknown>;
}

/** Category display info derived from the game module. */
export interface ModulePaletteCategory {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  items: ModulePaletteItem[];
}

/**
 * Build palette categories and items from a game module.
 * Returns only categories that have at least one item.
 */
export function buildModulePalette(
  module: GameModule,
): ModulePaletteCategory[] {
  // Group entity types by palette category
  const byCategory = new Map<string, EntityTypeSchema[]>();
  for (const et of module.entityTypes) {
    const arr = byCategory.get(et.paletteCategory);
    if (arr) arr.push(et);
    else byCategory.set(et.paletteCategory, [et]);
  }

  const categories: ModulePaletteCategory[] = [];

  for (const catDef of module.paletteCategories) {
    const entityTypes = byCategory.get(catDef.id) ?? [];
    if (entityTypes.length === 0) continue;

    const items: ModulePaletteItem[] = [];

    for (const et of entityTypes) {
      if (et.templates && et.templates.length > 0) {
        // One palette item per template
        for (const tpl of et.templates) {
          items.push({
            id: tpl.id,
            name: tpl.name,
            category: catDef.id,
            description: tpl.description,
            entityTypeId: et.id,
            templateId: tpl.id,
            color: et.color,
            icon: et.icon,
            defaults: { ...et.defaults, ...tpl.defaults },
          });
        }
      } else {
        // Single default item for entity types without templates
        items.push({
          id: et.id,
          name: et.name,
          category: catDef.id,
          description: `Place a ${et.name.toLowerCase()}`,
          entityTypeId: et.id,
          color: et.color,
          icon: et.icon,
          defaults: { ...et.defaults },
        });
      }
    }

    categories.push({
      id: catDef.id,
      label: catDef.label,
      icon: catDef.icon,
      description: catDef.description,
      color: entityTypes[0]?.color ?? "#7A7A82",
      items,
    });
  }

  return categories;
}
