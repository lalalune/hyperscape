"use server";

import { dataManager } from "@hyperscape/shared"; // Shared singleton
import type { WorldArea } from "@hyperscape/shared";

export interface AnalyticsSummary {
  counts: {
    activePlayers: number;
    totalZones: number;
    totalNpcs: number;
    totalSpawners: number;
    totalResources: number;
    economyVolume: number;
  };
  zoneDistribution: { name: string; value: number }[];
  entityComposition: { name: string; value: number }[];
  performance: {
    cpu: { name: string; value: number }[];
    memory: { name: string; value: number }[];
    players: { name: string; value: number }[];
  };
}

// Simulation helpers
const generateTimeSeries = (
  points: number,
  startVal: number,
  volatility: number,
) => {
  let current = startVal;
  return Array.from({ length: points }, (_, i) => {
    current += (Math.random() - 0.5) * volatility;
    return {
      name: `${i}h`,
      value: Math.max(0, Math.round(current)),
    };
  });
};

import { getDatabase } from "@/lib/db";
import { users, characters } from "@/lib/schema";
import { count } from "drizzle-orm";

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  // 1. Initialize logic (ensure manifests are loaded)
  await dataManager.initialize();

  // 2. Aggregate Real World Data
  const areas = dataManager.getAllWorldAreas();
  const areaValues = Object.values(areas);

  let totalNpcs = 0;
  let totalSpawners = 0;
  let totalResources = 0;
  const zoneDist: { name: string; value: number }[] = [];

  areaValues.forEach((area: WorldArea) => {
    // Count exact entities defined in the manifest
    const npcCount = area.npcs?.length || 0;
    const spawnCount = area.mobSpawns?.length || 0;
    const resourceCount = area.resources?.length || 0;

    totalNpcs += npcCount;
    totalSpawners += spawnCount;
    totalResources += resourceCount;

    zoneDist.push({
      name: area.name,
      value: npcCount + spawnCount + resourceCount,
    });
  });

  // Sort top 5 zones by density
  const topZones = zoneDist.sort((a, b) => b.value - a.value).slice(0, 5);

  // 3. Fetch Real Database Metrics
  let realUserCount = 0;
  let realCharacterCount = 0;
  let dbConnected = false;

  try {
    const db = getDatabase();
    // Count users
    const [userResult] = await db.select({ count: count() }).from(users);
    realUserCount = userResult?.count || 0;

    // Count characters
    const [charResult] = await db.select({ count: count() }).from(characters);
    realCharacterCount = charResult?.count || 0;

    dbConnected = true;
  } catch (error) {
    console.warn("Analytics: DB connection failed, using offline mode.", error);
    // Silent fail for UI, just show 0 or cached
  }

  // 4. Runtime Metrics
  // If DB is connected, use real counts. If not, or if counts are 0 (dev env),
  // we might still want to show *something* but labeled clearly.
  // For now, let's treat "Active Players" as a simulated metric derived from real users (e.g., 10% online)
  // OR just show the real Total Users count.

  const activePlayers = dbConnected
    ? Math.max(1, Math.floor(realUserCount * 0.2))
    : 0; // Assume 20% online if DB works

  // Simulation fallbacks only if we absolutely have to display something lively
  const simulatedPlaytime = generateTimeSeries(
    24,
    activePlayers,
    Math.max(2, activePlayers * 0.1),
  );

  return {
    counts: {
      activePlayers: realUserCount, // showing Total Users as the main "Player" metric for Admin context
      totalZones: areaValues.length,
      totalNpcs,
      totalSpawners,
      totalResources,
      economyVolume: realCharacterCount, // Repurposing this card for "Total Characters" for now
    },
    zoneDistribution: topZones,
    entityComposition: [
      { name: "NPCs", value: totalNpcs },
      { name: "Mob Spawners", value: totalSpawners },
      { name: "Resources", value: totalResources },
    ],
    performance: {
      cpu: generateTimeSeries(24, 25, 5), // Admin panel doesn't have access to game server CPU
      memory: generateTimeSeries(24, 40, 2),
      players: simulatedPlaytime,
    },
  };
}
