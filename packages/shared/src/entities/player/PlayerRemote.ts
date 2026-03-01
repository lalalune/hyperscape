/**
 * PlayerRemote - Remote Player Entity
 *
 * Represents other players in the multiplayer world. Displays their avatars
 * and animations based on network state updates from the server.
 *
 * **Key Features**:
 *
 * **Network Interpolation**:
 * - Smoothly interpolates position and rotation between network updates
 * - Uses LerpVector3 and LerpQuaternion for smooth movement
 * - Handles teleportation (instant position changes)
 * - Velocity calculation for animation blending
 *
 * **Visual Representation**:
 * - VRM avatar rendering
 * - Name shown in right-click menu (OSRS pattern)
 * - Chat bubbles for messages
 * - Health bar (if in combat)
 * - Capsule collider visualization (debug mode)
 *
 * **Animation System**:
 * - Idle animation when stationary
 * - Walk/run animations based on velocity
 * - Emote playback (wave, dance, etc.)
 * - Smooth transitions between animations
 *
 * **Chat Bubbles**:
 * - Text bubbles appear above player when they chat
 * - Auto-dismiss after timeout
 * - Wraps long messages
 * - 3D UI that faces the camera
 *
 * **Network State**:
 * - Receives position/rotation updates from server (8Hz typical)
 * - Interpolates between updates for smooth 60fps rendering
 * - Handles player effects (sitting, emotes, etc.)
 * - Synchronizes avatar changes
 *
 * **Lifecycle**:
 * 1. Constructed when another player joins
 * 2. spawn() creates visual representation
 * 3. update() interpolates position and updates animations
 * 4. destroy() cleans up avatar and UI
 *
 * **Runs on**: Client only (browser)
 * **Referenced by**: Entities system (when entityAdded packet received)
 *
 * @public
 */

import type {
  EntityData,
  HotReloadable,
  NetworkData,
  LoadedAvatar,
} from "../../types/index";
import { DeathState } from "../../types/entities/entities";
import { Emotes, essentialEmotes } from "../../data/playerEmotes";
import type { World } from "../../core/World";
import { createNode } from "../../extras/three/createNode";
import { LerpQuaternion } from "../../extras/animation/LerpQuaternion";
import { LerpVector3 } from "../../extras/animation/LerpVector3";
import THREE from "../../extras/three/three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { Entity } from "../Entity";
import { Avatar, Group, Mesh, UI, UIView, UIText } from "../../nodes";
import { EventType } from "../../types/events";
import type { PlayerEffect, VRMHooks } from "../../types/systems/physics";
import type {
  HealthBars as HealthBarsSystem,
  HealthBarHandle,
} from "../../systems/client/HealthBars";
import { COMBAT_CONSTANTS } from "../../constants/CombatConstants";
import { DISTANCE_CONSTANTS } from "../../constants/GameConstants";
import { ticksToMs } from "../../utils/game/CombatCalculations";
import {
  AnimationLOD,
  ANIMATION_LOD_PRESETS,
  getCameraPosition,
} from "../../utils/rendering/AnimationLOD";
import {
  DistanceFadeController,
  ENTITY_FADE_CONFIGS,
  FadeState,
} from "../../utils/rendering/DistanceFade";
import { MobInstancedRenderer } from "../../utils/rendering/InstancedMeshManager";
import type {
  MobAnimationState,
  MobInstancedHandle,
  VRMAvatarInstance,
} from "../../types/rendering/nodes";

interface AvatarWithInstance {
  instance: {
    destroy: () => void;
    move: (matrix: THREE.Matrix4) => void;
    update: (delta: number) => void;
    disableRateCheck?: () => void;
    preloadEmote?: (emote: string) => void;
    setEmoteAndWait?: (emote: string, timeoutMs?: number) => Promise<void>;
    raw?: VRMAvatarInstance["raw"];
  } | null;
  getHeadToHeight?: () => number;
  setEmote?: (emote: string) => void;
  preloadEmote?: (emote: string) => void;
  setEmoteAndWait?: (emote: string, timeoutMs?: number) => Promise<void>;
  getBoneTransform?: (boneName: string) => THREE.Matrix4 | null;
  deactivate?: () => void;
  emote?: string | null;
}

let capsuleGeometry: THREE.CapsuleGeometry;
{
  const radius = 0.3;
  const inner = 1.2;
  const height = radius + inner + radius;
  capsuleGeometry = new THREE.CapsuleGeometry(radius, inner); // matches PlayerLocal capsule size
  capsuleGeometry.translate(0, height / 2, 0);
}

const PLAYER_IMPOSTOR_DISTANCES = {
  impostorDistance: 80,
  cullDistance: DISTANCE_CONSTANTS.RENDER.PLAYER,
  hysteresis: 5,
} as const;

export class PlayerRemote extends Entity implements HotReloadable {
  isPlayer: boolean;
  // Explicit non-local flag for tests
  isLocal: boolean = false;
  base!: Group;
  body!: Mesh;
  collider!: Mesh;
  aura!: Group;
  private _healthBarHandle: HealthBarHandle | null = null; // Separate health bar (HealthBars system)
  private _healthBarVisibleUntil: number = 0; // Timestamp when health bar should hide (fallback timer)
  bubble!: UI;
  bubbleBox!: UIView;
  bubbleText!: UIText;
  avatarUrl?: string;
  avatar?: Avatar;
  lerpPosition: LerpVector3;
  lerpQuaternion: LerpQuaternion;
  teleport: number = 0;
  speaking?: boolean;
  onEffectEnd?: () => void;
  chatTimer?: NodeJS.Timeout;
  destroyed: boolean = false;
  private lastEmote?: string;
  private isLoadingAvatar: boolean = false;
  private prevPosition: THREE.Vector3 = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  public enableInterpolation: boolean = false; // Disabled - ensure basic movement works first
  private _tempMatrix1 = new THREE.Matrix4();
  private _tempVector3_1 = new THREE.Vector3();
  // Pre-allocated temps for update/lateUpdate to avoid per-frame allocations
  private _combatQuat = new THREE.Quaternion();
  private _combatAxis = new THREE.Vector3(0, 1, 0);
  private _healthBarMatrix = new THREE.Matrix4();

