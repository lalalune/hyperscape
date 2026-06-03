/**
 * MobVisualManager - Manages visual/mesh/animation concerns for MobEntity.
 *
 * Extracted from MobEntity to separate visual/rendering concerns from game logic.
 * Handles VRM model loading, GLB model loading, raycast proxy creation,
 * animation setup, and emote management.
 *
 * **Pattern**: Plain class (not a System subclass).
 * Constructor takes a MobVisualContext interface that bridges back to the entity.
 */

import * as THREE from "../../extras/three/three";
import type { MeshUserData } from "../../types";
import type { MobEntityConfig } from "../../types/entities";
import { MobAIState } from "../../types/entities";
import type { World } from "../../core/World";
import { modelCache } from "../../utils/rendering/ModelCache";
import type {
  VRMAvatarInstance,
  LoadedAvatar,
} from "../../types/rendering/nodes";
import { Emotes } from "../../data/playerEmotes";
import { TICK_DURATION_MS } from "../../systems/shared/movement/TileSystem";
import { RAYCAST_PROXY } from "../../systems/client/interaction/constants";
import { COMBAT_CONSTANTS } from "../../constants/CombatConstants";
import { getNPCById } from "../../data/npcs";
import { GLTFLoader } from "../../libs/gltfloader/GLTFLoader";

/**
 * Context interface that MobVisualManager uses to interact with MobEntity.
 * Avoids needing direct access to private entity fields.
 */
export interface MobVisualContext {
  /** The world instance for accessing systems, loader, stage, etc. */
  world: World;
  /** Mob configuration (read-only access to relevant fields) */
  config: MobEntityConfig;
  /** Entity ID */
  id: string;
  /** The entity's scene graph node (for adding children, reading position/matrix) */
  node: THREE.Object3D;
  /** Get the current mesh from the entity */
  getMesh(): THREE.Object3D | null;
  /** Set the mesh on the entity */
  setMesh(mesh: THREE.Object3D | null): void;
}

export class MobVisualManager {
  /** Shared GLTFLoader instance for parsing weapon model bytes (avoids per-spawn instantiation) */
  private static _weaponParser: GLTFLoader | null = null;
  /**
   * Cache loaded GLTF scenes by URL — avoids duplicate network requests and geometry.
   * Entries persist for the lifetime of the world. clearWeaponCache() is called from
   * MobNPCSpawnerSystem.destroy() during world teardown to free GPU resources.
   */
  private static _weaponCache = new Map<string, THREE.Object3D>();
  /** In-flight load promises — deduplicates concurrent fetches for the same URL */
  private static _pendingLoads = new Map<string, Promise<THREE.Object3D>>();

