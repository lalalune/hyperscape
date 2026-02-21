/**
 * Quest actions for ElizaOS agents
 *
 * TALK_TO_NPC - Interact with a nearby NPC (quest giver, shopkeeper, banker)
 * ACCEPT_QUEST - Accept an available quest (sends questAccept packet)
 * COMPLETE_QUEST - Turn in a ready_to_complete quest for rewards
 * CHECK_QUEST - Check current quest progress and objectives
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService";
import type { Entity } from "../types";

function getDistance2D(
  posA: [number, number, number] | null | undefined,
  posB: [number, number, number] | null | undefined,
): number | null {
  if (!posA || !posB) return null;
  const dx = posA[0] - posB[0];
  const dz = posA[2] - posB[2];
  return Math.sqrt(dx * dx + dz * dz);
}

function isNpcEntity(entity: Entity): boolean {
  const entityType = (entity.entityType || "").toLowerCase();
  const type = (entity.type || "").toLowerCase();
  return (
    entityType === "npc" ||
    type === "npc" ||
    entityType === "quest_giver" ||
    entityType === "shopkeeper" ||
    entityType === "banker"
  );
}

function findNpcByName(entities: Entity[], text: string): Entity | null {
  const lowerText = text.toLowerCase();
  const npcs = entities.filter(isNpcEntity);

  const exactMatch = npcs.find((n) => n.name?.toLowerCase() === lowerText);
  if (exactMatch) return exactMatch;

  const partialMatch = npcs.find(
    (n) =>
      n.name?.toLowerCase().includes(lowerText) ||
      lowerText.includes(n.name?.toLowerCase() || ""),
  );
  if (partialMatch) return partialMatch;

  return npcs.length > 0 ? npcs[0] : null;
}

/**
 * Convert NPC ID from quest manifest (e.g. "captain_rowan") to a display-style
 * name for matching against entity names (e.g. "Captain Rowan").
 */
function npcIdToDisplayName(npcId: string): string {
  return npcId
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const talkToNpcAction: Action = {
  name: "TALK_TO_NPC",
  similes: ["INTERACT_NPC", "SPEAK_TO_NPC", "TALK_NPC"],
  description:
    "Approach and talk to a nearby NPC (quest giver, shopkeeper, banker, trainer). Initiates dialogue.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player?.position || player.inCombat) return false;

    const nearbyEntities = service.getNearbyEntities();
    const npcs = nearbyEntities.filter(isNpcEntity);

    return npcs.length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: "Service not available" };
    }

    const player = service.getPlayerEntity();
    if (!player?.position) {
      return { success: false, error: "No player position" };
    }

    const nearbyEntities = service.getNearbyEntities();
    const text = message.content.text || "";

    const npc = findNpcByName(nearbyEntities, text);
    if (!npc) {
      await callback?.({
        text: "No NPC found nearby to talk to.",
        action: "TALK_TO_NPC",
      });
      return { success: false, error: "No NPC nearby" };
    }

    const distance = getDistance2D(player.position, npc.position);
    if (distance !== null && distance > 10) {
      await service.executeMove({
        target: npc.position,
        runMode: false,
      });
      await callback?.({
        text: `Walking towards ${npc.name}...`,
        action: "TALK_TO_NPC",
      });
      await new Promise((r) => setTimeout(r, 2000));
    }

    service.interactWithEntity(npc.id, "talk");

    const responseText = `Talking to ${npc.name}`;
    await callback?.({ text: responseText, action: "TALK_TO_NPC" });

    return {
      success: true,
      text: responseText,
      data: { action: "TALK_TO_NPC", npcName: npc.name, npcId: npc.id },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Talk to the quest giver" } },
      {
        name: "agent",
        content: { text: "Talking to Captain Rowan", action: "TALK_TO_NPC" },
      },
    ],
  ],
};

