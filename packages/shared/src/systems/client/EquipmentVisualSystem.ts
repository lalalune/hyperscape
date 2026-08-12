/**
 * Equipment Visual System (Client-Only)
 *
 * Handles visual rendering of equipped items on player avatars using VRM bones.
 * Works with weapons exported from Asset Forge with pre-baked attachment data.
 *
 * **How It Works:**
 * 1. Listens for PLAYER_EQUIPMENT_CHANGED events
 * 2. Loads weapon GLB from Asset Forge (with userData.hyperia metadata)
 * 3. Attaches weapon to VRM bone specified in metadata
 * 4. Transforms are pre-baked - just attach directly!
 *
 * **Asset Forge Integration:**
 * - Weapons fitted in Asset Forge Equipment Page
 * - Exported with VRM bone attachment data
 * - Position/rotation already baked into GLB hierarchy
 * - See: /packages/asset-forge/WEAPON_FITTING_GUIDE.md
 */

import { GLTFLoader } from "../../libs/gltfloader/GLTFLoader";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";
import { EventType } from "../../types/events";
import { SystemBase } from "../shared/infrastructure/SystemBase";
import type { World } from "../../types";
import type { VRM } from "@pixiv/three-vrm";
import { EQUIPMENT_SLOT_NAMES } from "../../constants/EquipmentConstants";
import type { Entity } from "../../entities/Entity";
import { AttackType } from "../../types/game/item-types";
import { getItem } from "../../data/items";
import { getAvatarByUrl } from "../../data/avatars";
import {
  attachEquipmentVisualToVRM,
  createDynamicBowStringController,
  createStableHeldEquipmentPoseController,
  extractEquipmentAttachmentData,
  removeEquipmentVisual,
  resolveEquipmentVisualData,
  resolveEquipmentVisualUrls,
  shouldRenderHeldEquipmentVisual,
  validateStreamingEquipmentVisualModel,
  type EquipmentVisualModelData,
  type EquipmentVisualStore,
  type DynamicBowStringController,
  type DynamicBowStringTransition,
  type StableHeldEquipmentPoseController,
} from "./EquipmentVisualHelpers";
import { isStreamingLikeViewport } from "../../runtime/clientViewportMode";

export const STREAMING_DUEL_VISIBLE_EQUIPMENT_SLOTS = Object.freeze([
  "weapon",
  "shield",
  "helmet",
  "body",
  "legs",
  "boots",
  "gloves",
  "cape",
] as const);

export type StreamingDuelVisibleEquipmentSlot =
  (typeof STREAMING_DUEL_VISIBLE_EQUIPMENT_SLOTS)[number];

/**
 * These competitive slots are deliberately represented outside the avatar
 * mesh contract. Ammunition is rendered by the authoritative projectile path;
 * jewellery remains exact in the public loadout UI but is below the approved
 * broadcast-camera readability threshold.
 */
export const STREAMING_DUEL_INTENTIONALLY_INVISIBLE_EQUIPMENT_SLOTS =
  Object.freeze({
    arrows: "authoritative_projectile_visual",
    amulet: "public_loadout_disclosure_only",
    ring: "public_loadout_disclosure_only",
  } as const);

export interface StreamingDuelEquipmentVisualRequirement {
  playerId: string;
  itemId: string;
  slot: StreamingDuelVisibleEquipmentSlot;
}

export interface StreamingDuelEquipmentVisualExpectation {
  playerId: string;
  itemId: string | null;
  slot: StreamingDuelVisibleEquipmentSlot;
}

export interface StreamingDuelEquipmentVisualContract {
  cycleId: string;
  requirements: StreamingDuelEquipmentVisualRequirement[];
  currentEquipment: StreamingDuelEquipmentVisualExpectation[];
}

export type StreamingDuelEquipmentVisualLoadStatus =
  | "loading"
  | "ready"
  | "missing_model"
  | "invalid_model"
  | "load_failed"
  | "avatar_unavailable"
  | "unapproved_avatar"
  | "incompatible_avatar";

export interface StreamingDuelEquipmentVisualReadiness {
  configured: boolean;
  ready: boolean;
  cycleId: string | null;
  requiredCount: number;
  readyCount: number;
  unresolved: Array<
    StreamingDuelEquipmentVisualRequirement & {
      status: StreamingDuelEquipmentVisualLoadStatus;
    }
  >;
  attachmentMismatches: Array<
    StreamingDuelEquipmentVisualExpectation & {
      desiredItemId: string | null;
      attachedItemId: string | null;
    }
  >;
}

export interface StreamingDuelBowTransitionEvent {
  sequence: number;
  playerId: string;
  itemId: string | null;
  kind: DynamicBowStringTransition["kind"];
  performanceTimeMs: number;
  releaseAtPerformanceTimeMs: number | null;
  lastVisibleNockWorldPosition: [number, number, number] | null;
  drawHandWorldPosition: [number, number, number] | null;
}

export interface StreamingDuelBowPresentationDiagnostics {
  schemaVersion: 1;
  updatedAt: number;
  latestSequence: number;
  players: Array<{
    playerId: string;
    itemId: string | null;
    controllerReady: boolean;
    nockedArrowVisible: boolean;
    nockedArrowWorldPosition: [number, number, number] | null;
  }>;
  recentTransitions: StreamingDuelBowTransitionEvent[];
}

type StreamingVisualRequirementState =
  StreamingDuelEquipmentVisualRequirement & {
    status: StreamingDuelEquipmentVisualLoadStatus;
  };

const STREAMING_DUEL_VISIBLE_EQUIPMENT_SLOT_SET = new Set<string>(
  STREAMING_DUEL_VISIBLE_EQUIPMENT_SLOTS,
);

