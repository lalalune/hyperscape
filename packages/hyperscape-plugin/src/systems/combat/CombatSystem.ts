import { MobEntity } from "../../entities/npc/MobEntity.js";
/**
 * CombatSystem - Handles all combat mechanics
 */

import { EventType } from "@hyperforge/shared";
import type { World } from "@hyperforge/shared";
import {
  WEAPON_DEFAULT_ATTACK_STYLE,
  type MeleeAttackStyle,
} from "@hyperforge/shared";
import {
  getAfkDisableRetaliateTicks,
  getArrowLaunchDelayMs,
  getCombatTimeoutTicks,
  getDefaultMagicRange,
  getDefaultNpcAttackSpeedTicks,
  getDefaultRangedRange,
  getHitDelayConfig,
  getSpellLaunchDelayMs,
  getTickDurationMs,
} from "@hyperforge/shared";
import { AttackType } from "@hyperforge/shared";
import { EntityID } from "@hyperforge/shared";
import { Entity } from "@hyperforge/shared";
// NOTE: Import directly to avoid circular dependency through barrel file
// PlayerSystem migrated to @hyperforge/hyperscape (2026-04-26, Wave 5d).
interface PlayerSystem {
  getPlayer(id: string): { alive?: boolean } | undefined;
  getPlayerAutoRetaliate(id: string): boolean;
  getPlayerAttackStyle?(id: string): { id: string } | undefined;
  damagePlayer(id: string, amount: number, source?: string): boolean;
}
import {
  isAttackOnCooldownTicks,
  calculateRetaliationDelay,
  CombatStyle,
  PrayerCombatBonuses,
} from "@hyperforge/shared";
// PrayerSystem migrated to @hyperforge/hyperscape (2026-04-25).
// Duck-typed local interface; CombatSystem only calls
// `getCombinedBonuses(playerId)` and passes the result to damage
// handlers as opaque attacker/defender bonus blobs.
import type { PrayerBonuses } from "@hyperforge/shared";
interface PrayerSystemLike {
  getCombinedBonuses(playerId: string): Partial<PrayerBonuses>;
}
import { createEntityID } from "@hyperforge/shared";
// NOTE: Import directly to avoid circular dependency through barrel file
import { EntityManager } from "@hyperforge/shared";
// MobNPCSystem migrated to @hyperforge/hyperscape (2026-04-25, Wave 3a).
// Was imported here only for the dead `mobSystem` field below.
import { SystemBase } from "@hyperforge/shared";
import {
  tilesWithinMeleeRange,
  tilesWithinRange,
  worldToTile,
} from "@hyperforge/shared";
import { tilePool, PooledTile } from "@hyperforge/shared";
import { CombatAnimationManager } from "./CombatAnimationManager";
import {
  CombatAttackValidator,
  type AttackValidationResult,
  type MeleeAttackData,
} from "./CombatAttackValidator";
import { CombatDamageApplicator } from "./CombatDamageApplicator";
import { CombatEnterLifecycleHandler } from "./CombatEnterLifecycleHandler";
import {
  CombatDamageOrchestrator,
  type PlayerEquipmentStats,
} from "./CombatDamageOrchestrator";
import { CombatDeathHandler } from "./CombatDeathHandler";
import { CombatEventEmitter } from "./CombatEventEmitter";
import { CombatEventRecorder } from "./CombatEventRecorder";
import { CombatFollowController } from "./CombatFollowController";
import { CombatLifecycleHandler } from "./CombatLifecycleHandler";
import { CombatMagicAttackHandler } from "./CombatMagicAttackHandler";
import { CombatMeleeAttackHandler } from "./CombatMeleeAttackHandler";
import { CombatPlayerQueries } from "./CombatPlayerQueries";
import { CombatProjectileHitProcessor } from "./CombatProjectileHitProcessor";
import { CombatRangedAttackHandler } from "./CombatRangedAttackHandler";
import { CombatRotationManager } from "./CombatRotationManager";
import { CombatStateService, CombatData } from "./CombatStateService";
import { CombatTickAttackWorker } from "./CombatTickAttackWorker";
import { CombatTickOrchestrator } from "./CombatTickOrchestrator";
import {
  CombatAntiCheat,
  CombatViolationType,
  CombatViolationSeverity,
} from "./CombatAntiCheat";
import { getEntityPosition } from "@hyperforge/shared";
import { quaternionPool } from "@hyperforge/shared";
import { EntityIdValidator } from "./EntityIdValidator";
import { CombatRateLimiter } from "./CombatRateLimiter";
import { CombatEntityResolver } from "./CombatEntityResolver";
import { DamageCalculator } from "./DamageCalculator";
import {
  EventStore,
  GameEventType,
  type GameStateInfo,
  type EntitySnapshot,
  type CombatSnapshot,
} from "@hyperforge/shared";
import { getGameRngState, type SeededRandomState } from "@hyperforge/shared";
import {
  DamageHandler,
  PlayerDamageHandler,
  MobDamageHandler,
} from "./handlers";
import { PidManager } from "./PidManager";
import { getGameRng } from "@hyperforge/shared";
import {
  isEntityDead,
  getMobRetaliates,
  getPendingAttacker,
  clearPendingAttacker,
  isPlayerDamageHandler,
  isMobEntity,
} from "@hyperforge/shared";
// ZoneDetectionSystem migrated to @hyperforge/hyperscape (2026-04-25).
import type { ZoneDetectionSystemDuck } from "@hyperforge/shared";
import { tileChebyshevDistance } from "@hyperforge/shared";

// Ranged/Magic combat services (F2P Phase 1)
import {
  calculateRangedDamage,
  type RangedDamageParams,
} from "./RangedDamageCalculator";
import {
  calculateMagicDamage,
  type MagicDamageParams,
} from "./MagicDamageCalculator";
import {
  type RangedCombatStyle,
  type MagicCombatStyle,
  RANGED_STYLE_BONUSES,
} from "@hyperforge/shared";
import { ammunitionService } from "./AmmunitionService";
import { runeService } from "./RuneService";
import { spellService, type Spell } from "./SpellService";
import {
  ProjectileService,
  type CreateProjectileParams,
} from "./ProjectileService";
import { getNPCById } from "@hyperforge/shared";
// EquipmentSystem migrated to @hyperforge/hyperscape (2026-04-26, Wave 5b).
import type { PlayerEquipment } from "@hyperforge/shared";
interface EquipmentSystemDuck {
  getPlayerEquipment(playerId: string): PlayerEquipment | undefined;
}
// InventorySystem migrated to @hyperforge/hyperscape (2026-04-26, Wave 5c).
import type { PlayerInventory } from "@hyperforge/shared";
interface InventorySystemDuck {
  hasItem(playerId: string, itemId: string, quantity?: number): boolean;
  getInventory(playerId: string): PlayerInventory | undefined;
  removeItemDirect(
    playerId: string,
    item: { itemId: string; quantity: number; slot?: number },
  ): Promise<boolean>;
}
import type { Item, EquipmentSlot } from "@hyperforge/shared";

