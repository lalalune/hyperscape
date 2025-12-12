/**
 * Generation Pipeline Routes
 * AI-powered 3D asset generation pipeline endpoints
 */

import { Elysia, t } from "elysia";
import type { GenerationService } from "../services/GenerationService";
import * as Models from "../models";

export const createGenerationRoutes = (
  generationService: GenerationService,
) => {
  return new Elysia({ prefix: "/api/generation", name: "generation" }).guard(
    {
      beforeHandle: ({ request }) => {
        console.log(`[Generation Pipeline] ${request.method} operation`);
      },
    },
    (app) =>
      app
        // Start generation pipeline
        .post(
          "/pipeline",
          async ({ body }) => {
            // User context would be merged from authentication middleware if available
            const result = await generationService.startPipeline(body);
            return result;
          },
          {
            body: Models.PipelineConfig,
            response: Models.PipelineResponse,
            detail: {
              tags: ["Generation"],
              summary: "Start generation pipeline",
              description:
                "Initiates a new AI-powered 3D asset generation pipeline. (Auth optional - authenticated users get ownership tracking)",
            },
          },
        )

        // Get pipeline status
        .get(
          "/pipeline/:pipelineId",
          async ({ params: { pipelineId } }) => {
            const status =
              await generationService.getPipelineStatus(pipelineId);
            return status;
          },
          {
            params: t.Object({
              pipelineId: t.String({ minLength: 1 }),
            }),
            response: {
              200: Models.PipelineStatus,
              404: Models.ErrorResponse,
            },
            detail: {
              tags: ["Generation"],
              summary: "Get pipeline status",
              description:
                "Returns the current status and progress of a generation pipeline. (Auth optional)",
            },
          },
        ),
  );
};
