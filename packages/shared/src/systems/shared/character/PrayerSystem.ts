/**
 * PrayerSystem - Manages player prayer state and mechanics
 *
 * Server-authoritative system that handles all prayer operations:
 * - Activating/deactivating prayers
 * - Prayer point drain mechanics (rules-accurate formula)
 * - Conflict resolution (auto-deactivate conflicting prayers)
 * - Level requirement validation
 * - Combat bonus calculations
 * - Database persistence
 *
 * classic MMORPG Prayer Drain Formula:
 * drain_resistance = 2 * prayer_bonus + 60
 * drain_per_tick = drain_effect / drain_resistance (per 0.6s game tick)
 *
 * @see {@link PrayerDataProvider} for prayer definitions
 * @see {@link SkillsSystem} for prayer XP and leveling
 */

import { SystemBase } from "../infrastructure/SystemBase";
import type { World } from "../../../core/World";
import { EventType } from "../../../types/events";
import { Logger } from "../../../utils/Logger";
import {
  createPlayerID,
  isValidPlayerID,
  toPlayerID,
} from "../../../utils/IdentifierUtils";
import type { PlayerID } from "../../../types/core/identifiers";
import type { DatabaseSystem } from "../../../types/systems/system-interfaces";
import {
  prayerDataProvider,
  type PrayerDefinition,
} from "../../../data/PrayerDataProvider";
import type { PlayerJoinedPayload } from "../../../types/events";
import {
  type PrayerState,
  isValidPrayerId,
  MAX_ACTIVE_PRAYERS,
  PRAYER_TOGGLE_COOLDOWN_MS,
  PRAYER_TOGGLE_RATE_LIMIT,
  getPlayerPrayerLevel,
  getPlayerPrayerBonus,
  type PlayerWithPrayerStats,
  // Type guards for validation
  isPlayerRegisteredPayload,
  isPlayerCleanupPayload,
  isPrayerToggleEventPayload,
  isAltarPrayPayload,
  // Bounds checking
  clampPrayerLevel,
  clampPrayerPoints,
  isValidRestoreAmount,
} from "../../../types/game/prayer-types";

/**
 * Mutable prayer bonuses buffer for hot-path calculations
 * (PrayerBonuses from types has readonly properties)
 */