// Re-export CombatData from CombatStateService for backwards compatibility
export type { CombatData } from "./CombatStateService";

/**
 * Attack data structure for validation and execution
 */
// MeleeAttackData and AttackValidationResult moved to
// ./CombatAttackValidator (slice 7); re-imported above for use
// at the few CombatSystem call sites that still reference them.

export class CombatSystem extends SystemBase {
  private nextAttackTicks = new Map<EntityID, number>(); // Tick when entity can next attack
  // mobSystem field removed 2026-04-25: was set in init() but never read.
  private entityManager?: EntityManager;
  private playerSystem?: PlayerSystem; // Cached for auto-retaliate checks (hot path optimization)

  // OPTIMIZATION: Cache frequently used systems to avoid getSystem() lookups in hot paths
  private prayerSystem?: PrayerSystemLike | null;
  private zoneDetectionSystem?: ZoneDetectionSystemDuck | null;
  private _systemsCached = false;

  // Public for GameTickProcessor access during tick processing
  public readonly stateService: CombatStateService;
  private animationManager: CombatAnimationManager;
  private rotationManager: CombatRotationManager;

  public readonly antiCheat: CombatAntiCheat;
  private entityIdValidator: EntityIdValidator;
  private rateLimiter: CombatRateLimiter;
  public readonly eventStore: EventStore;
  private entityResolver: CombatEntityResolver;
  private damageCalculator: DamageCalculator;
  // Combat event recording — replay snapshot + EventStore append.
  // Extracted to CombatEventRecorder (top-10 #9 third decomposition
  // slice). Toggle via `this.eventRecorder.recordingEnabled`.
  private readonly eventRecorder: CombatEventRecorder;

  // Equipment stats cache per player for damage calculations.
  // Type lives in CombatDamageOrchestrator (which is the primary
  // reader); CombatSystem owns the Map and populates it on the
  // PLAYER_EQUIPMENT_CHANGED event.
  private playerEquipmentStats = new Map<string, PlayerEquipmentStats>();

  // Damage calculation pipeline (5 calculate*Damage methods +
  // equipment lookups). Extracted to CombatDamageOrchestrator (top-10
  // #9 fourth decomposition slice). All callsites delegate via
  // `this.damageOrchestrator.fooBar(...)`.
  private readonly damageOrchestrator: CombatDamageOrchestrator;

  // Death + respawn handlers — clean up combat state when entities
  // die or players respawn. Extracted to CombatDeathHandler (top-10
  // #9 fifth decomposition slice).
  private readonly deathHandler: CombatDeathHandler;

  // Central damage application path — extracted as the ninth slice.
  // Polymorphic dispatch via damageHandlers Map; routes death cleanup
  // through deathHandler.
  private readonly damageApplicator: CombatDamageApplicator;

  // Combat lifecycle handler — currently wraps endCombat (timeout +
  // manual force-end cleanup). enterCombat is deferred to a future
  // slice (top-10 #9 sixth decomposition slice).
  private readonly lifecycleHandler: CombatLifecycleHandler;

  // Pre-attack validation predicates extracted as the seventh slice.
  // Wraps validateMeleeAttack, isWithinCombatRange, checkAttackCooldown,
  // validateCombatActors, validateAttackRange.
  private readonly attackValidator: CombatAttackValidator;

  // Tile-follow + weapon attack-type lookup extracted as the eighth
  // slice. Wraps checkRangeAndFollow + getAttackTypeFromWeapon.
  private readonly followController: CombatFollowController;

  // Per-tick auto-attack worker cluster extracted as the tenth slice.
  // Wraps executeAttackDamage + updateCombatTickState +
  // handlePlayerRetaliation + emitCombatEvents.
  private readonly tickAttackWorker: CombatTickAttackWorker;

  // Deferred-damage projectile-hit resolution loop extracted as the
  // eleventh slice. Wraps processProjectileHits.
  private readonly projectileHitProcessor: CombatProjectileHitProcessor;

  // Per-tick driver — owns processCombatTick, processNPCCombatTick,
  // processPlayerCombatTick, processAutoAttackOnTick. Public proxies
  // on this class forward to it. Extracted as the twelfth slice.
  private readonly tickOrchestrator: CombatTickOrchestrator;

  // Combat-start lifecycle (enterCombat) extracted as the thirteenth
  // slice. Pairs with CombatLifecycleHandler (endCombat) for the full
  // lifecycle.
  private readonly enterLifecycleHandler: CombatEnterLifecycleHandler;

  // Inbound + execute pair for melee attacks extracted as the
  // fourteenth slice. Wraps handleMeleeAttack + executeMeleeAttack.
  private readonly meleeAttackHandler: CombatMeleeAttackHandler;

  // Inbound entry for ranged attacks extracted as the fifteenth
  // slice. Wraps handleRangedAttack (mob + player branches).
  private readonly rangedAttackHandler: CombatRangedAttackHandler;

  // Inbound entry for magic attacks extracted as the sixteenth
  // slice. Wraps handleMagicAttack (mob + player branches).
  private readonly magicAttackHandler: CombatMagicAttackHandler;

  // Ranged/Magic combat services (F2P)
  private readonly projectileService: ProjectileService;
  private equipmentSystem?: EquipmentSystemDuck;
  private inventorySystem?: InventorySystemDuck;

  // Pre-allocated pooled tiles for hot path calculations (zero GC)
  private readonly _attackerTile: PooledTile = tilePool.acquire();
  private readonly _targetTile: PooledTile = tilePool.acquire();

