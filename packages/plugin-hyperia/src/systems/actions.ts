import { Object3D, Vector3 } from "three";
import { CONTROLS_CONFIG } from "../config/constants";
import type { World } from "../types/core-types";

// Define a base System class for this module
abstract class SystemBase {
  protected world: World;

  constructor(world: World) {
    this.world = world;
  }

  abstract init(options?: unknown): Promise<void>;
  abstract start(): void;
  abstract destroy(): void;
}

interface ActionNode extends Object3D {
  ctx: {
    entity: {
      position: Vector3;
      data?: {
        id?: string;
      };
    };
  };
  finished?: boolean;
  _duration?: number;
  _onTrigger?: (event: { playerId: string }) => void;
  _onCancel?: () => void;
  [key: string]: unknown;
}

export class AgentActions extends SystemBase {
  private nodes: ActionNode[] = [];
  private currentNode: ActionNode | null = null;

  constructor(world: World) {
    super(world);
    this.nodes = [];
  }

  // Implement required System interface methods
  async init(options?: unknown): Promise<void> {
    // Initialize the actions system
  }

  start(): void {
    // Start the actions system
  }

  destroy(): void {
    // Cleanup actions system
  }

  register(node: ActionNode) {
    this.nodes.push(node);
  }

  unregister(node: ActionNode) {
    const idx = this.nodes.indexOf(node);
    if (idx !== -1) {
      this.nodes.splice(idx, 1);
    }
  }

  getNearby(maxDistance?: number): ActionNode[] {
    const worldWithRig = this.world as { rig?: { position?: Vector3 } };
    const cameraPos = worldWithRig.rig?.position;
    if (!cameraPos) {
      return [];
    }

    return this.nodes.filter((node) => {
      if (node.finished) {
        return false;
      }

      // If no distance provided, return all unfinished nodes
      if (maxDistance === null || maxDistance === undefined) {
        return true;
      }

      return node.ctx.entity.position.distanceTo(cameraPos) <= maxDistance;
    });
  }

  performAction(entityID?: string) {
    if (this.currentNode) {
      console.log("Already interacting with an entity. Release it first.");
      return;
    }
    const nearby = this.getNearby();
    if (!nearby.length) {
      return;
    }

    let target: ActionNode | undefined;

    if (entityID) {
      target = nearby.find((node) => node.ctx.entity?.data?.id === entityID);
      if (!target) {
        console.log(`No nearby action node found with entity ID: ${entityID}`);
        return;
      }
    } else {
      target = nearby[0];
    }

    const worldWithControls = this.world as { controls?: unknown };
    const control = worldWithControls.controls;
    if (!control) {
      console.log("Controls not available");
      return;
    }

    const agentControl = control as {
      setKey?: (key: string, value: boolean) => void;
    };
    if (agentControl.setKey) {
      agentControl.setKey("keyE", true);
    }

    const worldWithEntities = this.world as {
      entities?: { player?: { data?: { id?: string } } };
    };
    const player = worldWithEntities.entities?.player;
    if (!player) {
      console.log("Player not available");
      return;
    }

    setTimeout(() => {
      // Assume _onTrigger exists on target if it's an action node
      target._onTrigger!({
        playerId: player.data?.id ?? "",
      });
      if (agentControl.setKey) {
        agentControl.setKey("keyE", false);
      }
      this.currentNode = target;
    }, target._duration ?? CONTROLS_CONFIG.ACTION_DEFAULT_DURATION_MS);
  }

  releaseAction() {
    if (!this.currentNode) {
      console.log("No current action to release.");
      return;
    }

    console.log("Releasing current action.");
    interface KeyState {
      pressed?: boolean;
      released?: boolean;
      onPress?: () => void;
      onRelease?: () => void;
    }

    interface ControlsWithKeys {
      setKey?: (key: string, value: boolean) => void;
      keyX?: KeyState;
    }

    const worldWithControls = this.world as { controls?: unknown };
    const control = worldWithControls.controls as ControlsWithKeys | undefined;
    if (!control) {
      console.log("Controls not available");
      return;
    }

    if (control.setKey) {
      control.setKey("keyX", true);
    }

    // Trigger key press callbacks
    if (control.keyX) {
      const keyX = control.keyX;
      if (keyX.pressed !== undefined) {
        keyX.pressed = true;
      }
      if (keyX.onPress) {
        keyX.onPress();
      }
    }

    // Assume _onCancel exists if the node supports cancellation
    this.currentNode._onCancel!();

    setTimeout(() => {
      if (control.setKey) {
        control.setKey("keyX", false);
      }

      // Trigger key release callbacks
      if (control.keyX) {
        const keyX = control.keyX;
        if (keyX.released !== undefined) {
          keyX.released = false;
        }
        if (keyX.onRelease) {
          keyX.onRelease();
        }
      }
      this.currentNode = null;
    }, 500);
  }

  // Framework stubs
  preTick(): void {}
  preFixedUpdate(willFixedStep: boolean): void {}
  fixedUpdate(delta: number): void {}
  postFixedUpdate(delta: number): void {}
  preUpdate(alpha: number): void {}
  update(delta: number): void {}
  postUpdate(delta: number): void {}
  lateUpdate(delta: number): void {}
  postLateUpdate(delta: number): void {}
  commit(): void {}
  postTick(): void {}
}