  // Raycast proxy mesh - added directly to THREE.Scene for fast raycasting
  // This bypasses the Node system and avoids expensive SkinnedMesh raycast
  private raycastProxy: THREE.Mesh | null = null;

  // Combat state for RuneScape-style auto-retaliate
  combat = {
    inCombat: false,
    combatTarget: null as string | null,
  };

  /** Combat level for OSRS-style display and PvP range checks */
  get combatLevel(): number {
    return (this.data.combatLevel as number) || 3; // Default to OSRS minimum
  }

  // Guard to prevent double initialization
  private _initialized: boolean = false;

  /** Animation LOD controller - throttles animation updates for distant players */
  private readonly _animationLOD = new AnimationLOD(
    ANIMATION_LOD_PRESETS.PLAYER,
  );
  /** Track if idle pose has been applied at least once - prevents T-pose at frozen distances */
  private _hasAppliedIdlePose = false;

  /** Distance fade controller - dissolve effect for entities near render distance */
  private _distanceFade: DistanceFadeController | null = null;

  /** GPU instancing for batched rendering of player avatars */
  private _instancedRenderer: MobInstancedRenderer | null = null;
  private _instancedHandle: MobInstancedHandle | null = null;

  constructor(world: World, data: EntityData, local?: boolean) {
    super(world, data, local);
    this.isPlayer = true;
    this.lerpPosition = new LerpVector3(new THREE.Vector3(), 0);
    this.lerpQuaternion = new LerpQuaternion(new THREE.Quaternion(), 0);
    this.init();
  }

  /**
   * Override initializeVisuals to skip UIRenderer-based UI elements
   * PlayerRemote uses HealthBars system for health bars
   */
  protected initializeVisuals(): void {
    // Skip UIRenderer - we use HealthBars system
    // Do not call super.initializeVisuals()
  }

  async init(): Promise<void> {
    // Prevent double initialization (constructor calls init(), then Entities.add() calls it again)
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this.base = createNode("group") as Group;
    // Position and rotation are now handled by Entity base class
    // Use entity's position/rotation properties instead of data

    this.body = createNode("rigidbody", { type: "kinematic" }) as Mesh;
    this.body.active = (this.data.effect as PlayerEffect)?.anchorId
      ? false
      : true;
    this.base.add(this.body);
    this.collider = createNode("collider", {
      type: "geometry",
      convex: true,
      geometry: capsuleGeometry,
      layer: "player",
    }) as Mesh;
    this.body.add(this.collider);

    // Create raycast proxy mesh for fast entity detection
    // PERFORMANCE: VRM SkinnedMesh raycast is extremely slow (~700ms) because THREE.js
    // must transform every vertex by bone weights. This simple capsule mesh is instant.
    // The proxy is added directly to THREE.Scene, bypassing the Node system entirely.
    const proxyMaterial = new MeshBasicNodeMaterial();
    proxyMaterial.visible = false; // Invisible but still raycastable
    this.raycastProxy = new THREE.Mesh(capsuleGeometry, proxyMaterial);
    this.raycastProxy.userData = {
      type: "player",
      entityId: this.id,
      name: this.data.name || "Player",
      interactable: true,
    };
    // Add directly to THREE.Scene - bypasses Node.add() validation
    const scene = this.world.stage?.scene;
    if (scene) {
      scene.add(this.raycastProxy);
      // Sync initial position
      this.raycastProxy.position.copy(this.position);
    }

    this.aura = createNode("group") as Group;

    // Nametags disabled - OSRS pattern: names shown in right-click menu only

    // Register with HealthBars system
    const healthbars = this.world.getSystem?.("healthbars") as
      | HealthBarsSystem
      | undefined;

    if (healthbars) {
      const currentHealth = (this.data.health as number) || 100;
      const maxHealth = (this.data.maxHealth as number) || 100;
      this._healthBarHandle = healthbars.add(this.id, currentHealth, maxHealth);
      // Health bar starts hidden (RuneScape pattern: only show during combat)
    }

    this.bubble = createNode("ui", {
      width: 300,
      height: 512,
      pivot: "bottom-center",
      billboard: "full",
      scaler: [3, 30],
      justifyContent: "flex-end",
      alignItems: "center",
      active: false,
    }) as UI;
    this.bubbleBox = createNode("uiview", {
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      borderRadius: 10,
      padding: 10,
    }) as UIView;
    this.bubbleText = createNode("uitext", {
      color: "white",
      fontWeight: 100,
      lineHeight: 1.4,
      fontSize: 16,
    }) as UIText;
    this.bubble.add(this.bubbleBox);
    this.bubbleBox.add(this.bubbleText);
    this.aura?.add(this.bubble);

    this.aura?.activate(this.world);
    this.base.activate(this.world);

    // Note: Group nodes don't have Three.js representations - their children handle their own scene addition
    // The base node is activated separately and manages its own scene presence

    // Base node is used for UI elements (chat bubble)

    // Start avatar loading but don't await it - let it complete asynchronously
    this.applyAvatar();

    this.lerpPosition = new LerpVector3(this.position, this.world.networkRate);
    // IMPORTANT: Use the entity's actual quaternion, not the cloned getter
    this.lerpQuaternion = new LerpQuaternion(
      this.node.quaternion,
      this.world.networkRate,
    );
    this.teleport = 0;

    this.world.setHot(this, true);
    // Initialize previous position for speed-based emote calculation
    this.prevPosition.copy(this.position);
  }

