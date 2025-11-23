/**
 * TemplateRepository - Character template management operations
 *
 * Handles character template (archetype) retrieval from the database.
 * Templates are pre-configured character archetypes that players can choose
 * when creating new characters (e.g., "The Skiller", "PvM Slayer").
 *
 * Responsibilities:
 * - Get all available character templates
 * - Get template by ID
 * - Get template by name
 * - Get template configuration JSON
 *
 * Used by: Template routes, Character creation system
 */

import { eq } from "drizzle-orm";
import { BaseRepository } from "./BaseRepository";
import * as schema from "../schema";

/**
 * Template data structure returned by repository methods
 */
export type TemplateRow = {
  id: number;
  name: string;
  description: string;
  emoji: string;
  templateUrl: string;
  templateConfig: string | null;
  createdAt: number;
};

/**
 * TemplateRepository class
 *
 * Provides all character template management operations.
 */
export class TemplateRepository extends BaseRepository {
  /**
   * Get all character templates
   *
   * Retrieves all available character templates ordered by ID.
   * Used to populate the character template selection screen.
   *
   * @returns Array of all character templates
   */
  async getAllTemplates(): Promise<TemplateRow[]> {
    this.ensureDatabase();

    console.log("[TemplateRepository] 📋 Loading all character templates");

    const results = await this.db
      .select()
      .from(schema.characterTemplates)
      .orderBy(schema.characterTemplates.id);

    console.log(
      `[TemplateRepository] 📋 Found ${results.length} character templates`,
    );

    return results.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      emoji: row.emoji,
      templateUrl: row.templateUrl,
      templateConfig: row.templateConfig,
      createdAt: row.createdAt,
    }));
  }

  /**
   * Get template by ID
   *
   * Retrieves a specific character template by its database ID.
   *
   * @param templateId - The template ID to fetch
   * @returns Template data or null if not found
   */
  async getTemplateById(templateId: number): Promise<TemplateRow | null> {
    this.ensureDatabase();

    console.log(
      `[TemplateRepository] 📋 Loading template by ID: ${templateId}`,
    );

    const results = await this.db
      .select()
      .from(schema.characterTemplates)
      .where(eq(schema.characterTemplates.id, templateId))
      .limit(1);

    if (results.length === 0) {
      console.log(`[TemplateRepository] ⚠️ Template not found: ${templateId}`);
      return null;
    }

    const row = results[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      emoji: row.emoji,
      templateUrl: row.templateUrl,
      templateConfig: row.templateConfig,
      createdAt: row.createdAt,
    };
  }

  /**
   * Get template by name
   *
   * Retrieves a character template by its name (e.g., "The Skiller").
   * Used for legacy filename-based lookups.
   *
   * @param templateName - The template name to search for
   * @returns Template data or null if not found
   */
  async getTemplateByName(templateName: string): Promise<TemplateRow | null> {
    this.ensureDatabase();

    console.log(
      `[TemplateRepository] 📋 Loading template by name: ${templateName}`,
    );

    const results = await this.db
      .select()
      .from(schema.characterTemplates)
      .where(eq(schema.characterTemplates.name, templateName))
      .limit(1);

    if (results.length === 0) {
      console.log(
        `[TemplateRepository] ⚠️ Template not found: ${templateName}`,
      );
      return null;
    }

    const row = results[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      emoji: row.emoji,
      templateUrl: row.templateUrl,
      templateConfig: row.templateConfig,
      createdAt: row.createdAt,
    };
  }
}

