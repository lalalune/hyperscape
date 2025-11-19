/**
 * PlayerLocal - Local Player Entity
 *
 * This class represents the player controlled by the current client. It handles:
 * - **Input Processing**: Keyboard, mouse, touch, and gamepad input
 * - **Character Controller**: PhysX capsule-based movement with ground detection
 * - **Camera Control**: Third-person camera rig with orbit, zoom, and collision
 * - **VRM Avatar**: Full VRM avatar with animations and emotes
 * - **UI Interaction**: Inventory, equipment, chat interfaces
 * - **Touch Controls**: On-screen joystick and buttons for mobile
 *
 * **Architecture**:
 *
 * **Movement System**:
 * - Uses PhysX character controller (capsule collider)
 * - Grounded state detection via sphere sweep
 * - Smooth movement with acceleration/deceleration
 * - Jumping with velocity physics
 * - Terrain following with height queries
 * - Gravity and momentum
 *
 * **Input Handling**:
 * - WASD/Arrow keys for movement
 * - Mouse for camera rotation (when pointer locked)
 * - Spacebar for jumping
 * - Number keys for inventory hotbar
 * - Touch controls for mobile (virtual joystick)
 * - Gamepad support
 *
 * **Camera System**:
 * - Third-person orbit camera
 * - Zoom in/out with mouse wheel or pinch
 * - Camera collision detection (pulls camera forward when blocked)
 * - Smooth interpolation for all camera movements
 * - First-person mode when fully zoomed in
 *
 * **Avatar Integration**:
 * - VRM model loading and rendering
 * - Bone-based animations (idle, walk, run, jump)
 * - Emote system (wave, dance, etc.)
 * - Lip-sync and eye blinking
 * - IK for natural poses
 *
 * **UI Systems**:
 * - Inventory overlay (press I or tap bag icon)
 * - Equipment panel
 * - Stats display
 * - Chat input
 * - Interaction prompts
 * - Touch controls overlay (mobile)
 *
 * **Network Sync**:
 * - Sends input to server (click-to-move destination)
 * - Receives authoritative position from server
 * - Local prediction for smooth movement
 * - Server reconciliation for position corrections
 *
 * **Physics**:
 * - Character controller (PhysX)
 * - Ground detection
 * - Slope handling
 * - Jump velocity
 * - Collision response
 *
 * **Runs on**: Client only (browser)
 * **Referenced by**: PlayerSystem, ClientInput, ClientGraphics
 *
 * @public
 */

import type PhysX from "@hyperscape/physx-js-webidl";
import { createNode } from "../../extras/three/createNode";
import { Layers } from "../../physics/Layers";
import { Emotes } from "../../data/playerEmotes";
import THREE from "../../extras/three/three";
import { Nametag, UI, UIText, UIView } from "../../nodes";
import { getPhysX, waitForPhysX } from "../../physics/PhysXManager";
import type { PhysicsHandle } from "../../systems/shared";
import type { TerrainSystem } from "../../systems/shared";
import type {
  Player,
  PlayerCombatData,
  PlayerDeathData,
  PlayerEquipmentItems,
  PlayerHealth,
  Skills,
} from "../../types/core/core";
import { EventType } from "../../types/events";
import {
  ClientLoader,
  ControlBinding,
  NetworkData,
  EntityData,
  LoadedAvatar,
  TouchInfo,
} from "../../types/index";
import type {
  ActorHandle,
  CameraSystem,
  PlayerStickState,
  PlayerTouch,
  PxCapsuleGeometry,
  PxMaterial,
  PxRigidDynamic,
  PxShape,
  PxSphereGeometry,
  QuaternionLike,
  Vector3Like,
  VRMHooks,
} from "../../types/systems/physics";
import type { HotReloadable, XRSystem } from "../../types";

import { vector3ToPxVec3 } from "../../utils/physics/PhysicsUtils";
import { getSystem } from "../../utils/SystemUtils";
import type { World } from "../../core/World";
import { Entity } from "../Entity";

const UP = new THREE.Vector3(0, 1, 0);

interface NodeWithInstance extends THREE.Object3D {
  instance?: THREE.Object3D;
  activate?: (...args: unknown[]) => void;
}

interface AvatarInstance {
  destroy(): void;
  move(matrix: THREE.Matrix4): void;
  update(delta: number): void;
  raw: {
    scene: THREE.Object3D;
  };
  disableRateCheck?: () => void;
  height?: number;
  setEmote?: (emote: string) => void;
}

interface AvatarNode {
  instance: AvatarInstance | null;
  mount?: () => Promise<void>;
  position: THREE.Vector3;
  visible: boolean;
  emote?: string;
  setEmote?: (emote: string) => void;
  ctx: World;
  parent: { matrixWorld: THREE.Matrix4 };
  activate(world: World): void;
  getHeight?: () => number;
  getHeadToHeight?: () => number;
  getBoneTransform?: (boneName: string) => THREE.Matrix4 | null;
  deactivate?: () => void;
}

// Camera system accessor with strong type assumption
function getCameraSystem(world: World): CameraSystem | null {
  // Get the client camera system
  const sys = getSystem(world, "client-camera-system");
  return (sys as unknown as CameraSystem) || null;
}

// Hyperscape-specific object types using the imported interface

// PhysX is available via getPhysX() from PhysXManager

const _UP = new THREE.Vector3(0, 1, 0);
const _DOWN = new THREE.Vector3(0, -1, 0);
const _FORWARD = new THREE.Vector3(0, 0, -1);
// Removed unused constant: BACKWARD
const _SCALE_IDENTITY = new THREE.Vector3(1, 1, 1);
// Removed unused constant: POINTER_LOOK_SPEED
// Removed unused constant: PAN_LOOK_SPEED
// Removed unused constant: ZOOM_SPEED
// Removed unused constant: MIN_ZOOM
// Removed unused constant: MAX_ZOOM
// Removed unused constant: STICK_MAX_DISTANCE
const DEFAULT_CAM_HEIGHT = 1.2;

// Utility function for roles check
function hasRole(roles: string[], role: string): boolean {
  return roles.includes(role);
}

// Constants for common game values
const DEG2RAD = Math.PI / 180;
const _RAD2DEG = 180 / Math.PI;

// Constants for control priorities
const ControlPriorities = {
  PLAYER: 1000,
};

// Removed unused constant: Emotes

// Physics layers utility
function _getPhysicsLayers() {
  return {
    environment: { group: 1, mask: 0xffffffff },
    player: { group: 2, mask: 0xffffffff },
    prop: { group: 4, mask: 0xffffffff },
  };
}

// Utility functions for PhysX transform operations
function _safePhysXTransformPosition(
  vector: THREE.Vector3,
  transform: PhysX.PxTransform,
): void {
  // Strong type assumption - transform has p property
  const p = transform.p;
  p.x = vector.x;
  p.y = vector.y;
  p.z = vector.z;
}

// Temp variables for matrix operations - allocated once
const _tempComposePos = new THREE.Vector3();
const _tempComposeQuat = new THREE.Quaternion();
const _tempComposeScale = new THREE.Vector3();
const _tempDecomposePos = new THREE.Vector3();
const _tempDecomposeQuat = new THREE.Quaternion();
const _tempDecomposeScale = new THREE.Vector3();

function _safePhysXTransformQuaternion(
  quat: THREE.Quaternion,
  transform: PhysX.PxTransform,
): void {
  // Strong type assumption - transform has q property
  const q = transform.q;
  q.x = quat.x;
  q.y = quat.y;
  q.z = quat.z;
  q.w = quat.w;
}

// Matrix composition utility - no longer allocates
function _safeMatrixCompose(
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  scale: THREE.Vector3,
): void {
  // Reuse temp vectors instead of creating new ones
  _tempComposePos.copy(position);
  _tempComposeQuat.copy(quaternion);
  _tempComposeScale.copy(scale);

  // Use proper THREE.js method
  matrix.compose(_tempComposePos, _tempComposeQuat, _tempComposeScale);
}

// Matrix decomposition utility - no longer allocates
function _safeMatrixDecompose(
  matrix: THREE.Matrix4,
  position: Vector3Like,
  quaternion: QuaternionLike,
  scale: Vector3Like,
): void {
  // Use pre-allocated temp variables
  matrix.decompose(_tempDecomposePos, _tempDecomposeQuat, _tempDecomposeScale);

  // Copy values back
  if (position.copy) {
    position.copy(_tempDecomposePos);
  } else {
    position.x = _tempDecomposePos.x;
    position.y = _tempDecomposePos.y;
    position.z = _tempDecomposePos.z;
  }

  if (quaternion.copy) {
    quaternion.copy(_tempDecomposeQuat);
  } else {
    quaternion.x = _tempDecomposeQuat.x;
    quaternion.y = _tempDecomposeQuat.y;
    quaternion.z = _tempDecomposeQuat.z;
    quaternion.w = _tempDecomposeQuat.w;
  }

  if (scale.copy) {
    scale.copy(_tempDecomposeScale);
  } else {
    scale.x = _tempDecomposeScale.x;
    scale.y = _tempDecomposeScale.y;
    scale.z = _tempDecomposeScale.z;
  }
}

// Removed unused function: clamp

