/**
 * Blockchain Integration for Hyperscape
 *
 * Connects Hyperscape events to HyperscapeOracle contract
 * Enables prediction markets on player performance
 */

import { OraclePublisher } from "./oraclePublisher";
import type { World } from "@hyperscape/shared/types";
import { EventType } from "@hyperscape/shared/types";
import { ethers } from "ethers";

export function initializeBlockchainIntegration(
  world: World,
): OraclePublisher | null {
  if (process.env.ENABLE_BLOCKCHAIN !== "true") {
    console.log("[Blockchain] Disabled - set ENABLE_BLOCKCHAIN=true to enable");
    return null;
  }

  const hyperscapeOracleAddress = process.env.HYPERSCAPE_ORACLE_ADDRESS;
  if (!hyperscapeOracleAddress) {
    console.warn(
      "[Blockchain] HYPERSCAPE_ORACLE_ADDRESS not set - disabling blockchain integration",
    );
    return null;
  }

  const publisher = new OraclePublisher({
    rpcUrl: process.env.RPC_URL || "http://localhost:8545",
    hyperscapeOracleAddress,
    privateKey:
      process.env.GAME_SERVER_PRIVATE_KEY ||
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    enabled: true,
  });

  console.log("[Blockchain] 🔗 Wiring up event listeners...");

  // Listen to skill level-up events
  world.eventManager?.on(EventType.SKILL_LEVEL_UP, (data: unknown) => {
    const eventData = data as {
      player?: { address?: string; id?: string };
      skill?: string;
      newLevel?: number;
      totalXp?: number;
    };

    if (eventData.player && eventData.skill && eventData.newLevel) {
      const playerAddress = eventData.player.address || eventData.player.id;

      // Only publish if player has valid address
      if (playerAddress && playerAddress.startsWith("0x")) {
        publisher
          .publishSkillLevelUp({
            player: playerAddress,
            skillName: eventData.skill,
            newLevel: eventData.newLevel,
            totalXp: eventData.totalXp || 0,
          })
          .catch((err) => {
            console.error(
              "[Blockchain] Failed to publish skill level-up:",
              err,
            );
          });
      }
    }
  });

  // Listen to death events
  world.eventManager?.on(EventType.ENTITY_DEATH, (data: unknown) => {
    const eventData = data as {
      entityId?: string;
      entityType?: string;
      sourceId?: string;
      location?: string;
      playerAddress?: string;
      killerAddress?: string;
    };

    if (eventData.entityType === "player" && eventData.entityId) {
      const playerAddress = eventData.playerAddress || eventData.entityId;

      if (playerAddress && playerAddress.startsWith("0x")) {
        publisher
          .publishPlayerDeath({
            player: playerAddress,
            killer: eventData.killerAddress || ethers.ZeroAddress,
            location: eventData.location || "Unknown",
          })
          .catch((err) => {
            console.error("[Blockchain] Failed to publish death:", err);
          });
      }
    }
  });

  // Listen to kill events (if they exist separately)
  if (EventType.PLAYER_KILL) {
    world.eventManager?.on(EventType.PLAYER_KILL, (data: unknown) => {
      const eventData = data as {
        killer?: string;
        victim?: string;
        method?: string;
      };

      if (eventData.killer && eventData.victim) {
        if (
          eventData.killer.startsWith("0x") &&
          eventData.victim.startsWith("0x")
        ) {
          publisher
            .publishPlayerKill({
              killer: eventData.killer,
              victim: eventData.victim,
              method: eventData.method || "combat",
            })
            .catch((err) => {
              console.error("[Blockchain] Failed to publish kill:", err);
            });
        }
      }
    });
  }

  console.log("[Blockchain] ✅ Event listeners active");
  console.log("[Blockchain]    Listening for: SKILL_LEVEL_UP, ENTITY_DEATH");

  return publisher;
}

export { OraclePublisher };
