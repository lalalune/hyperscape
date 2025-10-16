import { THREE, System } from "@hyperscape/shared";
import { CONTROLS_CONFIG } from "../config/constants";
import type { World } from "@hyperscape/shared";

interface ActionNode extends THREE.Object3D {
  ctx: {
    entity: {
      position: THREE.Vector3;
      data?: {
        id?: string;
      };
    };
  };
  finished?: boolean;
  _duration?: number;
  _onTrigger?: (event: { playerId: string }) => void;
  _onCancel?: () => void;
  [key: string]: string | number | boolean | ((event: { playerId: string }) => void) | (() => void) | Record<string, unknown> | undefined;
}

export class AgentActions extends System {
  declare world: World;
  private nodes: ActionNode[] = [];
  private currentNode: ActionNode | null = null;

  constructor(world: World) {
    super(world);
    this.nodes = [];
  }

  // Implement required System interface methods
  async init(options?: Record<string, unknown>): Promise<void> {
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
    const cameraPos = this.world.rig?.position;
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
        return;
      }
    } else {
      target = nearby[0];
    }

    const control = this.world.controls;
    if (!control) {
      return;
    }

    const agentControl = control as {
      setKey?: (key: string, value: boolean) => void;
    };
    if (agentControl.setKey) {
      agentControl.setKey("keyE", true);
    }

    const player = this.world.entities.player;
    if (!player) {
      return;
    }

    setTimeout(() => {
      // Assume _onTrigger exists on target if it's an action node
      target._onTrigger!({
        playerId: player.data.id,
      });
      if (agentControl.setKey) {
        agentControl.setKey("keyE", false);
      }
      this.currentNode = target;
    }, target._duration ?? CONTROLS_CONFIG.ACTION_DEFAULT_DURATION_MS);
  }

  releaseAction() {
    if (!this.currentNode) {
      return;
    }

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

    const control = this.world.controls as ControlsWithKeys | undefined;
    if (!control) {
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
  // init() {} - implemented above
  // start() {} - implemented above
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