// Rotation binding utility
function bindRotations(quaternion: THREE.Quaternion, euler: THREE.Euler): void {
  // THREE.Euler doesn't have _onChange, sync manually when needed
  quaternion.setFromEuler(euler);
}

// Removed unused interface: Camera

// Removed unused interface: CapsuleHandle

const v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _v6 = new THREE.Vector3();
const _e1 = new THREE.Euler(0, 0, 0, "YXZ");
const q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _q4 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _m3 = new THREE.Matrix4();

// Removed unused interface: PlayerState

export class PlayerLocal extends Entity implements HotReloadable {
  private avatarDebugLogged: boolean = false;
  // RS3-style run energy
  public stamina: number = 100;
  // Tunable RS-style stamina rates (percent per second). Adjust to match desired feel exactly.
  private readonly staminaDrainPerSecond: number = 2; // drain while running
  private readonly staminaRegenWhileWalkingPerSecond: number = 2; // regen while walking
  private readonly staminaRegenPerSecond: number = 4; // regen while idle
  // Internal helper: prevent spamming run->walk requests when energy hits 0
  private autoRunSwitchSent: boolean = false;
  // Implement HotReloadable interface
  hotReload?(): void {
    // Implementation for hot reload functionality
  }

  // Player interface implementation
  hyperscapePlayerId: string = "";
  alive: boolean = true;
  // Player interface properties (separate from Entity properties to avoid conflicts)
  private _playerHealth: PlayerHealth = { current: 100, max: 100 };
  skills: Skills = {
    attack: { level: 1, xp: 0 },
    strength: { level: 1, xp: 0 },
    defense: { level: 1, xp: 0 },
    constitution: { level: 1, xp: 0 },
    ranged: { level: 1, xp: 0 },
    woodcutting: { level: 1, xp: 0 },
    fishing: { level: 1, xp: 0 },
    firemaking: { level: 1, xp: 0 },
    cooking: { level: 1, xp: 0 },
  };
  equipment: PlayerEquipmentItems = {
    weapon: null,
    shield: null,
    helmet: null,
    body: null,
    legs: null,
    arrows: null,
  };
  inventory?: { items?: unknown[] } = { items: [] };
  coins: number = 0;
  combat: PlayerCombatData = {
    combatLevel: 1,
    combatStyle: "attack",
    inCombat: false,
    combatTarget: null,
  };
  stats?: {
    attack: number;
    strength: number;
    defense: number;
    constitution: number;
  };
  death: PlayerDeathData = {
    respawnTime: 0,
    deathLocation: { x: 0, y: 0, z: 0 },
  };
  lastAction: string | null = null;
  lastSaveTime: number = Date.now();
  sessionId: string | null = null;

  /**
   * Get Player interface representation for compatibility with systems that expect Player
   */
  getPlayerData(): Player {
    return {
      id: this.id,
      hyperscapePlayerId: this.hyperscapePlayerId,
      name: this.data.name || "Unknown Player",
      health: this._playerHealth,
      alive: this.alive,
      stamina: { current: this.stamina, max: 100 },
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      skills: this.skills,
      equipment: this.equipment,
      inventory: this.inventory,
      coins: this.coins,
      combat: this.combat,
      stats: this.stats,
      death: this.death,
      lastAction: this.lastAction,
      lastSaveTime: this.lastSaveTime,
      sessionId: this.sessionId,
      node: {
        position: this.position,
        quaternion: this.rotation,
      },
      data: {
        id: this.data.id as string,
        name: (this.data.name as string) || "Unknown Player",
        health: this.health,
        roles: this.data.roles as string[] | undefined,
        owner: this.data.owner as string | undefined,
        effect: this.data.effect,
      },
      avatar: this.avatar,
      setPosition: this.setPosition.bind(this),
    };
  }

  // Expose playerData as a getter for UI access (StatusBars reads player.playerData)
  get playerData(): Player {
    return this.getPlayerData();
  }

  // Bridge avatar between Entity (Avatar class) and Player interface
  get avatar():
    | {
        getHeight?: () => number;
        getHeadToHeight?: () => number;
        setEmote?: (emote: string) => void;
        getBoneTransform?: (boneName: string) => THREE.Matrix4 | null;
      }
    | undefined {
    if (!this._avatar) return undefined;

    return {
      getHeight: () =>
        this._avatar && this._avatar.getHeight ? this._avatar.getHeight() : 1.8,
      getHeadToHeight: () =>
        this._avatar && this._avatar.getHeadToHeight
          ? this._avatar!.getHeadToHeight()
          : 1.6,
      setEmote: (emote: string) => {
        if (this._avatar && this._avatar.setEmote) this._avatar.setEmote(emote);
      },
      getBoneTransform: (boneName: string) =>
        this._avatar && this._avatar.getBoneTransform
          ? this._avatar.getBoneTransform(boneName)
          : null,
    };
  }

  // Internal avatar reference (rename existing avatar property)
  private _avatar?: AvatarNode;

