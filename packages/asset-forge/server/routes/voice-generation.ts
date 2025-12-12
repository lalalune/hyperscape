/**
 * Voice Generation API Routes
 * ElevenLabs text-to-speech integration for NPC dialogue
 */

import { Elysia, t } from "elysia";
import { ElevenLabsVoiceService } from "../services/ElevenLabsVoiceService";
import * as Models from "../models";

export const voiceGenerationRoutes = new Elysia({
  prefix: "/api/voice",
  name: "voice-generation",
}).guard(
  {
    beforeHandle: ({ request }) => {
      console.log(`[Voice] ${request.method} ${new URL(request.url).pathname}`);
    },
  },
  (app) =>
    app
      // Helper to get API key from env or request
      .derive(({ request }) => {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        const voiceService = new ElevenLabsVoiceService(apiKey);

        if (!voiceService.isAvailable()) {
          throw new Error(
            "Voice generation service not available - ELEVENLABS_API_KEY not configured",
          );
        }

        return { voiceService };
      })

      // GET /api/voice/library - Get available voices
      .get(
        "/library",
        async ({ voiceService }) => {
          const voices = await voiceService.getAvailableVoices();
          return {
            voices: voices.map((v) => ({
              voice_id: v.voice_id,
              name: v.name || "Unknown Voice",
              description: v.description,
              category: v.category,
              labels: v.labels || {},
              preview_url: v.preview_url,
            })),
            count: voices.length,
          };
        },
        {
          response: Models.VoiceLibraryResponse,
          detail: {
            tags: ["Voice Generation"],
            summary: "Get available voices",
            description:
              "Returns all available voices from ElevenLabs voice library",
          },
        },
      )

      // POST /api/voice/generate - Generate single voice clip
      .post(
        "/generate",
        async ({ body, voiceService }) => {
          const result = await voiceService.generateVoice(body);
          return result;
        },
        {
          body: Models.GenerateVoiceRequest,
          response: Models.GenerateVoiceResponse,
          detail: {
            tags: ["Voice Generation"],
            summary: "Generate voice from text",
            description:
              "Converts text to speech using ElevenLabs TTS for NPC dialogue",
          },
        },
      )

      // POST /api/voice/batch - Batch generate multiple voice clips
      .post(
        "/batch",
        async ({ body, voiceService }) => {
          const results = await voiceService.generateVoiceBatch(body);
          return results;
        },
        {
          body: Models.BatchVoiceRequest,
          response: Models.BatchVoiceResponse,
          detail: {
            tags: ["Voice Generation"],
            summary: "Batch generate voices",
            description:
              "Generate multiple voice clips in a single request for better efficiency",
          },
        },
      )

      // POST /api/voice/estimate - Estimate cost
      .post(
        "/estimate",
        async ({ body }) => {
          const voiceService = new ElevenLabsVoiceService();
          const estimate = voiceService.estimateCost(body.texts, body.settings);
          return estimate;
        },
        {
          body: t.Object({
            texts: t.Array(t.String()),
            settings: t.Optional(Models.VoiceSettings),
          }),
          response: t.Object({
            characterCount: t.Number(),
            estimatedCostUSD: t.String(),
            texts: t.Number(),
          }),
          detail: {
            tags: ["Voice Generation"],
            summary: "Estimate cost for voice generation",
            description:
              "Calculate estimated cost based on character count and settings",
          },
        },
      )

      // GET /api/voice/subscription - Get subscription info
      .get(
        "/subscription",
        async ({ voiceService }) => {
          const subscription = await voiceService.getSubscriptionInfo();
          return subscription;
        },
        {
          detail: {
            tags: ["Voice Generation"],
            summary: "Get ElevenLabs subscription info",
            description:
              "Returns current subscription status, character limits, and usage",
          },
        },
      )

      // GET /api/voice/models - Get available models
      .get(
        "/models",
        async ({ voiceService }) => {
          const models = await voiceService.getAvailableModels();
          return {
            models,
            count: models.length,
          };
        },
        {
          response: t.Object({
            models: t.Array(t.Any()),
            count: t.Number(),
          }),
          detail: {
            tags: ["Voice Generation"],
            summary: "Get available voice models",
            description:
              "Returns list of available ElevenLabs TTS models (multilingual, monolingual, turbo)",
          },
        },
      )

      // GET /api/voice/rate-limit - Get rate limit info
      .get(
        "/rate-limit",
        async ({ voiceService }) => {
          const rateLimitInfo = voiceService.getRateLimitInfo();
          return rateLimitInfo;
        },
        {
          detail: {
            tags: ["Voice Generation"],
            summary: "Get rate limit status",
            description: "Returns current rate limit information",
          },
        },
      ),
);