export const acceptQuestAction: Action = {
  name: "ACCEPT_QUEST",
  similes: ["START_QUEST", "BEGIN_QUEST", "TAKE_QUEST"],
  description:
    "Accept an available quest. Finds a not_started quest, walks to the quest NPC, and accepts it to receive starter items. Use when near a quest NPC or when you want to start a new quest.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player?.position || player.inCombat) return false;

    const questState = service.getQuestState();
    const hasNotStartedQuest = questState.some(
      (q) => q.status === "not_started",
    );
    if (hasNotStartedQuest) return true;

    const nearbyEntities = service.getNearbyEntities();
    return nearbyEntities.some(isNpcEntity);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: "Service not available" };
    }

    const player = service.getPlayerEntity();
    if (!player?.position) {
      return { success: false, error: "No player position" };
    }

    const questState = service.getQuestState();

    // Find a quest that hasn't been started yet
    const availableQuest = questState.find((q) => q.status === "not_started");

    if (availableQuest) {
      // We know which quest to accept - find its NPC and walk to them
      const startNpcName = npcIdToDisplayName(
        ((availableQuest as Record<string, unknown>).startNpc as string) || "",
      );

      // Look for the NPC nearby
      const nearbyEntities = service.getNearbyEntities();
      const npc = nearbyEntities.find(
        (e) =>
          isNpcEntity(e) &&
          e.name?.toLowerCase().includes(startNpcName.toLowerCase()),
      );

      if (npc) {
        const distance = getDistance2D(player.position, npc.position);
        if (distance !== null && distance > 10) {
          await service.executeMove({ target: npc.position, runMode: false });
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      // Send quest accept packet directly - bypasses dialogue UI
      const questId =
        availableQuest.questId ||
        ((availableQuest as Record<string, unknown>).id as string);
      service.sendQuestAccept(questId);

      const responseText = `Accepting quest: ${availableQuest.name || questId}`;
      await callback?.({ text: responseText, action: "ACCEPT_QUEST" });

      // Refresh quest list after a short delay
      setTimeout(() => service.requestQuestList(), 1000);

      return {
        success: true,
        text: responseText,
        data: {
          action: "ACCEPT_QUEST",
          questId,
          questName: availableQuest.name,
        },
      };
    }

    // No quest list available yet - talk to a nearby NPC to discover quests
    const nearbyEntities = service.getNearbyEntities();
    const npc = findNpcByName(nearbyEntities, message.content.text || "");
    if (!npc) {
      await callback?.({
        text: "No quest NPC found nearby.",
        action: "ACCEPT_QUEST",
      });
      return { success: false, error: "No quest NPC nearby" };
    }

    const distance = getDistance2D(player.position, npc.position);
    if (distance !== null && distance > 10) {
      await service.executeMove({ target: npc.position, runMode: false });
      await new Promise((r) => setTimeout(r, 2000));
    }

    service.interactWithEntity(npc.id, "talk");

    // Refresh quest list
    service.requestQuestList();

    const responseText = `Talking to ${npc.name} to find quests`;
    await callback?.({ text: responseText, action: "ACCEPT_QUEST" });

    return {
      success: true,
      text: responseText,
      data: { action: "ACCEPT_QUEST", npcName: npc.name },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Accept a quest" } },
      {
        name: "agent",
        content: {
          text: "Accepting quest: Goblin Slayer",
          action: "ACCEPT_QUEST",
        },
      },
    ],
  ],
};

