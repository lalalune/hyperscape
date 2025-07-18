import * as THREE from 'three';
import { logger } from '@elizaos/core';

// Create a base Node class since @elizaos/hyperfy is not available
class Node extends THREE.Object3D {
  ctx: any;
  constructor(ctx: any) {
    super();
    this.ctx = ctx;
  }
  setDirty() {}
}
import type { HyperfyWorld } from '../types/hyperfy.js';

function forEachMaterial(scene: any, fn: any) {
  scene.traverse((obj: any) => {
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(fn);
      } else {
        fn(obj.material);
      }
    }
  });
}

// Local implementation of createEmotePlayerNodes
// This is a placeholder implementation since it's not available in hyperfy
function createEmotePlayerNodes(factory: any, objects: any[], autoplay: boolean) {
  // Return a simple object that can be added to the scene
  const group = new THREE.Group();
  // The actual implementation would apply the emote animation to the objects
  // For now, just return an empty group with a destroy method
  (group as any).destroy = () => {
    group.parent?.remove(group);
  };
  return group;
}

export class AgentAvatar extends Node {
  // Player and model properties
  player: any = null;
  model: any = null;
  nametag: any = null;
  mixer: any = null;
  idleClip: any = null;
  walkClip: any = null;
  runClip: any = null;
  isMoving: boolean = false;
  movingN: number = 0;
  factory: any;
  lookTarget: any;
  effect: any = {};
  emote: string | null = null;
  emotePlayer: any = null;
  emoteN: number = 0;

  // Required Node properties
  declare name: string;
  declare ctx: any;
  declare parent: any;
  declare proxy: any;

  constructor(ctx: any) {
    super(ctx);
    this.factory = ctx.factory;
    this.lookTarget = new THREE.Vector3();
  }

  setMoving(isMoving: boolean) {
    this.isMoving = isMoving;
    this.movingN++;
  }

  async init() {
    this.name = 'AgentAvatar';

    // --- Proxy Load (No-op) ---
    if (!this.proxy) {
      logger.info('[AgentAvatar] Proxy not available, skipping proxy load.');
    } else {
      // Proxy loading logic if proxy were available
      // logger.info('[AgentAvatar] Loading proxy model:', this.proxy);
    }
    // --- End Proxy Load ---

    if (this.ctx.player) {
      await this.updatePlayer(this.ctx.player);
    } else {
      logger.warn('[AgentAvatar] No player in context at init.');
    }
  }

  async updatePlayer(player: any) {
    this.player = player;

    // --- Data-driven Model Update (Partial) ---
    // This is simplified without actual model loading and mixer setup
    if (this.ctx.entity && (this.ctx.entity as any).data) {
      logger.info(
        '[AgentAvatar] Entity avatar URL:',
        (this.ctx.entity as any).data.avatarUrl || 'none'
      );
    }

    if (this.ctx.world && this.ctx.world.gltf) {
      logger.info('[AgentAvatar] Default world avatar available.');
    }

    logger.info('[AgentAvatar] Skipping actual model/mixer setup (not implemented).');
    // --- End Model Update ---

    // --- Name Tag Update (Partial) ---
    if (this.nametag) {
      this.nametag.text = player.data.name;
    } else {
      logger.info('[AgentAvatar] Nametag not available, skipping update.');
    }
    this.setDirty();
    // --- End Name Tag Update ---
  }

  // --- Placeholder Methods ---
  // These would handle animations and updates in a real implementation

  tick(delta: number) {
    if (!this.mixer) {
    }
    // Mixer update logic
  }

  update(delta: number) {
    // Movement and rotation logic
  }

  lateUpdate(delta: number) {
    // Position and scale updates
    if (this.model && this.player) {
      this.position.x = this.parent?.base?.position.x || 0;
      this.position.y = (this.parent?.base?.position.y || 0) - 0.95;
      this.position.z = this.parent?.base?.position.z || 0;

      this.quaternion.x = this.parent?.base?.quaternion.x || 0;
      this.quaternion.y = this.parent?.base?.quaternion.y || 0;
      this.quaternion.z = this.parent?.base?.quaternion.z || 0;
      this.quaternion.w = this.parent?.base?.quaternion.w || 1;

      // Handle animations
      if (this.mixer) {
        const isRunning = false; // Placeholder for run detection
        const walkSpeed = isRunning ? 0 : 1;
        const runSpeed = isRunning ? 1 : 0;

        // Update animation weights
        // this.idleClip?.setEffectiveWeight(this.isMoving ? 0 : 1);
        // this.walkClip?.setEffectiveWeight(this.isMoving ? walkSpeed : 0);
        // this.runClip?.setEffectiveWeight(this.isMoving ? runSpeed : 0);
      }
    }

    // Emote handling
    if (this.player && this.player.data.effect?.emote !== this.emote) {
      this.emote = this.player.data.effect?.emote || null;
      this.updateEmote();
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

    logger.info('[AgentAvatar] Updating emote:', emote);

    const factory = this.proxy?.emoteFactories?.get(emote);
    if (!factory) {
      logger.warn('[AgentAvatar] Emote factory not found for:', emote);
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
    if (this.proxy && this.proxy.refCount > 0) {
      this.proxy.refCount--;
    }
  }

  // Required Node method
  setDirty() {
    // This is typically set by the framework
    // For now, just a no-op
  }
}