  // tile-based-MMORPG-accurate: Track last known target tile per attacker for persistent combat follow.
  // In the tile-based MMORPG genre, the player continuously follows the target while in combat — not just when
  // out of range. This map lets us detect when the target has moved and re-path accordingly.
  private lastCombatTargetTile = new Map<string, { x: number; z: number }>();

  // Auto-retaliate disabled after 20 minutes of no input (tile-based MMORPG behavior)
  private lastInputTick = new Map<string, number>();

  private damageHandlers: Map<"player" | "mob", DamageHandler>;

  // Lower PID = higher priority when attacks occur on same tick
  public readonly pidManager: PidManager;

  // Combat event emission helpers — pre-allocated payloads + zero-
  // allocation emit methods. Extracted to CombatEventEmitter (top-10
  // #9 first decomposition slice). All `emit*` callsites in this
  // file delegate to `this.eventEmitter.emit*(...)`.
  private readonly eventEmitter: CombatEventEmitter;

  // Player query helpers — read-only skill / spell / inventory
  // accessors + rune consumption. Extracted to CombatPlayerQueries
  // (top-10 #9 second decomposition slice).
  private readonly playerQueries: CombatPlayerQueries;

  constructor(world: World) {
    super(world, {
      name: "combat",
      dependencies: {
        required: ["entity-manager"], // Combat needs entity manager
        optional: ["mob-npc"], // Combat can work without mob NPCs but better with them
      },
      autoCleanup: true,
    });

    this.stateService = new CombatStateService(world);
    this.animationManager = new CombatAnimationManager(world);
    this.rotationManager = new CombatRotationManager(world);
    this.antiCheat = new CombatAntiCheat();
    this.entityIdValidator = new EntityIdValidator();
    this.rateLimiter = new CombatRateLimiter();
    this.entityResolver = new CombatEntityResolver(world);
    this.damageCalculator = new DamageCalculator(this.playerEquipmentStats);

    this.eventStore = new EventStore({
      snapshotInterval: 100,
      maxEvents: 100000,
      maxSnapshots: 10,
    });

    this.damageHandlers = new Map();
    this.damageHandlers.set("player", new PlayerDamageHandler(world));
    this.damageHandlers.set("mob", new MobDamageHandler(world));

    this.pidManager = new PidManager(getGameRng());

    // Ranged/Magic projectile service (F2P)
    this.projectileService = new ProjectileService();

    // Combat event emission helpers — pre-allocated payloads + zero-
    // alloc emit. Closure injects this system's protected emitTypedEvent.
    this.eventEmitter = new CombatEventEmitter((type, payload) =>
      this.emitTypedEvent(type, payload),
    );

    // Player query helpers. Inventory accessor is a closure so the
    // helper picks up `this.inventorySystem` once it's assigned in
    // start() (it's undefined at construct-time).
    this.playerQueries = new CombatPlayerQueries(
      world,
      () => this.inventorySystem,
    );

    // Combat event recorder — appends events to EventStore for replay,
    // builds GameStateInfo + periodic combat snapshots.
    this.eventRecorder = new CombatEventRecorder(
      world,
      this.eventStore,
      this.stateService,
      this.entityResolver,
    );

    // Damage calculation pipeline. Closures over equipmentSystem +
    // prayerSystem because both are late-bound (assigned in start()).
    this.damageOrchestrator = new CombatDamageOrchestrator(
      world,
      this.playerQueries,
      this.damageCalculator,
      this.playerEquipmentStats,
      () => this.equipmentSystem,
      () => this.prayerSystem,
    );

    // Death + respawn handlers — clean up combat state on entity
    // death / player respawn. All deps are already-extracted helpers
    // plus the shared nextAttackTicks Map.
    this.deathHandler = new CombatDeathHandler(
      world,
      this.stateService,
      this.animationManager,
      this.eventEmitter,
      this.eventRecorder,
      this.nextAttackTicks,
    );

    // Central damage application (slice 9). Routes through the
    // damageHandlers Map (player vs mob); death cleanup via
    // deathHandler. emit closure for the "you take damage" UI message.
    this.damageApplicator = new CombatDamageApplicator(
      this.damageHandlers,
      this.entityResolver,
      this.deathHandler,
      this.logger,
      (type, payload) => this.emitTypedEvent(type, payload),
    );

    // Combat lifecycle handler (endCombat). Closure over emitTypedEvent
    // for the UI_MESSAGE event. Shares lastCombatTargetTile Map with
    // the host system — CombatSystem populates, helper deletes on end.
    this.lifecycleHandler = new CombatLifecycleHandler(
      this.stateService,
      this.animationManager,
      this.eventEmitter,
      this.eventRecorder,
      this.lastCombatTargetTile,
      (type, payload) => this.emitTypedEvent(type, payload),
    );

    // Pre-attack validation (slice 7). Shares the pooled tile buffers
    // and nextAttackTicks Map with the host system — both are read
    // by other CombatSystem methods on the same tick, which is safe
    // because combat is single-threaded.
    this.attackValidator = new CombatAttackValidator(
      this.entityResolver,
      this.antiCheat,
      this.eventEmitter,
      this.nextAttackTicks,
      this._attackerTile,
      this._targetTile,
    );

    // Tile-follow + weapon attack-type (slice 8). Closures capture
    // late-bound systems assigned during start() (equipmentSystem,
    // zoneDetectionSystem). Shared mutable refs: pooled tile buffers
    // + lastCombatTargetTile cache.
    this.followController = new CombatFollowController(
      this.entityResolver,
      this.eventEmitter,
      this.playerQueries,
      this._attackerTile,
      this._targetTile,
      this.lastCombatTargetTile,
      () => this.equipmentSystem,
      () => this.zoneDetectionSystem,
    );

    // Per-tick auto-attack worker (slice 10). Closure captures
    // late-bound playerSystem (assigned in start()). Shared mutable
    // refs: nextAttackTicks Map + lastInputTick Map.
    this.tickAttackWorker = new CombatTickAttackWorker(
      this.rotationManager,
      this.animationManager,
      this.damageOrchestrator,
      this.entityResolver,
      this.damageApplicator,
      this.eventEmitter,
      this.eventRecorder,
      this.stateService,
      this.nextAttackTicks,
      this.lastInputTick,
      (type, payload) => this.emitTypedEvent(type, payload),
      () => this.playerSystem,
    );

    // Projectile-hit deferred-damage loop (slice 11). Closure over
    // emitTypedEvent for the magic XP event.
    this.projectileHitProcessor = new CombatProjectileHitProcessor(
      this.projectileService,
      this.entityResolver,
      this.damageApplicator,
      this.eventEmitter,
      this.eventRecorder,
      (type, payload) => this.emitTypedEvent(type, payload),
    );

    // Per-tick orchestrator (slice 12). handleAttack callback dispatches
    // ranged/magic into the still-inline handleRangedAttack/handleMagicAttack
    // (will move with a future slice). getFrameBudget reads world.frameBudget
    // at call-time.
    this.tickOrchestrator = new CombatTickOrchestrator(
      this.pidManager,
      this.projectileHitProcessor,
      this.animationManager,
      this.stateService,
      this.lifecycleHandler,
      this.followController,
      this.attackValidator,
      this.tickAttackWorker,
      this.logger,
      (data) => this.handleAttack(data),
      () => this.world.frameBudget,
    );

    // Combat-start lifecycle (slice 13). Pairs with the slice-6
    // CombatLifecycleHandler (endCombat). Closures for late-bound
    // zoneDetectionSystem + playerSystem; lastInputTick Map for AFK
    // detection; emit closure for the "Combat started with X!" UI
    // message.
    this.enterLifecycleHandler = new CombatEnterLifecycleHandler(
      world,
      this.entityResolver,
      this.stateService,
      this.rotationManager,
      this.followController,
      this.eventEmitter,
      this.eventRecorder,
      this.lastInputTick,
      (type, payload) => this.emitTypedEvent(type, payload),
      () => this.zoneDetectionSystem,
      () => this.playerSystem,
    );

    // Melee attack handler (slice 14). Inbound entry +
    // execute pair. Closure for late-bound playerSystem.
    this.meleeAttackHandler = new CombatMeleeAttackHandler(
      world,
      this.entityIdValidator,
      this.logger,
      this.antiCheat,
      this.rateLimiter,
      this.attackValidator,
      this.entityResolver,
      this.rotationManager,
      this.animationManager,
      this.damageOrchestrator,
      this.damageApplicator,
      this.eventEmitter,
      this.enterLifecycleHandler,
      this.nextAttackTicks,
      () => this.playerSystem,
    );

    // Ranged attack handler (slice 15). Inbound entry — mob + player
    // branches. Closure for late-bound playerSystem (style modifier).
    this.rangedAttackHandler = new CombatRangedAttackHandler(
      world,
      this.entityIdValidator,
      this.antiCheat,
      this.rateLimiter,
      this.attackValidator,
      this.entityResolver,
      this.rotationManager,
      this.animationManager,
      this.damageOrchestrator,
      this.eventEmitter,
      this.playerQueries,
      this.projectileService,
      this.enterLifecycleHandler,
      this.nextAttackTicks,
      this._attackerTile,
      this._targetTile,
      (type, payload) => this.emitTypedEvent(type, payload),
      () => this.playerSystem,
    );

    // Magic attack handler (slice 16). Inbound entry — mob + player
    // branches. Closure for late-bound inventorySystem (used in a
    // diagnostic warning only; rune consumption goes through
    // playerQueries which has its own inventorySystem closure).
    this.magicAttackHandler = new CombatMagicAttackHandler(
      world,
      this.entityIdValidator,
      this.antiCheat,
      this.rateLimiter,
      this.attackValidator,
      this.entityResolver,
      this.rotationManager,
      this.animationManager,
      this.damageOrchestrator,
      this.eventEmitter,
      this.playerQueries,
      this.projectileService,
      this.enterLifecycleHandler,
      this.nextAttackTicks,
      this._attackerTile,
      this._targetTile,
      (type, payload) => this.emitTypedEvent(type, payload),
      () => this.inventorySystem,
    );
  }

