/**
 * Static Script Route - Serves the login button injection script
 *
 * This route serves a JavaScript file that can be included in HTML
 * to automatically add the login button to the UI
 */

import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const staticScriptRoute: Route = {
  type: "GET",
  path: "/hyperscape-login-button.js",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      const scriptPath = join(
        __dirname,
        "../public/hyperscape-login-button.js",
      );
      const script = readFileSync(scriptPath, "utf-8");

      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(script);
    } catch (error) {
      logger.error(
        "[HyperscapeAuth] Static script route error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).send("// Error loading script");
    }
  },
};