export function isStreamingDuelVisibleEquipmentSlot(
  slot: string,
): slot is StreamingDuelVisibleEquipmentSlot {
  return STREAMING_DUEL_VISIBLE_EQUIPMENT_SLOT_SET.has(slot.toLowerCase());
}

function streamingVisualRequirementKey(
  requirement: StreamingDuelEquipmentVisualRequirement,
): string {
  return `${requirement.playerId}\u0000${requirement.slot}\u0000${requirement.itemId}`;
}

interface AvatarLike {
  instance?: {
    raw?: {
      userData?: {
        vrm?: VRM;
      };
      scene?: THREE.Object3D;
    };
  } | null;
}

interface PlayerWithAvatar extends Entity {
  /** PlayerLocal exposes VRM via _avatar getter */
  _avatar?: AvatarLike;
  /** PlayerRemote stores VRM in avatar property */
  avatar?: AvatarLike;
  avatarUrl?: string;
  data: Entity["data"] & { avatar?: unknown };
}

/** Resolve avatar from either PlayerLocal (_avatar) or PlayerRemote (avatar) */
function getAvatar(player: PlayerWithAvatar): AvatarLike | undefined {
  return player._avatar || player.avatar;
}

function getPlayerAvatarId(player: PlayerWithAvatar): string | null {
  const avatarUrl =
    player.avatarUrl ??
    (typeof player.data?.avatar === "string" ? player.data.avatar : null);
  return avatarUrl ? (getAvatarByUrl(avatarUrl)?.id ?? null) : null;
}

interface PlayerEquipmentVisuals {
  weapon?: THREE.Object3D;
  shield?: THREE.Object3D;
  helmet?: THREE.Object3D;
  body?: THREE.Object3D;
  legs?: THREE.Object3D;
  boots?: THREE.Object3D;
  gloves?: THREE.Object3D;
  cape?: THREE.Object3D;
  amulet?: THREE.Object3D;
  ring?: THREE.Object3D;
  arrows?: THREE.Object3D;
  gatheringtool?: THREE.Object3D;
}

export class EquipmentVisualSystem extends SystemBase {
  private gltfParser: GLTFLoader;
  private playerEquipment = new Map<string, PlayerEquipmentVisuals>();

  // Cache loaded weapon models to avoid reloading
  private weaponCache = new Map<string, GLTF>();
  private weaponLoadPromises = new Map<string, Promise<GLTF | null>>();
  private equipmentLoadGeneration = 0;

  // The public stream configures this from the exact immutable combat
  // snapshot. A fixed starter-weapon list cannot represent agent-owned gear.
  private streamingVisualCycleId: string | null = null;
  private streamingVisualRequirementSignature = "";
  private streamingVisualGeneration = 0;
  private streamingVisualRequirements = new Map<
    string,
    StreamingVisualRequirementState
  >();
  private streamingVisualExpectations: StreamingDuelEquipmentVisualExpectation[] =
    [];
  private streamingVisualContractConfigured = false;

  // Desired identity is updated before any asynchronous work begins. Attached
  // identity is written only after the exact model is on the current avatar.
  private desiredEquipmentItemIds = new Map<
    string,
    Map<string, string | null>
  >();
  private attachedEquipmentItemIds = new Map<string, Map<string, string>>();

  // Queue equipment changes that are waiting for VRM to load
  private pendingEquipment = new Map<
    string,
    { slot: string; itemId: string }[]
  >();

  // Track players whose weapon is temporarily hidden during gathering
  // (e.g., fishing - weapon hidden while fishing rod is shown)
  private hiddenWeapons = new Set<string>();

  // Track players whose weapon is hidden during non-melee combat (magic/ranged)
  private hiddenWeaponsCombat = new Set<string>();

  // Timers to restore weapon visibility after non-melee attack animation completes
  private combatWeaponRestoreTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  // Track item ID in weapon slot per player (to check if it's melee before hiding)
  private playerWeaponItemIds = new Map<string, string>();

  // Render-synchronized nock controller for each equipped dynamic bowstring.
  private dynamicBowStrings = new Map<string, DynamicBowStringController>();
  private bowTransitionSequence = 0;
  private readonly recentBowTransitions: StreamingDuelBowTransitionEvent[] = [];
  private static readonly MAX_RECENT_BOW_TRANSITIONS = 128;

  // Long fitted weapons can opt into an avatar-local pose that cancels wrist
  // roll while preserving the certified hand attachment point.
  private stableHeldEquipmentPoses = new Map<
    string,
    StableHeldEquipmentPoseController
  >();

  // How long to keep weapon hidden after the last non-melee attack (ms).
  // Using ~4 ticks (2400ms) to cover the full attack animation at standard speed.
  private static readonly COMBAT_WEAPON_RESTORE_DELAY_MS = 2400;

  constructor(world: World) {
    super(world, {
      name: "equipment-visual",
      dependencies: {
        required: [],
        optional: ["player", "equipment"],
      },
      autoCleanup: true,
    });
    // Initialize parser with meshopt decoder for compressed GLB files
    // NOTE: We use ClientLoader.loadFile() for the fetch/cache layer (IndexedDB etc.)
    // and only use this GLTFLoader for parsing the bytes into a scene.
    this.gltfParser = new GLTFLoader();
    this.gltfParser.setMeshoptDecoder(MeshoptDecoder);
  }