  isPlayer: boolean;
  // Explicit local flag for tests and systems that distinguish local vs remote
  isLocal: boolean = true;
  mass: number = 1;
  gravity: number = 20;
  effectiveGravity: number = 20;
  jumpHeight: number = 1.5;
  capsuleRadius: number = 0.3;
  capsuleHeight: number = 1.6;
  grounded: boolean = false;
  groundAngle: number = 0;
  groundNormal: THREE.Vector3 = new THREE.Vector3().copy(UP);
  groundSweepRadius: number = 0.29;
  groundSweepGeometry: PxSphereGeometry | PxCapsuleGeometry | PxShape | null =
    null;
  pushForce: THREE.Vector3 | null = null;
  pushForceInit: boolean = false;
  slipping: boolean = false;
  jumped: boolean = false;
  jumping: boolean = false;
  justLeftGround: boolean = false;
  fallTimer: number = 0;
  falling: boolean = false;
  moveDir: THREE.Vector3 = new THREE.Vector3();
  moving: boolean = false;
  lastJumpAt: number = 0;
  flying: boolean = false;
  flyForce: number = 100;
  flyDrag: number = 300;
  flyDir: THREE.Vector3 = new THREE.Vector3();
  platform: {
    actor: Record<string, unknown> | null;
    prevTransform: THREE.Matrix4;
  } = {
    actor: null,
    prevTransform: new THREE.Matrix4(),
  };
  speaking: boolean = false;
  lastSendAt: number = 0;
  base: THREE.Group | undefined = undefined;
  aura: THREE.Group | null = null;
  nametag: Nametag | null = null;
  bubble: UI | null = null;
  bubbleBox: UIView | null = null;
  bubbleText: UIText | null = null;
  camHeight: number = DEFAULT_CAM_HEIGHT;
  cam: {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    rotation: THREE.Euler;
    zoom: number;
  } = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    rotation: new THREE.Euler(0, 0, 0, "YXZ"),
    zoom: 1.5,
  };
  avatarUrl?: string;
  private loadingAvatarUrl?: string;

  material: PxMaterial | null = null;
  capsule: PxRigidDynamic | null = null;
  capsuleHandle: ActorHandle | null = null; // Physics handle for the capsule
  control: ControlBinding | undefined;
  stick?: PlayerStickState;
  pan?: PlayerTouch;
  capsuleDisabled?: boolean;
  materialMax?: boolean;
  airJumping?: boolean;
  airJumped?: boolean;
  fallStartY?: number;
  fallDistance?: number;
  onEffectEnd?: () => void;
  lastState: {
    p?: THREE.Vector3;
    q?: THREE.Quaternion;
    e?: string;
  } = {};
  // Track last interpolation frame to avoid duplicate transform writes per frame
  private lastInterpolatedFrame: number = -1;
  emote?: string;
  effect?: string;
  running: boolean = false;
  rotSpeed: number = 5;
  clickMoveTarget: THREE.Vector3 | null = null;
  serverPosition: THREE.Vector3; // Track server's authoritative position - NEVER undefined
  lastServerUpdate: number = 0; // Time of last server position update
  private positionValidationInterval?: NodeJS.Timeout;
  // Add pendingMoves array
  private pendingMoves: { seq: number; pos: THREE.Vector3 }[] = [];
  private _tempVec3 = new THREE.Vector3();

  // Avatar retry mechanism
  private avatarRetryInterval: NodeJS.Timeout | null = null;
  // Add predictedStates array
  // In update: predict physics, push to predictedStates
  // On server correction: pop matched, smooth to correct if mismatch > threshold

  constructor(
    world: World,
    data: NetworkData & {
      position?: [number, number, number];
      avatarUrl?: string;
    },
    local?: boolean,
  ) {
    super(world, { ...data, type: "player" }, local);
    this.isPlayer = true;

    // Initialize Player interface properties
    // Health should equal constitution level - use actual entity health values
    // If health is provided in data, use it; otherwise use entity's health after super() call
    const healthFromData = (data as { health?: number }).health;
    const maxHealthFromData = (data as { maxHealth?: number }).maxHealth;
    const currentHealth =
      Number.isFinite(healthFromData) &&
      healthFromData !== undefined &&
      healthFromData > 0
        ? healthFromData
        : Number.isFinite(this.health) && this.health > 0
          ? this.health
          : 10;
    const maxHealth =
      Number.isFinite(maxHealthFromData) &&
      maxHealthFromData !== undefined &&
      maxHealthFromData > 0
        ? maxHealthFromData
        : Number.isFinite(this.maxHealth) && this.maxHealth > 0
          ? this.maxHealth
          : 10;
    this._playerHealth = {
      current: currentHealth,
      max: maxHealth,
    };
    this.hyperscapePlayerId = data.id || "";

    // Initialize emote to idle if not provided
    if (!this.emote && !data.e) {
      this.emote = "idle";
      this.data.emote = "idle";
    }

    // CRITICAL: Initialize server position BEFORE anything else
    // Server position is ABSOLUTE TRUTH - use it or crash
    if (
      data.position &&
      Array.isArray(data.position) &&
      data.position.length === 3
    ) {
      this.serverPosition = new THREE.Vector3(
        data.position[0],
        data.position[1],
        data.position[2],
      );
      // IMMEDIATELY set our position to server position
      this.position.set(data.position[0], data.position[1], data.position[2]);
      this.node.position.set(
        data.position[0],
        data.position[1],
        data.position[2],
      );

      // CRASH if Y position is invalid at spawn
      if (data.position[1] < -5) {
        throw new Error(
          `[PlayerLocal] FATAL: Spawning below terrain at Y=${data.position[1]}! Server sent invalid spawn position.`,
        );
      }
      if (data.position[1] > 200) {
        throw new Error(
          `[PlayerLocal] FATAL: Spawning too high at Y=${data.position[1]}! Server sent invalid spawn position.`,
        );
      }

      // Warn for suspicious but not fatal positions
      if (data.position[1] < 0 || data.position[1] > 100) {
        console.warn(
          `[PlayerLocal] WARNING: Starting with unusual Y position: ${data.position[1]}`,
        );
      }
    } else {
      // NO DEFAULT Y=0 ALLOWED - crash if no position
      throw new Error(
        "[PlayerLocal] FATAL: No server position provided in constructor! This will cause Y=0 spawn bug.",
      );
    }

    this.lastServerUpdate = performance.now();

    // Start aggressive position validation
    this.startPositionValidation();
  }

  private startPositionValidation(): void {
    // Validate position every 100ms initially, then slower
    let checkCount = 0;
    this.positionValidationInterval = setInterval(() => {
      checkCount++;

      // Call terrain validation more frequently in first 5 seconds
      if (checkCount < 50) {
        // 50 * 100ms = 5 seconds
        this.validateTerrainPosition();
      } else if (checkCount % 5 === 0) {
        // Then every 500ms
        this.validateTerrainPosition();
      }
      // HARD CRASH if player is falling (Y position too low)
      if (this.position.y < -10) {
        const errorDetails = {
          clientPosition: {
            x: this.position.x.toFixed(2),
            y: this.position.y.toFixed(2),
            z: this.position.z.toFixed(2),
          },
          serverPosition: this.serverPosition
            ? {
                x: this.serverPosition.x.toFixed(2),
                y: this.serverPosition.y.toFixed(2),
                z: this.serverPosition.z.toFixed(2),
              }
            : "null",
          basePosition: this.base
            ? {
                x: this.base.position.x.toFixed(2),
                y: this.base.position.y.toFixed(2),
                z: this.base.position.z.toFixed(2),
              }
            : "null",
          hasCapsule: !!this.capsule,
          playerId: this.id,
          timestamp: new Date().toISOString(),
        };

        console.error("[PlayerLocal] FATAL: PLAYER HAS FALLEN BELOW TERRAIN!");
        console.error("[PlayerLocal] Error details:", errorDetails);

        // Clear the interval before throwing
        clearInterval(this.positionValidationInterval);

        // CRASH THE APPLICATION
        throw new Error(
          `[PlayerLocal] FATAL: Player has fallen below terrain at Y=${this.position.y.toFixed(2)}! This indicates a critical movement system failure.\n\nDebug info:\n${JSON.stringify(errorDetails, null, 2)}`,
        );
      }

      // Also crash if Y is unreasonably high
      if (this.position.y > 200) {
        const errorDetails = {
          clientY: this.position.y.toFixed(2),
          serverY: this.serverPosition?.y?.toFixed(2) || "N/A",
          playerId: this.id,
        };

        clearInterval(this.positionValidationInterval);
        throw new Error(
          `[PlayerLocal] FATAL: Player is too high at Y=${this.position.y.toFixed(2)}!\n\nDebug: ${JSON.stringify(errorDetails)}`,
        );
      }

      // Check for large divergence from server
      if (this.serverPosition) {
        const dist = this.position.distanceTo(this.serverPosition);
        if (dist > 100) {
          console.warn(
            "[PlayerLocal] WARNING: Very large divergence detected, snapping to server.",
            {
              client: this.position,
              server: this.serverPosition,
              distance: dist,
            },
          );
          // Snap to server position
          this.position.copy(this.serverPosition);
          // Don't set base.position since it's a child of node (relative position should be 0,0,0)
          if (this.capsule && getPhysX()) {
            const PHYSX = getPhysX()!;
            const pose = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity);
            pose.p.x = this.serverPosition.x;
            pose.p.y = this.serverPosition.y;
            pose.p.z = this.serverPosition.z;
            this.capsule.setGlobalPose(pose);
          }
        }
      }
    }, 100); // Check every 100ms for better responsiveness
  }

  private validateTerrainPosition(): void {
    // Follow terrain height
    const terrain = this.world.getSystem<TerrainSystem>(
      "terrain",
    ) as TerrainSystem;

    // Check if terrain system exists before using it
    if (!terrain) {
      // Terrain system not loaded yet, skip validation
      return;
    }

    const terrainHeight = terrain.getHeightAt(this.position.x, this.position.z);
    const targetY = terrainHeight + 0.1; // Small offset above terrain
    const diff = targetY - this.position.y;

    // Snap up if below terrain, lerp down if above
    if (diff > 0.1) {
      // Below terrain - snap up
      this.position.y = targetY;
    } else if (diff < -0.5) {
      // Above terrain - interpolate down
      this.position.y += diff * 0.15;
    }
  }

  /**
   * Override initializeVisuals to skip UIRenderer-based UI elements
   * PlayerLocal uses its own Nametag node system instead
   */
  protected initializeVisuals(): void {
    // Skip UIRenderer - we use Nametag nodes instead
    // Do not call super.initializeVisuals()
  }

  private async waitForTerrain(): Promise<void> {
    // Get terrain system with proper type
    const terrainSystem = this.world.getSystem(
      "terrain",
    ) as TerrainSystem | null;

    if (!terrainSystem) {
      // No terrain system, proceed without wait
      return;
    }

    // Strong type assumption - TerrainSystem has isReady() method
    // Check if terrain is already initialized
    if (terrainSystem.isReady()) {
      return;
    }

    // Wait for terrain initialization with timeout
    const maxWaitTime = 10000; // 10 seconds timeout
    const startTime = Date.now();

    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (terrainSystem.isReady()) {
          clearInterval(checkInterval);
          resolve();
        } else if (elapsed > maxWaitTime) {
          // Timeout - proceed anyway
          console.warn(
            "[PlayerLocal] Terrain wait timeout after",
            elapsed,
            "ms - proceeding anyway",
          );
          clearInterval(checkInterval);
          resolve();
        }
      }, 100); // Check every 100ms
    });
  }

  // Override modify to handle shorthand network keys like PlayerRemote does
  override modify(data: Partial<EntityData>): void {
    // Map shorthand keys to full property names
    // Handle combat state updates
    if ("inCombat" in data) {
      this.combat.inCombat = data.inCombat as boolean;
    }
    if ("combatTarget" in data) {
      this.combat.combatTarget = data.combatTarget as string | null;
    }

    if ("e" in data && data.e !== undefined) {
      const newEmote = data.e as string;

      // CRITICAL: Block emote changes during death EXCEPT for death emote itself
      // This prevents clicks from interrupting the death animation
      const isDyingState = (this as any).isDying || (this.data as any).isDying;
      const shouldBlockEmote = isDyingState && newEmote !== "death";

      if (shouldBlockEmote) {
        // Skip this emote change but continue processing other updates
      } else {
        // Apply emote (normal emotes or death emote during death)

        this.data.emote = newEmote;
        this.emote = newEmote;

        // Immediately apply animation to avatar
        if (this._avatar) {
          const avatarNode = this._avatar as AvatarNode;
          const emoteMap: Record<string, string> = {
            idle: Emotes.IDLE,
            walk: Emotes.WALK,
            run: Emotes.RUN,
            combat: Emotes.COMBAT,
            death: Emotes.DEATH,
          };
          const emoteUrl = emoteMap[this.emote] || Emotes.IDLE;

          if (avatarNode.setEmote) {
            avatarNode.setEmote(emoteUrl);
          } else if (avatarNode.emote !== undefined) {
            avatarNode.emote = emoteUrl;
          }
        }
      }
    }

    if ("p" in data && data.p !== undefined) {
      // Position update - for server-authoritative movement
      const pos = data.p as number[];
      if (pos.length === 3) {
        // CRITICAL: Block position updates during death animation
        // Server might still be sending position packets from queued movement
        // BUT continue processing other updates (like emote for death animation!)
        if ((this as any).isDying || (this.data as any).isDying) {
          // Ignore position updates during death
        } else {
          // Store as server position for reference
          this.serverPosition.set(pos[0], pos[1], pos[2]);
          this.lastServerUpdate = Date.now();

          // Apply position to all systems
          // Use instant updates to match server authority
          this.position.set(pos[0], pos[1], pos[2]);
          this.node.position.set(pos[0], pos[1], pos[2]);

          // Base should stay at origin relative to node (it's a child)
          // This prevents double-transforms
          if (this.base) {
            this.base.position.set(0, 0, 0);
          }

          // Update physics capsule for collision detection
          if (this.capsule) {
            const pose = this.capsule.getGlobalPose();
            if (pose?.p) {
              pose.p.x = pos[0];
              pose.p.y = pos[1];
              pose.p.z = pos[2];
              this.capsule.setGlobalPose(pose, true); // true = wake up touching actors
            }
          }

          // Force matrix updates to ensure camera sees new position immediately
          this.node.updateMatrix();
          this.node.updateMatrixWorld(true);
        }
      }
    }

    if ("q" in data && data.q !== undefined) {
      // Quaternion update - apply to rotation
      const quat = data.q as number[];
      if (quat.length === 4 && this.base) {
        this.base.quaternion.set(quat[0], quat[1], quat[2], quat[3]);
      }
    }

    if ("v" in data && data.v !== undefined) {
      // Velocity update
      const vel = data.v as number[];
      if (vel.length === 3) {
        // CRITICAL: Block velocity updates during death
        // BUT continue processing other updates (like emote for death animation!)
        if ((this as any).isDying || (this.data as any).isDying) {
          // Ignore velocity updates during death
        } else {
          this.velocity.set(vel[0], vel[1], vel[2]);
        }
      }
    }

    // Handle health updates from server
    if ("health" in data && data.health !== undefined) {
      const newHealth = data.health as number;
      this.setHealth(newHealth);
      // Update _playerHealth for getPlayerData() which the UI reads
      this._playerHealth.current = newHealth;
      if (this.nametag) {
        this.nametag.health = newHealth;
      }
    }
    if ("maxHealth" in data && data.maxHealth !== undefined) {
      this.maxHealth = data.maxHealth as number;
      this.data.maxHealth = this.maxHealth;
      // Update _playerHealth for getPlayerData() which the UI reads
      this._playerHealth.max = this.maxHealth;
    }

    // Call parent modify for other properties
    super.modify(data);
  }

  async init(): Promise<void> {
    // Make sure we're added to the world's entities
    if (!this.world.entities.has(this.id)) {
      this.world.entities.items.set(this.id, this);
    }

    // Wait for terrain to be ready before proceeding
    await this.waitForTerrain();

    // Register for physics updates
    this.world.setHot(this, true);

    // Verify we're actually in the hot set
    // Debug logging removed to prevent memory leak

    this.mass = 1;
    this.gravity = 20;
    this.effectiveGravity = this.gravity * this.mass;
    this.jumpHeight = 1.5;

    this.capsuleRadius = 0.3;
    this.capsuleHeight = 1.6;

    this.grounded = false;
    this.groundAngle = 0;
    this.groundNormal.copy(UP);
    this.groundSweepRadius = this.capsuleRadius - 0.01; // slighty smaller than player
    // groundSweepGeometry will be created later when PhysX is available

    this.pushForce = null;
    this.pushForceInit = false;

    this.slipping = false;

    this.jumped = false;
    this.jumping = false;
    this.justLeftGround = false;

    this.fallTimer = 0;
    this.falling = false;

    this.moveDir = new THREE.Vector3();
    this.moving = false;

    this.lastJumpAt = 0;
    this.flying = false;
    this.flyForce = 100;
    this.flyDrag = 300;
    this.flyDir = new THREE.Vector3();

    this.platform = {
      actor: null,
      prevTransform: new THREE.Matrix4(),
    };

    this.speaking = false;

    this.lastSendAt = 0;

    // Create a proper THREE.Group for the base (not a custom Node)
    // This ensures compatibility with Three.js scene graph
    this.base = new THREE.Group();
    if (this.base) {
      this.base.name = "player-base";
    }
    if (!this.base) {
      throw new Error("Failed to create base node for PlayerLocal");
    }

    // CRITICAL: Add base to the entity's node so it's part of the scene graph!
    this.node.add(this.base);

    // Attach the camera rig to the player's base so it follows the player
    if (this.world.rig && this.base) {
      this.base.add(this.world.rig);
    }

    // Base node starts at player's position to avoid initial camera looking underground

    // CRITICAL FIX: The Entity constructor already parsed position from data and set it on this.node.position
    // We should use this.position (which is this.node.position) NOT this.data.position!
    // The server has already calculated the correct terrain height and sent it to us.

    // Position logging removed to prevent memory leak

    // The Entity constructor has already set our position from the server snapshot
    // We just need to use it!
    let spawnX = this.position.x;
    let spawnY = this.position.y;
    let spawnZ = this.position.z;

    if (spawnX === 0 && spawnY === 0 && spawnZ === 0) {
      spawnX = 0;
      spawnY = 10;
      spawnZ = 0;

      this.position.set(spawnX, spawnY, spawnZ);
    }

    // Ensure base node matches the entity's current position (from server)
    if (this.base) {
      // If we have a server position, use that instead of potentially incorrect local position
      if (this.serverPosition) {
        this.position.copy(this.serverPosition);
        // Base is a child of node, so it should stay at relative (0,0,0)
      } else {
        // Base is a child of node, so it should stay at relative (0,0,0)
      }

      // CRITICAL: Validate player is on terrain after spawn
      this.validateTerrainPosition();
    }
    // Debug cube removed to prevent memory leak
    if ("visible" in this.base) {
      Object.defineProperty(this.base, "visible", {
        value: true,
        writable: true,
      });
    }
    this.active = true;

    // Create a proper THREE.Group for the aura
    this.aura = new THREE.Group();
    if (this.aura) {
      this.aura.name = "player-aura";
    }
    if (!this.aura) {
      throw new Error("Failed to create aura node for PlayerLocal");
    }

    this.nametag = createNode("nametag", {
      label: "",
      health: this.data.health,
      active: false,
    }) as Nametag;
    if (!this.nametag) {
      throw new Error("Failed to create nametag node for PlayerLocal");
    }
    // Activate the nametag to create its THREE.js representation
    if (this.nametag.activate) {
      this.nametag.activate(this.world);
    }
    // Add the nametag's THREE.js object if it exists
    const nametagInstance = (this.nametag as unknown as NodeWithInstance)
      .instance;
    if (nametagInstance && nametagInstance.isObject3D) {
      this.aura.add(nametagInstance);
    }

    this.bubble = createNode("ui", {
      id: "bubble",
      // space: 'screen',
      width: 300,
      height: 512,
      // size: 0.01,
      pivot: "bottom-center",
      // pivot: 'top-left',
      billboard: "full",
      scaler: [3, 30],
      justifyContent: "flex-end",
      alignItems: "center",
      active: false,
    }) as UI;
    if (!this.bubble) {
      throw new Error("Failed to create bubble node for PlayerLocal");
    }
    this.bubbleBox = createNode("uiview", {
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      borderRadius: 10,
      padding: 10,
    }) as UIView;
    if (!this.bubbleBox) {
      throw new Error("Failed to create bubbleBox node for PlayerLocal");
    }
    this.bubbleText = createNode("uitext", {
      color: "white",
      fontWeight: 100,
      lineHeight: 1.4,
      fontSize: 16,
    }) as UIText;
    if (!this.bubbleText) {
      throw new Error("Failed to create bubbleText node for PlayerLocal");
    }
    this.bubble.add(this.bubbleBox);
    this.bubbleBox.add(this.bubbleText);
    // Activate the bubble UI to create its THREE.js representation
    if (this.bubble.activate) {
      this.bubble.activate(this.world);
    }
    // Add the bubble's THREE.js object if it exists
    const bubbleInstance = (this.bubble as unknown as NodeWithInstance)
      .instance;
    if (bubbleInstance && bubbleInstance.isObject3D) {
      this.aura.add(bubbleInstance);
    }

    // THREE.Groups don't need activation, they're just containers
    // The custom nodes inside them (nametag, bubble) will activate themselves

    // Note: Group nodes don't have Three.js representations - their children handle their own scene addition
    if (this.base) {
      // Also add aura to base for nametag/bubble
      this.base.add(this.aura);
    }

    this.camHeight = DEFAULT_CAM_HEIGHT;

    this.cam = {
      position: new THREE.Vector3().copy(this.position),
      quaternion: new THREE.Quaternion(),
      rotation: new THREE.Euler(0, 0, 0, "YXZ"),
      zoom: 3.0, // Set reasonable default zoom instead of 1.5
    };
    this.cam.position.y += this.camHeight;
    bindRotations(this.cam.quaternion, this.cam.rotation);
    this.cam.quaternion.copy(this.rotation);
    this.cam.rotation.x += -15 * DEG2RAD;

    if (this.world.loader?.preloader) {
      await this.world.loader.preloader;
    }

    await this.applyAvatar();

    // Initialize physics capsule
    await this.initCapsule();
    this.initControl();

    // Initialize camera system
    this.initCameraSystem();

    // Retry camera initialization after a delay in case systems aren't ready yet
    setTimeout(() => {
      const _cameraSystem = getSystem(this.world, "client-camera-system");
      this.world.emit(EventType.CAMERA_SET_TARGET, { target: this });
    }, 1000);

    // Movement is handled by physics directly
    // Don't clamp to terrain on init - trust the server position
    // The server has already calculated the correct terrain height

    this.world.setHot(this, true);

    // Register with systems and establish integration
    this.world.emit(EventType.PLAYER_REGISTERED, { playerId: this.data.id });

    // Listen for system events to maintain integration
    this.world.on(
      EventType.PLAYER_HEALTH_UPDATED,
      this.handleHealthChange.bind(this),
    );
    this.world.on(
      EventType.PLAYER_TELEPORT_REQUEST,
      this.handleTeleport.bind(this),
    );
    this.world.on(
      EventType.PLAYER_SET_DEAD,
      this.handlePlayerSetDead.bind(this),
    );
    this.world.on(
      EventType.PLAYER_RESPAWNED,
      this.handlePlayerRespawned.bind(this),
    );

    // Signal to UI that the world is ready
    this.world.emit(EventType.READY);
  }

  getAvatarUrl(): string {
    return (
      (this.data.sessionAvatar as string) ||
      (this.data.avatar as string) ||
      "asset://avatar.vrm"
    );
  }

  async applyAvatar(): Promise<void> {
    const avatarUrl = this.getAvatarUrl();

    // Skip avatar loading on server (no loader system)
    if (!this.world.loader) {
      return;
    }

    // If we already have the correct avatar loaded, just reuse it
    if (this.avatarUrl === avatarUrl && this._avatar) {
      return;
    }

    // Clear retry interval if it exists since loader is now available
    if (this.avatarRetryInterval) {
      clearInterval(this.avatarRetryInterval);
      this.avatarRetryInterval = null;
    }

    // Prevent concurrent loads for the same URL
    if (this.loadingAvatarUrl === avatarUrl) {
      return;
    }
    this.loadingAvatarUrl = avatarUrl;

    // Only destroy if we're loading a different avatar
    if (this._avatar && this.avatarUrl !== avatarUrl) {
      const oldInstance = (this._avatar as AvatarNode).instance;
      if (oldInstance && oldInstance.destroy) {
        oldInstance.destroy(); // This calls hooks.scene.remove(vrm.scene)
      }
      this._avatar = undefined;
    }

    // Only clear cache if we're loading a different avatar URL
    if (this.avatarUrl !== avatarUrl) {
      const loader = this.world.loader as ClientLoader;
      if (loader) {
        // Clear cache for the old avatar URL only
        const oldKey = `avatar/${this.avatarUrl}`;
        if (loader.promises.has(oldKey)) {
          loader.promises.delete(oldKey);
          loader.results.delete(oldKey);
        }
      }
    }

    const src = (await this.world.loader!.load(
      "avatar",
      avatarUrl,
    )) as LoadedAvatar;

    if (this._avatar && this._avatar.deactivate) {
      this._avatar.deactivate();
    }

    // Pass VRM hooks so the avatar can add itself to the scene
    // Use world.stage.scene and manually update position
    const vrmHooks = {
      scene: this.world.stage.scene,
      octree: this.world.stage.octree,
      camera: this.world.camera,
      loader: this.world.loader,
    };
    const nodeMap = src.toNodes(vrmHooks);

    // Strong type assumption - nodeMap is a Map
    // Get the root node (which contains the avatar as a child)
    const rootNode = nodeMap.get("root");
    if (!rootNode) {
      throw new Error(
        `No root node found in loaded asset. Available keys: ${Array.from(nodeMap.keys())}`,
      );
    }

    // The avatar node is a child of the root node or in the map directly
    const avatarNode = nodeMap.get("avatar") || rootNode;

    // Use the avatar node
    const nodeToUse = avatarNode;

    // Store the node - it's an Avatar node that needs mounting
    this._avatar = nodeToUse as unknown as AvatarNode;

    // IMPORTANT: For Avatar nodes to work, they need their context set and to be mounted
    // Set the context for the avatar node
    interface AvatarNodeInternal {
      ctx: World;
      hooks: VRMHooks;
    }
    const avatarAsNode = nodeToUse as unknown as AvatarNode &
      AvatarNodeInternal;
    avatarAsNode.ctx = this.world;

    // CRITICAL: ALWAYS update the hooks on the avatar node BEFORE mounting
    // The avatar was created with ClientLoader's hooks, but we need to use
    // the world's stage scene for proper rendering
    const vrmHooksTyped: VRMHooks = {
      scene: vrmHooks.scene,
      octree: vrmHooks.octree as VRMHooks["octree"],
      camera: vrmHooks.camera,
      loader: vrmHooks.loader,
    };
    avatarAsNode.hooks = vrmHooksTyped;

    // CRITICAL: Update base matrix BEFORE setting as parent
    // The avatar needs the correct world position when created
    this.base!.updateMatrix();
    this.base!.updateMatrixWorld(true);

    // Set the parent so the node knows where it belongs in the hierarchy
    avatarAsNode.parent = { matrixWorld: this.base!.matrixWorld };

    // CRITICAL: Avatar node position should be at origin (0,0,0)
    // The instance.move() method will position it at the base's world position
    avatarAsNode.position.set(0, 0, 0);

    // Activate the node (this creates the Three.js representation)
    avatarAsNode.activate!(this.world);

    // Mount the avatar node to create its instance
    await avatarAsNode.mount!();

    // The Avatar node handles its own Three.js representation
    // We don't need to manually add anything since the node is already added to base
    // Just ensure visibility and disable rate check
    const instance = (nodeToUse as unknown as AvatarNode).instance;

    // Disable rate check
    if (instance?.disableRateCheck) {
      instance.disableRateCheck();
    }

    // Set up nametag and bubble positioning
    const headHeight = this._avatar!.getHeadToHeight!()!;
    const safeHeadHeight = headHeight ?? 1.8;
    this.nametag!.position.y = safeHeadHeight + 0.2;
    this.bubble!.position.y = safeHeadHeight + 0.2;
    if (!this.bubble!.active) {
      this.nametag!.active = true;
    }

    // Set camera height
    const avatarHeight = (this._avatar as unknown as { height: number }).height;
    this.camHeight = Math.max(1.2, avatarHeight * 0.9);

    // Make avatar visible and ensure proper positioning
    (this._avatar as { visible: boolean }).visible = true;
    (this._avatar as AvatarNode).position.set(0, 0, 0);

    // Verify avatar instance is actually in the scene graph
    const vrmInstance = (this._avatar as AvatarNode).instance;
    let parent = vrmInstance!.raw.scene.parent;
    let depth = 0;
    while (parent && depth < 10) {
      if (parent === this.world.stage.scene) {
        break;
      }
      parent = parent.parent;
      depth++;
    }
    if (!parent || parent !== this.world.stage.scene) {
      throw new Error(
        "[PlayerLocal] Avatar VRM scene NOT in world scene graph!",
      );
    }

    this.avatarUrl = avatarUrl;

    // Emit avatar ready event for camera system
    this.world.emit(EventType.PLAYER_AVATAR_READY, {
      playerId: this.data.id,
      avatar: this._avatar,
      camHeight: this.camHeight,
    });

    // Ensure avatar starts at ground height (0) if terrain height is unavailable
    if ((this._avatar as AvatarNode).position.y < 0) {
      (this._avatar as AvatarNode).position.y = 0;
    }

    // Emit camera follow event using core camera system
    const _cameraSystem = getCameraSystem(this.world);
    this.world.emit(EventType.CAMERA_FOLLOW_PLAYER, {
      playerId: this.data.id,
      entity: { id: this.data.id, mesh: this.mesh as object | null },
      camHeight: this.camHeight,
    });
    // Also set as camera target for immediate orbit control readiness
    this.world.emit(EventType.CAMERA_SET_TARGET, { target: this });

    // Emit success
    this.world.emit(EventType.AVATAR_LOAD_COMPLETE, {
      playerId: this.id,
      success: true,
    });

    this.loadingAvatarUrl = undefined;
  }

  async initCapsule(): Promise<void> {
    // Validation: Ensure we have a valid position from server
    if (
      isNaN(this.position.x) ||
      isNaN(this.position.y) ||
      isNaN(this.position.z)
    ) {
      console.warn(
        `[PlayerLocal] Invalid position from server: ${this.position.x}, ${this.position.y}, ${this.position.z}`,
      );
      return;
    }

    // Validation: Ensure base exists
    if (!this.base) {
      console.warn(
        "[PlayerLocal] Cannot initialize physics capsule: Base object is null",
      );
      return;
    }

    // Wait for PhysX to be ready - required for player physics
    await waitForPhysX("PlayerLocal", 10000); // 10 second timeout

    // Get the global PHYSX object - required
    const PHYSX = getPhysX();
    if (!PHYSX) {
      throw new Error(
        "[PlayerLocal] PHYSX global not available - PlayerLocal requires PhysX for physics simulation",
      );
    }

    // Assert physics system is ready - required for player movement
    if (!this.world.physics) {
      throw new Error(
        "[PlayerLocal] Physics system not found - PlayerLocal requires physics system",
      );
    }

    if (!this.world.physics.scene) {
      throw new Error(
        "[PlayerLocal] Physics scene not initialized - PlayerLocal requires active physics scene",
      );
    }

    // Create ground sweep geometry now that PhysX is available
    // PHYSX already declared above
    this.groundSweepGeometry = new PHYSX.PxSphereGeometry(
      this.groundSweepRadius,
    );

    // CRITICAL: Force position to server position before creating physics
    this.position.copy(this.serverPosition);
    // Base is a child of node, no need to set its position separately
    if (this.node) {
      this.node.position.copy(this.serverPosition);
    }

    // Capsule creation logging removed to prevent memory leak

    // Create physics material using the physics system - required for capsule
    this.material = this.world.physics.physics.createMaterial(0.4, 0.4, 0.1);
    if (!this.material) {
      throw new Error(
        "[PlayerLocal] Failed to create physics material - required for player capsule",
      );
    }

    // Create capsule geometry using PhysX API
    const geometry = new PHYSX.PxCapsuleGeometry(
      this.capsuleRadius,
      this.capsuleHeight * 0.5,
    );

    // Create rigid dynamic body using the physics system's method
    const transform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity);
    this.capsule = this.world.physics.physics.createRigidDynamic(transform);
    if (!this.capsule) {
      throw new Error("[PlayerLocal] Failed to create rigid dynamic body");
    }

    // Set mass first
    this.capsule.setMass(this.mass);

    // Configure physics as KINEMATIC - position-driven, not force-driven
    // This prevents falling and makes physics follow our position
    this.capsule.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, true);
    // Disable CCD for kinematic body to avoid PhysX warning and potential jitter
    // this.capsule.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eENABLE_CCD, true)
    this.capsule.setRigidDynamicLockFlag(
      PHYSX.PxRigidDynamicLockFlagEnum.eLOCK_ANGULAR_X,
      true,
    );
    this.capsule.setRigidDynamicLockFlag(
      PHYSX.PxRigidDynamicLockFlagEnum.eLOCK_ANGULAR_Z,
      true,
    );
    this.capsule.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_GRAVITY, true);

    // Create and attach shape to actor using the physics system's createShape method
    const shape = this.world.physics.physics.createShape(
      geometry,
      this.material!,
      false,
    );
    if (!shape) {
      throw new Error("[PlayerLocal] Failed to create capsule shape");
    }

    // Set the player to the 'player' layer so it doesn't interfere with environment raycasts
    const playerLayer = Layers.player || { group: 0x4, mask: 0x6 }; // Default to bit 2 for player
    // word0 = player group, word1 = what can query the player (everything)
    const filterData = new PHYSX.PxFilterData(
      playerLayer.group,
      0xffffffff,
      0,
      0,
    );
    shape.setQueryFilterData(filterData);
    shape.setSimulationFilterData(filterData);

    this.capsule.attachShape(shape);

    // CRITICAL: Initialize physics capsule at SERVER position, not local position
    // Server position is the ONLY truth
    const initialPose = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity);
    initialPose.p.x = this.serverPosition.x;
    initialPose.p.y = this.serverPosition.y;
    initialPose.p.z = this.serverPosition.z;

    // Physics capsule initialization logging removed to prevent memory leak

    // Apply the corrected pose to the physics capsule
    this.capsule.setGlobalPose(initialPose);

    // Register the capsule with the physics system
    const capsuleHandle = {
      tag: "player",
      playerId: this.data?.id || "unknown",
      // NO INTERPOLATION for local player - server-authoritative movement only!
      // Physics is ONLY for collision detection, not movement or interpolation
      contactedHandles: new Set<PhysicsHandle>(),
      triggeredHandles: new Set<PhysicsHandle>(),
    };
    const physics = this.world.physics;
    if (!physics) {
      throw new Error("[PlayerLocal] Physics system is not available");
    }

    this.capsuleHandle = physics.addActor(
      this.capsule,
      capsuleHandle,
    ) as ActorHandle | null;

    // Validate capsule handle exists
    if (!this.capsuleHandle) {
      throw new Error("[PlayerLocal] Capsule handle is not available");
    }

    // Snap the capsule handle to the correct position
    // Note: snap expects an object with p and q properties
    if (this.capsuleHandle && this.capsuleHandle.snap) {
      this.capsuleHandle.snap(initialPose);
    } else {
      console.warn("[PlayerLocal] Capsule handle snap method not available");
    }

    // The base position is already synced with the server's authoritative position

    // Validate final positions
    const finalPose = this.capsule.getGlobalPose();
    const finalPosition = finalPose.p;

    // Verify positions match
    const positionDelta = new THREE.Vector3(
      Math.abs(finalPosition.x - this.position.x),
      Math.abs(finalPosition.y - this.position.y),
      Math.abs(finalPosition.z - this.position.z),
    );

    if (positionDelta.length() > 0.001) {
      console.warn(
        "[PlayerLocal] Position mismatch between physics and base:",
        positionDelta.length(),
      );
    } else {
      // Position is in sync
    }

    // Don't force terrain clamp on init - trust server position
    // Server reconciliation will handle position updates
  }

  initControl() {
    // Initialize control binding for input handling
    if (this.world.controls) {
      this.control = this.world.controls.bind({
        priority: ControlPriorities.PLAYER,
        onTouch: (touch: TouchInfo) => {
          // Convert TouchInfo to PlayerTouch for internal use
          const playerTouch: PlayerTouch = {
            id: touch.id,
            x: touch.position.x,
            y: touch.position.y,
            pressure: 1.0,
            position: { x: touch.position.x, y: touch.position.y },
          };
          if (
            !this.stick &&
            playerTouch.position &&
            playerTouch.position.x < (this.control?.screen?.width || 0) / 2
          ) {
            this.stick = {
              center: { x: playerTouch.position.x, y: playerTouch.position.y },
              touch: playerTouch,
            };
          } else if (!this.pan) {
            this.pan = playerTouch;
          }
          return true;
        },
        onTouchEnd: (touch: TouchInfo) => {
          const playerTouch: PlayerTouch = {
            id: touch.id,
            x: touch.position.x,
            y: touch.position.y,
            pressure: 1.0,
            position: { x: touch.position.x, y: touch.position.y },
          };
          if (this.stick?.touch === playerTouch) {
            this.stick = undefined;
          }
          if (this.pan === playerTouch) {
            this.pan = undefined;
          }
          return true;
        },
      }) as ControlBinding;
    }

    // Initialize camera controls
    const _cameraSystem = getSystem(this.world, "client-camera-system");
    // Set ourselves as the camera target
    this.world.emit(EventType.CAMERA_SET_TARGET, { target: this });
  }

  initCameraSystem(): void {
    // Register with camera system
    const _cameraSystem = getSystem(this.world, "client-camera-system");

    // The camera target expects an object with a THREE.Vector3 position; the Entity already has node.position
    this.world.emit(EventType.CAMERA_SET_TARGET, { target: this });

    // Emit avatar ready event for camera height adjustment
    this.world.emit(EventType.PLAYER_AVATAR_READY, {
      playerId: this.data.id,
      avatar: this._avatar,
      camHeight: this.camHeight,
    });
  }

  // RuneScape-style run mode toggle (persists across movements)
  public runMode: boolean = true;
  private clientPredictMovement: boolean = true;

  // Toggle between walk and run mode
  public toggleRunMode(): void {
    this.runMode = !this.runMode;
    // Update current movement if active
    if (this.moving) {
      this.running = this.runMode;
    }
    // TODO: Update UI to show run/walk state
  }

  // Update server authoritative position for reconciliation
  public updateServerPosition(x: number, y: number, z: number): void {
    if (!this.serverPosition) {
      this.serverPosition = new THREE.Vector3();
    }

    // CRITICAL: Reject obviously invalid positions from server
    // The server should never send positions below terrain
    if (y < -5) {
      console.error(
        `[PlayerLocal] REJECTING invalid server position! Y=${y} is below terrain!`,
      );
      console.error(
        `[PlayerLocal] Server tried to set position to: (${x}, ${y}, ${z})`,
      );

      const terrain = this.world.getSystem<TerrainSystem>("terrain") as {
        getHeightAt?: (x: number, z: number) => number;
      } | null;
      if (terrain?.getHeightAt) {
        const terrainHeight = terrain.getHeightAt(x, z);
        if (Number.isFinite(terrainHeight)) {
          const safeY = (terrainHeight as number) + 0.1;
          console.warn(
            `[PlayerLocal] Correcting to safe height: Y=${safeY} (terrain=${terrainHeight})`,
          );
          this.serverPosition.set(x, safeY, z);
        } else {
          console.warn(`[PlayerLocal] No terrain data, using default Y=50`);
          this.serverPosition.set(x, 50, z);
        }
      } else {
        console.warn(`[PlayerLocal] No terrain system, using default Y=50`);
        this.serverPosition.set(x, 50, z);
      }
    } else {
      // Valid position from server
      this.serverPosition.set(x, y, z);
    }

    this.lastServerUpdate = performance.now();

    // Log if we receive other questionable positions
    if (!Number.isFinite(y) || y > 1000) {
      console.error(
        `[PlayerLocal] WARNING: Received questionable Y position from server: ${y}`,
      );
    }

    // ALWAYS sync base position with server position to prevent desync
    // The node already has the authoritative position
    // Base is a child of node, so it inherits the transform
    if (this.base) {
      this.base!.updateMatrix();
      this.base!.updateMatrixWorld(true);
    }

    // If no capsule yet, also directly sync entity position
    if (!this.capsule) {
      this.position.copy(this.serverPosition);
    }
    // Otherwise position interpolation is handled in update() method
  }

  public updateServerVelocity(x: number, y: number, z: number): void {
    // Store server velocity for prediction
    // This helps with smoother client-side prediction
    if (!this.velocity) {
      this.velocity = new THREE.Vector3();
    }
    this.velocity.set(x, y, z);
  }

  // Set click-to-move target and let physics handle the actual movement
  public setClickMoveTarget(
    target: { x: number; y: number; z: number } | null,
  ): void {
    // CRITICAL: Block ALL movement during death
    if (
      (this as any).isDying ||
      (this.data as any).isDying ||
      this.health <= 0
    ) {
      console.log("[PlayerLocal] Movement blocked - player is dying/dead");
      return;
    }

    if (target) {
      // Always create a new vector or reuse existing one
      if (!this.clickMoveTarget) {
        this.clickMoveTarget = new THREE.Vector3();
      }
      this.clickMoveTarget.set(target.x, target.y, target.z);
      // Use the current run mode setting, but only if stamina is available
      this.running = this.runMode && this.stamina > 0;
      this.moving = true; // Ensure moving is set to true when we have a new target
    } else {
      this.clickMoveTarget = null;
      this.moveDir.set(0, 0, 0);
      this.moving = false;
    }
  }

  // Ensure external position updates keep physics capsule in sync
  public override setPosition(
    posOrX: { x: number; y: number; z: number } | number,
    y?: number,
    z?: number,
  ): void {
    // Strong type assumption - if y and z are provided, posOrX is a number
    const newX =
      y !== undefined && z !== undefined
        ? (posOrX as number)
        : (posOrX as { x: number; y: number; z: number }).x;
    const newY =
      y !== undefined && z !== undefined
        ? y
        : (posOrX as { x: number; y: number; z: number }).y;
    const newZ =
      y !== undefined && z !== undefined
        ? z
        : (posOrX as { x: number; y: number; z: number }).z;

    // Apply to entity position
    super.setPosition(newX, newY, newZ);

    // Base is a child of node and will follow automatically

    // Snap physics capsule to match to avoid interpolation snapping back
    if (this.capsule) {
      const pose = this.capsule.getGlobalPose();
      if (pose && pose.p) {
        pose.p.x = newX;
        pose.p.y = newY;
        pose.p.z = newZ;
        if (this.capsuleHandle) {
          this.capsuleHandle.snap(pose);
        } else {
          this.capsule.setGlobalPose(pose);
        }
      }
    }
  }

  toggleFlying() {
    const canFly =
      this.world.settings.public ||
      hasRole(this.data.roles as string[], "admin");
    if (!canFly) return;
    this.flying = !this.flying;
    if (this.flying && this.capsule) {
      // zero out vertical velocity when entering fly mode
      const velocity = this.capsule.getLinearVelocity();
      if (velocity) {
        velocity.y = 0;
        this.capsule.setLinearVelocity(velocity);
      }
    } else {
      // ...
    }
    this.lastJumpAt = -999;
  }

  getAnchorMatrix() {
    const effect = this.data.effect as { anchorId?: string } | undefined;
    if (effect?.anchorId) {
      return this.world.anchors.get(effect.anchorId);
    }
    return null;
  }

  private updateCallCount = 0;

  update(delta: number): void {
    this.updateCallCount++;

    // ALWAYS log first 10 updates with high visibility
    if (this.updateCallCount <= 10) {
    }

    // COMBAT ROTATION: Rotate to face target when in combat (RuneScape-style)
    // Check if any nearby mobs are targeting us (since combat state isn't synced from server)
    let combatTarget: {
      position: { x: number; z: number };
      id: string;
    } | null = null;

    // Look for mobs that are attacking us
    for (const entity of this.world.entities.items.values()) {
      if (entity.type === "mob" && entity.position) {
        const mobEntity = entity as any;
        // Check if mob is in ATTACK state and targeting this player
        if (
          mobEntity.config?.aiState === "attack" &&
          mobEntity.config?.targetPlayerId === this.id
        ) {
          const dx = entity.position.x - this.position.x;
          const dz = entity.position.z - this.position.z;
          const distance2D = Math.sqrt(dx * dx + dz * dz);

          // Only rotate if mob is within reasonable combat range
          if (distance2D <= 3) {
            combatTarget = { position: entity.position, id: entity.id };
            break; // Only face one mob at a time
          }
        }
      }
    }

    if (combatTarget) {
      // Calculate angle to target (XZ plane only, like RuneScape)
      const dx = combatTarget.position.x - this.position.x;
      const dz = combatTarget.position.z - this.position.z;
      let angle = Math.atan2(dx, dz);

      // VRM 1.0+ models have 180° base rotation, so we need to compensate
      // Otherwise entities face AWAY from each other instead of towards
      angle += Math.PI;

      // Apply instant rotation (RuneScape doesn't lerp combat rotation)
      if (this.base) {
        const tempQuat = new THREE.Quaternion();
        tempQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        this.base.quaternion.copy(tempQuat);
      }
    }

    // Server-authoritative movement: minimal updates only
    // Position updates come from modify() when server sends them

    // Ensure matrices are up to date for rendering and camera
    this.node.updateMatrix();
    this.node.updateMatrixWorld(true);

    // Base is a child of node and should stay at origin
    // This prevents double transforms since node already has world position
    if (this.base) {
      // Ensure base stays at origin relative to node
      if (
        this.base.position.x !== 0 ||
        this.base.position.y !== 0 ||
        this.base.position.z !== 0
      ) {
        console.warn(
          "[PlayerLocal] Base position was not at origin, correcting...",
        );
        this.base.position.set(0, 0, 0);
      }
      this.base!.updateMatrix();
      this.base!.updateMatrixWorld(true);
    }

    // 7. UPDATE AVATAR INSTANCE
    // Update avatar instance position from base transform
    type AvatarNodeWithInstance = {
      instance?: {
        move?: (matrix: THREE.Matrix4) => void;
        update?: (delta: number) => void;
      };
    };
    const avatarNode = this._avatar as unknown as AvatarNodeWithInstance;
    if (avatarNode?.instance) {
      const instance = avatarNode.instance;

      // Log when avatar instance is first detected
      if (this.updateCallCount === 11 || this.updateCallCount === 12) {
      }

      if (instance.move && this.base) {
        instance.move(this.base.matrixWorld);
      }
      if (instance.update) {
        instance.update(delta);
      }
    }

    // NO client-side animation calculation - server is authoritative
    // Animation state is set by server in modify() method

    // Avatar position update is already handled above in section 7

    // Removed local emote network updates - server is authoritative

    // UI-only stamina logic based on current emote/state from server (no movement writes)
    const dt = delta;
    const currentEmote = this.emote || "";
    if (currentEmote === "run") {
      this.stamina = THREE.MathUtils.clamp(
        this.stamina - this.staminaDrainPerSecond * dt,
        0,
        100,
      );
      if (this.stamina <= 0 && !this.autoRunSwitchSent) {
        // Auto-switch to walk on server when energy depletes (RS-style)
        this.runMode = false;
        this.world.network.send("moveRequest", { runMode: false });
        this.autoRunSwitchSent = true;
      }
    } else if (currentEmote === "walk") {
      this.stamina = THREE.MathUtils.clamp(
        this.stamina + this.staminaRegenWhileWalkingPerSecond * dt,
        0,
        100,
      );
      if (this.stamina > 1) {
        this.autoRunSwitchSent = false;
      }
    } else {
      // Idle or other emote
      this.stamina = THREE.MathUtils.clamp(
        this.stamina + this.staminaRegenPerSecond * dt,
        0,
        100,
      );
      if (this.stamina > 1) {
        this.autoRunSwitchSent = false;
      }
    }
  }

  lateUpdate(_delta: number): void {
    const isXR = (this.world.xr as XRSystem)?.session;
    const anchor = this.getAnchorMatrix();
    // if we're anchored, force into that pose
    if (anchor && this.capsule) {
      // Only apply anchor in XR mode - in normal gameplay, anchor should not override rotation
      if (isXR) {
        console.warn(
          "[PlayerLocal] XR Anchor is overriding rotation in lateUpdate!",
        );
        this.position.setFromMatrixPosition(anchor);
        this.base!.quaternion.setFromRotationMatrix(anchor);
        const pose = this.capsule.getGlobalPose();
        if (pose && pose.p) {
          // Manually set position to avoid type casting issues
          pose.p.x = this.position.x;
          pose.p.y = this.position.y;
          pose.p.z = this.position.z;
          this.capsuleHandle?.snap(pose);
        }
      }
    }
    if (this._avatar) {
      if (this._avatar.getBoneTransform) {
        const matrix = this._avatar.getBoneTransform("head");
        if (matrix && this.aura) {
          this.aura.position.setFromMatrixPosition(matrix);
        }
      }
    }
  }

  postLateUpdate(_delta: number): void {}

  teleport(position: THREE.Vector3, rotationY?: number): void {
    const hasRotation = !isNaN(rotationY!);
    // snap to position
    if (!this.capsule) return;
    const pose = this.capsule.getGlobalPose();
    if (!pose || !pose.p) return;
    // Manually set position to avoid type casting issues
    pose.p.x = position.x;
    pose.p.y = position.y;
    pose.p.z = position.z;
    this.capsuleHandle?.snap(pose);
    this.position.copy(position);
    if (hasRotation && this.base) {
      // Apply yaw in quaternion space to base and keep node aligned
      // Use pre-allocated temporary vectors
      const v1 = this._tempVec3.set(0, 1, 0); // up vector
      q1.setFromAxisAngle(v1, rotationY!);
      this.base.quaternion.copy(q1);
      this.node.quaternion.copy(this.base.quaternion);
    }
    // send network update - avoid toArray() allocations
    this.world.network.send("entityModified", {
      id: this.data.id,
      p: [this.position.x, this.position.y, this.position.z],
      q: [
        this.base!.quaternion.x,
        this.base!.quaternion.y,
        this.base!.quaternion.z,
        this.base!.quaternion.w,
      ],
      t: true,
    });
    // Camera is owned by the ClientCameraSystem; avoid direct camera snapping here to prevent jitter
    if (hasRotation) this.cam.rotation.y = rotationY!;
  }

  setEffect(effect: string, onEnd?: () => void) {
    if (this.data.effect === effect) return;
    if (this.data.effect) {
      this.data.effect = undefined;
      this.onEffectEnd?.();
      this.onEffectEnd = undefined;
    }
    this.data.effect = { emote: effect };
    this.onEffectEnd = onEnd;
    // send network update
    this.world.network.send("entityModified", {
      id: this.data.id,
      ef: effect,
    });
  }

  setSpeaking(speaking: boolean) {
    if (this.speaking === speaking) return;
    this.speaking = speaking;
  }

  push(force: THREE.Vector3) {
    if (this.capsule) {
      const pxForce = vector3ToPxVec3(force);
      if (pxForce) {
        this.capsule.addForce(
          pxForce,
          getPhysX()?.PxForceModeEnum?.eFORCE || 0,
          true,
        );
      }
    }
  }

  setName(name: string) {
    this.modify({ name });
    this.world.network.send("entityModified", { id: this.data.id, name });
  }

  setSessionAvatar(avatar: string) {
    this.data.sessionAvatar = avatar;
    this.applyAvatar();
    this.world.network.send("entityModified", {
      id: this.data.id as string,
      sessionAvatar: avatar,
    });
  }

  chat(msg: string): void {
    this.nametag!.active = false;
    this.bubbleText!.value = msg;
    this.bubble!.active = true;
    setTimeout(() => {
      this.bubble!.active = false;
      this.nametag!.active = true;
    }, 5000);
  }

  // Alias for backward compatibility
  say(msg: string): void {
    this.chat(msg);
  }

  onNetworkData(data: Partial<NetworkData>): void {
    if (data.name) {
      this.nametag!.label = (data.name as string) || "";
    }

    if (data.health !== undefined) {
      this.nametag!.health = data.health as number;
    }
  }

  // Handle system integration
  handleHealthChange(event: {
    playerId: string;
    health: number;
    maxHealth: number;
  }): void {
    if (event.playerId === this.data.id) {
      this.nametag!.health = event.health;
    }
  }

  handleTeleport(event: {
    playerId: string;
    position: { x: number; y: number; z: number };
    rotationY?: number;
  }): void {
    if (event.playerId === this.data.id) {
      // Use pre-allocated temporary vector
      v1.set(event.position.x, event.position.y, event.position.z);
      this.teleport(v1, event.rotationY || 0);
    }
  }

  /**
   * Handle PLAYER_SET_DEAD event from server
   * CRITICAL: This is the entry point to death flow - blocks all input and movement
   */
  handlePlayerSetDead(event: any): void {
    if (event.playerId !== this.data.id) return;

    // CRITICAL: Check if player is being set to dead or alive
    // isDead:true = entering death state, isDead:false = exiting death state
    if (event.isDead === false) {
      // Player is being restored to alive (after respawn)

      // Clear isDying flag (same as handlePlayerRespawned)
      (this as any).isDying = false;
      (this.data as any).isDying = false;

      // Unfreeze physics if needed
      if (this.capsule && (globalThis as any).PHYSX) {
        const PHYSX = (globalThis as any).PHYSX;
        this.capsule.setRigidBodyFlag(
          PHYSX.PxRigidBodyFlagEnum.eKINEMATIC,
          false,
        );
      }

      return;
    }

    // isDead:true = player is dying
    // Set isDying flag (blocks all input)
    (this as any).isDying = true;
    (this.data as any).isDying = true;

    // CRITICAL: Clear ALL movement state immediately to stop camera following
    this.clickMoveTarget = null;
    this.moveDir.set(0, 0, 0);
    this.moving = false;
    this.running = false;
    if (this.velocity) {
      this.velocity.set(0, 0, 0);
    }

    // Clear any queued movement (defensive - clear everything)
    if ((this as any).movementTarget) (this as any).movementTarget = null;
    if ((this as any).path) (this as any).path = null;
    if ((this as any).destination) (this as any).destination = null;

    // CRITICAL: Freeze physics capsule (make it KINEMATIC = frozen, no forces applied)
    if (this.capsule && (globalThis as any).PHYSX) {
      const PHYSX = (globalThis as any).PHYSX;
      console.log("[PlayerLocal] Freezing physics capsule...");

      // Zero out all velocities
      const zeroVec = new PHYSX.PxVec3(0, 0, 0);
      this.capsule.setLinearVelocity(zeroVec);
      this.capsule.setAngularVelocity(zeroVec);

      // Set to KINEMATIC mode (frozen in place, position-driven)
      this.capsule.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, true);
      console.log("[PlayerLocal] ✅ Physics frozen (KINEMATIC mode)");
    } else {
      console.warn(
        "[PlayerLocal] ⚠️  No physics capsule - cannot freeze physics",
      );
    }

    console.log(
      "[PlayerLocal] ✅ Death state applied - all movement blocked for 4.5s death animation",
    );
  }

  /**
   * Handle PLAYER_RESPAWNED event from server
   * Exits death state and allows normal gameplay
   */
  handlePlayerRespawned(event: any): void {
    if (event.playerId !== this.data.id) return;

    // Clear isDying flag (allows input again)
    (this as any).isDying = false;
    (this.data as any).isDying = false;

    // Unfreeze physics capsule (make it DYNAMIC again)
    if (this.capsule && (globalThis as any).PHYSX) {
      const PHYSX = (globalThis as any).PHYSX;

      // Set back to DYNAMIC mode (normal physics)
      this.capsule.setRigidBodyFlag(
        PHYSX.PxRigidBodyFlagEnum.eKINEMATIC,
        false,
      );

      // Zero out velocities to prevent sudden movements
      const zeroVec = new PHYSX.PxVec3(0, 0, 0);
      this.capsule.setLinearVelocity(zeroVec);
      this.capsule.setAngularVelocity(zeroVec);

      console.log("[PlayerLocal] ✅ Physics unfrozen (DYNAMIC mode)");
    }

    console.log(
      "[PlayerLocal] ✅ Respawn complete - player can move and act normally",
    );
  }

  // Required System lifecycle methods
  override destroy(): void {
    // Mark as inactive to prevent further operations
    this.active = false;

    // Clean up intervals
    if (this.positionValidationInterval) {
      clearInterval(this.positionValidationInterval);
      this.positionValidationInterval = undefined;
    }

    if (this.avatarRetryInterval) {
      clearInterval(this.avatarRetryInterval);
      this.avatarRetryInterval = null;
    }

    // Remove event listeners
    this.world.off(EventType.PLAYER_HEALTH_UPDATED, this.handleHealthChange);
    this.world.off(EventType.PLAYER_TELEPORT_REQUEST, this.handleTeleport);
    this.world.off(EventType.PLAYER_SET_DEAD, this.handlePlayerSetDead);
    this.world.off(EventType.PLAYER_RESPAWNED, this.handlePlayerRespawned);

    // Clean up physics
    if (this.capsule && this.capsuleHandle) {
      this.world.physics?.removeActor(this.capsule);
      this.capsuleHandle = null;
    }

    // Clean up avatar
    if (this._avatar) {
      if (this._avatar.deactivate) {
        this._avatar.deactivate();
      }
      this._avatar = undefined;
    }

    // Clean up UI elements
    if (this.aura) {
      // Remove from parent if exists
      if (this.aura.parent) {
        this.aura.parent.remove(this.aura);
      }
      this.aura = null;
    }

    if (this.nametag) {
      this.nametag.deactivate();
      this.nametag = null;
    }

    if (this.bubble) {
      this.bubble.deactivate();
      this.bubble = null;
    }

    // Clean up controls
    if (this.control) {
      // Controls cleanup - no unbind method available
      this.control = undefined;
    }

    // Clean up base (THREE.Group)
    if (this.base) {
      // Remove from parent if exists
      if (this.base.parent) {
        this.base.parent.remove(this.base);
      }
      // THREE.Group doesn't have deactivate method
      this.base = undefined;
    }

    // Notify systems of player destruction
    this.world.emit(EventType.PLAYER_DESTROY, { playerId: this.id });

    // Remove from hot set
    this.world.setHot(this, false);

    // Call parent destroy
    super.destroy();
  }
}
