/**
 * Character Routes - ElizaOS Character File Management
 *
 * REST API endpoints for saving and managing ElizaOS character JSON files.
 * These files define AI agent personalities and are stored in .eliza/data/characters/
 */

import type { FastifyInstance } from "fastify";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the ElizaOS characters directory
// Default: PROJECT_ROOT/.eliza/data/characters/
function getCharactersDir(): string {
  // Environment variable override
  if (process.env.ELIZA_DATA_DIR_CHARACTERS) {
    return process.env.ELIZA_DATA_DIR_CHARACTERS;
  }

  // Default path: .eliza/data/characters from project root
  const projectRoot = join(__dirname, "../../../../..");
  return join(projectRoot, ".eliza", "data", "characters");
}

/**
 * Register character management routes
 *
 * Endpoints:
 * - POST /api/characters - Save a character JSON file
 *
 * @param fastify - Fastify server instance
 */
export function registerCharacterRoutes(fastify: FastifyInstance): void {
  console.log("[CharacterRoutes] Registering character management routes...");

  /**
   * POST /api/characters
   *
   * Save a character JSON file to .eliza/data/characters/
   *
   * Request body:
   * {
   *   character: { ...characterData },
   *   filename: "character-name.json"
   * }
   *
   * Response:
   * {
   *   success: true,
   *   message: "Character saved successfully",
   *   path: "/path/to/character.json"
   * }
   */
  fastify.post("/api/characters", async (request, reply) => {
    try {
      const body = request.body as {
        character: Record<string, unknown>;
        filename: string;
      };

      if (!body.character || !body.filename) {
        return reply.status(400).send({
          success: false,
          error: "Missing required fields: character, filename",
        });
      }

      // Validate filename (only allow alphanumeric, dash, underscore, and .json)
      const filename = body.filename.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json";

      // Get characters directory
      const charactersDir = getCharactersDir();

      // Ensure directory exists
      await fs.mkdir(charactersDir, { recursive: true });

      // Full file path
      const filePath = join(charactersDir, filename);

      // Write character JSON to file
      await fs.writeFile(
        filePath,
        JSON.stringify(body.character, null, 2),
        "utf-8",
      );

      console.log(`[CharacterRoutes] ✅ Character saved to: ${filePath}`);

      return reply.send({
        success: true,
        message: "Character saved successfully",
        path: filePath,
        filename,
      });
    } catch (error) {
      console.error("[CharacterRoutes] ❌ Failed to save character:", error);

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to save character",
      });
    }
  });

  console.log("[CharacterRoutes] ✅ Character routes registered");
}