  async init(): Promise<void> {
    // Only run on client
    if (this.world.isServer) {
      return;
    }

    // Subscribe to equipment changes
    this.subscribe(
      EventType.PLAYER_EQUIPMENT_CHANGED,
      (data: { playerId: string; slot: string; itemId: string | null }) => {
        this.handleEquipmentChange(data);
      },
    );

    // Clean up when player leaves
    this.subscribe(EventType.PLAYER_CLEANUP, (data: { playerId: string }) => {
      this.cleanupPlayerEquipment(data.playerId);
    });

    // When VRM finishes loading, replay cached equipment through the normal handler.
    // This handles the case where equipmentUpdated arrived before VRM was ready.
    // By routing through handleEquipmentChange (the proven real-time path), we get
    // the same bone lookup and attachment logic that works for live equip changes.
    this.subscribe(
      EventType.AVATAR_LOAD_COMPLETE,
      (data: { playerId: string; success: boolean }) => {
        if (!data.success) return;

        // 1. Replay any items from the pending queue
        const pending = this.pendingEquipment.get(data.playerId);
        if (pending && pending.length > 0) {
          const items = [...pending]; // Copy before clearing
          this.pendingEquipment.delete(data.playerId);
          for (const { slot, itemId } of items) {
            this.handleEquipmentChange({
              playerId: data.playerId,
              slot,
              itemId,
            });
          }
        }

        // 2. Safety net: also replay from network cache (lastEquipmentByPlayerId)
        //    Catches equipment that was dropped because entity didn't exist yet
        interface NetworkWithEquipmentCache {
          lastEquipmentByPlayerId?: Record<string, Record<string, unknown>>;
        }
        const network = this.world.network as
          NetworkWithEquipmentCache | undefined;
        const cached = network?.lastEquipmentByPlayerId?.[data.playerId];
        if (cached) {
          const slots = EQUIPMENT_SLOT_NAMES;
          for (const slot of slots) {
            const slotData = cached[slot] as
              { itemId?: string; item?: { id?: string } } | null | undefined;
            const itemId = slotData?.itemId || slotData?.item?.id;
            if (itemId && String(itemId) !== "0") {
              this.handleEquipmentChange({
                playerId: data.playerId,
                slot,
                itemId: String(itemId),
              });
            }
          }
        }
      },
    );

    // classic MMORPG-STYLE: Show gathering tool during gathering (e.g., fishing rod during fishing)
    this.subscribe(
      EventType.GATHERING_TOOL_SHOW,
      (data: { playerId: string; itemId: string; slot: string }) => {
        this.handleGatheringToolShow(data);
      },
    );

    // Hide gathering tool when gathering stops
    this.subscribe(
      EventType.GATHERING_TOOL_HIDE,
      (data: { playerId: string; slot: string }) => {
        this.handleGatheringToolHide(data);
      },
    );

    // classic MMORPG-STYLE: Hide melee weapon during magic/ranged attacks
    this.subscribe(
      EventType.COMBAT_PROJECTILE_LAUNCHED,
      (data: {
        attackerId: string;
        projectileType?: string;
        delayMs?: number;
        arrowId?: string;
      }) => {
        this.handleCombatProjectileLaunched(data);
      },
    );

    this.subscribe(
      EventType.COMBAT_ENDED,
      (data: { attackerId: string; targetId: string }) => {
        this.dynamicBowStrings.get(data.attackerId)?.cancelRelease();
        this.dynamicBowStrings.get(data.targetId)?.cancelRelease();
      },
    );
  }

  setStreamingDuelEquipmentVisualContract(
    contract: StreamingDuelEquipmentVisualContract,
  ): void {
    const cycleId = contract.cycleId.trim();
    const previousCycleId = this.streamingVisualCycleId;
    const requirements = new Map<
      string,
      StreamingDuelEquipmentVisualRequirement
    >();
    for (const requirement of contract.requirements) {
      const playerId = requirement.playerId.trim();
      const itemId = requirement.itemId.trim();
      const slot = requirement.slot.toLowerCase();
      if (!playerId || !itemId || !isStreamingDuelVisibleEquipmentSlot(slot)) {
        continue;
      }
      const normalized = { playerId, itemId, slot };
      requirements.set(streamingVisualRequirementKey(normalized), normalized);
    }
    const normalizedRequirements = [...requirements.values()].sort((a, b) =>
      streamingVisualRequirementKey(a).localeCompare(
        streamingVisualRequirementKey(b),
      ),
    );
    const requirementSignature = JSON.stringify(normalizedRequirements);

    // An empty cycle ID is the legitimate maintenance/IDLE projection. The
    // method call itself is the configuration boundary; before the first call
    // readiness remains fail-closed.
    this.streamingVisualContractConfigured = true;
    this.streamingVisualCycleId = cycleId || null;
    this.streamingVisualExpectations = contract.currentEquipment
      .filter(
        (expectation) =>
          expectation.playerId.trim().length > 0 &&
          isStreamingDuelVisibleEquipmentSlot(expectation.slot),
      )
      .map((expectation) => ({
        playerId: expectation.playerId.trim(),
        itemId: expectation.itemId?.trim() || null,
        slot: expectation.slot.toLowerCase() as StreamingDuelVisibleEquipmentSlot,
      }));

    if (
      previousCycleId === this.streamingVisualCycleId &&
      this.streamingVisualRequirementSignature === requirementSignature &&
      this.streamingVisualRequirements.size === normalizedRequirements.length
    ) {
      return;
    }

    this.streamingVisualRequirementSignature = requirementSignature;
    const generation = ++this.streamingVisualGeneration;
    this.streamingVisualRequirements.clear();
    for (const requirement of normalizedRequirements) {
      const key = streamingVisualRequirementKey(requirement);
      this.streamingVisualRequirements.set(key, {
        ...requirement,
        status: "loading",
      });
      void this.loadEquipmentModel(requirement.itemId, requirement.slot, null)
        .then((model) => {
          if (generation !== this.streamingVisualGeneration) return;
          const current = this.streamingVisualRequirements.get(key);
          if (!current) return;
          current.status = model
            ? validateStreamingEquipmentVisualModel(
                model.scene,
                requirement.slot,
                { itemId: requirement.itemId },
              ).valid
              ? "ready"
              : "invalid_model"
            : "missing_model";
        })
        .catch(() => {
          if (generation !== this.streamingVisualGeneration) return;
          const current = this.streamingVisualRequirements.get(key);
          if (!current) return;
          current.status = "load_failed";
          this.logger.warn(
            `Failed to pre-warm required streaming equipment ${requirement.itemId} (${requirement.slot})`,
          );
        });
    }
  }