export const completeQuestAction: Action = {
  name: "COMPLETE_QUEST",
  similes: ["TURN_IN_QUEST", "FINISH_QUEST", "HAND_IN_QUEST"],
  description:
    "Turn in a completed quest for rewards. Only works when quest objectives are complete (status is ready_to_complete). Walks to quest NPC and sends completion.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player?.position || player.inCombat) return false;

    // Only valid if we have a quest that is ready_to_complete
    const questState = service.getQuestState();
    return questState.some(
      (q) =>
        q.status === "ready_to_complete" ||
        (q.status as string) === "ready_to_complete",
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: "Service not available" };
    }

    const player = service.getPlayerEntity();
    if (!player?.position) {
      return { success: false, error: "No player position" };
    }

    const questState = service.getQuestState();
    const readyQuest = questState.find((q) => q.status === "ready_to_complete");

    if (!readyQuest) {
      await callback?.({
        text: "No quests are ready to turn in.",
        action: "COMPLETE_QUEST",
      });
      return { success: false, error: "No ready_to_complete quest" };
    }

    const questId =
      readyQuest.questId ||
      ((readyQuest as Record<string, unknown>).id as string);

    // Try to find and walk to the quest's NPC
    const startNpcName = npcIdToDisplayName(
      ((readyQuest as Record<string, unknown>).startNpc as string) || "",
    );
    const nearbyEntities = service.getNearbyEntities();
    const npc = nearbyEntities.find(
      (e) =>
        isNpcEntity(e) &&
        e.name?.toLowerCase().includes(startNpcName.toLowerCase()),
    );

    if (npc) {
      const distance = getDistance2D(player.position, npc.position);
      if (distance !== null && distance > 10) {
        await service.executeMove({ target: npc.position, runMode: false });
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // Send quest complete packet
    service.sendQuestComplete(questId);

    const responseText = `Turning in quest: ${readyQuest.name || questId}`;
    await callback?.({ text: responseText, action: "COMPLETE_QUEST" });

    // Refresh quest list after a short delay
    setTimeout(() => service.requestQuestList(), 1000);

    return {
      success: true,
      text: responseText,
      data: {
        action: "COMPLETE_QUEST",
        questId,
        questName: readyQuest.name,
      },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Turn in quest" } },
      {
        name: "agent",
        content: {
          text: "Turning in quest: Goblin Slayer",
          action: "COMPLETE_QUEST",
        },
      },
    ],
  ],
};

export const checkQuestAction: Action = {
  name: "CHECK_QUEST",
  similes: ["QUEST_STATUS", "QUEST_PROGRESS", "VIEW_QUESTS"],
  description:
    "Check current quest progress and objectives. Reports what needs to be done.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    return !!service?.isConnected();
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: "Service not available" };
    }

    // Refresh from server
    service.requestQuestList();

    const questState = service.getQuestState();
    const activeQuests = questState.filter(
      (q) => q.status === "in_progress" || q.status === "ready_to_complete",
    );

    if (activeQuests.length === 0) {
      const responseText =
        "No active quests. I should talk to an NPC to find a quest!";
      await callback?.({ text: responseText, action: "CHECK_QUEST" });
      return { success: true, text: responseText };
    }

    const lines: string[] = ["My current quests:"];

    for (const quest of activeQuests) {
      const name = quest.name || quest.questId || "Unknown Quest";
      const status = quest.status || "in_progress";
      const description = quest.description || "";
      lines.push(
        `- ${name} [${status}]${description ? `: ${description}` : ""}`,
      );

      if (status === "ready_to_complete") {
        lines.push("  ** READY TO TURN IN! Go talk to the quest NPC. **");
      }

      if (quest.stageProgress) {
        for (const [key, value] of Object.entries(
          quest.stageProgress as Record<string, number>,
        )) {
          lines.push(`  Progress: ${key} = ${value}`);
        }
      }
    }

    const responseText = lines.join("\n");
    await callback?.({ text: responseText, action: "CHECK_QUEST" });

    return { success: true, text: responseText };
  },

  examples: [
    [
      { name: "user", content: { text: "Check my quests" } },
      {
        name: "agent",
        content: {
          text: "My current quests:\n- Goblin Slayer [in_progress]: Kill 15 goblins\n  Progress: kills = 7",
          action: "CHECK_QUEST",
        },
      },
    ],
  ],
};

export const questActions = [
  talkToNpcAction,
  acceptQuestAction,
  completeQuestAction,
  checkQuestAction,
];
