/**
 * Template Routes - Character Template Management
 *
 * REST API endpoints for:
 * 1. Fetching character templates from database (archetypes)
 * 2. Serving template JSON files for ElizaOS agent creation
 */

import type { FastifyInstance } from "fastify";
import type { World } from "@hyperscape/shared";
import type { DatabaseSystem } from "../../systems/DatabaseSystem/index.js";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the templates directory
// Default: PROJECT_ROOT/.eliza/data/character-templates/
function getTemplatesDir(): string {
  if (process.env.ELIZA_TEMPLATES_DIR) {
    return process.env.ELIZA_TEMPLATES_DIR;
  }

  const projectRoot = join(__dirname, "../../../../..");
  return join(projectRoot, ".eliza", "data", "character-templates");
}

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
   * GET /templates/:filename
   *
   * Serve a character template JSON file.
   * Reads the file from .eliza/data/character-templates/
   *
   * Path Parameters:
   * - filename: string - The template filename (e.g., "skiller.json")
   *
   * Response:
   * Raw JSON character template file
   */
  fastify.get<{
    Params: { filename: string };
  }>("/templates/:filename", async (request, reply) => {
    const { filename } = request.params;

    // Security: Only allow .json files and alphanumeric + dash + underscore
    if (
      !filename.endsWith(".json") ||
      !/^[a-zA-Z0-9_-]+\.json$/.test(filename)
    ) {
      return reply.status(400).send({
        success: false,
        error: "Invalid filename format",
      });
    }

    try {
      const templatesDir = getTemplatesDir();
      const filePath = join(templatesDir, filename);

      console.log(`[TemplateRoutes] Serving template file: ${filePath}`);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        console.log(`[TemplateRoutes] ⚠️ Template file not found: ${filename}`);
        return reply.status(404).send({
          success: false,
          error: "Template file not found",
        });
      }

      // Read and parse the JSON file
      const fileContents = await fs.readFile(filePath, "utf-8");
      const templateJson = JSON.parse(fileContents);

      console.log(
        `[TemplateRoutes] ✅ Serving template: ${templateJson.name || filename}`,
      );

      // Set content type and return the template
      reply.type("application/json");
      return reply.send(templateJson);
    } catch (error) {
      console.error(
        `[TemplateRoutes] ❌ Failed to serve template ${filename}:`,
        error,
      );

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to serve template file",
      });
    }
  });

  console.log("[TemplateRoutes] ✅ Template routes registered");
}