  // Event emission helpers live in CombatEventEmitter — see field
  // declaration above. All `this.emitXxx(...)` callsites in this file
  // are now `this.eventEmitter.emitXxx(...)`.

  async init(): Promise<void> {
    // Get entity manager - required dependency
    this.entityManager = this.world.getSystem<EntityManager>("entity-manager");
    if (!this.entityManager) {
      throw new Error(
        "[CombatSystem] EntityManager not found - required dependency",
      );
    }

    // mobSystem lookup removed 2026-04-25: was assigned but never read.

    // Configure entity resolver with entity manager and logger
    this.entityResolver.setEntityManager(this.entityManager);
    this.entityResolver.setLogger(this.logger);

    // Cache PlayerSystem for auto-retaliate checks (hot path optimization)
    // Optional dependency - combat still works without it (defaults to retaliate)
    this.playerSystem = this.world.getSystem("player") as unknown as
      | PlayerSystem
      | undefined;

    // OPTIMIZATION: Cache other systems used in hot paths (damage calc, PvP zone checks)
    this.prayerSystem =
      (this.world.getSystem("prayer") as unknown as PrayerSystemLike | null) ??
      null;
    this.zoneDetectionSystem =
      (this.world.getSystem(
        "zone-detection",
      ) as unknown as ZoneDetectionSystemDuck | null) ?? null;
    this._systemsCached = true;

    // Cache PlayerSystem into PlayerDamageHandler for damage application
    const playerHandler = this.damageHandlers.get("player");
    if (isPlayerDamageHandler(playerHandler)) {
      playerHandler.cachePlayerSystem(this.playerSystem ?? null);
    }

    // Cache EquipmentSystem and InventorySystem for ranged/magic combat (F2P)
    this.equipmentSystem = this.world.getSystem("equipment") as unknown as
      | EquipmentSystemDuck
      | undefined;
    this.inventorySystem = this.world.getSystem("inventory") as unknown as
      | InventorySystemDuck
      | undefined;

    // Listen for auto-retaliate toggle to start combat if toggled ON while being attacked
    // SERVER-ONLY: Combat state changes must happen on server, client receives via network sync
    this.subscribe(
      EventType.UI_AUTO_RETALIATE_CHANGED,
      (data: { playerId: string; enabled: boolean }) => {
        if (!this.world.isServer) return; // Combat is server-authoritative
        if (data.enabled) {
          this.handleAutoRetaliateEnabled(data.playerId);
        }
      },
    );

    // tile-based-MMORPG-accurate: Player clicked to move = cancel their attacking combat
    // In the tile-based MMORPG genre, clicking anywhere else cancels your current action including combat
    // SERVER-ONLY: Combat state changes must happen on server
    this.subscribe(
      EventType.COMBAT_PLAYER_DISENGAGE,
      (data: { playerId: string }) => {
        if (!this.world.isServer) return; // Combat is server-authoritative
        this.handlePlayerDisengage(data.playerId);
      },
    );

    // Set up event listeners - required for combat to function
    // SERVER-ONLY: Combat processing should only happen on server to avoid duplicate damage events
    this.subscribe(
      EventType.COMBAT_ATTACK_REQUEST,
      async (data: {
        attackerId: string;
        targetId: string;
        attackerType?: "player" | "mob";
        targetType?: "player" | "mob";
        attackType?: AttackType;
      }) => {
        if (!this.world.isServer) return; // Combat is server-authoritative
        await this.handleAttack({
          attackerId: data.attackerId,
          targetId: data.targetId,
          attackerType: data.attackerType || "player",
          targetType: data.targetType || "mob",
          attackType: data.attackType || AttackType.MELEE,
        });
      },
    );
    this.subscribe<{
      attackerId: string;
      targetId: string;
      attackerType: "player" | "mob";
      targetType: "player" | "mob";
    }>(EventType.COMBAT_MELEE_ATTACK, (data) => {
      if (!this.world.isServer) return; // Combat is server-authoritative
      this.handleMeleeAttack(data);
    });
    // MVP: Ranged combat subscription removed - melee only
    this.subscribe(
      EventType.COMBAT_MOB_NPC_ATTACK,
      (data: {
        mobId: string;
        targetId: string;
        attackType?: AttackType;
        spellId?: string;
        arrowId?: string;
      }) => {
        if (!this.world.isServer) return; // Combat is server-authoritative
        this.handleMobAttack(data);
      },
    );

    // Listen for death events to end combat
    this.subscribe(EventType.NPC_DIED, (data: { mobId: string }) => {
      this.deathHandler.handleEntityDied(data.mobId, "mob");
    });
    this.subscribe(
      EventType.ENTITY_DEATH,
      (data: { entityId: string; entityType: string }) => {
        this.deathHandler.handleEntityDied(data.entityId, data.entityType);
      },
    );

    // CRITICAL: Listen for player respawn to clear any lingering combat states
    // This catches edge cases where combat states survive the death cleanup
    this.subscribe(
      EventType.PLAYER_RESPAWNED,
      (data: {
        playerId: string;
        spawnPosition: { x: number; y: number; z: number };
      }) => {
        this.deathHandler.handlePlayerRespawned(data.playerId);
      },
    );

    this.subscribe(EventType.PLAYER_JOINED, (data: { playerId: string }) => {
      const tickNumber = this.world.currentTick ?? 0;
      this.pidManager.assignPid(data.playerId as EntityID, tickNumber);
    });

    this.subscribe(EventType.PLAYER_LEFT, (data: { playerId: string }) => {
      this.cleanupPlayerDisconnect(data.playerId);
      this.pidManager.removePid(data.playerId as EntityID);
    });

    // Listen for explicit combat stop requests (e.g., player clicking new target)
    this.subscribe(
      EventType.COMBAT_STOP_ATTACK,
      (data: { attackerId: string }) => {
        if (this.stateService.isInCombat(data.attackerId)) {
          this.logger.info("Stopping combat for target switch", {
            attackerId: data.attackerId,
          });
          this.forceEndCombat(data.attackerId);
        }
      },
    );

    // Listen for combat follow events to initiate player movement toward target
    this.subscribe(
      EventType.COMBAT_FOLLOW_TARGET,
      (data: {
        playerId: string;
        targetId: string;
        targetPosition: { x: number; y: number; z: number };
      }) => {
        this.handleCombatFollow(data);
      },
    );

    // Listen for equipment stats updates to use bonuses in damage calculation
    this.subscribe(
      EventType.PLAYER_STATS_EQUIPMENT_UPDATED,
      (data: {
        playerId: string;
        equipmentStats: {
          attack: number;
          strength: number;
          defense: number;
          ranged: number;
          // Optional ranged/magic bonuses (F2P)
          rangedAttack?: number;
          rangedStrength?: number;
          magicAttack?: number;
          magicDefense?: number;
          // Optional per-style bonuses (tile-based MMORPG combat triangle)
          defenseStab?: number;
          defenseSlash?: number;
          defenseCrush?: number;
          defenseRanged?: number;
          attackStab?: number;
          attackSlash?: number;
          attackCrush?: number;
        };
      }) => {
        this.playerEquipmentStats.set(data.playerId, {
          attack: data.equipmentStats.attack,
          strength: data.equipmentStats.strength,
          defense: data.equipmentStats.defense,
          ranged: data.equipmentStats.ranged,
          rangedAttack: data.equipmentStats.rangedAttack ?? 0,
          rangedStrength: data.equipmentStats.rangedStrength ?? 0,
          magicAttack: data.equipmentStats.magicAttack ?? 0,
          magicDefense: data.equipmentStats.magicDefense ?? 0,
          defenseStab: data.equipmentStats.defenseStab ?? 0,
          defenseSlash: data.equipmentStats.defenseSlash ?? 0,
          defenseCrush: data.equipmentStats.defenseCrush ?? 0,
          defenseRanged: data.equipmentStats.defenseRanged ?? 0,
          attackStab: data.equipmentStats.attackStab ?? 0,
          attackSlash: data.equipmentStats.attackSlash ?? 0,
          attackCrush: data.equipmentStats.attackCrush ?? 0,
        });
      },
    );
  }

