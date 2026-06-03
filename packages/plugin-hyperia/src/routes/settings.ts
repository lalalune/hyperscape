import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";

export const getSettingsRoute: Route = {
  name: "hyperia-settings",
  type: "GET",
  path: "/hyperia/settings/:agentId",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      const agentId = (req.params as { agentId?: string })?.agentId;
      const character = runtime.character;

      // Check if this is the correct agent by comparing runtime.agentId
      // agentId from dashboard is the ElizaOS runtime ID, not the character ID
      const runtimeAgentId = runtime.agentId;

      logger.info(
        `[Settings] Request for agentId: ${agentId}, runtime.agentId: ${runtimeAgentId}`,
      );

      if (runtimeAgentId === agentId || agentId === "current") {
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
        logger.warn(
          `[Settings] Agent ID mismatch: requested=${agentId}, runtime=${runtimeAgentId}`,
        );
        res.status(404).json({ success: false, error: "Agent not found" });
      }
    } catch (error) {
      logger.error(
        "[HyperiaPlugin] Error fetching settings:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  },
};