  async applyAvatar() {
    const avatarUrl =
      (this.data.sessionAvatar as string) ||
      (this.data.avatar as string) ||
      "asset://avatars/avatar-male-01.vrm";

    // Skip if already loading ANY avatar (prevent race conditions)
    if (this.isLoadingAvatar) {
      return;
    }

    // Skip if avatar already loaded (either instanced or individual)
    if (
      this.avatarUrl === avatarUrl &&
      (this.avatar || this._instancedHandle)
    ) {
      return;
    }

    // Skip avatar loading on server (no loader system)
    if (!this.world.loader) {
      return;
    }

    // Set loading flag to prevent duplicate loads
    this.isLoadingAvatar = true;

    let loadSuccess = false;
    try {
      // TODO: GPU instanced rendering disabled pending animation fixes
      // The instanced renderer has issues with VRM bone propagation causing T-pose
      // Re-enable once VRM animation retargeting is working correctly
      //
      // Clean up previous instanced handle if switching avatars
      if (this._instancedHandle && this._instancedRenderer) {
        this._instancedRenderer.remove(this._instancedHandle);
        this._instancedHandle = null;
        this._instancedRenderer = null;
      }

      // Load VRM avatar using individual loading (known working path)
      // Retry up to 3 times with exponential backoff for transient network failures
      // (large VRM files ~56MB can fail on first attempt during server startup)
      const MAX_AVATAR_RETRIES = 3;
      let src: LoadedAvatar | null = null;
      for (let attempt = 1; attempt <= MAX_AVATAR_RETRIES; attempt++) {
        try {
          src = (await this.world.loader.load(
            "avatar",
            avatarUrl,
          )) as LoadedAvatar;
          break; // success
        } catch (retryErr) {
          if (attempt < MAX_AVATAR_RETRIES) {
            const delayMs = 2000 * Math.pow(2, attempt - 1);
            console.warn(
              `[PlayerRemote] Avatar fetch attempt ${attempt}/${MAX_AVATAR_RETRIES} failed, retrying in ${delayMs}ms...`,
              retryErr instanceof Error ? retryErr.message : retryErr,
            );
            await new Promise((r) => setTimeout(r, delayMs));
          } else {
            throw retryErr; // exhausted retries, let outer catch handle it
          }
        }
      }
      if (!src) {
        throw new Error("Avatar load returned null after retries");
      }

      // Clean up previous avatar
      if (this.avatar) {
        this.avatar.deactivate();
        // If avatar has an instance, destroy it to clean up VRM scene
        const avatarWithInstance = this.avatar as AvatarWithInstance;
        if (avatarWithInstance.instance) {
          avatarWithInstance.instance.destroy();
        }
      }

      // CRITICAL: Pass VRM hooks to toNodes() so VRMFactory applies normalization and rotation
      // This must happen DURING toNodes() call, not after
      const vrmHooks = {
        scene: this.world.stage.scene!, // Non-null assertion - scene must exist for avatar loading
        octree: this.world.stage.octree as VRMHooks["octree"],
        camera: this.world.camera,
        loader: this.world.loader,
      };
      const nodeMap = src.toNodes(vrmHooks);

      const rootNode = nodeMap.get("root");
      if (!rootNode) {
        throw new Error(
          `[PlayerRemote] No root node found in loaded avatar. Available keys: ${Array.from(nodeMap.keys())}`,
        );
      }

      // The avatar node is a child of the root node or in the map directly
      // MATCH PlayerLocal: Simple fallback logic
      const avatarNode = nodeMap.get("avatar") || rootNode;

      // Use the avatar node
      const nodeToUse = avatarNode;

      this.avatar = nodeToUse as Avatar;

      // Set up the avatar node properly - cast to access internal properties
      interface AvatarNodeInternal {
        ctx: World;
        parent: { matrixWorld: THREE.Matrix4 } | null;
        activate: (world: World) => void;
        mount: () => Promise<void>;
        hooks: VRMHooks;
        position: THREE.Vector3;
      }
      const nodeObj = nodeToUse as Avatar & AvatarNodeInternal;
      nodeObj.ctx = this.world;

      // Assign the VRM hooks to the node (already passed to toNodes above)
      nodeObj.hooks = vrmHooks;

      // Set the parent so the node knows where it belongs in the hierarchy
      // Note: PlayerRemote uses Hyperscape Group node (not raw THREE.Group like PlayerLocal)
      // The node system handles matrix updates automatically
      interface NodeWithParent {
        parent?: { matrixWorld: THREE.Matrix4 };
      }
      (nodeObj as NodeWithParent).parent = {
        matrixWorld: this.base.matrixWorld,
      };

      // CRITICAL: Avatar node position should be at origin (0,0,0) (matches PlayerLocal)
      // The instance.move() method will position it at the base's world position
      nodeObj.position.set(0, 0, 0);

      // Activate and mount the avatar node
      nodeObj.activate(this.world);
      await nodeObj.mount();

      // The avatar instance will be managed by the VRM factory
      // Don't add anything to base - the VRM scene is added to world.stage.scene

      // Disable distance-based LOD throttling for smooth animations
      const avatarWithInstance = nodeToUse as unknown as AvatarWithInstance;
      if (
        avatarWithInstance.instance &&
        avatarWithInstance.instance.disableRateCheck
      ) {
        avatarWithInstance.instance.disableRateCheck();
      }

      // Set up positioning
      const headHeight = this.avatar.getHeadToHeight()!;
      // Bubble goes at head height for chat
      this.bubble.position.y = headHeight + 0.2;

      nodeObj.position.set(0, 0, 0);

      // PERFORMANCE: Disable raycasting on VRM meshes - use raycastProxy instead
      // SkinnedMesh raycast is extremely slow (~700ms) because THREE.js must
      // transform every vertex by bone weights. The capsule proxy mesh is instant.
      const instanceWithRaw = avatarWithInstance.instance as unknown as {
        raw?: { scene?: THREE.Object3D };
      };
      if (instanceWithRaw?.raw?.scene) {
        instanceWithRaw.raw.scene.traverse((child: THREE.Object3D) => {
          child.raycast = () => {}; // No-op raycast
        });
      }

      // CRITICAL: Load and apply idle emote BEFORE making avatar visible
      // This prevents T-pose flash on spawn
      const avatarWithEmote = this.avatar as AvatarWithInstance;
      if (avatarWithEmote.instance?.setEmoteAndWait) {
        // Use setEmoteAndWait to ensure animation is loaded and first frame is applied
        await avatarWithEmote.instance.setEmoteAndWait(Emotes.IDLE, 3000);
      } else if (avatarWithEmote.setEmote) {
        // Fallback to regular setEmote (may show brief T-pose)
        avatarWithEmote.setEmote(Emotes.IDLE);
      }
      this.lastEmote = Emotes.IDLE;

      // NOW make avatar visible - idle animation is guaranteed to be playing
      if (instanceWithRaw?.raw?.scene) {
        instanceWithRaw.raw.scene.visible = true;
      }

      // Pre-warm essential emotes in background to prevent T-pose on first use
      // This is fire-and-forget - doesn't block avatar display
      if (avatarWithEmote.instance?.preloadEmote) {
        for (const emote of essentialEmotes) {
          if (emote !== Emotes.IDLE) {
            // IDLE already loaded
            avatarWithEmote.instance.preloadEmote(emote);
          }
        }
      }

      // Calculate camera height for spectator mode (same as PlayerLocal)
      interface AvatarWithHeight {
        height?: number;
      }
      const avatarHeight = (this.avatar as AvatarWithHeight).height ?? 1.5;
      const camHeight = Math.max(1.2, avatarHeight * 0.9);

      // HLOD: Set mesh reference (VRM scene is the mesh)
      if (instanceWithRaw?.raw?.scene) {
        this.mesh = instanceWithRaw.raw.scene as THREE.Object3D;

        // Initialize HLOD impostor support for VRM players
        // VRM models use a different rendering path (avatarInstance.move()) but we can still use impostors.
        // The key is that this.node.position is kept in sync with the VRM's world position.
        await this.initHLOD(`vrm_player_${this.id}_${avatarUrl}`, {
          category: "player",
          atlasSize: 512, // Smaller for players
          hemisphere: true,
          freezeAnimationAtLOD1: true, // Freeze animation at medium distance
          prepareForBake: async () => {
            // Prepare VRM mesh for impostor baking at local origin
            if (this.mesh && this.avatar) {
              const savedPosition = this.mesh.position.clone();
              const savedQuaternion = this.mesh.quaternion.clone();

              // Move mesh to local origin for baking
              this.mesh.position.set(0, 0, 0);
              this.mesh.quaternion.identity();

              // Update to ensure current pose
              const avatarWithInstance = this.avatar as AvatarWithInstance;
              avatarWithInstance.instance?.update(0);
              this.mesh.updateMatrixWorld(true);

              // Restore position after baking (microtask)
              Promise.resolve().then(() => {
                if (this.mesh) {
                  this.mesh.position.copy(savedPosition);
                  this.mesh.quaternion.copy(savedQuaternion);
                  this.mesh.updateMatrixWorld(true);
                }
              });
            }
          },
        });

        // Animated impostor support for remote players (walk cycle)
        // DISABLED: Animated impostor system not ready for agents/player characters
        // this.cleanupAnimatedHLOD();
        // void this.initAnimatedHLODFromEmote(
        //   `player_${avatarUrl}`,
        //   Emotes.WALK,
        //   avatarWithInstance.instance?.raw,
        //   PLAYER_IMPOSTOR_DISTANCES,
        // );
      }

      // Avatar loaded successfully
      loadSuccess = true;
      this.avatarUrl = avatarUrl;

      // CRITICAL: Sync base transform and position the avatar BEFORE making it visible.
      // Without this, the avatar appears at (0,0,0) in T-pose for one frame because
      // instance.move() normally only runs in update() on the next frame.
      this.base.position.copy(this.node.position);
      this.base.quaternion.copy(this.node.quaternion);
      this.base.updateTransform();
      if (avatarWithInstance.instance?.move) {
        avatarWithInstance.instance.move(this.base.matrixWorld);
      }
      if (avatarWithInstance.instance?.update) {
        avatarWithInstance.instance.update(0);
      }

      // NOW make avatar visible — it's already positioned and in idle pose
      if (this.avatar?.instance) {
        const avatarWithRaw = this.avatar.instance as unknown as {
          raw?: { scene?: { visible?: boolean } };
        };
        if (avatarWithRaw.raw?.scene) {
          avatarWithRaw.raw.scene.visible = true;
        }
      }

      // SPECTATOR FIX: Emit PLAYER_AVATAR_READY so camera system can set proper offset
      // This is critical for spectator mode to work correctly
      this.world.emit(EventType.PLAYER_AVATAR_READY, {
        playerId: this.id,
        avatar: this.avatar,
        camHeight: camHeight,
      });
    } catch (error) {
      console.error("[PlayerRemote] Avatar load failed:", error);
      loadSuccess = false;
    } finally {
      // Clear loading flag
      this.isLoadingAvatar = false;
      // Emit event so spectators and loading screens can track avatar completion
      this.world.emit(EventType.AVATAR_LOAD_COMPLETE, {
        playerId: this.id,
        success: loadSuccess,
      });
    }
  }

