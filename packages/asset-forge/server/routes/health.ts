/**
 * Health Check Routes
 * Simple health check endpoint for monitoring
 */

import { Elysia } from "elysia";
import * as Models from "../models";

export const healthRoutes = new Elysia({ prefix: "/api", name: "health" }).get(
  "/health",
  () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      meshy: !!process.env.MESHY_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
    },
  }),
  {
    response: Models.HealthResponse,
    detail: {
      tags: ["Health"],
      summary: "Health check",
      description:
        "Returns server health status and available services. (Auth optional)",
    },
  },
);
