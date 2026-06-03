/**
 * Social Memory Provider
 *
 * Tracks players the agent has encountered, relationship status,
 * and interaction history. Stores data in ElizaOS memory for
 * persistence across sessions.
 *
 * Surfaces context like:
 * - "You've met PlayerX 3 times, last 5 min ago"
 * - "PlayerY helped you when your health was low"
 * - "You haven't talked to anyone in a while"
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperiaService } from "../services/HyperiaService.js";
import type { Entity } from "../types.js";

export interface PlayerEncounter {
  playerId: string;
  playerName: string;
  firstMet: number;
  lastSeen: number;
  meetCount: number;
  relationship: "stranger" | "acquaintance" | "friend";
  notes: string[];
}

const encounterCache = new Map<string, Map<string, PlayerEncounter>>();
/** Cap encounters per agent to prevent unbounded growth */
const MAX_ENCOUNTERS_PER_AGENT = 50;
let lastSocialAction = 0;

function getEncounters(agentId: string): Map<string, PlayerEncounter> {
  if (!encounterCache.has(agentId)) {
    encounterCache.set(agentId, new Map());
  }
  return encounterCache.get(agentId)!;
}

/** Evict oldest encounters when over cap */
function evictOldEncounters(encounters: Map<string, PlayerEncounter>): void {
  if (encounters.size <= MAX_ENCOUNTERS_PER_AGENT) return;
  // Sort by lastSeen ascending, remove oldest
  const sorted = [...encounters.entries()].sort(
    (a, b) => a[1].lastSeen - b[1].lastSeen,
  );
  const toRemove = sorted.slice(0, encounters.size - MAX_ENCOUNTERS_PER_AGENT);
  for (const [key] of toRemove) {
    encounters.delete(key);
  }
}

function isPlayerEntity(
  entity: Entity,
): entity is Entity & { playerId: string } {
  return (
    !!entity.playerId ||
    entity.entityType === "player" ||
    entity.type === "player"
  );
}

export function recordEncounter(
  agentId: string,
  playerId: string,
  playerName: string,
  note?: string,
): void {
  const encounters = getEncounters(agentId);
  const existing = encounters.get(playerId);
  const now = Date.now();

  if (existing) {
    existing.lastSeen = now;
    existing.meetCount++;
    if (note && !existing.notes.includes(note)) {
      existing.notes.push(note);
      if (existing.notes.length > 5) existing.notes.shift();
    }
    if (existing.meetCount >= 5) existing.relationship = "friend";
    else if (existing.meetCount >= 2) existing.relationship = "acquaintance";
  } else {
    encounters.set(playerId, {
      playerId,
      playerName,
      firstMet: now,
      lastSeen: now,
      meetCount: 1,
      relationship: "stranger",
      notes: note ? [note] : [],
    });
    evictOldEncounters(encounters);
  }
}

export function recordSocialAction(): void {
  lastSocialAction = Date.now();
}

export function getTimeSinceLastSocial(): number {
  if (lastSocialAction === 0) return Infinity;
  return Date.now() - lastSocialAction;
}

function formatTimeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export const socialMemoryProvider: Provider = {
  name: "socialMemory",
  description: "Tracks players you've met, relationships, and social activity",
  dynamic: true,
  position: 12,

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service?.isConnected()) {
      return { text: "", values: {}, data: {} };
    }

    const player = service.getPlayerEntity();
    const nearbyEntities = service.getNearbyEntities();
    const agentId = runtime.agentId;
    const encounters = getEncounters(agentId);

    const nearbyPlayers = nearbyEntities.filter(
      (e) => isPlayerEntity(e) && e.id !== player?.id,
    );

    const now = Date.now();

    for (const p of nearbyPlayers) {
      const pid = p.playerId || p.id;
      const pname = p.name || "Unknown";
      recordEncounter(agentId, pid, pname);
    }

    const textParts: string[] = ["## Social Awareness\n"];

    if (nearbyPlayers.length > 0) {
      textParts.push("### Players Nearby");
      for (const p of nearbyPlayers.slice(0, 6)) {
        const pid = p.playerId || p.id;
        const encounter = encounters.get(pid);

        let relationshipInfo = "(stranger)";
        if (encounter) {
          if (encounter.relationship === "friend") {
            relationshipInfo = `(friend - met ${encounter.meetCount} times)`;
          } else if (encounter.relationship === "acquaintance") {
            relationshipInfo = `(acquaintance - met ${encounter.meetCount} times)`;
          } else {
            relationshipInfo = "(first time meeting)";
          }

          if (encounter.notes.length > 0) {
            relationshipInfo += ` Notes: ${encounter.notes[encounter.notes.length - 1]}`;
          }
        }

        textParts.push(`- **${p.name}** ${relationshipInfo}`);
      }
      textParts.push("");
    }

    const timeSinceSocial = getTimeSinceLastSocial();
    if (timeSinceSocial === Infinity) {
      textParts.push("### Social Status");
      textParts.push(
        "You haven't had any social interactions yet! Consider greeting someone.",
      );
    } else if (timeSinceSocial > 120000) {
      textParts.push("### Social Status");
      textParts.push(
        `It's been ${formatTimeAgo(timeSinceSocial)} since your last social interaction.`,
      );
      if (nearbyPlayers.length > 0) {
        textParts.push(
          "There are players nearby - maybe say hi or share what you're up to!",
        );
      }
    }

    const recentEncounters = Array.from(encounters.values())
      .filter((e) => now - e.lastSeen < 300000)
      .sort((a, b) => b.lastSeen - a.lastSeen);

    const friends = Array.from(encounters.values()).filter(
      (e) => e.relationship === "friend",
    );

    if (friends.length > 0) {
      textParts.push(`\n### Friends (${friends.length})`);
      for (const f of friends.slice(0, 5)) {
        textParts.push(
          `- ${f.playerName} (last seen: ${formatTimeAgo(now - f.lastSeen)})`,
        );
      }
    }

    return {
      text: textParts.join("\n"),
      values: {
        nearbyPlayerCount: nearbyPlayers.length,
        friendCount: friends.length,
        timeSinceLastSocial: timeSinceSocial,
        hasNewPlayers: nearbyPlayers.some((p) => {
          const pid = p.playerId || p.id;
          const enc = encounters.get(pid);
          return !enc || enc.meetCount <= 1;
        }),
      },
      data: {
        nearbyPlayers: nearbyPlayers.map((p) => ({
          id: p.id,
          name: p.name,
        })),
        recentEncounters: recentEncounters.map((e) => ({
          name: e.playerName,
          relationship: e.relationship,
          meetCount: e.meetCount,
        })),
      },
    };
  },
};
