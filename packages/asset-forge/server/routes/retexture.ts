/**
 * Retexture Routes
 * Asset retexturing and base model regeneration endpoints
 */

import { Elysia, t } from "elysia";
import path from "path";
import type { RetextureService } from "../services/RetextureService";
import * as Models from "../models";

export const createRetextureRoutes = (
  rootDir: string,
  retextureService: RetextureService,
) => {
  return (
    new Elysia({ prefix: "/api", name: "retexture" })
      // Retexture endpoint
      .post(
        "/retexture",
        async ({ body }) => {
          const result = await retextureService.retexture({
            baseAssetId: body.baseAssetId,
            materialPreset: body.materialPreset,
            outputName: body.outputName,
            assetsDir: path.join(rootDir, "gdd-assets"),
            user: body.user, // Use user from body if available
          });

          return result;
        },
        {
          body: Models.RetextureRequest,
          response: Models.RetextureResponse,
          detail: {
            tags: ["Retexturing"],
            summary: "Generate material variant",
            description:
              "Creates a new material variant of an existing asset using Meshy AI. (Auth optional - authenticated users get ownership tracking)",
          },
        },
      )

      // Regenerate base model endpoint
      .post(
        "/regenerate-base/:baseAssetId",
        async ({ params: { baseAssetId } }) => {
          const result = await retextureService.regenerateBase({
            baseAssetId,
            assetsDir: path.join(rootDir, "gdd-assets"),
          });

          return result;
        },
        {
          params: t.Object({
            baseAssetId: t.String({ minLength: 1 }),
          }),
          response: Models.RegenerateBaseResponse,
          detail: {
            tags: ["Retexturing"],
            summary: "Regenerate base model",
            description:
              "Regenerates the base 3D model using Meshy AI. (Auth optional - authenticated users get ownership tracking)",
          },
        },
      )
  );
};