  getStreamingDuelEquipmentVisualReadiness(): StreamingDuelEquipmentVisualReadiness {
    const requirementStates = [...this.streamingVisualRequirements.values()];
    const unresolved = requirementStates.flatMap((requirement) => {
      if (requirement.status !== "ready") return [{ ...requirement }];

      const player = this.world.entities.get(requirement.playerId) as
        PlayerWithAvatar | undefined;
      const rawInstance = player ? getAvatar(player)?.instance?.raw : undefined;
      const vrm = rawInstance?.userData?.vrm;
      if (!player || !vrm) {
        return [{ ...requirement, status: "avatar_unavailable" as const }];
      }

      const avatarId = getPlayerAvatarId(player);
      if (!avatarId) {
        return [{ ...requirement, status: "unapproved_avatar" as const }];
      }

      const model = this.weaponCache.get(requirement.itemId);
      if (!model) {
        return [{ ...requirement, status: "invalid_model" as const }];
      }
      const validation = validateStreamingEquipmentVisualModel(
        model.scene,
        requirement.slot,
        { itemId: requirement.itemId, avatarId, vrm },
      );
      if (!validation.valid) {
        return [
          {
            ...requirement,
            status:
              validation.reason === "incompatible_avatar"
                ? ("incompatible_avatar" as const)
                : ("invalid_model" as const),
          },
        ];
      }
      return [];
    });
    const attachmentMismatches = this.streamingVisualExpectations.flatMap(
      (expectation) => {
        const desiredItemId =
          this.desiredEquipmentItemIds
            .get(expectation.playerId)
            ?.get(expectation.slot) ?? null;
        const attachedItemId =
          this.attachedEquipmentItemIds
            .get(expectation.playerId)
            ?.get(expectation.slot) ?? null;
        const desiredVisualIsAttached = desiredItemId === attachedItemId;
        const projectedVisualMatches = desiredItemId === expectation.itemId;
        const desiredVisualIsFrozen = desiredItemId
          ? this.streamingVisualRequirements.has(
              streamingVisualRequirementKey({
                playerId: expectation.playerId,
                itemId: desiredItemId,
                slot: expectation.slot,
              }),
            )
          : false;

        // The public cycle projection and the replicated equipment event are
        // delivered on separate ordered streams. A committed in-fight role
        // switch can therefore make the cycle's current-item hint one update
        // behind the server-originated equipment event. Treat that bounded
        // transition as ready only when the desired visual is already attached
        // and the item belongs to this cycle's frozen, pre-warmed loadout set.
        // Unknown or half-applied equipment remains fail-closed.
        const matches =
          desiredVisualIsAttached &&
          (projectedVisualMatches || desiredVisualIsFrozen);
        return matches
          ? []
          : [
              {
                ...expectation,
                desiredItemId,
                attachedItemId,
              },
            ];
      },
    );
    const readyCount = requirementStates.length - unresolved.length;
    return {
      configured: this.streamingVisualContractConfigured,
      ready:
        this.streamingVisualContractConfigured &&
        unresolved.length === 0 &&
        attachmentMismatches.length === 0,
      cycleId: this.streamingVisualCycleId,
      requiredCount: requirementStates.length,
      readyCount,
      unresolved,
      attachmentMismatches,
    };
  }

  getStreamingDuelBowPresentationDiagnostics(
    playerIds: readonly string[],
  ): StreamingDuelBowPresentationDiagnostics {
    const allowedPlayerIds = new Set(
      playerIds.filter((playerId) => typeof playerId === "string" && playerId),
    );
    const players = [...allowedPlayerIds].map((playerId) => {
      const controller = this.dynamicBowStrings.get(playerId);
      const visible = controller?.nockedArrow.visible === true;
      let nockedArrowWorldPosition: [number, number, number] | null = null;
      if (controller && visible) {
        const position = controller.nockedArrow.getWorldPosition(
          new THREE.Vector3(),
        );
        if ([position.x, position.y, position.z].every(Number.isFinite)) {
          nockedArrowWorldPosition = [position.x, position.y, position.z];
        }
      }
      return {
        playerId,
        itemId: this.playerWeaponItemIds.get(playerId) ?? null,
        controllerReady: Boolean(controller),
        nockedArrowVisible: visible,
        nockedArrowWorldPosition,
      };
    });
    return {
      schemaVersion: 1,
      updatedAt: Date.now(),
      latestSequence: this.bowTransitionSequence,
      players,
      recentTransitions: this.recentBowTransitions.filter((transition) =>
        allowedPlayerIds.has(transition.playerId),
      ),
    };
  }

  private recordBowTransition(
    playerId: string,
    transition: DynamicBowStringTransition,
  ): void {
    const event: StreamingDuelBowTransitionEvent = {
      sequence: ++this.bowTransitionSequence,
      playerId,
      itemId: this.playerWeaponItemIds.get(playerId) ?? null,
      kind: transition.kind,
      performanceTimeMs: transition.performanceTimeMs,
      releaseAtPerformanceTimeMs:
        transition.kind === "scheduled"
          ? transition.releaseAtPerformanceTimeMs
          : null,
      lastVisibleNockWorldPosition:
        transition.kind === "released"
          ? transition.lastVisibleNockWorldPosition
          : null,
      drawHandWorldPosition:
        transition.kind === "released"
          ? transition.drawHandWorldPosition
          : null,
    };
    this.recentBowTransitions.push(event);
    if (
      this.recentBowTransitions.length >
      EquipmentVisualSystem.MAX_RECENT_BOW_TRANSITIONS
    ) {
      this.recentBowTransitions.shift();
    }
  }

