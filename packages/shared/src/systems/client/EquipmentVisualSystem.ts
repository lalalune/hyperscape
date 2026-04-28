/**
 * Equipment Visual System (Client-Only)
 *
 * Handles visual rendering of equipped items on player avatars using VRM bones.
 * Works with weapons exported from Asset Forge with pre-baked attachment data.
 *
 * **How It Works:**
 * 1. Listens for PLAYER_EQUIPMENT_CHANGED events
 * 2. Loads weapon GLB from Asset Forge (with userData.hyperscape metadata)
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
import { getItem } from "../../data/items";
import { AttackType } from "../../types/game/item-types";
import {
  attachEquipmentVisualToVRM,
  removeEquipmentVisual,
  resolveEquipmentVisualData,
  resolveEquipmentVisualUrls,
  type EquipmentVisualStore,
} from "./EquipmentVisualHelpers";

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
}

/** Resolve avatar from either PlayerLocal (_avatar) or PlayerRemote (avatar) */
function getAvatar(player: PlayerWithAvatar): AvatarLike | undefined {
  return player._avatar || player.avatar;
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
          | NetworkWithEquipmentCache
          | undefined;
        const cached = network?.lastEquipmentByPlayerId?.[data.playerId];
        if (cached) {
          const slots = EQUIPMENT_SLOT_NAMES;
          for (const slot of slots) {
            const slotData = cached[slot] as
              | { itemId?: string; item?: { id?: string } }
              | null
              | undefined;
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

    // OSRS-STYLE: Show gathering tool during gathering (e.g., fishing rod during fishing)
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

    // OSRS-STYLE: Hide melee weapon during magic/ranged attacks
    this.subscribe(
      EventType.COMBAT_PROJECTILE_LAUNCHED,
      (data: { attackerId: string }) => {
        this.handleCombatProjectileLaunched(data.attackerId);
      },
    );
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
    removeEquipmentVisual(equipment as EquipmentVisualStore, slotKey);
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
    vrm: VRM,
  ): Promise<void> {
    try {
      const assetsUrl = this.world.assetsUrl?.replace(/\/$/, "") || "";

      const cachedItem = this.getItemFromNetworkCache(playerId, slot);
      const itemData = resolveEquipmentVisualData({
        itemId,
        fallbackItemData: cachedItem,
      });
      const urls = resolveEquipmentVisualUrls({
        assetsUrl,
        itemId,
        slot,
        itemData,
        fallbackItemData: cachedItem,
      });

      if (!urls) {
        return;
      }

      // Check cache first
      let gltf = this.weaponCache.get(itemId);

      if (!gltf) {
        // Load through ClientLoader to benefit from IndexedDB persistent caching,
        // deduplication, and concurrency control.
        const loader = this.world.loader;
        let file: File | undefined;
        let resolvedUrl = urls.primaryUrl;
        try {
          file = loader ? await loader.loadFile(urls.primaryUrl) : undefined;
        } catch (error) {
          // Fallback to base model if fitted version not found (only for convention-based)
          if (urls.fallbackUrl) {
            file = loader ? await loader.loadFile(urls.fallbackUrl) : undefined;
            resolvedUrl = urls.fallbackUrl;
          } else {
            throw error;
          }
        }

        if (!file) {
          throw new Error(
            `[EquipmentVisual] Failed to load model: ${resolvedUrl}`,
          );
        }

        // Parse the cached bytes with GLTFLoader
        const buffer = await file.arrayBuffer();
        gltf = (await this.gltfParser.parseAsync(buffer, resolvedUrl)) as GLTF;
        this.weaponCache.set(itemId, gltf);
      }

      const weaponMesh: THREE.Object3D = gltf.scene.clone(true); // Clone to allow multiple instances

      // Get player entity for bone attachment
      const player = this.world.entities.get(playerId);
      if (!player) {
        console.error(
          `[EquipmentVisual] ❌ Player entity not found for ID: ${playerId}`,
        );
        return;
      }

      const playerWithAvatar = player as PlayerWithAvatar;
      const rawInstance = getAvatar(playerWithAvatar)?.instance?.raw;
      const avatarRoot = (rawInstance?.scene || rawInstance) as
        | THREE.Object3D
        | undefined;

      if (!avatarRoot) {
        console.error(
          `[EquipmentVisual] ❌ Could not resolve avatar root for ${playerId}`,
        );
        return;
      }

      const attached = attachEquipmentVisualToVRM({
        slot,
        modelRoot: weaponMesh,
        visuals: equipment as EquipmentVisualStore,
        vrm,
        avatarRoot,
      });

      if (!attached) {
        console.error(
          `[EquipmentVisual] ❌ Failed to attach ${itemId} to slot ${slot}`,
        );
      }
    } catch (error) {
      console.error(`[EquipmentVisual] ❌ Error equipping ${itemId}:`, error);
    }
  }

  /**
   * OSRS-STYLE: Hide melee weapon during magic/ranged attacks.
   *
   * When a non-melee projectile is launched, the attacker's equipped melee weapon
   * should be hidden for the duration of the attack animation. Staffs and bows
   * (ranged/magic attackType) are left visible since they ARE the attack weapon.
   */
  private handleCombatProjectileLaunched(attackerId: string): void {
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
    const equipment = this.playerEquipment.get(playerId);
    if (!equipment) return;

    // Remove all visuals
    for (const [_slot, visual] of Object.entries(equipment)) {
      if (visual && visual.parent) {
        visual.parent.remove(visual);
      }
    }

    this.playerEquipment.delete(playerId);
    this.pendingEquipment.delete(playerId);
    this.hiddenWeapons.delete(playerId);
    this.hiddenWeaponsCombat.delete(playerId);
    this.playerWeaponItemIds.delete(playerId);
    const timer = this.combatWeaponRestoreTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.combatWeaponRestoreTimers.delete(playerId);
    }
  }

  /**
   * OSRS-STYLE: Show gathering tool in hand during gathering animation
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

    // OSRS-STYLE: Temporarily hide the equipped weapon while showing gathering tool
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
    this.unequipVisual(playerId, "gatheringTool", equipment, vrm);

    // OSRS-STYLE: Restore the equipped weapon that was hidden
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
    this.pendingEquipment.clear();
    this.combatWeaponRestoreTimers.clear();
    this.hiddenWeaponsCombat.clear();
    this.playerWeaponItemIds.clear();

    super.destroy();
  }
}