  getAnchorMatrix() {
    const effect = this.data.effect as PlayerEffect | undefined;
    if (effect?.anchorId) {
      return this.world.anchors.get(effect.anchorId);
    }
    return null;
  }

  fixedUpdate(_delta: number): void {
    // Implement fixedUpdate as required by HotReloadable interface
    // This method is called at fixed intervals for physics updates
    // Currently no specific implementation needed
  }

  update(delta: number): void {
    // GPU INSTANCING: Update instanced rendering position/state
    // If using instanced rendering, the renderer handles LOD, culling, and animation
    if (this._instancedHandle && this._instancedRenderer) {
      // Update position from interpolation
      this.node.position.copy(this.position);
      this._instancedRenderer.updateTransform(
        this._instancedHandle,
        this.position,
        this.base.quaternion,
      );

      // Update animation state based on movement
      const speed = this.velocity.length();
      const targetState: MobAnimationState = speed > 0.1 ? "walk" : "idle";
      if (this._instancedHandle.state !== targetState) {
        this._instancedRenderer.updateState(
          this._instancedHandle,
          targetState,
          this.position,
          this.base.quaternion,
        );
      }
      // Instanced renderer handles everything else (LOD, fade, animation)
      // But we still need to sync raycast proxy
      if (this.raycastProxy) {
        this.raycastProxy.position.copy(this.position);
        this.raycastProxy.position.y += 0.8; // capsule center offset
      }
      return;
    }

    // DISTANCE FADE: Apply dissolve effect and cull distant players
    const cameraPos = getCameraPosition(this.world);
    if (cameraPos) {
      // Initialize DistanceFadeController once we have a node
      if (!this._distanceFade && this.node) {
        this._distanceFade = new DistanceFadeController(
          this.node,
          ENTITY_FADE_CONFIGS.PLAYER,
          true, // Enable shader-based dissolve
        );
      }

      // Update fade and check if culled
      if (this._distanceFade) {
        const fadeResult = this._distanceFade.update(
          cameraPos.x,
          cameraPos.z,
          this.node.position.x,
          this.node.position.z,
        );

        // If culled, hide VRM avatar (which is NOT a child of this.node and
        // therefore not hidden by DistanceFadeController) then skip updates.
        // Without this, VRM stays visible at its last position — causing stale
        // avatar ghosts to accumulate in the duel arena after agents teleport out.
        if (fadeResult.state === FadeState.CULLED) {
          if (this.avatar) {
            const inst = (this.avatar as AvatarWithInstance).instance as
              | { raw?: { scene?: THREE.Object3D } }
              | undefined;
            if (inst?.raw?.scene) {
              inst.raw.scene.visible = false;
            }
          }
          return;
        }
      }
    }

    // Restore VRM visibility when entity re-enters draw range after being culled.
    // The cull path above hides the VRM scene; this re-shows it.
    if (this.avatar) {
      const inst = (this.avatar as AvatarWithInstance).instance as
        | { raw?: { scene?: THREE.Object3D } }
        | undefined;
      if (inst?.raw?.scene && !inst.raw.scene.visible) {
        inst.raw.scene.visible = true;
      }
    }

    // ANIMATION LOD: Calculate distance to camera once for animation throttling
    // This reduces CPU/GPU load for distant players significantly
    const animLODResult = cameraPos
      ? this._animationLOD.updateFromPosition(
          this.node.position.x,
          this.node.position.z,
          cameraPos.x,
          cameraPos.z,
          delta,
        )
      : {
          shouldUpdate: true,
          effectiveDelta: delta,
          lodLevel: 0,
          distanceSq: 0,
          shouldApplyRestPose: false,
        };

    // T-POSE FIX: When entering frozen state (or never applied idle), apply idle pose once
    // This ensures remote players at frozen/culled distances show idle pose instead of T-pose
    const needsIdlePoseApplication =
      animLODResult.shouldApplyRestPose || !this._hasAppliedIdlePose;

    if (needsIdlePoseApplication && this.avatar) {
      type AvatarWithIdlePose = {
        instance?: {
          setEmote?: (emote: string) => void;
          update?: (delta: number) => void;
        };
      };
      const avatarWithInstance = this.avatar as AvatarWithIdlePose;
      if (avatarWithInstance.instance) {
        const instance = avatarWithInstance.instance;
        // Ensure idle emote is set
        if (instance.setEmote) {
          instance.setEmote(Emotes.IDLE);
        }
        // Apply frame 0 to bake idle pose into skeleton
        if (instance.update) {
          instance.update(0);
        }
        this._hasAppliedIdlePose = true;
      }
    }

    const anchor = this.getAnchorMatrix();
    if (!anchor) {
      // Check if TileInterpolator is controlling this entity's position
      // If so, skip our position interpolation to avoid fighting
      const tileControlled = this.data.tileInterpolatorControlled === true;

      if (!tileControlled) {
        // Update lerp values
        this.lerpPosition.update(delta);
        this.lerpQuaternion.update(delta);

        // FORCE APPLY POSITION - no interpolation bullshit
        if (!this.enableInterpolation) {
          // Get the target position directly from lerp.current and apply it
          const targetPos = this.lerpPosition.current;
          if (targetPos) {
            this.base.position.copy(targetPos);
            this.node.position.copy(targetPos);
            this.position.copy(targetPos);
          }

          const targetRot = this.lerpQuaternion.current;
          if (targetRot) {
            this.node.quaternion.copy(targetRot);
            this.base.quaternion.copy(targetRot);
          }
          // CRITICAL: Update base transform AFTER both position and rotation are set
          this.base.updateTransform();
        } else {
          // Use interpolated values
          this.base.position.copy(this.lerpPosition.value);
          this.node.position.copy(this.lerpPosition.value);
          this.position.copy(this.lerpPosition.value);
          this.node.quaternion.copy(this.lerpQuaternion.value);
          this.base.quaternion.copy(this.lerpQuaternion.value);
          // CRITICAL: Update base transform AFTER both position and rotation are set
          this.base.updateTransform();
        }
      } else {
        // AAA ARCHITECTURE: TileInterpolator is Single Source of Truth for transform
        // When TileInterpolator controls this entity, it handles BOTH position AND rotation:
        // - Position: Smooth tile-to-tile interpolation
        // - Rotation: Movement direction when walking, combat rotation when standing still
        //
        // Combat rotation comes via entityModified → ClientNetwork → TileInterpolator.setCombatRotation()
        // TileInterpolator applies rotation to base.quaternion in its update()
        //
        // We just need to sync the transform here - TileInterpolator does the rest.
        this.base.updateTransform();
      }
    }

    // Update node matrices for rendering
    if (this.node) {
      this.node.updateMatrix();
      this.node.updateMatrixWorld(true);
    }

    // Run base client update after transforms are synced
    super.clientUpdate(delta);
    const isAnimatedImpostor = this.animatedHLODState?.isImpostor === true;

    // Retry avatar loading if a previous attempt failed.
    // applyAvatar() is fire-and-forget from init(), so if the initial load
    // fails (e.g., large VRM under memory pressure or concurrent loads),
    // the entity stays invisible with no retry. This safety net re-triggers
    // the load on the next frame.
    if (!this.avatar && !this.isLoadingAvatar && !this.destroyed) {
      this.applyAvatar();
    }

    // Update avatar position to follow player
    if (this.avatar && (this.avatar as AvatarWithInstance).instance) {
      const instance = (this.avatar as AvatarWithInstance).instance;
      interface InstanceWithRaw {
        raw?: { scene?: THREE.Object3D };
      }
      const instanceWithRaw = instance as InstanceWithRaw;

      // Directly set the avatar scene position
      if (instanceWithRaw?.raw?.scene) {
        const avatarScene = instanceWithRaw.raw.scene;

        // The VRM scene has matrixAutoUpdate = false, so we need to update matrices manually
        // Create a temporary matrix - consider moving this to a class property for reuse
        const worldMatrix = this._tempMatrix1;
        const tempScale = this._tempVector3_1.set(1, 1, 1);
        worldMatrix.compose(
          this.node.position,
          this.node.quaternion,
          tempScale,
        );

        // Set both matrix and matrixWorld since auto update is disabled
        avatarScene.matrix.copy(worldMatrix);
        avatarScene.matrixWorld.copy(worldMatrix);

        // Debug logging disabled to prevent memory pressure
        // Uncomment for debugging remote avatar movement
        // if (Math.random() < 0.001) {  // 0.1% chance
        //   console.log('[PlayerRemote] Moving avatar:', {
        //     id: this.id,
        //     nodePos: this.node.position.toArray(),
        //     avatarMatrixWorld: avatarScene.matrixWorld.elements.slice(12, 15), // Translation part
        //     matrixAutoUpdate: avatarScene.matrixAutoUpdate
        //   })
        // }
      }

      // CRITICAL: Update avatar position/rotation every frame (matches PlayerLocal)
      // The move() method applies the transform matrix with normalization and rotation
      if (instance && instance.move && this.base) {
        instance.move(this.base.matrixWorld);
      }

      // ANIMATION LOD: Only update avatar animations when LOD allows
      // This significantly reduces CPU/GPU load for distant players
      if (
        instance &&
        instance.update &&
        animLODResult.shouldUpdate &&
        !isAnimatedImpostor
      ) {
        instance.update(animLODResult.effectiveDelta);
      }

      // Post-animation ground clamping - ensures avatar's feet never go below terrain
      // This verifies the final bone positions after animation and adjusts if needed
      const terrain = this.world.getSystem("terrain");
      if (
        terrain &&
        "getHeightAt" in terrain &&
        instance &&
        "clampToGround" in instance
      ) {
        try {
          // Use base.position which should be the world position for remote players
          const terrainHeight = (
            terrain as { getHeightAt: (x: number, z: number) => number }
          ).getHeightAt(this.base.position.x, this.base.position.z);
          if (Number.isFinite(terrainHeight)) {
            const groundAdjustment = (
              instance as { clampToGround: (y: number) => number }
            ).clampToGround(terrainHeight);
            // Store adjustment in VRM instance (NOT position - that would cause camera jitter for spectators)
            // The adjustment will be applied in the next move() call
            const instanceWithAdjust = instance as {
              setGroundAdjustment?: (adj: number) => void;
            };
            if (instanceWithAdjust.setGroundAdjustment) {
              instanceWithAdjust.setGroundAdjustment(groundAdjustment);
            }
          }
        } catch (_err) {
          // Terrain tile not generated yet
        }
      }

      // Safety net: ensure VRM scene is visible when entity is at LOD0.
      // HLOD can set this.mesh.visible = false during camera transitions
      // (e.g., streaming duel camera cuts). If the LOD transitions back to 0
      // but the mesh stays invisible due to an edge case, this restores it.
      if (this.mesh && !isAnimatedImpostor) {
        const lodLevel = this.animatedHLODState?.currentLOD ?? 0;
        if (lodLevel === 0 && !this.mesh.visible) {
          this.mesh.visible = true;
        }
      }
    }

    // Use server-provided emote state directly - no inference
    // The server/PlayerLocal sends the correct animation state
    let serverEmote = this.data.emote as string | undefined;

    // AAA QUALITY: Force death emote when player is in DYING state
    // This is a safety net - if deathState is DYING, the animation MUST be death
    // regardless of what serverEmote says (protects against race conditions)
    const currentDeathState = (this.data as { deathState?: DeathState })
      .deathState;
    if (
      currentDeathState === DeathState.DYING ||
      currentDeathState === DeathState.DEAD
    ) {
      if (serverEmote !== "death") {
        console.log(
          `[PlayerRemote] FORCING death emote (was "${serverEmote}") because deathState=${currentDeathState} for ${this.id}`,
        );
        serverEmote = "death";
        this.data.emote = "death"; // Also fix the data for consistency
      }
    }

    // DEBUG: Log when death emote is set but we're in update()
    if (serverEmote === "death") {
      console.log(`[PlayerRemote] update() with death emote:`, {
        id: this.id,
        hasAvatar: !!this.avatar,
        lastEmote: this.lastEmote,
        deathUrl: Emotes.DEATH,
        deathState: currentDeathState,
      });
    }

    if (this.avatar) {
      let desiredUrl: string;

      if (serverEmote) {
        // Map symbolic emote to asset URL
        if (serverEmote.startsWith("asset://")) {
          desiredUrl = serverEmote;
        } else {
          const emoteMap: Record<string, string> = {
            idle: Emotes.IDLE,
            walk: Emotes.WALK,
            run: Emotes.RUN,
            float: Emotes.FLOAT,
            fall: Emotes.FALL,
            flip: Emotes.FLIP,
            talk: Emotes.TALK,
            combat: Emotes.COMBAT,
            sword_swing: Emotes.SWORD_SWING,
            "2h_idle": Emotes.TWO_HAND_IDLE,
            "2h_slash": Emotes.TWO_HAND_SLASH,
            range: Emotes.RANGE,
            spell_cast: Emotes.SPELL_CAST,
            chopping: Emotes.CHOPPING,
            mining: Emotes.CHOPPING, // Use chopping animation for mining (temporary)
            fishing: Emotes.FISHING,
            death: Emotes.DEATH,
            squat: Emotes.SQUAT, // Used for firemaking and cooking
            victory: Emotes.VICTORY, // Victory celebration (waving)
          };
          desiredUrl = emoteMap[serverEmote] || Emotes.IDLE;
        }
      } else {
        // Default to idle if no emote data
        desiredUrl = Emotes.IDLE;
      }

      // Update animation if changed
      if (desiredUrl !== this.lastEmote) {
        // DEBUG: Log death emote application
        if (serverEmote === "death" || desiredUrl === Emotes.DEATH) {
          console.log(`[PlayerRemote] update() applying death emote:`, {
            id: this.id,
            serverEmote,
            desiredUrl,
            lastEmote: this.lastEmote,
            hasEmoteProperty: "emote" in this.avatar,
            hasSetEmoteMethod: "setEmote" in this.avatar,
          });
        }
        if ("emote" in this.avatar) {
          interface AvatarWithEmote {
            emote?: string | null;
          }
          (this.avatar as AvatarWithEmote).emote = desiredUrl;
        } else if ("setEmote" in this.avatar) {
          (this.avatar as Avatar).setEmote(desiredUrl);
        }
        this.lastEmote = desiredUrl;
      } else if (serverEmote === "death") {
        // DEBUG: Death emote but animation already matches
        console.log(`[PlayerRemote] update() death emote already applied:`, {
          id: this.id,
          desiredUrl,
          lastEmote: this.lastEmote,
        });
      }
    } else if (serverEmote === "death") {
      // DEBUG: Avatar not available when death emote is set
      console.warn(`[PlayerRemote] update() death emote but NO AVATAR:`, {
        id: this.id,
        emote: this.data.emote,
      });
    }

    // Sync raycast proxy position with player
    if (this.raycastProxy) {
      this.raycastProxy.position.copy(this.position);
    }

    // Update prev position at end of frame
    this.prevPosition.copy(this.position);
  }

