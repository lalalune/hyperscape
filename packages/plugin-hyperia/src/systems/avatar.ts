/**
 * AgentAvatar - Avatar Management for AI Agents
 *
 * Manages VRM avatar models and animations for AI agents operating in Hyperia.
 * This system wraps the core Hyperia Avatar node to provide agent-specific
 * functionality like automatic emote selection and state synchronization.
 *
 * **Features:**
 * - VRM model loading and management
 * - Animation state machine (idle, walk, run, emotes)
 * - Movement detection for automatic animation switching
 * - Emote playback for social interactions
 * - Integration with player entity state
 *
 * **Architecture:**
 * - Extends the core System class
 * - Delegates model rendering to the shared Avatar node
 * - Tracks movement state to select appropriate animations
 * - Responds to entity state changes (alive, combat, etc.)
 *
 * **Referenced by:** HyperiaService, EntitySystem
 */

import { logger } from "@elizaos/core";
import { Vector3, Quaternion, Matrix4, Object3D } from "three";
import type { World, Player } from "../types/core-types";

// Animation state constants
const EMOTE_IDLE = "idle";
const EMOTE_WALK = "walk";
const EMOTE_RUN = "run";

// Movement detection thresholds
const WALK_SPEED_THRESHOLD = 0.5; // m/s
const RUN_SPEED_THRESHOLD = 4.0; // m/s
const POSITION_CHANGE_THRESHOLD = 0.01; // Minimum position change to detect movement

interface NodeContext {
  entity?: {
    data?: {
      avatarUrl?: string;
      emote?: string;
      [key: string]: unknown;
    };
  };
  world?: World;
  player?: Player;
  loader?: {
    get(type: string, src: string): unknown;
    load(type: string, src: string): Promise<unknown>;
  };
  [key: string]: unknown;
}

interface PlayerEffect {
  emote?: string | null;
}

interface ParentNode extends Object3D {
  position: Vector3;
  quaternion: Quaternion;
  base?: {
    position: Vector3;
    quaternion: Quaternion;
  };
}

interface AvatarInstance {
  setEmote(emote: string | null): void;
  move(matrix: Matrix4): void;
  destroy(): void;
  height?: number;
  headToHeight?: number;
  getBoneTransform?(boneName: string): Matrix4 | null;
  disableRateCheck?(): void;
}

interface AvatarFactory {
  create(matrix: Matrix4, hooks?: unknown, node?: unknown): AvatarInstance;
  applyStats?(stats: unknown): void;
}

/**
 * Base Node class implementation for the avatar system
 */
class Node extends Object3D {
  ctx: NodeContext;
  dirty: boolean = false;
  proxy: unknown = null;

  constructor(ctx: NodeContext) {
    super();
    this.ctx = ctx;
  }

  setDirty(): void {
    this.dirty = true;
  }

  updateTransform(): void {
    this.updateMatrix();
    this.updateMatrixWorld(true);
  }

  getProxy(): Record<string, unknown> {
    return {};
  }
}

/**
 * AgentAvatar - Avatar system for AI agents
 *
 * Manages avatar appearance and animations for agents in Hyperia worlds.
 */
export class AgentAvatar extends Node {
  // Player and model properties
  player: Player | null = null;
  factory: AvatarFactory | null = null;
  instance: AvatarInstance | null = null;

  // Animation state
  isMoving: boolean = false;
  isRunning: boolean = false;
  currentEmote: string | null = EMOTE_IDLE;
  overrideEmote: string | null = null;

  // Movement tracking
  private lastPosition: Vector3 = new Vector3();
  private velocity: Vector3 = new Vector3();
  private movementStartTime: number = 0;

  // Emote management
  private emoteQueue: string[] = [];
  private emoteEndTime: number = 0;

  constructor(ctx: NodeContext & { factory?: AvatarFactory }) {
    super(ctx);
    this.name = "AgentAvatar";
    this.factory = ctx.factory ?? null;
  }

  /**
   * Initialize the avatar with player data
   */
  async init(): Promise<void> {
    logger.info("[AgentAvatar] Initializing avatar system");

    if (this.ctx.player) {
      await this.updatePlayer(this.ctx.player);
    } else {
      logger.warn("[AgentAvatar] No player in context at init");
    }
  }

