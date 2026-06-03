import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { HyperiaService } from "../services/HyperiaService.js";

export const getLogsRoute: Route = {
  name: "hyperia-logs",
  type: "GET",
  path: "/hyperia/logs/:agentId",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      const service = runtime.getService<HyperiaService>("hyperiaService");

      if (!service) {
        res
          .status(503)
          .json({ success: false, error: "HyperiaService not available" });
        return;
      }

      const logs = service.getLogs();

      res.json({
        success: true,
        logs: logs.map((log) => ({
          id: `${log.timestamp}-${log.type}`,
          timestamp: new Date(log.timestamp).toISOString(),
          level: "info", // Default to info for game events
          source: "Hyperia",
          message: `[${log.type}] ${JSON.stringify(log.data)}`,
        })),
      });
    } catch (error) {
      logger.error(
        "[HyperiaPlugin] Error fetching logs:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  },
};
