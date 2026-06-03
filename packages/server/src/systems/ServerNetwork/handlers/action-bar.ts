/**
 * Action Bar Handler
 *
 * Handles action bar save/load operations from clients:
 * - actionBarSave: Save action bar configuration to database
 * - actionBarLoad: Load action bar configuration from database
 *
 * Action bars are per-character and support multiple bars (0-3).
 * Each bar stores slot configurations (items, prayers, skills, spells).
 */

import type { ServerSocket } from "../../../shared/types";
import type { World } from "@hyperforge/shared";
import { eq, and } from "drizzle-orm";
import { getDatabase } from "./common/helpers";
import type { DatabaseConnection } from "./common/types";
import * as schema from "../../../database/schema";

/** Maximum number of action bars per character */
const MAX_BARS = 4;
/** Maximum slots per bar */
const MAX_SLOTS = 9;
/** Minimum slots per bar */
const MIN_SLOTS = 4;
const SHOULD_LOG_MISSING_PLAYER = process.env.PLAYWRIGHT_TEST !== "true";

/**
 * Handle action bar save request
 * Saves action bar configuration to database
 */
export function handleActionBarSave(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    if (SHOULD_LOG_MISSING_PLAYER) {
      console.warn("[ActionBar] handleActionBarSave: no player entity");
    }
    return;
  }

  const payload = data as {
    barId?: number;
    slotCount?: number;
    slots?: unknown[];
  };

  // Validate barId
  const barId = payload.barId ?? 0;
  if (barId < 0 || barId >= MAX_BARS) {
    console.warn(`[ActionBar] Invalid barId: ${barId}`);
    return;
  }

  // Validate slotCount
  const slotCount = payload.slotCount ?? 7;
  if (slotCount < MIN_SLOTS || slotCount > MAX_SLOTS) {
    console.warn(`[ActionBar] Invalid slotCount: ${slotCount}`);
    return;
  }

  // Validate slots array
  if (!Array.isArray(payload.slots)) {
    console.warn("[ActionBar] Invalid slots data");
    return;
  }

  const playerId = playerEntity.id;
  const slotsData = JSON.stringify(payload.slots);

  // Get database connection
  const db = getDatabase(world);
  if (!db) {
    console.warn("[ActionBar] No database available for save");
    return;
  }

  // Save to database asynchronously
  saveActionBarAsync(db, playerId, barId, slotCount, slotsData).catch((err) => {
    console.error("[ActionBar] Failed to save action bar:", err);
  });
}

/**
 * Handle action bar load request
 * Loads action bar configuration from database and sends to client
 */
export function handleActionBarLoad(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    if (SHOULD_LOG_MISSING_PLAYER) {
      console.warn("[ActionBar] handleActionBarLoad: no player entity");
    }
    return;
  }

  const payload = data as { barId?: number };
  const barId = payload.barId ?? 0;

  if (barId < 0 || barId >= MAX_BARS) {
    console.warn(`[ActionBar] Invalid barId: ${barId}`);
    return;
  }

  const playerId = playerEntity.id;

  // Get database connection
  const db = getDatabase(world);
  if (!db) {
    // No database, return empty slots
    if (socket.send) {
      socket.send("actionBarState", { barId, slotCount: 7, slots: [] });
    }
    return;
  }

  // Load from database asynchronously
  loadActionBarAsync(db, playerId, barId)
    .then((result) => {
      if (socket.send) {
        socket.send("actionBarState", {
          barId,
          slotCount: result?.slotCount ?? 7,
          slots: result?.slots ?? [],
        });
      }
    })
    .catch((err) => {
      console.error("[ActionBar] Failed to load action bar:", err);
    });
}

/**
 * Save action bar to database
 */
async function saveActionBarAsync(
  db: DatabaseConnection,
  playerId: string,
  barId: number,
  slotCount: number,
  slotsData: string,
): Promise<void> {
  const now = Date.now();

  // Upsert: insert or update if exists
  await db.drizzle
    .insert(schema.actionBarStorage)
    .values({
      playerId,
      barId,
      slotCount,
      slotsData,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.actionBarStorage.playerId, schema.actionBarStorage.barId],
      set: {
        slotCount,
        slotsData,
        updatedAt: now,
      },
    });
}

/**
 * Load action bar from database
 */
async function loadActionBarAsync(
  db: DatabaseConnection,
  playerId: string,
  barId: number,
): Promise<{ slotCount: number; slots: unknown[] } | null> {
  const rows = await db.drizzle
    .select()
    .from(schema.actionBarStorage)
    .where(
      and(
        eq(schema.actionBarStorage.playerId, playerId),
        eq(schema.actionBarStorage.barId, barId),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  try {
    const slots = JSON.parse(row.slotsData);
    return {
      slotCount: row.slotCount,
      slots: Array.isArray(slots) ? slots : [],
    };
  } catch {
    console.error("[ActionBar] Failed to parse slots data");
    return null;
  }
}

/**
 * Load all action bars for a player (used during character login)
 */
export async function loadAllActionBarsAsync(
  db: DatabaseConnection,
  playerId: string,
): Promise<Map<number, { slotCount: number; slots: unknown[] }>> {
  const result = new Map<number, { slotCount: number; slots: unknown[] }>();

  const rows = await db.drizzle
    .select()
    .from(schema.actionBarStorage)
    .where(eq(schema.actionBarStorage.playerId, playerId));

  for (const row of rows) {
    try {
      const slots = JSON.parse(row.slotsData);
      result.set(row.barId, {
        slotCount: row.slotCount,
        slots: Array.isArray(slots) ? slots : [],
      });
    } catch {
      console.error(
        `[ActionBar] Failed to parse slots data for bar ${row.barId}`,
      );
    }
  }

  return result;
}