  lateUpdate(_delta: number): void {
    const anchor = this.getAnchorMatrix();
    if (anchor) {
      this.lerpPosition.snap();
      this.lerpQuaternion.snap();
      this.position.setFromMatrixPosition(anchor);
      this.rotation.setFromRotationMatrix(anchor);
      this.base.clean();
    }
    if (this.avatar) {
      const matrix = this.avatar.getBoneTransform("head");
      if (matrix) this.aura.position.setFromMatrixPosition(matrix);
    }

    // Update health bar position in HealthBars system
    if (this._healthBarHandle && this.base) {
      // Use pre-allocated matrix to avoid per-frame allocations
      this._healthBarMatrix.copy(this.base.matrixWorld);
      this._healthBarMatrix.elements[13] += 2.0; // Health bar at Y=2.0
      this._healthBarHandle.move(this._healthBarMatrix);
    }

    // Fallback: Hide health bar after combat timeout if server c:false was missed
    // This handles edge cases where network packet is lost or getPlayer() fails on server
    if (this._healthBarHandle && this._healthBarVisibleUntil > 0) {
      if (Date.now() >= this._healthBarVisibleUntil) {
        this._healthBarHandle.hide();
        this._healthBarVisibleUntil = 0;
      }
    }
  }

  postLateUpdate(_delta: number): void {
    // Implement postLateUpdate as required by HotReloadable interface
    // This method is called after all other update methods
    // Currently no specific implementation needed
  }

