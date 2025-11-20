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
import * as THREE from "three";
import { EventType } from "../../types/events";
import { SystemBase } from "../shared/infrastructure/SystemBase";
import type { World } from "../../types";
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";

interface EquipmentAttachmentData {
  vrmBoneName: string; // VRM bone to attach to (e.g., "rightHand")
  originalSlot?: string; // Original Asset Forge slot
  weaponType?: string; // Weapon type for debugging
  usage?: string; // Usage instructions
  note?: string; // Developer notes
}

interface PlayerEquipmentVisuals {
  weapon?: THREE.Object3D;
  shield?: THREE.Object3D;
  helmet?: THREE.Object3D;
  // Add more slots as needed
}

export class EquipmentVisualSystem extends SystemBase {
  private loader = new GLTFLoader();
  private playerEquipment = new Map<string, PlayerEquipmentVisuals>();

  // Cache loaded weapon models to avoid reloading
  private weaponCache = new Map<string, GLTF>();

  // Queue equipment changes that are waiting for VRM to load
  private pendingEquipment = new Map<
    string,
    { slot: string; itemId: string }[]
  >();

  constructor(world: World) {
    super(world, {
      name: "equipment-visual",
      dependencies: {
        required: [],
        optional: ["player", "equipment"],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Only run on client
    if (this.world.isServer) {
      console.log("[EquipmentVisualSystem] Skipping init - running on server");
      return;
    }

    console.log("[EquipmentVisualSystem] Initializing on client");

    // Subscribe to equipment changes
    this.subscribe(EventType.PLAYER_EQUIPMENT_CHANGED, (data: any) => {
      console.log(
        "[EquipmentVisualSystem] Received PLAYER_EQUIPMENT_CHANGED:",
        data,
      );
      this.handleEquipmentChange(data);
    });

    // Clean up when player leaves
    this.subscribe(EventType.PLAYER_CLEANUP, (data: any) => {
      this.cleanupPlayerEquipment(data.playerId);
    });

    console.log(
      "[EquipmentVisualSystem] Initialized - listening for equipment changes",
    );
  }

  private async handleEquipmentChange(data: {
    playerId: string;
    slot: string;
    itemId: string | null;
  }): Promise<void> {
    const { playerId, slot, itemId } = data;

    console.log(`[EquipmentVisual] ========================================`);
    console.log(
      `[EquipmentVisual] Equipment change: player=${playerId}, slot=${slot}, itemId=${itemId}`,
    );

    // Skip invalid itemIds (only "0" is invalid, null means unequip)
    if (itemId === "0") {
      console.log(`[EquipmentVisual] ⚠️ Skipping invalid itemId: ${itemId}`);
      return;
    }

    console.log(
      `[EquipmentVisual] 🔍 Step 1 - Getting player entity from world.entities`,
    );
    // Get player entity to access VRM
    const player = this.world.entities.get(playerId);
    console.log(`[EquipmentVisual] 🔍 Step 2 - Player found:`, !!player);
    if (!player) {
      console.warn(
        `[EquipmentVisual] ❌ Player ${playerId} not found in world.entities`,
      );
      return;
    }

    console.log(
      `[EquipmentVisual] 🔍 Step 3 - Accessing VRM from player._avatar.instance.raw.userData.vrm`,
    );
    // CRITICAL: instance.raw is GLTF, VRM is in userData.vrm!
    const avatarInstance = (player as any)._avatar?.instance;
    const vrm = avatarInstance?.raw?.userData?.vrm as VRM | undefined;

    console.log(
      `[EquipmentVisual] 🔍 Step 4 - Avatar instance:`,
      !!avatarInstance,
      "VRM (raw):",
      !!vrm,
    );

    // Debug: What IS instance.raw?
    if (vrm) {
      console.log(
        `[EquipmentVisual] 🔍 Step 4.5 - VRM keys:`,
        Object.keys(vrm),
      );
      console.log(
        `[EquipmentVisual] 🔍 Step 4.6 - VRM.humanoid:`,
        vrm.humanoid,
      );
      console.log(
        `[EquipmentVisual] 🔍 Step 4.7 - VRM type:`,
        vrm.constructor?.name,
      );
    }

    if (!avatarInstance || !vrm) {
      console.warn(
        `[EquipmentVisual] ⚠️ VRM not ready yet for player ${playerId} - queuing equipment change`,
      );

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
        console.log(
          `[EquipmentVisual] Queued ${itemId} for ${slot}, queue length:`,
          filtered.length,
        );
      }

      return;
    }

    console.log(
      `[EquipmentVisual] ✅ Step 5 - Got VRM from instance.raw successfully!`,
    );

    // Get or create equipment visuals for this player
    if (!this.playerEquipment.has(playerId)) {
      this.playerEquipment.set(playerId, {});
    }
    const equipment = this.playerEquipment.get(playerId)!;

    // Handle unequip (itemId is null)
    if (!itemId) {
      console.log(`[EquipmentVisual] Unequipping ${slot}`);
      this.unequipVisual(playerId, slot, equipment, vrm);
      return;
    }

    // Handle equip - load and attach weapon
    console.log(
      `[EquipmentVisual] 🔍 Step 6 - About to call equipVisual for itemId:`,
      itemId,
    );
    await this.equipVisual(playerId, slot, itemId, equipment, vrm);
  }

  private unequipVisual(
    playerId: string,
    slot: string,
    equipment: PlayerEquipmentVisuals,
    vrm: VRM,
  ): void {
    // Remove existing visual for this slot
    const slotKey = slot.toLowerCase() as keyof PlayerEquipmentVisuals;
    const existingVisual = equipment[slotKey];

    if (existingVisual && existingVisual.parent) {
      existingVisual.parent.remove(existingVisual);
      console.log(
        `[EquipmentVisual] Unequipped ${slot} from player ${playerId}`,
      );
    }

    equipment[slotKey] = undefined;
  }

  private async equipVisual(
    playerId: string,
    slot: string,
    itemId: string,
    equipment: PlayerEquipmentVisuals,
    vrm: VRM,
  ): Promise<void> {
    console.log(`[EquipmentVisual] 🔧 equipVisual START for itemId: ${itemId}`);
    try {
      // Convert itemId to asset folder format
      // itemId format: "{material}_{item}" e.g., "steel_sword"
      // asset format: "{item}-{material}" e.g., "sword-steel"
      console.log(
        `[EquipmentVisual] 🔍 Step 7 - Converting itemId to asset format`,
      );
      let assetId = itemId.replace(/_/g, "-");

      // Check if we need to reverse the order (material_item -> item-material)
      const parts = itemId.split("_");
      if (parts.length === 2) {
        const [material, item] = parts;
        // Known materials to detect
        const materials = [
          "bronze",
          "steel",
          "mithril",
          "iron",
          "rune",
          "dragon",
          "wood",
          "oak",
          "willow",
          "yew",
        ];
        if (materials.includes(material)) {
          assetId = `${item}-${material}`;
        }
      }

      // Load weapon GLB from Hyperscape CDN assets
      // Try fitted version first (sword-steel-aligned.glb), fallback to base (sword-steel.glb)
      const assetsUrl = this.world.assetsUrl?.replace(/\/$/, "") || "";
      const weaponUrl = `${assetsUrl}/models/${assetId}/${assetId}-aligned.glb`;
      const fallbackUrl = `${assetsUrl}/models/${assetId}/${assetId}.glb`;

      console.log(
        `[EquipmentVisual] 🔍 Step 8 - Asset ID conversion: ${itemId} → ${assetId}`,
      );
      console.log(`[EquipmentVisual] Assets base URL: ${assetsUrl}`);
      console.log(`[EquipmentVisual] Trying aligned weapon: ${weaponUrl}`);
      console.log(`[EquipmentVisual] Fallback to base: ${fallbackUrl}`);

      // Check cache first
      console.log(
        `[EquipmentVisual] 🔍 Step 9 - Checking weapon cache for:`,
        itemId,
      );
      let gltf = this.weaponCache.get(itemId);
      console.log(`[EquipmentVisual] Cache hit:`, !!gltf);

      if (!gltf) {
        console.log(`[EquipmentVisual] 🔍 Step 10 - Loading GLB from URL...`);
        try {
          // Try fitted version first
          console.log(`[EquipmentVisual] Attempting to load:`, weaponUrl);
          gltf = await this.loader.loadAsync(weaponUrl);
          console.log(
            `[EquipmentVisual] ✅ Loaded aligned version successfully`,
          );
        } catch (error) {
          // Fallback to base model if fitted version not found
          console.log(
            `[EquipmentVisual] ⚠️ Fitted model not found, trying base:`,
            fallbackUrl,
          );
          console.log(`[EquipmentVisual] Error:`, error);
          gltf = await this.loader.loadAsync(fallbackUrl);
          console.log(`[EquipmentVisual] ✅ Loaded base version successfully`);
        }
        this.weaponCache.set(itemId, gltf);
      }

      console.log(`[EquipmentVisual] 🔍 Step 11 - Cloning weapon mesh`);
      let weaponMesh: THREE.Object3D = gltf.scene.clone(true); // Clone to allow multiple instances (let for reassignment)
      console.log(`[EquipmentVisual] Weapon mesh cloned:`, !!weaponMesh);
      console.log(`[EquipmentVisual] Weapon mesh name:`, weaponMesh.name);
      console.log(
        `[EquipmentVisual] Weapon mesh userData keys:`,
        Object.keys(weaponMesh.userData),
      );
      console.log(
        `[EquipmentVisual] Full weapon mesh userData:`,
        weaponMesh.userData,
      );

      // Read attachment metadata from Asset Forge export
      console.log(`[EquipmentVisual] 🔍 Step 12 - Reading attachment metadata`);
      const attachmentData = weaponMesh.userData.hyperscape as
        | EquipmentAttachmentData
        | undefined;
      console.log(`[EquipmentVisual] Attachment data:`, attachmentData);

      // Also check gltf.userData and gltf.asset for metadata
      console.log(`[EquipmentVisual] GLTF userData:`, gltf.userData);
      console.log(`[EquipmentVisual] GLTF asset:`, gltf.asset);
      console.log(
        `[EquipmentVisual] GLTF parser userData:`,
        gltf.parser?.json?.asset,
      );

      if (!attachmentData || !attachmentData.vrmBoneName) {
        console.warn(
          `[EquipmentVisual] No attachment metadata found for ${itemId}, using default (rightHand)`,
        );
      }

      const boneName = attachmentData?.vrmBoneName || "rightHand";
      console.log(`[EquipmentVisual] 🔍 Step 13 - Target bone: ${boneName}`);

      // Debug weapon structure
      console.log(`[EquipmentVisual] Weapon position:`, weaponMesh.position);
      console.log(`[EquipmentVisual] Weapon rotation:`, weaponMesh.rotation);
      console.log(`[EquipmentVisual] Weapon scale:`, weaponMesh.scale);
      console.log(
        `[EquipmentVisual] Weapon children count:`,
        weaponMesh.children.length,
      );
      weaponMesh.traverse((child) => {
        if (child !== weaponMesh) {
          console.log(
            `[EquipmentVisual]   Child: ${child.name}, type: ${child.type}, pos:`,
            child.position,
            `rot:`,
            child.rotation,
            `scale:`,
            child.scale,
          );
        }
      });

      // Get VRM bone (cast to VRMHumanBoneName for type safety)
      console.log(
        `[EquipmentVisual] 🔍 Step 14 - Getting VRM bone from humanoid`,
      );
      console.log(`[EquipmentVisual] 🔍 Step 14.1 - VRM object:`, vrm);
      console.log(
        `[EquipmentVisual] 🔍 Step 14.2 - VRM keys:`,
        vrm ? Object.keys(vrm) : "null",
      );
      console.log(
        `[EquipmentVisual] 🔍 Step 14.3 - VRM.humanoid:`,
        vrm.humanoid,
      );

      if (!vrm.humanoid) {
        console.error(
          `[EquipmentVisual] ❌ VRM has no humanoid property! VRM type:`,
          vrm.constructor?.name,
        );
        console.error(`[EquipmentVisual] ❌ Full VRM object:`, vrm);
        return;
      }

      const bone = vrm.humanoid.getNormalizedBoneNode(
        boneName as VRMHumanBoneName,
      );
      console.log(`[EquipmentVisual] Bone found:`, !!bone);
      if (!bone) {
        console.error(`[EquipmentVisual] ❌ VRM bone not found: ${boneName}`);
        return;
      }

      // Debug bone transform
      console.log(`[EquipmentVisual] Bone position:`, bone.position);
      console.log(`[EquipmentVisual] Bone rotation:`, bone.rotation);
      console.log(`[EquipmentVisual] Bone scale:`, bone.scale);
      console.log(`[EquipmentVisual] Bone world matrix:`, bone.matrixWorld);

      // Remove existing visual for this slot first
      console.log(`[EquipmentVisual] 🔍 Step 15 - Unequipping existing visual`);
      this.unequipVisual(playerId, slot, equipment, vrm);

      // CRITICAL: Asset Forge exports have transforms baked into the hierarchy
      // Find the EquipmentWrapper child which has the fitting position
      let equipmentWrapper = weaponMesh.children.find(
        (child) => child.name === "EquipmentWrapper",
      );

      if (equipmentWrapper) {
        console.log(
          `[EquipmentVisual] ✅ Found EquipmentWrapper - using Asset Forge fitting`,
        );
        console.log(
          `[EquipmentVisual] Original EquipmentWrapper position:`,
          equipmentWrapper.position,
        );

        // TRUST THE BAKED TRANSFORMS!
        // Previous logic attempted to re-scale position based on NormalizedWeapon scale
        // and apply a 180 degree rotation. This contradicted the "baked" nature of the export.
        // We now use the EquipmentWrapper exactly as is.

        // TWEAK: Apply a scale multiplier to make weapons look better in-game
        const WEAPON_SCALE_MULTIPLIER = 1.75;
        weaponMesh.scale.multiplyScalar(WEAPON_SCALE_MULTIPLIER);
      } else if (!attachmentData) {
        console.warn(
          `[EquipmentVisual] ⚠️ No EquipmentWrapper or metadata - applying default transform`,
        );
        // Fallback: Scale down to reasonable size
        weaponMesh.scale.set(0.01, 0.01, 0.01);
      }

      // --- ATTACHMENT LOGIC ---
      // We attach to the RAW BONE to match the Asset Forge export pipeline.
      // CRITICAL: VRM instances are often shared/prefab-based, so `vrm.humanoid.getRawBoneNode`
      // might return a bone from the PREFAB, not the live player instance.
      // We must find the corresponding bone in the PLAYER'S hierarchy.

      const player = this.world.entities.get(playerId);
      if (!player) {
        console.error(
          `[EquipmentVisual] ❌ Player entity not found for ID: ${playerId}`,
        );
        return;
      }

      const prefabBone = vrm.humanoid.getRawBoneNode(
        boneName as VRMHumanBoneName,
      );
      if (!prefabBone) {
        console.error(
          `[EquipmentVisual] ❌ VRM bone not found in prefab: ${boneName}`,
        );
        return;
      }

      const targetBoneName = prefabBone.name;
      let targetBone: THREE.Object3D | undefined = undefined;

      // Traverse the avatar's visual root (instance.raw) to find the bone
      // player.node is just a container and might not hold the full hierarchy
      // instance.raw might be the GLTF result object or VRM object, so check for .scene
      const rawInstance = (player as any)._avatar?.instance?.raw;
      const avatarRoot = (rawInstance?.scene || rawInstance) as THREE.Object3D;

      if (avatarRoot && avatarRoot.traverse) {
        console.log(
          `[EquipmentVisual] 🔍 Searching for bone '${targetBoneName}' in avatarRoot (ID: ${avatarRoot.id}, Name: "${avatarRoot.name}")`,
        );
        avatarRoot.traverse((child) => {
          if (child.name === targetBoneName) {
            targetBone = child;
          }
        });
      } else {
        console.error(
          `[EquipmentVisual] ❌ avatarRoot is not traversable!`,
          rawInstance,
        );
        if (player.node) {
          console.log(`[EquipmentVisual] ⚠️ Fallback to player.node`);
          player.node.traverse((child) => {
            if (child.name === targetBoneName) {
              targetBone = child;
            }
          });
        }
      }

      if (!targetBone) {
        console.error(
          `[EquipmentVisual] ❌ Could not find bone '${targetBoneName}' in avatar hierarchy`,
        );
        return;
      }

      // Store in component for tracking
      const slotKey = slot.toLowerCase() as keyof PlayerEquipmentVisuals;
      equipment[slotKey] = weaponMesh;

      // Add to the LIVE bone
      (targetBone as THREE.Object3D).add(weaponMesh);

      console.log(
        `✅ [EquipmentVisual] Attached ${itemId} to ${targetBoneName}`,
      );

      if (attachmentData?.usage) {
        console.log(`   ${attachmentData.usage}`);
      }
    } catch (error) {
      console.error(
        `[EquipmentVisual] ❌ EXCEPTION in equipVisual for ${itemId}:`,
      );
      console.error(error);
      if (error instanceof Error) {
        console.error(`[EquipmentVisual] Error message:`, error.message);
        console.error(`[EquipmentVisual] Error stack:`, error.stack);
      }
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
    this.pendingEquipment.delete(playerId); // Clear pending equipment too
    console.log(
      `[EquipmentVisual] Cleaned up equipment for player ${playerId}`,
    );
  }

  update(_dt: number): void {
    // Process pending equipment for players whose VRM has now loaded
    if (this.pendingEquipment.size > 0) {
      console.log(
        `[EquipmentVisual] update() called, pending equipment for ${this.pendingEquipment.size} players`,
      );
    }

    for (const [playerId, pendingItems] of this.pendingEquipment.entries()) {
      console.log(
        `[EquipmentVisual] Checking player ${playerId} with ${pendingItems.length} pending items`,
      );
      if (pendingItems.length === 0) continue;

      const player = this.world.entities.get(playerId);
      console.log(`[EquipmentVisual] Player entity exists:`, !!player);
      if (!player) {
        // Player is gone, clear queue
        console.log(`[EquipmentVisual] ❌ Player gone, clearing queue`);
        this.pendingEquipment.delete(playerId);
        continue;
      }

      const avatar = (player as any)._avatar;
      console.log(`[EquipmentVisual] _avatar object:`, avatar);
      console.log(
        `[EquipmentVisual] _avatar keys:`,
        avatar ? Object.keys(avatar) : "null",
      );

      const avatarInstance = avatar?.instance;
      console.log(`[EquipmentVisual] _avatar.instance:`, avatarInstance);
      console.log(
        `[EquipmentVisual] _avatar.instance keys:`,
        avatarInstance ? Object.keys(avatarInstance) : "null",
      );

      // CRITICAL: instance.raw is GLTF, VRM is in userData.vrm!
      const vrm = avatarInstance?.raw?.userData?.vrm as VRM | undefined;
      const hasVrm = !!(avatarInstance && vrm);
      console.log(
        `[EquipmentVisual] VRM check - instance:`,
        !!avatarInstance,
        "vrm (raw):",
        !!vrm,
        "ready:",
        hasVrm,
      );

      if (avatarInstance && vrm) {
        console.log(
          `[EquipmentVisual] ✅ VRM now ready for player ${playerId}! Processing ${pendingItems.length} pending equipment changes`,
        );

        // VRM is now ready! Process all pending equipment

        // Get or create equipment visuals for this player
        if (!this.playerEquipment.has(playerId)) {
          this.playerEquipment.set(playerId, {});
        }
        const equipment = this.playerEquipment.get(playerId)!;

        // Process each pending item
        for (const { slot, itemId } of pendingItems) {
          console.log(
            `[EquipmentVisual] Processing queued equipment: ${itemId} in ${slot}`,
          );
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

    // Clear cache and pending equipment
    this.weaponCache.clear();
    this.pendingEquipment.clear();

    super.destroy();
  }
}
