import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";

export const getSettingsRoute: Route = {
  type: "GET",
  path: "/hyperscape/settings/:agentId",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      const agentId = req.params.agentId;
      const character = runtime.character;

      // If the runtime character matches the requested agentId, return its config
      // Note: In a multi-agent setup, we might need to lookup the specific agent
      if (character.id === agentId || agentId === "current") {
        const char = character as any;
        res.json({
          success: true,
          settings: {
            name: char.name,
            username: char.username,
            modelProvider: char.modelProvider,
            bio: char.bio,
            lore: char.lore,
            topics: char.topics || char.topicIds,
            style: char.style,
            adjectives: char.adjectives,
          },
        });
      } else {
        res.status(404).json({ success: false, error: "Agent not found" });
      }
    } catch (error) {
      logger.error(
        "[HyperscapePlugin] Error fetching settings:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  },
};

export const updateSettingsRoute: Route = {
  type: "POST",
  path: "/hyperscape/settings/:agentId",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      const agentId = req.params.agentId;
      const newSettings = req.body;

      // In a real implementation, we would update the character config here
      // For now, we'll just log it and return success
      logger.info(
        `[HyperscapePlugin] Updating settings for ${agentId}:`,
        newSettings,
      );

      res.json({
        success: true,
        message: "Settings updated (simulation)",
        settings: newSettings,
      });
    } catch (error) {
      logger.error(
        "[HyperscapePlugin] Error updating settings:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  },
};