  // getAttackTypeFromWeapon moved to ./CombatFollowController
  // (slice 8). Call sites delegate via
  // this.followController.getAttackTypeFromWeapon(attackerId).

  // Equipment lookups (getEquippedArrows / getEquippedWeapon) +
  // damage calculation methods live in CombatDamageOrchestrator —
  // see field declaration above. All callsites delegate via
  // `this.damageOrchestrator.fooBar(...)`.

  private async handleAttack(data: {
    attackerId: string;
    targetId: string;
    attackerType: "player" | "mob";
    targetType: "player" | "mob";
    attackType?: AttackType;
  }): Promise<void> {
    // Route by attack type from equipped weapon (F2P ranged/magic support)
    const attackType =
      data.attackerType === "player"
        ? this.followController.getAttackTypeFromWeapon(data.attackerId)
        : (data.attackType ?? AttackType.MELEE);

    switch (attackType) {
      case AttackType.RANGED:
        this.handleRangedAttack(data);
        break;
      case AttackType.MAGIC:
        await this.handleMagicAttack(data);
        break;
      case AttackType.MELEE:
      default:
        this.handleMeleeAttack(data);
        break;
    }
  }

  // handleMeleeAttack + executeMeleeAttack moved to
  // ./CombatMeleeAttackHandler (slice 14). Call sites delegate via
  // this.meleeAttackHandler.handleMeleeAttack(data).

