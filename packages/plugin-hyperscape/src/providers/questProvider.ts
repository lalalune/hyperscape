/**
 * Quest State Provider
 *
 * Provides LLM context about:
 * - Active quests and current objectives
 * - Available quests from nearby NPCs
 * - Quest completion status
 * - Nearby quest-related NPCs
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { Entity } from "../types.js";
import {
  hasAxe,
  hasPickaxe,
  hasFishingEquipment,
} from "../utils/item-detection.js";

function isNpcEntity(entity: Entity): boolean {
  const entityType = (entity.entityType || "").toLowerCase();
  const type = (entity.type || "").toLowerCase();
  return (
    entityType === "npc" ||
    type === "npc" ||
    entityType === "quest_giver" ||
    entityType === "shopkeeper" ||
    entityType === "banker" ||
    entityType === "trainer"
  );
}

function getNpcRole(entity: Entity): string {
  const entityType = (entity.entityType || "").toLowerCase();
  const name = (entity.name || "").toLowerCase();

  if (entityType === "quest_giver" || /captain|guide|elder|master/i.test(name))
    return "quest_giver";
  if (entityType === "shopkeeper" || /shop|store|merchant/i.test(name))
    return "shopkeeper";
  if (entityType === "banker" || /bank/i.test(name)) return "banker";
  if (entityType === "trainer" || /trainer|tutor/i.test(name)) return "trainer";
  return "npc";
}

export const questProvider: Provider = {
  name: "questState",
  description: "Current quest status, active objectives, and nearby quest NPCs",
  dynamic: true,
  position: 10,

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) {
      return { text: "", values: {}, data: {} };
    }

    const player = service.getPlayerEntity();
    const nearbyEntities = service.getNearbyEntities();

    const textParts: string[] = ["## Quest & NPC Status\n"];

    if (player && !player.inCombat) {
      textParts.push("### Overarching Quest");
      textParts.push(
        "When not actively dueling, your primary objective is to focus on leveling up, acquiring better gear, and preparing yourself for future duels!",
      );
      textParts.push("");
    }

    // Quest state tracking - uses HyperscapeService.getQuestState() which caches
    // quest data received via server packets (onGetQuestList, questStarted, etc.).
    const quests: Array<{
      name?: string;
      questId?: string;
      status?: string;
      description?: string;
      stageProgress?: Record<string, number>;
    }> = service.getQuestState?.() || [];

    if (quests.length > 0) {
      textParts.push("### Active Quests");
      for (const quest of quests) {
        const name = quest.name || quest.questId || "Unknown";
        const status = quest.status || "in_progress";
        const desc = quest.description || "";
        textParts.push(`- **${name}** [${status}]: ${desc}`);

        if (quest.stageProgress) {
          for (const [key, value] of Object.entries(quest.stageProgress)) {
            textParts.push(`  - ${key}: ${value}`);
          }
        }

        if (status === "ready_to_complete") {
          textParts.push("  - **READY TO TURN IN!** Go talk to the quest NPC.");
        }
      }
      textParts.push("");
    } else {
      textParts.push("### No Active Quests");
      textParts.push("You have no quests. Talk to NPCs to find quests!");
      textParts.push("");
    }

    // Tell agent which quests give tools when they're missing essential items
    if (player) {
      const missingAxe = !hasAxe(player);
      const missingPickaxe = !hasPickaxe(player);
      const missingNet = !hasFishingEquipment(player);

      if (missingAxe || missingPickaxe || missingNet) {
        textParts.push("### MISSING Essential Tools!");
        const toolHints: string[] = [];
        if (missingAxe) {
          toolHints.push(
            '- ACCEPT_QUEST "lumberjacks_first_lesson" from Forester Wilma → bronze hatchet + tinderbox',
          );
        }
        if (missingPickaxe) {
          toolHints.push(
            '- ACCEPT_QUEST "torvins_tools" from Torvin → bronze pickaxe + hammer',
          );
        }
        if (missingNet) {
          toolHints.push(
            '- ACCEPT_QUEST "fresh_catch" from Fisherman Pete → small fishing net',
          );
        }
        textParts.push(
          "You need to accept quests to get tools. Items are granted immediately on accept:",
        );
        textParts.push(...toolHints);
        textParts.push("");
      }
    }

    const npcs = nearbyEntities.filter(isNpcEntity);
    if (npcs.length > 0) {
      textParts.push("### Nearby NPCs");
      for (const npc of npcs.slice(0, 8)) {
        const role = getNpcRole(npc);
        let distance = "nearby";
        if (player?.position && npc.position) {
          const dx = player.position[0] - npc.position[0];
          const dz = player.position[2] - npc.position[2];
          const dist = Math.sqrt(dx * dx + dz * dz);
          distance = `${dist.toFixed(0)} units`;
        }

        const roleLabel =
          role === "quest_giver"
            ? " (Quest Giver)"
            : role === "shopkeeper"
              ? " (Shop)"
              : role === "banker"
                ? " (Bank)"
                : role === "trainer"
                  ? " (Trainer)"
                  : "";

        textParts.push(`- **${npc.name}**${roleLabel} - ${distance} away`);
      }
      textParts.push("");
      textParts.push(
        "Use TALK_TO_NPC to interact, ACCEPT_QUEST to start a quest, COMPLETE_QUEST to turn in.",
      );
    } else {
      textParts.push("### No NPCs Nearby");
      textParts.push("Travel to a town or settlement to find quest NPCs.");
    }

    const hasActiveQuests = quests.length > 0;
    const hasReadyQuests = quests.some((q) => q.status === "ready_to_complete");

    return {
      text: textParts.join("\n"),
      values: {
        hasActiveQuests,
        hasReadyQuests,
        questCount: quests.length,
        nearbyNpcCount: npcs.length,
      },
      data: {
        quests,
        nearbyNpcs: npcs.map((n) => ({
          id: n.id,
          name: n.name,
          role: getNpcRole(n),
          position: n.position,
        })),
      },
    };
  },
};