  setEffect(effect: string, onEnd?: () => void) {
    if (this.data.effect) {
      this.data.effect = undefined;
      this.onEffectEnd?.();
      this.onEffectEnd = undefined;
    }
    this.data.effect = { emote: effect };
    this.onEffectEnd = onEnd;
    // Strong type assumption - effect structure is known
    const hasAnchor = effect && (effect as PlayerEffect).anchorId;
    this.body.active = !hasAnchor;
  }

  setSpeaking(speaking: boolean) {
    if (this.speaking === speaking) return;
    this.speaking = speaking;
    // Speaking state tracked - visual indicator could be added to avatar/aura if needed
  }

  override modify(data: Partial<NetworkData>) {
    let avatarChanged: boolean = false;
    // Strong type assumptions - check properties directly
    if ("t" in data) {
      this.teleport++;
    }
    if (data.p !== undefined) {
      // Check if TileInterpolator is controlling position - if so, skip position updates
      // TileInterpolator handles position smoothly, we don't want to fight it
      const tileControlled = this.data.tileInterpolatorControlled === true;
      if (!tileControlled) {
        // Position is no longer stored in EntityData, apply directly to entity transform
        this.lerpPosition.pushArray(data.p, this.teleport || null);
        // Apply position immediately for responsiveness - assume it's a 3-element array
        const pos = data.p as number[];
        // Update base, node, and position IMMEDIATELY
        this.base.position.set(pos[0], pos[1], pos[2]);
        this.node.position.set(pos[0], pos[1], pos[2]);
        this.position.set(pos[0], pos[1], pos[2]);
        // CRITICAL: Force base to update its matrix so instance.move() gets correct transform
        this.base.updateTransform();
      }

      // Note: PLAYER_TELEPORTED VFX is emitted by ClientNetwork.onPlayerTeleport
      // when the dedicated playerTeleport packet arrives. Do NOT emit here —
      // the entity position may be stale at this point, causing ghost effects.
    }
    if (data.q !== undefined) {
      // AAA ARCHITECTURE: Rotation handling depends on whether TileInterpolator is active
      //
      // When TileInterpolator IS active:
      //   - ClientNetwork routes rotation to TileInterpolator.setCombatRotation()
      //   - data.q will NOT arrive here (stripped from entityModified)
      //   - TileInterpolator applies rotation to base.quaternion
      //
      // When TileInterpolator is NOT active (e.g., entity not in world.entities.players):
      //   - data.q arrives here and is pushed to lerpQuaternion
      //   - update() applies lerpQuaternion to node.quaternion
      //
      // This ensures single source of truth: TileInterpolator when active, lerpQuaternion otherwise.
      this.lerpQuaternion.pushArray(data.q, this.teleport || null);
    }
    if (data.e !== undefined) {
      // AAA QUALITY: Protect death animation from being overwritten
      // When a player is DYING, only allow "death" emote - block all others (especially "idle")
      // This prevents race conditions where scheduled emote resets arrive after death packets
      const currentDeathState = (this.data as { deathState?: DeathState })
        .deathState;
      const isCurrentlyDying =
        currentDeathState === DeathState.DYING ||
        currentDeathState === DeathState.DEAD;

      if (isCurrentlyDying && data.e !== "death") {
        // Player is dying - ignore non-death emote changes but continue processing other data
        // IMPORTANT: Don't return early! Other data (position, etc.) still needs to be processed
        console.log(
          `[PlayerRemote] BLOCKED emote change to "${data.e}" during death for ${this.id} (deathState=${currentDeathState})`,
        );
        // Skip emote assignment but continue with rest of modify()
      } else {
        // DEBUG: Log death emote setting
        if (data.e === "death") {
          console.log(`[PlayerRemote] Setting death emote:`, {
            id: this.id,
            oldEmote: this.data.emote,
            newEmote: data.e,
            hasAvatar: !!this.avatar,
            lastEmote: this.lastEmote,
            deathState: currentDeathState,
          });
        }
        // Only set emote if we're not blocking it (i.e., not dying with non-death emote)
        this.data.emote = data.e;
      }
    }
    if (data.ef !== undefined) {
      this.setEffect(data.ef as string);
    }
    if (data.name !== undefined) {
      this.data.name = data.name as string;
      // Name stored in data - shown in right-click menu (OSRS pattern)
    }
    if (data.combatLevel !== undefined) {
      this.data.combatLevel = data.combatLevel as number;
      // Combat level stored in data - shown in right-click menu (OSRS pattern)
    }
    if (data.maxHealth !== undefined) {
      this.data.maxHealth = data.maxHealth as number;
    }
    if (data.health !== undefined) {
      const currentHealth = data.health as number;
      const maxHealth = (this.data.maxHealth as number) || 100;

      this.data.health = currentHealth;

      // Update health bar via HealthBars system
      if (this._healthBarHandle) {
        this._healthBarHandle.setHealth(currentHealth, maxHealth);
      }

      this.world.emit(EventType.PLAYER_HEALTH_UPDATED, {
        playerId: this.data.id,
        health: currentHealth,
        maxHealth: maxHealth,
      });
    }
    if (data.avatar !== undefined) {
      this.data.avatar = data.avatar as string;
      avatarChanged = true;
    }
    if (data.sessionAvatar !== undefined) {
      this.data.sessionAvatar = data.sessionAvatar as string;
      avatarChanged = true;
    }
    if (data.roles !== undefined) {
      this.data.roles = data.roles as string[];
    }
    if (data.v !== undefined) {
      // Strong type assumption - v is a 3-element array when provided
      const vel = data.v as number[];
      this.velocity.set(vel[0], vel[1], vel[2]);
    }
    // Handle combat state updates for RuneScape-style auto-retaliate rotation
    // Using abbreviated key 'c' for inCombat (network efficiency)
    if ("c" in data) {
      const newInCombat = data.c as boolean;
      this.combat.inCombat = newInCombat;
      // Show/hide health bar via HealthBars system (RuneScape pattern)
      if (this._healthBarHandle) {
        if (newInCombat) {
          // Sync health bar with current entity data before showing.
          // This prevents stale health from a previous duel being displayed
          // when the bar becomes visible, regardless of packet ordering.
          const currentHealth = (this.data.health as number) || 0;
          const maxHealth = (this.data.maxHealth as number) || 100;
          this._healthBarHandle.setHealth(currentHealth, maxHealth);
          // In combat - show health bar and set/extend timeout
          this._healthBarHandle.show();
          this._healthBarVisibleUntil =
            Date.now() + ticksToMs(COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS);
        } else {
          // Combat ended - hide and clear timer
          this._healthBarHandle.hide();
          this._healthBarVisibleUntil = 0;
        }
      }
    }
    // Using abbreviated key 'ct' for combatTarget (network efficiency)
    if ("ct" in data) {
      this.combat.combatTarget = data.ct as string | null;
    }
    if (avatarChanged) {
      this.applyAvatar();
    }
  }