  /** Thin proxy — delegates to CombatMeleeAttackHandler. */
  private handleMeleeAttack(data: MeleeAttackData): void {
    this.meleeAttackHandler.handleMeleeAttack(data);
  }

  // handleRangedAttack moved to ./CombatRangedAttackHandler (slice 15).
  // Call sites delegate via this.rangedAttackHandler.handleRangedAttack(data).

  /** Thin proxy — delegates to CombatRangedAttackHandler. */
  private handleRangedAttack(data: {
    attackerId: string;
    targetId: string;
    attackerType: "player" | "mob";
    targetType: "player" | "mob";
    arrowId?: string;
  }): void {
    this.rangedAttackHandler.handleRangedAttack(data);
  }

  // handleMagicAttack moved to ./CombatMagicAttackHandler (slice 16).
  // Call sites delegate via this.magicAttackHandler.handleMagicAttack(data).

  /** Thin proxy — delegates to CombatMagicAttackHandler. */
  private async handleMagicAttack(data: {
    attackerId: string;
    targetId: string;
    attackerType: "player" | "mob";
    targetType: "player" | "mob";
    spellId?: string;
  }): Promise<void> {
    await this.magicAttackHandler.handleMagicAttack(data);
  }

  private handleMobAttack(data: {
    mobId: string;
    targetId: string;
    attackType?: AttackType;
    spellId?: string;
    arrowId?: string;
  }): void {
    if (data.attackType === AttackType.MAGIC) {
      void this.handleMagicAttack({
        attackerId: data.mobId,
        targetId: data.targetId,
        attackerType: "mob",
        targetType: "player",
        spellId: data.spellId,
      });
      return;
    }

    if (data.attackType === AttackType.RANGED) {
      this.handleRangedAttack({
        attackerId: data.mobId,
        targetId: data.targetId,
        attackerType: "mob",
        targetType: "player",
        arrowId: data.arrowId,
      });
      return;
    }

    // Default mob attack path is melee.
    this.handleMeleeAttack({
      attackerId: data.mobId,
      targetId: data.targetId,
      attackerType: "mob",
      targetType: "player",
    });
  }

  /**
   * Handle auto-retaliate being toggled ON while being attacked
   * tile-based MMORPG behavior: Player should start fighting back immediately
   *
   * Supports both PvE (mob attacker) and PvP (player attacker) scenarios.
   */
  private handleAutoRetaliateEnabled(playerId: string): void {
    const playerEntity = this.world.getPlayer?.(playerId);
    if (!playerEntity) return;

    // Use type guard to get pending attacker ID
    const pendingAttacker = getPendingAttacker(playerEntity);
    if (!pendingAttacker) return;

    // Detect attacker type dynamically - supports both PvP and PvE
    // This fixes the bug where PvP retaliation failed because we assumed "mob"
    const attackerType = this.entityResolver.resolveType(pendingAttacker);
    const attackerEntity = this.entityResolver.resolve(
      pendingAttacker,
      attackerType,
    );

    if (
      !attackerEntity ||
      !this.entityResolver.isAlive(attackerEntity, attackerType)
    ) {
      // Attacker gone - clear pending attacker state using type guard
      clearPendingAttacker(playerEntity);
      return;
    }

    // Start combat! Player now retaliates against the attacker
    const attackSpeedTicks = this.entityResolver.getAttackSpeed(
      createEntityID(playerId),
      "player",
    );

    // enterCombat() detects entity types internally
    this.enterLifecycleHandler.enterCombat(
      createEntityID(playerId),
      createEntityID(pendingAttacker),
      attackSpeedTicks,
    );

    // Clear pending attacker since we're now actively fighting
    clearPendingAttacker(playerEntity);

    // Clear server face target since player now has a combat target
    // Note: enterCombat() already handles rotation via rotateTowardsTarget()
    this.eventEmitter.emitClearFaceTarget(playerId);
  }

  /**
   * tile-based-MMORPG-accurate: Handle player clicking to move (disengage from combat)
   * In the tile-based MMORPG genre, clicking anywhere else cancels YOUR current action including combat.
   *
   * CRITICAL: This only affects the DISENGAGING player's combat state.
   * The player who was attacking them (their target) keeps their combat state
   * and continues chasing. This is correct tile-based MMORPG behavior:
   * - "Deliberate movement out of the opponent's weapon range to force them to follow
   *    is called dragging." - tile-based MMORPG genre wiki (Free-to-play PvP techniques)
   * - Pathfinding recalculates every tick when targeting a moving entity
   *
   * @see https://oldschool.runescape.wiki/w/Free-to-play_PvP_techniques
   * @see https://oldschool.runescape.wiki/w/Pathfinding
   */
  private handlePlayerDisengage(playerId: string): void {
    const combatState = this.stateService.getCombatData(playerId);
    if (!combatState || combatState.attackerType !== "player") {
      return; // Not in combat as an attacker, nothing to cancel
    }

    const targetId = String(combatState.targetId);
    const typedPlayerId = createEntityID(playerId);

    // tile-based MMORPG-ACCURATE: Only remove THIS player's combat state
    // DO NOT call forceEndCombat() as it removes BOTH players' states!
    // The target (who may be attacking this player) keeps their combat state
    // and continues chasing this player. This enables the "dragging" PvP technique.

    // Reset emote for disengaging player only
    this.animationManager.resetEmote(playerId, "player");

    // Clear combat UI state from this player's entity only
    this.stateService.clearCombatStateFromEntity(playerId, "player");

    // Remove ONLY this player's combat state - NOT the target's!
    this.stateService.removeCombatState(typedPlayerId);

    // Clean up combat follow tracking for disengaging player
    this.lastCombatTargetTile.delete(playerId);

    // Mark player as "in combat without target" - the attacker is still chasing them
    // This keeps the combat timer active but player won't auto-attack
    // If auto-retaliate is ON and attacker catches up and hits, player will start fighting again
    this.stateService.markInCombatWithoutTarget(playerId, targetId);

    // tile-based MMORPG-ACCURATE: Do NOT face the target when walking away
    // Player should face their walking direction (handled by tile movement)
    // Only face target when auto-retaliate triggers (handled by enterCombat)
  }