interface MutablePrayerBonuses {
  attackMultiplier?: number;
  strengthMultiplier?: number;
  defenseMultiplier?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Game tick duration in ms (classic MMORPG uses 600ms ticks) */
const GAME_TICK_MS = 600;

/** How often to process prayer drain (in ms) */
const DRAIN_INTERVAL_MS = GAME_TICK_MS;

/** Default starting prayer points */
const DEFAULT_PRAYER_POINTS = 1;

// MAX_PRAYER_POINTS imported from prayer-types.ts

/** Base drain resistance constant (classic combat formula) */
const BASE_DRAIN_RESISTANCE = 60;

/** Prayer bonus multiplier for drain resistance (classic combat formula) */
const PRAYER_BONUS_MULTIPLIER = 2;

/**
 * Get display-friendly prayer points (uses ceil so fractional points show as next higher number)
 * This prevents the UI from showing 0 when there's still 0.98 points remaining.
 * Only shows 0 when truly depleted.
 */
function getDisplayPoints(points: number): number {
  return points <= 0 ? 0 : Math.ceil(points);
}

interface ParsedActivePrayersResult {
  activePrayers: string[];
  shouldRepair: boolean;
}

export function parsePersistedActivePrayers(
  rawActivePrayers: unknown,
  playerId: string,
): ParsedActivePrayersResult {
  if (rawActivePrayers === null || rawActivePrayers === undefined) {
    return { activePrayers: [], shouldRepair: false };
  }

  let parsed: unknown = rawActivePrayers;
  let shouldRepair = false;

  if (typeof rawActivePrayers === "string") {
    const trimmed = rawActivePrayers.trim();
    if (trimmed.length === 0) {
      return { activePrayers: [], shouldRepair: true };
    }

    try {
      parsed = JSON.parse(trimmed);
    } catch (parseError) {
      Logger.systemError(
        "PrayerSystem",
        `Corrupted activePrayers JSON for ${playerId}`,
        parseError instanceof Error
          ? parseError
          : new Error(String(parseError)),
      );
      return { activePrayers: [], shouldRepair: true };
    }
  }

  if (!Array.isArray(parsed)) {
    Logger.systemWarn(
      "PrayerSystem",
      `Invalid activePrayers data for ${playerId}; expected array`,
    );
    return { activePrayers: [], shouldRepair: true };
  }

  const filtered = parsed.filter(
    (id): id is string => typeof id === "string" && isValidPrayerId(id),
  );

  if (filtered.length !== parsed.length) {
    shouldRepair = true;
  }

  const deduped = Array.from(new Set(filtered));
  if (deduped.length !== filtered.length) {
    shouldRepair = true;
  }

  return { activePrayers: deduped, shouldRepair };
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Per-player prayer state (in-memory)
 */
interface PlayerPrayerState {
  /** Current prayer points (fractional for precise drain) */
  points: number;
  /** Maximum prayer points (based on prayer level) */
  maxPoints: number;
  /** Currently active prayer IDs */
  active: Set<string>;
  /** Last toggle timestamp for rate limiting */
  lastToggleTime: number;
  /** Toggle count in current rate limit window */
  toggleCount: number;
  /** Rate limit window start time */
  rateLimitWindowStart: number;
  /** Whether state has been modified and needs persistence */
  dirty: boolean;
}

/**
 * Prayer toggle result
 */
interface PrayerToggleResult {
  success: boolean;
  reason?: string;
  deactivated?: string[];
}

// ============================================================================
// PRAYER SYSTEM
// ============================================================================

/**
 * PrayerSystem - Manages prayer state and mechanics
 *
 * Single Responsibility: Only handles prayer state and operations.
 * Does NOT handle prayer XP/leveling (that's SkillsSystem).
 */
export class PrayerSystem extends SystemBase {
  /** Prayer state per player */
  private playerStates = new Map<PlayerID, PlayerPrayerState>();

  /** Players currently loading from database */
  private loadingPlayers = new Set<string>();

  /** In-flight initialization promises keyed by player id */
  private initializationPromises = new Map<string, Promise<void>>();

  /** Players whose prayer state has been initialized */
  private initializedPlayers = new Set<string>();

  /** Pending persist timers (debounced saves) */
  private persistTimers = new Map<string, NodeJS.Timeout>();

  /** Drain processing interval handle */
  private drainInterval?: NodeJS.Timeout;

  /** Auto-save interval handle */
  private autoSaveInterval?: NodeJS.Timeout;

  /** Auto-save interval in ms */
  private readonly AUTO_SAVE_INTERVAL = 15000; // 15 seconds

  // ============================================================================
  // EVENT HANDLERS (stored for cleanup)
  // ============================================================================

  /**
   * Handler for PLAYER_REGISTERED events
   * Validates payload before processing to prevent type-related bugs.
   */
  private readonly onPlayerRegistered = async (
    event: unknown,
  ): Promise<void> => {
    if (!isPlayerRegisteredPayload(event)) {
      Logger.systemError(
        "PrayerSystem",
        "Invalid PLAYER_REGISTERED payload",
        new Error(`Invalid payload: ${JSON.stringify(event)}`),
      );
      return;
    }
    await this.initializePlayerPrayer(event.playerId);
  };

  /**
   * Handler for PLAYER_CLEANUP events
   * Validates payload before processing.
   */
  private readonly onPlayerCleanup = (event: unknown): void => {
    if (!isPlayerCleanupPayload(event)) {
      Logger.systemError(
        "PrayerSystem",
        "Invalid PLAYER_CLEANUP payload",
        new Error(`Invalid payload: ${JSON.stringify(event)}`),
      );
      return;
    }
    this.cleanupPlayerPrayer(event.playerId);
  };

  /**
   * Handler for PLAYER_LEFT events (disconnect).
   * Persists prayer state and cleans up — PLAYER_CLEANUP is never emitted
   * during disconnect, so this ensures prayer data is saved.
   */
  private readonly onPlayerLeft = (event: unknown): void => {
    const data = event as { playerId?: string };
    if (!data?.playerId) return;
    this.cleanupPlayerPrayer(data.playerId);
  };

  /**
   * Handler for PLAYER_JOINED events.
   * Re-emits the authoritative prayer snapshot for the new session after join.
   */
  private readonly onPlayerJoined = async (event: unknown): Promise<void> => {
    if (!this.world.isServer) {
      return;
    }

    const payload = event as Partial<PlayerJoinedPayload>;
    if (!payload.playerId || typeof payload.playerId !== "string") {
      Logger.systemError(
        "PrayerSystem",
        "Invalid PLAYER_JOINED payload",
        new Error(`Invalid payload: ${JSON.stringify(event)}`),
      );
      return;
    }

    const state = await this.ensurePlayerPrayerInitialized(payload.playerId);
    if (!state) {
      return;
    }

    this.emitPrayerStateSync(payload.playerId, state);
  };

  /**
   * Handler for PRAYER_TOGGLE events
   * Validates payload including prayer ID format before processing.
   */
  private readonly onPrayerToggle = async (event: unknown): Promise<void> => {
    if (!isPrayerToggleEventPayload(event)) {
      Logger.systemError(
        "PrayerSystem",
        "Invalid PRAYER_TOGGLE payload",
        new Error(`Invalid payload: ${JSON.stringify(event)}`),
      );
      return;
    }
    await this.ensurePlayerPrayerInitialized(event.playerId);
    this.handlePrayerToggle(event.playerId, event.prayerId);
  };

  /**
   * Handler for ALTAR_PRAY events
   * Validates payload including altar ID before processing.
   */
  private readonly onAltarPray = async (event: unknown): Promise<void> => {
    if (!isAltarPrayPayload(event)) {
      Logger.systemError(
        "PrayerSystem",
        "Invalid ALTAR_PRAY payload",
        new Error(`Invalid payload: ${JSON.stringify(event)}`),
      );
      return;
    }
    await this.ensurePlayerPrayerInitialized(event.playerId);
    this.handleAltarPray(event.playerId, event.altarId);
  };

  /**
   * Handler for PRAYER_DEACTIVATED events from handlers (deactivate all request)
   * Handles the special "*" prayerId marker for deactivating all prayers.
   */
  private readonly onPrayerDeactivated = (event: unknown): void => {
    if (!event || typeof event !== "object") return;

    const payload = event as {
      playerId?: string;
      prayerId?: string;
      reason?: string;
    };

    // Only handle deactivate-all requests (prayerId === "*")
    // Regular deactivations are handled internally, not via this event
    if (payload.prayerId !== "*") return;

    if (
      !payload.playerId ||
      typeof payload.playerId !== "string" ||
      payload.playerId.length === 0
    ) {
      Logger.systemError(
        "PrayerSystem",
        "Invalid PRAYER_DEACTIVATED payload for deactivate-all",
        new Error(`Invalid payload: ${JSON.stringify(event)}`),
      );
      return;
    }

    // Deactivate all prayers for this player
    this.deactivateAllPrayers(payload.playerId);
  };

  // ============================================================================
  // PRE-ALLOCATED BUFFERS (Memory optimization)
  // ============================================================================

  /**
   * Reusable array for collecting prayers to deactivate.
   * WARNING: Do not store references to this buffer - contents change between calls.
   */
  private readonly deactivateBuffer: string[] = [];

  /**
   * Reusable object for combined bonuses calculation.
   * WARNING: Do not store references to this buffer - contents change between calls.
   */
  private readonly combinedBonusesBuffer: MutablePrayerBonuses = {
    attackMultiplier: undefined,
    strengthMultiplier: undefined,
    defenseMultiplier: undefined,
  };

  constructor(world: World) {
    super(world, {
      name: "prayer",
      dependencies: {
        required: [],
        optional: ["database", "skills"],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Ensure prayer data is loaded
    if (!prayerDataProvider.isReady()) {
      prayerDataProvider.initialize();
    }

    // Subscribe via world.on() for events from handlers/other systems
    // (handlers use world.emit which is EventEmitter3, not $eventBus)
    this.world.on(EventType.PLAYER_REGISTERED, this.onPlayerRegistered);
    this.world.on(EventType.PLAYER_CLEANUP, this.onPlayerCleanup);
    this.world.on(EventType.PLAYER_LEFT, this.onPlayerLeft);
    this.world.on(EventType.PLAYER_JOINED, this.onPlayerJoined);
    this.world.on(EventType.PRAYER_TOGGLE, this.onPrayerToggle);
    this.world.on(EventType.ALTAR_PRAY, this.onAltarPray);
    // Listen for deactivate-all requests (prayerId === "*")
    this.world.on(EventType.PRAYER_DEACTIVATED, this.onPrayerDeactivated);

    Logger.system("PrayerSystem", "Initialized");
  }

  /**
   * Start the prayer system - begins drain processing and auto-save on server
   */
  start(): void {
    // Start drain processing on server only
    if (this.world.isServer) {
      this.startDrainProcessing();
      this.startAutoSave();
      this.backfillExistingPlayers();
      Logger.system("PrayerSystem", "Started drain processing and auto-save");
    }
  }

  // ==========================================================================
  // PLAYER INITIALIZATION
  // ==========================================================================

  /**
   * Initialize prayer state for a player (load from DB or set defaults)
   */
  private async initializePlayerPrayer(playerId: string): Promise<void> {
    if (!isValidPlayerID(playerId)) {
      Logger.systemError(
        "PrayerSystem",
        `Invalid player ID: "${playerId}"`,
        new Error(`Invalid player ID: "${playerId}"`),
      );
      return;
    }

    // Prevent race conditions during load
    const existingInit = this.initializationPromises.get(playerId);
    if (existingInit) {
      await existingInit;
      return;
    }

    const initPromise = (async () => {
      this.loadingPlayers.add(playerId);

      try {
        const db = this.getDatabase();
        let points = DEFAULT_PRAYER_POINTS;
        let maxPoints = DEFAULT_PRAYER_POINTS;
        let activePrayers: string[] = [];

        if (db) {
          try {
            const playerRow = await db.getPlayerAsync(playerId);
            if (playerRow) {
              // Load prayer level to calculate max points (with bounds checking)
              const rawPrayerLevel = (playerRow as { prayerLevel?: number })
                .prayerLevel;
              maxPoints = clampPrayerLevel(rawPrayerLevel ?? 1);

              // Load current points (with bounds checking, default to max if not set)
              const rawPoints = (playerRow as { prayerPoints?: number })
                .prayerPoints;
              points = clampPrayerPoints(rawPoints ?? maxPoints, maxPoints);

              // Load active prayers from DB (supports legacy JSON string + JSONB array)
              const rawActivePrayers = (
                playerRow as {
                  activePrayers?: unknown;
                }
              ).activePrayers;
              const parsedActivePrayers = parsePersistedActivePrayers(
                rawActivePrayers,
                playerId,
              );
              activePrayers = parsedActivePrayers.activePrayers;

              if (parsedActivePrayers.shouldRepair) {
                db.savePlayer(playerId, {
                  activePrayers,
                } as Record<string, unknown>);
              }
            }
          } catch (dbError) {
            // Log database error but continue with defaults
            Logger.systemError(
              "PrayerSystem",
              `Database error loading prayer state for ${playerId}`,
              dbError instanceof Error ? dbError : new Error(String(dbError)),
            );
          }
        }

        const playerIdKey = createPlayerID(playerId);
        const state: PlayerPrayerState = {
          points: Math.min(points, maxPoints),
          maxPoints,
          active: new Set(activePrayers),
          lastToggleTime: 0,
          toggleCount: 0,
          rateLimitWindowStart: 0,
          dirty: false,
        };

        this.playerStates.set(playerIdKey, state);
        this.initializedPlayers.add(playerId);

        // Emit state sync event
        this.emitPrayerStateSync(playerId, state);

        Logger.system(
          "PrayerSystem",
          `Initialized prayer for ${playerId}: ${state.points}/${state.maxPoints} points, ${state.active.size} active`,
        );
      } finally {
        this.loadingPlayers.delete(playerId);
        this.initializationPromises.delete(playerId);
      }
    })();

    this.initializationPromises.set(playerId, initPromise);
    await initPromise;
  }

  private async ensurePlayerPrayerInitialized(
    playerId: string,
  ): Promise<PlayerPrayerState | undefined> {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) {
      Logger.systemError(
        "PrayerSystem",
        `Cannot initialize prayer for invalid player id: ${playerId}`,
        new Error("Invalid player id"),
      );
      return undefined;
    }

    const existingState = this.playerStates.get(playerIdKey);
    if (existingState) {
      return existingState;
    }

    await this.initializePlayerPrayer(playerId);
    return this.playerStates.get(playerIdKey);
  }

  private backfillExistingPlayers(): void {
    for (const player of this.world.getPlayers()) {
      if (!player?.id) continue;
      if (
        this.initializedPlayers.has(player.id) ||
        this.loadingPlayers.has(player.id)
      ) {
        continue;
      }
      void this.initializePlayerPrayer(player.id);
    }
  }

  /**
   * Cleanup prayer state when player disconnects
   */
  private cleanupPlayerPrayer(playerId: string): void {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return;

    // Persist before cleanup if on server
    if (this.world.isServer) {
      this.persistPrayerImmediate(playerId);
    }

    this.playerStates.delete(playerIdKey);
    this.loadingPlayers.delete(playerId);
    this.initializedPlayers.delete(playerId);
    this.initializationPromises.delete(playerIdKey);

    // Clear any pending persist timer
    const timer = this.persistTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.persistTimers.delete(playerId);
    }
  }

  // ==========================================================================
  // PRAYER TOGGLING
  // ==========================================================================

  /**
   * Handle altar pray request - recharge prayer points to full
   */
  private handleAltarPray(playerId: string, _altarId: string): void {
    if (!isValidPlayerID(playerId)) {
      return;
    }

    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return;

    const state = this.playerStates.get(playerIdKey);
    if (!state) {
      Logger.systemError(
        "PrayerSystem",
        `Cannot pray at altar - prayer not initialized for ${playerId}`,
        new Error("Prayer not initialized"),
      );
      return;
    }

    const oldPoints = state.points;
    const maxPoints = state.maxPoints;

    // Check if already at max
    if (oldPoints >= maxPoints) {
      // Use world.emit for EventBridge to route to client
      this.world.emit(EventType.UI_TOAST, {
        playerId,
        message: "Your prayer is already fully recharged.",
        type: "info",
      });
      return;
    }

    // Recharge to full
    state.points = maxPoints;
    state.dirty = true;

    // Emit points changed event (use world.emit for EventBridge routing)
    this.world.emit(EventType.PRAYER_POINTS_CHANGED, {
      playerId,
      points: getDisplayPoints(state.points),
      maxPoints: state.maxPoints,
    });

    // Emit state sync
    this.emitPrayerStateSync(playerId, state);

    // Schedule persistence
    this.schedulePersist(playerId);

    // Show success message (use world.emit for EventBridge routing)
    this.world.emit(EventType.UI_TOAST, {
      playerId,
      message: "You recharge your prayer points.",
      type: "success",
    });

    Logger.system(
      "PrayerSystem",
      `${playerId} recharged prayer at altar: ${getDisplayPoints(oldPoints)} -> ${maxPoints}`,
    );
  }

  /**
   * Handle prayer toggle request
   */
  private handlePrayerToggle(playerId: string, prayerId: string): void {
    if (!isValidPlayerID(playerId)) {
      return;
    }

    // Validate prayer ID format (security)
    if (!isValidPrayerId(prayerId)) {
      Logger.systemError(
        "PrayerSystem",
        `Invalid prayer ID format: "${prayerId}"`,
        new Error(`Invalid prayer ID: ${prayerId}`),
      );
      return;
    }

    const result = this.togglePrayer(playerId, prayerId);

    if (!result.success) {
      const errorMessage = result.reason || "Cannot toggle prayer";

      // Emit to chat (system message)
      this.world.emit(EventType.UI_MESSAGE, {
        playerId,
        message: errorMessage,
        type: "system",
      });

      // Also emit toast for visual feedback
      this.world.emit(EventType.UI_TOAST, {
        playerId,
        message: errorMessage,
        type: "error",
      });
    }
  }

  /**
   * Toggle a prayer on or off
   *
   * @param playerId - Player toggling the prayer
   * @param prayerId - Prayer to toggle
   * @returns Result with success flag and any deactivated prayers
   */
  togglePrayer(playerId: string, prayerId: string): PrayerToggleResult {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) {
      return { success: false, reason: "Invalid player" };
    }

    const state = this.playerStates.get(playerIdKey);
    if (!state) {
      return { success: false, reason: "Prayer not initialized" };
    }

    // Rate limiting check
    const now = Date.now();
    if (!this.checkRateLimit(state, now)) {
      return { success: false, reason: "Too many prayer toggles" };
    }

    // Get prayer definition
    const prayer = prayerDataProvider.getPrayer(prayerId);
    if (!prayer) {
      return { success: false, reason: "Unknown prayer" };
    }

    // Check if deactivating
    if (state.active.has(prayerId)) {
      return this.deactivatePrayer(playerId, state, prayerId);
    }

    // Activating - check requirements
    return this.activatePrayer(playerId, state, prayer);
  }

  /**
   * Activate a prayer
   */
  private activatePrayer(
    playerId: string,
    state: PlayerPrayerState,
    prayer: PrayerDefinition,
  ): PrayerToggleResult {
    // Get player's prayer level
    const player = this.getPlayerEntity(playerId);
    const prayerLevel = player
      ? getPlayerPrayerLevel(player as PlayerWithPrayerStats)
      : Math.max(1, Math.floor(state.maxPoints));

    // Check level requirement
    if (prayerLevel < prayer.level) {
      return {
        success: false,
        reason: `Requires prayer level ${prayer.level}`,
      };
    }

    // Check prayer points
    if (state.points <= 0) {
      return { success: false, reason: "No prayer points remaining" };
    }

    // Check max active prayers
    if (state.active.size >= MAX_ACTIVE_PRAYERS) {
      return {
        success: false,
        reason: `Cannot have more than ${MAX_ACTIVE_PRAYERS} prayers active`,
      };
    }

    // Handle conflicts - deactivate conflicting prayers
    const deactivated: string[] = [];
    const conflicts = prayerDataProvider.getConflictsWithActive(
      prayer.id,
      Array.from(state.active),
    );

    for (const conflictId of conflicts) {
      state.active.delete(conflictId);
      deactivated.push(conflictId);

      // Emit deactivation event (use world.emit for EventBridge routing)
      this.world.emit(EventType.PRAYER_DEACTIVATED, {
        playerId,
        prayerId: conflictId,
        reason: "conflict",
      });
    }

    // Activate the prayer
    state.active.add(prayer.id);
    state.dirty = true;

    // Emit toggled event (use world.emit for EventBridge routing to client)
    this.world.emit(EventType.PRAYER_TOGGLED, {
      playerId,
      prayerId: prayer.id,
      active: true,
      points: getDisplayPoints(state.points),
    });

    // Emit state sync
    this.emitPrayerStateSync(playerId, state);

    // Schedule persistence
    this.schedulePersist(playerId);

    return { success: true, deactivated };
  }

  /**
   * Deactivate a prayer
   */
  private deactivatePrayer(
    playerId: string,
    state: PlayerPrayerState,
    prayerId: string,
  ): PrayerToggleResult {
    state.active.delete(prayerId);
    state.dirty = true;

    // Emit toggled event (use world.emit for EventBridge routing to client)
    this.world.emit(EventType.PRAYER_TOGGLED, {
      playerId,
      prayerId,
      active: false,
      points: getDisplayPoints(state.points),
    });

    // Emit state sync
    this.emitPrayerStateSync(playerId, state);

    // Schedule persistence
    this.schedulePersist(playerId);

    return { success: true };
  }

  /**
   * Deactivate all prayers for a player
   */
  deactivateAllPrayers(playerId: string): void {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return;

    const state = this.playerStates.get(playerIdKey);
    if (!state || state.active.size === 0) return;

    // Collect prayers to deactivate
    this.deactivateBuffer.length = 0;
    for (const prayerId of state.active) {
      this.deactivateBuffer.push(prayerId);
    }

    // Deactivate all
    state.active.clear();
    state.dirty = true;

    // Emit events for each (use world.emit for EventBridge routing)
    for (const prayerId of this.deactivateBuffer) {
      this.world.emit(EventType.PRAYER_DEACTIVATED, {
        playerId,
        prayerId,
        reason: "deactivate_all",
      });
    }

    // Emit state sync
    this.emitPrayerStateSync(playerId, state);

    // Schedule persistence
    this.schedulePersist(playerId);
  }

  // ==========================================================================
  // RATE LIMITING
  // ==========================================================================

  /**
   * Check if toggle is within rate limits
   */
  private checkRateLimit(state: PlayerPrayerState, now: number): boolean {
    // Check cooldown
    if (now - state.lastToggleTime < PRAYER_TOGGLE_COOLDOWN_MS) {
      return false;
    }

    // Check rate limit window (1 second)
    const windowDuration = 1000;
    if (now - state.rateLimitWindowStart > windowDuration) {
      // Reset window
      state.rateLimitWindowStart = now;
      state.toggleCount = 0;
    }

    if (state.toggleCount >= PRAYER_TOGGLE_RATE_LIMIT) {
      return false;
    }

    // Update state
    state.lastToggleTime = now;
    state.toggleCount++;

    return true;
  }

  // ==========================================================================
  // PRAYER DRAIN
  // ==========================================================================

  /**
   * Start the drain processing interval
   */
  private startDrainProcessing(): void {
    if (this.drainInterval) {
      clearInterval(this.drainInterval);
    }

    this.drainInterval = setInterval(() => {
      this.processDrainTick();
    }, DRAIN_INTERVAL_MS);
  }

  /**
   * Process prayer drain for all players with active prayers
   */
  private processDrainTick(): void {
    for (const [playerIdKey, state] of this.playerStates) {
      if (state.active.size === 0) continue;
      if (state.points <= 0) continue;

      // Get player's prayer bonus
      const playerId = playerIdKey as string;
      const player = this.getPlayerEntity(playerId);
      const prayerBonus = getPlayerPrayerBonus(player as PlayerWithPrayerStats);

      // Calculate total drain
      let totalDrain = 0;
      for (const prayerId of state.active) {
        const drainRate = prayerDataProvider.getPrayerDrainRate(prayerId);
        totalDrain += drainRate;
      }

      if (totalDrain <= 0) continue;

      // classic MMORPG drain formula: drain_resistance = 2 * prayer_bonus + 60
      const drainResistance =
        PRAYER_BONUS_MULTIPLIER * prayerBonus + BASE_DRAIN_RESISTANCE;

      // Points drained this tick
      const pointsDrained = totalDrain / drainResistance;

      // Apply drain
      const oldPoints = state.points;
      state.points = Math.max(0, state.points - pointsDrained);
      state.dirty = true;

      // Check if points depleted
      if (state.points <= 0 && oldPoints > 0) {
        // Deactivate all prayers
        this.deactivateAllPrayers(playerId);

        const depletedMessage = "You have run out of prayer points.";

        // Emit to chat (system message)
        this.world.emit(EventType.UI_MESSAGE, {
          playerId,
          message: depletedMessage,
          type: "system",
        });

        // Also emit toast for visual feedback
        this.world.emit(EventType.UI_TOAST, {
          playerId,
          message: depletedMessage,
          type: "warning",
        });
      }

      // Emit points changed if whole number changed (use world.emit for EventBridge routing)
      if (getDisplayPoints(oldPoints) !== getDisplayPoints(state.points)) {
        this.world.emit(EventType.PRAYER_POINTS_CHANGED, {
          playerId,
          points: getDisplayPoints(state.points),
          maxPoints: state.maxPoints,
        });
      }
    }
  }

  // ==========================================================================
  // PRAYER POINTS
  // ==========================================================================

  /**
   * Get current prayer points for a player
   */
  getPrayerPoints(playerId: string): number {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return 0;

    const state = this.playerStates.get(playerIdKey);
    return state ? getDisplayPoints(state.points) : 0;
  }

  /**
   * Get max prayer points for a player
   */
  getMaxPrayerPoints(playerId: string): number {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return 1;

    const state = this.playerStates.get(playerIdKey);
    return state?.maxPoints ?? 1;
  }

  /**
   * Restore prayer points (e.g., from altar, potion)
   *
   * @param playerId - Player to restore points for
   * @param amount - Amount to restore (must be positive finite number)
   */
  restorePrayerPoints(playerId: string, amount: number): void {
    // Input validation
    if (!isValidRestoreAmount(amount)) {
      Logger.systemError(
        "PrayerSystem",
        `Invalid restore amount: ${amount} for ${playerId}`,
        new Error(`Invalid restore amount: ${amount}`),
      );
      return;
    }

    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return;

    const state = this.playerStates.get(playerIdKey);
    if (!state) return;

    const oldPoints = state.points;
    // Use clampPrayerPoints for bounds safety
    state.points = clampPrayerPoints(state.points + amount, state.maxPoints);
    state.dirty = true;

    if (getDisplayPoints(oldPoints) !== getDisplayPoints(state.points)) {
      // Use world.emit for EventBridge routing
      this.world.emit(EventType.PRAYER_POINTS_CHANGED, {
        playerId,
        points: getDisplayPoints(state.points),
        maxPoints: state.maxPoints,
      });

      this.emitPrayerStateSync(playerId, state);
      this.schedulePersist(playerId);
    }
  }

  /**
   * Set max prayer points (called when prayer level changes)
   *
   * @param playerId - Player to set max points for
   * @param maxPoints - New maximum (clamped to [1, 99])
   */
  setMaxPrayerPoints(playerId: string, maxPoints: number): void {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return;

    const state = this.playerStates.get(playerIdKey);
    if (!state) return;

    // Use clampPrayerLevel for bounds safety (max points = prayer level)
    const newMaxPoints = clampPrayerLevel(maxPoints);
    state.maxPoints = newMaxPoints;

    // Cap current points to new max if needed
    if (state.points > newMaxPoints) {
      state.points = newMaxPoints;
    }

    state.dirty = true;

    this.emitPrayerStateSync(playerId, state);
    this.schedulePersist(playerId);
  }

  // ==========================================================================
  // ACTIVE PRAYERS
  // ==========================================================================

  /**
   * Get active prayer IDs for a player
   */
  getActivePrayers(playerId: string): readonly string[] {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return [];

    const state = this.playerStates.get(playerIdKey);
    return state ? Array.from(state.active) : [];
  }

  /**
   * Check if a specific prayer is active
   */
  isPrayerActive(playerId: string, prayerId: string): boolean {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return false;

    const state = this.playerStates.get(playerIdKey);
    return state?.active.has(prayerId) ?? false;
  }

  // ==========================================================================
  // COMBAT BONUSES
  // ==========================================================================

  /**
   * Get combined bonuses from all active prayers
   * Uses pre-allocated buffer to avoid allocations in combat hot paths.
   *
   * @returns Reference to internal buffer - do not store long-term
   */
  getCombinedBonuses(playerId: string): MutablePrayerBonuses {
    // Reset buffer
    this.combinedBonusesBuffer.attackMultiplier = undefined;
    this.combinedBonusesBuffer.strengthMultiplier = undefined;
    this.combinedBonusesBuffer.defenseMultiplier = undefined;

    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return this.combinedBonusesBuffer;

    const state = this.playerStates.get(playerIdKey);
    if (!state || state.active.size === 0) return this.combinedBonusesBuffer;

    // Combine bonuses from all active prayers
    for (const prayerId of state.active) {
      const bonuses = prayerDataProvider.getPrayerBonuses(prayerId);
      if (!bonuses) continue;

      // Take the highest multiplier for each stat (prayers don't stack additively)
      if (bonuses.attackMultiplier !== undefined) {
        this.combinedBonusesBuffer.attackMultiplier = Math.max(
          this.combinedBonusesBuffer.attackMultiplier ?? 1,
          bonuses.attackMultiplier,
        );
      }
      if (bonuses.strengthMultiplier !== undefined) {
        this.combinedBonusesBuffer.strengthMultiplier = Math.max(
          this.combinedBonusesBuffer.strengthMultiplier ?? 1,
          bonuses.strengthMultiplier,
        );
      }
      if (bonuses.defenseMultiplier !== undefined) {
        this.combinedBonusesBuffer.defenseMultiplier = Math.max(
          this.combinedBonusesBuffer.defenseMultiplier ?? 1,
          bonuses.defenseMultiplier,
        );
      }
    }

    return this.combinedBonusesBuffer;
  }

  /**
   * Get effective attack level with prayer bonuses
   */
  getEffectiveAttackLevel(playerId: string, baseLevel: number): number {
    const bonuses = this.getCombinedBonuses(playerId);
    const multiplier = bonuses.attackMultiplier ?? 1;
    return Math.floor(baseLevel * multiplier);
  }

  /**
   * Get effective strength level with prayer bonuses
   */
  getEffectiveStrengthLevel(playerId: string, baseLevel: number): number {
    const bonuses = this.getCombinedBonuses(playerId);
    const multiplier = bonuses.strengthMultiplier ?? 1;
    return Math.floor(baseLevel * multiplier);
  }

  /**
   * Get effective defense level with prayer bonuses
   */
  getEffectiveDefenseLevel(playerId: string, baseLevel: number): number {
    const bonuses = this.getCombinedBonuses(playerId);
    const multiplier = bonuses.defenseMultiplier ?? 1;
    return Math.floor(baseLevel * multiplier);
  }

  // ==========================================================================
  // STATE SYNC
  // ==========================================================================

  /**
   * Emit prayer state sync event
   */
  private emitPrayerStateSync(
    playerId: string,
    state: PlayerPrayerState,
  ): void {
    // Use world.emit for EventBridge to route to client
    this.world.emit(EventType.PRAYER_STATE_SYNC, {
      playerId,
      level: state.maxPoints, // Prayer level = max points
      xp: 0, // XP managed by SkillsSystem
      points: getDisplayPoints(state.points),
      maxPoints: state.maxPoints,
      active: Array.from(state.active),
    });
  }

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  /**
   * Schedule debounced persistence
   */
  private schedulePersist(playerId: string): void {
    if (!this.world.isServer) return;

    // Clear existing timer
    const existingTimer = this.persistTimers.get(playerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new persist (1 second debounce)
    const timer = setTimeout(() => {
      this.persistPrayerImmediate(playerId);
      this.persistTimers.delete(playerId);
    }, 1000);

    this.persistTimers.set(playerId, timer);
  }

  /**
   * Persist prayer state immediately
   * Includes validation and error handling for database operations.
   */
  private persistPrayerImmediate(playerId: string): void {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return;

    const state = this.playerStates.get(playerIdKey);
    if (!state || !state.dirty) return;

    const db = this.getDatabase();
    if (!db) {
      Logger.systemError(
        "PrayerSystem",
        `Cannot persist prayer state - database unavailable for ${playerId}`,
        new Error("Database unavailable"),
      );
      return;
    }

    // Validate data before persisting (prevent NaN/undefined from corrupting DB)
    const pointsToSave = getDisplayPoints(state.points);
    const maxPointsToSave = state.maxPoints;

    if (!Number.isFinite(pointsToSave) || !Number.isFinite(maxPointsToSave)) {
      Logger.systemError(
        "PrayerSystem",
        `Invalid prayer state data for ${playerId}: points=${pointsToSave}, max=${maxPointsToSave}`,
        new Error("Invalid prayer state data"),
      );
      return;
    }

    try {
      // Persist to database with validated data
      db.savePlayer(playerId, {
        prayerPoints: pointsToSave,
        prayerMaxPoints: maxPointsToSave,
        activePrayers: Array.from(state.active),
      } as Record<string, unknown>);

      state.dirty = false;
    } catch (error) {
      Logger.systemError(
        "PrayerSystem",
        `Failed to persist prayer state for ${playerId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Start auto-save interval
   */
  private startAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.autoSaveInterval = setInterval(() => {
      this.saveAllDirtyStates();
    }, this.AUTO_SAVE_INTERVAL);
  }

  /**
   * Save all dirty player states
   */
  private saveAllDirtyStates(): void {
    for (const [playerIdKey, state] of this.playerStates) {
      if (state.dirty) {
        this.persistPrayerImmediate(playerIdKey as string);
      }
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Get player entity for bonus lookups
   * Returns typed player entity or undefined if not found.
   */
  private getPlayerEntity(playerId: string): PlayerWithPrayerStats | undefined {
    const entity = this.world.entities.get(playerId);
    if (!entity) return undefined;
    // Entity has stats/skills properties that match PlayerWithPrayerStats interface
    return entity as PlayerWithPrayerStats;
  }

  /**
   * Get database system
   */
  private getDatabase(): DatabaseSystem | undefined {
    return this.world.getSystem("database") as DatabaseSystem | undefined;
  }

  /**
   * Get prayer state for debugging
   */
  getPrayerState(playerId: string): PrayerState | null {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return null;

    const state = this.playerStates.get(playerIdKey);
    if (!state) return null;

    return {
      level: state.maxPoints,
      xp: 0,
      points: getDisplayPoints(state.points),
      maxPoints: state.maxPoints,
      active: Array.from(state.active),
    };
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  override destroy(): void {
    // Unsubscribe from world events
    this.world.off(EventType.PLAYER_REGISTERED, this.onPlayerRegistered);
    this.world.off(EventType.PLAYER_CLEANUP, this.onPlayerCleanup);
    this.world.off(EventType.PLAYER_LEFT, this.onPlayerLeft);
    this.world.off(EventType.PLAYER_JOINED, this.onPlayerJoined);
    this.world.off(EventType.PRAYER_TOGGLE, this.onPrayerToggle);
    this.world.off(EventType.ALTAR_PRAY, this.onAltarPray);
    this.world.off(EventType.PRAYER_DEACTIVATED, this.onPrayerDeactivated);

    // Clear intervals
    if (this.drainInterval) {
      clearInterval(this.drainInterval);
      this.drainInterval = undefined;
    }

    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = undefined;
    }

    // Save all dirty states before shutdown
    this.saveAllDirtyStates();

    // Clear persist timers
    for (const timer of this.persistTimers.values()) {
      clearTimeout(timer);
    }
    this.persistTimers.clear();

    // Clear state
    this.playerStates.clear();
    this.loadingPlayers.clear();
    this.initializedPlayers.clear();

    super.destroy();
  }
}
