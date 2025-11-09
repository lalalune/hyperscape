/**
 * Sound Effects Generation API Routes
 * ElevenLabs text-to-sound-effects integration for game audio
 */

import { Elysia, t } from "elysia";
import { ElevenLabsSoundEffectsService } from "../services/ElevenLabsSoundEffectsService";
import * as Models from "../models";

export const soundEffectsRoutes = new Elysia({
  prefix: "/api/sfx",
  name: "sound-effects-generation",
}).guard(
  {
    beforeHandle: ({ request }) => {
      console.log(`[SFX] ${request.method} ${new URL(request.url).pathname}`);
    },
  },
  (app) =>
    app
      // Helper to initialize SFX service
      .derive(() => {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        const sfxService = new ElevenLabsSoundEffectsService(apiKey);

        if (!sfxService.isAvailable()) {
          throw new Error(
            "Sound effects generation service not available - ELEVENLABS_API_KEY not configured",
          );
        }

        return { sfxService };
      })

      // POST /api/sfx/generate - Generate sound effect
      .post(
        "/generate",
        async ({ body, sfxService }) => {
          console.log(
            `[SFX] Generating sound effect: "${body.text.substring(0, 50)}..."`,
          );

          const audioBuffer = await sfxService.generateSoundEffect(body);

          console.log(
            `[SFX] Sound effect generated successfully: ${audioBuffer.length} bytes`,
          );

          // Return audio file directly as binary
          return new Response(new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" }), {
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Length": audioBuffer.length.toString(),
              "Cache-Control": "public, max-age=31536000",
              "Content-Disposition": `attachment; filename="sfx-${Date.now()}.mp3"`,
            },
          });
        },
        {
          body: Models.GenerateSfxRequest,
          detail: {
            tags: ["Sound Effects"],
            summary: "Generate sound effect from text",
            description:
              "Generate AI sound effect from text description. Returns MP3 audio file. Duration: 0.5-22 seconds.",
          },
        },
      )

      // POST /api/sfx/batch - Batch generate multiple sound effects
      .post(
        "/batch",
        async ({ body, sfxService }) => {
          console.log(
            `[SFX] Batch generating ${body.effects.length} sound effects`,
          );

          const results = await sfxService.generateSoundEffectBatch(
            body.effects,
          );

          console.log(
            `[SFX] Batch generation complete: ${results.successful}/${results.total}`,
          );

          // Convert audio buffers to base64 for JSON response
          const formattedResults = {
            ...results,
            effects: results.effects.map((effect) => ({
              ...effect,
              audioBuffer:
                "audioBuffer" in effect && effect.audioBuffer
                  ? effect.audioBuffer.toString("base64")
                  : undefined,
            })),
          };

          return formattedResults;
        },
        {
          body: Models.BatchSfxRequest,
          response: Models.BatchSfxResponse,
          detail: {
            tags: ["Sound Effects"],
            summary: "Batch generate sound effects",
            description:
              "Generate multiple sound effects in parallel (max 20 effects)",
          },
        },
      )

      // GET /api/sfx/estimate - Estimate cost
      .get(
        "/estimate",
        async ({ query, sfxService }) => {
          const duration = query.duration ? parseFloat(query.duration) : null;

          if (
            duration !== null &&
            (isNaN(duration) || duration < 0.5 || duration > 22)
          ) {
            throw new Error(
              "Invalid duration: must be between 0.5 and 22 seconds",
            );
          }

          const estimate = sfxService.estimateCost(duration);
          return estimate;
        },
        {
          query: t.Object({
            duration: t.Optional(t.String()),
          }),
          response: Models.SfxEstimateResponse,
          detail: {
            tags: ["Sound Effects"],
            summary: "Estimate sound effect generation cost",
            description:
              "Get cost estimate for generating a sound effect of specific duration",
          },
        },
      ),
);