  chat(msg: string) {
    this.bubbleText.value = msg;
    this.bubble.active = true;
    if (this.chatTimer) clearTimeout(this.chatTimer);
    this.chatTimer = setTimeout(() => {
      this.bubble.active = false;
    }, 5000);
  }

  override destroy(_local?: boolean) {
    // Guard uses inherited Entity.destroyed flag
    if (this.destroyed) return;
    // NOTE: Do NOT set this.destroyed = true here!
    // Entity.destroy() sets it, and if we set it first, super.destroy() will
    // immediately return and the node won't be removed from the scene.

    // 1a. Clean up instanced rendering handle
    if (this._instancedHandle && this._instancedRenderer) {
      this._instancedRenderer.remove(this._instancedHandle);
      this._instancedHandle = null;
      this._instancedRenderer = null;
    }

    // 1b. Remove raycast proxy from scene
    if (this.raycastProxy) {
      const scene = this.world.stage?.scene;
      if (scene) {
        scene.remove(this.raycastProxy);
      }
      this.raycastProxy.geometry.dispose();
      (this.raycastProxy.material as THREE.Material).dispose();
      this.raycastProxy = null;
    }

    // 2. Clear timers
    if (this.chatTimer) clearTimeout(this.chatTimer);

    // 3. Clean up distance fade controller
    if (this._distanceFade) {
      this._distanceFade.dispose();
      this._distanceFade = null;
    }

    // 4. Clean up avatar (VRM instance is added directly to world.stage.scene)
    // Must destroy the instance to remove from scene, not just set to undefined
    if (this.avatar) {
      this.avatar.deactivate();
      // Destroy VRM instance to remove from scene
      const avatarWithInstance = this.avatar as AvatarWithInstance;
      if (avatarWithInstance.instance) {
        avatarWithInstance.instance.destroy();
      }
      this.avatar = undefined;
    }

    // 5. Deactivate visual components
    this.base.deactivate();
    this.aura.deactivate();

    // 6. Unregister from hot updates
    this.world.setHot(this, false);

    // 7. Clean up health bar from HealthBars system
    if (this._healthBarHandle) {
      this._healthBarHandle.destroy();
      this._healthBarHandle = null;
    }

    // 8. Call parent destroy to:
    //    - Set destroyed = true
    //    - Remove node from scene
    //    - Dispose mesh/materials
    //    - Clean up physics
    //    - Clean up components
    // Pass false to prevent duplicate entityRemoved broadcast
    // (server already sent it via handleDisconnect, and Entities.remove()
    // is what called us so we don't need to call it again)
    super.destroy(false);
  }

  public toggleInterpolation(enabled: boolean): void {
    this.enableInterpolation = enabled;
  }
}
