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

import type { World } from "@hyperscape/shared";
import { dbHelpers } from "@hyperscape/shared";
import type { SystemDatabase } from "../../shared/types";

// Read interval from environment or default to 60 seconds
const SAVE_INTERVAL = parseInt(process.env.SAVE_INTERVAL || "60");

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
   * Currently this just reschedules itself. Player data is saved
   * automatically by DatabaseSystem on each update.
   *
   * Arrow function to preserve `this` binding.
   */
  private save = async (): Promise<void> => {
    // Reschedule next save
    this.saveTimerId = setTimeout(this.save, SAVE_INTERVAL * 1000);

    // Note: Player data is auto-saved by DatabaseSystem
    // This is here for future bulk save operations if needed
  };

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