  private setDesiredEquipmentItem(
    playerId: string,
    slot: string,
    itemId: string | null,
  ): void {
    let desired = this.desiredEquipmentItemIds.get(playerId);
    if (!desired) {
      desired = new Map();
      this.desiredEquipmentItemIds.set(playerId, desired);
    }
    desired.set(slot.toLowerCase(), itemId);
  }

  private setAttachedEquipmentItem(
    playerId: string,
    slot: string,
    itemId: string | null,
  ): void {
    const slotKey = slot.toLowerCase();
    let attached = this.attachedEquipmentItemIds.get(playerId);
    if (!attached) {
      if (!itemId) return;
      attached = new Map();
      this.attachedEquipmentItemIds.set(playerId, attached);
    }
    if (itemId) attached.set(slotKey, itemId);
    else attached.delete(slotKey);
  }

  private async handleEquipmentChange(data: {
    playerId: string;
    slot: string;
    itemId: string | null;
  }): Promise<void> {
    const { playerId, slot, itemId } = data;

    // Skip invalid itemIds (only "0" is invalid, null means unequip)
    if (itemId === "0") {
      return;
    }

    this.setDesiredEquipmentItem(playerId, slot, itemId);

    // Get player entity to access VRM
    const player = this.world.entities.get(playerId);
    if (!player) {
      // Entity doesn't exist yet (equipmentUpdated arrived before entityAdded)
      // Queue for later — AVATAR_LOAD_COMPLETE or update() will process it
      if (itemId && itemId !== "0") {
        if (!this.pendingEquipment.has(playerId)) {
          this.pendingEquipment.set(playerId, []);
        }
        const queue = this.pendingEquipment.get(playerId)!;
        const filtered = queue.filter((e) => e.slot !== slot);
        filtered.push({ slot, itemId });
        this.pendingEquipment.set(playerId, filtered);
      }
      return;
    }

    // CRITICAL: instance.raw is GLTF, VRM is in userData.vrm!
    // PlayerLocal uses _avatar getter, PlayerRemote uses avatar property
    const playerWithAvatar = player as PlayerWithAvatar;
    const resolvedAvatar = getAvatar(playerWithAvatar);
    const avatarInstance = resolvedAvatar?.instance;
    const vrm = avatarInstance?.raw?.userData?.vrm;

    if (!avatarInstance || !vrm) {
      // Queue this equipment change to retry when VRM is ready
      if (!this.pendingEquipment.has(playerId)) {
        this.pendingEquipment.set(playerId, []);
      }

      // Only queue if itemId is valid (not null or "0")
      if (itemId && itemId !== "0") {
        const queue = this.pendingEquipment.get(playerId)!;
        // Remove any existing entry for this slot
        const filtered = queue.filter((e) => e.slot !== slot);
        filtered.push({ slot, itemId });
        this.pendingEquipment.set(playerId, filtered);
      }

      return;
    }

    // Get or create equipment visuals for this player
    if (!this.playerEquipment.has(playerId)) {
      this.playerEquipment.set(playerId, {});
    }
    const equipment = this.playerEquipment.get(playerId)!;

    // Track weapon slot item ID for combat visibility checks
    if (slot.toLowerCase() === "weapon") {
      if (itemId) {
        this.playerWeaponItemIds.set(playerId, itemId);
      } else {
        this.playerWeaponItemIds.delete(playerId);
      }
    }

    // Handle unequip (itemId is null)
    if (!itemId) {
      this.unequipVisual(playerId, slot, equipment, vrm);
      return;
    }

    // Handle equip - load and attach weapon
    await this.equipVisual(playerId, slot, itemId, equipment, vrm);
  }

  private unequipVisual(
    playerId: string,
    slot: string,
    equipment: PlayerEquipmentVisuals,
    _vrm: VRM,
  ): void {
    // Remove existing visual for this slot
    const slotKey = slot.toLowerCase() as keyof PlayerEquipmentVisuals;
    if (slotKey === "weapon") {
      this.dynamicBowStrings.get(playerId)?.dispose();
      this.dynamicBowStrings.delete(playerId);
      this.stableHeldEquipmentPoses.get(playerId)?.dispose();
      this.stableHeldEquipmentPoses.delete(playerId);
    }
    removeEquipmentVisual(equipment as EquipmentVisualStore, slotKey);
    this.setAttachedEquipmentItem(playerId, slot, null);
  }

  /**
   * Try to resolve item data from the network's cached equipmentUpdated payload.
   * The server sends the full Item object per slot; this is our fallback when
   * the client-side ITEMS map doesn't contain a newly-added weapon yet.
   */
  private getItemFromNetworkCache(
    playerId: string,
    slot: string,
  ): { equippedModelPath?: string; modelPath?: string | null } | null {
    interface NetworkWithEquipmentCache {
      lastEquipmentByPlayerId?: Record<string, Record<string, unknown>>;
    }
    const network = this.world.network as NetworkWithEquipmentCache | undefined;
    const cached = network?.lastEquipmentByPlayerId?.[playerId];
    if (!cached) return null;
    const slotData = cached[slot] as
      | { item?: { equippedModelPath?: string; modelPath?: string | null } }
      | null
      | undefined;
    return slotData?.item ?? null;
  }

