/**
 * Template Routes - Character Template Management
 *
 * REST API endpoints for:
 * 1. Fetching character templates from database (archetypes)
 * 2. Serving template JSON configs from database for ElizaOS agent creation
 *
 * **Architecture**:
 * - Templates are stored in the `character_templates` table
 * - Each template has metadata (name, description, emoji) AND full ElizaOS config
 * - The `templateConfig` column stores the full character JSON that gets merged with user data
 * - No filesystem JSON files needed - everything is database-driven
 */

import type { FastifyInstance } from "fastify";
import type { World } from "@hyperscape/shared";
import type { DatabaseSystem } from "../../systems/DatabaseSystem/index.js";
import { eq } from "drizzle-orm";
import { characterTemplates } from "../../database/schema.js";

/**
 * Register template management routes
 *
 * Endpoints:
 * - GET /api/templates - Fetch all character templates from database
 * - GET /templates/:filename - Serve template JSON files
 *
 * @param fastify - Fastify server instance
 * @param world - Game world instance (required for database access)
 */
export function registerTemplateRoutes(
  fastify: FastifyInstance,
  world?: World,
): void {
  console.log("[TemplateRoutes] Registering template management routes...");

  /**
   * GET /api/templates
   *
   * Fetch all character templates from the database.
   * Returns template metadata (id, name, description, emoji, templateUrl).
   *
   * Response:
   * {
   *   success: true,
   *   templates: [
   *     { id: 1, name: "The Skiller", description: "...", emoji: "🌳", templateUrl: "..." },
   *     ...
   *   ]
   * }
   */
  fastify.get("/api/templates", async (request, reply) => {
    try {
      if (!world) {
        return reply.status(500).send({
          success: false,
          error: "World instance not available",
        });
      }

      const databaseSystem = world.getSystem("database") as DatabaseSystem;

      if (!databaseSystem) {
        return reply.status(500).send({
          success: false,
          error: "Database system not available",
        });
      }

      console.log(
        "[TemplateRoutes] Fetching character templates from database",
      );

      // Fetch all character templates
      const templates =
        await databaseSystem.db.query.characterTemplates.findMany({
          orderBy: (templates, { asc }) => [asc(templates.id)],
        });

      console.log(
        `[TemplateRoutes] ✅ Found ${templates.length} character templates`,
      );

      return reply.send({
        success: true,
        templates,
      });
    } catch (error) {
      console.error("[TemplateRoutes] ❌ Failed to fetch templates:", error);

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch templates",
      });
    }
  });

  /**
   * GET /api/templates/:templateId/config
   *
   * Serve a character template's full ElizaOS configuration from the database.
   * This is the config that gets merged with user-specific data during agent creation.
   *
   * Path Parameters:
   * - templateId: number - The template ID in the database
   *
   * Response:
   * Full ElizaOS character configuration JSON
   */
  fastify.get<{
    Params: { templateId: string };
  }>("/api/templates/:templateId/config", async (request, reply) => {
    const { templateId } = request.params;
    const id = parseInt(templateId, 10);

    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        success: false,
        error: "Invalid template ID",
      });
    }

    try {
      if (!world) {
        return reply.status(500).send({
          success: false,
          error: "World instance not available",
        });
      }

      const databaseSystem = world.getSystem("database") as DatabaseSystem;
      if (!databaseSystem) {
        return reply.status(500).send({
          success: false,
          error: "Database system not available",
        });
      }

      console.log(`[TemplateRoutes] Fetching template config for ID: ${id}`);

      // Fetch template from database
      const template =
        await databaseSystem.db.query.characterTemplates.findFirst({
          where: eq(characterTemplates.id, id),
        });

      if (!template) {
        console.log(`[TemplateRoutes] ⚠️ Template not found: ${id}`);
        return reply.status(404).send({
          success: false,
          error: "Template not found",
        });
      }

      if (!template.templateConfig) {
        console.log(
          `[TemplateRoutes] ⚠️ Template has no config: ${template.name}`,
        );
        return reply.status(404).send({
          success: false,
          error: "Template configuration not available",
        });
      }

      // Parse and return the template config
      const templateConfig = JSON.parse(template.templateConfig);

      console.log(
        `[TemplateRoutes] ✅ Serving template config: ${template.name}`,
      );

      reply.type("application/json");
      return reply.send(templateConfig);
    } catch (error) {
      console.error(
        "[TemplateRoutes] ❌ Failed to serve template config %s:",
        templateId,
        error,
      );

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to serve template config",
      });
    }
  });

  /**
   * GET /templates/:filename (LEGACY - deprecated)
   *
   * Legacy endpoint for serving template JSON files from filesystem.
   * Maintained for backwards compatibility but redirects to database-backed endpoint.
   *
   * @deprecated Use /api/templates/:templateId/config instead
   */
  fastify.get<{
    Params: { filename: string };
  }>("/templates/:filename", async (request, reply) => {
    const { filename } = request.params;

    // Extract template name from filename (e.g., "skiller.json" -> "skiller")
    const templateName = filename.replace(/\.json$/, "");

    // Map common filenames to template names in database
    const nameMap: Record<string, string> = {
      skiller: "The Skiller",
      pvmer: "PvM Slayer",
      ironman: "Ironman",
      completionist: "Completionist",
    };

    const dbTemplateName = nameMap[templateName.toLowerCase()];

    if (!dbTemplateName) {
      console.log(`[TemplateRoutes] ⚠️ Unknown template filename: ${filename}`);
      return reply.status(404).send({
        success: false,
        error:
          "Template not found. Use /api/templates/:templateId/config instead.",
      });
    }

    try {
      if (!world) {
        return reply.status(500).send({
          success: false,
          error: "World instance not available",
        });
      }

      const databaseSystem = world.getSystem("database") as DatabaseSystem;
      if (!databaseSystem) {
        return reply.status(500).send({
          success: false,
          error: "Database system not available",
        });
      }

      // Fetch template by name from database
      const template =
        await databaseSystem.db.query.characterTemplates.findFirst({
          where: eq(characterTemplates.name, dbTemplateName),
        });

      if (!template || !template.templateConfig) {
        return reply.status(404).send({
          success: false,
          error: "Template configuration not available",
        });
      }

      const templateConfig = JSON.parse(template.templateConfig);

      console.log(
        `[TemplateRoutes] ✅ Serving legacy template: ${template.name}`,
      );

      reply.type("application/json");
      return reply.send(templateConfig);
    } catch (error) {
      console.error(
        `[TemplateRoutes] ❌ Failed to serve legacy template ${filename}:`,
        error,
      );

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to serve template",
      });
    }
  });

  console.log("[TemplateRoutes] ✅ Template routes registered");
}
