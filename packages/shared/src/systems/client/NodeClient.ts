import { System } from "../shared/infrastructure/System";
import type { World } from "../../types";

const TICK_RATE = 1 / 30;
const TICK_INTERVAL_MS = TICK_RATE * 1000;

/**
 * Node Client System
 *
 * - Runs on node clients
 * - Manages client-side game loop with precise timing
 *
 */
export class NodeClient extends System {
  private running = false;
  private lastTickTime = 0;
  private tickAccumulator = 0;

  constructor(world: World) {
    super(world);
  }

  start() {
    this.running = true;
    this.lastTickTime = performance.now();
    this.scheduleTick();
  }

  private scheduleTick() {
    if (!this.running) return;

    // Use setImmediate for consistent timing
    setImmediate(() => {
      const currentTime = performance.now();
      const deltaTime = currentTime - this.lastTickTime;

      // Accumulate time and tick when enough has passed
      this.tickAccumulator += deltaTime;

      if (this.tickAccumulator >= TICK_INTERVAL_MS) {
        // Perform the tick
        this.world.tick(currentTime);

        // Subtract the tick interval (keep remainder for precision)
        this.tickAccumulator -= TICK_INTERVAL_MS;

        // Prevent accumulator from growing too large (cap at 2 ticks worth)
        if (this.tickAccumulator > TICK_INTERVAL_MS * 2) {
          this.tickAccumulator = TICK_INTERVAL_MS;
        }
      }

      this.lastTickTime = currentTime;

      // Schedule next check
      this.scheduleTick();
    });
  }

  destroy() {
    this.running = false;
  }
}
