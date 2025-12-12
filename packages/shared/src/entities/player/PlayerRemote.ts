/**
 * PlayerRemote - Remote Player Entity
 *
 * Represents other players in the multiplayer world. Displays their avatars,
 * nametags, and animations based on network state updates from the server.
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
 * - Nametag with player name
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
import { Emotes } from "../../data/playerEmotes";
import type { World } from "../../core/World";
import { createNode } from "../../extras/three/createNode";
import { LerpQuaternion } from "../../extras/animation/LerpQuaternion";
import { LerpVector3 } from "../../extras/animation/LerpVector3";
import THREE from "../../extras/three/three";
import { Entity } from "../Entity";
import { Avatar, Nametag, Group, Mesh, UI, UIView, UIText } from "../../nodes";
import { EventType } from "../../types/events";
import type { PlayerEffect, VRMHooks } from "../../types/systems/physics";
import type {
  HealthBars as HealthBarsSystem,
  HealthBarHandle,
} from "../../systems/client/HealthBars";

interface AvatarWithInstance {
  instance: {
    destroy: () => void;
    move: (matrix: THREE.Matrix4) => void;
    update: (delta: number) => void;
    disableRateCheck?: () => void;
  } | null;
  getHeadToHeight?: () => number;
  setEmote?: (emote: string) => void;
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

export class PlayerRemote extends Entity implements HotReloadable {
  isPlayer: boolean;
  // Explicit non-local flag for tests
  isLocal: boolean = false;
  base!: Group;
  body!: Mesh;
  collider!: Mesh;
  aura!: Group;
  nametag!: Nametag;
  private _healthBarHandle: HealthBarHandle | null = null; // Separate health bar (HealthBars system)
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
  // PERFORMANCE: Cached objects for hot path updates
  private _tempMatrix1 = new THREE.Matrix4();
  private _tempMatrix2 = new THREE.Matrix4();
  private _tempMatrix3 = new THREE.Matrix4();
  private _tempVector3_1 = new THREE.Vector3();
  private _tempQuat1 = new THREE.Quaternion();
  private static readonly _UP = new THREE.Vector3(0, 1, 0);

  // Combat state for RuneScape-style auto-retaliate
  combat = {
    inCombat: false,
    combatTarget: null as string | null,
  };

  // Guard to prevent double initialization
  private _initialized: boolean = false;

  constructor(world: World, data: EntityData, local?: boolean) {
    super(world, data, local);
    this.isPlayer = true;
    this.lerpPosition = new LerpVector3(new THREE.Vector3(), 0);
    this.lerpQuaternion = new LerpQuaternion(new THREE.Quaternion(), 0);
    this.init();
  }

  /**
   * Override initializeVisuals to skip UIRenderer-based UI elements
   * PlayerRemote uses its own Nametag node system instead
   */
  protected initializeVisuals(): void {
    // Skip UIRenderer - we use Nametag nodes instead
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

    // Set userData for right-click interaction detection
    const playerUserData = {
      type: "player",
      entityId: this.id,
      name: this.data.name || "Player",
      interactable: true,
      entity: this,
      playerId: this.id,
    };

    // Set userData on the base group node (cast to THREE.Object3D to access userData)
    const baseObj = this.base as unknown as THREE.Object3D;
    if (baseObj.userData) {
      Object.assign(baseObj.userData, playerUserData);
    }

    this.body = createNode("rigidbody", { type: "kinematic" }) as Mesh;
    this.body.active = (this.data.effect as PlayerEffect)?.anchorId
      ? false
      : true;
    // Set userData on body for raycast detection (cast to THREE.Object3D)
    const bodyObj = this.body as unknown as THREE.Object3D;
    if (bodyObj.userData) {
      Object.assign(bodyObj.userData, playerUserData);
    }
    this.base.add(this.body);

    this.collider = createNode("collider", {
      type: "geometry",
      convex: true,
      geometry: capsuleGeometry,
      layer: "player",
    }) as Mesh;
    // Set userData on collider for raycast detection (cast to THREE.Object3D)
    const colliderObj = this.collider as unknown as THREE.Object3D;
    if (colliderObj.userData) {
      Object.assign(colliderObj.userData, playerUserData);
    }
    this.body.add(this.collider);

    // this.caps = createNode('mesh', {
    //   type: 'geometry',
    //   geometry: capsuleGeometry,
    //   material: new THREE.MeshStandardMaterial({ color: 'white' }),
    // })
    // this.base.add(this.caps)

    this.aura = createNode("group") as Group;

    // Create nametag for name display only (no health - that's now in HealthBars system)
    this.nametag = createNode("nametag", {
      label: this.data.name || "",
      active: true,
    }) as Nametag;
    // Set world context for nametag (needed for mounting to Nametags system)
    this.nametag.ctx = this.world;
    // Mount nametag directly (PlayerRemote.lateUpdate() handles positioning via handle.move())
    if (this.nametag.mount) {
      this.nametag.mount();
    }

    // Register with HealthBars system (separate from nametags)
    const healthbars = this.world.systems.find(
      (s) =>
        (s as { systemName?: string }).systemName === "healthbars" ||
        s.constructor.name === "HealthBars",
    ) as HealthBarsSystem | undefined;

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

    // Base node is used for UI elements (nametag, bubble)

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

    // Skip if avatar already loaded
    if (this.avatarUrl === avatarUrl && this.avatar) {
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
      const src = (await this.world.loader.load(
        "avatar",
        avatarUrl,
      )) as LoadedAvatar;

      // Clean up previous avatar
      if (this.avatar) {
        this.avatar.deactivate();
        // If avatar has an instance, destroy it to clean up VRM scene
        const avatarWithInstance = this.avatar as AvatarWithInstance;
        if (avatarWithInstance.instance) {
          avatarWithInstance.instance.destroy();
        }
      }

      // Pass VRM hooks to toNodes() so VRMFactory applies normalization and rotation
      // This must happen DURING toNodes() call, not after
      const vrmHooks: VRMHooks = {
        scene: this.world.stage.scene,
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
      // Using Object.assign to bypass type checking for internal parent property
      // Type assertion needed because parent property structure doesn't match full Node type
      Object.assign(nodeObj, {
        parent: { matrixWorld: this.base.matrixWorld } as THREE.Object3D,
      });

      // Avatar node position should be at origin (0,0,0) (matches PlayerLocal)
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
      // Position nametag at fixed Y=2.0 like mob health bars
      this.nametag.position.y = 2.0;
      // Bubble still goes at head height for chat
      this.bubble.position.y = headHeight + 0.2;

      if (!this.bubble.active) {
        this.nametag.active = true;
      }

      // Make avatar visible and ensure proper positioning (matches PlayerLocal)
      (this.avatar as unknown as { visible: boolean }).visible = true;
      nodeObj.position.set(0, 0, 0);

      // Ensure a default idle emote after mount so avatar isn't frozen
      (this.avatar as Avatar).setEmote(Emotes.IDLE);
      this.lastEmote = Emotes.IDLE;

      // Calculate camera height for spectator mode (same as PlayerLocal)
      const avatarHeight = (this.avatar as unknown as { height: number })
        .height;
      const camHeight = Math.max(1.2, avatarHeight * 0.9);

      // Avatar loaded successfully
      loadSuccess = true;
      this.avatarUrl = avatarUrl;

      // Emit PLAYER_AVATAR_READY so camera system can set proper offset
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
            // Update base transform for instance.move()
            this.base.updateTransform();
            // Position applied directly without interpolation
          }

          const targetRot = this.lerpQuaternion.current;
          if (targetRot) {
            this.node.quaternion.copy(targetRot);
          }
        } else {
          // Use interpolated values
          this.base.position.copy(this.lerpPosition.value);
          this.node.position.copy(this.lerpPosition.value);
          this.position.copy(this.lerpPosition.value);
          this.node.quaternion.copy(this.lerpQuaternion.value);
          // Update base transform for instance.move()
          this.base.updateTransform();
        }
      } else {
        // TileInterpolator is controlling position - just update base transform
        this.base.updateTransform();
      }
    }

    // COMBAT ROTATION: Rotate to face target when in combat (RuneScape-style)
    // Priority: 1) Our combat target (from server), 2) Mob attacking us
    let combatTarget: {
      position: { x: number; z: number };
      id: string;
    } | null = null;

    // First check if WE have a combat target (player attacking mob)
    if (this.combat.combatTarget) {
      const targetEntity = this.world.entities.items.get(
        this.combat.combatTarget,
      );
      if (targetEntity?.position) {
        const dx = targetEntity.position.x - this.position.x;
        const dz = targetEntity.position.z - this.position.z;
        const distance2D = Math.sqrt(dx * dx + dz * dz);
        // Only rotate if target is within reasonable combat range
        if (distance2D <= 10) {
          combatTarget = {
            position: targetEntity.position,
            id: targetEntity.id,
          };
        }
      }
    }

    // If no target, check CombatSystem for entities attacking us
    if (!combatTarget) {
      const combatSystem = this.world.getSystem?.("combat") as {
        getAttackersOf?: (targetId: string) => string[];
      } | null;
      const attackerIds = combatSystem?.getAttackersOf?.(this.id);
      if (attackerIds && attackerIds.length > 0) {
        // Find closest attacker within combat range (squared distance 9 = 3^2)
        for (const attackerId of attackerIds) {
          const attacker = this.world.entities.items.get(attackerId);
          if (attacker?.position) {
            const dx = attacker.position.x - this.position.x;
            const dz = attacker.position.z - this.position.z;
            if (dx * dx + dz * dz <= 9) {
              combatTarget = { position: attacker.position, id: attacker.id };
              break;
            }
          }
        }
      }
    }

    // OSRS behavior: Only face combat target when STANDING STILL
    // When moving, face movement direction (handled by TileInterpolator)
    const isMoving = this.data.tileMovementActive === true;

    if (combatTarget && !isMoving) {
      // Calculate angle to target (XZ plane only, like RuneScape)
      const dx = combatTarget.position.x - this.position.x;
      const dz = combatTarget.position.z - this.position.z;
      let angle = Math.atan2(dx, dz);

      // VRM 1.0+ models have 180° base rotation, so we need to compensate
      // Otherwise entities face AWAY from each other instead of towards
      angle += Math.PI;

      // Apply rotation to node quaternion
      // PERFORMANCE: Use cached quaternion and static UP vector
      this._tempQuat1.setFromAxisAngle(PlayerRemote._UP, angle);
      this.node.quaternion.copy(this._tempQuat1);
    }

    // Update node matrices for rendering
    if (this.node) {
      this.node.updateMatrix();
      this.node.updateMatrixWorld(true);
    }

    // Update avatar position to follow player
    if (this.avatar && (this.avatar as AvatarWithInstance).instance) {
      const instance = (this.avatar as AvatarWithInstance).instance;
      const instanceWithRaw = instance as unknown as {
        raw?: { scene?: THREE.Object3D };
      };

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

      // Update avatar position/rotation every frame (matches PlayerLocal)
      // The move() method applies the transform matrix with normalization and rotation
      if (instance && instance.move && this.base) {
        instance.move(this.base.matrixWorld);
      }

      // Update avatar animations
      if (instance && instance.update) {
        instance.update(delta);
      }
    }

    // Use server-provided emote state directly - no inference
    // The server/PlayerLocal sends the correct animation state
    if (this.avatar) {
      const serverEmote = this.data.emote as string | undefined;
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
            chopping: Emotes.CHOPPING,
            death: Emotes.DEATH,
          };
          desiredUrl = emoteMap[serverEmote] || Emotes.IDLE;
        }
      } else {
        // Default to idle if no emote data
        desiredUrl = Emotes.IDLE;
      }

      // Update animation if changed
      if (desiredUrl !== this.lastEmote) {
        if ("emote" in this.avatar) {
          (this.avatar as unknown as { emote: string | null }).emote =
            desiredUrl;
        } else if ("setEmote" in this.avatar) {
          (this.avatar as Avatar).setEmote(desiredUrl);
        }
        this.lastEmote = desiredUrl;
      }
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

    // Update nametag position in Nametags system (name only - no health)
    // This matches PlayerLocal behavior - without this, the nametag renders at origin
    if (this.nametag && this.nametag.handle && this.base) {
      // PERFORMANCE: Use cached matrix instead of allocating new one
      this._tempMatrix2.copy(this.base.matrixWorld);
      this._tempMatrix2.elements[13] += 2.2; // Name slightly higher
      this.nametag.handle.move(this._tempMatrix2);
    }

    // Update health bar position in HealthBars system (separate from nametag)
    if (this._healthBarHandle && this.base) {
      // PERFORMANCE: Use cached matrix instead of allocating new one
      this._tempMatrix3.copy(this.base.matrixWorld);
      this._tempMatrix3.elements[13] += 2.0; // Health bar at Y=2.0
      this._healthBarHandle.move(this._tempMatrix3);
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
    const name = this.data.name || "";
    this.nametag.label = speaking ? `» ${name} «` : name;
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
        // Force base to update its matrix so instance.move() gets correct transform
        this.base.updateTransform();
      }
    }
    if (data.q !== undefined) {
      // Skip quaternion updates when TileInterpolator is controlling rotation
      // TileInterpolator handles rotation smoothly for tile-based movement
      const tileControlled = this.data.tileInterpolatorControlled === true;
      if (!tileControlled) {
        // Rotation is no longer stored in EntityData, apply directly to entity transform
        this.lerpQuaternion.pushArray(data.q, this.teleport || null);
        // When explicit rotation update arrives, clear any movement-facing override to avoid fighting network
      }
    }
    if (data.e !== undefined) {
      this.data.emote = data.e;
    }
    if (data.ef !== undefined) {
      this.setEffect(data.ef as string);
    }
    if (data.name !== undefined) {
      this.data.name = data.name as string;
      this.nametag.label = (data.name as string) || "";
    }
    if (data.health !== undefined) {
      const currentHealth = data.health as number;
      const maxHealth = (this.data.maxHealth as number) || 100;

      this.data.health = currentHealth;

      // Update health bar via HealthBars system (separate from nametag)
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
          this._healthBarHandle.show();
        } else {
          this._healthBarHandle.hide();
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
    this.nametag.active = false;
    this.bubbleText.value = msg;
    this.bubble.active = true;
    if (this.chatTimer) clearTimeout(this.chatTimer);
    this.chatTimer = setTimeout(() => {
      this.bubble.active = false;
      this.nametag.active = true;
    }, 5000);
  }

  override destroy(local?: boolean) {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.chatTimer) clearTimeout(this.chatTimer);
    this.base.deactivate();
    this.avatar = undefined;
    this.world.setHot(this, false);
    this.world.emit(EventType.PLAYER_LEFT, { playerId: this.data.id });
    this.aura.deactivate();

    // Clean up health bar from HealthBars system
    if (this._healthBarHandle) {
      this._healthBarHandle.destroy();
      this._healthBarHandle = null;
    }

    this.world.entities.remove(this.data.id);
    // if removed locally we need to broadcast to server/clients
    if (local) {
      this.world.network.send("entityRemoved", { id: this.data.id });
    }
  }

  public toggleInterpolation(enabled: boolean): void {
    this.enableInterpolation = enabled;
  }
}