  /**
   * Update avatar when player data changes
   */
  async updatePlayer(player: Player): Promise<void> {
    this.player = player;

    // Get avatar URL from player data
    const avatarUrl =
      this.ctx.entity?.data?.avatarUrl ||
      (player as { data?: { avatar?: string } })?.data?.avatar;

    if (avatarUrl && this.ctx.loader) {
      logger.info(`[AgentAvatar] Loading avatar from: ${avatarUrl}`);
      try {
        // Load avatar through the world's loader
        const avatarData = await this.ctx.loader.load("avatar", avatarUrl);
        if (avatarData) {
          const data = avatarData as { factory?: AvatarFactory };
          this.factory = data.factory ?? null;
          await this.createInstance();
        }
      } catch (error) {
        logger.error(
          `[AgentAvatar] Failed to load avatar: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Initialize position tracking
    if (player.position) {
      const pos = player.position as { x: number; y: number; z: number };
      this.lastPosition.set(pos.x, pos.y, pos.z);
    }
  }

  /**
   * Create avatar instance from factory
   */
  private async createInstance(): Promise<void> {
    if (!this.factory) {
      logger.warn("[AgentAvatar] No factory available, cannot create instance");
      return;
    }

    // Destroy existing instance if any
    if (this.instance) {
      this.instance.destroy();
      this.instance = null;
    }

    // Update transform before creating instance
    this.updateTransform();

    // Create new instance
    this.instance = this.factory.create(this.matrixWorld, undefined, this);

    if (this.instance) {
      this.instance.setEmote(this.currentEmote);
      logger.info("[AgentAvatar] Avatar instance created successfully");
    }
  }

  /**
   * Set movement state
   */
  setMoving(isMoving: boolean, isRunning: boolean = false): void {
    const wasMoving = this.isMoving;
    this.isMoving = isMoving;
    this.isRunning = isRunning;

    if (isMoving && !wasMoving) {
      this.movementStartTime = Date.now();
    }

    // Update animation if no override emote
    if (!this.overrideEmote) {
      this.updateMovementEmote();
    }
  }

  /**
   * Update emote based on movement state
   */
  private updateMovementEmote(): void {
    let targetEmote: string;

    if (!this.isMoving) {
      targetEmote = EMOTE_IDLE;
    } else if (this.isRunning) {
      targetEmote = EMOTE_RUN;
    } else {
      targetEmote = EMOTE_WALK;
    }

    if (targetEmote !== this.currentEmote) {
      this.currentEmote = targetEmote;
      this.instance?.setEmote(targetEmote);
    }
  }

  /**
   * Play an emote animation
   * @param emoteName - Name of the emote to play
   * @param duration - Duration in ms (0 = play once then return to state emote)
   */
  playEmote(emoteName: string, duration: number = 0): void {
    logger.info(`[AgentAvatar] Playing emote: ${emoteName}`);

    this.overrideEmote = emoteName;
    this.instance?.setEmote(emoteName);

    if (duration > 0) {
      this.emoteEndTime = Date.now() + duration;
    } else {
      // For single-play emotes, estimate duration or use default
      this.emoteEndTime = Date.now() + 2000;
    }
  }

  /**
   * Stop override emote and return to movement-based animation
   */
  stopEmote(): void {
    this.overrideEmote = null;
    this.emoteEndTime = 0;
    this.updateMovementEmote();
  }

  /**
   * Update called each frame
   */
  tick(delta: number): void {
    // Check if override emote should end
    if (this.overrideEmote && this.emoteEndTime > 0) {
      if (Date.now() >= this.emoteEndTime) {
        this.stopEmote();
      }
    }
  }

  /**
   * Update called each frame for position tracking
   */
  update(delta: number): void {
    if (!this.player) return;

    // Track movement from player position changes
    const playerPos = this.player.position as
      | { x: number; y: number; z: number }
      | undefined;

    if (playerPos) {
      const currentPos = new Vector3(playerPos.x, playerPos.y, playerPos.z);
      this.velocity
        .subVectors(currentPos, this.lastPosition)
        .divideScalar(delta);

      const speed = this.velocity.length();
      const positionChanged =
        currentPos.distanceTo(this.lastPosition) > POSITION_CHANGE_THRESHOLD;

      // Update movement state based on velocity
      if (positionChanged) {
        const isRunning = speed > RUN_SPEED_THRESHOLD;
        const isMoving = speed > WALK_SPEED_THRESHOLD;
        this.setMoving(isMoving, isRunning);
      } else {
        this.setMoving(false);
      }

      this.lastPosition.copy(currentPos);
    }
  }

  /**
   * Late update for position and rotation sync
   */
  lateUpdate(delta: number): void {
    if (!this.player || !this.instance) return;

    // Update avatar position and rotation from player
    const playerPos = this.player.position as
      | { x: number; y: number; z: number }
      | undefined;
    // Get rotation from player node or data
    const playerNode = (
      this.player as {
        node?: { quaternion?: { x: number; y: number; z: number; w: number } };
      }
    ).node;
    const playerRot = playerNode?.quaternion;

    if (playerPos) {
      this.position.set(playerPos.x, playerPos.y, playerPos.z);
    }

    if (playerRot) {
      this.quaternion.set(playerRot.x, playerRot.y, playerRot.z, playerRot.w);
    }

    // Update transform and move instance
    this.updateTransform();
    this.instance.move(this.matrixWorld);

    // Check for effect emotes from player entity
    const playerData = this.player as { data?: { effect?: PlayerEffect } };
    const effect = playerData?.data?.effect;
    if (effect?.emote && effect.emote !== this.overrideEmote) {
      this.playEmote(effect.emote);
    }
  }

  /**
   * Get avatar height
   */
  getHeight(): number | null {
    return this.instance?.height ?? 1.8; // Default human height
  }

  /**
   * Get head-to-total-height ratio
   */
  getHeadToHeight(): number | null {
    return this.instance?.headToHeight ?? 0.85; // Typical ratio
  }

  /**
   * Get bone transform for attachment points
   */
  getBoneTransform(boneName: string): Matrix4 | null {
    return this.instance?.getBoneTransform?.(boneName) ?? null;
  }

  /**
   * Cleanup when destroying avatar
   */
  onDestroy(): void {
    if (this.instance) {
      this.instance.destroy();
      this.instance = null;
    }
    this.player = null;
    this.factory = null;
    logger.info("[AgentAvatar] Avatar destroyed");
  }
}
