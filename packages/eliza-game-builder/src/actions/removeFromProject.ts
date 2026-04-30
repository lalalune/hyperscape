/**
 * `REMOVE_FROM_PROJECT` — agent-side deletion verb.
 *
 * Phase A4 of the AAA gap audit. The PROPOSE_* family lets the
 * agent add content; this action lets it remove. Without it the
 * agent's only revision path is re-emit-with-changes, which works
 * for slots whose semantics are "last emission wins" (terrain,
 * plugins, HUD) but is broken for additive slots (NPCs / mob
 * spawns / quests / assets) — there's no way to say "actually
 * scrap that goblin spawn at (12,0,8)" without manual intervention.
 *
 * The handler validates the deletion request shape; the host is
 * responsible for the actual mutation (drop the entry from the
 * relevant editor store + persist). This matches the
 * agent-decides / host-applies contract every other action uses.
 *
 * Discriminated by `kind`:
 *   - `npc`        — by `id`. NPCs have a schema-required id.
 *   - `quest`      — by `id`. Quests have a schema-required id.
 *   - `zone`       — by `id`. Zones have a schema-required id.
 *   - `asset`      — by `id` (the kebab-case id the host synthesized
 *                     from the original `PROPOSE_ASSET` proposal).
 *   - `mobSpawn`   — by `mobId` + `position` (spawns have no schema id).
 *
 * On success the validated removal lands on `data.removal` for the
 * host to apply.
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

const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const RemoveByIdSchema = z.object({
  kind: z.enum(["npc", "quest", "zone", "asset", "station", "teleport"]),
  id: z.string().min(1),
});

const RemoveSpawnSchema = z.object({
  kind: z.literal("mobSpawn"),
  mobId: z.string().min(1),
  position: Vec3Schema,
});

/**
 * Resources don't have unique top-level ids (multiple oak trees
 * are all `tree_oak`), so removal is keyed by composite
 * resourceId + position — same shape as mob spawns.
 */
const RemoveResourceSchema = z.object({
  kind: z.literal("resource"),
  resourceId: z.string().min(1),
  position: Vec3Schema,
});

const RemovalSchema = z.discriminatedUnion("kind", [
  RemoveByIdSchema.extend({ kind: z.literal("npc") }),
  RemoveByIdSchema.extend({ kind: z.literal("quest") }),
  RemoveByIdSchema.extend({ kind: z.literal("zone") }),
  RemoveByIdSchema.extend({ kind: z.literal("asset") }),
  RemoveByIdSchema.extend({ kind: z.literal("station") }),
  RemoveByIdSchema.extend({ kind: z.literal("teleport") }),
  RemoveSpawnSchema,
  RemoveResourceSchema,
]);

export type RemovalRequest = z.infer<typeof RemovalSchema>;

export const removeFromProjectAction: Action = {
  name: "REMOVE_FROM_PROJECT",
  similes: [
    "DELETE_NPC",
    "DELETE_QUEST",
    "DELETE_SPAWN",
    "REMOVE_NPC",
    "REMOVE_QUEST",
    "REMOVE_SPAWN",
    "DROP_FROM_PROJECT",
  ],
  description:
    "Remove an existing entity from the project. Pass `removal` — JSON discriminated by `kind`. Use when the user says 'remove the goblin spawn' or 'drop the tutorial quest'. Call GET_PROJECT_STATE first to confirm the id. Shapes: { kind: 'npc'|'quest'|'zone'|'asset'|'station'|'teleport', id } OR { kind: 'mobSpawn', mobId, position: {x,y,z} } OR { kind: 'resource', resourceId, position: {x,y,z} }. The host applies removal to the agent-world-content store; persisted worldContent is patched on next sync.",

  parameters: [
    {
      name: "removal",
      description:
        "Removal request JSON. Examples: { kind: 'npc', id: 'eldric_shopkeeper' } removes that NPC. { kind: 'quest', id: 'tutorial-cook' } removes that quest. { kind: 'mobSpawn', mobId: 'goblin', position: {x: 12, y: 0, z: 8} } removes the goblin spawn at that point. { kind: 'asset', id: 'goblin-shaman-abc123' } cancels a queued asset bake.",
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

    const removalRaw = readObjectField(options, "removal");
    if (!removalRaw) {
      const error = new Error(
        "REMOVE_FROM_PROJECT requires a `removal` parameter — see action description for the shape.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = RemovalSchema.safeParse(removalRaw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Removal request invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const removal = result.data;
    let summary: string;
    if (removal.kind === "mobSpawn") {
      summary =
        `Removal accepted: ${removal.kind} '${removal.mobId}' at ` +
        `(${removal.position.x}, ${removal.position.y}, ${removal.position.z})`;
    } else if (removal.kind === "resource") {
      summary =
        `Removal accepted: ${removal.kind} '${removal.resourceId}' at ` +
        `(${removal.position.x}, ${removal.position.y}, ${removal.position.z})`;
    } else {
      summary = `Removal accepted: ${removal.kind} '${removal.id}'`;
    }

    await callback?.({ text: summary, action: "REMOVE_FROM_PROJECT" });

    return {
      success: true,
      text: summary,
      data: { removal } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Actually drop the goblin spawn near the village." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Removal accepted: mobSpawn 'goblin' at (12, 0, 8)",
          actions: ["REMOVE_FROM_PROJECT"],
        },
      },
    ],
  ],
};
