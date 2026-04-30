/**
 * `PROPOSE_QUEST` — quest authoring action.
 *
 * Phase A1 of the AAA gap audit. Hyperia is fundamentally a
 * quest-driven game; without a quest authoring path the agent
 * cannot reproduce Hyperia from prompts. The handler validates
 * against `QuestSchema` from `@hyperforge/manifest-schema` (the
 * same schema `quests.json` is parsed against). On success the
 * validated quest lands on `data.quest` for the host to merge
 * into its `agentWorldContent` store.
 *
 * Required fields (from quests.ts):
 *   id, name, description, difficulty, questPoints, replayable,
 *   requirements { quests, skills, items },
 *   startNpc,
 *   stages — non-empty discriminated union ('dialogue' | 'kill' |
 *            'gather' | 'interact'),
 *   onStart, rewards { questPoints, items, xp }
 *
 * Optional:
 *   placementRules { placement, biomePreference?, maxDistFromTown? }
 *
 * Stage discriminator:
 *   dialogue: { type:'dialogue', id, description, npcId }
 *   kill:     { type:'kill', id, description, target, count }
 *   gather:   { type:'gather', id, description, target, count }
 *   interact: { type:'interact', id, description, target, count }
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
import { QuestSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { readObjectField } from "./shared.js";

export const proposeQuestAction: Action = {
  name: "PROPOSE_QUEST",
  similes: ["ADD_QUEST", "CREATE_QUEST", "SUBMIT_QUEST"],
  description:
    "Propose a quest. Pass `quest` — a JSON object matching `QuestSchema`. " +
    "Required: id, name, description, difficulty (novice|intermediate|experienced|master|grandmaster), questPoints, replayable, requirements{quests:string[], skills:record<string,int>, items:[{itemId,quantity}]}, startNpc (id of an NPC that must already exist), stages[] (non-empty), onStart, rewards{questPoints,items,xp:record<string,number>}. " +
    "Optional: placementRules. " +
    "STAGES are a discriminated union on `type`: " +
    "  dialogue: {type:'dialogue', id, description, npcId} — talk to an NPC. " +
    "  kill: {type:'kill', id, description, target, count} — kill N mobs of mob-id `target`. " +
    "  gather: {type:'gather', id, description, target, count} — gather N items of item-id `target`. " +
    "  interact: {type:'interact', id, description, target, count} — interact with N instances. " +
    "Always include an `id` on each stage. The schema rejects empty stages[]. " +
    "Tip: call GET_PROJECT_STATE first to make sure `startNpc` references an NPC you've already proposed.",

  parameters: [
    {
      name: "quest",
      description:
        "The Quest JSON. See action description for the discriminated `stages[].type` shape (dialogue/kill/gather/interact). Example: { id: 'tutorial-cook', name: 'Burnt Offerings', description: 'Cook 5 fish for the chef.', difficulty: 'novice', questPoints: 1, replayable: false, startNpc: 'chef_eldred', requirements: { quests: [], skills: {}, items: [] }, stages: [{ type: 'dialogue', id: 'meet-eldred', description: 'Talk to Eldred', npcId: 'chef_eldred' }, { type: 'gather', id: 'cook-fish', description: 'Cook 5 fish', target: 'cooked_fish', count: 5 }], onStart: {}, rewards: { questPoints: 1, items: [], xp: { cooking: 100 } } }",
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

    const questRaw = readObjectField(options, "quest");
    if (!questRaw) {
      const error = new Error(
        "PROPOSE_QUEST requires a `quest` parameter — a Quest JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = QuestSchema.safeParse(questRaw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Quest invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    const quest = result.data;
    const stageCounts: Record<string, number> = {};
    for (const stage of quest.stages) {
      stageCounts[stage.type] = (stageCounts[stage.type] ?? 0) + 1;
    }
    const stageSummary = Object.entries(stageCounts)
      .map(([type, count]) => `${count}× ${type}`)
      .join(", ");

    const summary = [
      `Quest accepted: ${quest.id}`,
      `  name:        ${quest.name}`,
      `  difficulty:  ${quest.difficulty}`,
      `  startNpc:    ${quest.startNpc}`,
      `  stages:      ${quest.stages.length} (${stageSummary})`,
      `  questPoints: ${quest.questPoints}`,
    ];
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_QUEST" });

    return {
      success: true,
      text,
      data: { quest } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "Add a starter quest where the player cooks 5 fish for the chef.",
        },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Quest accepted: tutorial-cook\n  name: Burnt Offerings\n  difficulty: novice\n  startNpc: chef_eldred\n  stages: 2 (1× dialogue, 1× gather)",
          actions: ["PROPOSE_QUEST"],
        },
      },
    ],
  ],
};