  private async equipVisual(
    playerId: string,
    slot: string,
    itemId: string,
    equipment: PlayerEquipmentVisuals,
    _vrm: VRM,
  ): Promise<void> {
    // Remove the preceding slot visual before loading its replacement. Keeping
    // it visible would falsely show the old authoritative role on a slow or
    // failed asset request.
    if (slot.toLowerCase() === "weapon") {
      this.dynamicBowStrings.get(playerId)?.dispose();
      this.dynamicBowStrings.delete(playerId);
      this.stableHeldEquipmentPoses.get(playerId)?.dispose();
      this.stableHeldEquipmentPoses.delete(playerId);
    }
    removeEquipmentVisual(
      equipment as EquipmentVisualStore,
      slot.toLowerCase(),
    );
    this.setAttachedEquipmentItem(playerId, slot, null);
    try {
      const cachedItem = this.getItemFromNetworkCache(playerId, slot);
      const gltf = await this.loadEquipmentModel(itemId, slot, cachedItem);
      if (!gltf) return;

      const currentPlayer = this.world.entities.get(playerId) as
        PlayerWithAvatar | undefined;
      if (!currentPlayer) {
        // The entity can legitimately leave the spectator interest set while
        // its asynchronous model load is in flight. There is no avatar left to
        // mutate, so abandon this stale completion quietly.
        return;
      }
      const currentRawInstance = getAvatar(currentPlayer)?.instance?.raw;
      const currentVrm = currentRawInstance?.userData?.vrm;
      const avatarId = getPlayerAvatarId(currentPlayer);
      const streamingValidationReason =
        isStreamingLikeViewport() && isStreamingDuelVisibleEquipmentSlot(slot)
          ? !avatarId
            ? "unapproved_avatar"
            : !currentVrm
              ? "avatar_unavailable"
              : validateStreamingEquipmentVisualModel(gltf.scene, slot, {
                  itemId,
                  avatarId,
                  vrm: currentVrm,
                }).reason
          : null;

      if (streamingValidationReason) {
        console.error(
          `[EquipmentVisual] ❌ Invalid fitted streaming model for ${itemId} (${slot}): ${streamingValidationReason}`,
        );
        return;
      }

      const desiredItemId = this.desiredEquipmentItemIds
        .get(playerId)
        ?.get(slot.toLowerCase());
      if (desiredItemId !== itemId) {
        // A newer atomic role switch won this slot while the old model loaded.
        return;
      }

      const weaponMesh: THREE.Object3D = gltf.scene.clone(true); // Clone to allow multiple instances

      // Re-check after cloning in case the contestant left or changed avatars
      // during the asynchronous load completion.
      const player = this.world.entities.get(playerId) as
        PlayerWithAvatar | undefined;
      if (!player) {
        return;
      }

      const rawInstance = getAvatar(player)?.instance?.raw;
      const activeVrm = rawInstance?.userData?.vrm;
      const avatarRoot = (rawInstance?.scene || rawInstance) as
        THREE.Object3D | undefined;

      if (!avatarRoot || !activeVrm) {
        console.error(
          `[EquipmentVisual] ❌ Could not resolve avatar root for ${playerId}`,
        );
        return;
      }

      if (activeVrm !== currentVrm || getPlayerAvatarId(player) !== avatarId) {
        // An avatar replacement won the race. The authoritative equipment
        // event for the new avatar will fit and attach a fresh instance.
        return;
      }

      const attached = attachEquipmentVisualToVRM({
        slot,
        modelRoot: weaponMesh,
        visuals: equipment as EquipmentVisualStore,
        vrm: activeVrm,
        avatarRoot,
      });

      if (!attached) {
        console.error(
          `[EquipmentVisual] ❌ Failed to attach ${itemId} to slot ${slot}`,
        );
        return;
      }
      if (slot.toLowerCase() === "weapon") {
        const bowString = createDynamicBowStringController({
          modelRoot: weaponMesh,
          vrm: activeVrm,
          onTransition: (transition) =>
            this.recordBowTransition(playerId, transition),
          getState: () => {
            const current = this.world.entities.get(playerId) as
              PlayerWithAvatar | undefined;
            const data = current?.data as
              | { emote?: unknown; e?: unknown; deathState?: unknown }
              | undefined;
            return {
              emote: data?.emote,
              abbreviatedEmote: data?.e,
              deathState: data?.deathState,
            };
          },
        });
        if (bowString) {
          this.dynamicBowStrings.set(playerId, bowString);
        } else if (
          extractEquipmentAttachmentData(
            weaponMesh,
          )?.weaponType?.toLowerCase() === "bow"
        ) {
          console.error(
            `[EquipmentVisual] ❌ Could not create the dynamic bowstring for ${itemId}`,
          );
        }
        const stablePose = createStableHeldEquipmentPoseController({
          modelRoot: weaponMesh,
          vrm: activeVrm,
          avatarRoot,
        });
        if (stablePose) {
          this.stableHeldEquipmentPoses.set(playerId, stablePose);
        } else if (
          extractEquipmentAttachmentData(
            weaponMesh,
          )?.weaponType?.toLowerCase() === "staff"
        ) {
          console.error(
            `[EquipmentVisual] ❌ Could not create the stable held pose for ${itemId}`,
          );
        }
      }
      this.setAttachedEquipmentItem(playerId, slot, itemId);
    } catch (error) {
      console.error(`[EquipmentVisual] ❌ Error equipping ${itemId}:`, error);
    }
  }

