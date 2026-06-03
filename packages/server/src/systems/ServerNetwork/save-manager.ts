/**
 * Save Manager Module - Periodic data persistence
 *
 * Manages periodic saving of world state to the database including
 * settings, player data, and other persistent state.
 *
 * Responsibilities:
 * - Schedule periodic saves (configurable interval)
 * - Save world settings when changed
 * - Clean up timers on shutdown
 * - Watch for settings changes
 *
 * Usage:
 * ```typescript
 * const saveManager = new SaveManager(world, db);
 * await saveManager.start(); // Start periodic saves
 * saveManager.destroy(); // Stop all saves
 * ```
 */

import type { World } from "@hyperforge/shared";
import { dbHelpers } from "@hyperforge/shared";
import type { SystemDatabase } from "../../shared/types";

// Read interval from environment or default to 15 seconds
const SAVE_INTERVAL = parseInt(process.env.SAVE_INTERVAL || "15");

/**
 * SaveManager - Handles periodic world state persistence
 *
 * Manages timer-based saving and settings change watching.
 */
export class SaveManager {
  /** Interval handle for periodic saves */
  private saveTimerId: NodeJS.Timeout | null = null;

  /**
   * Create a SaveManager
   *
   * @param world - Game world instance
   * @param db - Database instance for persistence
   */
  constructor(
    private world: World,
    private db: SystemDatabase,
  ) {}

  /**
   * Start periodic saves and watch for settings changes
   *
   * Sets up the save timer and registers settings change listener.
   * Call this after world initialization is complete.
   */
  start(): void {
    // Watch settings changes
    if (this.world.settings.on) {
      this.world.settings.on("change", this.saveSettings);
    }

    // Queue first save
    if (SAVE_INTERVAL) {
      this.saveTimerId = setTimeout(this.save, SAVE_INTERVAL * 1000);
    }
  }

  /**
   * Stop all saves and clean up resources
   *
   * Cancels the save timer and unregisters settings listener.
   * Called during server shutdown.
   */
  destroy(): void {
    if (this.saveTimerId) {
      clearTimeout(this.saveTimerId);
      this.saveTimerId = null;
    }
    this.world.settings.off("change", this.saveSettings);
  }

  /**
   * Periodic save handler
   *
   * Flushes anti-cheat violation records to DB and reschedules.
   * Player data is auto-saved by DatabaseSystem on each update.
   *
   * Arrow function to preserve `this` binding.
   */
  private save = async (): Promise<void> => {
    // Reschedule next save
    this.saveTimerId = setTimeout(this.save, SAVE_INTERVAL * 1000);

    // Flush anti-cheat violation records to DB
    this.flushAntiCheatViolations();
  };

  /**
   * Flush buffered anti-cheat violations to the database.
   * Fire-and-forget: errors are logged but never block the save cycle.
   */
  private flushAntiCheatViolations(): void {
    try {
      const combatSystem = this.world.getSystem("combat");
      if (!combatSystem) return;

      const records = combatSystem.antiCheat.getPendingFlushRecords();
      if (records.length === 0) return;

      const rows = records.map(
        (r: {
          playerId: string;
          type: string;
          severity: string | number;
          details: string;
          targetId?: string | null;
          gameTick?: number | null;
          timestamp: number;
        }) => ({
          playerId: r.playerId,
          violationType: r.type,
          severity: String(r.severity),
          details: r.details,
          targetId: r.targetId ?? null,
          gameTick: r.gameTick ?? null,
          score: 0,
          actionTaken: null,
          timestamp: r.timestamp,
        }),
      );

      // Fire-and-forget batch insert via Knex-style DB
      this.db("anti_cheat_violations")
        .insert(rows)
        .then(() => {
          // noop on success
        })
        .catch((err: unknown) => {
          console.error(
            `[SaveManager] Failed to flush ${rows.length} anti-cheat violations:`,
            err,
          );
        });
    } catch (err) {
      console.error("[SaveManager] Error preparing anti-cheat flush:", err);
    }
  }

  /**
   * Save world settings to database
   *
   * Called automatically when world settings change.
   * Serializes settings and persists to config table.
   *
   * Arrow function to preserve `this` binding.
   */
  private saveSettings = async (): Promise<void> => {
    try {
      const data = this.world.settings.serialize
        ? this.world.settings.serialize()
        : {};
      const value = JSON.stringify(data);
      await dbHelpers.setConfig(this.db, "settings", value);
    } catch (err) {
      console.error("[SaveManager] Error saving settings:", err);
    }
  };
}
