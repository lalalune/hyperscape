/**
 * `PROPOSE_ASSET` — propose generating a new 3D asset.
 *
 * Phase A5 of the AAA gap audit. Today every agent-placed NPC /
 * mob has to reuse an existing model from the catalog — the
 * AICreationService that powers Meshy / TripoSR is reachable
 * from the studio UI but not from the agent loop. Without this
 * action the demo gets visually monotonous fast.
 *
 * Design choice — *planning* action, not *generating* action:
 *
 *   The bake pipeline is async (minutes per asset). Calling it
 *   from inside the agent's tool handler would block the chat
 *   loop. Instead, the action returns a structured proposal
 *   `{ name, type, subtype, prompt, ... }` on `data.asset`. The
 *   host receives the proposal, fires `POST /api/generation/pipeline`
 *   with it, and surfaces the bake's progress in the UI. When
 *   the asset finishes, the host wires it to a placement
 *   (NPC, mob spawn) on its own.
 *
 *   This matches the contract every other PROPOSE_* action uses
 *   (agent decides, host applies) and keeps the action handler
 *   sub-second.
 *
 * Required fields:
 *   name        — display name (e.g. "Goblin Shaman")
 *   type        — top-level category: "character" | "creature" |
 *                  "prop" | "weapon" | "tool" | "armor" | "vehicle" | "misc"
 *   subtype     — sub-category specific to type (e.g. "humanoid",
 *                  "quadruped", "sword", "tree")
 *   prompt      — natural-language description Meshy + GPT enhance
 *
 * Optional fields:
 *   style          — "realistic" | "stylized" | "cartoon" | "low-poly"
 *   quality        — "preview" | "standard" | "high"
 *   enableRigging  — bool, default false
 *   characterHeight — meters, only meaningful for `character` / `creature`
 *   referenceImageUrl — public URL to use as image-to-3D seed instead of
 *                       agent-prompted image. Skips the text-to-image stage.
 */

import type {
  Action,
  ActionResult,
  HandlerCallback,
  HandlerOptions,
  IAgentRuntime,
  Memory,
  ProviderDataRecord,
  State,
} from "@elizaos/core";
import { z } from "zod";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { readObjectField } from "./shared.js";

const ASSET_TYPES = [
  "character",
  "creature",
  "prop",
  "weapon",
  "tool",
  "armor",
  "vehicle",
  "misc",
] as const;

const ASSET_STYLES = ["realistic", "stylized", "cartoon", "low-poly"] as const;

const ASSET_QUALITIES = ["preview", "standard", "high"] as const;

const AssetProposalSchema = z.object({
  name: z.string().min(1),
  type: z.enum(ASSET_TYPES),
  subtype: z.string().min(1),
  prompt: z.string().min(8),
  style: z.enum(ASSET_STYLES).optional(),
  quality: z.enum(ASSET_QUALITIES).optional(),
  enableRigging: z.boolean().optional(),
  characterHeight: z.number().positive().optional(),
  referenceImageUrl: z.string().url().optional(),
});

export type AssetProposal = z.infer<typeof AssetProposalSchema>;

export const proposeAssetAction: Action = {
  name: "PROPOSE_ASSET",
  similes: ["GENERATE_ASSET", "CREATE_ASSET", "BAKE_MODEL", "DESIGN_MODEL"],
  description:
    "Propose generating a new 3D asset (character, creature, prop, weapon, tool, armor, vehicle). The host runs the bake pipeline asynchronously and wires the result to placements once it finishes — your job is just to describe what to make. Pass `asset` — JSON matching: { name (string), type ('character'|'creature'|'prop'|'weapon'|'tool'|'armor'|'vehicle'|'misc'), subtype (string), prompt (rich natural-language description, 8+ chars), style? ('realistic'|'stylized'|'cartoon'|'low-poly'), quality? ('preview'|'standard'|'high'), enableRigging? (bool, characters/creatures only), characterHeight? (meters), referenceImageUrl? (skip text-to-image). Default style is 'stylized', default quality is 'standard'. Use this BEFORE PROPOSE_NPC_PLACEMENT when the agent wants a unique mesh; the host will associate the baked asset with the NPC once the bake completes.",

  parameters: [
    {
      name: "asset",
      description:
        "Asset proposal JSON. Required: name, type, subtype, prompt. Example: { name: 'Goblin Shaman', type: 'creature', subtype: 'humanoid', prompt: 'A small green-skinned goblin shaman wearing tattered robes with a wooden staff topped with a glowing skull. Hunched posture, wild eyes, beaded necklaces.', style: 'stylized', enableRigging: true, characterHeight: 1.2 }",
      required: true,
      schema: { type: "object" },
    },
  ],

  validate: async (runtime: IAgentRuntime) => {
    return (
      runtime.getService<GameBuilderService>(GameBuilderService.serviceType) !==
      null
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    options?: HandlerOptions | Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const service = runtime.getService<GameBuilderService>(
      GameBuilderService.serviceType,
    );
    if (!service) {
      const error = new Error("GameBuilderService not available");
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const assetRaw = readObjectField(options, "asset");
    if (!assetRaw) {
      const error = new Error(
        "PROPOSE_ASSET requires an `asset` parameter — see action description for the shape.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = AssetProposalSchema.safeParse(assetRaw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Asset proposal invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const asset = result.data;
    const summary = [
      `Asset proposal accepted: ${asset.name}`,
      `  type:    ${asset.type} / ${asset.subtype}`,
      `  prompt:  ${asset.prompt.length > 60 ? asset.prompt.slice(0, 57) + "…" : asset.prompt}`,
    ];
    if (asset.style) summary.push(`  style:   ${asset.style}`);
    if (asset.quality) summary.push(`  quality: ${asset.quality}`);
    if (asset.enableRigging) summary.push(`  rigged:  yes`);
    if (asset.characterHeight)
      summary.push(`  height:  ${asset.characterHeight}m`);
    if (asset.referenceImageUrl)
      summary.push(`  ref-img: ${asset.referenceImageUrl}`);
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_ASSET" });

    return {
      success: true,
      text,
      data: { asset } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Make a goblin shaman model for the cave encounter." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Asset proposal accepted: Goblin Shaman\n  type: creature / humanoid\n  prompt: A small green-skinned goblin shaman wearing tattered robes…\n  style: stylized\n  rigged: yes\n  height: 1.2m",
          actions: ["PROPOSE_ASSET"],
        },
      },
    ],
  ],
};