  private async loadEquipmentModel(
    itemId: string,
    slot: string,
    fallbackItemData: EquipmentVisualModelData | null,
  ): Promise<GLTF | null> {
    const cached = this.weaponCache.get(itemId);
    if (cached) return cached;

    const pending = this.weaponLoadPromises.get(itemId);
    if (pending) return pending;

    const generation = this.equipmentLoadGeneration;
    const loadPromise = (async (): Promise<GLTF | null> => {
      const assetsUrl = this.world.assetsUrl?.replace(/\/$/, "") || "";
      const itemData = resolveEquipmentVisualData({
        itemId,
        fallbackItemData,
      });
      const urls = resolveEquipmentVisualUrls({
        assetsUrl,
        itemId,
        slot,
        itemData,
        fallbackItemData,
      });
      if (!urls) return null;

      // Load through ClientLoader to benefit from IndexedDB persistence,
      // request deduplication, and bounded fetch concurrency.
      const loader = this.world.loader;
      let file: File | undefined;
      let resolvedUrl = urls.primaryUrl;
      try {
        file = loader ? await loader.loadFile(urls.primaryUrl) : undefined;
      } catch (error) {
        if (!urls.fallbackUrl) throw error;
        file = loader ? await loader.loadFile(urls.fallbackUrl) : undefined;
        resolvedUrl = urls.fallbackUrl;
      }

      if (!file) {
        throw new Error(
          `[EquipmentVisual] Failed to load model: ${resolvedUrl}`,
        );
      }

      const buffer = await file.arrayBuffer();
      const gltf = (await this.gltfParser.parseAsync(
        buffer,
        resolvedUrl,
      )) as GLTF;
      if (isStreamingLikeViewport() && this.world.graphics?.precompileObject) {
        await this.world.graphics.precompileObject(gltf.scene);
      }
      if (generation === this.equipmentLoadGeneration) {
        this.weaponCache.set(itemId, gltf);
      }
      return gltf;
    })();

    this.weaponLoadPromises.set(itemId, loadPromise);
    try {
      return await loadPromise;
    } finally {
      if (this.weaponLoadPromises.get(itemId) === loadPromise) {
        this.weaponLoadPromises.delete(itemId);
      }
    }
  }

