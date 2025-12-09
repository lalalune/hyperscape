/**
 * createTestWorld.ts - Test World Factory
 *
 * Creates a minimal World instance for unit and integration testing.
 * This world has just enough systems to test terrain, physics, and basic gameplay
 * without requiring a full client or server setup.
 *
 * Usage:
 * ```typescript
 * const world = await createTestWorld({ isClient: true, headless: true });
 * // World is ready for testing
 * ```
 */

import { World } from "../core/World";
import { Physics } from "../systems/shared";
import { Stage } from "../systems/shared";
import { ClientLoader } from "../systems/client/ClientLoader";
import type { PhysicsHandle } from "../types/systems/physics";

export interface TestWorldOptions {
  isClient?: boolean;
  isServer?: boolean;
  headless?: boolean;
}

/**
 * Creates a minimal test world for unit testing
 */
export async function createTestWorld(
  options: TestWorldOptions = {},
): Promise<World> {
  const { isClient = true, isServer = false, headless = true } = options;

  const world = new World();

  // Set network status
  if (isClient || isServer) {
    world.network = {
      isClient,
      isServer,
    } as World["network"];
  }

  // Register minimal systems needed for terrain tests
  world.register("physics", Physics);
  world.register("stage", Stage);
  world.register("loader", ClientLoader);

  // Initialize physics
  await world.init({
    assetsUrl: "http://localhost:8088",
  });

  return world;
}

/**
 * Destroy a test world and clean up resources
 */
export function destroyTestWorld(world: World): void {
  if (world) {
    world.destroy();
  }
}
