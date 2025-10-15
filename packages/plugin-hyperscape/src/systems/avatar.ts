import { logger } from "@elizaos/core";
import { THREE } from "@hyperscape/shared";
import type { World, Player } from "../types/core-types";

interface NodeContext {
  entity?: {
    data?: {
      avatarUrl?: string;
      [key: string]: unknown;
    };
  };
  world?: World;
  player?: Player;
  [key: string]: unknown;
}

interface Nametag extends THREE.Object3D {
  text: string;
}

interface PlayerEffect {
  emote?: string | null;
}

interface ParentNode extends THREE.Object3D {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  base?: {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
  };
  refCount?: number;
}

interface ProxyNode extends THREE.Object3D {
  emoteFactories?: Map<string, AnimationFactory>;
  refCount?: number;
}

// Create a base Node class since @hyperscape/shared is not available
class Node extends THREE.Object3D {
  ctx: NodeContext;
  constructor(ctx: NodeContext) {
    super();
    this.ctx = ctx;
  }
  setDirty() {}
}

interface AnimationFactory {
  toClip?(target: THREE.Object3D): THREE.AnimationClip | null;
  [key: string]: unknown;
}

interface EmotePlayerNode extends THREE.Group {
  parent: THREE.Object3D | null;
  destroy(): void;
}

// Local implementation of createEmotePlayerNodes
// This is a placeholder implementation since it's not available in hyperscape
function createEmotePlayerNodes(
  _factory: AnimationFactory,
  _objects: THREE.Object3D[],
  _autoplay: boolean,
): EmotePlayerNode {
  // Return a simple object that can be added to the scene
  const group = new THREE.Group() as EmotePlayerNode;
  // The actual implementation would apply the emote animation to the objects
  // For now, just return an empty group with a destroy method
  group.destroy = () => {
    group.parent?.remove(group);
  };
  return group;
}

export class AgentAvatar extends Node {
  // Player and model properties
  player: Player | null = null;
  model: THREE.Object3D | null = null;
  nametag: Nametag | null = null;
  mixer: THREE.AnimationMixer | null = null;
  idleClip: THREE.AnimationClip | null = null;
  walkClip: THREE.AnimationClip | null = null;
  runClip: THREE.AnimationClip | null = null;
  isMoving: boolean = false;
  movingN: number = 0;
  factory: AnimationFactory;
  lookTarget: THREE.Vector3;
  effect: Record<string, unknown> = {};
  emote: string | null = null;
  emotePlayer: EmotePlayerNode | null = null;
  emoteN: number = 0;

  // Required Node properties
  declare name: string;
  declare ctx: NodeContext;
  declare parent: ParentNode | null;
  declare proxy: ProxyNode;
  declare position: THREE.Vector3;
  declare quaternion: THREE.Quaternion;
  declare add: (...objects: THREE.Object3D[]) => this;

  constructor(ctx: NodeContext & { factory: AnimationFactory }) {
    super(ctx);
    this.factory = ctx.factory;
    this.lookTarget = new THREE.Vector3();
  }

  setMoving(isMoving: boolean) {
    this.isMoving = isMoving;
    this.movingN++;
  }

  async init() {
    this.name = "AgentAvatar";

    // --- Proxy Load (No-op) ---
    if (!this.proxy) {
      logger.info("[AgentAvatar] Proxy not available, skipping proxy load.");
    } else {
      // Proxy loading logic if proxy were available
      // logger.info('[AgentAvatar] Loading proxy model:', this.proxy);
    }
    // --- End Proxy Load ---

    if (this.ctx.player) {
      await this.updatePlayer(this.ctx.player);
    } else {
      logger.warn("[AgentAvatar] No player in context at init.");
    }
  }

  async updatePlayer(player: Player) {
    this.player = player;

    // --- Data-driven Model Update (Partial) ---
    // This is simplified without actual model loading and mixer setup
    if (this.ctx.entity?.data) {
      logger.info(
        "[AgentAvatar] Entity avatar URL:",
        this.ctx.entity.data.avatarUrl || "none",
      );
    }

    if (this.ctx && this.ctx.gltf) {
      logger.info("[AgentAvatar] Default world avatar available.");
    }

    logger.info(
      "[AgentAvatar] Skipping actual model/mixer setup (not implemented).",
    );
    // --- End Model Update ---

    // --- Name Tag Update (Partial) ---
    if (this.nametag) {
      this.nametag.text = player.data.name;
    } else {
      logger.info("[AgentAvatar] Nametag not available, skipping update.");
    }
    this.setDirty();
    // --- End Name Tag Update ---
  }

  // --- Placeholder Methods ---
  // These would handle animations and updates in a real implementation

  tick(_delta: number) {
    // Mixer update logic
  }

  update(_delta: number) {
    // Movement and rotation logic
  }

  lateUpdate(_delta: number) {
    // Position and scale updates
    if (this.model && this.player) {
      this.position.x = this.parent?.position.x || 0;
      this.position.y = (this.parent?.position.y || 0) - 0.95;
      this.position.z = this.parent?.position.z || 0;

      this.quaternion.x = this.parent?.quaternion.x || 0;
      this.quaternion.y = this.parent?.quaternion.y || 0;
      this.quaternion.z = this.parent?.quaternion.z || 0;
      this.quaternion.w = this.parent?.quaternion.w || 1;

      // Handle animations
      if (this.mixer) {
        const isRunning = false; // Placeholder for run detection
        const _walkSpeed = isRunning ? 0 : 1;
        const _runSpeed = isRunning ? 1 : 0;

        // Update animation weights
        // this.idleClip?.setEffectiveWeight(this.isMoving ? 0 : 1);
        // this.walkClip?.setEffectiveWeight(this.isMoving ? walkSpeed : 0);
        // this.runClip?.setEffectiveWeight(this.isMoving ? runSpeed : 0);
      }

      // Emote handling
      if (this.player) {
        const effect = (this.player as any).data?.effect as
          | PlayerEffect
          | undefined;
        if (effect?.emote !== this.emote) {
          this.emote = effect?.emote || null;
          this.updateEmote();
        }
      }
    }
  }

  updateEmote() {
    const emote = this.emote;
    const n = ++this.emoteN;

    if (this.emotePlayer) {
      this.emotePlayer.destroy();
      this.emotePlayer = null;
    }

    if (!emote) {
      return;
    }

    logger.info("[AgentAvatar] Updating emote:", emote);

    const factory = this.proxy?.emoteFactories?.get(emote);
    if (!factory) {
      logger.warn("[AgentAvatar] Emote factory not found for:", emote);
      return;
    }

    if (n !== this.emoteN) {
      return;
    }

    const objects = [this.model];
    this.emotePlayer = createEmotePlayerNodes(factory, objects, true);
    this.add(this.emotePlayer);
  }

  onDestroy() {
    if (this.proxy && this.proxy.refCount && this.proxy.refCount > 0) {
      this.proxy.refCount--;
    }
  }

  // Required Node method
  setDirty() {
    // This is typically set by the framework
    // For now, just a no-op
  }
}