  /**
   * classic MMORPG-STYLE: Hide melee weapon during magic/ranged attacks.
   *
   * When a non-melee projectile is launched, the attacker's equipped melee weapon
   * should be hidden for the duration of the attack animation. Staffs and bows
   * (ranged/magic attackType) are left visible since they ARE the attack weapon.
   */
  private handleCombatProjectileLaunched(data: {
    attackerId: string;
    projectileType?: string;
    delayMs?: number;
    arrowId?: string;
  }): void {
    const { attackerId } = data;
    if (data.projectileType === "arrow") {
      this.dynamicBowStrings
        .get(attackerId)
        ?.scheduleRelease(data.delayMs ?? 0, data.arrowId);
    }

    const equipment = this.playerEquipment.get(attackerId);
    if (!equipment?.weapon) return;

    // Only hide if the equipped weapon is a melee weapon (sword, scimitar, etc.)
    const weaponItemId = this.playerWeaponItemIds.get(attackerId);
    if (weaponItemId) {
      const itemData = getItem(weaponItemId);
      // Staff, bow, crossbow, wand have non-melee attackType — leave them visible
      if (itemData?.attackType && itemData.attackType !== AttackType.MELEE) {
        return;
      }
    }

    // Hide the melee weapon (avoid double-hiding)
    if (equipment.weapon.visible) {
      equipment.weapon.visible = false;
    }
    this.hiddenWeaponsCombat.add(attackerId);

    // Reset restore timer — extends window if attacks keep firing
    const existing = this.combatWeaponRestoreTimers.get(attackerId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.restoreCombatHiddenWeapon(attackerId);
    }, EquipmentVisualSystem.COMBAT_WEAPON_RESTORE_DELAY_MS);
    this.combatWeaponRestoreTimers.set(attackerId, timer);
  }

  private restoreCombatHiddenWeapon(playerId: string): void {
    this.combatWeaponRestoreTimers.delete(playerId);
    if (!this.hiddenWeaponsCombat.has(playerId)) return;
    this.hiddenWeaponsCombat.delete(playerId);

    const equipment = this.playerEquipment.get(playerId);
    if (!equipment?.weapon) return;

    // Only restore if not also hidden by a gathering tool
    if (!this.hiddenWeapons.has(playerId)) {
      equipment.weapon.visible = true;
    }
  }

  private cleanupPlayerEquipment(playerId: string): void {
    this.dynamicBowStrings.get(playerId)?.dispose();
    this.dynamicBowStrings.delete(playerId);
    this.stableHeldEquipmentPoses.get(playerId)?.dispose();
    this.stableHeldEquipmentPoses.delete(playerId);
    const equipment = this.playerEquipment.get(playerId);
    if (equipment) {
      // Remove all visuals
      for (const [_slot, visual] of Object.entries(equipment)) {
        if (visual && visual.parent) {
          visual.parent.remove(visual);
        }
      }
    }

    this.playerEquipment.delete(playerId);
    this.pendingEquipment.delete(playerId);
    this.hiddenWeapons.delete(playerId);
    this.hiddenWeaponsCombat.delete(playerId);
    this.playerWeaponItemIds.delete(playerId);
    this.desiredEquipmentItemIds.delete(playerId);
    this.attachedEquipmentItemIds.delete(playerId);
    const timer = this.combatWeaponRestoreTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.combatWeaponRestoreTimers.delete(playerId);
    }
  }

  /**
   * classic MMORPG-STYLE: Show gathering tool in hand during gathering animation
   * (e.g., fishing rod appears in hand even though it's in inventory, not equipped)
   *
   * This temporarily hides any equipped weapon and shows the gathering tool instead.
   */
  private async handleGatheringToolShow(data: {
    playerId: string;
    itemId: string;
    slot: string;
  }): Promise<void> {
    const { playerId, itemId } = data;

    // Get player entity to access VRM
    const player = this.world.entities.get(playerId);
    if (!player) {
      return;
    }

    const playerWithAvatar = player as PlayerWithAvatar;
    const avatarInstance = getAvatar(playerWithAvatar)?.instance;
    const vrm = avatarInstance?.raw?.userData?.vrm;

    if (!avatarInstance || !vrm) {
      // VRM not ready - queue this for retry
      if (!this.pendingEquipment.has(playerId)) {
        this.pendingEquipment.set(playerId, []);
      }
      const queue = this.pendingEquipment.get(playerId)!;
      // Use special slot name to identify gathering tools
      queue.push({ slot: "gatheringTool", itemId });
      this.pendingEquipment.set(playerId, queue);
      return;
    }

    // Get or create equipment visuals for this player
    if (!this.playerEquipment.has(playerId)) {
      this.playerEquipment.set(playerId, {});
    }
    const equipment = this.playerEquipment.get(playerId)!;

    // classic MMORPG-STYLE: Temporarily hide the equipped weapon while showing gathering tool
    // Check hiddenWeapons to prevent hiding multiple times on rapid calls
    if (
      equipment.weapon &&
      equipment.weapon.visible &&
      !this.hiddenWeapons.has(playerId)
    ) {
      equipment.weapon.visible = false;
      this.hiddenWeapons.add(playerId);
    }

    // Use "gatheringTool" slot to avoid conflicting with actual equipped weapon
    this.setDesiredEquipmentItem(playerId, "gatheringTool", itemId);
    await this.equipVisual(playerId, "gatheringTool", itemId, equipment, vrm);
  }

  /**
   * Hide the temporary gathering tool when gathering stops
   *
   * This removes the gathering tool and restores any previously hidden weapon.
   */
  private handleGatheringToolHide(data: {
    playerId: string;
    slot: string;
  }): void {
    const { playerId } = data;

    // Get player entity to access VRM
    const player = this.world.entities.get(playerId);
    if (!player) {
      return;
    }

    const playerWithAvatar = player as PlayerWithAvatar;
    const vrm = getAvatar(playerWithAvatar)?.instance?.raw?.userData?.vrm;

    if (!vrm) {
      return;
    }

    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) {
      return;
    }

    // Remove the gathering tool visual
    this.setDesiredEquipmentItem(playerId, "gatheringTool", null);
    this.unequipVisual(playerId, "gatheringTool", equipment, vrm);

    // classic MMORPG-STYLE: Restore the equipped weapon that was hidden
    // Verify weapon exists and is currently hidden before restoring
    if (
      this.hiddenWeapons.has(playerId) &&
      equipment.weapon &&
      !equipment.weapon.visible
    ) {
      equipment.weapon.visible = true;
      this.hiddenWeapons.delete(playerId);
    }
  }

  update(_dt: number): void {
    for (const [playerId, equipment] of this.playerEquipment.entries()) {
      const player = this.world.entities.get(playerId) as
        PlayerWithAvatar | undefined;
      const playerData = player?.data as
        { emote?: unknown; e?: unknown; deathState?: unknown } | undefined;
      const showHeldEquipment = shouldRenderHeldEquipmentVisual({
        emote: playerData?.emote,
        abbreviatedEmote: playerData?.e,
        deathState: playerData?.deathState,
      });
      if (equipment.weapon) {
        equipment.weapon.visible =
          showHeldEquipment &&
          !this.hiddenWeapons.has(playerId) &&
          !this.hiddenWeaponsCombat.has(playerId);
      }
      if (equipment.shield) equipment.shield.visible = showHeldEquipment;
      if (equipment.gatheringtool) {
        equipment.gatheringtool.visible = showHeldEquipment;
      }
    }
    for (const controller of this.dynamicBowStrings.values()) {
      controller.update();
    }
    for (const controller of this.stableHeldEquipmentPoses.values()) {
      controller.update();
    }

    // Process pending equipment for players whose VRM has now loaded
    for (const [playerId, pendingItems] of this.pendingEquipment.entries()) {
      if (pendingItems.length === 0) continue;

      const player = this.world.entities.get(playerId);
      if (!player) {
        // Player is gone, clear queue
        this.pendingEquipment.delete(playerId);
        continue;
      }

      const playerWithAvatar = player as PlayerWithAvatar;
      const resolvedAvatar = getAvatar(playerWithAvatar);
      const avatarInstance = resolvedAvatar?.instance;

      // CRITICAL: instance.raw is GLTF, VRM is in userData.vrm!
      const vrm = avatarInstance?.raw?.userData?.vrm as VRM | undefined;

      if (avatarInstance && vrm) {
        // VRM is now ready! Process all pending equipment

        // Get or create equipment visuals for this player
        if (!this.playerEquipment.has(playerId)) {
          this.playerEquipment.set(playerId, {});
        }
        const equipment = this.playerEquipment.get(playerId)!;

        // Process each pending item
        for (const { slot, itemId } of pendingItems) {
          this.equipVisual(playerId, slot, itemId, equipment, vrm);
        }

        // Clear the queue
        this.pendingEquipment.delete(playerId);
      }
    }
  }

  destroy(): void {
    this.equipmentLoadGeneration += 1;
    // Clean up all equipment
    for (const playerId of this.playerEquipment.keys()) {
      this.cleanupPlayerEquipment(playerId);
    }

    // Clear all timers
    for (const timer of this.combatWeaponRestoreTimers.values()) {
      clearTimeout(timer);
    }

    // Clear cache and pending equipment
    this.weaponCache.clear();
    this.weaponLoadPromises.clear();
    this.pendingEquipment.clear();
    this.combatWeaponRestoreTimers.clear();
    this.hiddenWeaponsCombat.clear();
    this.dynamicBowStrings.clear();
    this.stableHeldEquipmentPoses.clear();
    this.playerWeaponItemIds.clear();
    this.desiredEquipmentItemIds.clear();
    this.attachedEquipmentItemIds.clear();
    this.streamingVisualGeneration += 1;
    this.streamingVisualRequirements.clear();
    this.streamingVisualExpectations = [];
    this.streamingVisualCycleId = null;
    this.streamingVisualRequirementSignature = "";
    this.streamingVisualContractConfigured = false;

    super.destroy();
  }
}