  /**
   * Handle combat follow - move player toward target when out of melee range.
   * This allows combat to continue when the target moves instead of timing out.
   *
   * NOTE: Actual movement is handled by ServerNetwork listening for COMBAT_FOLLOW_TARGET event.
   * This handler validates that combat is still active before the server initiates movement.
   */
  private handleCombatFollow(data: {
    playerId: string;
    targetId: string;
    targetPosition: { x: number; y: number; z: number };
  }): void {
    // Verify player is still in combat with this target
    const combatState = this.stateService
      .getCombatStatesMap()
      .get(data.playerId as EntityID);
    if (!combatState || combatState.targetId !== data.targetId) {
      return; // Combat ended or target changed, don't follow
    }
    // Movement is handled by ServerNetwork's COMBAT_FOLLOW_TARGET listener
    // which calls TileMovementManager.movePlayerToward()
  }

  // applyDamage moved to ./CombatDamageApplicator (slice 9). Call
  // sites delegate via this.damageApplicator.applyDamage(...).

  // Note: syncCombatStateToEntity, clearCombatStateFromEntity moved to CombatStateService
  // Note: setCombatEmote, resetEmote moved to CombatAnimationManager
  // Note: rotateTowardsTarget moved to CombatRotationManager

  // enterCombat moved to ./CombatEnterLifecycleHandler (slice 13).
  // Call sites delegate via this.enterLifecycleHandler.enterCombat(...).

  public startCombat(
    attackerId: string,
    targetId: string,
    options?: {
      attackerType?: "player" | "mob";
      targetType?: "player" | "mob";
      weaponType?: AttackType;
    },
  ): boolean {
    const opts = {
      attackerType: "player",
      targetType: "mob",
      weaponType: AttackType.MELEE,
      ...options,
    };

    const attacker = this.entityResolver.resolve(attackerId, opts.attackerType);
    const target = this.entityResolver.resolve(targetId, opts.targetType);

    if (!attacker || !target) {
      return false;
    }

    const attackerAlive = this.entityResolver.isAlive(
      attacker,
      opts.attackerType,
    );
    const targetAlive = this.entityResolver.isAlive(target, opts.targetType);

    if (!attackerAlive) {
      return false;
    }
    if (!targetAlive) {
      return false;
    }

    // MVP: Melee-only range check (tile-based)
    const attackerPos = getEntityPosition(attacker);
    const targetPos = getEntityPosition(target);
    if (!attackerPos || !targetPos) return false; // Missing position

    // Use pre-allocated pooled tiles (zero GC)
    tilePool.setFromPosition(this._attackerTile, attackerPos);
    tilePool.setFromPosition(this._targetTile, targetPos);
    const combatRangeTiles = this.entityResolver.getCombatRange(
      attacker,
      opts.attackerType,
    );
    // tile-based-MMORPG-accurate melee range check (cardinal-only for range 1)
    if (
      !tilesWithinMeleeRange(
        this._attackerTile,
        this._targetTile,
        combatRangeTiles,
      )
    ) {
      return false;
    }

    // Start combat — pass weaponType so enterCombat uses correct attack speed
    this.enterLifecycleHandler.enterCombat(
      createEntityID(attackerId),
      createEntityID(targetId),
      undefined,
      opts.weaponType as AttackType,
    );
    return true;
  }

  public isInCombat(entityId: string): boolean {
    return this.stateService.isInCombat(entityId);
  }

  public getCombatData(entityId: string): CombatData | null {
    return this.stateService.getCombatData(entityId);
  }

  /**
   * Check if player is on attack cooldown
   * Used by eating system to determine if eat should add attack delay
   *
   * Tile-based MMORPG rule: Foods only add to EXISTING attack delay.
   * If weapon is ready to attack (cooldown expired), eating does NOT add delay.
   *
   * @param playerId - Player to check
   * @param currentTick - Current game tick
   * @returns true if player has pending attack cooldown
   */
  public isPlayerOnAttackCooldown(
    playerId: string,
    currentTick: number,
  ): boolean {
    const typedPlayerId = createEntityID(playerId);
    const nextAllowedTick = this.nextAttackTicks.get(typedPlayerId) ?? 0;
    return currentTick < nextAllowedTick;
  }

  /**
   * Add delay ticks to player's next attack
   * Used by eating system (Tile-based MMORPG: eating during combat adds 3 tick delay)
   *
   * Tile-based-MMORPG-accurate: Only called when player is ALREADY on cooldown.
   * If weapon is ready, eating does not add delay.
   *
   * @param playerId - Player to modify
   * @param delayTicks - Ticks to add to attack cooldown
   */
  public addAttackDelay(playerId: string, delayTicks: number): void {
    const typedPlayerId = createEntityID(playerId);
    const currentNext = this.nextAttackTicks.get(typedPlayerId);

    if (currentNext !== undefined) {
      // Add delay to existing cooldown (mutate in place, no allocation)
      this.nextAttackTicks.set(typedPlayerId, currentNext + delayTicks);

      // Also update CombatData if active (keeps state consistent)
      const combatData = this.stateService.getCombatData(typedPlayerId);
      if (combatData) {
        combatData.nextAttackTick += delayTicks;
      }
    }
    // If no current cooldown, do nothing (tile-based-MMORPG-accurate: no delay if weapon ready)
  }

  public forceEndCombat(
    entityId: string,
    options?: {
      skipAttackerEmoteReset?: boolean;
      skipTargetEmoteReset?: boolean;
    },
  ): void {
    this.lifecycleHandler.endCombat({
      entityId,
      skipAttackerEmoteReset: options?.skipAttackerEmoteReset,
      skipTargetEmoteReset: options?.skipTargetEmoteReset,
    });
  }

