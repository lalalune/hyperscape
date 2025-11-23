import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { HyperscapeService } from "../services/HyperscapeService.js";

export const getLogsRoute: Route = {
  type: "GET",
  path: "/hyperscape/logs/:agentId",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");

      if (!service) {
        res
          .status(503)
          .json({ success: false, error: "HyperscapeService not available" });
        return;
      }

      const logs = service.getLogs();

      res.json({
        success: true,
        logs: logs.map((log) => ({
          id: `${log.timestamp}-${log.type}`,
          timestamp: new Date(log.timestamp).toISOString(),
          level: "info", // Default to info for game events
          source: "Hyperscape",
          message: `[${log.type}] ${JSON.stringify(log.data)}`,
        })),
      });
    } catch (error) {
      logger.error(
        "[HyperscapePlugin] Error fetching logs:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  },
};
