/**
 * Character Routes - ElizaOS Character File Management & Database Operations
 *
 * REST API endpoints for:
 * 1. Saving and managing ElizaOS character JSON files (.eliza/data/characters/)
 * 2. Database character management (delete, update isAgent flag)
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
 * - DELETE /api/characters/:id - Delete a character from database
 * - PATCH /api/characters/:id - Update character properties (isAgent flag)
 *
 * @param fastify - Fastify server instance
 * @param world - Game world instance (optional, for database operations)
 */
export function registerCharacterRoutes(
  fastify: FastifyInstance,
  world?: World,
): void {
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

  /**
   * POST /api/characters/db
   *
   * Create a character in the Hyperscape database.
   * This endpoint is separate from the file-saving endpoint above.
   *
   * Request body:
   * {
   *   accountId: string,
   *   name: string,
   *   avatar?: string,
   *   wallet?: string,
   *   isAgent?: boolean
   * }
   *
   * Response:
   * {
   *   success: true,
   *   character: { id, name, avatar, wallet, isAgent }
   * }
   */
  fastify.post("/api/characters/db", async (request, reply) => {
    try {
      const body = request.body as {
        accountId: string;
        name: string;
        avatar?: string;
        wallet?: string;
        isAgent?: boolean;
      };

      if (!body.accountId || !body.name) {
        return reply.status(400).send({
          success: false,
          error: "Missing required fields: accountId, name",
        });
      }

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

      // Generate UUID for character ID
      const characterId = crypto.randomUUID();

      console.log("[CharacterRoutes] Creating character in database:", {
        id: characterId,
        accountId: body.accountId,
        name: body.name,
        avatar: body.avatar,
        wallet: body.wallet,
        isAgent: body.isAgent,
      });

      // Create character in database
      const created = await databaseSystem.createCharacter(
        body.accountId,
        characterId,
        body.name,
        body.avatar,
        body.wallet,
        body.isAgent,
      );

      if (!created) {
        return reply.status(409).send({
          success: false,
          error: "Character with this ID already exists",
        });
      }

      console.log(
        `[CharacterRoutes] ✅ Character created in database: ${characterId}`,
      );

      return reply.send({
        success: true,
        character: {
          id: characterId,
          name: body.name,
          avatar: body.avatar,
          wallet: body.wallet,
          isAgent: body.isAgent || false,
        },
      });
    } catch (error) {
      console.error(
        "[CharacterRoutes] ❌ Failed to create character in database:",
        error,
      );

      return reply.status(500).send({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create character",
      });
    }
  });

  // Database character management routes (require world instance)
  if (world) {
    const databaseSystem = world.getSystem("database") as DatabaseSystem;

    if (!databaseSystem) {
      console.warn(
        "[CharacterRoutes] DatabaseSystem not found - database routes disabled",
      );
    } else {
      /**
       * DELETE /api/characters/:id
       *
       * Delete a character by ID from database.
       * Used when users cancel agent creation or explicitly delete unwanted characters.
       *
       * Path Parameters:
       *   - id: string - The character ID to delete
       *
       * Response:
       * {
       *   success: true,
       *   message: "Character deleted successfully"
       * }
       */
      fastify.delete<{
        Params: { id: string };
      }>("/api/characters/:id", async (request, reply) => {
        const { id } = request.params;

        if (!id) {
          return reply.status(400).send({
            success: false,
            error: "Missing character ID parameter",
          });
        }

        console.log(`[CharacterRoutes] 🗑️  Deleting character: ${id}`);

        try {
          const deleted = await databaseSystem.deleteCharacter(id);

          if (deleted) {
            console.log(
              `[CharacterRoutes] ✅ Character ${id} deleted successfully`,
            );
            return reply.send({
              success: true,
              message: "Character deleted successfully",
            });
          } else {
            console.log(`[CharacterRoutes] ⚠️  Character ${id} not found`);
            return reply.status(404).send({
              success: false,
              error: "Character not found",
            });
          }
        } catch (error) {
          console.error(
            `[CharacterRoutes] ❌ Error deleting character ${id}:`,
            error,
          );
          return reply.status(500).send({
            success: false,
            error: "Failed to delete character",
          });
        }
      });

      /**
       * GET /api/characters/:id/skills
       *
       * Get a character's current skills data.
       * Used by the dashboard to display agent skills in real-time.
       *
       * Path Parameters:
       *   - id: string - The character ID
       *
       * Response:
       * {
       *   success: true,
       *   skills: {
       *     attack: { level: 1, xp: 0 },
       *     strength: { level: 1, xp: 0 },
       *     ...
       *   }
       * }
       */
      fastify.get<{
        Params: { id: string };
      }>("/api/characters/:id/skills", async (request, reply) => {
        const { id } = request.params;

        if (!id) {
          return reply.status(400).send({
            success: false,
            error: "Missing character ID parameter",
          });
        }

        console.log(
          `[CharacterRoutes] 📊 Fetching skills for character: ${id}`,
        );

        try {
          // Get skills from database
          const skills = await databaseSystem.getCharacterSkills(id);

          if (skills) {
            console.log(
              `[CharacterRoutes] ✅ Skills found for character ${id}`,
            );
            return reply.send({
              success: true,
              skills,
            });
          } else {
            // Return default skills if not found in database
            console.log(
              `[CharacterRoutes] ⚠️  No skills found for ${id}, returning defaults`,
            );
            return reply.send({
              success: true,
              skills: {
                attack: { level: 1, xp: 0 },
                strength: { level: 1, xp: 0 },
                defense: { level: 1, xp: 0 },
                constitution: { level: 10, xp: 0 },
                ranged: { level: 1, xp: 0 },
                woodcutting: { level: 1, xp: 0 },
                fishing: { level: 1, xp: 0 },
                firemaking: { level: 1, xp: 0 },
                cooking: { level: 1, xp: 0 },
              },
            });
          }
        } catch (error) {
          console.error(
            `[CharacterRoutes] ❌ Error fetching skills for ${id}:`,
            error,
          );
          return reply.status(500).send({
            success: false,
            error: "Failed to fetch character skills",
          });
        }
      });

      /**
       * PATCH /api/characters/:id
       *
       * Update a character's properties.
       * Currently supports updating the isAgent flag to convert between agent and human types.
       *
       * Path Parameters:
       *   - id: string - The character ID to update
       *
       * Request body:
       * {
       *   isAgent: boolean
       * }
       *
       * Response:
       * {
       *   success: true,
       *   message: "Character converted to human player successfully"
       * }
       */
      fastify.patch<{
        Params: { id: string };
        Body: { isAgent?: boolean };
      }>("/api/characters/:id", async (request, reply) => {
        const { id } = request.params;
        const { isAgent } = request.body;

        if (!id) {
          return reply.status(400).send({
            success: false,
            error: "Missing character ID parameter",
          });
        }

        if (isAgent === undefined) {
          return reply.status(400).send({
            success: false,
            error: "Missing isAgent field in request body",
          });
        }

        console.log(
          `[CharacterRoutes] 🔄 Updating character ${id} to ${isAgent ? "agent" : "human"}`,
        );

        try {
          const updated = await databaseSystem.updateCharacterIsAgent(
            id,
            isAgent,
          );

          if (updated) {
            console.log(
              `[CharacterRoutes] ✅ Character ${id} updated to ${isAgent ? "agent" : "human"}`,
            );
            return reply.send({
              success: true,
              message: `Character converted to ${isAgent ? "agent" : "human player"} successfully`,
            });
          } else {
            console.log(`[CharacterRoutes] ⚠️  Character ${id} not found`);
            return reply.status(404).send({
              success: false,
              error: "Character not found",
            });
          }
        } catch (error) {
          console.error(
            `[CharacterRoutes] ❌ Error updating character ${id}:`,
            error,
          );
          return reply.status(500).send({
            success: false,
            error: "Failed to update character",
          });
        }
      });
    }
  }

  console.log("[CharacterRoutes] ✅ Character routes registered");
}