  /**
   * Check if a player can logout based on combat state
   * tile-based-MMORPG-accurate: Cannot logout while actively in combat
   * Uses the combat timeout window to determine if player is in active combat
   *
   * @param playerId - The player's entity ID
   * @param currentTick - The current game tick
   * @returns Object with allowed boolean and optional reason string
   */
  public canLogout(
    playerId: string,
    currentTick: number,
  ): { allowed: boolean; reason?: string } {
    const combatData = this.stateService.getCombatData(playerId);

    // Player is in active combat if:
    // 1. They have combat data with inCombat flag
    // 2. Current tick is before their combat end tick
    if (combatData?.inCombat && currentTick < combatData.combatEndTick) {
      return {
        allowed: false,
        reason: "Cannot logout during combat",
      };
    }

    return { allowed: true };
  }

  /**
   * Update the last input tick for a player
   * Called by PlayerSystem when player performs any action
   * Tile-based MMORPG: Auto-retaliate disabled after 20 minutes of no input
   *
   * @param playerId - The player's entity ID
   * @param currentTick - The current game tick
   */
  public updatePlayerInput(playerId: string, currentTick: number): void {
    this.lastInputTick.set(playerId, currentTick);
  }

  /**
   * Check if a player has been AFK too long (20 minutes)
   * tile-based-MMORPG-accurate: Auto-retaliate disabled after 2000 ticks of no input
   *
   * @param playerId - The player's entity ID
   * @param currentTick - The current game tick
   * @returns true if player has been AFK too long
   */
  public isAFKTooLong(playerId: string, currentTick: number): boolean {
    const lastInput = this.lastInputTick.get(playerId) ?? currentTick;
    return currentTick - lastInput >= getAfkDisableRetaliateTicks();
  }

  /**
   * Clean up all combat state for a disconnecting player
   * Called when a player disconnects to prevent orphaned combat states
   * and allow mobs to immediately retarget other players
   */
  public cleanupPlayerDisconnect(playerId: string): void {
    const typedPlayerId = createEntityID(playerId);

    // Remove player's own combat state
    this.stateService.removeCombatState(typedPlayerId);

    // Clear player's attack cooldowns
    this.nextAttackTicks.delete(typedPlayerId);

    // Clear any scheduled emote resets
    this.animationManager.cancelEmoteReset(playerId);

    // Clear player's equipment stats cache
    this.playerEquipmentStats.delete(playerId);

    this.antiCheat.cleanup(playerId);
    this.rateLimiter.cleanup(playerId);
    this.lastInputTick.delete(playerId);

    // Clear combat follow tracking
    this.lastCombatTargetTile.delete(playerId);

    // Cancel any in-flight projectiles targeting or from this player
    this.projectileService.cancelProjectilesForTarget(playerId);
    this.projectileService.cancelProjectilesFromAttacker(playerId);

    // Find all entities that were targeting this disconnected player
    const combatStatesMap = this.stateService.getCombatStatesMap();
    for (const [attackerId, state] of combatStatesMap) {
      if (String(state.targetId) === playerId) {
        // Clear the attacker's cooldown so they can immediately retarget
        this.nextAttackTicks.delete(attackerId);

        // If attacker is a mob, reset its internal combat state
        if (state.attackerType === "mob") {
          const mobEntity = this.world.entities.get(String(attackerId));
          if (
            isMobEntity(mobEntity) &&
            typeof mobEntity.onTargetDied === "function"
          ) {
            // Reuse the same method - disconnect is similar to death
            mobEntity.onTargetDied(playerId);
          }
        }

        // Remove the attacker's combat state (don't let them keep attacking empty air)
        this.stateService.removeCombatState(attackerId);

        // Clear combat state from entity if it's a player
        if (state.attackerType === "player") {
          this.stateService.clearCombatStateFromEntity(
            String(attackerId),
            "player",
          );
        }
      }
    }
  }

  // Combat update loop - DEPRECATED: Combat logic now handled by processCombatTick() via TickSystem
  // This method is kept for compatibility but does nothing - all combat runs through tick system
  update(_dt: number): void {
    // Combat logic moved to processCombatTick() for tile-based-MMORPG-accurate tick-based timing
    // This is called by TickSystem at TickPriority.COMBAT
  }

  /** Process combat on each server tick. Called by TickSystem. */
  public processCombatTick(tickNumber: number): void {
    this.tickOrchestrator.processCombatTick(tickNumber);
  }

  /** Per-mob entry. Called during the NPC phase of GameTickProcessor. */
  public processNPCCombatTick(mobId: string, tickNumber: number): void {
    this.tickOrchestrator.processNPCCombatTick(mobId, tickNumber);
  }

  /** Per-player entry. Called during the Player phase of GameTickProcessor. */
  public processPlayerCombatTick(playerId: string, tickNumber: number): void {
    this.tickOrchestrator.processPlayerCombatTick(playerId, tickNumber);
  }

  // processCombatTick / processNPCCombatTick / processPlayerCombatTick /
  // processAutoAttackOnTick bodies moved to ./CombatTickOrchestrator
  // (slice 12). Public methods above are thin proxies.

  // Combat event recording (record / buildGameStateInfo /
  // buildCombatSnapshot) lives in CombatEventRecorder — see field
  // declaration above. All `this.eventRecorder.record(...)` callsites
  // delegate to `this.eventRecorder.record(...)`.

  destroy(): void {
    this.stateService.destroy();
    this.animationManager.destroy();
    this.antiCheat.destroy();
    this.rateLimiter.destroy();
    this.eventStore.destroy();
    this.projectileService.clear();
    tilePool.release(this._attackerTile);
    tilePool.release(this._targetTile);
    this.nextAttackTicks.clear();
    this.lastCombatTargetTile.clear();
    this.playerEquipmentStats.clear();
    this.lastInputTick.clear();
    super.destroy();
  }

  /**
   * Decay anti-cheat scores and clean stale XP history
   * Call periodically (e.g., every minute) to prevent memory leaks
   */
  public decayAntiCheatScores(): void {
    this.antiCheat.decayScores();
    // Also clean stale XP history to prevent memory leaks from disconnected players
    const currentTick = this.world.currentTick ?? 0;
    this.antiCheat.cleanupStaleXPHistory(currentTick);
  }

  /**
   * Get pool statistics for monitoring dashboard
   * Useful for detecting memory leaks or pool exhaustion
   *
   * @see COMBAT_SYSTEM_IMPROVEMENTS.md Section 3.2
   */
  public getPoolStats(): {
    quaternions: { total: number; available: number; inUse: number };
  } {
    return {
      quaternions: quaternionPool.getStats(),
    };
  }
}