  /** Clear weapon cache — call during world teardown to free GPU/memory resources */
  static clearWeaponCache(): void {
    MobVisualManager._pendingLoads.clear();
    for (const scene of MobVisualManager._weaponCache.values()) {
      scene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          for (const mat of materials) {
            const stdMat = mat as THREE.MeshStandardMaterial;
            if (stdMat.map) stdMat.map.dispose();
            if (stdMat.normalMap) stdMat.normalMap.dispose();
            if (stdMat.emissiveMap) stdMat.emissiveMap.dispose();
            stdMat.dispose();
          }
        }
      });
    }
    MobVisualManager._weaponCache.clear();
    MobVisualManager._weaponParser = null;
  }

  // ─── Visual state (moved from MobEntity) ─────────────────────────
  private _avatarInstance: VRMAvatarInstance | null = null;
  private _currentEmote: string | null = null;
  private _pendingServerEmote: string | null = null;
  private _manualEmoteOverrideUntil: number = 0;
  private _raycastProxy: THREE.Mesh | null = null;
  private _heldWeapon: THREE.Object3D | null = null;
  private _destroyed = false;

  // GLB animation state (was stored via type casts on MobEntity)
  private _mixer: THREE.AnimationMixer | null = null;
  private _animationClips: {
    idle?: THREE.AnimationClip;
    walk?: THREE.AnimationClip;
    run?: THREE.AnimationClip;
  } = {};
  private _currentAction: THREE.AnimationAction | null = null;

  /** Emote name to URL mapping - pre-allocated to avoid allocation in hot path */
  private readonly _emoteMap: Record<string, string> = {
    idle: Emotes.IDLE,
    walk: Emotes.WALK,
    run: Emotes.RUN,
    combat: Emotes.COMBAT,
    range: Emotes.RANGE,
    spell_cast: Emotes.SPELL_CAST,
    sword_swing: Emotes.SWORD_SWING,
    "2h_idle": Emotes.TWO_HAND_IDLE,
    "2h_slash": Emotes.TWO_HAND_SLASH,
    death: Emotes.DEATH,
    victory: Emotes.VICTORY,
  };

  /** Duration of death animation in ticks (7 ticks = 4200ms at 600ms/tick) */
  private readonly DEATH_ANIMATION_TICKS = 7;

  constructor(private ctx: MobVisualContext) {}

  // ─── Public accessors ─────────────────────────────────────────────

  /** Get the VRM avatar instance (needed by clientUpdate for animation) */
  getAvatarInstance(): VRMAvatarInstance | null {
    return this._avatarInstance;
  }

  /** Get the current emote URL */
  getCurrentEmote(): string | null {
    return this._currentEmote;
  }

  /** Set the current emote (used by clientUpdate to track state) */
  setCurrentEmote(emote: string | null): void {
    this._currentEmote = emote;
  }

  /** Get the pending server emote (received before VRM loaded) */
  getPendingServerEmote(): string | null {
    return this._pendingServerEmote;
  }

  /** Set the pending server emote */
  setPendingServerEmote(emote: string | null): void {
    this._pendingServerEmote = emote;
  }

  /** Get the manual emote override timestamp */
  getManualEmoteOverrideUntil(): number {
    return this._manualEmoteOverrideUntil;
  }

  /** Set the manual emote override timestamp */
  setManualEmoteOverrideUntil(until: number): void {
    this._manualEmoteOverrideUntil = until;
  }

  /** Get the raycast proxy mesh */
  getRaycastProxy(): THREE.Mesh | null {
    return this._raycastProxy;
  }

  /** Get the GLB animation mixer (used by clientUpdate) */
  getMixer(): THREE.AnimationMixer | null {
    return this._mixer;
  }

  // ─── Mesh creation (extracted from MobEntity.createMesh) ──────────

  /**
   * Create the 3D mesh for this mob.
   * On server, does nothing. On client, creates raycast proxy first,
   * then loads VRM or GLB model in background.
   */
  async createMesh(): Promise<void> {
    if (this.ctx.world.isServer) {
      return;
    }

    // Create placeholder hitbox for immediate click detection before VRM loads
    this.createRaycastProxy();

    // Load 3D model in background (non-blocking)
    if (this.ctx.config.model && this.ctx.world.loader) {
      try {
        // Check if this is a VRM file
        if (this.ctx.config.model.endsWith(".vrm")) {
          // Fire-and-forget VRM loading - placeholder is already functional
          // If VRM loads successfully, it will replace the placeholder
          // If VRM fails, the placeholder remains functional (invisible but clickable)
          this.loadVRMModelAsync().catch((err) => {
            console.warn(
              `[MobVisualManager] VRM loading failed for ${this.ctx.config.mobType}, using placeholder:`,
              err instanceof Error ? err.message : err,
            );
            // Placeholder is already in place - mob remains functional
          });
          return; // Mesh is set (placeholder), VRM loading continues in background
        }

        // Otherwise load as GLB (existing code path)
        const { scene, animations } = await modelCache.loadModel(
          this.ctx.config.model,
          this.ctx.world,
        );

        // GLB loaded successfully - keep raycast proxy for performance
        const mesh = scene;
        mesh.name = `Mob_${this.ctx.config.mobType}_${this.ctx.id}`;

        // Scale root mesh (cm to meters) and apply manifest scale
        const modelScale = 100; // cm to meters
        const configScale = this.ctx.config.scale;
        mesh.scale.set(
          modelScale * configScale.x,
          modelScale * configScale.y,
          modelScale * configScale.z,
        );
        mesh.updateMatrix();
        mesh.updateMatrixWorld(true);

        // NOW bind the skeleton at the scaled size and set layer for minimap exclusion
        mesh.layers.set(1); // Main camera only, not minimap
        mesh.traverse((child) => {
          // PERFORMANCE: Set all children to layer 1 (minimap only sees layer 0)
          child.layers.set(1);
          // PERFORMANCE: Disable raycasting on GLB meshes - use _raycastProxy instead
          child.raycast = () => {};

          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            // Ensure mesh matrix is updated
            child.updateMatrix();
            child.updateMatrixWorld(true);

            // Bind skeleton with DetachedBindMode (like VRM)
            child.bindMode = THREE.DetachedBindMode;
            child.bindMatrix.copy(child.matrixWorld);
            child.bindMatrixInverse.copy(child.bindMatrix).invert();
          }
        });

        // Set up userData for interaction detection
        const userData: MeshUserData = {
          type: "mob",
          entityId: this.ctx.id,
          name: this.ctx.config.name,
          interactable: true,
          mobData: {
            id: this.ctx.id,
            name: this.ctx.config.name,
            type: this.ctx.config.mobType,
            level: this.ctx.config.level,
            health: this.ctx.config.currentHealth,
            maxHealth: this.ctx.config.maxHealth,
          },
        };
        mesh.userData = { ...userData };

        // Add as child of node (standard approach with correct scale)
        // Position is relative to node, so keep it at origin
        mesh.position.set(0, 0, 0);
        mesh.quaternion.identity();
        this.ctx.node.add(mesh);
        this.ctx.setMesh(mesh);

        // Always try to load external animations (most mobs use separate files)
        await this.loadIdleAnimation();

        // Also try inline animations if they exist
        if (animations.length > 0) {
          if (!this._mixer) {
            await this.setupAnimations(animations);
          }
        }

        return;
      } catch (error) {
        console.warn(
          `[MobVisualManager] Failed to load model for ${this.ctx.config.mobType}, using placeholder:`,
          error,
        );
        // Fall through to visible placeholder
      }
    }

    // No model available - create visible placeholder capsule
    // Remove invisible placeholder (if it's still the current mesh)
    if (this.ctx.getMesh() === this._raycastProxy) {
      this.destroyRaycastProxy();
    }

    const mobName = String(this.ctx.config.mobType).toLowerCase();
    const colorHash = mobName
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = (colorHash % 360) / 360;
    const color = new THREE.Color().setHSL(hue, 0.6, 0.4);

    const configScale = this.ctx.config.scale;
    const geometry = new THREE.CapsuleGeometry(
      0.4 * configScale.x,
      1.6 * configScale.y,
      4,
      8,
    );
    // Use MeshStandardMaterial for proper lighting (responds to sun, moon, and environment maps)
    // Add subtle emissive so mobs pop at night (matches player rendering)
    const emissiveColor = color.clone();
    const material = new THREE.MeshStandardMaterial({
      color: color.getHex(),
      emissive: emissiveColor,
      emissiveIntensity: 0.3, // Subtle glow - matches PlayerEntity and VRM avatars
      roughness: 0.8,
      metalness: 0.0,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Mob_${this.ctx.config.mobType}_${this.ctx.id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Set up userData with proper typing for mob
    const userData: MeshUserData = {
      type: "mob",
      entityId: this.ctx.id,
      name: this.ctx.config.name,
      interactable: true,
      mobData: {
        id: this.ctx.id,
        name: this.ctx.config.name,
        type: this.ctx.config.mobType,
        level: this.ctx.config.level,
        health: this.ctx.config.currentHealth,
        maxHealth: this.ctx.config.maxHealth,
      },
    };
    mesh.userData = { ...userData };

    // Add mesh to node so it appears in the scene
    this.ctx.node.add(mesh);
    this.ctx.setMesh(mesh);

    // Health bar is created by Entity base class
  }

  // ─── VRM model loading ────────────────────────────────────────────

  /**
   * Load VRM model and create avatar instance.
   */
  private async loadVRMModel(): Promise<void> {
    // LOGGING: No more silent failures - log all early returns
    if (!this.ctx.world.loader) {
      console.warn(
        `[MobVisualManager] ${this.ctx.id}: No world.loader available for VRM loading`,
      );
      return;
    }
    if (!this.ctx.config.model) {
      console.warn(
        `[MobVisualManager] ${this.ctx.id}: No model path configured`,
      );
      return;
    }
    if (!this.ctx.world.stage?.scene) {
      console.warn(
        `[MobVisualManager] ${this.ctx.id}: No world.stage.scene available`,
      );
      return;
    }

    // Create VRM hooks with scene reference (CRITICAL for visibility!)
    const vrmHooks = {
      scene: this.ctx.world.stage.scene,
      octree: this.ctx.world.stage?.octree,
      camera: this.ctx.world.camera,
      loader: this.ctx.world.loader,
    };

    // Load the VRM avatar using the same loader as players
    const src = (await this.ctx.world.loader.load(
      "avatar",
      this.ctx.config.model,
    )) as LoadedAvatar;

    // Convert to nodes
    const nodeMap = src.toNodes(vrmHooks);
    const avatarNode = nodeMap.get("avatar") || nodeMap.get("root");

    if (!avatarNode) {
      console.warn(
        `[MobVisualManager] ${this.ctx.id}: No avatar/root node found in VRM for ${this.ctx.config.model}`,
      );
      return;
    }

    // Get the factory from the avatar node
    const avatarNodeWithFactory = avatarNode as {
      factory?: {
        create: (matrix: THREE.Matrix4, hooks?: unknown) => VRMAvatarInstance;
      };
    };

    if (!avatarNodeWithFactory?.factory) {
      console.warn(
        `[MobVisualManager] ${this.ctx.id}: No VRM factory found on avatar node for ${this.ctx.config.model}`,
      );
      return;
    }

    // Update our node's transform
    this.ctx.node.updateMatrix();
    this.ctx.node.updateMatrixWorld(true);

    // Create the VRM instance using the factory
    this._avatarInstance = avatarNodeWithFactory.factory.create(
      this.ctx.node.matrixWorld,
      vrmHooks,
    );
    if (!this._avatarInstance) {
      console.warn(
        `[MobVisualManager] ${this.ctx.id}: VRM factory.create() returned null for ${this.ctx.config.model}`,
      );
      return;
    }

    // Check for pending emote that arrived before VRM loaded
    if (this._pendingServerEmote) {
      // Apply the pending emote using the same logic as modify()
      this.applyServerEmote(this._pendingServerEmote);
      this._pendingServerEmote = null;
    } else {
      // Set initial emote to idle
      this._currentEmote = Emotes.IDLE;
      this._avatarInstance.setEmote(this._currentEmote);
    }

    // NOTE: Don't register VRM instance as hot - the MobEntity itself is registered
    // The entity's clientUpdate() will call avatarInstance.update()

    // Get the scene from the VRM instance
    const instanceWithRaw = this._avatarInstance as {
      raw?: { scene?: THREE.Object3D };
    };
    if (instanceWithRaw?.raw?.scene) {
      const mesh = instanceWithRaw.raw.scene;
      mesh.name = `Mob_VRM_${this.ctx.config.mobType}_${this.ctx.id}`;

      // PERFORMANCE: Set VRM mesh to layer 1 (main camera only, not minimap)
      // Minimap only renders terrain and uses 2D dots for entities
      mesh.layers.set(1);
      mesh.traverse((child) => {
        child.layers.set(1);
        // PERFORMANCE: Disable raycasting on VRM meshes - use _raycastProxy instead
        // SkinnedMesh raycast is extremely slow (~700-1800ms) because THREE.js
        // must transform every vertex by bone weights. The capsule proxy is instant.
        child.raycast = () => {};
      });

      // Apply manifest scale on top of VRM's height normalization
      // VRM is auto-normalized to 1.6m, so scale 2.0 = 3.2m tall
      const configScale = this.ctx.config.scale;
      mesh.scale.set(
        mesh.scale.x * configScale.x,
        mesh.scale.y * configScale.y,
        mesh.scale.z * configScale.z,
      );

      // Set up userData for interaction detection
      const userData: MeshUserData = {
        type: "mob",
        entityId: this.ctx.id,
        name: this.ctx.config.name,
        interactable: true,
        mobData: {
          id: this.ctx.id,
          name: this.ctx.config.name,
          type: this.ctx.config.mobType,
          level: this.ctx.config.level,
          health: this.ctx.config.currentHealth,
          maxHealth: this.ctx.config.maxHealth,
        },
      };
      mesh.userData = { ...userData };

      // VRM instances manage their own positioning via move() - do NOT parent to node
      // The factory already added the scene to world.stage.scene
      // We'll use avatarInstance.move() to position it each frame
      this.ctx.setMesh(mesh);

      // Attach held weapon (e.g., bow for ranged mobs) after VRM is ready
      this.attachHeldWeapon();
    } else {
      console.error(
        `[MobVisualManager] No scene in VRM instance for ${this.ctx.config.mobType}`,
      );
    }
  }

  /**
   * Attach a held weapon model (e.g., bow) to the mob's VRM hand bone.
   * Uses the same GLB attachment metadata format as EquipmentVisualSystem.
   */
  private attachHeldWeapon(): void {
    const npcData = getNPCById(this.ctx.config.mobType);
    const weaponModel = npcData?.appearance.heldWeaponModel;
    if (!weaponModel) return;
    if (!weaponModel.startsWith("asset://")) return;

    const assetsUrl = this.ctx.world.assetsUrl?.replace(/\/$/, "") || "";
    if (!assetsUrl) return;

    const weaponUrl = weaponModel.replace("asset://", `${assetsUrl}/`);

    // Load weapon GLB — cache by URL to avoid duplicate network requests.
    // Each mob clones from the cached scene so geometry/materials are shared.
    // Uses _pendingLoads to deduplicate concurrent fetches for the same URL.
    // Now routes through ClientLoader.loadFile() for IndexedDB persistent caching.
    const cached = MobVisualManager._weaponCache.get(weaponUrl);
    let loadPromise: Promise<THREE.Object3D>;
    if (cached) {
      loadPromise = Promise.resolve(cached);
    } else {
      let pending = MobVisualManager._pendingLoads.get(weaponUrl);
      if (!pending) {
        const clientLoader = this.ctx.world.loader;
        if (!MobVisualManager._weaponParser) {
          MobVisualManager._weaponParser = new GLTFLoader();
        }
        const parser = MobVisualManager._weaponParser;

        pending = (async () => {
          try {
            let buffer: ArrayBuffer;
            if (clientLoader) {
              // Use ClientLoader for IndexedDB caching, deduplication, concurrency control
              const file = await clientLoader.loadFile(weaponUrl);
              if (!file) throw new Error(`Failed to load weapon: ${weaponUrl}`);
              buffer = await file.arrayBuffer();
            } else {
              // Fallback: direct fetch if no ClientLoader available
              const res = await fetch(weaponUrl);
              buffer = await res.arrayBuffer();
            }
            const gltf = await parser.parseAsync(buffer, weaponUrl);
            MobVisualManager._weaponCache.set(weaponUrl, gltf.scene);
            MobVisualManager._pendingLoads.delete(weaponUrl);
            return gltf.scene;
          } catch (err) {
            MobVisualManager._pendingLoads.delete(weaponUrl);
            throw err;
          }
        })();
        MobVisualManager._pendingLoads.set(weaponUrl, pending);
      }
      loadPromise = pending;
    }

    loadPromise
      .then((scene) => {
        // Bail if mob was destroyed while loading
        if (this._destroyed || !this._avatarInstance) return;

        const weaponMesh = scene.clone(true);

        // Read attachment metadata from Asset Forge export
        type AttachmentMeta = {
          vrmBoneName?: string;
          version?: number;
          relativeMatrix?: number[];
        };
        let attachmentData = weaponMesh.userData.hyperia as
          | AttachmentMeta
          | undefined;
        if (!attachmentData && weaponMesh.children[0]?.userData?.hyperia) {
          attachmentData = weaponMesh.children[0].userData
            .hyperia as AttachmentMeta;
        }

        const boneName = attachmentData?.vrmBoneName || "rightHand";

        // Access VRM humanoid for bone lookup
        const instanceRaw = this._avatarInstance as {
          raw?: {
            scene?: THREE.Object3D;
            userData?: {
              vrm?: {
                humanoid?: {
                  getRawBoneNode: (name: string) => THREE.Object3D | null;
                };
              };
            };
          };
        };

        const vrm = instanceRaw.raw?.userData?.vrm;
        if (!vrm?.humanoid) return;

        const prefabBone = vrm.humanoid.getRawBoneNode(boneName);
        if (!prefabBone) return;

        // Find the bone in the live avatar hierarchy
        // Re-check _avatarInstance in case mob was destroyed during bone lookup
        const avatarScene = instanceRaw.raw?.scene;
        if (!avatarScene || !this._avatarInstance) return;

        let targetBone: THREE.Object3D | undefined;
        avatarScene.traverse((child) => {
          if (child.name === prefabBone.name) {
            targetBone = child;
          }
        });
        if (!targetBone) return;

        // Set weapon to same layer as VRM mesh (layer 1 = main camera only)
        weaponMesh.layers.set(1);
        weaponMesh.traverse((child) => {
          child.layers.set(1);
        });

        // Attach using V2 format (pre-baked relativeMatrix) or direct
        const hasValidMatrix =
          attachmentData?.version === 2 &&
          Array.isArray(attachmentData.relativeMatrix) &&
          attachmentData.relativeMatrix.length === 16;

        if (hasValidMatrix) {
          const equipmentWrapper = weaponMesh.children.find(
            (child) => child.name === "EquipmentWrapper",
          );

          if (equipmentWrapper) {
            targetBone.add(weaponMesh);
            this._heldWeapon = weaponMesh;
          } else {
            const relativeMatrix = new THREE.Matrix4();
            relativeMatrix.fromArray(attachmentData!.relativeMatrix!);

            const wrapperGroup = new THREE.Group();
            wrapperGroup.name = "MobWeaponWrapper";
            const position = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            relativeMatrix.decompose(position, quaternion, scale);
            wrapperGroup.position.copy(position);
            wrapperGroup.quaternion.copy(quaternion);
            wrapperGroup.scale.copy(scale);
            wrapperGroup.add(weaponMesh);

            targetBone.add(wrapperGroup);
            this._heldWeapon = wrapperGroup;
          }
        } else {
          targetBone.add(weaponMesh);
          this._heldWeapon = weaponMesh;
        }
      })
      .catch((err) => {
        console.error(
          `[MobVisualManager] Failed to load held weapon for ${this.ctx.config.mobType}:`,
          err,
        );
      });
  }

  /**
   * Load VRM model asynchronously (background loading).
   * PERFORMANCE: Keeps raycast proxy for fast click detection after VRM loads.
   * This is the non-blocking wrapper for loadVRMModel() used by createMesh().
   */
  private async loadVRMModelAsync(): Promise<void> {
    try {
      await this.loadVRMModel();
      // PERFORMANCE: Keep raycast proxy - don't remove it
      // VRM meshes have raycast disabled in loadVRMModel()
    } catch (err) {
      // Log and re-throw so caller's catch block fires
      console.error(
        `[MobVisualManager] VRM load error for ${this.ctx.id}:`,
        err,
      );
      throw err;
    }
  }

  // ─── Animation setup ──────────────────────────────────────────────

  /**
   * Setup animations from GLB data (inline animations)
   */
  private async setupAnimations(
    animations: THREE.AnimationClip[],
  ): Promise<void> {
    const mesh = this.ctx.getMesh();
    if (!mesh || animations.length === 0) {
      console.warn(
        `[MobVisualManager] Cannot setup animations - no mesh or no animations`,
      );
      return;
    }

    // Find the SkinnedMesh to apply animation to
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    mesh.traverse((child) => {
      if (!skinnedMesh && (child as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMesh = child as THREE.SkinnedMesh;
      }
    });

    if (!skinnedMesh) {
      console.warn(
        `[MobVisualManager] No SkinnedMesh found in model for animations`,
      );
      return;
    }

    // Create AnimationMixer on SkinnedMesh (required for DetachedBindMode)
    const mixer = new THREE.AnimationMixer(skinnedMesh);

    // Store all animation clips for state-based switching
    const animationClips: {
      idle?: THREE.AnimationClip;
      walk?: THREE.AnimationClip;
    } = {};

    // Categorize animations by name
    for (const clip of animations) {
      const nameLower = clip.name.toLowerCase();
      if (nameLower.includes("idle") || nameLower.includes("standing")) {
        animationClips.idle = clip;
      } else if (nameLower.includes("walk") || nameLower.includes("move")) {
        animationClips.walk = clip;
      }
    }

    // Default to first animation if no categorized animations found
    if (!animationClips.idle && !animationClips.walk) {
      animationClips.idle = animations[0];
    }

    // Play idle animation by default (or walk if idle doesn't exist)
    const initialClip =
      animationClips.idle || animationClips.walk || animations[0];
    const action = mixer.clipAction(initialClip);
    action.enabled = true;
    action.setEffectiveWeight(1.0);
    action.setLoop(THREE.LoopRepeat, Infinity); // Loop animation indefinitely
    action.play();

    // Store mixer and clips
    this._mixer = mixer;
    this._animationClips = animationClips;
    this._currentAction = action;
  }

  /**
   * Load external animation files (walking.glb, running.glb, etc.)
   * These are custom animations made specifically for the mob models
   */
  private async loadIdleAnimation(): Promise<void> {
    const mesh = this.ctx.getMesh();
    if (!mesh || !this.ctx.world.loader) {
      return;
    }

    const modelPath = this.ctx.config.model;
    if (!modelPath) return;

    const modelDir = modelPath.substring(0, modelPath.lastIndexOf("/"));

    // EXPECT: Model has SkinnedMesh
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    mesh.traverse((child) => {
      if (!skinnedMesh && (child as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMesh = child as THREE.SkinnedMesh;
      }
    });

    if (!skinnedMesh) {
      throw new Error(
        `[MobVisualManager] No SkinnedMesh in model: ${this.ctx.config.mobType} (${modelPath})`,
      );
    }

    // Create AnimationMixer on SkinnedMesh (required for DetachedBindMode)
    const mixer = new THREE.AnimationMixer(skinnedMesh);
    const animationClips: {
      idle?: THREE.AnimationClip;
      walk?: THREE.AnimationClip;
      run?: THREE.AnimationClip;
    } = {};

    // Load animation files (load as raw GLB, not emote, to avoid bone remapping)
    const animFiles = [
      { name: "walk", path: `${modelDir}/animations/walking.glb` },
      { name: "run", path: `${modelDir}/animations/running.glb` },
    ];

    for (const { name, path } of animFiles) {
      try {
        // Load as model (not emote) to get raw animations without VRM retargeting
        const result = await modelCache.loadModel(path, this.ctx.world);
        if (result.animations && result.animations.length > 0) {
          const clip = result.animations[0];
          animationClips[name as "walk" | "run"] = clip;
          if (name === "walk") animationClips.idle = clip; // Use walk as idle
        }
      } catch (_err) {
        // Animation file not found - skip
      }
    }

    // EXPECT: At least one clip loaded
    const initialClip = animationClips.idle || animationClips.walk;
    if (!initialClip) {
      throw new Error(
        `[MobVisualManager] NO CLIPS: ${this.ctx.config.mobType}\n` +
          `  Dir: ${modelDir}/animations/\n` +
          `  Result: idle=${!!animationClips.idle}, walk=${!!animationClips.walk}, run=${!!animationClips.run}`,
      );
    }

    const action = mixer.clipAction(initialClip);
    action.enabled = true;
    action.setEffectiveWeight(1.0);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();

    // Store mixer and clips
    this._mixer = mixer;
    this._animationClips = animationClips;
    this._currentAction = action;

    // EXPECT: Action running after play()
    if (!action.isRunning()) {
      throw new Error(
        `[MobVisualManager] ACTION NOT RUNNING: ${this.ctx.config.mobType}`,
      );
    }
  }

  // ─── Raycast proxy ────────────────────────────────────────────────

  /**
   * Create an invisible raycast proxy for fast click detection.
   *
   * PERFORMANCE: VRM SkinnedMesh raycast is extremely slow (~700-1800ms) because
   * THREE.js must transform every vertex by bone weights. This simple capsule
   * is instant and stays for the entity's lifetime.
   *
   * IMMEDIATE INTERACTION: Also ensures the mob is interactive BEFORE VRM loads.
   * RuneScape-style: entity is functional immediately, visuals are secondary.
   */
  createRaycastProxy(): void {
    // Skip on server - no visuals needed
    if (this.ctx.world.isServer) return;

    // Create invisible capsule geometry matching mob's expected size
    // Use manifest scale to size placeholder appropriately
    const configScale = this.ctx.config.scale;
    const baseRadius = RAYCAST_PROXY.BASE_RADIUS * configScale.x;
    const baseHeight = RAYCAST_PROXY.TALL_HEIGHT * configScale.y;

    const geometry = new THREE.CapsuleGeometry(
      baseRadius,
      baseHeight,
      RAYCAST_PROXY.CAP_SEGMENTS,
      RAYCAST_PROXY.HEIGHT_SEGMENTS,
    );
    const material = new THREE.MeshBasicMaterial({
      visible: false, // Invisible - only for click detection
      transparent: true,
      opacity: 0,
    });

    const hitbox = new THREE.Mesh(geometry, material);
    hitbox.name = `Mob_Hitbox_${this.ctx.config.mobType}_${this.ctx.id}`;

    // CRITICAL: Set up userData for click detection (same as VRM/GLB mesh)
    const userData: MeshUserData = {
      type: "mob",
      entityId: this.ctx.id,
      name: this.ctx.config.name,
      interactable: true,
      mobData: {
        id: this.ctx.id,
        name: this.ctx.config.name,
        type: this.ctx.config.mobType,
        level: this.ctx.config.level,
        health: this.ctx.config.currentHealth,
        maxHealth: this.ctx.config.maxHealth,
      },
    };
    hitbox.userData = { ...userData };

    // Store reference for cleanup in destroy()
    this._raycastProxy = hitbox;

    // Add to node so it's in the scene and raycastable
    this.ctx.node.add(hitbox);

    // CRITICAL: Set as this.mesh so existing systems work immediately
    // When VRM loads, this.mesh will be replaced with the VRM scene
    this.ctx.setMesh(hitbox);
  }

  /**
   * Destroy the raycast proxy during entity cleanup.
   * PERFORMANCE: The proxy is kept for the entity's lifetime to provide fast
   * click detection (VRM/GLB raycast is disabled). Only called in destroy().
   */
  destroyRaycastProxy(): void {
    if (this._raycastProxy) {
      this.ctx.node.remove(this._raycastProxy);
      this._raycastProxy.geometry.dispose();
      (this._raycastProxy.material as THREE.Material).dispose();
      this._raycastProxy = null;
    }
  }

  // ─── Emote management ─────────────────────────────────────────────

  /**
   * Map AI state to emote URL for VRM animations
   */
  getEmoteForAIState(aiState: MobAIState): string {
    switch (aiState) {
      case MobAIState.WANDER:
      case MobAIState.CHASE:
        return Emotes.WALK;
      case MobAIState.ATTACK:
        // Return IDLE for attack state - CombatSystem handles one-shot attack animations
        // This prevents AI from continuously looping the combat animation
        return Emotes.IDLE;
      case MobAIState.RETURN:
        return Emotes.WALK; // Walk back to spawn
      case MobAIState.DEAD:
        return Emotes.DEATH; // Death animation
      case MobAIState.IDLE:
      default:
        return Emotes.IDLE;
    }
  }

  /**
   * Check if an emote URL is a priority emote (combat/death) that should override protection.
   * Priority emotes can interrupt the manual override protection period.
   */
  isPriorityEmote(emoteUrl: string | null): boolean {
    if (!emoteUrl) return false;
    return (
      emoteUrl === Emotes.COMBAT ||
      emoteUrl === Emotes.SWORD_SWING ||
      emoteUrl === Emotes.TWO_HAND_SLASH ||
      emoteUrl === Emotes.RANGE ||
      emoteUrl === Emotes.SPELL_CAST ||
      emoteUrl === Emotes.DEATH
    );
  }

  /**
   * Check if an emote URL is a combat emote (for attack animation timing).
   * Combat emotes use attackSpeedTicks for their protection duration.
   */
  isCombatEmote(emoteUrl: string | null): boolean {
    if (!emoteUrl) return false;
    return (
      emoteUrl === Emotes.COMBAT ||
      emoteUrl === Emotes.SWORD_SWING ||
      emoteUrl === Emotes.TWO_HAND_SLASH ||
      emoteUrl === Emotes.RANGE ||
      emoteUrl === Emotes.SPELL_CAST
    );
  }

  /**
   * Apply a server emote to this mob (used by modify() and pending emote handling)
   * Requires _avatarInstance to be loaded.
   */
  applyServerEmote(serverEmote: string): void {
    if (!this._avatarInstance) {
      console.warn(
        `[MobVisualManager] applyServerEmote called without avatar for ${this.ctx.config.mobType}`,
      );
      return;
    }

    // Map symbolic emote names to asset URLs (same as PlayerRemote)
    // Uses pre-allocated _emoteMap to avoid allocation in hot path
    const emoteUrl = serverEmote.startsWith("asset://")
      ? serverEmote
      : this._emoteMap[serverEmote] || Emotes.IDLE;

    // If manual override is active and this is NOT a priority emote, ignore it
    // This prevents idle/walk emotes from overwriting combat animations
    if (
      !this.isPriorityEmote(emoteUrl) &&
      Date.now() < this._manualEmoteOverrideUntil
    ) {
      return;
    }

    if (this._currentEmote !== emoteUrl) {
      this._currentEmote = emoteUrl;
      this._avatarInstance.setEmote(emoteUrl);

      // Set override durations for one-shot animations
      if (this.isCombatEmote(emoteUrl)) {
        // Match server-side timing from CombatAnimationManager.setCombatEmote():
        // Hold combat pose until 1 tick before next attack (minimum 2 ticks)
        // Formula: Math.max(2, attackSpeedTicks - 1) ticks * TICK_DURATION_MS
        const protectionTicks = Math.max(
          2,
          (this.ctx.config.attackSpeedTicks || 4) - 1,
        );
        const protectionMs = protectionTicks * TICK_DURATION_MS;
        this._manualEmoteOverrideUntil = Date.now() + protectionMs;
      } else if (emoteUrl.includes("death")) {
        this._manualEmoteOverrideUntil =
          Date.now() + this.DEATH_ANIMATION_TICKS * TICK_DURATION_MS;
      } else if (emoteUrl.includes("idle")) {
        this._manualEmoteOverrideUntil = 0; // Clear override when reset to idle
      }
    }
  }

  /**
   * Switch animation based on AI state (GLB mobs only)
   * Note: VRM mobs handle emotes directly in clientUpdate(), not here.
   * This method is only called for GLB-based mobs from the GLB path in clientUpdate().
   */
  updateAnimation(aiState: MobAIState): void {
    // GLB path: Use mixer-based animation
    if (!this._mixer || !this._animationClips) {
      return;
    }

    // Determine which animation should be playing based on AI state
    let targetClip: THREE.AnimationClip | undefined;

    if (
      aiState === MobAIState.WANDER ||
      aiState === MobAIState.CHASE ||
      aiState === MobAIState.RETURN
    ) {
      // Moving states - play walk animation
      targetClip = this._animationClips.walk || this._animationClips.idle;
    } else {
      // Idle, attack, or dead - play idle animation
      targetClip = this._animationClips.idle || this._animationClips.walk;
    }

    // Switch animation if needed
    if (targetClip && this._currentAction?.getClip() !== targetClip) {
      this._currentAction?.fadeOut(
        COMBAT_CONSTANTS.ANIMATION.CROSSFADE_DURATION,
      );
      const newAction = this._mixer.clipAction(targetClip);
      newAction.reset();
      newAction.setLoop(THREE.LoopRepeat, Infinity); // Loop animation indefinitely
      newAction.fadeIn(COMBAT_CONSTANTS.ANIMATION.CROSSFADE_DURATION).play();
      this._currentAction = newAction;
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────

  /**
   * Destroy all visual resources.
   * Called from MobEntity.destroy() to clean up VRM, animations, and proxy.
   */
  destroy(): void {
    this._destroyed = true;

    // Clean up held weapon (bow, staff, etc.)
    // Only removeFromParent — do NOT dispose geometry/materials since
    // clone(true) shares buffers with the GLTFLoader's scene and other
    // mobs of the same type may reference them. GC handles the rest.
    if (this._heldWeapon) {
      this._heldWeapon.removeFromParent();
      this._heldWeapon = null;
    }

    // Clean up placeholder hitbox (if VRM never loaded)
    this.destroyRaycastProxy();

    // Clean up VRM instance
    if (this._avatarInstance) {
      this._avatarInstance.destroy();
      this._avatarInstance = null;
    }

    // Clean up animation mixer (for GLB models)
    if (this._mixer) {
      this._mixer.stopAllAction();
      this._mixer = null;
    }
  }
}
