/**
 * Content Generation API Routes
 * AI-powered content generation for NPCs, quests, dialogue, and lore
 */

import { Elysia } from "elysia";
import { ContentGenerationService } from "../services/ContentGenerationService";
import * as Models from "../models";

const contentGenService = new ContentGenerationService();

export const contentGenerationRoutes = new Elysia({
  prefix: "/api/content",
  name: "content-generation",
}).guard(
  {
    beforeHandle: ({ request }) => {
      console.log(
        `[ContentGeneration] ${request.method} ${new URL(request.url).pathname}`,
      );
    },
  },
  (app) =>
    app
      // GET /api/content/test - Simple test endpoint
      .get("/test", () => {
        return { message: "Content generation routes are working!" };
      })

      // POST /api/content/generate-dialogue
      .post(
        "/generate-dialogue",
        async ({ body }) => {
          try {
            console.log(
              `[ContentGeneration] Generating dialogue for NPC: ${body.npcName}`,
            );

            const result = await contentGenService.generateDialogue({
              npcName: body.npcName,
              npcPersonality: body.npcPersonality,
              context: body.context,
              existingNodes: body.existingNodes,
              quality: body.quality,
            });

            console.log(`[ContentGeneration] Successfully generated dialogue`);
            return result;
          } catch (error) {
            console.error(
              `[ContentGeneration] Error generating dialogue:`,
              error,
            );
            throw error;
          }
        },
        {
          body: Models.GenerateDialogueRequest,
          response: Models.GenerateDialogueResponse,
          detail: {
            tags: ["Content Generation"],
            summary: "Generate NPC dialogue",
            description:
              "Generate dialogue tree nodes for an NPC using AI. Supports existing dialogue context.",
          },
        },
      )

      // POST /api/content/generate-npc
      .post(
        "/generate-npc",
        async ({ body }) => {
          console.log(
            `[ContentGeneration] Generating NPC with archetype: ${body.archetype}`,
          );

          const result = await contentGenService.generateNPC({
            archetype: body.archetype,
            prompt: body.prompt,
            context: body.context,
            quality: body.quality,
          });

          return result;
        },
        {
          body: Models.GenerateNPCRequest,
          response: Models.GenerateNPCResponse,
          detail: {
            tags: ["Content Generation"],
            summary: "Generate complete NPC",
            description:
              "Generate a complete NPC character with personality, dialogue, and behavior using AI.",
          },
        },
      )

      // POST /api/content/generate-quest
      .post(
        "/generate-quest",
        async ({ body }) => {
          console.log(
            `[ContentGeneration] Generating ${body.difficulty} ${body.questType} quest`,
          );

          const result = await contentGenService.generateQuest({
            questType: body.questType,
            difficulty: body.difficulty,
            theme: body.theme,
            context: body.context,
            quality: body.quality,
          });

          return result;
        },
        {
          body: Models.GenerateQuestRequest,
          response: Models.GenerateQuestResponse,
          detail: {
            tags: ["Content Generation"],
            summary: "Generate game quest",
            description:
              "Generate a complete quest with objectives, rewards, and narrative using AI.",
          },
        },
      )

      // POST /api/content/generate-lore
      .post(
        "/generate-lore",
        async ({ body }) => {
          console.log(
            `[ContentGeneration] Generating lore: ${body.category} - ${body.topic}`,
          );

          const result = await contentGenService.generateLore({
            category: body.category,
            topic: body.topic,
            context: body.context,
            quality: body.quality,
          });

          return result;
        },
        {
          body: Models.GenerateLoreRequest,
          response: Models.GenerateLoreResponse,
          detail: {
            tags: ["Content Generation"],
            summary: "Generate game lore",
            description:
              "Generate rich lore content for world-building using AI.",
          },
        },
      ),
);
